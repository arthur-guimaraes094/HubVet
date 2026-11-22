import { requireSession } from '@/infrastructure/auth/session'
import { signStorageUrl } from '@/infrastructure/storage/media'
import { redirect } from 'next/navigation'
import { ProfileForm } from '@/components/features/ProfileForm'
import { buttonClasses } from '@/components/ui/Button'
import Link from 'next/link'
import { ViewTransition } from 'react'

export default async function PerfilPage() {
  const { supabase, userId } = await requireSession()

  const [{ data: { user } }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('profiles')
      .select('full_name, crmv, phone, avatar_url, base_cep, base_address, km_rate, pix_key, pix_key_type')
      .eq('id', userId)
      .single(),
  ])

  if (!user) {
    redirect('/login')
  }

  const p = profile as Record<string, unknown> | null
  const rawAvatarUrl = (p?.avatar_url as string) || ''
  const signedAvatarUrl = rawAvatarUrl
    ? await signStorageUrl(supabase, rawAvatarUrl, 'avatars')
    : null

  const initialData = {
    email: user.email || '',
    full_name: (p?.full_name as string) || 'Dra. Gabriela Soares',
    crmv: (p?.crmv as string) || '',
    phone: (p?.phone as string) || '(84) 98636-5455',
    avatar_url: signedAvatarUrl || '',
    base_cep: (p?.base_cep as string) || '59152-250',
    base_address:
      (p?.base_address as string) ||
      'Rua das Embarcações, 171, Nova Parnamirim, Parnamirim - RN',
    km_rate: typeof p?.km_rate === 'number' ? p.km_rate : 2.5,
    pix_key: (p?.pix_key as string) || '',
    pix_key_type: (p?.pix_key_type as string) || 'CPF',
  }

  return (
    <ViewTransition enter="fade-in" default="none">
      <div className="min-h-screen flex flex-col p-4 sm:p-8 pt-6 relative max-w-4xl mx-auto w-full gap-8">
        <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col gap-6 outline-none">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-extrabold text-foreground">Meu Perfil</h1>
            <Link href="/" className={buttonClasses('secondary', 'px-4! py-2! text-sm')}>
              Voltar
            </Link>
          </div>

          <ProfileForm initialData={initialData} />
        </main>
      </div>
    </ViewTransition>
  )
}
