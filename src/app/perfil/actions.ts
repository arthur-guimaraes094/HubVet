'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'

import { z } from 'zod'
import type { ActionResponse } from '@/core/types/actions'

const profileSchema = z.object({
  fullName: z.string().min(1, 'Nome é obrigatório'),
  crmv: z.string().optional(),
  phone: z.string().optional()
})

export async function updateProfile(formData: FormData): Promise<ActionResponse<{ avatarUrl?: string }>> {
  const supabase = await createClient()

  // 1. Pegar o usuário autenticado
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return { success: false, error: 'Usuário não autenticado' }
  }

  const fullName = formData.get('fullName') as string || ''
  const crmv = formData.get('crmv') as string || ''
  const phone = formData.get('phone') as string || ''
  
  const result = profileSchema.safeParse({ fullName, crmv, phone })
  if (!result.success) {
    return { success: false, error: 'Dados inválidos', fieldErrors: result.error.flatten().fieldErrors }
  }

  const avatarFile = formData.get('avatar') as File | null

  let avatarUrl = undefined

  if (avatarFile && avatarFile.size > 0) {
    // Validar tipo MIME do arquivo (apenas imagens reais)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedMimeTypes.includes(avatarFile.type)) {
      return { success: false, error: 'Formato de imagem não suportado. Use JPG, PNG, WebP ou GIF.' }
    }

    // Validar tamanho máximo (4MB)
    if (avatarFile.size > 4 * 1024 * 1024) {
      return { success: false, error: 'A imagem deve ter no máximo 4MB.' }
    }

    const fileExt = avatarFile.name.split('.').pop()
    const fileName = `${userData.user.id}-${Math.random()}.${fileExt}`
    
    // Fazer upload para o Storage
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, avatarFile)
      
    if (uploadError) {
      return { success: false, error: 'Erro ao fazer upload da imagem' }
    }

    // Pegar URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName)
      
    avatarUrl = publicUrl
  }

  const updatePayload: { full_name: string; crmv: string; phone: string; avatar_url?: string } = {
    full_name: result.data.fullName,
    crmv: result.data.crmv || '',
    phone: result.data.phone || '',
  }

  if (avatarUrl) {
    updatePayload.avatar_url = avatarUrl
  }

  // 2. Atualizar a tabela profiles garantindo que o RLS protegerá a query
  const { error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userData.user.id) // Segurança extra além do RLS

  if (error) {
    return { success: false, error: 'Erro ao atualizar o perfil. Tente novamente.' }
  }

  revalidatePath('/perfil')
  revalidatePath('/')
  return { success: true, data: { avatarUrl } }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
