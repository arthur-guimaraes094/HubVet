


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."invoice_status" AS ENUM (
    'pending',
    'paid',
    'cancelled'
);


ALTER TYPE "public"."invoice_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_patient_atomic"("p_patient_id" "uuid", "p_delete_orphan_tutor" boolean DEFAULT false) RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."delete_patient_atomic"("p_patient_id" "uuid", "p_delete_orphan_tutor" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_tutor_atomic"("p_tutor_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."delete_tutor_atomic"("p_tutor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finalize_consultation_atomic"("p_patient_id" "uuid", "p_consultation_id" "uuid" DEFAULT NULL::"uuid", "p_type" "text" DEFAULT 'Home'::"text", "p_notes" "text" DEFAULT ''::"text", "p_weight_kg" numeric DEFAULT NULL::numeric, "p_completion_date" timestamp with time zone DEFAULT "now"(), "p_images" "text"[] DEFAULT '{}'::"text"[], "p_address" "text" DEFAULT NULL::"text", "p_prescriptions" "jsonb" DEFAULT '[]'::"jsonb", "p_travel_distance_km" numeric DEFAULT NULL::numeric, "p_travel_fee" numeric DEFAULT 0, "p_items" "jsonb" DEFAULT '[]'::"jsonb", "p_vaccinations" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."finalize_consultation_atomic"("p_patient_id" "uuid", "p_consultation_id" "uuid", "p_type" "text", "p_notes" "text", "p_weight_kg" numeric, "p_completion_date" timestamp with time zone, "p_images" "text"[], "p_address" "text", "p_prescriptions" "jsonb", "p_travel_distance_km" numeric, "p_travel_fee" numeric, "p_items" "jsonb", "p_vaccinations" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."consultation_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "consultation_id" "uuid" NOT NULL,
    "inventory_id" "uuid" NOT NULL,
    "quantity" numeric(10,2) NOT NULL,
    "applied_cost" numeric(10,2) NOT NULL,
    "is_prescribed" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."consultation_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consultations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" NOT NULL,
    "clinical_notes" "text",
    "base_fee" numeric(10,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'Scheduled'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "address" "text",
    "weight_kg" numeric,
    "images" "text"[] DEFAULT '{}'::"text"[],
    "travel_distance_km" numeric(10,2),
    "travel_fee" numeric(10,2) DEFAULT 0,
    "prescriptions" "jsonb" DEFAULT '[]'::"jsonb",
    CONSTRAINT "consultations_status_check" CHECK (("status" = ANY (ARRAY['Scheduled'::"text", 'In Progress'::"text", 'Completed'::"text", 'Canceled'::"text"]))),
    CONSTRAINT "consultations_type_check" CHECK (("type" = ANY (ARRAY['Home'::"text", 'Hospital'::"text"])))
);


ALTER TABLE "public"."consultations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "concentration" "text",
    "unit_cost" numeric(10,2) DEFAULT 0 NOT NULL,
    "sale_price" numeric(10,2) DEFAULT 0 NOT NULL,
    "quantity_in_stock" numeric(10,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_type_check" CHECK (("type" = ANY (ARRAY['Medication'::"text", 'Vaccine'::"text", 'Supply'::"text", 'Consultation'::"text"])))
);


ALTER TABLE "public"."inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "total_amount" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "status" "public"."invoice_status" DEFAULT 'pending'::"public"."invoice_status" NOT NULL,
    "due_date" "date",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patient_vaccinations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "consultation_id" "uuid",
    "protocol_code" "text" NOT NULL,
    "vaccine_name" "text" NOT NULL,
    "dose_number" integer DEFAULT 1 NOT NULL,
    "total_initial_doses" integer DEFAULT 1 NOT NULL,
    "is_annual_booster" boolean DEFAULT false NOT NULL,
    "applied_date" "date" NOT NULL,
    "next_due_date" "date" NOT NULL,
    "next_dose_label" "text" NOT NULL,
    "batch_number" "text",
    "notes" "text",
    "notified_at" timestamp with time zone,
    "completed_by_vaccination_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_patient_vaccinations_dose_number" CHECK (("dose_number" >= 1)),
    CONSTRAINT "chk_patient_vaccinations_due_after_applied" CHECK (("next_due_date" >= "applied_date")),
    CONSTRAINT "chk_patient_vaccinations_total_initial_doses" CHECK (("total_initial_doses" >= 1))
);


ALTER TABLE "public"."patient_vaccinations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."patients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tutor_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "species" "text" NOT NULL,
    "weight_kg" numeric(6,2),
    "birth_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "breed" "text",
    "color" "text",
    "photo_url" "text",
    "is_birth_date_estimated" boolean DEFAULT false,
    "fertility_status" "text",
    "fertility_notes" "text",
    "clinical_observations" "text",
    CONSTRAINT "patients_species_check" CHECK (("species" = ANY (ARRAY['Canine'::"text", 'Feline'::"text", 'Other'::"text"])))
);


ALTER TABLE "public"."patients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "crmv" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_url" "text",
    "base_cep" "text",
    "base_address" "text" DEFAULT 'Rua das embarcações, 171, Nova Parnamirim'::"text",
    "base_lat" double precision,
    "base_lng" double precision,
    "km_rate" numeric(10,2) DEFAULT 2.50,
    "pix_key" "text",
    "pix_key_type" "text" DEFAULT 'CPF'::"text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."push_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "consultation_id" "uuid",
    "profile_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "category" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "transactions_category_check" CHECK (("category" = ANY (ARRAY['Service'::"text", 'Supplies'::"text", 'Other'::"text"]))),
    CONSTRAINT "transactions_type_check" CHECK (("type" = ANY (ARRAY['Income'::"text", 'Expense'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tutors" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cpf" "text",
    "cep" "text",
    "street" "text",
    "number" "text",
    "complement" "text",
    "neighborhood" "text",
    "city" "text",
    "state" "text",
    "lat" double precision,
    "lng" double precision
);


ALTER TABLE "public"."tutors" OWNER TO "postgres";


ALTER TABLE ONLY "public"."consultation_items"
    ADD CONSTRAINT "consultation_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patient_vaccinations"
    ADD CONSTRAINT "patient_vaccinations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutors"
    ADD CONSTRAINT "tutors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tutors"
    ADD CONSTRAINT "tutors_profile_id_cpf_key" UNIQUE ("profile_id", "cpf");



ALTER TABLE ONLY "public"."tutors"
    ADD CONSTRAINT "tutors_profile_id_phone_key" UNIQUE ("profile_id", "phone");



CREATE INDEX "idx_consultation_items_consultation_id" ON "public"."consultation_items" USING "btree" ("consultation_id");



CREATE INDEX "idx_consultation_items_inventory_id" ON "public"."consultation_items" USING "btree" ("inventory_id");



CREATE INDEX "idx_consultations_patient_id" ON "public"."consultations" USING "btree" ("patient_id");



CREATE INDEX "idx_consultations_profile_id" ON "public"."consultations" USING "btree" ("profile_id");



CREATE INDEX "idx_inventory_profile_id" ON "public"."inventory" USING "btree" ("profile_id");



CREATE INDEX "idx_invoice_items_invoice_id" ON "public"."invoice_items" USING "btree" ("invoice_id");



CREATE INDEX "idx_invoices_patient_id" ON "public"."invoices" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_vaccinations_completed_by_vaccination_id" ON "public"."patient_vaccinations" USING "btree" ("completed_by_vaccination_id");



CREATE INDEX "idx_patient_vaccinations_consultation_id" ON "public"."patient_vaccinations" USING "btree" ("consultation_id");



CREATE INDEX "idx_patient_vaccinations_next_due_date" ON "public"."patient_vaccinations" USING "btree" ("next_due_date") WHERE ("completed_by_vaccination_id" IS NULL);



CREATE INDEX "idx_patient_vaccinations_patient_id" ON "public"."patient_vaccinations" USING "btree" ("patient_id");



CREATE INDEX "idx_patient_vaccinations_profile_id" ON "public"."patient_vaccinations" USING "btree" ("profile_id");



CREATE INDEX "idx_patients_tutor_id" ON "public"."patients" USING "btree" ("tutor_id");



CREATE INDEX "idx_push_subscriptions_profile_id" ON "public"."push_subscriptions" USING "btree" ("profile_id");



CREATE INDEX "idx_transactions_consultation_id" ON "public"."transactions" USING "btree" ("consultation_id");



CREATE INDEX "idx_transactions_profile_id" ON "public"."transactions" USING "btree" ("profile_id");



CREATE INDEX "idx_tutors_profile_id" ON "public"."tutors" USING "btree" ("profile_id");



ALTER TABLE ONLY "public"."consultation_items"
    ADD CONSTRAINT "consultation_items_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultation_items"
    ADD CONSTRAINT "consultation_items_inventory_id_fkey" FOREIGN KEY ("inventory_id") REFERENCES "public"."inventory"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consultations"
    ADD CONSTRAINT "consultations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_vaccinations"
    ADD CONSTRAINT "patient_vaccinations_completed_by_vaccination_id_fkey" FOREIGN KEY ("completed_by_vaccination_id") REFERENCES "public"."patient_vaccinations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patient_vaccinations"
    ADD CONSTRAINT "patient_vaccinations_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patient_vaccinations"
    ADD CONSTRAINT "patient_vaccinations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patient_vaccinations"
    ADD CONSTRAINT "patient_vaccinations_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "public"."tutors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."consultations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tutors"
    ADD CONSTRAINT "tutors_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Users can delete own invoices" ON "public"."invoices" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."patients"
     JOIN "public"."tutors" ON (("tutors"."id" = "patients"."tutor_id")))
  WHERE (("patients"."id" = "invoices"."patient_id") AND ("tutors"."profile_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can delete own patients" ON "public"."patients" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."tutors"
  WHERE (("tutors"."id" = "patients"."tutor_id") AND ("tutors"."profile_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can delete own tutors" ON "public"."tutors" FOR DELETE USING ((( SELECT "auth"."uid"() AS "uid") = "profile_id"));



CREATE POLICY "Users can delete their own patient vaccinations" ON "public"."patient_vaccinations" FOR DELETE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "profile_id") AND (EXISTS ( SELECT 1
   FROM ("public"."patients" "p"
     JOIN "public"."tutors" "t" ON (("t"."id" = "p"."tutor_id")))
  WHERE (("p"."id" = "patient_vaccinations"."patient_id") AND ("t"."profile_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can insert own invoices" ON "public"."invoices" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."patients"
     JOIN "public"."tutors" ON (("tutors"."id" = "patients"."tutor_id")))
  WHERE (("patients"."id" = "invoices"."patient_id") AND ("tutors"."profile_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can insert own patients" ON "public"."patients" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."tutors"
  WHERE (("tutors"."id" = "patients"."tutor_id") AND ("tutors"."profile_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can insert own tutors" ON "public"."tutors" FOR INSERT WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "profile_id"));



CREATE POLICY "Users can insert their own patient vaccinations" ON "public"."patient_vaccinations" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "profile_id") AND (EXISTS ( SELECT 1
   FROM ("public"."patients" "p"
     JOIN "public"."tutors" "t" ON (("t"."id" = "p"."tutor_id")))
  WHERE (("p"."id" = "patient_vaccinations"."patient_id") AND ("t"."profile_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can manage own consultation items" ON "public"."consultation_items" USING ((EXISTS ( SELECT 1
   FROM "public"."consultations"
  WHERE (("consultations"."id" = "consultation_items"."consultation_id") AND ("consultations"."profile_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."consultations"
  WHERE (("consultations"."id" = "consultation_items"."consultation_id") AND ("consultations"."profile_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can manage own consultations" ON "public"."consultations" USING ((( SELECT "auth"."uid"() AS "uid") = "profile_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "profile_id"));



CREATE POLICY "Users can manage own inventory" ON "public"."inventory" USING ((( SELECT "auth"."uid"() AS "uid") = "profile_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "profile_id"));



CREATE POLICY "Users can manage own invoice items" ON "public"."invoice_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."invoices"
     JOIN "public"."patients" ON (("patients"."id" = "invoices"."patient_id")))
     JOIN "public"."tutors" ON (("tutors"."id" = "patients"."tutor_id")))
  WHERE (("invoices"."id" = "invoice_items"."invoice_id") AND ("tutors"."profile_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can manage own transactions" ON "public"."transactions" USING ((( SELECT "auth"."uid"() AS "uid") = "profile_id")) WITH CHECK ((( SELECT "auth"."uid"() AS "uid") = "profile_id"));



CREATE POLICY "Users can manage their own subscriptions" ON "public"."push_subscriptions" USING ((( SELECT "auth"."uid"() AS "uid") = "profile_id"));



CREATE POLICY "Users can update own invoices" ON "public"."invoices" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."patients"
     JOIN "public"."tutors" ON (("tutors"."id" = "patients"."tutor_id")))
  WHERE (("patients"."id" = "invoices"."patient_id") AND ("tutors"."profile_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can update own patients" ON "public"."patients" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."tutors"
  WHERE (("tutors"."id" = "patients"."tutor_id") AND ("tutors"."profile_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can update own tutors" ON "public"."tutors" FOR UPDATE USING ((( SELECT "auth"."uid"() AS "uid") = "profile_id"));



CREATE POLICY "Users can update their own patient vaccinations" ON "public"."patient_vaccinations" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "profile_id") AND (EXISTS ( SELECT 1
   FROM ("public"."patients" "p"
     JOIN "public"."tutors" "t" ON (("t"."id" = "p"."tutor_id")))
  WHERE (("p"."id" = "patient_vaccinations"."patient_id") AND ("t"."profile_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "profile_id") AND (EXISTS ( SELECT 1
   FROM ("public"."patients" "p"
     JOIN "public"."tutors" "t" ON (("t"."id" = "p"."tutor_id")))
  WHERE (("p"."id" = "patient_vaccinations"."patient_id") AND ("t"."profile_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "Users can view own invoices" ON "public"."invoices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."patients"
     JOIN "public"."tutors" ON (("tutors"."id" = "patients"."tutor_id")))
  WHERE (("patients"."id" = "invoices"."patient_id") AND ("tutors"."profile_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view own patients" ON "public"."patients" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."tutors"
  WHERE (("tutors"."id" = "patients"."tutor_id") AND ("tutors"."profile_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "id"));



CREATE POLICY "Users can view own tutors" ON "public"."tutors" FOR SELECT USING ((( SELECT "auth"."uid"() AS "uid") = "profile_id"));



CREATE POLICY "Users can view their own patient vaccinations" ON "public"."patient_vaccinations" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "profile_id") AND (EXISTS ( SELECT 1
   FROM ("public"."patients" "p"
     JOIN "public"."tutors" "t" ON (("t"."id" = "p"."tutor_id")))
  WHERE (("p"."id" = "patient_vaccinations"."patient_id") AND ("t"."profile_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."consultation_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consultations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patient_vaccinations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tutors" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_patient_atomic"("p_patient_id" "uuid", "p_delete_orphan_tutor" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_patient_atomic"("p_patient_id" "uuid", "p_delete_orphan_tutor" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_patient_atomic"("p_patient_id" "uuid", "p_delete_orphan_tutor" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_tutor_atomic"("p_tutor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_tutor_atomic"("p_tutor_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_tutor_atomic"("p_tutor_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finalize_consultation_atomic"("p_patient_id" "uuid", "p_consultation_id" "uuid", "p_type" "text", "p_notes" "text", "p_weight_kg" numeric, "p_completion_date" timestamp with time zone, "p_images" "text"[], "p_address" "text", "p_prescriptions" "jsonb", "p_travel_distance_km" numeric, "p_travel_fee" numeric, "p_items" "jsonb", "p_vaccinations" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finalize_consultation_atomic"("p_patient_id" "uuid", "p_consultation_id" "uuid", "p_type" "text", "p_notes" "text", "p_weight_kg" numeric, "p_completion_date" timestamp with time zone, "p_images" "text"[], "p_address" "text", "p_prescriptions" "jsonb", "p_travel_distance_km" numeric, "p_travel_fee" numeric, "p_items" "jsonb", "p_vaccinations" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finalize_consultation_atomic"("p_patient_id" "uuid", "p_consultation_id" "uuid", "p_type" "text", "p_notes" "text", "p_weight_kg" numeric, "p_completion_date" timestamp with time zone, "p_images" "text"[], "p_address" "text", "p_prescriptions" "jsonb", "p_travel_distance_km" numeric, "p_travel_fee" numeric, "p_items" "jsonb", "p_vaccinations" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."consultation_items" TO "anon";
GRANT ALL ON TABLE "public"."consultation_items" TO "authenticated";
GRANT ALL ON TABLE "public"."consultation_items" TO "service_role";



GRANT ALL ON TABLE "public"."consultations" TO "anon";
GRANT ALL ON TABLE "public"."consultations" TO "authenticated";
GRANT ALL ON TABLE "public"."consultations" TO "service_role";



GRANT ALL ON TABLE "public"."inventory" TO "anon";
GRANT ALL ON TABLE "public"."inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_items" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."patient_vaccinations" TO "anon";
GRANT ALL ON TABLE "public"."patient_vaccinations" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_vaccinations" TO "service_role";



GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."push_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."push_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."tutors" TO "anon";
GRANT ALL ON TABLE "public"."tutors" TO "authenticated";
GRANT ALL ON TABLE "public"."tutors" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







