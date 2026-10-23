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

    let { error: patientError } = await supabase.from('patients').insert(fullPatientPayload)

    // Fallback caso a migration das novas colunas em patients ainda não tenha sido executada
    if (patientError && (patientError.code === '42703' || patientError.code === 'PGRST204')) {
      const fallbackPatient = await supabase.from('patients').insert({
        tutor_id: tutorId,
        name: data.patientName,
        species: data.patientSpecies,
        weight_kg: data.patientWeight,
        breed: data.patientBreed || null,
        color: data.patientColor || null,
        birth_date: data.patientBirthDate || null,
      })
      patientError = fallbackPatient.error
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

export async function deletePatient(patientId: string): Promise<ActionResponse> {
  try {
    const supabase = await createClient()

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

    if (tutorId) {
      const { count } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('tutor_id', tutorId)

      if (count === 0) {
        await supabase.from('tutors').delete().eq('id', tutorId)
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
    const supabase = await createClient()

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

    const { error: tutorError } = await supabase.from('tutors').delete().eq('id', tutorId)
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
    const supabase = await createClient()

    const formattedAddress =
      data.address?.trim() ||
      formatFullAddress({
        cep: data.cep,
        street: data.street,
        number: data.number,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
      }) ||
      null

    let { error } = await supabase
      .from('tutors')
      .update({
        name: data.name,
        phone: data.phone?.trim() || null,
        cpf: data.cpf?.trim() || null,
        address: formattedAddress,
        cep: data.cep?.trim() || null,
        street: data.street?.trim() || null,
        number: data.number?.trim() || null,
        complement: data.complement?.trim() || null,
        neighborhood: data.neighborhood?.trim() || null,
        city: data.city?.trim() || null,
        state: data.state?.trim() || null,
      })
      .eq('id', tutorId)

    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      const fallback = await supabase
        .from('tutors')
        .update({
          name: data.name,
          phone: data.phone?.trim() || null,
          cpf: data.cpf?.trim() || null,
          address: formattedAddress,
        })
        .eq('id', tutorId)
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
    const supabase = await createClient()
    let { error } = await supabase
      .from('patients')
      .update({
        name: data.name,
        species: data.species,
        weight_kg: data.weight_kg,
        breed: data.breed || null,
        color: data.color || null,
        photo_url: data.photo_url !== undefined ? data.photo_url : undefined,
        birth_date: data.birth_date !== undefined ? data.birth_date : undefined,
        is_birth_date_estimated: data.is_birth_date_estimated,
        fertility_status:
          data.fertility_status !== undefined ? data.fertility_status : undefined,
        fertility_notes:
          data.fertility_notes !== undefined ? data.fertility_notes : undefined,
        clinical_observations:
          data.clinical_observations !== undefined ? data.clinical_observations : undefined,
      })
      .eq('id', patientId)

    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      const fallback = await supabase
        .from('patients')
        .update({
          name: data.name,
          species: data.species,
          weight_kg: data.weight_kg,
          breed: data.breed || null,
          color: data.color || null,
          birth_date: data.birth_date !== undefined ? data.birth_date : undefined,
        })
        .eq('id', patientId)
      error = fallback.error
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
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Não autenticado' }

    const schedule = calculateVaccineSchedule({
      protocolCode: input.protocolCode,
      customVaccineName: input.customVaccineName,
      doseStage: input.doseStage,
      appliedDate: input.appliedDate,
      customIntervalDays: input.customIntervalDays,
    })

    const { data: inserted, error: insertError } = await supabase
      .from('patient_vaccinations')
      .insert({
        profile_id: user.id,
        patient_id: input.patientId,
        consultation_id: input.consultationId || null,
        protocol_code: schedule.protocolCode,
        vaccine_name: schedule.vaccineName,
        dose_number: schedule.doseNumber,
        total_initial_doses: schedule.totalInitialDoses,
        is_annual_booster: schedule.isAnnualBooster,
        applied_date: schedule.appliedDate,
        next_due_date: schedule.nextDueDate,
        next_dose_label: schedule.nextDoseLabel,
        batch_number: input.batchNumber?.trim() || null,
        notes: input.notes?.trim() || null,
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
        .eq('patient_id', input.patientId)
        .eq('protocol_code', schedule.protocolCode)
        .is('completed_by_vaccination_id', null)
        .neq('id', inserted.id)
    }

    revalidatePath(`/pacientes/${input.patientId}`)
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
    const supabase = await createClient()
    const { error } = await supabase
      .from('patient_vaccinations')
      .delete()
      .eq('id', vaccinationId)

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
