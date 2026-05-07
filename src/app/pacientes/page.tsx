import { createClient } from '@/infrastructure/database/server';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { NewPatientForm } from '@/components/features/NewPatientForm';
import Link from 'next/link';
import { translateSpecies } from '@/core/utils/translations';

// Definindo o revalidate para 0 garante que a página busque dados atualizados 
// a cada requisição (útil para o MVP sem cache complexo).
export const revalidate = 0;

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ tutorId?: string }>
}) {
  const { tutorId } = await searchParams;
  const supabase = await createClient();
  
  // Busca pacientes e os dados do tutor relacionado
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
    <main className="flex-1 flex flex-col p-8 gap-8 w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-foreground">Meus Pacientes</h1>
        <div className="flex gap-4">
          <NewPatientForm />
          <Link href="/">
            <Button variant="secondary" className="!px-4 !py-2 text-sm">Voltar</Button>
          </Link>
        </div>
      </div>

      {error ? (
        <Card className="bg-error/10 border-error/20">
          <p className="text-red-500 font-bold">Erro ao buscar pacientes: {error.message}</p>
        </Card>
      ) : patients?.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-foreground/60 font-bold text-lg">Nenhum paciente cadastrado ainda.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {patients?.map((patient) => (
            <Card key={patient.id} className="flex flex-col gap-3">
              <div className="flex justify-between items-start border-b border-foreground/10 pb-3">
                <div>
                  <h2 className="text-xl font-extrabold text-primary">{patient.name}</h2>
                  <span className="text-sm font-bold text-foreground/60">{translateSpecies(patient.species)}</span>
                </div>
                {patient.weight_kg && (
                  <div className="px-3 py-1 bg-background shadow-neu-pressed rounded-full">
                    <span className="text-sm font-bold text-success">{patient.weight_kg} kg</span>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-1 pt-2">
                <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Tutor</span>
                {(() => {
                  const tutor = patient.tutors as { name: string; phone: string | null } | null;
                  return (
                    <>
                      <span className="text-sm font-bold text-foreground">
                        {tutor?.name || 'Sem tutor'}
                      </span>
                      {tutor?.phone && (
                        <span className="text-sm text-foreground/80">{tutor.phone}</span>
                      )}
                    </>
                  );
                })()}
              </div>
              
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Link href={`/pacientes/${patient.id}`}>
                  <Button variant="secondary" className="w-full text-xs !py-2">Ver Histórico</Button>
                </Link>
                <Link href={`/prontuario?id=${patient.id}&type=Paciente`}>
                  <Button variant="primary" className="w-full text-xs !py-2">Atendimento</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
