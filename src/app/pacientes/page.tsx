import { requireSession } from '@/infrastructure/auth/session';
import { signStorageUrls } from '@/infrastructure/storage/media';
import { Card } from '@/components/ui/Card';
import { buttonClasses } from '@/components/ui/Button';
import { NewPatientForm } from '@/components/features/NewPatientForm';
import { PatientSearchList } from '@/components/features/PatientSearchList';
import Link from 'next/link';
import { Metadata } from 'next';
import { z } from 'zod';

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
  const rawParams = await searchParams;
  const { supabase, userId } = await requireSession();

  const tutorIdParse = rawParams?.tutorId
    ? z.uuid().safeParse(rawParams.tutorId)
    : null;
  const validTutorId = tutorIdParse?.success ? tutorIdParse.data : undefined;

  let verifiedTutorName: string | undefined;
  if (validTutorId) {
    const { data: tutorRow } = await supabase
      .from('tutors')
      .select('name')
      .eq('id', validTutorId)
      .eq('profile_id', userId)
      .maybeSingle();
    verifiedTutorName = tutorRow?.name || undefined;
  }

  let query = supabase
    .from('patients')
    .select(`
      *,
      tutors!inner (
        name,
        phone
      )
    `)
    .eq('tutors.profile_id', userId);

  if (validTutorId) {
    query = query.eq('tutor_id', validTutorId);
  }

  const { data: rawPatients, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('Erro ao buscar pacientes:', error.code);
  }

  const basePatients = rawPatients || [];

  const signedPhotoUrls = await signStorageUrls(
    supabase,
    basePatients.map((p) => p.photo_url),
    'patients'
  );

  const patients = basePatients.map((p, idx) => ({
    ...p,
    photo_url: signedPhotoUrls[idx] ?? null,
  }));

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex-1 flex flex-col p-4 sm:p-8 gap-8 sm:gap-12 w-full max-w-5xl mx-auto outline-none"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex flex-col items-center sm:items-start">
          <h1 className="text-4xl font-black text-foreground tracking-tighter">
            {verifiedTutorName ? `Pets de ${verifiedTutorName}` : 'Meus Pacientes'}
          </h1>
        </div>
        <div className="flex gap-4">
          <NewPatientForm
            key={verifiedTutorName && validTutorId ? validTutorId : 'all'}
            initialTutorId={verifiedTutorName ? validTutorId : undefined}
            initialTutorName={verifiedTutorName}
          />
          <Link href="/" className={buttonClasses('secondary', 'px-6! py-2! text-sm')}>
            Voltar
          </Link>
        </div>
      </div>

      {error ? (
        <Card role="alert" className="bg-error/15 border-error/30 p-6">
          <p className="text-red-800 dark:text-red-200 font-bold text-center">
            Erro ao carregar pacientes. Tente novamente.
          </p>
        </Card>
      ) : (
        <PatientSearchList initialPatients={patients || []} />
      )}
    </main>
  );
}
