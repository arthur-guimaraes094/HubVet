import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { QuickSearch } from "@/components/features/QuickSearch";
import { VaccineAlertsCard, UpcomingVaccineItem } from "@/components/features/VaccineAlertsCard";
import Link from "next/link";
import Image from "next/image";
import { ViewTransition } from "react";
import { requireSession } from "@/infrastructure/auth/session";
import { signStorageUrl } from "@/infrastructure/storage/media";
import { getBrazilDateString } from "@/core/utils/timezone";

import { SettingsModal } from "@/components/features/SettingsModal";

export default async function Home() {
  const { supabase, userId } = await requireSession();
  const in14DaysStr = getBrazilDateString(new Date(), 14);

  const [profileRes, vaccinesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .single(),
    supabase
      .from('patient_vaccinations')
      .select('id, patient_id, vaccine_name, next_due_date, next_dose_label, patients(id, name, tutors(name, phone))')
      .eq('profile_id', userId)
      .is('completed_by_vaccination_id', null)
      .lte('next_due_date', in14DaysStr)
      .order('next_due_date', { ascending: true })
      .limit(10),
  ]);

  const avatarUrl = profileRes.data?.avatar_url
    ? await signStorageUrl(supabase, profileRes.data.avatar_url, 'avatars')
    : null;

  const upcomingVaccines: UpcomingVaccineItem[] = [];
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

  return (
    <ViewTransition enter="fade-in" default="none">
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 gap-6 max-w-2xl mx-auto w-full outline-none"
      >
        <header className="flex items-center justify-between mb-4 w-full px-1 sm:px-2">
          <div className="text-left">
            <h1 className="text-5xl font-black tracking-tighter text-foreground mb-1">HubVet</h1>
            <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">
              Atendimentos Domiciliares
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <SettingsModal />
            <Link
              href="/perfil"
              aria-label="Abrir meu perfil"
              className="w-16 h-16 bg-background rounded-full shadow-sm border border-border-strong flex items-center justify-center text-primary hover:shadow-inner bg-foreground/5 transition-all active:scale-95 cursor-pointer overflow-hidden p-1"
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-foreground/5 flex items-center justify-center">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Foto de perfil da veterinária"
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span aria-hidden="true" className="font-black text-xl tracking-tighter">
                    MV
                  </span>
                )}
              </div>
            </Link>
          </div>
        </header>

        <VaccineAlertsCard vaccines={upcomingVaccines} />

        <Card className="w-full flex flex-col gap-6 sm:gap-8 p-5 sm:p-10 bg-background/40">
          <QuickSearch />
          
          <nav aria-label="Acesso rápido" className="grid grid-cols-2 gap-3 sm:gap-4 mt-2">
            <Link href="/agenda" className={buttonClasses("primary", "w-full py-4! shadow-sm")}>
              Agenda
            </Link>
            <Link href="/pacientes" className={buttonClasses("secondary", "w-full py-4!")}>
              Pacientes
            </Link>
            <Link href="/tutores" className={buttonClasses("secondary", "w-full py-4!")}>
              Tutores
            </Link>
            <Link href="/financeiro" className={buttonClasses("secondary", "w-full py-4!")}>
              Financeiro
            </Link>
            <Link href="/estoque" className={buttonClasses("secondary", "w-full py-4!")}>
              Maleta
            </Link>
            <Link href="/calculadora" className={buttonClasses("secondary", "w-full py-4!")}>
              Calculadora
            </Link>
          </nav>
        </Card>
      </main>
    </ViewTransition>
  );
}
