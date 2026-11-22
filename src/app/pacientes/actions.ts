'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResponse } from '@/core/types/actions'
import { formatFullAddress } from '@/core/utils/cep'
import {
  calculateVaccineSchedule,
  type VaccineProtocolCode,
} from '@/core/use-cases/vaccine-protocols'
import { prepareValidatedImageUpload } from '@/core/utils/upload-validation'
import { buildStorageRef, normalizeStorageRef, signStorageUrl } from '@/infrastructure/storage/media'
import {
  assertConsultationOwnership,
  assertPatientOwnership,
  assertTutorOwnership,
} from '@/infrastructure/auth/session'

const MAX_PET_PHOTO_BYTES = 4 * 1024 * 1024
const uuidSchema = z.uuid('ID inválido')

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

const optionalBirthDateSchema = z
  .string()
  .trim()
  .max(32)
  .refine((v) => !v || isValidCalendarDate(v), 'Data de nascimento inválida')
  .optional()
  .nullable()

const updateTutorSchema = z.object({
  name: z.string().trim().min(1, 'Nome do tutor é obrigatório').max(150),
  phone: z.string().trim().max(30).optional().nullable(),
  cpf: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  cep: z.string().trim().max(20).optional().nullable(),
  street: z.string().trim().max(200).optional().nullable(),
  number: z.string().trim().max(30).optional().nullable(),
  complement: z.string().trim().max(150).optional().nullable(),
  neighborhood: z.string().trim().max(150).optional().nullable(),
  city: z.string().trim().max(150).optional().nullable(),
  state: z.string().trim().max(50).optional().nullable(),
})

const updatePatientSchema = z.object({
  name: z.string().trim().min(1, 'Nome do paciente é obrigatório').max(150),
  species: z.string().trim().min(1, 'Espécie é obrigatória').max(50),
  weight_kg: z
    .number()
    .finite('Peso inválido')
    .positive('Peso deve ser maior que zero')
    .max(300, 'Peso máximo é 300 kg'),
  breed: z.string().trim().max(120).optional().nullable(),
  color: z.string().trim().max(120).optional().nullable(),
  photo_url: z.string().max(1024).optional().nullable(),
  birth_date: optionalBirthDateSchema,
  is_birth_date_estimated: z.boolean().optional(),
  fertility_status: z.string().trim().max(100).optional().nullable(),
  fertility_notes: z.string().trim().max(500).optional().nullable(),
  clinical_observations: z.string().trim().max(5000).optional().nullable(),
})

const addVaccinationSchema = z.object({
  patientId: uuidSchema,
  consultationId: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    uuidSchema.optional()
  ),
  protocolCode: z.enum(['V10_VANGUARD', 'ANTIRRABICA', 'V5_FELINA', 'GRIPE_ORAL', 'CUSTOM']),
  customVaccineName: z.string().trim().max(120).optional(),
  doseStage: z.enum(['dose_1', 'dose_2', 'dose_3', 'annual']),
  appliedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de aplicação inválida')
    .refine(isValidCalendarDate, 'Data de aplicação inválida'),
  batchNumber: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1000).optional(),
  customIntervalDays: z.preprocess(
    (v) => (typeof v === 'number' && Number.isNaN(v) ? undefined : v),
    z.number().int().min(1).max(3650).optional()
  ),
})

export async function uploadPetPhotoAction(
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

    const rawFile = formData.get('photo')
    const file = rawFile instanceof File ? rawFile : null
    const validation = await prepareValidatedImageUpload(file, MAX_PET_PHOTO_BYTES)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const fileName = `${user.id}-pet-${crypto.randomUUID()}.${validation.extension}`
    const { error: uploadError } = await supabase.storage
      .from('patients')
      .upload(fileName, validation.bytes, {
        upsert: false,
        contentType: validation.contentType,
      })

    if (uploadError) {
      console.error('Upload pet photo error:', uploadError)
      return { success: false, error: 'Não foi possível salvar a foto no Storage.' }
    }

    const storageRef = buildStorageRef('patients', fileName)
    const signedUrl = await signStorageUrl(supabase, storageRef, 'patients')

    return {
      success: true,
      data: {
        storageRef,
        signedUrl: signedUrl || '',
      },
    }
  } catch (err) {
    console.error('Upload pet photo error:', err)
    return { success: false, error: 'Erro ao fazer upload da foto.' }
  }
}

const patientSchema = z.object({
  tutorId: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    uuidSchema.optional()
  ),
  tutorName: z.string().trim().max(150).optional(),
  tutorPhone: z.string().trim().max(30).optional(),
  tutorCpf: z.string().trim().max(20).optional(),
  tutorCep: z.string().trim().max(20).optional(),
  tutorStreet: z.string().trim().max(200).optional(),
  tutorNumber: z.string().trim().max(30).optional(),
  tutorComplement: z.string().trim().max(150).optional(),
  tutorNeighborhood: z.string().trim().max(150).optional(),
  tutorCity: z.string().trim().max(150).optional(),
  tutorState: z.string().trim().max(50).optional(),
  tutorAddress: z.string().trim().max(500).optional(),
  patientName: z.string().trim().min(1, 'Nome do paciente é obrigatório').max(150),
  patientSpecies: z.string().trim().min(1, 'Espécie é obrigatória').max(50),
  patientWeight: z
    .number()
    .finite('Peso inválido')
    .positive('Peso deve ser maior que zero')
    .max(300, 'Peso máximo é 300 kg'),
  patientBreed: z.string().trim().max(120).optional(),
  patientColor: z.string().trim().max(120).optional(),
  patientPhotoUrl: z.string().max(1024).optional().nullable(),
  patientBirthDate: optionalBirthDateSchema,
  isBirthDateEstimated: z.boolean().optional(),
  fertilityStatus: z.string().trim().max(100).optional().nullable(),
  fertilityNotes: z.string().trim().max(500).optional().nullable(),
  clinicalObservations: z.string().trim().max(5000).optional().nullable(),
})

export async function addPatientAndTutor(rawData: unknown): Promise<ActionResponse> {
  try {
    const result = patientSchema.safeParse(rawData)
    if (!result.success) {
      return {
        success: false,
        error: 'Dados inválidos',
        fieldErrors: result.error.flatten().fieldErrors,
      }
    }
    const data = result.data

    let normalizedPhotoUrl: string | null = null
    const rawPhotoUrl = data.patientPhotoUrl?.trim()
    if (rawPhotoUrl) {
      normalizedPhotoUrl = normalizeStorageRef(rawPhotoUrl, 'patients')
      if (!normalizedPhotoUrl) {
        return { success: false, error: 'URL de foto inválida.' }
      }
    }

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return { success: false, error: 'Não autenticado' }
    }

    const profileId = userData.user.id
    let tutorId: string | undefined = data.tutorId
    let createdNewTutorId: string | null = null

    if (tutorId) {
      const ownsTutor = await assertTutorOwnership(supabase, tutorId, profileId)
      if (!ownsTutor) {
        return { success: false, error: 'Tutor não encontrado ou sem permissão.' }
      }
    } else {
      if (!data.tutorName) {
        return { success: false, error: 'Nome do tutor é obrigatório para novo cadastro' }
      }

      const formattedAddress =
        data.tutorAddress ||
        formatFullAddress({
          cep: data.tutorCep,
          street: data.tutorStreet,
          number: data.tutorNumber,
          complement: data.tutorComplement,
          neighborhood: data.tutorNeighborhood,
          city: data.tutorCity,
          state: data.tutorState,
        }) ||
        null

      const { data: newTutor, error: tutorError } = await supabase
        .from('tutors')
        .insert({
          profile_id: profileId,
          name: data.tutorName,
          phone: data.tutorPhone || null,
          cpf: data.tutorCpf || null,
          address: formattedAddress,
          cep: data.tutorCep || null,
          street: data.tutorStreet || null,
          number: data.tutorNumber || null,
          complement: data.tutorComplement || null,
          neighborhood: data.tutorNeighborhood || null,
          city: data.tutorCity || null,
          state: data.tutorState || null,
        })
        .select('id')
        .single()

      if (tutorError || !newTutor) {
        if (tutorError?.code === '23505') {
          if (tutorError.message.includes('cpf')) {
            return { success: false, error: 'Já existe um tutor cadastrado com este CPF.' }
          }
          if (tutorError.message.includes('phone')) {
            return { success: false, error: 'Já existe um tutor cadastrado com este telefone.' }
          }
          return { success: false, error: 'Tutor já cadastrado com estes dados.' }
        }
        console.error('Tutor creation error:', tutorError)
        return { success: false, error: 'Erro ao cadastrar o tutor.' }
      }

      tutorId = newTutor.id
      createdNewTutorId = newTutor.id
    }

    const { error: patientError } = await supabase
      .from('patients')
      .insert({
        tutor_id: tutorId,
        name: data.patientName,
        species: data.patientSpecies,
        weight_kg: data.patientWeight,
        breed: data.patientBreed || null,
        color: data.patientColor || null,
        birth_date: data.patientBirthDate || null,
        photo_url: normalizedPhotoUrl,
        is_birth_date_estimated: data.isBirthDateEstimated ?? false,
        fertility_status: data.fertilityStatus || null,
        fertility_notes: data.fertilityNotes || null,
        clinical_observations: data.clinicalObservations || null,
      })
      .select('id')
      .single()

    if (patientError) {
      if (createdNewTutorId) {
        const { error: rollbackError } = await supabase
          .from('tutors')
          .delete()
          .eq('id', createdNewTutorId)
          .eq('profile_id', profileId)
        if (rollbackError) {
          console.error('Compensating tutor delete error:', rollbackError)
        }
      }
      console.error('Patient creation error:', patientError)
      return { success: false, error: 'Erro ao cadastrar o paciente.' }
    }

    revalidatePath('/pacientes')
    revalidatePath('/tutores')
    return { success: true }
  } catch (err: unknown) {
    console.error('CRITICAL PATIENT ACTION ERROR:', err)
    return { success: false, error: 'Erro interno do servidor.' }
  }
}

export async function deletePatient(
  patientId: string,
  options?: { deleteOrphanTutor?: boolean }
): Promise<ActionResponse> {
  try {
    if (!uuidSchema.safeParse(patientId).success) {
      return { success: false, error: 'ID de paciente inválido.' }
    }

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return { success: false, error: 'Não autenticado' }
    }

    const { data, error } = await supabase.rpc('delete_patient_atomic', {
      p_patient_id: patientId,
      p_delete_orphan_tutor: Boolean(options?.deleteOrphanTutor),
    })

    if (error || !data) {
      if (error) {
        console.error('delete_patient_atomic error:', error)
        const msg = error.message || ''
        if (msg.includes('UNAUTHORIZED')) {
          return { success: false, error: 'Não autenticado' }
        }
        if (msg.includes('FORBIDDEN_PATIENT')) {
          return { success: false, error: 'Paciente não encontrado ou sem permissão.' }
        }
      }
      return { success: false, error: 'Erro ao excluir o paciente.' }
    }

    revalidatePath('/pacientes')
    if (options?.deleteOrphanTutor) {
      revalidatePath('/tutores')
    }
    revalidatePath('/agenda')
    revalidatePath('/financeiro')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    console.error('CRITICAL DELETE PATIENT ERROR:', err)
    return { success: false, error: 'Erro inesperado ao excluir.' }
  }
}

export async function deleteTutor(tutorId: string): Promise<ActionResponse> {
  try {
    if (!uuidSchema.safeParse(tutorId).success) {
      return { success: false, error: 'ID de tutor inválido.' }
    }

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return { success: false, error: 'Não autenticado' }
    }

    const { data, error } = await supabase.rpc('delete_tutor_atomic', {
      p_tutor_id: tutorId,
    })

    if (error || !data) {
      if (error) {
        console.error('delete_tutor_atomic error:', error)
        const msg = error.message || ''
        if (msg.includes('UNAUTHORIZED')) {
          return { success: false, error: 'Não autenticado' }
        }
        if (msg.includes('FORBIDDEN_TUTOR')) {
          return { success: false, error: 'Tutor não encontrado.' }
        }
      }
      return { success: false, error: 'Erro ao excluir o tutor.' }
    }

    revalidatePath('/tutores')
    revalidatePath('/pacientes')
    revalidatePath('/agenda')
    revalidatePath('/financeiro')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    console.error('Unexpected delete tutor error:', err)
    return { success: false, error: 'Erro inesperado ao excluir o tutor.' }
  }
}

export async function getTutors() {
  try {
    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return []

    const { data, error } = await supabase
      .from('tutors')
      .select('id, name, phone, cpf, address, cep, street, number, complement, neighborhood, city, state')
      .eq('profile_id', userData.user.id)
      .order('name')

    if (error) {
      console.error('Error fetching tutors:', error)
      return []
    }
    return data ?? []
  } catch (err) {
    console.error('Error fetching tutors:', err)
    return []
  }
}

export async function updateTutor(
  tutorId: string,
  data: {
    name: string
    phone?: string
    cpf?: string
    address?: string
    cep?: string
    street?: string
    number?: string
    complement?: string
    neighborhood?: string
    city?: string
    state?: string
  }
): Promise<ActionResponse> {
  try {
    if (!uuidSchema.safeParse(tutorId).success) {
      return { success: false, error: 'ID de tutor inválido.' }
    }

    const parsed = updateTutorSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: 'Dados do tutor inválidos.' }
    }
    const validData = parsed.data

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return { success: false, error: 'Não autenticado' }
    }

    const ownsTutor = await assertTutorOwnership(supabase, tutorId, userData.user.id)
    if (!ownsTutor) {
      return { success: false, error: 'Tutor não encontrado ou sem permissão.' }
    }

    const formattedAddress =
      validData.address ||
      formatFullAddress({
        cep: validData.cep ?? undefined,
        street: validData.street ?? undefined,
        number: validData.number ?? undefined,
        complement: validData.complement ?? undefined,
        neighborhood: validData.neighborhood ?? undefined,
        city: validData.city ?? undefined,
        state: validData.state ?? undefined,
      }) ||
      null

    const { data: updatedRow, error } = await supabase
      .from('tutors')
      .update({
        name: validData.name,
        phone: validData.phone || null,
        cpf: validData.cpf || null,
        address: formattedAddress,
        cep: validData.cep || null,
        street: validData.street || null,
        number: validData.number || null,
        complement: validData.complement || null,
        neighborhood: validData.neighborhood || null,
        city: validData.city || null,
        state: validData.state || null,
      })
      .eq('id', tutorId)
      .eq('profile_id', userData.user.id)
      .select('id')
      .maybeSingle()

    if (error) {
      if (error.code === '23505') {
        if (error.message?.includes('cpf')) {
          return { success: false, error: 'CPF já cadastrado para outro tutor.' }
        }
        if (error.message?.includes('phone')) {
          return { success: false, error: 'Telefone já cadastrado para outro tutor.' }
        }
      }
      console.error('Update tutor error:', error)
      return { success: false, error: 'Erro ao atualizar tutor.' }
    }

    if (!updatedRow) {
      return { success: false, error: 'Tutor não encontrado.' }
    }

    revalidatePath('/tutores')
    revalidatePath('/agenda')
    revalidatePath('/pacientes')
    return { success: true }
  } catch (err) {
    console.error('Update tutor error:', err)
    return { success: false, error: 'Erro ao atualizar tutor.' }
  }
}

export async function updatePatient(
  patientId: string,
  data: {
    name: string
    species: string
    weight_kg: number
    breed?: string
    color?: string
    photo_url?: string | null
    birth_date?: string | null
    is_birth_date_estimated?: boolean
    fertility_status?: string | null
    fertility_notes?: string | null
    clinical_observations?: string | null
  }
): Promise<ActionResponse> {
  try {
    if (!uuidSchema.safeParse(patientId).success) {
      return { success: false, error: 'ID de paciente inválido.' }
    }

    const parsed = updatePatientSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: 'Dados do paciente inválidos.' }
    }
    const validData = parsed.data

    let photoUpdate: string | null | undefined = undefined
    if (validData.photo_url !== undefined) {
      const trimmed = validData.photo_url?.trim()
      if (!trimmed) {
        photoUpdate = null
      } else {
        const normalized = normalizeStorageRef(trimmed, 'patients')
        if (!normalized) {
          return { success: false, error: 'URL de foto inválida.' }
        }
        photoUpdate = normalized
      }
    }

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return { success: false, error: 'Não autenticado' }
    }

    const ownership = await assertPatientOwnership(supabase, patientId, userData.user.id)
    if (!ownership.owned) {
      return { success: false, error: 'Paciente não encontrado ou sem permissão.' }
    }

    const { data: updatedRow, error } = await supabase
      .from('patients')
      .update({
        name: validData.name,
        species: validData.species,
        weight_kg: validData.weight_kg,
        breed: validData.breed || null,
        color: validData.color || null,
        photo_url: photoUpdate,
        birth_date: validData.birth_date !== undefined ? validData.birth_date || null : undefined,
        is_birth_date_estimated: validData.is_birth_date_estimated,
        fertility_status:
          validData.fertility_status !== undefined ? validData.fertility_status || null : undefined,
        fertility_notes:
          validData.fertility_notes !== undefined ? validData.fertility_notes || null : undefined,
        clinical_observations:
          validData.clinical_observations !== undefined
            ? validData.clinical_observations || null
            : undefined,
      })
      .eq('id', patientId)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Update patient error:', error)
      return { success: false, error: 'Erro ao atualizar paciente.' }
    }

    if (!updatedRow) {
      return { success: false, error: 'Paciente não encontrado.' }
    }

    revalidatePath('/pacientes')
    revalidatePath(`/pacientes/${patientId}`)
    return { success: true }
  } catch (err) {
    console.error('Update patient error:', err)
    return { success: false, error: 'Erro ao atualizar paciente.' }
  }
}

export async function addPatientVaccination(input: {
  patientId: string
  consultationId?: string
  protocolCode: VaccineProtocolCode
  customVaccineName?: string
  doseStage: 'dose_1' | 'dose_2' | 'dose_3' | 'annual'
  appliedDate: string
  batchNumber?: string
  notes?: string
  customIntervalDays?: number
}): Promise<ActionResponse> {
  try {
    const parsed = addVaccinationSchema.safeParse(input)
    if (!parsed.success) {
      return { success: false, error: 'Dados da vacinação inválidos.' }
    }
    const validInput = parsed.data

    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Não autenticado' }
    }

    const patientOwnership = await assertPatientOwnership(
      supabase,
      validInput.patientId,
      user.id
    )
    if (!patientOwnership.owned) {
      return { success: false, error: 'Paciente não encontrado ou sem permissão.' }
    }

    if (validInput.consultationId) {
      const ownsConsultation = await assertConsultationOwnership(
        supabase,
        validInput.consultationId,
        user.id
      )
      if (!ownsConsultation) {
        return { success: false, error: 'Consulta não encontrada ou sem permissão.' }
      }
    }

    const schedule = calculateVaccineSchedule({
      protocolCode: validInput.protocolCode,
      customVaccineName: validInput.customVaccineName,
      doseStage: validInput.doseStage,
      appliedDate: validInput.appliedDate,
      customIntervalDays: validInput.customIntervalDays,
    })

    const { data: inserted, error: insertError } = await supabase
      .from('patient_vaccinations')
      .insert({
        profile_id: user.id,
        patient_id: validInput.patientId,
        consultation_id: validInput.consultationId || null,
        protocol_code: schedule.protocolCode,
        vaccine_name: schedule.vaccineName,
        dose_number: schedule.doseNumber,
        total_initial_doses: schedule.totalInitialDoses,
        is_annual_booster: schedule.isAnnualBooster,
        applied_date: schedule.appliedDate,
        next_due_date: schedule.nextDueDate,
        next_dose_label: schedule.nextDoseLabel,
        batch_number: validInput.batchNumber || null,
        notes: validInput.notes || null,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Add vaccination error:', insertError)
      return {
        success: false,
        error: 'Erro ao registrar vacina.',
      }
    }

    if (inserted?.id) {
      if (schedule.protocolCode === 'CUSTOM') {
        const normalizedTargetName = schedule.vaccineName.trim().toLowerCase()
        const { data: openCustomRows, error: fetchPrevError } = await supabase
          .from('patient_vaccinations')
          .select('id, vaccine_name')
          .eq('patient_id', validInput.patientId)
          .eq('profile_id', user.id)
          .eq('protocol_code', 'CUSTOM')
          .is('completed_by_vaccination_id', null)
          .lte('applied_date', schedule.appliedDate)
          .neq('id', inserted.id)

        if (fetchPrevError) {
          console.error('Fetch previous custom vaccinations error:', fetchPrevError)
          return {
            success: false,
            error: 'Vacina registrada, mas houve erro ao atualizar doses anteriores.',
          }
        }

        const matchingIds = (openCustomRows ?? [])
          .filter((row) => row.vaccine_name.trim().toLowerCase() === normalizedTargetName)
          .map((row) => row.id)

        if (matchingIds.length > 0) {
          const { error: closeError } = await supabase
            .from('patient_vaccinations')
            .update({ completed_by_vaccination_id: inserted.id })
            .in('id', matchingIds)
            .eq('profile_id', user.id)

          if (closeError) {
            console.error('Close previous custom vaccinations error:', closeError)
            return {
              success: false,
              error: 'Vacina registrada, mas houve erro ao atualizar doses anteriores.',
            }
          }
        }
      } else {
        const { error: closeError } = await supabase
          .from('patient_vaccinations')
          .update({ completed_by_vaccination_id: inserted.id })
          .eq('patient_id', validInput.patientId)
          .eq('profile_id', user.id)
          .eq('protocol_code', schedule.protocolCode)
          .is('completed_by_vaccination_id', null)
          .lte('applied_date', schedule.appliedDate)
          .neq('id', inserted.id)

        if (closeError) {
          console.error('Close previous vaccinations error:', closeError)
          return {
            success: false,
            error: 'Vacina registrada, mas houve erro ao atualizar doses anteriores.',
          }
        }
      }
    }

    revalidatePath(`/pacientes/${validInput.patientId}`)
    revalidatePath('/agenda')
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    console.error('Unexpected vaccination error:', err)
    return { success: false, error: 'Erro inesperado ao registrar vacinação.' }
  }
}

export async function deletePatientVaccination(
  vaccinationId: string,
  patientId: string
): Promise<ActionResponse> {
  try {
    if (!uuidSchema.safeParse(vaccinationId).success || !uuidSchema.safeParse(patientId).success) {
      return { success: false, error: 'ID inválido para remoção vacinal.' }
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user) {
      return { success: false, error: 'Não autenticado' }
    }

    const { data: deletedRow, error } = await supabase
      .from('patient_vaccinations')
      .delete()
      .eq('id', vaccinationId)
      .eq('patient_id', patientId)
      .eq('profile_id', user.id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Delete vaccination error:', error)
      return { success: false, error: 'Erro ao remover registro vacinal.' }
    }

    if (!deletedRow) {
      return { success: false, error: 'Registro vacinal não encontrado.' }
    }

    revalidatePath(`/pacientes/${patientId}`)
    revalidatePath('/agenda')
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    console.error('Delete vaccination error:', err)
    return { success: false, error: 'Erro ao remover registro vacinal.' }
  }
}
