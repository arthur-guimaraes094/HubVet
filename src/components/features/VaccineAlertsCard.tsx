import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { buildWhatsAppVaccineReminderUrl } from '@/core/use-cases/vaccine-protocols';
import { getBrazilDateString } from '@/core/utils/timezone';

export interface UpcomingVaccineItem {
  id: string;
  patientId: string;
  patientName: string;
  tutorName: string;
  tutorPhone: string | null;
  vaccineName: string;
  nextDueDate: string; // YYYY-MM-DD
  nextDoseLabel: string;
}

interface VaccineAlertsCardProps {
  vaccines: UpcomingVaccineItem[];
}

export function VaccineAlertsCard({ vaccines }: VaccineAlertsCardProps) {
  if (!vaccines || vaccines.length === 0) return null;

  const todayStr = getBrazilDateString();

  return (
    <Card className="w-full flex flex-col gap-3 p-5 bg-card border border-primary/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden="true">💉</span>
          <div>
            <h2 className="text-sm font-black text-foreground tracking-tight">
              Avisos Programados de Vacinas
            </h2>
            <p className="text-xs font-medium text-muted-foreground">
              Vacinas vencidas ou com reforço nos próximos 14 dias
            </p>
          </div>
        </div>
        <span
          aria-label={`${vaccines.length} ${vaccines.length === 1 ? 'alerta de vacina' : 'alertas de vacina'}`}
          className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-black"
        >
          {vaccines.length}
        </span>
      </div>

      <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
        {vaccines.map((vac) => {
          const isOverdue = vac.nextDueDate < todayStr;
          const isToday = vac.nextDueDate === todayStr;
          const formattedDate = vac.nextDueDate.split('-').reverse().join('/');

          const whatsappUrl = vac.tutorPhone
            ? buildWhatsAppVaccineReminderUrl({
                tutorPhone: vac.tutorPhone,
                tutorName: vac.tutorName || 'Tutor(a)',
                patientName: vac.patientName,
                vaccineName: vac.vaccineName,
                nextDoseLabel: vac.nextDoseLabel || 'Reforço Vacinal',
                nextDueDate: vac.nextDueDate,
              })
            : null;

          return (
            <div
              key={vac.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl border ${
                isOverdue
                  ? 'bg-error/5 border-error/25'
                  : isToday
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-foreground/[0.02] border-border'
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/pacientes/${vac.patientId}`}
                    className="text-xs font-black text-foreground hover:text-primary transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span aria-hidden="true">🐾 </span>
                    {vac.patientName}
                  </Link>
                  <span className="text-xs font-bold text-muted-foreground">
                    ({vac.tutorName})
                  </span>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isOverdue
                        ? 'bg-error text-error-foreground'
                        : isToday
                        ? 'bg-amber-700 text-white dark:bg-amber-400 dark:text-slate-950'
                        : 'bg-primary/15 text-primary'
                    }`}
                  >
                    {isOverdue ? 'Vencida' : isToday ? 'Hoje' : formattedDate}
                  </span>
                </div>
                <span className="text-xs font-bold text-foreground/80">
                  {vac.vaccineName} • {vac.nextDoseLabel} ({formattedDate})
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-3 py-2 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-xs font-black transition-all inline-flex items-center gap-1.5 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <span aria-hidden="true">📲</span>
                    <span>Avisar Tutor</span>
                    <span className="sr-only"> (abre em nova aba)</span>
                  </a>
                )}
                <Link
                  href={`/pacientes/${vac.patientId}`}
                  className="min-h-[44px] px-3 py-2 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/85 border border-border text-xs font-bold transition-all inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  Ver Ficha
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
