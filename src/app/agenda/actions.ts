'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'

export async function agendarConsulta(data: {
  patientId: string;
  date: string; // ISO string com data e hora
  type: 'Home' | 'Hospital';
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
