'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'

export async function addInventoryItem(data: {
  name: string;
  type: string;
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
