-- Migration: HubVet Features & Ajustes (Dra. Gabriela Soares)
-- Inclui: Endereço completo de tutores, Foto/Idade/Fertilidade/Alergias de pacientes,
-- Cálculo de deslocamento, Receituário estruturado e Protocolos Vacinais com Avisos.

-- 1. Profiles: Configurações de deslocamento da veterinária
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS base_cep text,
  ADD COLUMN IF NOT EXISTS base_address text DEFAULT 'Rua das embarcações, 171, Nova Parnamirim',
  ADD COLUMN IF NOT EXISTS base_lat double precision,
  ADD COLUMN IF NOT EXISTS base_lng double precision,
  ADD COLUMN IF NOT EXISTS km_rate numeric(10,2) DEFAULT 2.50;

-- 2. Tutors: Endereço estruturado e coordenadas
ALTER TABLE public.tutors
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS street text,
  ADD COLUMN IF NOT EXISTS number text,
  ADD COLUMN IF NOT EXISTS complement text,
  ADD COLUMN IF NOT EXISTS neighborhood text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- 3. Patients: Foto, idade estimada, fertilidade e observações clínicas (alergias, etc.)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS is_birth_date_estimated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fertility_status text,
  ADD COLUMN IF NOT EXISTS fertility_notes text,
  ADD COLUMN IF NOT EXISTS clinical_observations text;

-- 4. Consultations: Taxa/distância de deslocamento e módulo de receitas estruturado
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS travel_distance_km numeric(10,2),
  ADD COLUMN IF NOT EXISTS travel_fee numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prescriptions jsonb DEFAULT '[]'::jsonb;

-- 5. Tabela de Protocolos Vacinais Aplicados e Agendamentos de Retorno
CREATE TABLE IF NOT EXISTS public.patient_vaccinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  consultation_id uuid REFERENCES public.consultations(id) ON DELETE SET NULL,
  protocol_code text NOT NULL,
  vaccine_name text NOT NULL,
  dose_number integer NOT NULL DEFAULT 1,
  total_initial_doses integer NOT NULL DEFAULT 1,
  is_annual_booster boolean NOT NULL DEFAULT false,
  applied_date date NOT NULL,
  next_due_date date NOT NULL,
  next_dose_label text NOT NULL,
  batch_number text,
  notes text,
  notified_at timestamptz,
  completed_by_vaccination_id uuid REFERENCES public.patient_vaccinations(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_vaccinations_patient_id ON public.patient_vaccinations(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_vaccinations_next_due_date ON public.patient_vaccinations(next_due_date) WHERE completed_by_vaccination_id IS NULL;

-- RLS e Permissões para patient_vaccinations
ALTER TABLE public.patient_vaccinations ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.patient_vaccinations TO authenticated;
GRANT ALL ON TABLE public.patient_vaccinations TO service_role;

DROP POLICY IF EXISTS "Users can view their own patient vaccinations" ON public.patient_vaccinations;
CREATE POLICY "Users can view their own patient vaccinations"
  ON public.patient_vaccinations FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can insert their own patient vaccinations" ON public.patient_vaccinations;
CREATE POLICY "Users can insert their own patient vaccinations"
  ON public.patient_vaccinations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can update their own patient vaccinations" ON public.patient_vaccinations;
CREATE POLICY "Users can update their own patient vaccinations"
  ON public.patient_vaccinations FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Users can delete their own patient vaccinations" ON public.patient_vaccinations;
CREATE POLICY "Users can delete their own patient vaccinations"
  ON public.patient_vaccinations FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- 6. Bucket de Storage para Fotos dos Pets ('patients')
INSERT INTO storage.buckets (id, name, public)
VALUES ('patients', 'patients', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access for patient photos" ON storage.objects;
CREATE POLICY "Public read access for patient photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'patients');

DROP POLICY IF EXISTS "Authenticated users can upload patient photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload patient photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'patients');

DROP POLICY IF EXISTS "Authenticated users can update patient photos" ON storage.objects;
CREATE POLICY "Authenticated users can update patient photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'patients');

DROP POLICY IF EXISTS "Authenticated users can delete patient photos" ON storage.objects;
CREATE POLICY "Authenticated users can delete patient photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'patients');
