import { ConsultationForm } from '@/components/features/ConsultationForm';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/infrastructure/database/server';
import Link from 'next/link';
import { ViewTransition } from "react";

export const revalidate = 0;

export default async function ProntuarioPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; type?: string; patient?: string; consultationId?: string; returnTo?: string }>
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const { data: rawInventory } = await supabase.from('inventory').select('*').order('name');
  
  const inventory = rawInventory?.map(item => ({
    id: item.id,
    name: item.name,
    type: item.type as 'Medication' | 'Vaccine' | 'Material' | 'Consultation',
    concentration: item.concentration || undefined,
    unitCost: item.unit_cost,
    salePrice: item.sale_price
  })) || [];
  
  let patientData = null;
  const targetId = params?.id || params?.patient;
  const targetType = params?.type || (params?.patient ? 'Paciente' : null);
  const consultationId = params?.consultationId;
  const returnTo = params?.returnTo;

  if (targetId && targetType === 'Paciente') {
    const { data } = await supabase.from('patients').select('*, tutors(name)').eq('id', targetId).single();
    patientData = data;
  }

  return (
    <ViewTransition enter="fade-in" default="none">
      <main className="flex-1 flex flex-col p-8 gap-8 w-full max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold text-foreground">Prontuário</h1>
          <Link href={
            returnTo === 'agenda' ? '/agenda' : 
            returnTo === 'history' ? `/pacientes/${targetId}` : 
            '/'
          }>
            <Button variant="secondary" className="!px-4 !py-2 text-sm">Voltar</Button>
          </Link>
        </div>

        <ConsultationForm 
          inventory={inventory || []} 
          patientId={patientData?.id} 
          patientName={patientData?.name}
          tutorName={patientData?.tutors?.name}
          species={patientData?.species}
          breed={patientData?.breed || undefined}
          color={patientData?.color || undefined}
          consultationId={consultationId}
          lastWeight={patientData?.weight_kg || undefined}
        />
      </main>
    </ViewTransition>
  );
}
