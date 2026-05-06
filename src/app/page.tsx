import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { QuickSearch } from "@/components/features/QuickSearch";
import Link from "next/link";
import Image from "next/image";
import { createClient } from '@/infrastructure/database/server';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  let avatarUrl = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();
      
    if (profile?.avatar_url) {
      avatarUrl = profile.avatar_url;
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-8 gap-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div className="text-left">
          <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">HubVet</h1>
          <p className="text-lg font-medium text-foreground/80">
            Atendimentos domiciliares e rápidos.
          </p>
        </div>
        
        <Link href="/perfil" className="w-14 h-14 bg-background rounded-full shadow-neu-sm flex items-center justify-center text-primary hover:shadow-neu-pressed transition-all active:scale-95 cursor-pointer border border-foreground/5 overflow-hidden">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="Perfil" width={56} height={56} className="w-full h-full object-cover" />
          ) : (
            <span className="font-bold text-xl">MV</span>
          )}
        </Link>
      </div>

      <Card className="w-full flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-foreground">Acesso Rápido</h2>
        
        <QuickSearch />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
          <Link href="/prontuario" className="w-full">
            <Button variant="secondary" className="w-full !px-2">Novo Prontuário</Button>
          </Link>
          <Link href="/calculadora" className="w-full">
            <Button variant="primary" className="w-full !px-2">Calculadora</Button>
          </Link>
          <Link href="/pacientes" className="w-full">
            <Button variant="secondary" className="w-full !px-2">Pacientes</Button>
          </Link>
          <Link href="/estoque" className="w-full">
            <Button variant="secondary" className="w-full !px-2">Maleta (Estoque)</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
