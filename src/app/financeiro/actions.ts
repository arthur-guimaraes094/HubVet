'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'
import type { ActionResponse } from '@/core/types/actions'

export async function updateInvoiceStatus(invoiceId: string, status: 'pending' | 'paid' | 'cancelled'): Promise<ActionResponse> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('invoices')
    .update({ status })
    .eq('id', invoiceId)

  if (error) {
    return { success: false, error: 'Erro ao atualizar status da fatura.' }
  }

  revalidatePath('/financeiro')
  return { success: true }
}
