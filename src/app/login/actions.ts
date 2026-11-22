'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/infrastructure/database/server'

const loginSchema = z.object({
  email: z.string().trim().pipe(z.email().max(254)),
  password: z.string().min(1).max(256),
})

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    redirect('/login?error=invalid_input')
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    console.error('Supabase login error:', error.status, error.code)
    const isInvalidCreds =
      error.status === 400 ||
      error.code === 'invalid_credentials' ||
      error.message?.toLowerCase().includes('invalid login credentials')

    redirect(
      isInvalidCreds
        ? '/login?error=invalid_credentials'
        : '/login?error=auth_unavailable'
    )
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
