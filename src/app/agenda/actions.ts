'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResponse } from '@/core/types/actions'

const uuidSchema = z.string().uuid('ID inválido')

const agendaSchema = z.object({
  patientId: z.string().min(1, 'Paciente é obrigatório'),
  date: z.string().min(1, 'Data é obrigatória'),
  type: z.enum(['Home', 'Hospital']),
  address: z.string().optional(),
  travelDistanceKm: z.number().optional().nullable(),
  travelFee: z.number().optional().nullable(),
})

export async function agendarConsulta(rawData: unknown): Promise<ActionResponse> {
  const result = agendaSchema.safeParse(rawData)
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

  let { error } = await supabase.from('consultations').insert({
    profile_id: userData.user.id,
    patient_id: data.patientId,
    date: data.date,
    type: data.type,
    address: data.address,
    travel_distance_km: data.travelDistanceKm ?? null,
    travel_fee: data.travelFee ?? 0,
    status: 'Scheduled',
  })

  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    const fallback = await supabase.from('consultations').insert({
      profile_id: userData.user.id,
      patient_id: data.patientId,
      date: data.date,
      type: data.type,
      address: data.address,
      status: 'Scheduled',
    })
    error = fallback.error
  }

  if (error) {
    console.error('Erro ao agendar:', error)
    return { success: false, error: 'Erro ao agendar consulta' }
  }

  revalidatePath('/agenda')
  return { success: true }
}

export async function cancelarConsulta(id: string): Promise<ActionResponse> {
  if (!uuidSchema.safeParse(id).success) {
    return { success: false, error: 'ID de consulta inválido' }
  }

  const supabase = await createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return { success: false, error: 'Não autenticado' }

  const { error } = await supabase
    .from('consultations')
    .update({ status: 'Canceled' })
    .eq('id', id)
    .eq('profile_id', userData.user.id)

  if (error) return { success: false, error: 'Erro ao cancelar' }

  revalidatePath('/agenda')
  return { success: true }
}

export async function atualizarConsulta(id: string, rawData: unknown): Promise<ActionResponse> {
  if (!uuidSchema.safeParse(id).success) {
    return { success: false, error: 'ID de consulta inválido' }
  }

  const result = agendaSchema.safeParse(rawData)
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

  let { error } = await supabase
    .from('consultations')
    .update({
      patient_id: data.patientId,
      date: data.date,
      type: data.type,
      address: data.address,
      travel_distance_km: data.travelDistanceKm ?? null,
      travel_fee: data.travelFee ?? undefined,
    })
    .eq('id', id)
    .eq('profile_id', userData.user.id)

  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    const fallback = await supabase
      .from('consultations')
      .update({
        patient_id: data.patientId,
        date: data.date,
        type: data.type,
        address: data.address,
      })
      .eq('id', id)
      .eq('profile_id', userData.user.id)
    error = fallback.error
  }

  if (error) return { success: false, error: 'Erro ao atualizar' }

  revalidatePath('/agenda')
  return { success: true }
}

export async function getConsultationDetails(id: string) {
  if (!uuidSchema.safeParse(id).success) {
    throw new Error('ID de consulta inválido')
  }

  const supabase = await createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('Não autenticado')

  const { data: consultation, error } = await supabase
    .from('consultations')
    .select(
      `
      *,
      profiles (
        full_name,
        crmv
      ),
      patients (
        id,
        name,
        species,
        breed,
        color,
        birth_date,
        fertility_status,
        fertility_notes,
        clinical_observations,
        tutors (
          name
        )
      ),
      consultation_items (
        quantity,
        inventory:inventory_id (
          name,
          type
        )
      )
    `
    )
    .eq('id', id)
    .eq('profile_id', userData.user.id)
    .single()

  if (error) throw new Error('Erro ao buscar detalhes da consulta')

  return consultation
}
