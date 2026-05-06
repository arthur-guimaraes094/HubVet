'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'

export async function salvarProntuario(data: {
  patientId: string;
  notes: string;
  baseFee: number;
  items: { id: string; name: string; quantity: number; unitCost: number; price: number }[];
}) {
  const supabase = await createClient()

  // Pegar usuário autenticado
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('Não autenticado')

  const profileId = userData.user.id

  // 1. Inserir a consulta
  const { data: consultation, error: consultError } = await supabase
    .from('consultations')
    .insert({
      profile_id: profileId,
      patient_id: data.patientId,
      date: new Date().toISOString(),
      type: 'Home',
      clinical_notes: data.notes,
      base_fee: data.baseFee
    })
    .select('id')
    .single()

  if (consultError || !consultation) {
    throw new Error('Erro ao salvar consulta')
  }

  const consultationId = consultation.id

  // 2. Inserir os itens
  let totalCost = 0
  for (const item of data.items) {
    if (item.quantity > 0) {
      await supabase.from('consultation_items').insert({
        consultation_id: consultationId,
        inventory_id: item.id,
        quantity: item.quantity,
        applied_cost: item.unitCost,
        is_prescribed: false
      })

      totalCost += (item.quantity * item.unitCost)
    }
  }

  // 3. Salvar transações financeiras (Entrada do serviço e Saída do custo)
  await supabase.from('transactions').insert({
    profile_id: profileId,
    consultation_id: consultationId,
    type: 'Income',
    category: 'Service',
    amount: data.baseFee,
    date: new Date().toISOString()
  })

  if (totalCost > 0) {
    await supabase.from('transactions').insert({
      profile_id: profileId,
      consultation_id: consultationId,
      type: 'Expense',
      category: 'Supplies',
      amount: totalCost,
      date: new Date().toISOString()
    })
  }

  revalidatePath('/prontuario')
  return { success: true, consultationId }
}
