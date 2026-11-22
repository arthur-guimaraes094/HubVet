'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResponse } from '@/core/types/actions'
import { prepareValidatedImageUpload } from '@/core/utils/upload-validation'
import { buildStorageRef, signStorageUrl } from '@/infrastructure/storage/media'

const MAX_AVATAR_BYTES = 4 * 1024 * 1024

const profileSchema = z.object({
  fullName: z.string().trim().min(1, 'Nome é obrigatório').max(150),
  crmv: z.string().trim().max(50).optional(),
  phone: z.string().trim().max(30).optional(),
  baseCep: z.string().trim().max(20).optional(),
  baseAddress: z.string().trim().max(500).optional(),
  kmRate: z
    .number()
    .finite('Valor por km inválido')
    .min(0, 'Valor por km inválido')
    .max(50, 'Valor por km muito alto')
    .optional(),
  pixKey: z.string().trim().max(150).optional(),
  pixKeyType: z.string().trim().max(30).optional(),
})

function readFormString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

export async function updateProfile(
  formData: FormData
): Promise<ActionResponse<{ avatarUrl?: string }>> {
  try {
    const supabase = await createClient()

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      return { success: false, error: 'Usuário não autenticado' }
    }

    const fullName = readFormString(formData, 'fullName')
    const crmv = readFormString(formData, 'crmv')
    const phone = readFormString(formData, 'phone')
    const baseCep = readFormString(formData, 'baseCep')
    const baseAddress = readFormString(formData, 'baseAddress')
    const rawKmRate = readFormString(formData, 'kmRate').trim()
    const kmRate = rawKmRate === '' ? 2.5 : Number(rawKmRate.replace(',', '.'))
    const pixKey = readFormString(formData, 'pixKey')
    const pixKeyType = readFormString(formData, 'pixKeyType') || 'CPF'

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

    const rawAvatar = formData.get('avatar')
    const avatarFile = rawAvatar instanceof File ? rawAvatar : null
    let avatarStorageRef: string | undefined
    let signedAvatarUrl: string | undefined

    if (avatarFile && avatarFile.size > 0) {
      const validation = await prepareValidatedImageUpload(avatarFile, MAX_AVATAR_BYTES)
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        }
      }

      const fileName = `${userData.user.id}-avatar-${crypto.randomUUID()}.${validation.extension}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, validation.bytes, {
          upsert: false,
          contentType: validation.contentType,
        })

      if (uploadError) {
        console.error('Upload avatar error:', uploadError)
        return { success: false, error: 'Erro ao fazer upload da imagem' }
      }

      avatarStorageRef = buildStorageRef('avatars', fileName)
      signedAvatarUrl = (await signStorageUrl(supabase, avatarStorageRef, 'avatars')) ?? undefined
    }

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('base_cep, base_address')
      .eq('id', userData.user.id)
      .maybeSingle()

    const nextCep = result.data.baseCep || null
    const nextAddress = result.data.baseAddress || null
    const prevCep = existingProfile?.base_cep || null
    const prevAddress = existingProfile?.base_address || null
    const baseLocationChanged = nextCep !== prevCep || nextAddress !== prevAddress

    const { data: updatedProfile, error } = await supabase
      .from('profiles')
      .update({
        full_name: result.data.fullName,
        crmv: result.data.crmv || '',
        phone: result.data.phone || '',
        base_cep: nextCep,
        base_address: nextAddress,
        ...(baseLocationChanged ? { base_lat: null, base_lng: null } : {}),
        km_rate: result.data.kmRate ?? 2.5,
        pix_key: result.data.pixKey || null,
        pix_key_type: result.data.pixKeyType || 'CPF',
        ...(avatarStorageRef ? { avatar_url: avatarStorageRef } : {}),
      })
      .eq('id', userData.user.id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Update profile error:', error)
      return { success: false, error: 'Erro ao atualizar o perfil. Tente novamente.' }
    }

    if (!updatedProfile) {
      return { success: false, error: 'Perfil não encontrado.' }
    }

    revalidatePath('/perfil')
    revalidatePath('/')
    return { success: true, data: { avatarUrl: signedAvatarUrl } }
  } catch (err) {
    console.error('Unexpected updateProfile error:', err)
    return { success: false, error: 'Erro interno do servidor.' }
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
}
