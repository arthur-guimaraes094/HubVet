"use client";

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LocalDate } from '@/components/ui/LocalDate';
import Link from 'next/link';
import { ScheduleConsultationForm } from './ScheduleConsultationForm';
import { getConsultationDetails } from '@/app/agenda/actions';
import { gerarPDFReceituario } from '@/core/use-cases/generate-pdf';
import { useToast } from '@/components/ui/Toast';
import { translateSpecies } from '@/core/utils/translations';

export interface Consultation {
  id: string;
  date: string;
  type: string;
  address: string | null;
  status: string;
  patients: {
    id: string;
    name: string;
    species: string;
    tutors: {
      name: string;
    } | null;
  } | null;
}

export interface Patient {
  id: string;
  name: string;
  species: string;
  tutors: {
    address: string | null;
  } | null;
}

interface AgendaClientProps {
  initialConsultations: Consultation[];
  patients: Patient[];
}

type ViewType = 'day' | 'week' | 'month' | 'year';

export function AgendaClient({ initialConsultations, patients }: AgendaClientProps) {
  const [view, setView] = useState<ViewType>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingConsultation, setEditingConsultation] = useState<Consultation | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const { success, error } = useToast();

  const handlePrevious = () => {
    const next = new Date(currentDate);
    if (view === 'day') next.setDate(next.getDate() - 1);
    else if (view === 'week') next.setDate(next.getDate() - 7);
    else if (view === 'month') next.setMonth(next.getMonth() - 1);
    else if (view === 'year') next.setFullYear(next.getFullYear() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (view === 'day') next.setDate(next.getDate() + 1);
    else if (view === 'week') next.setDate(next.getDate() + 7);
    else if (view === 'month') next.setMonth(next.getMonth() + 1);
    else if (view === 'year') next.setFullYear(next.getFullYear() + 1);
    setCurrentDate(next);
  };

  const getViewTitle = () => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
    } else if (view === 'week') {
      const start = new Date(currentDate);
      start.setDate(currentDate.getDate() - currentDate.getDay());
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
    } else if (view === 'month') {
      return currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    } else {
      return currentDate.getFullYear().toString();
    }
  };

  const filteredConsultations = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (view === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'week') {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      
      end.setMonth(start.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'year') {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
    }

    return initialConsultations.filter(consult => {
      const consultDate = new Date(consult.date);
      return consultDate >= start && consultDate <= end;
    });
  }, [view, currentDate, initialConsultations]);

  const handleDownloadPDF = async (id: string) => {
    setDownloadingPdf(id);
    try {
      const data = await getConsultationDetails(id);
      
      gerarPDFReceituario({
        tutorName: data.patients?.tutors?.name || 'Não Informado',
        patientName: data.patients?.name || 'Não Informado',
        species: translateSpecies(data.patients?.species || ''),
        breed: data.patients?.breed || '',
        color: data.patients?.color || '',
        weight: data.weight_kg?.toString() || '',
        notes: data.clinical_notes || '',
        items: (data.consultation_items || [])
          .filter((ci: { inventory: { type: string } | null }) => ci.inventory?.type !== 'Consultation')
          .map((ci: { inventory: { name: string } | null, quantity: number }) => ({
            name: ci.inventory?.name || 'Item',
            quantity: ci.quantity
          })),
        date: data.date
      });
      success('PDF gerado com sucesso!');
    } catch (err) {
      console.error(err);
      error('Erro ao gerar PDF do prontuário');
    } finally {
      setDownloadingPdf(null);
    }
  };

  // Render Functions (instead of components inside render)
  const renderDayView = () => (
    <div className="grid grid-cols-1 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {filteredConsultations.map((consult) => {
        const isCompleted = consult.status === 'Completed';
        
        return (
          <Card 
            key={consult.id} 
            className={`cursor-pointer flex flex-col sm:flex-row justify-between items-center gap-6 border-l-8 overflow-hidden hover:shadow-sm border border-border transition-all duration-300 active:scale-[0.98] ${
              isCompleted 
                ? 'border-emerald-500/50 opacity-60 grayscale-[0.5]' 
                : 'border-primary'
            }`}
            onClick={() => setEditingConsultation(consult)}
          >
            <div className="flex items-center gap-4 sm:gap-6 w-full min-w-0 pointer-events-none">
              <div className={`flex flex-col items-center justify-center min-w-[80px] p-3 rounded-2xl bg-background shadow-sm border border-border border border-foreground/5 shrink-0 ${
                isCompleted ? 'bg-emerald-50/10' : ''
              }`}>
                <span className={`text-[10px] font-black uppercase ${isCompleted ? 'text-emerald-600' : 'text-primary'}`}>
                  <LocalDate date={consult.date} format="date" />
                </span>
                <span className="text-xl font-black text-foreground">
                  <LocalDate date={consult.date} format="time" />
                </span>
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-extrabold text-foreground truncate">{consult.patients?.name}</h3>
                  {isCompleted && (
                    <span className="flex items-center gap-1 text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-widest">
                      ✓ Realizada
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold text-foreground/60 truncate">
                  {consult.patients?.species} • Tutor: {consult.patients?.tutors?.name}
                </span>
                <div className="mt-2 flex flex-col gap-1">
                  <div className="flex flex-wrap gap-2">
                    <span className={`w-fit text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                      consult.type === 'Home' ? 'bg-orange-100/50 text-orange-600' : 'bg-primary/10 text-primary'
                    }`}>
                      {consult.type === 'Home' ? '🏠 Domicílio' : '🏥 Hospital'}
                    </span>
                    {isCompleted && (
                      <span className="w-fit text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                        Histórico Disponível
                      </span>
                    )}
                  </div>
                  {consult.address && (
                    <span className="text-xs text-foreground/50 font-medium italic truncate w-full flex items-center gap-1">
                      <span className="text-primary/40">📍</span> {consult.address}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-row gap-3 w-full sm:w-auto mt-2 sm:mt-0" onClick={(e) => e.stopPropagation()}>
              {isCompleted ? (
                <Button 
                  variant="secondary" 
                  onClick={() => handleDownloadPDF(consult.id)}
                  disabled={downloadingPdf === consult.id}
                  className="w-full !px-8 !py-2 text-sm shadow-sm border border-border border-emerald-200 text-emerald-700 flex items-center justify-center gap-2"
                >
                  {downloadingPdf === consult.id ? (
                    <>
                      <div className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Baixar PDF
                    </>
                  )}
                </Button>
              ) : (
                <Link href={`/prontuario?id=${consult.patients?.id}&type=Paciente&consultationId=${consult.id}&returnTo=agenda`} className="flex-1 sm:flex-none">
                  <Button variant="primary" className="w-full !px-8 !py-2 text-sm shadow-sm border border-border">
                    Atender
                  </Button>
                </Link>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );

  const renderWeekView = () => {
    const days = [];
    const start = new Date(currentDate);
    start.setDate(currentDate.getDate() - currentDate.getDay());

    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const dayConsults = filteredConsultations.filter(c => {
        const d = new Date(c.date);
        return d.getDate() === day.getDate() && d.getMonth() === day.getMonth() && d.getFullYear() === day.getFullYear();
      });

      days.push({ date: day, consultations: dayConsults });
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4 animate-in fade-in duration-500">
        {days.map((d, i) => (
          <Card 
            key={i} 
            onClick={() => { setCurrentDate(d.date); setView('day'); }}
            className={`p-4 flex flex-col items-center gap-3 transition-all cursor-pointer hover:shadow-sm border border-border ${
              d.date.toDateString() === new Date().toDateString() ? 'border-2 border-primary/30' : ''
            }`}
          >
            <div className="text-center">
              <span className="text-[10px] font-black text-foreground/40 uppercase tracking-widest">
                {d.date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
              </span>
              <div className={`text-xl font-black ${d.date.toDateString() === new Date().toDateString() ? 'text-primary' : 'text-foreground'}`}>
                {d.date.getDate()}
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full">
              {d.consultations.length > 0 ? (
                d.consultations.slice(0, 3).map(c => {
                  const isComp = c.status === 'Completed';
                  return (
                    <div key={c.id} className={`text-[10px] font-bold p-2 rounded-lg truncate border ${
                      isComp 
                        ? 'bg-emerald-50/50 text-emerald-600 border-emerald-100 opacity-60' 
                        : 'bg-primary/5 text-primary border-primary/10'
                    }`}>
                      {isComp ? '✓ ' : ''}{new Date(c.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • {c.patients?.name}
                    </div>
                  );
                })
              ) : (
                <div className="h-10 border border-dashed border-foreground/10 rounded-xl flex items-center justify-center text-[10px] text-foreground/20 font-bold uppercase tracking-widest">
                  Livre
                </div>
              )}
              {d.consultations.length > 3 && (
                <div className="text-[9px] text-center font-black text-foreground/30">+ {d.consultations.length - 3} mais</div>
              )}
            </div>
          </Card>
        ))}
      </div>
    );
  };

  const renderMonthView = () => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDay = startOfMonth.getDay();
    const daysInMonth = endOfMonth.getDate();

    const calendarDays = [];
    // Previous month filler
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(startOfMonth);
      d.setDate(d.getDate() - i - 1);
      calendarDays.push({ date: d, currentMonth: false });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      calendarDays.push({ date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i), currentMonth: true });
    }
    // Next month filler
    const remaining = 42 - calendarDays.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(endOfMonth);
      d.setDate(d.getDate() + i);
      calendarDays.push({ date: d, currentMonth: false });
    }

    return (
      <div className="flex flex-col gap-4 animate-in fade-in duration-500">
        <div className="grid grid-cols-7 gap-2 text-center px-4">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <span key={d} className="text-[10px] font-black text-foreground/30 uppercase tracking-widest">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((d, i) => {
            const consults = filteredConsultations.filter(c => {
              const dc = new Date(c.date);
              return dc.getDate() === d.date.getDate() && dc.getMonth() === d.date.getMonth() && dc.getFullYear() === d.date.getFullYear();
            });
            const isToday = d.date.toDateString() === new Date().toDateString();

            return (
              <button
                key={i}
                onClick={() => { setCurrentDate(d.date); setView('day'); }}
                className={`aspect-square p-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all group ${
                  d.currentMonth ? 'hover:shadow-sm border border-border' : 'opacity-20'
                } ${isToday ? 'bg-primary/5 border border-primary/20' : 'bg-background shadow-inner border border-border bg-gray-50/50'}`}
              >
                <span className={`text-xs font-black ${isToday ? 'text-primary' : d.currentMonth ? 'text-foreground' : 'text-foreground/40'}`}>
                  {d.date.getDate()}
                </span>
                {consults.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center max-w-[80%]">
                    {consults.slice(0, 3).map((c, idx) => (
                      <div 
                        key={idx} 
                        className={`w-1.5 h-1.5 rounded-full ${c.status === 'Completed' ? 'bg-emerald-500' : 'bg-primary animate-pulse'}`} 
                      />
                    ))}
                    {consults.length > 3 && <div className="text-[8px] font-black text-primary">+</div>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderYearView = () => {
    const months = Array.from({ length: 12 }, (_, i) => new Date(currentDate.getFullYear(), i, 1));
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 animate-in fade-in duration-500">
        {months.map((m, i) => {
          const count = initialConsultations.filter(c => {
            const d = new Date(c.date);
            return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear();
          }).length;

          return (
            <Card 
              key={i} 
              onClick={() => { setCurrentDate(m); setView('month'); }}
              className="p-6 flex flex-col items-center gap-4 cursor-pointer hover:shadow-sm border border-border group transition-all"
            >
              <div className="text-sm font-black text-primary uppercase tracking-[0.2em]">{m.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
              <div className="flex flex-col items-center bg-background shadow-inner border border-border bg-gray-50/50 p-4 rounded-3xl w-full">
                <span className="text-3xl font-black text-foreground group-hover:scale-110 transition-transform">{count}</span>
                <span className="text-[9px] font-bold text-foreground/40 uppercase tracking-widest mt-1">Consultas</span>
              </div>
            </Card>
          );
        })}
      </div>
    );
  };

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
            <Link href="/">
              <Button variant="secondary" className="!px-4 !py-2 text-sm">Voltar</Button>
            </Link>
          </div>
        </div>

        {/* View Switcher & Navigation */}
        <div className="flex flex-col md:flex-row items-center gap-4 bg-background/40 p-2 rounded-3xl shadow-inner border border-border bg-gray-50/50">
          <div className="flex p-1 bg-background rounded-full shadow-sm border border-border border border-foreground/5 w-full md:w-auto">
            {(['day', 'week', 'month', 'year'] as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex-1 md:flex-none px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                  view === v ? 'bg-primary text-white shadow-sm border border-border' : 'text-foreground/40 hover:text-foreground'
                }`}
              >
                {v === 'day' ? 'Dia' : v === 'week' ? 'Semana' : v === 'month' ? 'Mês' : 'Ano'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto w-full md:w-auto">
            <Button type="button" variant="secondary" onClick={handlePrevious} className="w-10 h-10 !p-0 !rounded-full shadow-sm border border-border shrink-0 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
              </svg>
            </Button>
            <Button 
              type="button"
              variant="secondary" 
              onClick={() => setCurrentDate(new Date())} 
              className="text-[10px] font-black uppercase tracking-widest px-4 flex-1 md:flex-none min-w-[120px]"
            >
              {(() => {
                const today = new Date();
                const isToday = view === 'day' && 
                  currentDate.getDate() === today.getDate() && 
                  currentDate.getMonth() === today.getMonth() && 
                  currentDate.getFullYear() === today.getFullYear();
                
                return isToday ? 'Hoje' : getViewTitle();
              })()}
            </Button>
            <Button type="button" variant="secondary" onClick={handleNext} className="w-10 h-10 !p-0 !rounded-full shadow-sm border border-border shrink-0 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </div>
      </div>

      {/* Consultations Content */}
      <div className="flex flex-col gap-6">
        {filteredConsultations.length === 0 && view === 'day' ? (
          <Card className="text-center py-20 flex flex-col items-center gap-4 bg-background/40">
            <div className="w-20 h-20 bg-foreground/5 rounded-full flex items-center justify-center text-4xl opacity-30">📅</div>
            <p className="text-foreground/40 font-bold text-lg italic">Nenhuma consulta encontrada para este dia.</p>
          </Card>
        ) : (
          <>
            {view === 'day' && renderDayView()}
            {view === 'week' && renderWeekView()}
            {view === 'month' && renderMonthView()}
            {view === 'year' && renderYearView()}
          </>
        )}
      </div>
    </div>
  );
}
