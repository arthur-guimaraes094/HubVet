import { ConsultationForm } from '@/components/features/ConsultationForm';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/infrastructure/database/server';
import Link from 'next/link';
import { ViewTransition } from "react";
import { formatFullAddress } from '@/core/utils/cep';

export const revalidate = 0;

export default async function ProntuarioPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; type?: string; patient?: string; consultationId?: string; returnTo?: string }>
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [
    { data: rawInventory },
    { data: userData }
  ] = await Promise.all([
    supabase.from('inventory').select('*').order('name'),
    supabase.auth.getUser(),
  ]);

  let vetName: string | undefined;
  let vetCrmv: string | undefined;
  if (userData?.user) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name, crmv')
      .eq('id', userData.user.id)
      .single();
    vetName = profileData?.full_name || undefined;
    vetCrmv = profileData?.crmv || undefined;
  }
  
  const inventory = rawInventory?.map(item => ({
    id: item.id,
    name: item.name,
    type: item.type as 'Medication' | 'Vaccine' | 'Material' | 'Consultation',
    concentration: item.concentration || undefined,
    unitCost: item.unit_cost,
    salePrice: item.sale_price
  })) || [];
  
  const consultationId = params?.consultationId;
  const returnTo = params?.returnTo;

  let scheduledConsultation: {
    id: string;
    patient_id: string | null;
    type: string | null;
    address: string | null;
    travel_distance_km?: number | null;
    travel_fee?: number | null;
    clinical_notes: string | null;
    weight_kg: number | null;
  } | null = null;

  if (consultationId) {
    const { data: consultData } = await supabase
      .from('consultations')
      .select('*')
      .eq('id', consultationId)
      .single();
    scheduledConsultation = consultData;
  }

  const targetId = params?.id || params?.patient || scheduledConsultation?.patient_id || undefined;
  const targetType = params?.type || (targetId ? 'Paciente' : null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let patientData: any = null;
  if (targetId && targetType === 'Paciente') {
    const { data } = await supabase
      .from('patients')
      .select('*, tutors(*)')
      .eq('id', targetId)
      .single();
    patientData = data;
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

  return (
    <ViewTransition enter="fade-in" default="none">
      <main className="flex-1 flex flex-col p-4 sm:p-8 gap-6 w-full max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold text-foreground">Prontuário</h1>
          <Link href={
            returnTo === 'agenda' ? '/agenda' : 
            returnTo === 'history' ? `/pacientes/${targetId}` : 
            '/'
          }>
            <Button variant="secondary" className="px-4! py-2! text-sm">Voltar</Button>
          </Link>
        </div>

        <ConsultationForm 
          inventory={inventory || []} 
          patientId={patientData?.id} 
          patientName={patientData?.name}
          tutorName={tutorObj?.name}
          tutorAddress={scheduledConsultation?.address || tutorAddress || undefined}
          species={patientData?.species}
          breed={patientData?.breed || undefined}
          color={patientData?.color || undefined}
          birthDate={patientData?.birth_date || undefined}
          fertilityStatus={patientData?.fertility_status || undefined}
          fertilityNotes={patientData?.fertility_notes || undefined}
          clinicalObservations={patientData?.clinical_observations || undefined}
          consultationId={consultationId}
          lastWeight={scheduledConsultation?.weight_kg || patientData?.weight_kg || undefined}
          initialType={(scheduledConsultation?.type as 'Home' | 'Hospital') || 'Home'}
          initialTravelFee={scheduledConsultation?.travel_fee ?? undefined}
          initialTravelDistanceKm={scheduledConsultation?.travel_distance_km ?? undefined}
          initialNotes={scheduledConsultation?.clinical_notes || undefined}
          vetName={vetName}
          vetCrmv={vetCrmv}
        />
      </main>
    </ViewTransition>
  );
}
