'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResponse } from '@/core/types/actions'
import { calculateVaccineSchedule } from '@/core/use-cases/vaccine-protocols'
import { getBrazilDateString } from '@/core/utils/timezone'
import { prepareValidatedImageUpload } from '@/core/utils/upload-validation'
import { buildStorageRef, normalizeStorageRef, signStorageUrl } from '@/infrastructure/storage/media'
import type { Json } from '@/types/supabase'

const MAX_CONSULTATION_IMAGE_BYTES = 5 * 1024 * 1024

function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return false
  const date = new Date(Date.UTC(y, m - 1, d))
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  )
}

function resolveCompletionDates(completionDate?: string): {
  completionTimestamp: string
  appliedDate: string
} {
  if (!completionDate) {
    const now = new Date()
    return {
      completionTimestamp: now.toISOString(),
      appliedDate: getBrazilDateString(now),
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(completionDate)) {
    return {
      completionTimestamp: `${completionDate}T12:00:00.000-03:00`,
      appliedDate: completionDate,
    }
  }

  const parsed = new Date(completionDate)
  if (Number.isNaN(parsed.getTime())) {
    const now = new Date()
    return {
      completionTimestamp: now.toISOString(),
      appliedDate: getBrazilDateString(now),
    }
  }

  return {
    completionTimestamp: parsed.toISOString(),
    appliedDate: getBrazilDateString(parsed),
  }
}

function mapFinalizeConsultationRpcError(message: string): string {
  if (message.includes('ALREADY_COMPLETED')) {
    return 'Este atendimento já foi finalizado anteriormente.'
  }
  if (message.includes('CONSULTATION_NOT_FOUND')) {
    return 'Consulta não encontrada.'
  }
  if (message.includes('FORBIDDEN_PATIENT')) {
    return 'Paciente não encontrado ou sem permissão.'
  }
  if (message.includes('INVALID_INVENTORY_ITEM')) {
    return 'Um ou mais itens selecionados são inválidos ou não pertencem ao seu estoque.'
  }
  if (message.includes('UNAUTHORIZED')) {
    return 'Não autenticado'
  }
  if (message.includes('INVALID_TRAVEL_FEE')) {
    return 'Taxa de deslocamento inválida.'
  }
  if (message.includes('INVALID_WEIGHT')) {
    return 'Peso do paciente inválido.'
  }
  if (message.includes('INVALID_TRAVEL_DISTANCE')) {
    return 'Distância de deslocamento inválida.'
  }
  if (message.includes('INVALID_VACCINATION')) {
    return 'Dados de vacinação inválidos.'
  }
  return 'Erro ao finalizar atendimento.'
}

const prescriptionItemSchema = z.object({
  id: z.string().trim().min(1).max(100),
  medicationName: z.string().trim().min(1).max(200),
  concentration: z.string().trim().max(100).optional(),
  dosage: z.string().max(200),
  route: z.string().trim().min(1).max(100),
  frequency: z.string().max(200),
  duration: z.string().max(200),
  instructions: z.string().max(1000).optional(),
})

const vaccinationAppliedSchema = z.object({
  protocolCode: z.enum(['V10_VANGUARD', 'ANTIRRABICA', 'V5_FELINA', 'GRIPE_ORAL', 'CUSTOM']),
  customVaccineName: z.string().trim().max(120).optional(),
  doseStage: z.enum(['dose_1', 'dose_2', 'dose_3', 'annual']),
  customIntervalDays: z.number().int().min(1).max(3650).optional(),
  notes: z.string().trim().max(1000).optional(),
})

const prontuarioSchema = z.object({
  patientId: z.uuid('Paciente inválido'),
  notes: z.string().max(20000).optional().default(''),
  baseFee: z
    .number()
    .finite('Taxa base inválida')
    .min(0, 'Taxa base não pode ser negativa')
    .max(100000, 'Valor muito alto')
    .optional()
    .default(0),
  items: z
    .array(
      z.object({
        id: z.uuid('ID do item inválido'),
        name: z.string().max(200),
        quantity: z
          .number()
          .finite('Quantidade inválida')
          .positive('Quantidade deve ser maior que zero')
          .max(1000, 'Quantidade máxima excedida'),
        unitCost: z
          .number()
          .finite('Custo unitário inválido')
          .min(0, 'Custo unitário não pode ser negativo')
          .max(100000)
          .optional(),
        price: z
          .number()
          .finite('Preço inválido')
          .min(0, 'Preço não pode ser negativo')
          .max(100000)
          .optional(),
      })
    )
    .max(100, 'Máximo de 100 itens por atendimento')
    .optional()
    .default([]),
  prescriptionText: z.string().max(20000).optional().default(''),
  prescriptions: z
    .array(prescriptionItemSchema)
    .max(100, 'Máximo de 100 prescrições por atendimento')
    .optional()
    .default([]),
  vaccinations: z
    .array(vaccinationAppliedSchema)
    .max(20, 'Máximo de 20 vacinas por atendimento')
    .optional()
    .default([]),
  consultationId: z.uuid('ID de consulta inválido').optional(),
  weightKg: z
    .number()
    .finite('Peso inválido')
    .positive('Peso deve ser maior que zero')
    .max(300, 'Peso máximo é 300 kg')
    .optional(),
  completionDate: z
    .string()
    .trim()
    .max(64)
    .refine(
      (val) => (/^\d{4}-\d{2}-\d{2}$/.test(val) ? isValidCalendarDate(val) : !Number.isNaN(Date.parse(val))),
      'Data de conclusão inválida'
    )
    .optional(),
  images: z
    .array(z.string().max(1024))
    .max(20, 'Máximo de 20 imagens por atendimento')
    .optional()
    .default([]),
  type: z.enum(['Home', 'Hospital']),
  address: z.string().trim().max(500).optional(),
  travelDistanceKm: z
    .number()
    .finite('Distância inválida')
    .min(0, 'Distância não pode ser negativa')
    .max(500, 'Distância máxima é 500 km')
    .optional()
    .nullable(),
  travelFee: z
    .number()
    .finite('Taxa de deslocamento inválida')
    .min(0, 'Taxa de deslocamento não pode ser negativa')
    .max(500, 'Taxa de deslocamento máxima é R$ 500')
    .optional()
    .nullable(),
})

export async function uploadConsultationImageAction(
  formData: FormData
): Promise<ActionResponse<{ storageRef: string; signedUrl: string }>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Não autenticado' }
    }

    const rawFile = formData.get('image')
    const file = rawFile instanceof File ? rawFile : null
    const validation = await prepareValidatedImageUpload(file, MAX_CONSULTATION_IMAGE_BYTES)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const fileName = `${user.id}-consult-${crypto.randomUUID()}.${validation.extension}`
    const { error: uploadError } = await supabase.storage
      .from('consultations')
      .upload(fileName, validation.bytes, {
        upsert: false,
        contentType: validation.contentType,
      })

    if (uploadError) {
      console.error('Upload consultation image error:', uploadError)
      return { success: false, error: 'Não foi possível salvar a imagem no Storage.' }
    }

    const storageRef = buildStorageRef('consultations', fileName)
    const signedUrl = await signStorageUrl(supabase, storageRef, 'consultations')

    return {
      success: true,
      data: {
        storageRef,
        signedUrl: signedUrl || '',
      },
    }
  } catch (err) {
    console.error('Unexpected upload consultation image error:', err)
    return { success: false, error: 'Erro ao fazer upload da imagem.' }
  }
}

export async function salvarProntuario(
  rawData: unknown
): Promise<ActionResponse<{ consultationId: string }>> {
  try {
    const result = prontuarioSchema.safeParse(rawData)
    if (!result.success) {
      return {
        success: false,
        error: 'Dados inválidos',
        fieldErrors: result.error.flatten().fieldErrors,
      }
    }
    const data = result.data

    const normalizedImages: string[] = []
    for (const rawImg of data.images) {
      const normalized = normalizeStorageRef(rawImg, 'consultations')
      if (!normalized || !normalized.startsWith('storage://consultations/')) {
        return { success: false, error: 'Referência de imagem inválida.' }
      }
      normalizedImages.push(normalized)
    }

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return { success: false, error: 'Não autenticado' }
    }

    const { completionTimestamp, appliedDate } = resolveCompletionDates(data.completionDate)

    const serializedPrescriptions: Json[] = data.prescriptions.map((rx) => ({
      id: rx.id,
      medicationName: rx.medicationName,
      ...(rx.concentration !== undefined ? { concentration: rx.concentration } : {}),
      dosage: rx.dosage,
      route: rx.route,
      frequency: rx.frequency,
      duration: rx.duration,
      ...(rx.instructions !== undefined ? { instructions: rx.instructions } : {}),
    }))

    const prescriptionsPayload: Json = data.prescriptionText.trim()
      ? { text: data.prescriptionText.trim(), items: serializedPrescriptions }
      : serializedPrescriptions

    const rpcItems: Json = data.items
      .filter((item) => item.quantity > 0)
      .map((item) => ({
        inventory_id: item.id,
        quantity: item.quantity,
      }))

    const rpcVaccinations: Json = data.vaccinations.map((vac) => {
      const schedule = calculateVaccineSchedule({
        protocolCode: vac.protocolCode,
        customVaccineName: vac.customVaccineName,
        doseStage: vac.doseStage,
        appliedDate,
        customIntervalDays: vac.customIntervalDays,
      })

      return {
        protocol_code: schedule.protocolCode,
        vaccine_name: schedule.vaccineName,
        dose_number: schedule.doseNumber,
        total_initial_doses: schedule.totalInitialDoses,
        is_annual_booster: schedule.isAnnualBooster,
        applied_date: schedule.appliedDate,
        next_due_date: schedule.nextDueDate,
        next_dose_label: schedule.nextDoseLabel,
        notes: vac.notes?.trim() || 'Aplicada durante atendimento clínico',
      }
    })

    const { data: rpcConsultationId, error: rpcError } = await supabase.rpc(
      'finalize_consultation_atomic',
      {
        p_patient_id: data.patientId,
        p_consultation_id: data.consultationId ?? null,
        p_type: data.type,
        p_notes: data.notes,
        p_weight_kg: data.weightKg ?? null,
        p_completion_date: completionTimestamp,
        p_images: normalizedImages,
        p_address: data.address?.trim() || null,
        p_prescriptions: prescriptionsPayload,
        p_travel_distance_km: data.type === 'Home' ? (data.travelDistanceKm ?? null) : null,
        p_travel_fee: data.type === 'Home' ? (data.travelFee ?? 0) : 0,
        p_items: rpcItems,
        p_vaccinations: rpcVaccinations,
      }
    )

    if (rpcError || !rpcConsultationId) {
      if (rpcError) {
        console.error('finalize_consultation_atomic error:', rpcError)
        return {
          success: false,
          error: mapFinalizeConsultationRpcError(rpcError.message || ''),
        }
      }
      return { success: false, error: 'Erro ao finalizar atendimento.' }
    }

    revalidatePath('/')
    revalidatePath('/prontuario')
    revalidatePath('/agenda')
    revalidatePath('/financeiro')
    revalidatePath(`/pacientes/${data.patientId}`)

    return { success: true, data: { consultationId: rpcConsultationId } }
  } catch (err: unknown) {
    console.error('CRITICAL SERVER ACTION ERROR:', err)
    return { success: false, error: 'Erro interno do servidor.' }
  }
}
