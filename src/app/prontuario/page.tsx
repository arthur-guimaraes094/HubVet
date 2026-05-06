import { ConsultationForm } from '@/components/features/ConsultationForm';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/infrastructure/database/server';
import Link from 'next/link';

export const revalidate = 0;

export default async function ProntuarioPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; type?: string }>
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: inventory } = await supabase.from('inventory').select('*').order('name');
  
  let patientData = null;
  if (params?.id && params?.type === 'Paciente') {
    const { data } = await supabase.from('patients').select('*, tutors(name)').eq('id', params.id).single();
    patientData = data;
  }

  return (
    <main className="flex-1 flex flex-col p-8 gap-8 w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-foreground">Prontuário Expresso</h1>
        <Link href="/">
          <Button variant="secondary" className="!px-4 !py-2 text-sm">Voltar</Button>
        </Link>
      </div>

      <ConsultationForm 
        inventory={inventory || []} 
        patientId={patientData?.id} 
        patientName={patientData?.name}
        tutorName={patientData?.tutors?.name}
      />
    </main>
  );
}
