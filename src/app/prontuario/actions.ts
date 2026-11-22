'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResponse } from '@/core/types/actions'
import { calculateVaccineSchedule } from '@/core/use-cases/vaccine-protocols'

const prescriptionItemSchema = z.object({
  id: z.string(),
  medicationName: z.string(),
  concentration: z.string().optional(),
  dosage: z.string(),
  route: z.string(),
  frequency: z.string(),
  duration: z.string(),
  instructions: z.string().optional(),
})

const vaccinationAppliedSchema = z.object({
  protocolCode: z.enum(['V10_VANGUARD', 'ANTIRRABICA', 'V5_FELINA', 'GRIPE_ORAL', 'CUSTOM']),
  customVaccineName: z.string().optional(),
  doseStage: z.enum(['dose_1', 'dose_2', 'dose_3', 'annual']),
  customIntervalDays: z.number().optional(),
  notes: z.string().optional(),
})

const prontuarioSchema = z.object({
  patientId: z.string().min(1, 'Paciente é obrigatório'),
  notes: z.string().optional().default(''),
  baseFee: z.number().min(0, 'Taxa base não pode ser negativa'),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number().positive('Quantidade deve ser maior que zero'),
    unitCost: z.number().min(0, 'Custo unitário não pode ser negativo'),
    price: z.number().min(0, 'Preço não pode ser negativo')
  })).optional().default([]),
  prescriptionText: z.string().optional().default(''),
  prescriptions: z.array(prescriptionItemSchema).optional().default([]),
  vaccinations: z.array(vaccinationAppliedSchema).optional().default([]),
  consultationId: z.string().optional(),
  weightKg: z.number().optional(),
  completionDate: z.string().optional(),
  images: z.array(z.string()).optional(),
  type: z.enum(['Home', 'Hospital']),
  address: z.string().optional(),
  travelDistanceKm: z.number().optional().nullable(),
  travelFee: z.number().optional().nullable(),
})

export async function salvarProntuario(rawData: unknown): Promise<ActionResponse<{ consultationId: string }>> {
  try {
    const result = prontuarioSchema.safeParse(rawData)
    if (!result.success) {
      return { success: false, error: 'Dados inválidos', fieldErrors: result.error.flatten().fieldErrors }
    }
    const data = result.data

    const supabase = await createClient()

    // Pegar usuário autenticado
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) return { success: false, error: 'Não autenticado' }

    const profileId = userData.user.id
    let consultationId = data.consultationId

    const basePayload = {
      clinical_notes: data.notes,
      base_fee: data.baseFee,
      weight_kg: data.weightKg,
      status: 'Completed' as const,
      date: data.completionDate || new Date().toISOString(),
      images: data.images || [],
      address: data.address || null,
    }

    const prescriptionsPayload = data.prescriptionText?.trim()
      ? { text: data.prescriptionText.trim(), items: data.prescriptions || [] }
      : data.prescriptions || []

    const extendedPayload = {
      ...basePayload,
      prescriptions: prescriptionsPayload,
      travel_distance_km: data.travelDistanceKm ?? null,
      travel_fee: data.travelFee ?? 0,
    }

    if (consultationId) {
      if (!z.string().uuid().safeParse(consultationId).success) {
        return { success: false, error: 'ID de consulta inválido.' }
      }

      const { data: existingConsultation, error: fetchError } = await supabase
        .from('consultations')
        .select('id, status')
        .eq('id', consultationId)
        .eq('profile_id', profileId)
        .single()

      if (fetchError || !existingConsultation) {
        return { success: false, error: 'Consulta não encontrada.' }
      }

      if (existingConsultation.status === 'Completed') {
        return { success: false, error: 'Este atendimento já foi finalizado anteriormente.' }
      }

      // 1a. Atualizar consulta existente (vinda da agenda)
      let { error: updateError } = await supabase
        .from('consultations')
        .update(extendedPayload)
        .eq('id', consultationId)
        .eq('profile_id', profileId)

      if (
        updateError &&
        (updateError.code === '42703' || updateError.code === 'PGRST204')
      ) {
        const fallback = await supabase
          .from('consultations')
          .update(basePayload)
          .eq('id', consultationId)
          .eq('profile_id', profileId)
        updateError = fallback.error
      }

      if (updateError) return { success: false, error: 'Erro ao atualizar consulta agendada' }
    } else {
      // 1b. Inserir nova consulta
      let { data: consultation, error: consultError } = await supabase
        .from('consultations')
        .insert({
          profile_id: profileId,
          patient_id: data.patientId,
          type: data.type,
          ...extendedPayload,
        })
        .select('id')
        .single()

      if (
        consultError &&
        (consultError.code === '42703' || consultError.code === 'PGRST204')
      ) {
        const fallback = await supabase
          .from('consultations')
          .insert({
            profile_id: profileId,
            patient_id: data.patientId,
            type: data.type,
            ...basePayload,
          })
          .select('id')
          .single()
        consultation = fallback.data
        consultError = fallback.error
      }

      if (consultError || !consultation) {
        return { success: false, error: 'Erro ao salvar consulta' }
      }
      consultationId = consultation.id
    }

    // Atualizar o peso atual do paciente
    if (data.weightKg) {
      const { error: weightError } = await supabase
        .from('patients')
        .update({ weight_kg: data.weightKg })
        .eq('id', data.patientId)
      if (weightError) {
        console.error('Patient weight update error:', weightError)
      }
    }

    const criticalErrors: string[] = []

    // 1c. Registrar protocolos vacinais aplicados nesta consulta (se houver)
    if (data.vaccinations && data.vaccinations.length > 0) {
      const todayStr = (data.completionDate || new Date().toISOString()).split('T')[0]

      for (const vac of data.vaccinations) {
        const schedule = calculateVaccineSchedule({
          protocolCode: vac.protocolCode,
          customVaccineName: vac.customVaccineName,
          doseStage: vac.doseStage,
          appliedDate: todayStr,
          customIntervalDays: vac.customIntervalDays,
        })

        // Verificar dose anterior aberta do mesmo protocolo para este paciente
        const { data: openPrevious } = await supabase
          .from('patient_vaccinations')
          .select('id')
          .eq('patient_id', data.patientId)
          .eq('protocol_code', schedule.protocolCode)
          .is('completed_by_vaccination_id', null)

        const { data: insertedVac, error: vacError } = await supabase
          .from('patient_vaccinations')
          .insert({
            profile_id: profileId,
            patient_id: data.patientId,
            consultation_id: consultationId,
            protocol_code: schedule.protocolCode,
            vaccine_name: schedule.vaccineName,
            dose_number: schedule.doseNumber,
            total_initial_doses: schedule.totalInitialDoses,
            is_annual_booster: schedule.isAnnualBooster,
            applied_date: schedule.appliedDate,
            next_due_date: schedule.nextDueDate,
            next_dose_label: schedule.nextDoseLabel,
            notes: vac.notes || 'Aplicada durante atendimento clínico',
          })
          .select('id')
          .single()

        if (vacError) {
          console.error('Vaccination insert error:', vacError)
        } else if (insertedVac && openPrevious && openPrevious.length > 0) {
          const prevIds = openPrevious.map(r => r.id)
          const { error: closePrevError } = await supabase
            .from('patient_vaccinations')
            .update({ completed_by_vaccination_id: insertedVac.id })
            .in('id', prevIds)
          if (closePrevError) {
            console.error('Close previous vaccination error:', closePrevError)
          }
        }
      }
    }

    // 2. Inserir os itens em batch
    const itemsToInsert = data.items
      .filter(item => item.quantity > 0)
      .map(item => ({
        consultation_id: consultationId!,
        inventory_id: item.id,
        quantity: item.quantity,
        applied_cost: item.unitCost,
        is_prescribed: false
      }))

    if (itemsToInsert.length > 0) {
      const { error: itemsInsertError } = await supabase
        .from('consultation_items')
        .insert(itemsToInsert)
      if (itemsInsertError) {
        console.error('Consultation items insert error:', itemsInsertError)
        criticalErrors.push('consultation_items')
      }
    }

    const totalCost = data.items.reduce(
      (acc, item) => acc + (item.quantity > 0 ? item.quantity * item.unitCost : 0),
      0
    )

    // 3. Salvar transações financeiras em paralelo (baseFee já inclui travelFee)
    const totalServiceIncome = data.baseFee || 0
    const transactionPromises = [
      supabase.from('transactions').insert({
        profile_id: profileId,
        consultation_id: consultationId,
        type: 'Income',
        category: 'Service',
        amount: totalServiceIncome,
        date: new Date().toISOString()
      })
    ]

    if (totalCost > 0) {
      transactionPromises.push(
        supabase.from('transactions').insert({
          profile_id: profileId,
          consultation_id: consultationId,
          type: 'Expense',
          category: 'Supplies',
          amount: totalCost,
          date: new Date().toISOString()
        })
      )
    }

    const transactionResults = await Promise.all(transactionPromises)
    transactionResults.forEach((res, idx) => {
      if (res.error) {
        console.error(`Transaction insert error (#${idx}):`, res.error)
        criticalErrors.push('transactions')
      }
    })

    // 4. Criar a Fatura (Invoice) para o Cliente (baseFee já inclui travelFee)
    const effectiveInvoiceTotal = data.baseFee || 0
    if (effectiveInvoiceTotal > 0) {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          patient_id: data.patientId,
          total_amount: effectiveInvoiceTotal,
          status: 'pending',
        })
        .select('id')
        .single()

      if (invoiceError) {
        console.error('Invoice creation error:', invoiceError)
        criticalErrors.push('invoices')
      }

      if (invoice && invoice.id) {
        const invoiceItemsToInsert = data.items
          .filter(item => item.quantity > 0)
          .map(item => ({
            invoice_id: invoice.id,
            description: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            total_price: item.price * item.quantity
          }))

        if (data.travelFee && data.travelFee > 0) {
          invoiceItemsToInsert.push({
            invoice_id: invoice.id,
            description: data.travelDistanceKm
              ? `Taxa de Deslocamento Domiciliar (${data.travelDistanceKm} km ida e volta)`
              : 'Taxa de Deslocamento Domiciliar',
            quantity: 1,
            unit_price: data.travelFee,
            total_price: data.travelFee,
          })
        }
        
        if (invoiceItemsToInsert.length > 0) {
          const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItemsToInsert)
          if (itemsError) {
            console.error('Invoice items error:', itemsError)
            criticalErrors.push('invoice_items')
          }
        }
      }
    }

    revalidatePath('/')
    revalidatePath('/prontuario')
    revalidatePath('/agenda')
    revalidatePath('/financeiro')
    if (data.patientId) revalidatePath(`/pacientes/${data.patientId}`)

    if (criticalErrors.length > 0) {
      return {
        success: false,
        error:
          'Prontuário salvo, mas houve erro ao gravar itens ou faturamento. Confira no Financeiro antes de tentar novamente.',
      }
    }

    return { success: true, data: { consultationId } }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno do servidor'
    console.error('CRITICAL SERVER ACTION ERROR:', err)
    return { success: false, error: errorMessage }
  }
}
