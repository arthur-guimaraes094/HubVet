'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResponse } from '@/core/types/actions'
import { validateImageUpload } from '@/core/utils/upload-validation'

const profileSchema = z.object({
  fullName: z.string().min(1, 'Nome é obrigatório'),
  crmv: z.string().optional(),
  phone: z.string().optional(),
  baseCep: z.string().optional(),
  baseAddress: z.string().optional(),
  kmRate: z
    .number()
    .finite()
    .min(0, 'Valor por km inválido')
    .max(50, 'Valor por km muito alto')
    .optional(),
  pixKey: z.string().optional(),
  pixKeyType: z.string().optional(),
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
  const pixKey = (formData.get('pixKey') as string) || ''
  const pixKeyType = (formData.get('pixKeyType') as string) || 'CPF'

  const result = profileSchema.safeParse({
    fullName,
    crmv,
    phone,
    baseCep,
    baseAddress,
    kmRate,
    pixKey,
    pixKeyType,
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
    const validation = await validateImageUpload(avatarFile, 4 * 1024 * 1024)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      }
    }

    const fileName = `${userData.user.id}-${crypto.randomUUID()}.${validation.extension}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, avatarFile, { contentType: validation.contentType })

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
    base_lat: null,
    base_lng: null,
    km_rate: result.data.kmRate ?? 2.5,
    pix_key: result.data.pixKey || null,
    pix_key_type: result.data.pixKeyType || 'CPF',
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
