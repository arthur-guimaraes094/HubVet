import type { SupabaseClient } from '@supabase/supabase-js';

export interface PatientExtendedMeta {
  photo_url?: string | null;
  is_birth_date_estimated?: boolean;
  fertility_status?: string | null;
  fertility_notes?: string | null;
  clinical_observations?: string | null;
}

const META_BUCKET = 'consultations';

function getMetaFilePath(patientId: string): string {
  return `patient-meta-${patientId}.json`;
}

/**
 * Salva os metadados estendidos do paciente (foto, fertilidade, alergias) no Storage
 * como fallback automático caso a migration SQL ainda não tenha sido executada no banco.
 */
export async function savePatientExtendedMeta(
  supabase: SupabaseClient,
  patientId: string,
  meta: PatientExtendedMeta
): Promise<void> {
  try {
    const payload = JSON.stringify({
      ...meta,
      updatedAt: new Date().toISOString(),
    });
    const blob = new Blob([payload], { type: 'application/json' });

    await supabase.storage.from(META_BUCKET).upload(getMetaFilePath(patientId), blob, {
      upsert: true,
      contentType: 'application/json',
    });
  } catch (err) {
    console.warn('Could not save fallback patient metadata:', err);
  }
}

/**
 * Carrega os metadados estendidos do paciente do Storage caso a coluna photo_url
 * ainda não exista na tabela patients ou esteja vazia.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enrichPatientWithFallbackMeta<T extends Record<string, any>>(
  supabase: SupabaseClient,
  patient: T | null
): Promise<T | null> {
  if (!patient || !patient.id) return patient;

  if (patient.photo_url) {
    return patient;
  }

  try {
    const { data, error } = await supabase.storage
      .from(META_BUCKET)
      .download(getMetaFilePath(patient.id));

    if (error || !data) return patient;

    const text = await data.text();
    const meta = JSON.parse(text) as PatientExtendedMeta;

    return {
      ...patient,
      photo_url: patient.photo_url ?? meta.photo_url ?? null,
      is_birth_date_estimated:
        patient.is_birth_date_estimated ?? meta.is_birth_date_estimated ?? false,
      fertility_status: patient.fertility_status ?? meta.fertility_status ?? null,
      fertility_notes: patient.fertility_notes ?? meta.fertility_notes ?? null,
      clinical_observations:
        patient.clinical_observations ?? meta.clinical_observations ?? null,
    };
  } catch {
    return patient;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function enrichPatientsListWithFallbackMeta<T extends Record<string, any>>(
  supabase: SupabaseClient,
  patients: T[]
): Promise<T[]> {
  if (!patients || patients.length === 0) return patients;

  try {
    const { data: files } = await supabase.storage.from(META_BUCKET).list('', {
      limit: 300,
      search: 'patient-meta-',
    });

    if (!files || files.length === 0) return patients;

    const existingMetaFiles = new Set(files.map((f) => f.name));

    return await Promise.all(
      patients.map(async (p) => {
        if (p.photo_url) return p;
        const expectedFile = getMetaFilePath(p.id);
        if (!existingMetaFiles.has(expectedFile)) return p;
        return (await enrichPatientWithFallbackMeta(supabase, p)) || p;
      })
    );
  } catch {
    return patients;
  }
}
