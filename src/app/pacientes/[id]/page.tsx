import { createClient } from '@/infrastructure/database/server';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ViewTransition } from "react";

export const revalidate = 0;

export default async function PatientHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Buscar dados do paciente
  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('*, tutors(name, phone)')
    .eq('id', id)
    .single();

  if (patientError || !patient) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8">
        <Card className="text-center py-8">
          <p className="text-error font-bold">Paciente não encontrado.</p>
          <Link href="/pacientes" className="mt-4 block">
            <Button variant="secondary">Voltar</Button>
          </Link>
        </Card>
      </main>
    );
  }

  // 2. Buscar histórico de consultas com itens e nomes dos insumos
  const { data: consultations } = await supabase
    .from('consultations')
    .select(`
      *,
      consultation_items (
        id,
        quantity,
        applied_cost,
        inventory (
          name
        )
      )
    `)
    .eq('patient_id', id)
    .order('date', { ascending: false });

  return (
    <ViewTransition enter="fade-in" default="none">
      <main className="flex-1 flex flex-col p-8 gap-8 w-full max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-3xl font-extrabold text-foreground">{patient.name}</h1>
            <span className="text-foreground/60 font-bold">{patient.species} • Tutor: {patient.tutors?.name}</span>
          </div>
          <Link href="/pacientes">
            <Button variant="secondary" className="!px-4 !py-2 text-sm">Voltar</Button>
          </Link>
        </div>

        <div className="flex flex-col gap-6">
          <h2 className="text-xl font-bold text-primary flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Linha do Tempo de Atendimentos
          </h2>

          {!consultations || consultations.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-foreground/50 font-bold">Nenhum atendimento registrado para este paciente.</p>
              <Link href={`/prontuario?id=${patient.id}&type=Paciente`} className="mt-4 block">
                <Button variant="primary">Iniciar Primeiro Atendimento</Button>
              </Link>
            </Card>
          ) : (
            <div className="flex flex-col gap-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-foreground/10">
              {consultations.map((consult) => (
                <div key={consult.id} className="relative pl-12">
                  {/* Timeline Dot */}
                  <div className="absolute left-0 top-2 w-10 h-10 bg-background rounded-full shadow-neu-sm flex items-center justify-center z-10 border border-foreground/5">
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                  </div>

                  <Card className="flex flex-col gap-4">
                    <div className="flex justify-between items-start border-b border-foreground/5 pb-3">
                      <div>
                        <span className="text-xs font-black text-primary uppercase tracking-widest">
                          {new Date(consult.date.replace(' ', 'T')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                        <h3 className="text-lg font-bold text-foreground">Atendimento {consult.type}</h3>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 bg-success/10 text-success rounded-full">
                        R$ {Number(consult.base_fee).toFixed(2)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Notas Clínicas</span>
                      <p className="text-sm text-foreground/80 leading-relaxed bg-background/50 p-4 rounded-xl shadow-neu-pressed border border-foreground/5 italic">
                        {consult.clinical_notes || 'Sem observações.'}
                      </p>
                    </div>

                    {consult.consultation_items && consult.consultation_items.length > 0 && (
                      <div className="space-y-3">
                        <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Insumos e Medicamentos</span>
                        <div className="flex flex-wrap gap-2">
                          {consult.consultation_items.map((item: any) => (
                            <div key={item.id} className="px-3 py-1 bg-background shadow-neu-sm rounded-lg text-xs font-medium text-foreground flex items-center gap-2 border border-foreground/5">
                              <span className="font-bold text-primary">{item.quantity}x</span>
                              <span>{item.inventory?.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </ViewTransition>
  );
}
