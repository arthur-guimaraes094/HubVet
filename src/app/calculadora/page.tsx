import { requireSession } from '@/infrastructure/auth/session';
import { DoseCalculator } from '@/components/features/DoseCalculator';
import { buttonClasses } from '@/components/ui/Button';
import Link from 'next/link';

export default async function CalculadoraPage() {
  await requireSession();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex-1 flex flex-col p-4 sm:p-8 gap-8 max-w-2xl mx-auto w-full outline-none"
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-foreground">Calculadora Clínica</h1>
        <Link href="/" className={buttonClasses('secondary', 'px-4! py-2! text-sm')}>
          Voltar
        </Link>
      </div>

      <DoseCalculator />
    </main>
  );
}
