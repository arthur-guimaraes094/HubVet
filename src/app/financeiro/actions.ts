'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'
import type { ActionResponse } from '@/core/types/actions'
import { z } from 'zod'

const updateInvoiceStatusSchema = z.object({
  invoiceId: z.string().uuid(),
  status: z.enum(['pending', 'paid', 'cancelled']),
})

export async function updateInvoiceStatus(invoiceId: string, status: 'pending' | 'paid' | 'cancelled'): Promise<ActionResponse> {
  const validation = updateInvoiceStatusSchema.safeParse({ invoiceId, status })
  if (!validation.success) {
    return { success: false, error: 'Dados de entrada inválidos.' }
  }

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
