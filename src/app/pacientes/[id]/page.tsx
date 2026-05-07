import { createClient } from '@/infrastructure/database/server';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ViewTransition } from "react";
import { LocalDate } from '@/components/ui/LocalDate';

import { translateSpecies } from '@/core/utils/translations';

export const revalidate = 0;

interface ConsultationItem {
  id: string;
  quantity: number;
  applied_cost: number;
  inventory: {
    name: string;
  } | null;
}

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
    .neq('status', 'Canceled') // Não mostrar canceladas no histórico clínico
    .order('date', { ascending: false });

  // Preparar dados para o gráfico de peso
  const weightData = (consultations || [])
    .filter(c => c.weight_kg)
    .map(c => ({ date: c.date, weight: Number(c.weight_kg) }))
    .reverse();

  return (
    <ViewTransition enter="fade-in" default="none">
      <main className="flex-1 flex flex-col p-8 gap-8 w-full max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-3xl font-extrabold text-foreground">{patient.name}</h1>
            <span className="text-foreground/60 font-bold">
              {translateSpecies(patient.species)} • Tutor: {patient.tutors?.name}
            </span>
          </div>
          <Link href="/pacientes">
            <Button variant="secondary" className="!px-4 !py-2 text-sm">Voltar</Button>
          </Link>
        </div>

        {/* Gráfico de Peso */}
        {weightData.length > 1 && (
          <Card className="p-6 flex flex-col gap-4 bg-background shadow-neu-sm border border-foreground/5 overflow-hidden">
            <h3 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Evolução de Peso
            </h3>
            <div className="h-48 w-full relative mt-4 flex items-end gap-3 px-2 overflow-x-auto pb-4">
              {(() => {
                const sortedData = [...weightData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const maxW = Math.max(...sortedData.map(w => w.weight), 1);
                
                return sortedData.map((d, i) => {
                  // Deixa 20% de respiro no topo
                  const height = (d.weight / (maxW * 1.2)) * 100;
                  
                  return (
                    <div key={i} className="flex-1 h-full min-w-[60px] flex flex-col justify-end items-center group relative">
                      <div 
                        className="w-full bg-primary rounded-t-2xl transition-all group-hover:bg-primary/80 relative shadow-neu-flat" 
                        style={{ height: `${height}%` }}
                      >
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 text-xs font-black text-white bg-primary shadow-lg px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 whitespace-nowrap z-20">
                          {d.weight} kg
                        </div>
                      </div>
                      <span className="text-[10px] mt-3 font-black text-foreground/40 whitespace-nowrap uppercase tracking-tighter">
                        {new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </Card>
        )}

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
              {consultations.map((consult) => {
                const isScheduled = consult.status === 'Scheduled';
                
                return (
                  <div key={consult.id} className="relative pl-12">
                    {/* Timeline Dot */}
                    <div className={`absolute left-0 top-2 w-10 h-10 bg-background rounded-full shadow-neu-sm flex items-center justify-center z-10 border border-foreground/5 ${isScheduled ? 'animate-pulse border-primary/30' : ''}`}>
                      <div className={`w-3 h-3 rounded-full ${isScheduled ? 'bg-orange-500' : 'bg-primary'}`}></div>
                    </div>

                    <Card className={`flex flex-col gap-4 ${isScheduled ? 'border-2 border-orange-200 bg-orange-50/30' : ''}`}>
                      <div className="flex justify-between items-start border-b border-foreground/5 pb-3">
                        <div className="min-w-0">
                          <span className="text-xs font-black text-primary uppercase tracking-widest">
                            <LocalDate date={consult.date} />
                          </span>
                          <h3 className="text-lg font-bold text-foreground truncate">
                            {isScheduled ? 'Agendamento Pendente' : `Atendimento ${consult.type === 'Home' ? 'Domiciliar' : 'em Hospital'}`}
                          </h3>
                        </div>
                        {isScheduled ? (
                          <Link href={`/prontuario?id=${patient.id}&type=Paciente&consultationId=${consult.id}&returnTo=history`}>
                            <Button variant="primary" className="!px-4 !py-1 text-xs">Atender</Button>
                          </Link>
                        ) : (
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-xs font-bold px-2 py-1 bg-success/10 text-success rounded-full">
                              R$ {Number(consult.base_fee).toFixed(2)}
                            </span>
                            {consult.weight_kg && (
                              <span className="text-[10px] font-bold text-foreground/40 mt-1">{consult.weight_kg} kg</span>
                            )}
                          </div>
                        )}
                      </div>

                      {isScheduled ? (
                        <div className="flex items-center gap-2 p-3 bg-orange-100/50 rounded-xl border border-orange-200">
                          <span className="text-sm font-bold text-orange-700">Atendimento ainda não realizado.</span>
                        </div>
                      ) : (
                        <>
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
                                {consult.consultation_items.map((item: ConsultationItem) => (
                                  <div key={item.id} className="px-3 py-1 bg-background shadow-neu-sm rounded-lg text-xs font-medium text-foreground flex items-center gap-2 border border-foreground/5">
                                    <span className="font-bold text-primary">{item.quantity}x</span>
                                    <span>{item.inventory?.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </ViewTransition>
  );
}
