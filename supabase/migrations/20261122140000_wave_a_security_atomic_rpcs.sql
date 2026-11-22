-- Migration: Wave A Security Hardening, Private Storage & Atomic RPCs

-- 1. patient_vaccinations: missing indexes, ownership-enforced RLS & CHECK constraints
CREATE INDEX IF NOT EXISTS idx_patient_vaccinations_profile_id
  ON public.patient_vaccinations (profile_id);

CREATE INDEX IF NOT EXISTS idx_patient_vaccinations_consultation_id
  ON public.patient_vaccinations (consultation_id);

CREATE INDEX IF NOT EXISTS idx_patient_vaccinations_completed_by_vaccination_id
  ON public.patient_vaccinations (completed_by_vaccination_id);

ALTER TABLE public.patient_vaccinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own patient vaccinations" ON public.patient_vaccinations;
CREATE POLICY "Users can view their own patient vaccinations"
  ON public.patient_vaccinations FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = profile_id
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      JOIN public.tutors t ON t.id = p.tutor_id
      WHERE p.id = patient_vaccinations.patient_id
        AND t.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own patient vaccinations" ON public.patient_vaccinations;
CREATE POLICY "Users can insert their own patient vaccinations"
  ON public.patient_vaccinations FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = profile_id
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      JOIN public.tutors t ON t.id = p.tutor_id
      WHERE p.id = patient_vaccinations.patient_id
        AND t.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own patient vaccinations" ON public.patient_vaccinations;
CREATE POLICY "Users can update their own patient vaccinations"
  ON public.patient_vaccinations FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = profile_id
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      JOIN public.tutors t ON t.id = p.tutor_id
      WHERE p.id = patient_vaccinations.patient_id
        AND t.profile_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = profile_id
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      JOIN public.tutors t ON t.id = p.tutor_id
      WHERE p.id = patient_vaccinations.patient_id
        AND t.profile_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete their own patient vaccinations" ON public.patient_vaccinations;
CREATE POLICY "Users can delete their own patient vaccinations"
  ON public.patient_vaccinations FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = profile_id
    AND EXISTS (
      SELECT 1
      FROM public.patients p
      JOIN public.tutors t ON t.id = p.tutor_id
      WHERE p.id = patient_vaccinations.patient_id
        AND t.profile_id = (SELECT auth.uid())
    )
  );

DO $$
BEGIN
  ALTER TABLE public.patient_vaccinations
    ADD CONSTRAINT chk_patient_vaccinations_dose_number
    CHECK (dose_number >= 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.patient_vaccinations
    ADD CONSTRAINT chk_patient_vaccinations_total_initial_doses
    CHECK (total_initial_doses >= 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.patient_vaccinations
    ADD CONSTRAINT chk_patient_vaccinations_due_after_applied
    CHECK (next_due_date >= applied_date);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Private Storage buckets ('patients', 'consultations', 'avatars') & owner-scoped RLS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('patients', 'patients', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('consultations', 'consultations', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public read access for patient photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload patient photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update patient photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete patient photos" ON storage.objects;

DROP POLICY IF EXISTS "Users can view their own storage objects" ON storage.objects;
CREATE POLICY "Users can view their own storage objects"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('patients', 'consultations', 'avatars')
    AND (
      owner = (SELECT auth.uid())
      OR name LIKE ((SELECT auth.uid())::text || '-%')
      OR name LIKE ((SELECT auth.uid())::text || '/%')
    )
  );

DROP POLICY IF EXISTS "Users can upload their own storage objects" ON storage.objects;
CREATE POLICY "Users can upload their own storage objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id IN ('patients', 'consultations', 'avatars')
    AND (
      name LIKE ((SELECT auth.uid())::text || '-%')
      OR name LIKE ((SELECT auth.uid())::text || '/%')
    )
  );

DROP POLICY IF EXISTS "Users can update their own storage objects" ON storage.objects;
CREATE POLICY "Users can update their own storage objects"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id IN ('patients', 'consultations', 'avatars')
    AND (
      owner = (SELECT auth.uid())
      OR name LIKE ((SELECT auth.uid())::text || '-%')
      OR name LIKE ((SELECT auth.uid())::text || '/%')
    )
  )
  WITH CHECK (
    bucket_id IN ('patients', 'consultations', 'avatars')
    AND (
      owner = (SELECT auth.uid())
      OR name LIKE ((SELECT auth.uid())::text || '-%')
      OR name LIKE ((SELECT auth.uid())::text || '/%')
    )
  );

DROP POLICY IF EXISTS "Users can delete their own storage objects" ON storage.objects;
CREATE POLICY "Users can delete their own storage objects"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id IN ('patients', 'consultations', 'avatars')
    AND (
      owner = (SELECT auth.uid())
      OR name LIKE ((SELECT auth.uid())::text || '-%')
      OR name LIKE ((SELECT auth.uid())::text || '/%')
    )
  );

-- 3. Atomic PL/pgSQL RPCs (SECURITY INVOKER, SET search_path = public)

CREATE OR REPLACE FUNCTION public.finalize_consultation_atomic(
  p_patient_id uuid,
  p_consultation_id uuid DEFAULT NULL,
  p_type text DEFAULT 'Home',
  p_notes text DEFAULT '',
  p_weight_kg numeric DEFAULT NULL,
  p_completion_date timestamptz DEFAULT now(),
  p_images text[] DEFAULT '{}',
  p_address text DEFAULT NULL,
  p_prescriptions jsonb DEFAULT '[]'::jsonb,
  p_travel_distance_km numeric DEFAULT NULL,
  p_travel_fee numeric DEFAULT 0,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_vaccinations jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_consultation_id uuid;
  v_existing_status text;
  v_completion_date timestamptz;
  v_travel_fee numeric;
  v_items_total numeric := 0;
  v_raw_cost_sum numeric := 0;
  v_total_cost numeric := 0;
  v_total_amount numeric := 0;
  v_resolved_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_raw_inv_id text;
  v_inv_id uuid;
  v_item_qty numeric;
  v_inv_row record;
  v_unit_cost numeric;
  v_sale_price numeric;
  v_line_total numeric;
  v_vac jsonb;
  v_protocol text;
  v_vaccine_name text;
  v_dose_number integer;
  v_total_initial_doses integer;
  v_is_annual_booster boolean;
  v_applied_date date;
  v_next_due_date date;
  v_next_dose_label text;
  v_vac_notes text;
  v_new_vac_id uuid;
  v_invoice_id uuid;
  v_travel_description text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_PATIENT';
  END IF;

  PERFORM 1
  FROM public.patients p
  JOIN public.tutors t ON t.id = p.tutor_id
  WHERE p.id = p_patient_id
    AND t.profile_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN_PATIENT';
  END IF;

  IF p_type IS NULL OR p_type NOT IN ('Home', 'Hospital') THEN
    RAISE EXCEPTION 'INVALID_CONSULTATION_TYPE';
  END IF;

  IF p_travel_fee IS NOT NULL AND lower(p_travel_fee::text) IN ('nan', 'infinity', '-infinity') THEN
    RAISE EXCEPTION 'INVALID_TRAVEL_FEE';
  END IF;

  IF COALESCE(p_travel_fee, 0) < 0 OR COALESCE(p_travel_fee, 0) > 500 THEN
    RAISE EXCEPTION 'INVALID_TRAVEL_FEE';
  END IF;

  IF p_weight_kg IS NOT NULL AND (
    lower(p_weight_kg::text) IN ('nan', 'infinity', '-infinity')
    OR p_weight_kg <= 0
  ) THEN
    RAISE EXCEPTION 'INVALID_WEIGHT';
  END IF;

  IF p_travel_distance_km IS NOT NULL AND (
    lower(p_travel_distance_km::text) IN ('nan', 'infinity', '-infinity')
    OR p_travel_distance_km < 0
  ) THEN
    RAISE EXCEPTION 'INVALID_TRAVEL_DISTANCE';
  END IF;

  IF p_items IS NOT NULL AND jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_INVENTORY_ITEM';
  END IF;

  IF p_vaccinations IS NOT NULL AND jsonb_typeof(p_vaccinations) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_VACCINATION';
  END IF;

  v_travel_fee := ROUND(COALESCE(p_travel_fee, 0)::numeric, 2);
  v_completion_date := COALESCE(p_completion_date, now());

  -- Server-side recalculation strictly from inventory rows owned by v_uid
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_raw_inv_id := COALESCE(NULLIF(TRIM(v_item->>'inventory_id'), ''), NULLIF(TRIM(v_item->>'id'), ''));
    IF v_raw_inv_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_INVENTORY_ITEM';
    END IF;

    BEGIN
      v_inv_id := v_raw_inv_id::uuid;
      v_item_qty := NULLIF(TRIM(v_item->>'quantity'), '')::numeric;
    EXCEPTION
      WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'INVALID_INVENTORY_ITEM';
    END;

    IF v_item_qty IS NULL
      OR lower(v_item_qty::text) IN ('nan', 'infinity', '-infinity')
      OR v_item_qty <= 0 THEN
      RAISE EXCEPTION 'INVALID_INVENTORY_ITEM';
    END IF;

    SELECT id, name, unit_cost, sale_price
    INTO v_inv_row
    FROM public.inventory
    WHERE id = v_inv_id
      AND profile_id = v_uid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INVALID_INVENTORY_ITEM';
    END IF;

    v_unit_cost := COALESCE(v_inv_row.unit_cost, 0);
    v_sale_price := COALESCE(v_inv_row.sale_price, 0);
    v_line_total := ROUND((v_sale_price * v_item_qty)::numeric, 2);
    v_items_total := v_items_total + v_line_total;
    v_raw_cost_sum := v_raw_cost_sum + (v_unit_cost * v_item_qty);

    v_resolved_items := v_resolved_items || jsonb_build_array(
      jsonb_build_object(
        'inventory_id', v_inv_row.id,
        'name', v_inv_row.name,
        'quantity', v_item_qty,
        'unit_cost', v_unit_cost,
        'sale_price', v_sale_price,
        'total_price', v_line_total
      )
    );
  END LOOP;

  v_total_cost := ROUND(v_raw_cost_sum::numeric, 2);
  v_total_amount := ROUND((v_items_total + v_travel_fee)::numeric, 2);

  IF p_consultation_id IS NOT NULL THEN
    UPDATE public.consultations
    SET
      patient_id = p_patient_id,
      type = p_type,
      clinical_notes = COALESCE(p_notes, ''),
      base_fee = v_total_amount,
      weight_kg = COALESCE(p_weight_kg, weight_kg),
      status = 'Completed',
      date = v_completion_date,
      images = COALESCE(p_images, '{}'::text[]),
      address = NULLIF(TRIM(COALESCE(p_address, '')), ''),
      prescriptions = COALESCE(p_prescriptions, '[]'::jsonb),
      travel_distance_km = p_travel_distance_km,
      travel_fee = v_travel_fee
    WHERE id = p_consultation_id
      AND profile_id = v_uid
      AND status <> 'Completed'
    RETURNING id INTO v_consultation_id;

    IF NOT FOUND THEN
      SELECT status
      INTO v_existing_status
      FROM public.consultations
      WHERE id = p_consultation_id
        AND profile_id = v_uid;

      IF FOUND AND v_existing_status = 'Completed' THEN
        RAISE EXCEPTION 'ALREADY_COMPLETED';
      END IF;

      RAISE EXCEPTION 'CONSULTATION_NOT_FOUND';
    END IF;
  ELSE
    INSERT INTO public.consultations (
      profile_id,
      patient_id,
      type,
      clinical_notes,
      base_fee,
      weight_kg,
      status,
      date,
      images,
      address,
      prescriptions,
      travel_distance_km,
      travel_fee
    ) VALUES (
      v_uid,
      p_patient_id,
      p_type,
      COALESCE(p_notes, ''),
      v_total_amount,
      p_weight_kg,
      'Completed',
      v_completion_date,
      COALESCE(p_images, '{}'::text[]),
      NULLIF(TRIM(COALESCE(p_address, '')), ''),
      COALESCE(p_prescriptions, '[]'::jsonb),
      p_travel_distance_km,
      v_travel_fee
    )
    RETURNING id INTO v_consultation_id;
  END IF;

  IF p_weight_kg IS NOT NULL THEN
    UPDATE public.patients
    SET weight_kg = p_weight_kg
    WHERE id = p_patient_id;
  END IF;

  -- Process applied vaccinations and close only prior open doses of the same protocol/name
  FOR v_vac IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_vaccinations, '[]'::jsonb))
  LOOP
    v_protocol := COALESCE(NULLIF(TRIM(v_vac->>'protocol_code'), ''), 'CUSTOM');
    v_vaccine_name := NULLIF(TRIM(v_vac->>'vaccine_name'), '');

    IF v_vaccine_name IS NULL THEN
      RAISE EXCEPTION 'INVALID_VACCINATION';
    END IF;

    BEGIN
      v_dose_number := COALESCE(NULLIF(TRIM(v_vac->>'dose_number'), '')::integer, 1);
      v_total_initial_doses := COALESCE(NULLIF(TRIM(v_vac->>'total_initial_doses'), '')::integer, 1);
      v_is_annual_booster := COALESCE(NULLIF(TRIM(v_vac->>'is_annual_booster'), '')::boolean, false);
      v_applied_date := NULLIF(TRIM(v_vac->>'applied_date'), '')::date;
      v_next_due_date := NULLIF(TRIM(v_vac->>'next_due_date'), '')::date;
    EXCEPTION
      WHEN invalid_text_representation OR invalid_datetime_format OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'INVALID_VACCINATION';
    END;

    v_next_dose_label := COALESCE(NULLIF(TRIM(v_vac->>'next_dose_label'), ''), 'Reforço');
    v_vac_notes := NULLIF(TRIM(v_vac->>'notes'), '');

    IF v_applied_date IS NULL
      OR v_next_due_date IS NULL
      OR v_next_due_date < v_applied_date
      OR v_dose_number < 1
      OR v_total_initial_doses < 1 THEN
      RAISE EXCEPTION 'INVALID_VACCINATION';
    END IF;

    INSERT INTO public.patient_vaccinations (
      profile_id,
      patient_id,
      consultation_id,
      protocol_code,
      vaccine_name,
      dose_number,
      total_initial_doses,
      is_annual_booster,
      applied_date,
      next_due_date,
      next_dose_label,
      notes
    ) VALUES (
      v_uid,
      p_patient_id,
      v_consultation_id,
      v_protocol,
      v_vaccine_name,
      v_dose_number,
      v_total_initial_doses,
      v_is_annual_booster,
      v_applied_date,
      v_next_due_date,
      v_next_dose_label,
      COALESCE(v_vac_notes, 'Aplicada durante atendimento clínico')
    )
    RETURNING id INTO v_new_vac_id;

    UPDATE public.patient_vaccinations
    SET completed_by_vaccination_id = v_new_vac_id
    WHERE completed_by_vaccination_id IS NULL
      AND id <> v_new_vac_id
      AND patient_id = p_patient_id
      AND profile_id = v_uid
      AND protocol_code = v_protocol
      AND applied_date <= v_applied_date
      AND (
        v_protocol <> 'CUSTOM'
        OR LOWER(TRIM(vaccine_name)) = LOWER(TRIM(v_vaccine_name))
      );
  END LOOP;

  IF jsonb_array_length(v_resolved_items) > 0 THEN
    INSERT INTO public.consultation_items (
      consultation_id,
      inventory_id,
      quantity,
      applied_cost,
      is_prescribed
    )
    SELECT
      v_consultation_id,
      (elem->>'inventory_id')::uuid,
      (elem->>'quantity')::numeric,
      (elem->>'unit_cost')::numeric,
      false
    FROM jsonb_array_elements(v_resolved_items) AS elem;
  END IF;

  IF v_total_amount > 0 THEN
    INSERT INTO public.transactions (
      profile_id,
      consultation_id,
      type,
      category,
      amount,
      date
    ) VALUES (
      v_uid,
      v_consultation_id,
      'Income',
      'Service',
      v_total_amount,
      now()
    );
  END IF;

  IF v_total_cost > 0 THEN
    INSERT INTO public.transactions (
      profile_id,
      consultation_id,
      type,
      category,
      amount,
      date
    ) VALUES (
      v_uid,
      v_consultation_id,
      'Expense',
      'Supplies',
      v_total_cost,
      now()
    );
  END IF;

  IF v_total_amount > 0 THEN
    INSERT INTO public.invoices (
      patient_id,
      total_amount,
      status
    ) VALUES (
      p_patient_id,
      v_total_amount,
      'pending'
    )
    RETURNING id INTO v_invoice_id;

    IF jsonb_array_length(v_resolved_items) > 0 THEN
      INSERT INTO public.invoice_items (
        invoice_id,
        description,
        quantity,
        unit_price,
        total_price
      )
      SELECT
        v_invoice_id,
        elem->>'name',
        (elem->>'quantity')::numeric,
        (elem->>'sale_price')::numeric,
        (elem->>'total_price')::numeric
      FROM jsonb_array_elements(v_resolved_items) AS elem;
    END IF;

    IF v_travel_fee > 0 THEN
      v_travel_description := CASE
        WHEN p_travel_distance_km IS NOT NULL AND p_travel_distance_km > 0
          THEN 'Taxa de Deslocamento Domiciliar (' || p_travel_distance_km::text || ' km ida e volta)'
        ELSE 'Taxa de Deslocamento Domiciliar'
      END;

      INSERT INTO public.invoice_items (
        invoice_id,
        description,
        quantity,
        unit_price,
        total_price
      ) VALUES (
        v_invoice_id,
        v_travel_description,
        1,
        v_travel_fee,
        v_travel_fee
      );
    END IF;
  END IF;

  RETURN v_consultation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_patient_atomic(
  p_patient_id uuid,
  p_delete_orphan_tutor boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_tutor_id uuid;
  v_remaining_patients integer;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF p_patient_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_PATIENT';
  END IF;

  SELECT p.tutor_id
  INTO v_tutor_id
  FROM public.patients p
  JOIN public.tutors t ON t.id = p.tutor_id
  WHERE p.id = p_patient_id
    AND t.profile_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN_PATIENT';
  END IF;

  PERFORM 1
  FROM public.tutors
  WHERE id = v_tutor_id
    AND profile_id = v_uid
  FOR UPDATE;

  DELETE FROM public.invoice_items
  WHERE invoice_id IN (
    SELECT id FROM public.invoices WHERE patient_id = p_patient_id
  );

  DELETE FROM public.invoices
  WHERE patient_id = p_patient_id;

  DELETE FROM public.transactions
  WHERE consultation_id IN (
    SELECT id FROM public.consultations
    WHERE patient_id = p_patient_id
      AND profile_id = v_uid
  )
  AND profile_id = v_uid;

  DELETE FROM public.consultation_items
  WHERE consultation_id IN (
    SELECT id FROM public.consultations
    WHERE patient_id = p_patient_id
      AND profile_id = v_uid
  );

  DELETE FROM public.consultations
  WHERE patient_id = p_patient_id
    AND profile_id = v_uid;

  DELETE FROM public.patient_vaccinations
  WHERE patient_id = p_patient_id
    AND profile_id = v_uid;

  DELETE FROM public.patients
  WHERE id = p_patient_id
    AND tutor_id = v_tutor_id;

  IF COALESCE(p_delete_orphan_tutor, false) THEN
    SELECT COUNT(*)
    INTO v_remaining_patients
    FROM public.patients
    WHERE tutor_id = v_tutor_id;

    IF v_remaining_patients = 0 THEN
      DELETE FROM public.tutors
      WHERE id = v_tutor_id
        AND profile_id = v_uid;
    END IF;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_tutor_atomic(
  p_tutor_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_patient_ids uuid[];
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  IF p_tutor_id IS NULL THEN
    RAISE EXCEPTION 'FORBIDDEN_TUTOR';
  END IF;

  PERFORM 1
  FROM public.tutors
  WHERE id = p_tutor_id
    AND profile_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FORBIDDEN_TUTOR';
  END IF;

  SELECT COALESCE(array_agg(id), '{}'::uuid[])
  INTO v_patient_ids
  FROM public.patients
  WHERE tutor_id = p_tutor_id;

  IF COALESCE(array_length(v_patient_ids, 1), 0) > 0 THEN
    DELETE FROM public.invoice_items
    WHERE invoice_id IN (
      SELECT id FROM public.invoices WHERE patient_id = ANY(v_patient_ids)
    );

    DELETE FROM public.invoices
    WHERE patient_id = ANY(v_patient_ids);

    DELETE FROM public.transactions
    WHERE consultation_id IN (
      SELECT id FROM public.consultations
      WHERE patient_id = ANY(v_patient_ids)
        AND profile_id = v_uid
    )
    AND profile_id = v_uid;

    DELETE FROM public.consultation_items
    WHERE consultation_id IN (
      SELECT id FROM public.consultations
      WHERE patient_id = ANY(v_patient_ids)
        AND profile_id = v_uid
    );

    DELETE FROM public.consultations
    WHERE patient_id = ANY(v_patient_ids)
      AND profile_id = v_uid;

    DELETE FROM public.patient_vaccinations
    WHERE patient_id = ANY(v_patient_ids)
      AND profile_id = v_uid;

    DELETE FROM public.patients
    WHERE id = ANY(v_patient_ids)
      AND tutor_id = p_tutor_id;
  END IF;

  DELETE FROM public.tutors
  WHERE id = p_tutor_id
    AND profile_id = v_uid;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_consultation_atomic(
  uuid, uuid, text, text, numeric, timestamptz, text[], text, jsonb, numeric, numeric, jsonb, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_consultation_atomic(
  uuid, uuid, text, text, numeric, timestamptz, text[], text, jsonb, numeric, numeric, jsonb, jsonb
) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_patient_atomic(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_patient_atomic(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_tutor_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_tutor_atomic(uuid) TO authenticated;
