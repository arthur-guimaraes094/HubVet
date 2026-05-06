import { createClient } from '@/infrastructure/database/server'
import { redirect } from 'next/navigation'
import { ProfileForm } from '@/components/features/ProfileForm'
import Link from 'next/link'

export default async function PerfilPage() {
  const supabase = await createClient()

  // 1. Pegar usuário atual
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // 2. Pegar perfil do banco
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, crmv, phone, avatar_url')
    .eq('id', user.id)
    .single()

  const initialData = {
    email: user.email || '',
    full_name: profile?.full_name || '',
    crmv: profile?.crmv || '',
    phone: profile?.phone || '',
    avatar_url: profile?.avatar_url || '',
  }

  return (
    <div className="min-h-screen flex flex-col p-4 sm:p-8 pt-6 relative max-w-4xl mx-auto w-full gap-8">
      <main className="flex-1 flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-primary hover:underline font-bold text-sm">
            &larr; Voltar
          </Link>
          <h2 className="text-2xl font-black text-foreground">Configurações</h2>
        </div>

        <ProfileForm initialData={initialData} />
      </main>
    </div>
  )
}
