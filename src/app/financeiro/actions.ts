'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'
import type { ActionResponse } from '@/core/types/actions'
import { z } from 'zod'
import { assertInvoiceOwnership } from '@/infrastructure/auth/session'

const updateInvoiceStatusSchema = z.object({
  invoiceId: z.uuid('ID de fatura inválido.'),
  status: z.enum(['pending', 'paid', 'cancelled']),
})

export async function updateInvoiceStatus(
  invoiceId: string,
  status: 'pending' | 'paid' | 'cancelled'
): Promise<ActionResponse> {
  try {
    const validation = updateInvoiceStatusSchema.safeParse({ invoiceId, status })
    if (!validation.success) {
      return { success: false, error: 'Dados de entrada inválidos.' }
    }

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return { success: false, error: 'Não autenticado' }
    }

    const ownsInvoice = await assertInvoiceOwnership(
      supabase,
      validation.data.invoiceId,
      userData.user.id
    )
    if (!ownsInvoice) {
      return { success: false, error: 'Fatura não encontrada ou sem permissão.' }
    }

    const { data, error } = await supabase
      .from('invoices')
      .update({ status: validation.data.status })
      .eq('id', validation.data.invoiceId)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Update invoice status error:', error)
      return { success: false, error: 'Erro ao atualizar status da fatura.' }
    }

    if (!data) {
      return { success: false, error: 'Fatura não encontrada.' }
    }

    revalidatePath('/financeiro')
    return { success: true }
  } catch (err) {
    console.error('Unexpected updateInvoiceStatus error:', err)
    return { success: false, error: 'Erro interno do servidor.' }
  }
}
