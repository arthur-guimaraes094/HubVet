import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { QuickSearch } from "@/components/features/QuickSearch";
import Link from "next/link";
import Image from "next/image";
import { createClient } from '@/infrastructure/database/server';
import { ViewTransition } from "react";

export default async function Home() {
  const supabase = await createClient();
  // O proxy já garante autenticação — usamos getSession() (local, sem HTTP)
  // apenas para obter o user.id para buscar o avatar.
  const { data: { session } } = await supabase.auth.getSession();
  
  let avatarUrl = null;
  if (session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', session.user.id)
      .single();
      
    if (profile?.avatar_url) {
      avatarUrl = profile.avatar_url;
    }
  }

  return (
    <ViewTransition enter="fade-in" default="none">
      <main className="flex-1 flex flex-col items-center justify-center p-8 gap-8 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8 w-full px-2">
          <div className="text-left">
            <h1 className="text-5xl font-black tracking-tighter text-foreground mb-1">HubVet</h1>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-80">
              Atendimentos Domiciliares
            </p>
          </div>
          
          <Link href="/perfil" className="w-16 h-16 bg-background rounded-full shadow-sm border border-border flex items-center justify-center text-primary hover:shadow-inner border border-border bg-gray-50/50 transition-all active:scale-95 cursor-pointer border border-foreground/[0.03] overflow-hidden p-1">
            <div className="w-full h-full rounded-full overflow-hidden bg-foreground/5 flex items-center justify-center">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Perfil" width={64} height={64} className="w-full h-full object-cover" />
              ) : (
                <span className="font-black text-xl tracking-tighter">MV</span>
              )}
            </div>
          </Link>
        </div>

        <Card className="w-full flex flex-col gap-8 p-10 bg-background/40">
          <QuickSearch />
          
          <div className="grid grid-cols-2 gap-4 mt-2">
            <Link href="/agenda" className="w-full">
              <Button variant="primary" className="w-full !py-4 shadow-sm border border-border hover:shadow-sm border border-border">Agenda</Button>
            </Link>
            <Link href="/pacientes" className="w-full">
              <Button variant="secondary" className="w-full !py-4">Pacientes</Button>
            </Link>
            <Link href="/tutores" className="w-full">
              <Button variant="secondary" className="w-full !py-4">Tutores</Button>
            </Link>
            <Link href="/financeiro" className="w-full">
              <Button variant="secondary" className="w-full !py-4">Financeiro</Button>
            </Link>
            <Link href="/estoque" className="w-full">
              <Button variant="secondary" className="w-full !py-4">Maleta</Button>
            </Link>
            <Link href="/calculadora" className="w-full">
              <Button variant="secondary" className="w-full !py-4">Cálculo</Button>
            </Link>
          </div>
        </Card>
      </main>
    </ViewTransition>
  );
}
