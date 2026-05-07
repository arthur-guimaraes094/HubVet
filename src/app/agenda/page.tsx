import { createClient } from '@/infrastructure/database/server';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ScheduleConsultationForm } from '@/components/features/ScheduleConsultationForm';
import Link from 'next/link';
import { ViewTransition } from "react";

export const revalidate = 0;

export default async function AgendaPage() {
  const supabase = await createClient();

  // 1. Buscar consultas agendadas
  const { data: consultations } = await supabase
    .from('consultations')
    .select(`
      *,
      patients (
        id,
        name,
        species,
        tutors (
          name
        )
      )
    `)
    .eq('status', 'Scheduled')
    .order('date', { ascending: true });

  // 2. Buscar pacientes para o form
  const { data: patients } = await supabase.from('patients').select('id, name, species');

  return (
    <ViewTransition enter="fade-in" default="none">
      <main className="flex-1 flex flex-col p-8 gap-8 w-full max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold text-foreground">Agenda</h1>
          <div className="flex gap-4">
            <ScheduleConsultationForm patients={patients || []} />
            <Link href="/">
              <Button variant="secondary" className="!px-4 !py-2 text-sm">Voltar</Button>
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {!consultations || consultations.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-foreground/50 font-bold">Nenhuma consulta agendada.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {consultations.map((consult) => (
                <Card key={consult.id} className="flex flex-col sm:flex-row justify-between items-center gap-6 border-l-8 border-primary">
                  <div className="flex items-center gap-6 w-full sm:w-auto">
                    {/* Time block */}
                    <div className="flex flex-col items-center justify-center min-w-[80px] p-3 rounded-2xl bg-background shadow-neu-sm border border-foreground/5">
                      <span className="text-xs font-black text-primary uppercase">
                        {new Date(consult.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </span>
                      <span className="text-xl font-black text-foreground">
                        {new Date(consult.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <h3 className="text-xl font-extrabold text-foreground">{consult.patients?.name}</h3>
                      <span className="text-sm font-bold text-foreground/60">
                        {consult.patients?.species} • Tutor: {consult.patients?.tutors?.name}
                      </span>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full ${
                          consult.type === 'Home' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {consult.type === 'Home' ? 'Domicílio' : 'Hospital'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full sm:w-auto">
                    <Link href={`/prontuario?id=${consult.patients?.id}&type=Paciente&consultationId=${consult.id}`} className="flex-1 sm:flex-none">
                      <Button variant="primary" className="w-full !px-6">Atender</Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </ViewTransition>
  );
}
