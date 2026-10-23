import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { buildWhatsAppVaccineReminderUrl } from '@/core/use-cases/vaccine-protocols';

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

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <Card className="w-full flex flex-col gap-3 p-5 bg-card border border-primary/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">💉</span>
          <div>
            <h3 className="text-sm font-black text-foreground tracking-tight">
              Avisos Programados de Vacinas
            </h3>
            <p className="text-[11px] font-medium text-foreground/50">
              Vacinas vencidas ou com reforço nos próximos 14 dias
            </p>
          </div>
        </div>
        <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-black">
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
                    className="text-xs font-black text-foreground hover:text-primary transition-colors"
                  >
                    🐾 {vac.patientName}
                  </Link>
                  <span className="text-[10px] font-bold text-foreground/50">
                    ({vac.tutorName})
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isOverdue
                        ? 'bg-error text-white'
                        : isToday
                        ? 'bg-amber-500 text-white'
                        : 'bg-primary/15 text-primary'
                    }`}
                  >
                    {isOverdue ? 'Vencida' : isToday ? 'Hoje' : formattedDate}
                  </span>
                </div>
                <span className="text-[11px] font-bold text-foreground/75">
                  {vac.vaccineName} • {vac.nextDoseLabel} ({formattedDate})
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-[11px] font-black transition-all flex items-center gap-1 shadow-sm"
                  >
                    📲 Avisar Tutor
                  </a>
                )}
                <Link
                  href={`/pacientes/${vac.patientId}`}
                  className="px-2.5 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground/70 text-[11px] font-bold transition-all"
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
