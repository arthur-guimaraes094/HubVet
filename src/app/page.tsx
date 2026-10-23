import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { QuickSearch } from "@/components/features/QuickSearch";
import { VaccineAlertsCard, UpcomingVaccineItem } from "@/components/features/VaccineAlertsCard";
import Link from "next/link";
import Image from "next/image";
import { createClient } from '@/infrastructure/database/server';
import { ViewTransition } from "react";

import { SettingsModal } from "@/components/features/SettingsModal";

export default async function Home() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  let avatarUrl = null;
  const upcomingVaccines: UpcomingVaccineItem[] = [];

  if (session?.user) {
    const in14Days = new Date();
    in14Days.setDate(in14Days.getDate() + 14);
    const in14DaysStr = in14Days.toISOString().split('T')[0];

    const [profileRes, vaccinesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', session.user.id)
        .single(),
      supabase
        .from('patient_vaccinations')
        .select('id, patient_id, vaccine_name, next_due_date, next_dose_label, patients(id, name, tutors(name, phone))')
        .eq('profile_id', session.user.id)
        .is('completed_by_vaccination_id', null)
        .lte('next_due_date', in14DaysStr)
        .order('next_due_date', { ascending: true })
        .limit(10),
    ]);
      
    if (profileRes.data?.avatar_url) {
      avatarUrl = profileRes.data.avatar_url;
    }

    if (vaccinesRes.data && vaccinesRes.data.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vaccinesRes.data.forEach((v: any) => {
        const patientObj = Array.isArray(v.patients) ? v.patients[0] : v.patients;
        const tutorObj = Array.isArray(patientObj?.tutors)
          ? patientObj.tutors[0]
          : patientObj?.tutors;

        if (patientObj) {
          upcomingVaccines.push({
            id: v.id,
            patientId: v.patient_id,
            patientName: patientObj.name || 'Paciente',
            tutorName: tutorObj?.name || 'Tutor(a)',
            tutorPhone: tutorObj?.phone || null,
            vaccineName: v.vaccine_name,
            nextDueDate: v.next_due_date,
            nextDoseLabel: v.next_dose_label || 'Reforço Vacinal',
          });
        }
      });
    }
  }

  return (
    <ViewTransition enter="fade-in" default="none">
      <main className="flex-1 flex flex-col items-center justify-center p-8 gap-6 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4 w-full px-2">
          <div className="text-left">
            <h1 className="text-5xl font-black tracking-tighter text-foreground mb-1">HubVet</h1>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-80">
              Atendimentos Domiciliares
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <SettingsModal />
            <Link href="/perfil" className="w-16 h-16 bg-background rounded-full shadow-sm border border-border flex items-center justify-center text-primary hover:shadow-inner bg-foreground/5 transition-all active:scale-95 cursor-pointer border border-foreground/[0.03] overflow-hidden p-1">
              <div className="w-full h-full rounded-full overflow-hidden bg-foreground/5 flex items-center justify-center">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt="Perfil" width={64} height={64} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-black text-xl tracking-tighter">MV</span>
                )}
              </div>
            </Link>
          </div>
        </div>

        <VaccineAlertsCard vaccines={upcomingVaccines} />

        <Card className="w-full flex flex-col gap-8 p-10 bg-background/40">
          <QuickSearch />
          
          <div className="grid grid-cols-2 gap-4 mt-2">
            <Link href="/agenda" className="w-full">
              <Button variant="primary" className="w-full py-4! shadow-sm border border-border hover:shadow-sm">Agenda</Button>
            </Link>
            <Link href="/pacientes" className="w-full">
              <Button variant="secondary" className="w-full py-4!">Pacientes</Button>
            </Link>
            <Link href="/tutores" className="w-full">
              <Button variant="secondary" className="w-full py-4!">Tutores</Button>
            </Link>
            <Link href="/financeiro" className="w-full">
              <Button variant="secondary" className="w-full py-4!">Financeiro</Button>
            </Link>
            <Link href="/estoque" className="w-full">
              <Button variant="secondary" className="w-full py-4!">Maleta</Button>
            </Link>
            <Link href="/calculadora" className="w-full">
              <Button variant="secondary" className="w-full py-4!">Calculadora</Button>
            </Link>
          </div>
        </Card>
      </main>
    </ViewTransition>
  );
}
