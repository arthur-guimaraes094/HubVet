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
import { savePatientExtendedMeta } from '@/core/utils/patient-fallback-storage'
import { validateImageUpload } from '@/core/utils/upload-validation'

const uuidSchema = z.string().uuid('ID inválido')

const updateTutorSchema = z.object({
  name: z.string().trim().min(1, 'Nome do tutor é obrigatório'),
  phone: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  complement: z.string().optional().nullable(),
  neighborhood: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
})

const updatePatientSchema = z.object({
  name: z.string().trim().min(1, 'Nome do paciente é obrigatório'),
  species: z.string().trim().min(1, 'Espécie é obrigatória'),
  weight_kg: z.number().finite('Peso inválido').min(0, 'Peso não pode ser negativo'),
  breed: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  birth_date: z.string().optional().nullable(),
  is_birth_date_estimated: z.boolean().optional(),
  fertility_status: z.string().optional().nullable(),
  fertility_notes: z.string().optional().nullable(),
  clinical_observations: z.string().optional().nullable(),
})

const addVaccinationSchema = z.object({
  patientId: uuidSchema,
  consultationId: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    uuidSchema.optional()
  ),
  protocolCode: z.enum(['V10_VANGUARD', 'ANTIRRABICA', 'V5_FELINA', 'GRIPE_ORAL', 'CUSTOM']),
  customVaccineName: z.string().optional(),
  doseStage: z.enum(['dose_1', 'dose_2', 'dose_3', 'annual']),
  appliedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de aplicação inválida'),
  batchNumber: z.string().optional(),
  notes: z.string().optional(),
  customIntervalDays: z.preprocess(
    (v) => (typeof v === 'number' && Number.isNaN(v) ? undefined : v),
    z.number().int().positive().max(3650).optional()
  ),
})

export async function uploadPetPhotoAction(
  formData: FormData
): Promise<ActionResponse<{ publicUrl: string }>> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autenticado' }

    const file = formData.get('photo') as File | null
    const validation = await validateImageUpload(file, 4 * 1024 * 1024)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    const fileName = `${user.id}-pet-${crypto.randomUUID()}.${validation.extension}`

    const bucketsToTry = ['patients', 'avatars', 'consultations']
    let usedBucket = 'consultations'
    let uploadSucceeded = false

    for (const bucket of bucketsToTry) {
      const { error } = await supabase.storage.from(bucket).upload(fileName, file!, {
        upsert: true,
        contentType: validation.contentType,
      })
      if (!error) {
        usedBucket = bucket
        uploadSucceeded = true
        break
      }
    }

    if (!uploadSucceeded) {
      return { success: false, error: 'Não foi possível salvar a foto no Storage' }
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(usedBucket).getPublicUrl(fileName)

    return { success: true, data: { publicUrl } }
  } catch (err) {
    console.error('Upload pet photo error:', err)
    return { success: false, error: 'Erro ao fazer upload da foto' }
  }
}

const patientSchema = z.object({
  tutorId: z.string().optional(),
  tutorName: z.string().optional(),
  tutorPhone: z.string().optional(),
  tutorCpf: z.string().optional(),
  tutorCep: z.string().optional(),
  tutorStreet: z.string().optional(),
  tutorNumber: z.string().optional(),
  tutorComplement: z.string().optional(),
  tutorNeighborhood: z.string().optional(),
  tutorCity: z.string().optional(),
  tutorState: z.string().optional(),
  tutorAddress: z.string().optional(),
  patientName: z.string().min(1, 'Nome do paciente é obrigatório'),
  patientSpecies: z.string().min(1, 'Espécie é obrigatória'),
  patientWeight: z.number().min(0, 'Peso não pode ser negativo'),
  patientBreed: z.string().optional(),
  patientColor: z.string().optional(),
  patientPhotoUrl: z.string().optional().nullable(),
  patientBirthDate: z.string().optional().nullable(),
  isBirthDateEstimated: z.boolean().optional(),
  fertilityStatus: z.string().optional().nullable(),
  fertilityNotes: z.string().optional().nullable(),
  clinicalObservations: z.string().optional().nullable(),
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

    const supabase = await createClient()

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return { success: false, error: 'Não autenticado' }

    const profileId = userData.user.id
    let tutorId: string | undefined = data.tutorId

    // 1. Lidar com Tutor (Existente ou Novo)
    if (!tutorId) {
      if (!data.tutorName) {
        return { success: false, error: 'Nome do tutor é obrigatório para novo cadastro' }
      }

      const formattedAddress =
        data.tutorAddress?.trim() ||
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

      const fullTutorPayload = {
        profile_id: profileId,
        name: data.tutorName,
        phone: data.tutorPhone?.trim() || null,
        cpf: data.tutorCpf?.trim() || null,
        address: formattedAddress,
        cep: data.tutorCep?.trim() || null,
        street: data.tutorStreet?.trim() || null,
        number: data.tutorNumber?.trim() || null,
        complement: data.tutorComplement?.trim() || null,
        neighborhood: data.tutorNeighborhood?.trim() || null,
        city: data.tutorCity?.trim() || null,
        state: data.tutorState?.trim() || null,
      }

      let { data: newTutor, error: tutorError } = await supabase
        .from('tutors')
        .insert(fullTutorPayload)
        .select('id')
        .single()

      // Fallback caso a migration de colunas extras de endereço ainda não tenha sido rodada no banco
      if (tutorError && (tutorError.code === '42703' || tutorError.code === 'PGRST204')) {
        const fallbackRes = await supabase
          .from('tutors')
          .insert({
            profile_id: profileId,
            name: data.tutorName,
            phone: data.tutorPhone?.trim() || null,
            cpf: data.tutorCpf?.trim() || null,
            address: formattedAddress,
          })
          .select('id')
          .single()
        newTutor = fallbackRes.data
        tutorError = fallbackRes.error
      }

      if (tutorError) {
        if (tutorError.code === '23505') {
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
      tutorId = (newTutor as { id: string }).id
    }

    // 2. Inserir Paciente
    const fullPatientPayload = {
      tutor_id: tutorId,
      name: data.patientName,
      species: data.patientSpecies,
      weight_kg: data.patientWeight,
      breed: data.patientBreed || null,
      color: data.patientColor || null,
      birth_date: data.patientBirthDate || null,
      photo_url: data.patientPhotoUrl || null,
      is_birth_date_estimated: data.isBirthDateEstimated ?? false,
      fertility_status: data.fertilityStatus || null,
      fertility_notes: data.fertilityNotes || null,
      clinical_observations: data.clinicalObservations || null,
    }

    let { data: createdPatient, error: patientError } = await supabase
      .from('patients')
      .insert(fullPatientPayload)
      .select('id')
      .single()

    // Fallback caso a migration das novas colunas em patients ainda não tenha sido executada
    if (patientError && (patientError.code === '42703' || patientError.code === 'PGRST204')) {
      const fallbackPatient = await supabase
        .from('patients')
        .insert({
          tutor_id: tutorId,
          name: data.patientName,
          species: data.patientSpecies,
          weight_kg: data.patientWeight,
          breed: data.patientBreed || null,
          color: data.patientColor || null,
          birth_date: data.patientBirthDate || null,
        })
        .select('id')
        .single()
      createdPatient = fallbackPatient.data
      patientError = fallbackPatient.error

      if (!patientError && createdPatient?.id) {
        await savePatientExtendedMeta(supabase, createdPatient.id, {
          photo_url: data.patientPhotoUrl || null,
          is_birth_date_estimated: data.isBirthDateEstimated ?? false,
          fertility_status: data.fertilityStatus || null,
          fertility_notes: data.fertilityNotes || null,
          clinical_observations: data.clinicalObservations || null,
        })
      }
    }

    if (patientError) {
      console.error('Patient creation error:', patientError)
      return { success: false, error: 'Erro ao cadastrar o paciente.' }
    }

    revalidatePath('/pacientes')
    revalidatePath('/tutores')
    return { success: true }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno do servidor'
    console.error('CRITICAL PATIENT ACTION ERROR:', err)
    return { success: false, error: errorMessage }
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
    if (userError || !userData.user) return { success: false, error: 'Não autenticado' }

    const { data: invoices } = await supabase
      .from('invoices')
      .select('id')
      .eq('patient_id', patientId)
    if (invoices && invoices.length > 0) {
      const invoiceIds = invoices.map((i) => i.id)
      await supabase.from('invoice_items').delete().in('invoice_id', invoiceIds)
      await supabase.from('invoices').delete().in('id', invoiceIds)
    }

    const { data: consultations } = await supabase
      .from('consultations')
      .select('id')
      .eq('patient_id', patientId)
    if (consultations && consultations.length > 0) {
      const consultationIds = consultations.map((c) => c.id)
      await supabase.from('transactions').delete().in('consultation_id', consultationIds)
      await supabase.from('consultation_items').delete().in('consultation_id', consultationIds)
      await supabase.from('consultations').delete().in('id', consultationIds)
    }

    const { data: patientData } = await supabase
      .from('patients')
      .select('tutor_id')
      .eq('id', patientId)
      .single()

    const tutorId = patientData?.tutor_id

    const { error: patientError } = await supabase.from('patients').delete().eq('id', patientId)
    if (patientError) {
      console.error('Delete patient error:', patientError)
      return { success: false, error: 'Erro ao excluir o paciente.' }
    }

    if (tutorId && options?.deleteOrphanTutor === true) {
      const { count } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('tutor_id', tutorId)

      if (count === 0) {
        await supabase
          .from('tutors')
          .delete()
          .eq('id', tutorId)
          .eq('profile_id', userData.user.id)
        revalidatePath('/tutores')
      }
    }
    revalidatePath('/pacientes')
    return { success: true }
  } catch (err: unknown) {
    console.error('CRITICAL DELETE PATIENT ERROR:', err)
    return { success: false, error: 'Erro inesperado ao excluir.' }
  }
}

export async function deleteTutor(tutorId: string) {
  try {
    if (!uuidSchema.safeParse(tutorId).success) {
      return { success: false, error: 'ID de tutor inválido.' }
    }

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return { success: false, error: 'Não autenticado' }

    const { data: ownedTutor } = await supabase
      .from('tutors')
      .select('id')
      .eq('id', tutorId)
      .eq('profile_id', userData.user.id)
      .single()

    if (!ownedTutor) {
      return { success: false, error: 'Tutor não encontrado.' }
    }

    const { data: patients } = await supabase
      .from('patients')
      .select('id')
      .eq('tutor_id', tutorId)

    if (patients && patients.length > 0) {
      const patientIds = patients.map((p) => p.id)

      const { data: invoices } = await supabase
        .from('invoices')
        .select('id')
        .in('patient_id', patientIds)
      if (invoices && invoices.length > 0) {
        const invoiceIds = invoices.map((i) => i.id)
        await supabase.from('invoice_items').delete().in('invoice_id', invoiceIds)
        await supabase.from('invoices').delete().in('id', invoiceIds)
      }

      const { data: consultations } = await supabase
        .from('consultations')
        .select('id')
        .in('patient_id', patientIds)
      if (consultations && consultations.length > 0) {
        const consultationIds = consultations.map((c) => c.id)
        await supabase.from('transactions').delete().in('consultation_id', consultationIds)
        await supabase.from('consultation_items').delete().in('consultation_id', consultationIds)
        await supabase.from('consultations').delete().in('id', consultationIds)
      }

      await supabase.from('patients').delete().in('id', patientIds)
    }

    const { error: tutorError } = await supabase
      .from('tutors')
      .delete()
      .eq('id', tutorId)
      .eq('profile_id', userData.user.id)
    if (tutorError) {
      console.error('Delete tutor error:', tutorError)
      return { success: false, error: 'Erro ao excluir o tutor.' }
    }

    revalidatePath('/tutores')
    return { success: true }
  } catch (err: unknown) {
    console.error('Unexpected delete tutor error:', err)
    return { success: false, error: 'Erro inesperado ao excluir o tutor.' }
  }
}

export async function getTutors() {
  try {
    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return []

    const { data, error } = await supabase
      .from('tutors')
      .select('*')
      .eq('profile_id', userData.user.id)
      .order('name')

    if (error) throw error
    return data
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
) {
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
    if (userError || !userData.user) return { success: false, error: 'Não autenticado' }

    const formattedAddress =
      validData.address?.trim() ||
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

    let { error } = await supabase
      .from('tutors')
      .update({
        name: validData.name,
        phone: validData.phone?.trim() || null,
        cpf: validData.cpf?.trim() || null,
        address: formattedAddress,
        cep: validData.cep?.trim() || null,
        street: validData.street?.trim() || null,
        number: validData.number?.trim() || null,
        complement: validData.complement?.trim() || null,
        neighborhood: validData.neighborhood?.trim() || null,
        city: validData.city?.trim() || null,
        state: validData.state?.trim() || null,
      })
      .eq('id', tutorId)
      .eq('profile_id', userData.user.id)

    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      const fallback = await supabase
        .from('tutors')
        .update({
          name: validData.name,
          phone: validData.phone?.trim() || null,
          cpf: validData.cpf?.trim() || null,
          address: formattedAddress,
        })
        .eq('id', tutorId)
        .eq('profile_id', userData.user.id)
      error = fallback.error
    }

    if (error) {
      if (error.code === '23505') {
        if (error.message?.includes('cpf'))
          return { success: false, error: 'CPF já cadastrado para outro tutor.' }
        if (error.message?.includes('phone'))
          return { success: false, error: 'Telefone já cadastrado para outro tutor.' }
      }
      throw error
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
) {
  try {
    if (!uuidSchema.safeParse(patientId).success) {
      return { success: false, error: 'ID de paciente inválido.' }
    }

    const parsed = updatePatientSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: 'Dados do paciente inválidos.' }
    }
    const validData = parsed.data

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return { success: false, error: 'Não autenticado' }

    let { error } = await supabase
      .from('patients')
      .update({
        name: validData.name,
        species: validData.species,
        weight_kg: validData.weight_kg,
        breed: validData.breed || null,
        color: validData.color || null,
        photo_url: validData.photo_url !== undefined ? validData.photo_url : undefined,
        birth_date: validData.birth_date !== undefined ? validData.birth_date : undefined,
        is_birth_date_estimated: validData.is_birth_date_estimated,
        fertility_status:
          validData.fertility_status !== undefined ? validData.fertility_status : undefined,
        fertility_notes:
          validData.fertility_notes !== undefined ? validData.fertility_notes : undefined,
        clinical_observations:
          validData.clinical_observations !== undefined
            ? validData.clinical_observations
            : undefined,
      })
      .eq('id', patientId)

    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      const fallback = await supabase
        .from('patients')
        .update({
          name: validData.name,
          species: validData.species,
          weight_kg: validData.weight_kg,
          breed: validData.breed || null,
          color: validData.color || null,
          birth_date: validData.birth_date !== undefined ? validData.birth_date : undefined,
        })
        .eq('id', patientId)
      error = fallback.error

      if (!error) {
        await savePatientExtendedMeta(supabase, patientId, {
          photo_url: validData.photo_url ?? null,
          is_birth_date_estimated: validData.is_birth_date_estimated ?? false,
          fertility_status: validData.fertility_status ?? null,
          fertility_notes: validData.fertility_notes ?? null,
          clinical_observations: validData.clinical_observations ?? null,
        })
      }
    }

    if (error) throw error

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
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autenticado' }

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
        batch_number: validInput.batchNumber?.trim() || null,
        notes: validInput.notes?.trim() || null,
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('Add vaccination error:', insertError)
      return {
        success: false,
        error:
          'Erro ao registrar vacina. Verifique se a migration de banco (patient_vaccinations) foi aplicada.',
      }
    }

    // Marcar registros anteriores abertos do mesmo protocolo para este pet como concluídos
    if (inserted?.id) {
      await supabase
        .from('patient_vaccinations')
        .update({ completed_by_vaccination_id: inserted.id })
        .eq('patient_id', validInput.patientId)
        .eq('protocol_code', schedule.protocolCode)
        .is('completed_by_vaccination_id', null)
        .neq('id', inserted.id)
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
    if (userError || !user) return { success: false, error: 'Não autenticado' }

    const { error } = await supabase
      .from('patient_vaccinations')
      .delete()
      .eq('id', vaccinationId)
      .eq('profile_id', user.id)

    if (error) throw error

    revalidatePath(`/pacientes/${patientId}`)
    revalidatePath('/agenda')
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    console.error('Delete vaccination error:', err)
    return { success: false, error: 'Erro ao remover registro vacinal.' }
  }
}
