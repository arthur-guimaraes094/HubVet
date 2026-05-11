'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResponse } from '@/core/types/actions'

const inventoryItemSchema = z.object({
  name: z.string().min(1, 'Nome do item é obrigatório'),
  type: z.string().min(1, 'Tipo do item é obrigatório'),
  concentration: z.string().optional(),
  unitCost: z.number().min(0, 'Custo unitário não pode ser negativo'),
  salePrice: z.number().min(0, 'Preço de venda não pode ser negativo')
})

export async function addInventoryItem(rawData: unknown): Promise<ActionResponse> {
  const result = inventoryItemSchema.safeParse(rawData)
  if (!result.success) {
    return { success: false, error: 'Dados inválidos', fieldErrors: result.error.flatten().fieldErrors }
  }
  const data = result.data

  const supabase = await createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return { success: false, error: 'Não autenticado' }

  const profileId = userData.user.id

  const { error } = await supabase.from('inventory').insert({
    profile_id: profileId,
    name: data.name,
    type: data.type,
    concentration: data.concentration,
    unit_cost: data.unitCost,
    sale_price: data.salePrice,
    quantity_in_stock: 0
  })

  if (error) {
    return { success: false, error: 'Erro ao salvar item no banco.' }
  }

  revalidatePath('/estoque')
  revalidatePath('/prontuario')
  return { success: true }
}

export async function updateInventoryItem(id: string, rawData: unknown): Promise<ActionResponse> {
  const result = inventoryItemSchema.safeParse(rawData)
  if (!result.success) {
    return { success: false, error: 'Dados inválidos', fieldErrors: result.error.flatten().fieldErrors }
  }
  const data = result.data

  const supabase = await createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return { success: false, error: 'Não autenticado' }

  const { error } = await supabase.from('inventory').update({
    name: data.name,
    type: data.type,
    concentration: data.concentration,
    unit_cost: data.unitCost,
    sale_price: data.salePrice,
  }).eq('id', id)

  if (error) {
    return { success: false, error: 'Erro ao atualizar item.' }
  }

  revalidatePath('/estoque')
  revalidatePath('/prontuario')
  return { success: true }
}

export async function deleteInventoryItem(id: string): Promise<ActionResponse> {
  const supabase = await createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return { success: false, error: 'Não autenticado' }

  const { error } = await supabase.from('inventory').delete().eq('id', id)

  if (error) {
    return { success: false, error: 'Erro ao excluir item.' }
  }

  revalidatePath('/estoque')
  revalidatePath('/prontuario')
  return { success: true }
}
