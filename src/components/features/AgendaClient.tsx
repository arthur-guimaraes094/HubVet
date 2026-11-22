"use client";

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Button, buttonClasses } from '@/components/ui/Button';
import { LocalDate } from '@/components/ui/LocalDate';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScheduleConsultationForm } from './ScheduleConsultationForm';
import { getConsultationDetails, cancelarConsulta } from '@/app/agenda/actions';
import {
  gerarPDFReceituario,
  gerarPDFRelatorioAtendimento,
  type PrescriptionItem,
} from '@/core/use-cases/generate-pdf';
import { useToast } from '@/components/ui/Toast';
import { translateSpecies } from '@/core/utils/translations';
import { buildGoogleMapsUrl } from '@/core/utils/cep';
import { buildWazeUrl, buildWhatsAppOnMyWayUrl } from '@/core/utils/whatsapp';
import { Edit2, Trash2, MoreVertical } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ContextMenu } from '@/components/ui/ContextMenu';
import { formatBrazilDate, getBrazilDateString } from '@/core/utils/timezone';

export interface Consultation {
  id: string;
  date: string;
  type: string;
  address: string | null;
  status: string;
  travel_distance_km?: number | null;
  travel_fee?: number | null;
  patients: {
    id: string;
    name: string;
    species: string;
    tutors: {
      name: string;
      address?: string | null;
      phone?: string | null;
    } | null;
  } | null;
}

export interface Patient {
  id: string;
  name: string;
  species: string;
  tutors: {
    name?: string;
    address: string | null;
    phone?: string | null;
  } | null;
}

interface AgendaClientProps {
  initialConsultations: Consultation[];
  patients: Patient[];
}

type ViewType = 'day' | 'week' | 'month' | 'year';

function parseYmd(ymd: string): { year: number; month: number; day: number } {
  const [year, month, day] = ymd.split('-').map(Number);
  return { year, month, day };
}

function formatYmd(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().split('T')[0];
}

function addDaysYmd(ymd: string, deltaDays: number): string {
  const { year, month, day } = parseYmd(ymd);
  return formatYmd(year, month, day + deltaDays);
}

function addMonthsYmd(ymd: string, deltaMonths: number): string {
  const { year, month, day } = parseYmd(ymd);
  const targetMonthIndex = month - 1 + deltaMonths;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const maxDay = new Date(Date.UTC(targetYear, normalizedMonthIndex + 1, 0)).getUTCDate();
  return formatYmd(targetYear, normalizedMonthIndex + 1, Math.min(day, maxDay));
}

function addYearsYmd(ymd: string, deltaYears: number): string {
  const { year, month, day } = parseYmd(ymd);
  const targetYear = year + deltaYears;
  const maxDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return formatYmd(targetYear, month, Math.min(day, maxDay));
}

function getDayOfWeekYmd(ymd: string): number {
  const { year, month, day } = parseYmd(ymd);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function getConsultationBrazilDate(dateStr: string): string {
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return '';
  return getBrazilDateString(parsed);
}

export function AgendaClient({ initialConsultations, patients }: AgendaClientProps) {
  const [view, setView] = useState<ViewType>('day');
  const [currentDateStr, setCurrentDateStr] = useState<string>(() => getBrazilDateString());
  const todayBrtStr = getBrazilDateString();
  const [editingConsultation, setEditingConsultation] = useState<Consultation | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [menuConsultation, setMenuConsultation] = useState<Consultation | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [pressingConsultationId, setPressingConsultationId] = useState<string | null>(null);
  const [consultationToDelete, setConsultationToDelete] = useState<Consultation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastMenuTriggerRef = useRef<HTMLElement | null>(null);
  const triggerButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const router = useRouter();
  const { success, error } = useToast();

  const openMenuForConsultation = useCallback(
    (x: number, y: number, consult: Consultation, triggerEl?: HTMLElement | null) => {
      lastMenuTriggerRef.current = triggerEl ?? triggerButtonRefs.current[consult.id] ?? null;
      setMenuPosition({ x, y });
      setMenuConsultation(consult);
      setPressingConsultationId(null);
      if (window.navigator.vibrate) window.navigator.vibrate(50);
    },
    []
  );

  const handleStartPress = useCallback(
    (e: React.MouseEvent | React.TouchEvent, consult: Consultation) => {
      if (consult.status === 'Completed') return;
      if ((e.target as HTMLElement).closest('button, a')) return;

      const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const y = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

      setPressingConsultationId(consult.id);
      longPressTimer.current = setTimeout(() => {
        openMenuForConsultation(x, y, consult);
      }, 500);
    },
    [openMenuForConsultation]
  );

  const handleEndPress = useCallback(() => {
    setPressingConsultationId(null);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleCloseMenu = useCallback(() => {
    setMenuConsultation(null);
    setMenuPosition(null);
  }, []);

  const handleCancelAction = async () => {
    if (!consultationToDelete) return;
    setIsDeleting(true);
    try {
      const result = await cancelarConsulta(consultationToDelete.id);
      if (result.success) {
        success('Consulta cancelada com sucesso.');
        setConsultationToDelete(null);
        setMenuConsultation(null);
        router.refresh();
      } else {
        error(result.error);
      }
    } catch {
      error('Erro ao cancelar consulta.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePrevious = () => {
    if (view === 'day') setCurrentDateStr((prev) => addDaysYmd(prev, -1));
    else if (view === 'week') setCurrentDateStr((prev) => addDaysYmd(prev, -7));
    else if (view === 'month') setCurrentDateStr((prev) => addMonthsYmd(prev, -1));
    else if (view === 'year') setCurrentDateStr((prev) => addYearsYmd(prev, -1));
  };

  const handleNext = () => {
    if (view === 'day') setCurrentDateStr((prev) => addDaysYmd(prev, 1));
    else if (view === 'week') setCurrentDateStr((prev) => addDaysYmd(prev, 7));
    else if (view === 'month') setCurrentDateStr((prev) => addMonthsYmd(prev, 1));
    else if (view === 'year') setCurrentDateStr((prev) => addYearsYmd(prev, 1));
  };

  const getViewTitle = () => {
    if (view === 'day') {
      return formatBrazilDate(currentDateStr, { day: '2-digit', month: 'long' });
    } else if (view === 'week') {
      const dow = getDayOfWeekYmd(currentDateStr);
      const startStr = addDaysYmd(currentDateStr, -dow);
      const endStr = addDaysYmd(startStr, 6);
      return `${formatBrazilDate(startStr, {
        day: '2-digit',
        month: '2-digit',
      })} - ${formatBrazilDate(endStr, { day: '2-digit', month: '2-digit' })}`;
    } else if (view === 'month') {
      return formatBrazilDate(currentDateStr, { month: 'long', year: 'numeric' });
    } else {
      return String(parseYmd(currentDateStr).year);
    }
  };

  const filteredConsultations = useMemo(() => {
    const { year, month } = parseYmd(currentDateStr);

    return initialConsultations.filter((consult) => {
      const consultDateStr = getConsultationBrazilDate(consult.date);
      if (!consultDateStr) return false;

      if (view === 'day') {
        return consultDateStr === currentDateStr;
      } else if (view === 'week') {
        const dow = getDayOfWeekYmd(currentDateStr);
        const startStr = addDaysYmd(currentDateStr, -dow);
        const endStr = addDaysYmd(startStr, 6);
        return consultDateStr >= startStr && consultDateStr <= endStr;
      } else if (view === 'month') {
        const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
        return consultDateStr.startsWith(monthPrefix);
      } else {
        return consultDateStr.startsWith(`${year}-`);
      }
    });
  }, [view, currentDateStr, initialConsultations]);

  const handleDownloadPDF = async (id: string, docType: 'receita' | 'relatorio') => {
    setDownloadingPdf(`${id}-${docType}`);
    try {
      const data = await getConsultationDetails(id);
      const rawPrescriptions = data.prescriptions as
        | PrescriptionItem[]
        | { text?: string; items?: PrescriptionItem[] }
        | string
        | null;
      const structuredObj =
        rawPrescriptions && typeof rawPrescriptions === 'object' && !Array.isArray(rawPrescriptions)
          ? rawPrescriptions
          : null;
      const prescriptions: PrescriptionItem[] = Array.isArray(rawPrescriptions)
        ? rawPrescriptions
        : Array.isArray(structuredObj?.items)
        ? structuredObj.items
        : [];
      const prescriptionText: string | undefined =
        typeof rawPrescriptions === 'string'
          ? rawPrescriptions.trim() || undefined
          : typeof structuredObj?.text === 'string'
          ? structuredObj.text.trim() || undefined
          : undefined;

      const docPayload = {
        tutorName: data.patients?.tutors?.name || 'Não Informado',
        patientName: data.patients?.name || 'Não Informado',
        species: data.patients?.species || '',
        breed: data.patients?.breed || '',
        color: data.patients?.color || '',
        weight: data.weight_kg?.toString() || '',
        birthDate: data.patients?.birth_date || null,
        fertilityStatus: data.patients?.fertility_status || null,
        fertilityNotes: data.patients?.fertility_notes || null,
        clinicalObservations: data.patients?.clinical_observations || null,
        notes: data.clinical_notes || '',
        items: (data.consultation_items || [])
          .filter((ci: { inventory: { type: string } | null }) => ci.inventory?.type !== 'Consultation')
          .map((ci: { inventory: { name: string } | null; quantity: number }) => ({
            name: ci.inventory?.name || 'Item',
            quantity: ci.quantity,
          })),
        prescriptions,
        prescriptionText,
        date: data.date,
        vetName: data.profiles?.full_name || 'Dra. Gabriela Soares',
        vetCrmv: data.profiles?.crmv || '',
      };

      if (docType === 'relatorio') {
        await gerarPDFRelatorioAtendimento(docPayload);
        success('Relatório de Atendimento gerado com sucesso!');
      } else {
        await gerarPDFReceituario(docPayload);
        success('Receituário gerado com sucesso!');
      }
    } catch (err) {
      console.error(err);
      error('Erro ao gerar PDF');
    } finally {
      setDownloadingPdf(null);
    }
  };

  const weekDays = useMemo(() => {
    const days = [];
    const dow = getDayOfWeekYmd(currentDateStr);
    const weekStartStr = addDaysYmd(currentDateStr, -dow);

    for (let i = 0; i < 7; i++) {
      const dayStr = addDaysYmd(weekStartStr, i);
      const dayConsults = filteredConsultations.filter(
        (c) => getConsultationBrazilDate(c.date) === dayStr
      );
      days.push({ dateStr: dayStr, consultations: dayConsults });
    }
    return days;
  }, [currentDateStr, filteredConsultations]);

  const calendarDays = useMemo(() => {
    const { year, month } = parseYmd(currentDateStr);
    const firstOfMonthStr = formatYmd(year, month, 1);
    const startDay = getDayOfWeekYmd(firstOfMonthStr);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastOfMonthStr = formatYmd(year, month, daysInMonth);

    const days = [];
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ dateStr: addDaysYmd(firstOfMonthStr, -i - 1), currentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        dateStr: formatYmd(year, month, i),
        currentMonth: true,
      });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ dateStr: addDaysYmd(lastOfMonthStr, i), currentMonth: false });
    }
    return days;
  }, [currentDateStr]);

  const yearMonths = useMemo(() => {
    const { year } = parseYmd(currentDateStr);
    return Array.from({ length: 12 }, (_, i) => {
      const monthStr = formatYmd(year, i + 1, 1);
      return {
        monthStr,
        monthPrefix: monthStr.slice(0, 7),
      };
    });
  }, [currentDateStr]);

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      {editingConsultation && (
        <ScheduleConsultationForm
          key={editingConsultation.id}
          patients={patients}
          itemToEdit={editingConsultation}
          isOpenControlled={!!editingConsultation}
          onClose={() => setEditingConsultation(null)}
        />
      )}

      {/* Header & Controls */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-3xl font-extrabold text-foreground">Agenda</h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <ScheduleConsultationForm patients={patients} />
            <Link href="/" className={buttonClasses('secondary', 'px-4! py-2! text-sm')}>
              Voltar
            </Link>
          </div>
        </div>

        {/* View Switcher & Navigation */}
        <div className="flex flex-col md:flex-row items-center gap-4 bg-foreground/5 p-2 rounded-3xl shadow-inner border border-border">
          <div
            role="group"
            aria-label="Visualização da agenda"
            className="flex p-1 bg-background rounded-full shadow-sm border border-border w-full md:w-auto gap-1"
          >
            {(['day', 'week', 'month', 'year'] as ViewType[]).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={`flex-1 md:flex-none min-h-[44px] px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-widest transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  view === v
                    ? 'bg-primary text-primary-foreground shadow-sm border border-border'
                    : 'text-foreground/75 hover:text-foreground hover:bg-foreground/5'
                }`}
              >
                {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : v === 'month' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto w-full md:w-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={handlePrevious}
              aria-label="Período anterior"
              className="w-11 h-11 p-0! rounded-full! shadow-sm border border-border-strong shrink-0 flex items-center justify-center"
            >
              <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCurrentDateStr(getBrazilDateString())}
              className="text-[11px] font-black uppercase tracking-widest px-4 flex-1 md:flex-none min-w-[120px]"
            >
              {view === 'day' && currentDateStr === todayBrtStr ? 'Hoje' : getViewTitle()}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleNext}
              aria-label="Próximo período"
              className="w-11 h-11 p-0! rounded-full! shadow-sm border border-border-strong shrink-0 flex items-center justify-center"
            >
              <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Button>
          </div>
        </div>
      </div>

      {/* Consultations Content */}
      <div className="flex flex-col gap-6">
        {filteredConsultations.length === 0 && view === 'day' ? (
          <Card className="text-center py-20 flex flex-col items-center gap-4 bg-background/40">
            <div aria-hidden="true" className="w-20 h-20 bg-foreground/5 rounded-full flex items-center justify-center text-4xl">
              📅
            </div>
            <p className="text-muted-foreground font-bold text-lg italic">
              Nenhuma consulta encontrada para este dia.
            </p>
          </Card>
        ) : (
          <>
            {view === 'day' && (
              <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {filteredConsultations.map((consult) => {
                  const isCompleted = consult.status === 'Completed';
                  const effectiveAddress =
                    consult.address?.trim() || consult.patients?.tutors?.address?.trim() || null;

                  return (
                    <Card
                      key={consult.id}
                      className={`relative flex flex-col sm:flex-row justify-between items-center gap-6 border-l-8 overflow-hidden border border-border transition-all duration-300 ${
                        isCompleted
                          ? 'border-emerald-500/50 bg-emerald-500/3'
                          : `border-primary shadow-lg shadow-primary/5 hover:shadow-sm ${
                              pressingConsultationId === consult.id
                                ? 'bg-primary/5 scale-[0.98] border-primary/40'
                                : ''
                            }`
                      }`}
                      onMouseDown={(e) => handleStartPress(e, consult)}
                      onMouseUp={handleEndPress}
                      onMouseLeave={handleEndPress}
                      onTouchStart={(e) => handleStartPress(e, consult)}
                      onTouchEnd={handleEndPress}
                    >
                      {!isCompleted && (
                        <button
                          ref={(el) => {
                            triggerButtonRefs.current[consult.id] = el;
                          }}
                          type="button"
                          aria-label={`Ações para ${consult.patients?.name || 'consulta'}`}
                          aria-haspopup="menu"
                          aria-expanded={menuConsultation?.id === consult.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX || rect.right - 180;
                            const y = e.clientY || rect.bottom + 4;
                            openMenuForConsultation(x, y, consult, e.currentTarget);
                          }}
                          className="absolute top-2 right-2 sm:top-3 sm:right-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-foreground/10 transition-colors text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary z-20"
                        >
                          <MoreVertical aria-hidden="true" className="w-5 h-5" />
                        </button>
                      )}

                      <div className={`flex items-center gap-4 sm:gap-6 w-full min-w-0 ${!isCompleted ? 'pr-10 sm:pr-0' : ''}`}>
                        <div
                          className={`flex flex-col items-center justify-center min-w-[80px] p-3 rounded-2xl bg-card shadow-sm border border-border shrink-0 ${
                            isCompleted ? 'bg-emerald-500/10 border-emerald-500/20' : ''
                          }`}
                        >
                          <span
                            className={`text-[11px] font-black uppercase ${
                              isCompleted ? 'text-emerald-700 dark:text-emerald-300' : 'text-primary'
                            }`}
                          >
                            <LocalDate date={consult.date} format="date" />
                          </span>
                          <span className="text-xl font-black text-foreground">
                            <LocalDate date={consult.date} format="time" />
                          </span>
                        </div>

                        <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl font-extrabold text-foreground truncate">
                              {consult.patients?.name}
                            </h2>
                            {isCompleted && (
                              <span className="flex items-center gap-1 text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                                <span aria-hidden="true">✓</span> Realizada
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-bold text-muted-foreground truncate">
                            {translateSpecies(consult.patients?.species || '')} • Tutor:{' '}
                            {consult.patients?.tutors?.name}
                          </span>
                          <div className="mt-3 bg-foreground/10 p-3 rounded-2xl flex flex-col gap-2 border border-foreground/5">
                            <div className="flex flex-wrap gap-2">
                              <span
                                className={`w-fit text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                                  consult.type === 'Home'
                                    ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30'
                                    : 'bg-primary/15 text-primary border-primary/30'
                                }`}
                              >
                                <span aria-hidden="true">
                                  {consult.type === 'Home' ? '🏠 ' : '🏥 '}
                                </span>
                                {consult.type === 'Home' ? 'Domicílio' : 'Hospital'}
                              </span>
                              {consult.travel_fee && Number(consult.travel_fee) > 0 ? (
                                <span className="w-fit text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                  <span aria-hidden="true">🚗 </span>
                                  Deslocamento: R$ {Number(consult.travel_fee).toFixed(2)}
                                </span>
                              ) : null}
                            </div>
                            {effectiveAddress && (
                              <span className="text-xs text-foreground/80 font-medium truncate w-full flex items-center gap-1.5 px-1">
                                <span aria-hidden="true" className="text-primary">📍</span>
                                <span>{effectiveAddress}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={`flex flex-wrap sm:flex-col gap-2 w-full sm:w-auto mt-2 sm:mt-0 shrink-0 ${!isCompleted ? 'sm:pr-10' : ''}`}>
                        {consult.type === 'Home' && effectiveAddress && (
                          <div className="flex flex-col gap-1.5 w-full">
                            <div className="flex gap-1.5 w-full">
                              <a
                                href={buildGoogleMapsUrl(effectiveAddress)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 text-orange-700 dark:text-orange-300 border border-orange-500/30 text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                title="Abrir no Google Maps"
                              >
                                <span aria-hidden="true">🗺️</span>
                                <span>Maps</span>
                                <span className="sr-only"> (abre em nova aba)</span>
                              </a>
                              <a
                                href={buildWazeUrl(effectiveAddress)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/30 text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                title="Navegar com Waze"
                              >
                                <span aria-hidden="true">🚙</span>
                                <span>Waze</span>
                                <span className="sr-only"> (abre em nova aba)</span>
                              </a>
                            </div>

                            {!isCompleted && consult.patients?.tutors?.phone && (
                              <a
                                href={buildWhatsAppOnMyWayUrl({
                                  phone: consult.patients.tutors.phone,
                                  tutorName: consult.patients.tutors.name,
                                  patientName: consult.patients.name,
                                  address: effectiveAddress,
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white text-xs font-black flex items-center justify-center gap-1.5 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                              >
                                <span aria-hidden="true">🚗</span>
                                <span>Avisar a Caminho</span>
                                <span className="sr-only"> (abre em nova aba)</span>
                              </a>
                            )}
                          </div>
                        )}

                        {isCompleted ? (
                          <div className="flex flex-wrap gap-2 w-full">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => handleDownloadPDF(consult.id, 'relatorio')}
                              disabled={downloadingPdf === `${consult.id}-relatorio`}
                              className="flex-1 px-4! py-2! text-xs shadow-sm flex items-center justify-center gap-1.5"
                            >
                              {downloadingPdf === `${consult.id}-relatorio` ? (
                                'Gerando...'
                              ) : (
                                <>
                                  <span aria-hidden="true">📄</span>
                                  <span>Relatório</span>
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="info"
                              onClick={() => handleDownloadPDF(consult.id, 'receita')}
                              disabled={downloadingPdf === `${consult.id}-receita`}
                              className="flex-1 px-4! py-2! text-xs shadow-sm flex items-center justify-center gap-1.5"
                            >
                              {downloadingPdf === `${consult.id}-receita` ? (
                                'Gerando...'
                              ) : (
                                <>
                                  <span aria-hidden="true">💊</span>
                                  <span>Receita</span>
                                </>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2 w-full">
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => setEditingConsultation(consult)}
                              aria-label={`Editar consulta de ${consult.patients?.name || 'paciente'}`}
                              className="px-4! py-2! text-sm"
                            >
                              Editar
                            </Button>
                            <Link
                              href={`/prontuario?id=${consult.patients?.id}&type=Paciente&consultationId=${consult.id}&returnTo=agenda`}
                              className={buttonClasses('primary', 'flex-1 sm:flex-none px-6! py-2! text-sm shadow-sm')}
                            >
                              Atender
                            </Link>
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {view === 'week' && (
              <div className="grid grid-cols-1 md:grid-cols-7 gap-4 animate-in fade-in duration-500">
                {weekDays.map((d, i) => {
                  const isToday = d.dateStr === todayBrtStr;
                  const weekdayLabel = formatBrazilDate(d.dateStr, { weekday: 'short' }).replace('.', '');
                  const dayAriaLabel = `${formatBrazilDate(d.dateStr, {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                  })} — ${d.consultations.length} ${
                    d.consultations.length === 1 ? 'consulta' : 'consultas'
                  }`;

                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={dayAriaLabel}
                      onClick={() => {
                        setCurrentDateStr(d.dateStr);
                        setView('day');
                      }}
                      className={`bg-card rounded-2xl shadow-sm p-4 flex flex-col items-center gap-3 transition-all cursor-pointer hover:shadow-sm border border-border text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                        isToday ? 'border-2 border-primary/50' : ''
                      }`}
                    >
                      <span className="block text-center">
                        <span className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                          {weekdayLabel}
                        </span>
                        <span
                          className={`block text-xl font-black ${
                            isToday ? 'text-primary' : 'text-foreground'
                          }`}
                        >
                          {parseYmd(d.dateStr).day}
                        </span>
                      </span>

                      <span className="flex flex-col gap-2 w-full">
                        {d.consultations.length > 0 ? (
                          d.consultations.slice(0, 3).map((c) => {
                            const isComp = c.status === 'Completed';
                            return (
                              <span
                                key={c.id}
                                className={`block text-[10px] font-black p-2 rounded-lg truncate border ${
                                  isComp
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                    : 'bg-primary/10 text-primary border-primary/20'
                                }`}
                              >
                                {isComp ? '✓ ' : ''}
                                {formatBrazilDate(c.date, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hourCycle: 'h23',
                                })}{' '}
                                • {c.patients?.name}
                              </span>
                            );
                          })
                        ) : (
                          <span className="h-10 border border-dashed border-border-strong rounded-xl flex items-center justify-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                            Livre
                          </span>
                        )}
                        {d.consultations.length > 3 && (
                          <span className="block text-[10px] text-center font-black text-muted-foreground">
                            + {d.consultations.length - 3} mais
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {view === 'month' && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-500">
                <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center px-1 sm:px-4">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
                    <span
                      key={d}
                      className="text-[11px] font-black text-muted-foreground uppercase tracking-widest"
                    >
                      {d}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-2">
                  {calendarDays.map((d, i) => {
                    const consults = filteredConsultations.filter(
                      (c) => getConsultationBrazilDate(c.date) === d.dateStr
                    );
                    const isToday = d.dateStr === todayBrtStr;
                    const dateLabel = `${formatBrazilDate(d.dateStr, {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}${
                      consults.length > 0
                        ? `, ${consults.length} ${consults.length === 1 ? 'consulta' : 'consultas'}`
                        : ''
                    }`;

                    return (
                      <button
                        key={i}
                        type="button"
                        aria-label={dateLabel}
                        onClick={() => {
                          setCurrentDateStr(d.dateStr);
                          setView('day');
                        }}
                        className={`min-h-[44px] sm:aspect-square p-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                          isToday
                            ? 'bg-primary/10 border-2 border-primary/40'
                            : d.currentMonth
                            ? 'bg-foreground/5 hover:shadow-sm shadow-inner border border-border'
                            : 'bg-foreground/[0.02] border border-border/50'
                        }`}
                      >
                        <span
                          className={`text-xs font-black ${
                            isToday
                              ? 'text-primary'
                              : d.currentMonth
                              ? 'text-foreground'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {parseYmd(d.dateStr).day}
                        </span>
                        {consults.length > 0 && (
                          <div
                            aria-hidden="true"
                            className="flex gap-0.5 flex-wrap justify-center max-w-[80%]"
                          >
                            {consults.slice(0, 3).map((c, idx) => (
                              <div
                                key={idx}
                                className={`w-1.5 h-1.5 rounded-full ${
                                  c.status === 'Completed' ? 'bg-emerald-600' : 'bg-primary'
                                }`}
                              />
                            ))}
                            {consults.length > 3 && (
                              <div className="text-[8px] font-black text-primary">+</div>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {view === 'year' && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in duration-500">
                {yearMonths.map((m, i) => {
                  const count = initialConsultations.filter((c) =>
                    getConsultationBrazilDate(c.date).startsWith(m.monthPrefix)
                  ).length;
                  const shortMonth = formatBrazilDate(m.monthStr, { month: 'short' }).replace('.', '');
                  const fullMonth = formatBrazilDate(m.monthStr, { month: 'long', year: 'numeric' });

                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`${fullMonth} — ${count} ${count === 1 ? 'consulta' : 'consultas'}`}
                      onClick={() => {
                        setCurrentDateStr(m.monthStr);
                        setView('month');
                      }}
                      className="bg-card rounded-2xl shadow-sm p-6 flex flex-col items-center gap-4 cursor-pointer hover:shadow-sm border border-border group transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <span className="block text-sm font-black text-primary uppercase tracking-[0.2em]">
                        {shortMonth}
                      </span>
                      <span className="flex flex-col items-center bg-foreground/5 shadow-inner border border-border p-4 rounded-3xl w-full">
                        <span className="text-3xl font-black text-foreground group-hover:scale-110 transition-transform">
                          {count}
                        </span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                          Consultas
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <ContextMenu
        isOpen={!!menuConsultation && !!menuPosition}
        onClose={handleCloseMenu}
        position={menuPosition}
        ariaLabel={
          menuConsultation
            ? `Ações para consulta de ${menuConsultation.patients?.name || 'paciente'}`
            : 'Ações da consulta'
        }
        triggerRef={lastMenuTriggerRef}
        items={
          menuConsultation
            ? [
                {
                  id: 'edit',
                  label: 'Editar Consulta',
                  icon: <Edit2 className="w-4 h-4" />,
                  onSelect: () => setEditingConsultation(menuConsultation),
                },
                {
                  id: 'cancel',
                  label: 'Cancelar Consulta',
                  icon: <Trash2 className="w-4 h-4" />,
                  tone: 'danger',
                  onSelect: () => setConsultationToDelete(menuConsultation),
                },
              ]
            : []
        }
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!consultationToDelete}
        onClose={() => !isDeleting && setConsultationToDelete(null)}
        title="Cancelar Consulta"
        role="alertdialog"
        showCloseButton={false}
      >
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="text-6xl" aria-hidden="true">
            ⚠️
          </div>

          <div className="text-center space-y-4">
            <p className="text-foreground/80 font-medium text-lg leading-relaxed">
              Você está prestes a cancelar a consulta de{' '}
              <span className="text-foreground font-black italic">
                &quot;{consultationToDelete?.patients?.name}&quot;
              </span>
              .
            </p>

            <div className="bg-error/5 border-2 border-error/20 p-5 rounded-2xl">
              <p className="text-error text-sm font-black leading-tight uppercase tracking-wide">
                Esta ação removerá o agendamento da sua agenda. Você poderá agendá-lo novamente
                depois se desejar.
              </p>
            </div>
          </div>

          <div className="flex flex-col w-full gap-3 mt-4">
            <Button
              type="button"
              variant="danger"
              onClick={handleCancelAction}
              disabled={isDeleting}
              className="w-full py-4! rounded-2xl shadow-lg shadow-error/20"
            >
              {isDeleting ? 'CANCELANDO...' : 'SIM, CANCELAR CONSULTA'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConsultationToDelete(null)}
              disabled={isDeleting}
              className="w-full py-4! rounded-2xl uppercase tracking-widest text-[10px]"
            >
              NÃO, MANTER CONSULTA
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
