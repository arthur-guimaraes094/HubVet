'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResponse } from '@/core/types/actions'

const profileSchema = z.object({
  fullName: z.string().min(1, 'Nome é obrigatório'),
  crmv: z.string().optional(),
  phone: z.string().optional(),
  baseCep: z.string().optional(),
  baseAddress: z.string().optional(),
  kmRate: z.number().optional(),
})

export async function updateProfile(
  formData: FormData
): Promise<ActionResponse<{ avatarUrl?: string }>> {
  const supabase = await createClient()

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    return { success: false, error: 'Usuário não autenticado' }
  }

  const fullName = (formData.get('fullName') as string) || ''
  const crmv = (formData.get('crmv') as string) || ''
  const phone = (formData.get('phone') as string) || ''
  const baseCep = (formData.get('baseCep') as string) || ''
  const baseAddress = (formData.get('baseAddress') as string) || ''
  const rawKmRate = (formData.get('kmRate') as string) || '2.5'
  const kmRate = parseFloat(rawKmRate.replace(',', '.')) || 2.5

  const result = profileSchema.safeParse({
    fullName,
    crmv,
    phone,
    baseCep,
    baseAddress,
    kmRate,
  })
  if (!result.success) {
    return {
      success: false,
      error: 'Dados inválidos',
      fieldErrors: result.error.flatten().fieldErrors,
    }
  }

  const avatarFile = formData.get('avatar') as File | null
  let avatarUrl = undefined

  if (avatarFile && avatarFile.size > 0) {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedMimeTypes.includes(avatarFile.type)) {
      return {
        success: false,
        error: 'Formato de imagem não suportado. Use JPG, PNG, WebP ou GIF.',
      }
    }

    if (avatarFile.size > 4 * 1024 * 1024) {
      return { success: false, error: 'A imagem deve ter no máximo 4MB.' }
    }

    const fileExt = avatarFile.name.split('.').pop()
    const fileName = `${userData.user.id}-${Math.random()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, avatarFile)

    if (uploadError) {
      return { success: false, error: 'Erro ao fazer upload da imagem' }
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(fileName)

    avatarUrl = publicUrl
  }

  const fullPayload = {
    full_name: result.data.fullName,
    crmv: result.data.crmv || '',
    phone: result.data.phone || '',
    base_cep: result.data.baseCep || null,
    base_address: result.data.baseAddress || null,
    km_rate: result.data.kmRate ?? 2.5,
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  }

  let { error } = await supabase
    .from('profiles')
    .update(fullPayload)
    .eq('id', userData.user.id)

  // Fallback se as colunas de deslocamento ainda não estiverem criadas no banco
  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    const basePayload: { full_name: string; crmv: string; phone: string; avatar_url?: string } = {
      full_name: result.data.fullName,
      crmv: result.data.crmv || '',
      phone: result.data.phone || '',
    }
    if (avatarUrl) basePayload.avatar_url = avatarUrl

    const fallback = await supabase
      .from('profiles')
      .update(basePayload)
      .eq('id', userData.user.id)
    error = fallback.error
  }

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
