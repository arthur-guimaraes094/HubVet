'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'

export async function addPatientAndTutor(data: {
  tutorName: string;
  tutorPhone: string;
  patientName: string;
  patientSpecies: string;
  patientWeight: number;
  patientBreed?: string;
  patientColor?: string;
}) {
  const supabase = await createClient()

  // Pegar usuário autenticado
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('Não autenticado')

  const profileId = userData.user.id

  // 1. Inserir Tutor
  const { data: newTutor, error: tutorError } = await supabase
    .from('tutors')
    .insert({
      profile_id: profileId,
      name: data.tutorName,
      phone: data.tutorPhone
    })
    .select('id')
    .single()

  if (tutorError) {
    throw new Error('Erro ao cadastrar o tutor.')
  }

  // 2. Inserir Paciente
  const { error: patientError } = await supabase
    .from('patients')
    .insert({
      tutor_id: newTutor.id,
      name: data.patientName,
      species: data.patientSpecies,
      weight_kg: data.patientWeight,
      breed: data.patientBreed,
      color: data.patientColor
    })

  if (patientError) {
    throw new Error('Erro ao cadastrar o paciente.')
  }

  revalidatePath('/pacientes')
  return { success: true }
}
