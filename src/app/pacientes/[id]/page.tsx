import { createClient } from '@/infrastructure/database/server';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ViewTransition } from 'react';
import { LocalDate } from '@/components/ui/LocalDate';
import Image from 'next/image';
import { translateSpecies } from '@/core/utils/translations';
import { formatPatientAge, formatFertilityStatus } from '@/core/utils/age';
import { buildGoogleMapsUrl } from '@/core/utils/cep';
import { enrichPatientWithFallbackMeta } from '@/core/utils/patient-fallback-storage';
import {
  VaccinationSection,
  type PatientVaccinationRecord,
} from '@/components/features/VaccinationSection';
import {
  HistoryPdfButtons,
  type PrescriptionItem,
} from '@/components/features/HistoryPdfButtons';

export const revalidate = 0;

interface ConsultationItem {
  id: string;
  quantity: number;
  applied_cost: number;
  inventory: {
    name: string;
    type?: string;
  } | null;
}

export default async function PatientHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. Buscar dados do paciente e tutor
  const { data: rawPatient, error: patientError } = await supabase
    .from('patients')
    .select('*, tutors(name, phone, address)')
    .eq('id', id)
    .single();

  const patient = rawPatient
    ? await enrichPatientWithFallbackMeta(supabase, rawPatient)
    : null;

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

  // 2. Buscar dados do perfil da veterinária para assinatura dos PDFs
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let vetName = 'Dra. Gabriela Soares';
  let vetCrmv = '';
  if (session?.user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, crmv')
      .eq('id', session.user.id)
      .single();
    if (profile?.full_name) vetName = profile.full_name;
    if (profile?.crmv) vetCrmv = profile.crmv;
  }

  // 3. Buscar carteira de vacinação do paciente (com fallback seguro caso a tabela ainda não exista)
  const { data: rawVaccinations } = await supabase
    .from('patient_vaccinations')
    .select('*')
    .eq('patient_id', id)
    .order('applied_date', { ascending: false });

  const vaccinations = (rawVaccinations || []) as unknown as PatientVaccinationRecord[];

  // 4. Buscar histórico de consultas com itens e nomes dos insumos
  const { data: consultations } = await supabase
    .from('consultations')
    .select(
      `
      *,
      consultation_items (
        id,
        quantity,
        applied_cost,
        inventory (
          name,
          type
        )
      )
    `
    )
    .eq('patient_id', id)
    .neq('status', 'Canceled')
    .order('date', { ascending: false });

  const weightData = (consultations || [])
    .filter((c) => c.weight_kg)
    .map((c) => ({ date: c.date, weight: Number(c.weight_kg) }))
    .reverse();

  const patientAge = formatPatientAge(patient.birth_date);
  const fertilityLabel = formatFertilityStatus(patient.fertility_status);

  return (
    <ViewTransition enter="fade-in" default="none">
      <main className="flex-1 flex flex-col p-8 gap-8 w-full max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {patient.photo_url ? (
              <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary/30 shadow-md shrink-0">
                <Image
                  src={patient.photo_url}
                  alt={patient.name}
                  fill
                  sizes="96px"
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-foreground/5 border border-border flex items-center justify-center text-4xl shrink-0">
                {patient.species === 'Canine'
                  ? '🐶'
                  : patient.species === 'Feline'
                  ? '🐱'
                  : '🐾'}
              </div>
            )}

            <div className="flex flex-col items-center sm:items-start">
              <h1 className="text-4xl font-black text-foreground tracking-tighter">
                {patient.name}
              </h1>
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
                    Pelagem: {patient.color}
                  </span>
                )}
                {patient.weight_kg && (
                  <span className="text-[10px] font-black bg-success/10 text-success px-3 py-1 rounded-full uppercase tracking-widest">
                    {patient.weight_kg} kg
                  </span>
                )}
                {patientAge && (
                  <span className="text-[10px] font-black bg-foreground/5 text-foreground/70 px-3 py-1 rounded-full uppercase tracking-widest">
                    🎂 {patientAge}
                  </span>
                )}
                {fertilityLabel && (
                  <span className="text-[10px] font-black bg-primary/8 text-primary px-3 py-1 rounded-full uppercase tracking-widest">
                    {fertilityLabel}
                  </span>
                )}
              </div>

              {patient.fertility_notes && (
                <p className="text-xs font-medium text-foreground/60 mt-1.5 italic">
                  Reprodução/Fertilidade: {patient.fertility_notes}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 mt-3">
                <p className="text-foreground/40 font-bold uppercase text-[10px] tracking-[0.2em]">
                  Tutor: {patient.tutors?.name}
                  {patient.tutors?.phone ? ` • ${patient.tutors.phone}` : ''}
                </p>
                {patient.tutors?.address && (
                  <a
                    href={buildGoogleMapsUrl(patient.tutors.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-black text-primary hover:underline flex items-center gap-1"
                  >
                    📍 {patient.tutors.address} (Abrir Mapa)
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <Link href={`/prontuario?id=${patient.id}&type=Paciente`}>
              <Button variant="primary" className="px-8! py-3! shadow-sm border border-border">
                Novo Atendimento
              </Button>
            </Link>
            <Link href="/pacientes">
              <Button variant="secondary" className="px-6! py-3!">
                Voltar
              </Button>
            </Link>
          </div>
        </div>

        {/* Banner de Alergias e Observações Importantes */}
        {patient.clinical_observations && (
          <div className="p-4 rounded-2xl bg-error/10 border-2 border-error/25 flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-error uppercase tracking-[0.2em]">
                Alergias & Observações Clínicas do Paciente
              </span>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {patient.clinical_observations}
              </p>
            </div>
          </div>
        )}

        {/* Carteira de Vacinação e Protocolos */}
        <VaccinationSection
          patientId={patient.id}
          patientName={patient.name}
          patientSpecies={patient.species}
          tutorName={patient.tutors?.name}
          tutorPhone={patient.tutors?.phone}
          vaccinations={vaccinations}
        />

        {/* Gráfico de Peso */}
        {weightData.length > 1 && (
          <Card className="p-6 flex flex-col gap-4 bg-background shadow-sm border border-border overflow-hidden">
            <h3 className="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              Evolução de Peso
            </h3>
            <div className="h-64 w-full relative mt-4 px-2">
              {(() => {
                const sortedData = [...weightData].sort(
                  (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                );
                if (sortedData.length < 2) return null;

                const padding = 40;
                const width = 600;
                const height = 200;
                const maxW = Math.max(...sortedData.map((w) => w.weight)) * 1.2;
                const minW = Math.min(...sortedData.map((w) => w.weight)) * 0.8;
                const range = maxW - minW || 1;

                const points = sortedData.map((d, i) => {
                  const x =
                    (i / (sortedData.length - 1)) * (width - padding * 2) + padding;
                  const y =
                    height -
                    ((d.weight - minW) / range) * (height - padding * 2) -
                    padding;
                  return { x, y, weight: d.weight, date: d.date };
                });

                const pathD = points
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                  .join(' ');
                const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

                return (
                  <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full drop-shadow-lg overflow-visible"
                  >
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    <line
                      x1={padding}
                      y1={height - 20}
                      x2={width - padding / 2}
                      y2={height - 20}
                      stroke="currentColor"
                      strokeOpacity="0.1"
                      strokeWidth="1"
                    />
                    <line
                      x1={padding}
                      y1={padding / 2}
                      x2={padding}
                      y2={height - 20}
                      stroke="currentColor"
                      strokeOpacity="0.1"
                      strokeWidth="1"
                    />

                    <path d={areaD} fill="url(#areaGradient)" />

                    <path
                      d={pathD}
                      fill="none"
                      stroke="rgb(59, 130, 246)"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {points.map((p, i) => (
                      <g key={i} className="group cursor-pointer">
                        <line
                          x1={p.x}
                          y1={p.y}
                          x2={p.x}
                          y2={height - 20}
                          stroke="currentColor"
                          strokeOpacity="0.2"
                          strokeWidth="1"
                          strokeDasharray="4"
                        />
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="6"
                          fill="white"
                          stroke="rgb(59, 130, 246)"
                          strokeWidth="3"
                        />
                        <text
                          x={p.x}
                          y={p.y - 12}
                          textAnchor="middle"
                          className="text-[14px] font-black fill-primary"
                        >
                          {p.weight}kg
                        </text>
                        <text
                          x={p.x}
                          y={height - 5}
                          textAnchor="middle"
                          className="text-[12px] font-bold fill-foreground/40"
                        >
                          {new Date(p.date).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                          })}
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Linha do Tempo de Atendimentos
          </h2>

          {!consultations || consultations.length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-foreground/50 font-bold">
                Nenhum atendimento registrado para este paciente.
              </p>
              <Link
                href={`/prontuario?id=${patient.id}&type=Paciente`}
                className="mt-4 block"
              >
                <Button variant="primary">Iniciar Primeiro Atendimento</Button>
              </Link>
            </Card>
          ) : (
            <div className="flex flex-col gap-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-foreground/10">
              {consultations.map((consult) => {
                const isScheduled = consult.status === 'Scheduled';
                const prescriptions = Array.isArray(consult.prescriptions)
                  ? (consult.prescriptions as unknown as PrescriptionItem[])
                  : [];

                return (
                  <div key={consult.id} className="relative pl-12">
                    <div
                      className={`absolute left-0 top-2 w-10 h-10 bg-background rounded-full shadow-sm border border-border flex items-center justify-center z-10 ${
                        isScheduled ? 'animate-pulse border-primary/30' : ''
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded-full ${
                          isScheduled ? 'bg-orange-500' : 'bg-primary'
                        }`}
                      />
                    </div>

                    <Card
                      className={`flex flex-col gap-4 ${
                        isScheduled ? 'border-2 border-orange-200 bg-orange-50/30' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start border-b border-foreground/5 pb-3">
                        <div className="min-w-0">
                          <span className="text-xs font-black text-primary uppercase tracking-widest">
                            <LocalDate date={consult.date} />
                          </span>
                          <h3 className="text-base sm:text-lg font-bold text-foreground leading-tight mt-1">
                            {isScheduled
                              ? 'Agendamento Pendente'
                              : `Atendimento ${
                                  consult.type === 'Home' ? 'Domiciliar' : 'em Clínica'
                                }`}
                          </h3>
                        </div>
                        {isScheduled ? (
                          <Link
                            href={`/prontuario?id=${patient.id}&type=Paciente&consultationId=${consult.id}&returnTo=history`}
                          >
                            <Button variant="primary" className="px-4! py-1! text-xs">
                              Atender
                            </Button>
                          </Link>
                        ) : (
                          <div className="flex flex-col items-end shrink-0">
                            <span className="text-xs font-bold px-2 py-1 bg-success/10 text-success rounded-full">
                              R$ {Number(consult.base_fee).toFixed(2)}
                            </span>
                            {consult.weight_kg && (
                              <span className="text-[10px] font-bold text-foreground/40 mt-1">
                                {consult.weight_kg} kg
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {isScheduled ? (
                        <div className="flex items-center gap-2 p-3 bg-orange-100/50 rounded-xl border border-orange-200">
                          <span className="text-sm font-bold text-orange-700">
                            Atendimento ainda não realizado.
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">
                              Notas Clínicas
                            </span>
                            <p className="text-sm text-foreground/80 leading-relaxed bg-background/50 p-4 rounded-xl shadow-inner border border-border italic">
                              {consult.clinical_notes || 'Sem observações.'}
                            </p>
                          </div>

                          {prescriptions.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">
                                Receituário Prescrito
                              </span>
                              <div className="flex flex-col gap-1.5">
                                {prescriptions.map((rx) => (
                                  <div
                                    key={rx.id}
                                    className="p-2.5 rounded-xl bg-primary/5 border border-primary/10 text-xs"
                                  >
                                    <span className="font-black text-foreground">
                                      {rx.medicationName}{' '}
                                      {rx.concentration ? `(${rx.concentration})` : ''}
                                    </span>{' '}
                                    <span className="text-foreground/60">
                                      • {rx.route} • {rx.dosage} • {rx.frequency} • {rx.duration}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {consult.images && consult.images.length > 0 && (
                            <div className="space-y-3">
                              <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">
                                Imagens e Anexos
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {consult.images.map((url: string, idx: number) => (
                                  <div
                                    key={idx}
                                    className="relative w-20 h-20 rounded-xl overflow-hidden shadow-sm border border-border bg-card group cursor-pointer hover:scale-105 transition-transform"
                                  >
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

                          {consult.consultation_items &&
                            consult.consultation_items.length > 0 && (
                              <div className="space-y-3">
                                <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">
                                  Insumos e Medicamentos Aplicados
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {consult.consultation_items.map((item: ConsultationItem) => (
                                    <div
                                      key={item.id}
                                      className="px-3 py-1 bg-background shadow-sm border border-border rounded-lg text-xs font-medium text-foreground flex items-center gap-2"
                                    >
                                      <span className="font-bold text-primary">
                                        {item.quantity}x
                                      </span>
                                      <span>{item.inventory?.name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          <HistoryPdfButtons
                            docData={{
                              tutorName: patient.tutors?.name || 'Não Informado',
                              patientName: patient.name,
                              species: patient.species,
                              breed: patient.breed || '',
                              color: patient.color || '',
                              weight: consult.weight_kg?.toString() || patient.weight_kg?.toString() || '',
                              birthDate: patient.birth_date,
                              fertilityStatus: patient.fertility_status,
                              fertilityNotes: patient.fertility_notes,
                              clinicalObservations: patient.clinical_observations,
                              notes: consult.clinical_notes || '',
                              date: consult.date,
                              items: (consult.consultation_items || [])
                                .filter((ci: ConsultationItem) => ci.inventory?.type !== 'Consultation')
                                .map((ci: ConsultationItem) => ({
                                  name: ci.inventory?.name || 'Item',
                                  quantity: ci.quantity,
                                })),
                              prescriptions,
                              vetName,
                              vetCrmv,
                            }}
                          />
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
