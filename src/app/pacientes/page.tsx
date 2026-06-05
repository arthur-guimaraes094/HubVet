import { createClient } from '@/infrastructure/database/server';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { NewPatientForm } from '@/components/features/NewPatientForm';
import { PatientSearchList } from '@/components/features/PatientSearchList';
import Link from 'next/link';
import { Metadata } from 'next';

export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Pacientes',
  description: 'Gerencie e consulte o prontuário dos seus pacientes de forma expressa.',
};

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ tutorId?: string; tutorName?: string }>
}) {
  const { tutorId, tutorName } = await searchParams;
  const supabase = await createClient();
  
  let query = supabase
    .from('patients')
    .select(`
      *,
      tutors (
        name,
        phone
      )
    `);

  if (tutorId) {
    query = query.eq('tutor_id', tutorId);
  }

  const { data: patients, error } = await query.order('created_at', { ascending: false });

  return (
    <main className="flex-1 flex flex-col p-8 gap-12 w-full max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center sm:items-start">
          <h1 className="text-4xl font-black text-foreground tracking-tighter">
            {tutorName ? `Pets de ${tutorName}` : 'Meus Pacientes'}
          </h1>
        </div>
        <div className="flex gap-4">
          <NewPatientForm 
            key={tutorId || 'all'} 
            initialTutorId={tutorId} 
            initialTutorName={tutorName} 
          />
          <Link href="/">
            <Button variant="secondary" className="px-6! py-2! text-sm">Voltar</Button>
          </Link>
        </div>
      </div>

      {error ? (
        <Card className="bg-error/10 border-error/20 p-6">
          <p className="text-error font-bold text-center">Erro ao buscar pacientes: {error.message}</p>
        </Card>
      ) : (
        <PatientSearchList initialPatients={patients || []} />
      )}
    </main>
  );
}
