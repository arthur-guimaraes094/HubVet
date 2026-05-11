'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'

import { z } from 'zod'
import type { ActionResponse } from '@/core/types/actions'

const prontuarioSchema = z.object({
  patientId: z.string().min(1, 'Paciente é obrigatório'),
  notes: z.string().optional().default(''),
  baseFee: z.number().min(0, 'Taxa base não pode ser negativa'),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number(),
    unitCost: z.number(),
    price: z.number()
  })).optional().default([]),
  consultationId: z.string().optional(),
  weightKg: z.number().optional(),
  completionDate: z.string().optional(),
  images: z.array(z.string()).optional(),
  type: z.enum(['Home', 'Hospital'])
})

export async function salvarProntuario(rawData: unknown): Promise<ActionResponse<{ consultationId: string }>> {
  try {
    const result = prontuarioSchema.safeParse(rawData)
    if (!result.success) {
      return { success: false, error: 'Dados inválidos', fieldErrors: result.error.flatten().fieldErrors }
    }
    const data = result.data

    const supabase = await createClient()

    // Pegar usuário autenticado
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return { success: false, error: 'Não autenticado' }

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

      if (updateError) return { success: false, error: 'Erro ao atualizar consulta agendada' };
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
        return { success: false, error: 'Erro ao salvar consulta' };
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
        consultation_id: consultationId!,
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

    // 4. Criar a Fatura (Invoice) para o Cliente
    if (data.baseFee > 0) {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          patient_id: data.patientId,
          total_amount: data.baseFee,
          status: 'pending',
        })
        .select('id')
        .single();

      if (invoiceError) {
        console.error('Invoice creation error:', invoiceError);
      }

      if (invoice && invoice.id) {
        const invoiceItemsToInsert = data.items
          .filter(item => item.quantity > 0)
          .map(item => ({
            invoice_id: invoice.id,
            description: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.price * item.quantity
          }));
        
        if (invoiceItemsToInsert.length > 0) {
          const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItemsToInsert);
          if (itemsError) {
             console.error('Invoice items error:', itemsError);
          }
        }
      }
    }

    revalidatePath('/prontuario')
    revalidatePath('/agenda')
    if (data.patientId) revalidatePath(`/pacientes/${data.patientId}`)
    return { success: true, data: { consultationId } }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno do servidor';
    console.error('CRITICAL SERVER ACTION ERROR:', err);
    return { success: false, error: errorMessage };
  }
}
