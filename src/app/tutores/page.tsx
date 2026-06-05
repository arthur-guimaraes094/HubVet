import { TutorList } from '@/components/features/TutorList';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

export default function TutoresPage() {
  return (
    <main className="flex-1 flex flex-col p-8 gap-12 w-full max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center sm:items-start">
          <h1 className="text-4xl font-black text-foreground tracking-tighter">Tutores</h1>
          <p className="text-sm font-bold text-foreground/40 italic">Gerencie os responsáveis pelos pacientes</p>
        </div>
        <div className="flex gap-4">
          <Link href="/">
            <Button variant="secondary" className="px-6! py-2! text-sm">Voltar</Button>
          </Link>
        </div>
      </div>

      <TutorList />
    </main>
  );
}
