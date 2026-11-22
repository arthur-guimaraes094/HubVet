import { requireSession } from '@/infrastructure/auth/session';
import { ConsultationForm } from '@/components/features/ConsultationForm';
import { buttonClasses } from '@/components/ui/Button';
import Link from 'next/link';
import { ViewTransition } from "react";
import { z } from 'zod';
import { formatFullAddress } from '@/core/utils/cep';

export const revalidate = 0;

export default async function ProntuarioPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; type?: string; patient?: string; consultationId?: string; returnTo?: string }>
}) {
  const params = await searchParams;
  const { supabase, userId } = await requireSession();

  const rawConsultationId = params?.consultationId;
  const validConsultationId =
    rawConsultationId && z.uuid().safeParse(rawConsultationId).success
      ? rawConsultationId
      : undefined;
  const rawExplicitPatientId = params?.id || params?.patient;
  const explicitPatientId =
    rawExplicitPatientId && z.uuid().safeParse(rawExplicitPatientId).success
      ? rawExplicitPatientId
      : undefined;
  const targetType = params?.type || 'Paciente';
  const returnTo = params?.returnTo;

  const [
    { data: rawInventory },
    { data: profileData },
    consultRes,
    explicitPatientRes,
  ] = await Promise.all([
    supabase.from('inventory').select('*').eq('profile_id', userId).order('name'),
    supabase
      .from('profiles')
      .select('full_name, crmv, pix_key, pix_key_type')
      .eq('id', userId)
      .single(),
    validConsultationId
      ? supabase
          .from('consultations')
          .select('*')
          .eq('id', validConsultationId)
          .eq('profile_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    explicitPatientId && targetType === 'Paciente'
      ? supabase
          .from('patients')
          .select('*, tutors!inner(*)')
          .eq('id', explicitPatientId)
          .eq('tutors.profile_id', userId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const p = profileData as Record<string, unknown> | null;
  const vetName = (p?.full_name as string) || undefined;
  const vetCrmv = (p?.crmv as string) || undefined;
  const vetPixKey = (p?.pix_key as string) || undefined;
  const vetPixKeyType = (p?.pix_key_type as string) || undefined;

  const inventory = rawInventory?.map(item => ({
    id: item.id,
    name: item.name,
    type: item.type as 'Medication' | 'Vaccine' | 'Supply' | 'Material' | 'Consultation',
    concentration: item.concentration || undefined,
    unitCost: item.unit_cost,
    salePrice: item.sale_price
  })) || [];

  const scheduledConsultation: {
    id: string;
    patient_id: string | null;
    type: string | null;
    address: string | null;
    travel_distance_km?: number | null;
    travel_fee?: number | null;
    clinical_notes: string | null;
    weight_kg: number | null;
    prescriptions?: unknown;
  } | null = consultRes.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let patientData: any = explicitPatientRes.data ?? null;
  if (!explicitPatientId && scheduledConsultation?.patient_id && targetType === 'Paciente') {
    const fallbackPatientId = z.uuid().safeParse(scheduledConsultation.patient_id).success
      ? scheduledConsultation.patient_id
      : undefined;
    if (fallbackPatientId) {
      const { data } = await supabase
        .from('patients')
        .select('*, tutors!inner(*)')
        .eq('id', fallbackPatientId)
        .eq('tutors.profile_id', userId)
        .maybeSingle();
      patientData = data ?? null;
    }
  }

  const tutorObj = Array.isArray(patientData?.tutors)
    ? patientData.tutors[0]
    : patientData?.tutors;

  const tutorAddress = tutorObj
    ? tutorObj.address ||
      formatFullAddress({
        street: tutorObj.street,
        number: tutorObj.number,
        complement: tutorObj.complement,
        neighborhood: tutorObj.neighborhood,
        city: tutorObj.city,
        state: tutorObj.state,
        cep: tutorObj.cep,
      })
    : undefined;

  const initialPrescriptionText =
    typeof scheduledConsultation?.prescriptions === 'string'
      ? scheduledConsultation.prescriptions
      : (scheduledConsultation?.prescriptions as { text?: string })?.text || undefined;

  return (
    <ViewTransition enter="fade-in" default="none">
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col p-4 sm:p-8 gap-6 w-full max-w-4xl mx-auto outline-none"
      >
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-extrabold text-foreground">Prontuário</h1>
          <Link
            href={
              returnTo === 'agenda'
                ? '/agenda'
                : returnTo === 'history' && patientData?.id
                ? `/pacientes/${patientData.id}`
                : '/'
            }
            className={buttonClasses('secondary', 'px-4! py-2! text-sm')}
          >
            Voltar
          </Link>
        </div>

        <ConsultationForm
          key={`${patientData?.id || 'none'}-${scheduledConsultation?.id || 'new'}`}
          inventory={inventory || []}
          patientId={patientData?.id}
          patientName={patientData?.name}
          tutorName={tutorObj?.name}
          tutorPhone={tutorObj?.phone}
          tutorAddress={scheduledConsultation?.address || tutorAddress || undefined}
          species={patientData?.species}
          breed={patientData?.breed || undefined}
          color={patientData?.color || undefined}
          birthDate={patientData?.birth_date || undefined}
          fertilityStatus={patientData?.fertility_status || undefined}
          fertilityNotes={patientData?.fertility_notes || undefined}
          clinicalObservations={patientData?.clinical_observations || undefined}
          consultationId={scheduledConsultation?.id}
          lastWeight={scheduledConsultation?.weight_kg || patientData?.weight_kg || undefined}
          initialType={(scheduledConsultation?.type as 'Home' | 'Hospital') || 'Home'}
          initialTravelFee={scheduledConsultation?.travel_fee ?? undefined}
          initialTravelDistanceKm={scheduledConsultation?.travel_distance_km ?? undefined}
          initialNotes={scheduledConsultation?.clinical_notes || undefined}
          initialPrescriptionText={initialPrescriptionText}
          vetName={vetName}
          vetCrmv={vetCrmv}
          pixKey={vetPixKey}
          pixKeyType={vetPixKeyType}
        />
      </main>
    </ViewTransition>
  );
}
