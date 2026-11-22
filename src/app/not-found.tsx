import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { buttonClasses } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex-1 flex flex-col items-center justify-center p-6 outline-none"
    >
      <Card className="max-w-md w-full p-8 text-center flex flex-col items-center gap-4">
        <h1 className="text-2xl font-black text-foreground tracking-tight">
          Página ou registro não encontrado
        </h1>
        <p className="text-sm text-muted-foreground font-medium">
          O recurso que você procura não existe ou não pertence à sua conta.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
          <Link href="/" className={buttonClasses('primary')}>
            Voltar ao Painel
          </Link>
          <Link href="/pacientes" className={buttonClasses('secondary')}>
            Ver Pacientes
          </Link>
        </div>
      </Card>
    </main>
  );
}
