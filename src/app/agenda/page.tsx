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

  // 1. Buscar consultas agendadas e realizadas (incluindo endereço do tutor)
  const { data: consultations } = await supabase
    .from('consultations')
    .select(
      `
      *,
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
    .order('date', { ascending: true });

  // 2. Buscar pacientes para o form (incluindo endereço do tutor)
  const { data: patients } = await supabase
    .from('patients')
    .select('id, name, species, tutors!inner (name, address, phone)')
    .eq('tutors.profile_id', userId);

  return (
    <main className="flex-1 flex flex-col p-4 md:p-8 gap-8 w-full">
      <AgendaClient
        initialConsultations={(consultations as unknown as Consultation[]) || []}
        patients={(patients as unknown as Patient[]) || []}
      />
    </main>
  );
}
