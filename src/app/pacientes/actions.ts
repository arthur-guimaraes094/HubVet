'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'

import { z } from 'zod'
import type { ActionResponse } from '@/core/types/actions'

const patientSchema = z.object({
  tutorId: z.string().optional(),
  tutorName: z.string().optional(),
  tutorPhone: z.string().optional(),
  tutorCpf: z.string().optional(),
  patientName: z.string().min(1, 'Nome do paciente é obrigatório'),
  patientSpecies: z.string().min(1, 'Espécie é obrigatória'),
  patientWeight: z.number().min(0, 'Peso não pode ser negativo'),
  patientBreed: z.string().optional(),
  patientColor: z.string().optional()
})

export async function addPatientAndTutor(rawData: unknown): Promise<ActionResponse> {
  try {
    const result = patientSchema.safeParse(rawData)
    if (!result.success) {
      return { success: false, error: 'Dados inválidos', fieldErrors: result.error.flatten().fieldErrors }
    }
    const data = result.data

    const supabase = await createClient()

    // Pegar usuário autenticado
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return { success: false, error: 'Não autenticado' }

    const profileId = userData.user.id
    let tutorId: string | undefined = data.tutorId

    // 1. Lidar com Tutor (Existente ou Novo)
    if (!tutorId) {
      if (!data.tutorName) return { success: false, error: 'Nome do tutor é obrigatório para novo cadastro' }
      
      const { data: newTutor, error: tutorError } = await supabase
        .from('tutors')
        .insert({
          profile_id: profileId,
          name: data.tutorName,
          phone: data.tutorPhone?.trim() || null,
          cpf: data.tutorCpf?.trim() || null
        })
        .select('id')
        .single()

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
        console.error('Tutor creation error:', tutorError);
        return { success: false, error: 'Erro ao cadastrar o tutor.' }
      }
      tutorId = (newTutor as { id: string }).id
    }

    // 2. Inserir Paciente
    const { error: patientError } = await supabase
      .from('patients')
      .insert({
        tutor_id: tutorId,
        name: data.patientName,
        species: data.patientSpecies,
        weight_kg: data.patientWeight,
        breed: data.patientBreed,
        color: data.patientColor
      })

    if (patientError) {
      console.error('Patient creation error:', patientError);
      return { success: false, error: 'Erro ao cadastrar o paciente.' }
    }

    revalidatePath('/pacientes')
    return { success: true }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno do servidor';
    console.error('CRITICAL PATIENT ACTION ERROR:', err);
    return { success: false, error: errorMessage };
  }
}

export async function deletePatient(patientId: string): Promise<ActionResponse> {
  try {
    const supabase = await createClient()

    // 1. Deletar faturas e itens de faturas
    // O Supabase/Postgres pode estar com CASCADE, mas para garantir:
    const { data: invoices } = await supabase.from('invoices').select('id').eq('patient_id', patientId)
    if (invoices && invoices.length > 0) {
      const invoiceIds = invoices.map(i => i.id)
      await supabase.from('invoice_items').delete().in('invoice_id', invoiceIds)
      await supabase.from('invoices').delete().in('id', invoiceIds)
    }

    // 2. Deletar consultas, itens de consultas e transações vinculadas
    const { data: consultations } = await supabase.from('consultations').select('id').eq('patient_id', patientId)
    if (consultations && consultations.length > 0) {
      const consultationIds = consultations.map(c => c.id)
      // Deletar transações primeiro devido à chave estrangeira
      await supabase.from('transactions').delete().in('consultation_id', consultationIds)
      await supabase.from('consultation_items').delete().in('consultation_id', consultationIds)
      await supabase.from('consultations').delete().in('id', consultationIds)
    }

    // 3. Pegar tutor_id antes de deletar para verificar se é o último pet
    const { data: patientData } = await supabase
      .from('patients')
      .select('tutor_id')
      .eq('id', patientId)
      .single()
    
    const tutorId = patientData?.tutor_id

    // 4. Deletar o paciente
    const { error: patientError } = await supabase.from('patients').delete().eq('id', patientId)
    if (patientError) {
      console.error('Delete patient error:', patientError)
      return { success: false, error: 'Erro ao excluir o paciente.' }
    }

    // 5. Se deletou o paciente, verificar se o tutor ainda tem pets
    if (tutorId) {
      const { count } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('tutor_id', tutorId)

      if (count === 0) {
        // Deletar tutor órfão
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

    // 1. Pegar todos os pacientes do tutor
    const { data: patients } = await supabase
      .from('patients')
      .select('id')
      .eq('tutor_id', tutorId)
    
    if (patients && patients.length > 0) {
      const patientIds = patients.map(p => p.id)

      // 2. Limpar histórico de cada paciente
      // Faturas e itens
      const { data: invoices } = await supabase.from('invoices').select('id').in('patient_id', patientIds)
      if (invoices && invoices.length > 0) {
        const invoiceIds = invoices.map(i => i.id)
        await supabase.from('invoice_items').delete().in('invoice_id', invoiceIds)
        await supabase.from('invoices').delete().in('id', invoiceIds)
      }

      // Consultas, itens e transações
      const { data: consultations } = await supabase.from('consultations').select('id').in('patient_id', patientIds)
      if (consultations && consultations.length > 0) {
        const consultationIds = consultations.map(c => c.id)
        await supabase.from('transactions').delete().in('consultation_id', consultationIds)
        await supabase.from('consultation_items').delete().in('consultation_id', consultationIds)
        await supabase.from('consultations').delete().in('id', consultationIds)
      }

      // 3. Deletar os pacientes
      await supabase.from('patients').delete().in('id', patientIds)
    }

    // 4. Deletar o tutor
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

export async function updateTutor(tutorId: string, data: { name: string; phone?: string; cpf?: string }) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('tutors')
      .update({
        name: data.name,
        phone: data.phone,
        cpf: data.cpf
      })
      .eq('id', tutorId)

    if (error) {
      if (error.code === '23505') {
        if (error.message?.includes('cpf')) return { success: false, error: 'CPF já cadastrado para outro tutor.' }
        if (error.message?.includes('phone')) return { success: false, error: 'Telefone já cadastrado para outro tutor.' }
      }
      throw error
    }

    revalidatePath('/tutores')
    return { success: true }
  } catch (err) {
    console.error('Update tutor error:', err)
    return { success: false, error: 'Erro ao atualizar tutor.' }
  }
}

export async function updatePatient(patientId: string, data: { name: string; species: string; weight_kg: number; breed?: string; color?: string }) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('patients')
      .update({
        name: data.name,
        species: data.species,
        weight_kg: data.weight_kg,
        breed: data.breed,
        color: data.color
      })
      .eq('id', patientId)

    if (error) throw error

    revalidatePath('/pacientes')
    revalidatePath(`/pacientes/${patientId}`)
    return { success: true }
  } catch (err) {
    console.error('Update patient error:', err)
    return { success: false, error: 'Erro ao atualizar paciente.' }
  }
}
