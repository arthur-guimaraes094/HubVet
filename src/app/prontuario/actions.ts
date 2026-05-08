'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'

export async function salvarProntuario(data: {
  patientId: string;
  notes: string;
  baseFee: number;
  items: { id: string; name: string; quantity: number; unitCost: number; price: number }[];
  consultationId?: string;
  weightKg?: number;
  completionDate?: string;
  images?: string[];
  type: 'Home' | 'Hospital';
}) {
  const supabase = await createClient()

  // Pegar usuário autenticado
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('Não autenticado')

  const profileId = userData.user.id
  let consultationId = data.consultationId;

  if (consultationId) {
    // 1a. Atualizar consulta existente (vinda da agenda)
    const { error: updateError } = await supabase
      .from('consultations')
      .update({
        clinical_notes: data.notes,
        base_fee: data.baseFee,
        weight_kg: data.weightKg,
        status: 'Completed',
        date: data.completionDate || new Date().toISOString(),
        images: data.images || []
      })
      .eq('id', consultationId);

    if (updateError) throw new Error('Erro ao atualizar consulta agendada');
  } else {
    // 1b. Inserir nova consulta
    const { data: consultation, error: consultError } = await supabase
      .from('consultations')
      .insert({
        profile_id: profileId,
        patient_id: data.patientId,
        status: 'Completed',
        date: data.completionDate || new Date().toISOString(),
        clinical_notes: data.notes,
        base_fee: data.baseFee,
        weight_kg: data.weightKg,
        images: data.images || [],
        type: data.type
      })
      .select('id')
      .single();

    if (consultError || !consultation) {
      throw new Error('Erro ao salvar consulta');
    }
    consultationId = consultation.id;
  }

  // Também atualizar o peso no registro fixo do paciente (opcional, mas bom ter o peso atual lá)
  if (data.weightKg) {
    await supabase.from('patients').update({ weight_kg: data.weightKg }).eq('id', data.patientId);
  }

  // 2. Inserir os itens em batch (ao invés de um por um)
  const itemsToInsert = data.items
    .filter(item => item.quantity > 0)
    .map(item => ({
      consultation_id: consultationId,
      inventory_id: item.id,
      quantity: item.quantity,
      applied_cost: item.unitCost,
      is_prescribed: false
    }))

  if (itemsToInsert.length > 0) {
    await supabase.from('consultation_items').insert(itemsToInsert)
    
    // 2.1 Removido decremento de estoque (sistema alterado para catálogo)
  }

  const totalCost = data.items.reduce(
    (acc, item) => acc + (item.quantity > 0 ? item.quantity * item.unitCost : 0),
    0
  );

  // 3. Salvar transações financeiras em paralelo
  const transactionPromises = [
    supabase.from('transactions').insert({
      profile_id: profileId,
      consultation_id: consultationId,
      type: 'Income',
      category: 'Service',
      amount: data.baseFee,
      date: new Date().toISOString()
    })
  ]

  if (totalCost > 0) {
    transactionPromises.push(
      supabase.from('transactions').insert({
        profile_id: profileId,
        consultation_id: consultationId,
        type: 'Expense',
        category: 'Supplies',
        amount: totalCost,
        date: new Date().toISOString()
      })
    )
  }

  await Promise.all(transactionPromises)

  revalidatePath('/prontuario')
  revalidatePath('/agenda')
  if (data.patientId) revalidatePath(`/pacientes/${data.patientId}`)
  return { success: true, consultationId }
}

