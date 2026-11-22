import { requireSession } from '@/infrastructure/auth/session';
import { TutorList } from '@/components/features/TutorList';
import { buttonClasses } from '@/components/ui/Button';
import Link from 'next/link';

export default async function TutoresPage() {
  await requireSession();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex-1 flex flex-col p-4 sm:p-8 gap-8 sm:gap-12 w-full max-w-5xl mx-auto outline-none"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center sm:items-start">
          <h1 className="text-4xl font-black text-foreground tracking-tighter">Tutores</h1>
          <p className="text-sm font-bold text-muted-foreground italic">
            Gerencie os responsáveis pelos pacientes
          </p>
        </div>
        <div className="flex gap-4">
          <Link href="/" className={buttonClasses('secondary', 'px-6! py-2! text-sm')}>
            Voltar
          </Link>
        </div>
      </div>

      <TutorList />
    </main>
  );
}
