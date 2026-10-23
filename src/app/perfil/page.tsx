import { createClient } from '@/infrastructure/database/server'
import { redirect } from 'next/navigation'
import { ProfileForm } from '@/components/features/ProfileForm'
import Link from 'next/link'
import { ViewTransition } from 'react'

export default async function PerfilPage() {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.user) {
    redirect('/login')
  }

  const user = session.user

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const p = profile as Record<string, unknown> | null

  const initialData = {
    email: user.email || '',
    full_name: (p?.full_name as string) || 'Dra. Gabriela Soares',
    crmv: (p?.crmv as string) || '',
    phone: (p?.phone as string) || '(84) 98636-5455',
    avatar_url: (p?.avatar_url as string) || '',
    base_cep: (p?.base_cep as string) || '59152-250',
    base_address:
      (p?.base_address as string) ||
      'Rua das Embarcações, 171, Nova Parnamirim, Parnamirim - RN',
    km_rate: typeof p?.km_rate === 'number' ? p.km_rate : 2.5,
  }

  return (
    <ViewTransition enter="fade-in" default="none">
      <div className="min-h-screen flex flex-col p-4 sm:p-8 pt-6 relative max-w-4xl mx-auto w-full gap-8">
        <main className="flex-1 flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-primary hover:underline font-bold text-sm">
              &larr; Voltar
            </Link>
          </div>

          <ProfileForm initialData={initialData} />
        </main>
      </div>
    </ViewTransition>
  )
}
