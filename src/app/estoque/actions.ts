'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResponse } from '@/core/types/actions'

const uuidSchema = z.uuid('ID inválido')

const inventoryItemSchema = z.object({
  name: z.string().trim().min(1, 'Nome do item é obrigatório').max(150, 'Nome muito longo'),
  type: z.string().trim().min(1, 'Tipo do item é obrigatório').max(60),
  concentration: z.string().trim().max(100).optional(),
  unitCost: z
    .number()
    .finite('Custo unitário inválido')
    .min(0, 'Custo unitário não pode ser negativo')
    .max(100000, 'Custo unitário muito alto'),
  salePrice: z
    .number()
    .finite('Preço de venda inválido')
    .min(0, 'Preço de venda não pode ser negativo')
    .max(100000, 'Preço de venda muito alto'),
})

export async function addInventoryItem(rawData: unknown): Promise<ActionResponse> {
  try {
    const result = inventoryItemSchema.safeParse(rawData)
    if (!result.success) {
      return {
        success: false,
        error: 'Dados inválidos',
        fieldErrors: result.error.flatten().fieldErrors,
      }
    }
    const data = result.data

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return { success: false, error: 'Não autenticado' }
    }

    const { error } = await supabase.from('inventory').insert({
      profile_id: userData.user.id,
      name: data.name,
      type: data.type,
      concentration: data.concentration || null,
      unit_cost: data.unitCost,
      sale_price: data.salePrice,
      quantity_in_stock: 0,
    })

    if (error) {
      console.error('Add inventory item error:', error)
      return { success: false, error: 'Erro ao salvar item no banco.' }
    }

    revalidatePath('/estoque')
    revalidatePath('/prontuario')
    return { success: true }
  } catch (err) {
    console.error('Unexpected addInventoryItem error:', err)
    return { success: false, error: 'Erro interno do servidor.' }
  }
}

export async function updateInventoryItem(
  id: string,
  rawData: unknown
): Promise<ActionResponse> {
  try {
    if (!uuidSchema.safeParse(id).success) {
      return { success: false, error: 'ID de item inválido.' }
    }

    const result = inventoryItemSchema.safeParse(rawData)
    if (!result.success) {
      return {
        success: false,
        error: 'Dados inválidos',
        fieldErrors: result.error.flatten().fieldErrors,
      }
    }
    const data = result.data

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return { success: false, error: 'Não autenticado' }
    }

    const { data: updatedRow, error } = await supabase
      .from('inventory')
      .update({
        name: data.name,
        type: data.type,
        concentration: data.concentration || null,
        unit_cost: data.unitCost,
        sale_price: data.salePrice,
      })
      .eq('id', id)
      .eq('profile_id', userData.user.id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Update inventory item error:', error)
      return { success: false, error: 'Erro ao atualizar item.' }
    }

    if (!updatedRow) {
      return { success: false, error: 'Item não encontrado.' }
    }

    revalidatePath('/estoque')
    revalidatePath('/prontuario')
    return { success: true }
  } catch (err) {
    console.error('Unexpected updateInventoryItem error:', err)
    return { success: false, error: 'Erro interno do servidor.' }
  }
}

export async function deleteInventoryItem(id: string): Promise<ActionResponse> {
  try {
    if (!uuidSchema.safeParse(id).success) {
      return { success: false, error: 'ID de item inválido.' }
    }

    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return { success: false, error: 'Não autenticado' }
    }

    const { data: deletedRow, error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id)
      .eq('profile_id', userData.user.id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Delete inventory item error:', error)
      if (error.code === '23503') {
        return {
          success: false,
          error: 'Este item está vinculado a atendimentos e não pode ser excluído.',
        }
      }
      return { success: false, error: 'Erro ao excluir item.' }
    }

    if (!deletedRow) {
      return { success: false, error: 'Item não encontrado.' }
    }

    revalidatePath('/estoque')
    revalidatePath('/prontuario')
    return { success: true }
  } catch (err) {
    console.error('Unexpected deleteInventoryItem error:', err)
    return { success: false, error: 'Erro interno do servidor.' }
  }
}
