'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'

export async function agendarConsulta(data: {
  patientId: string;
  date: string; // ISO string com data e hora
  type: 'Home' | 'Hospital';
  address?: string;
}) {
  const supabase = await createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('Não autenticado')

  const { error } = await supabase
    .from('consultations')
    .insert({
      profile_id: userData.user.id,
      patient_id: data.patientId,
      date: data.date,
      type: data.type,
      address: data.address,
      status: 'Scheduled'
    })

  if (error) {
    console.error('Erro ao agendar:', error)
    throw new Error('Erro ao agendar consulta')
  }

  revalidatePath('/agenda')
  return { success: true }
}

export async function cancelarConsulta(id: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('consultations')
    .update({ status: 'Canceled' })
    .eq('id', id)

  if (error) throw new Error('Erro ao cancelar')
  
  revalidatePath('/agenda')
  return { success: true }
}

export async function atualizarConsulta(id: string, data: {
  patientId: string;
  date: string;
  type: 'Home' | 'Hospital';
  address?: string;
}) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('consultations')
    .update({
      patient_id: data.patientId,
      date: data.date,
      type: data.type,
      address: data.address
    })
    .eq('id', id)

  if (error) throw new Error('Erro ao atualizar')
  
  revalidatePath('/agenda')
  return { success: true }
}

export async function getConsultationDetails(id: string) {
  const supabase = await createClient()
  
  const { data: consultation, error } = await supabase
    .from('consultations')
    .select(`
      *,
      patients (
        id,
        name,
        species,
        breed,
        color,
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
    `)
    .eq('id', id)
    .single();

  if (error) throw new Error('Erro ao buscar detalhes da consulta');
  
  return consultation;
}
