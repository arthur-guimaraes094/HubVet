'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/infrastructure/database/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('Supabase login error:', error.status, error.code)
    const isInvalidCreds =
      error.status === 400 ||
      error.message?.toLowerCase().includes('invalid login credentials')
    const msg = isInvalidCreds
      ? 'E-mail ou senha incorretos'
      : 'Erro de conexão com o servidor de autenticação. Tente novamente.'
    return redirect(`/login?message=${encodeURIComponent(msg)}`)
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
