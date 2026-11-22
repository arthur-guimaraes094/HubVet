// Server-only authentication & authorization helpers (uses next/headers cookies via createClient).
import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/infrastructure/database/server';

export const requireSession = cache(async (): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}> => {
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();

  if (error || !claimsData?.claims?.sub) {
    redirect('/login');
  }

  return {
    supabase,
    userId: claimsData.claims.sub,
  };
});

export async function assertTutorOwnership(
  supabase: SupabaseClient,
  tutorId: string,
  userId: string
): Promise<boolean> {
  if (!tutorId || !userId) return false;

  const { data, error } = await supabase
    .from('tutors')
    .select('id')
    .eq('id', tutorId)
    .eq('profile_id', userId)
    .maybeSingle();

  return !error && Boolean(data);
}

export async function assertPatientOwnership(
  supabase: SupabaseClient,
  patientId: string,
  userId: string
): Promise<{ owned: boolean; tutorId?: string }> {
  if (!patientId || !userId) return { owned: false };

  const { data, error } = await supabase
    .from('patients')
    .select('id, tutor_id, tutors!inner(profile_id)')
    .eq('id', patientId)
    .eq('tutors.profile_id', userId)
    .maybeSingle();

  if (error || !data) {
    return { owned: false };
  }

  const row = data as { id: string; tutor_id?: string | null };
  return {
    owned: true,
    tutorId: row.tutor_id ?? undefined,
  };
}

export async function assertInvoiceOwnership(
  supabase: SupabaseClient,
  invoiceId: string,
  userId: string
): Promise<boolean> {
  if (!invoiceId || !userId) return false;

  const { data, error } = await supabase
    .from('invoices')
    .select('id, patients!inner(id, tutors!inner(profile_id))')
    .eq('id', invoiceId)
    .eq('patients.tutors.profile_id', userId)
    .maybeSingle();

  return !error && Boolean(data);
}

export async function assertConsultationOwnership(
  supabase: SupabaseClient,
  consultationId: string,
  userId: string
): Promise<boolean> {
  if (!consultationId || !userId) return false;

  const { data, error } = await supabase
    .from('consultations')
    .select('id')
    .eq('id', consultationId)
    .eq('profile_id', userId)
    .maybeSingle();

  return !error && Boolean(data);
}
