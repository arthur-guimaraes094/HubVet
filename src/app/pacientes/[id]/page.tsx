import { createClient } from '@/infrastructure/database/server';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ViewTransition } from "react";
import { LocalDate } from '@/components/ui/LocalDate';
import Image from 'next/image';

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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <h1 className="text-4xl font-black text-foreground tracking-tighter">{patient.name}</h1>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
              <span className="text-[10px] font-black bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-widest">
                {translateSpecies(patient.species)}
              </span>
              {patient.breed && (
                <span className="text-[10px] font-black bg-foreground/5 text-foreground/60 px-3 py-1 rounded-full uppercase tracking-widest">
                  {patient.breed}
                </span>
              )}
              {patient.color && (
                <span className="text-[10px] font-black bg-foreground/5 text-foreground/60 px-3 py-1 rounded-full uppercase tracking-widest">
                  {patient.color}
                </span>
              )}
              {patient.weight_kg && (
                <span className="text-[10px] font-black bg-success/10 text-success px-3 py-1 rounded-full uppercase tracking-widest">
                  {patient.weight_kg} kg
                </span>
              )}
            </div>
            <p className="text-foreground/30 font-bold uppercase text-[9px] tracking-[0.3em] mt-3">
              Tutor Responsável: {patient.tutors?.name}
            </p>
          </div>
          
          <div className="flex gap-4">
            <Link href={`/prontuario?id=${patient.id}&type=Paciente`}>
              <Button variant="primary" className="px-8! py-3! shadow-sm border border-border hover:shadow-sm">
                Novo Atendimento
              </Button>
            </Link>
            <Link href="/pacientes">
              <Button variant="secondary" className="px-6! py-3!">Voltar</Button>
            </Link>
          </div>
        </div>

        {/* Gráfico de Peso */}
        {weightData.length > 1 && (
          <Card className="p-6 flex flex-col gap-4 bg-background shadow-sm border border-border overflow-hidden">
            <h3 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Evolução de Peso
            </h3>
            <div className="h-64 w-full relative mt-4 px-2">
              {(() => {
                const sortedData = [...weightData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                if (sortedData.length < 2) return null;

                const padding = 40;
                const width = 600; // Base width for coordinates
                const height = 200; // Base height for coordinates
                const maxW = Math.max(...sortedData.map(w => w.weight)) * 1.2;
                const minW = Math.min(...sortedData.map(w => w.weight)) * 0.8;
                const range = maxW - minW;

                const points = sortedData.map((d, i) => {
                  const x = (i / (sortedData.length - 1)) * (width - padding * 2) + padding;
                  const y = height - ((d.weight - minW) / range) * (height - padding * 2) - padding;
                  return { x, y, weight: d.weight, date: d.date };
                });

                const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

                return (
                  <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full drop-shadow-lg overflow-visible">
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    
                    {/* Eixos */}
                    <line x1={padding} y1={height - 20} x2={width - padding/2} y2={height - 20} stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />
                    <line x1={padding} y1={padding/2} x2={padding} y2={height - 20} stroke="currentColor" strokeOpacity="0.1" strokeWidth="1" />

                    {/* Área preenchida */}
                    <path d={areaD} fill="url(#areaGradient)" />
                    
                    {/* Linha do gráfico */}
                    <path d={pathD} fill="none" stroke="rgb(59, 130, 246)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Pontos e Rótulos */}
                    {points.map((p, i) => (
                      <g key={i} className="group cursor-pointer">
                        {/* Linha tracejada vertical */}
                        <line x1={p.x} y1={p.y} x2={p.x} y2={height - 20} stroke="currentColor" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="4" />
                        
                        {/* Ponto */}
                        <circle cx={p.x} cy={p.y} r="6" fill="white" stroke="rgb(59, 130, 246)" strokeWidth="3" className="transition-all group-hover:r-8" />
                        
                        {/* Peso acima do ponto */}
                        <text x={p.x} y={p.y - 12} textAnchor="middle" className="text-[14px] font-black fill-primary transition-all opacity-100">
                          {p.weight}kg
                        </text>

                        {/* Data abaixo */}
                        <text x={p.x} y={height - 5} textAnchor="middle" className="text-[12px] font-bold fill-foreground/40">
                          {new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </text>
                      </g>
                    ))}
                  </svg>
                );
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
                    <div className={`absolute left-0 top-2 w-10 h-10 bg-background rounded-full shadow-sm border border-border flex items-center justify-center z-10 ${isScheduled ? 'animate-pulse border-primary/30' : ''}`}>
                      <div className={`w-3 h-3 rounded-full ${isScheduled ? 'bg-orange-500' : 'bg-primary'}`}></div>
                    </div>

                    <Card className={`flex flex-col gap-4 ${isScheduled ? 'border-2 border-orange-200 bg-orange-50/30' : ''}`}>
                      <div className="flex justify-between items-start border-b border-foreground/5 pb-3">
                        <div className="min-w-0">
                          <span className="text-xs font-black text-primary uppercase tracking-widest">
                            <LocalDate date={consult.date} />
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight mt-1">
                            {isScheduled ? 'Agendamento Pendente' : `Atendimento ${consult.type === 'Home' ? 'Domiciliar' : 'em Clínica'}`}
                          </h3>
                        </div>
                        {isScheduled ? (
                          <Link href={`/prontuario?id=${patient.id}&type=Paciente&consultationId=${consult.id}&returnTo=history`}>
                            <Button variant="primary" className="px-4! py-1! text-xs">Atender</Button>
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
                            <p className="text-sm text-foreground/80 leading-relaxed bg-background/50 p-4 rounded-xl shadow-inner border border-border italic">
                              {consult.clinical_notes || 'Sem observações.'}
                            </p>
                          </div>

                          {consult.images && consult.images.length > 0 && (
                            <div className="space-y-3">
                              <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Imagens e Anexos</span>
                              <div className="flex flex-wrap gap-2">
                                {consult.images.map((url: string, idx: number) => (
                                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden shadow-sm border border-border bg-card group cursor-pointer hover:scale-105 transition-transform">
                                    <Image 
                                      src={url} 
                                      alt={`Anexo ${idx + 1}`} 
                                      fill 
                                      sizes="80px"
                                      className="object-cover" 
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {consult.consultation_items && consult.consultation_items.length > 0 && (
                            <div className="space-y-3">
                              <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Insumos e Medicamentos</span>
                              <div className="flex flex-wrap gap-2">
                                {consult.consultation_items.map((item: ConsultationItem) => (
                                  <div key={item.id} className="px-3 py-1 bg-background shadow-sm border border-border rounded-lg text-xs font-medium text-foreground flex items-center gap-2">
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
