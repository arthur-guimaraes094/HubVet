import { DoseCalculator } from '@/components/features/DoseCalculator';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function CalculadoraPage() {
  return (
    <main className="flex-1 flex flex-col p-8 gap-8 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-foreground">Calculadora Clínica</h1>
        <Link href="/">
          <Button variant="secondary" className="px-4! py-2! text-sm">Voltar</Button>
        </Link>
      </div>

      <DoseCalculator />
    </main>
  );
}
