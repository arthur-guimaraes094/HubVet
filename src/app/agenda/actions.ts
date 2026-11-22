'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResponse } from '@/core/types/actions'
import { assertPatientOwnership } from '@/infrastructure/auth/session'

const uuidSchema = z.uuid('ID inválido')

const agendaSchema = z.object({
  patientId: z.uuid('Paciente inválido'),
  date: z
    .string()
    .trim()
    .min(1, 'Data é obrigatória')
    .max(64)
    .refine((val) => !Number.isNaN(Date.parse(val)), 'Data inválida'),
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

export async function agendarConsulta(rawData: unknown): Promise<ActionResponse> {
  try {
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
    if (userError || !userData.user) {
      return { success: false, error: 'Não autenticado' }
    }

    const ownership = await assertPatientOwnership(supabase, data.patientId, userData.user.id)
    if (!ownership.owned) {
      return { success: false, error: 'Paciente não encontrado ou sem permissão.' }
    }

    const { data: insertedRow, error } = await supabase
      .from('consultations')
      .insert({
        profile_id: userData.user.id,
        patient_id: data.patientId,
        date: data.date,
        type: data.type,
        address: data.address || null,
        travel_distance_km: data.type === 'Home' ? (data.travelDistanceKm ?? null) : null,
        travel_fee: data.type === 'Home' ? (data.travelFee ?? 0) : 0,
        status: 'Scheduled',
      })
      .select('id')
      .maybeSingle()

    if (error || !insertedRow) {
      console.error('Erro ao agendar:', error)
      return { success: false, error: 'Erro ao agendar consulta' }
    }

    revalidatePath('/agenda')
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    console.error('Unexpected agendarConsulta error:', err)
    return { success: false, error: 'Erro interno do servidor.' }
  }
}

export async function cancelarConsulta(id: string): Promise<ActionResponse> {
  try {
    if (!uuidSchema.safeParse(id).success) {
      return { success: false, error: 'ID de consulta inválido' }
    }

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return { success: false, error: 'Não autenticado' }
    }

    const { data: updatedRow, error } = await supabase
      .from('consultations')
      .update({ status: 'Canceled' })
      .eq('id', id)
      .eq('profile_id', userData.user.id)
      .neq('status', 'Completed')
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Erro ao cancelar consulta:', error)
      return { success: false, error: 'Erro ao cancelar' }
    }

    if (!updatedRow) {
      const { data: existing } = await supabase
        .from('consultations')
        .select('status')
        .eq('id', id)
        .eq('profile_id', userData.user.id)
        .maybeSingle()

      if (existing?.status === 'Completed') {
        return {
          success: false,
          error: 'Consultas já finalizadas não podem ser canceladas.',
        }
      }
      return { success: false, error: 'Consulta não encontrada.' }
    }

    revalidatePath('/agenda')
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    console.error('Unexpected cancelarConsulta error:', err)
    return { success: false, error: 'Erro interno do servidor.' }
  }
}

export async function atualizarConsulta(id: string, rawData: unknown): Promise<ActionResponse> {
  try {
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
    if (userError || !userData.user) {
      return { success: false, error: 'Não autenticado' }
    }

    const ownership = await assertPatientOwnership(supabase, data.patientId, userData.user.id)
    if (!ownership.owned) {
      return { success: false, error: 'Paciente não encontrado ou sem permissão.' }
    }

    const { data: updatedRow, error } = await supabase
      .from('consultations')
      .update({
        patient_id: data.patientId,
        date: data.date,
        type: data.type,
        address: data.address || null,
        travel_distance_km: data.type === 'Home' ? (data.travelDistanceKm ?? null) : null,
        travel_fee: data.type === 'Home' ? (data.travelFee ?? undefined) : 0,
      })
      .eq('id', id)
      .eq('profile_id', userData.user.id)
      .neq('status', 'Completed')
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Erro ao atualizar consulta:', error)
      return { success: false, error: 'Erro ao atualizar' }
    }

    if (!updatedRow) {
      const { data: existing } = await supabase
        .from('consultations')
        .select('status')
        .eq('id', id)
        .eq('profile_id', userData.user.id)
        .maybeSingle()

      if (existing?.status === 'Completed') {
        return {
          success: false,
          error: 'Consultas já finalizadas não podem ser alteradas pela agenda.',
        }
      }
      return { success: false, error: 'Consulta não encontrada.' }
    }

    revalidatePath('/agenda')
    revalidatePath('/')
    return { success: true }
  } catch (err) {
    console.error('Unexpected atualizarConsulta error:', err)
    return { success: false, error: 'Erro interno do servidor.' }
  }
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
