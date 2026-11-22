import { requireSession } from '@/infrastructure/auth/session';
import { AgendaClient, Consultation, Patient } from '@/components/features/AgendaClient';
import { Metadata } from 'next';

export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Agenda',
  description: 'Gerencie seus atendimentos e compromissos veterinários.',
};

export default async function AgendaPage() {
  const { supabase, userId } = await requireSession();

  // 1. Buscar consultas agendadas/realizadas e pacientes em paralelo
  const [{ data: consultations }, { data: patients }] = await Promise.all([
    supabase
      .from('consultations')
      .select(
        `
        id,
        date,
        type,
        address,
        status,
        travel_distance_km,
        travel_fee,
        patients (
          id,
          name,
          species,
          tutors (
            name,
            address,
            phone
          )
        )
      `
      )
      .eq('profile_id', userId)
      .in('status', ['Scheduled', 'Completed'])
      .order('date', { ascending: true })
      .limit(500),
    supabase
      .from('patients')
      .select('id, name, species, tutors!inner (name, address, phone)')
      .eq('tutors.profile_id', userId),
  ]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex-1 flex flex-col p-4 md:p-8 gap-8 w-full outline-none"
    >
      <AgendaClient
        initialConsultations={(consultations as unknown as Consultation[]) || []}
        patients={(patients as unknown as Patient[]) || []}
      />
    </main>
  );
}
