'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'

export async function addInventoryItem(data: {
  name: string;
  type: string;
  concentration?: string;
  unitCost: number;
  salePrice: number;
}) {
  const supabase = await createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) throw new Error('Não autenticado')

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
    throw new Error('Erro ao salvar item no banco.')
  }

  revalidatePath('/estoque')
  revalidatePath('/prontuario')
  return { success: true }
}

export async function updateInventoryItem(id: string, data: {
  name: string;
  type: string;
  concentration?: string;
  unitCost: number;
  salePrice: number;
}) {
  const supabase = await createClient()

  const { error } = await supabase.from('inventory').update({
    name: data.name,
    type: data.type,
    concentration: data.concentration,
    unit_cost: data.unitCost,
    sale_price: data.salePrice,
  }).eq('id', id)

  if (error) {
    throw new Error('Erro ao atualizar item.')
  }

  revalidatePath('/estoque')
  revalidatePath('/prontuario')
  return { success: true }
}

export async function deleteInventoryItem(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('inventory').delete().eq('id', id)

  if (error) {
    throw new Error('Erro ao excluir item.')
  }

  revalidatePath('/estoque')
  revalidatePath('/prontuario')
  return { success: true }
}
