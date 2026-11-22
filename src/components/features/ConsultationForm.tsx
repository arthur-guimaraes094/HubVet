"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { salvarProntuario, uploadConsultationImageAction } from '@/app/prontuario/actions';
import {
  gerarPDFReceituario,
  gerarPDFRelatorioAtendimento,
  PrescriptionItem,
} from '@/core/use-cases/generate-pdf';
import { getCatalogOptionLabels } from '@/core/data/vet-supplies-catalog';
import { generatePixPayload, generatePixQrCodeDataUrl } from '@/core/utils/pix';
import { buildGoogleMapsUrl } from '@/core/utils/cep';
import { formatPatientAge, formatFertilityStatus } from '@/core/utils/age';
import { translateSpecies } from '@/core/utils/translations';
import { validateImageUpload } from '@/core/utils/upload-validation';
import { compressPetPhoto } from '@/core/utils/image-compress';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import Image from 'next/image';
import { ConsultationSuccessView } from './consultation/ConsultationSuccessView';
import { ConsultationPrescriptionSection } from './consultation/ConsultationPrescriptionSection';
import {
  ConsultationVaccinationSection,
  type ConsultationVaccinationDraft,
} from './consultation/ConsultationVaccinationSection';
import {
  ConsultationSuppliesSection,
  type InventoryItem,
} from './consultation/ConsultationSuppliesSection';

export type { InventoryItem };

interface UploadedConsultationImage {
  storageRef: string;
  previewUrl: string;
}

interface ConsultationFormProps {
  inventory: InventoryItem[];
  patientId?: string;
  patientName?: string;
  tutorName?: string;
  tutorAddress?: string;
  species?: string;
  breed?: string;
  color?: string;
  birthDate?: string;
  fertilityStatus?: string;
  fertilityNotes?: string;
  clinicalObservations?: string;
  consultationId?: string;
  lastWeight?: number;
  initialType?: 'Home' | 'Hospital';
  initialTravelFee?: number;
  initialTravelDistanceKm?: number;
  initialNotes?: string;
  initialPrescriptionText?: string;
  vetName?: string;
  vetCrmv?: string;
  tutorPhone?: string;
  pixKey?: string;
  pixKeyType?: string;
}

export function ConsultationForm({
  inventory,
  patientId,
  patientName,
  tutorName,
  tutorPhone,
  tutorAddress,
  species,
  breed,
  color,
  birthDate,
  fertilityStatus,
  fertilityNotes,
  clinicalObservations,
  consultationId,
  lastWeight,
  initialType = 'Home',
  initialTravelFee,
  initialTravelDistanceKm,
  initialNotes,
  initialPrescriptionText,
  vetName,
  vetCrmv,
  pixKey,
  pixKeyType,
}: ConsultationFormProps) {
  const router = useRouter();
  const { success, error } = useToast();

  // Chave de rascunho escopada por paciente e consulta
  const draftKey = patientId
    ? `hubvet_draft_consultation_${patientId}_${consultationId || 'new'}`
    : null;

  // Valores-base vindos do servidor (garante SSR === primeira renderização no cliente)
  const safeInitialFee =
    initialTravelFee && initialTravelFee > 0 && initialTravelFee <= 500
      ? initialTravelFee
      : undefined;
  const safeInitialDistance =
    initialTravelDistanceKm && initialTravelDistanceKm > 0 && initialTravelDistanceKm <= 220
      ? initialTravelDistanceKm
      : null;

  const baseWeight = lastWeight ? String(lastWeight) : '';
  const baseNotes = initialNotes || '';
  const basePrescriptionText = initialPrescriptionText || '';
  const baseAddress = tutorAddress || '';
  const baseType: 'Home' | 'Hospital' = initialType;
  const baseTravelFee = safeInitialFee ? String(safeInitialFee) : '';
  const baseTravelDistanceKm = safeInitialDistance;
  const baseIncludeTravelFee = Boolean(safeInitialFee);

  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const [weight, setWeight] = useState<string>(baseWeight);
  const [notes, setNotes] = useState<string>(baseNotes);
  const [selectedItems, setSelectedItems] = useState<{ id: string; quantity: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [images, setImages] = useState<UploadedConsultationImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [consultationType, setConsultationType] = useState<'Home' | 'Hospital'>(baseType);

  // Endereço e Custo de Deslocamento (Consultas a Domicílio)
  const [address, setAddress] = useState<string>(baseAddress);
  const [travelDistanceKm, setTravelDistanceKm] = useState<number | null>(baseTravelDistanceKm);
  const [travelFee, setTravelFee] = useState<string>(baseTravelFee);
  const [includeTravelFee, setIncludeTravelFee] = useState<boolean>(baseIncludeTravelFee);
  const [calculatingTravel, setCalculatingTravel] = useState(false);

  // Módulo de Receitas e Vacinação
  const [prescriptionText, setPrescriptionText] = useState<string>(basePrescriptionText);
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [vaccinations, setVaccinations] = useState<ConsultationVaccinationDraft[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const inventoryRef = useRef(inventory);
  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);
  const draftLoadedRef = useRef(false);
  const finalizedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const catalogNames = useMemo(() => getCatalogOptionLabels(), []);

  // Carrega e valida o rascunho apenas após a montagem no cliente
  useEffect(() => {
    draftLoadedRef.current = false;
    finalizedRef.current = false;

    if (!draftKey || typeof window === 'undefined') {
      draftLoadedRef.current = true;
      return;
    }

    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      try {
        const raw = localStorage.getItem(draftKey);
        if (!raw) return;

        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
        const draft = parsed as Record<string, unknown>;

        let restoredDiff = false;

        if (typeof draft.weight === 'string') {
          setWeight(draft.weight);
          if (draft.weight !== baseWeight) restoredDiff = true;
        }
        if (typeof draft.notes === 'string') {
          setNotes(draft.notes);
          if (draft.notes !== baseNotes) restoredDiff = true;
        }
        if (typeof draft.prescriptionText === 'string') {
          setPrescriptionText(draft.prescriptionText);
          if (draft.prescriptionText !== basePrescriptionText) restoredDiff = true;
        }
        if (Array.isArray(draft.prescriptions)) {
          const validPrescriptions = draft.prescriptions.filter(
            (rx): rx is PrescriptionItem => {
              if (!rx || typeof rx !== 'object' || Array.isArray(rx)) return false;
              const r = rx as Record<string, unknown>;
              return (
                typeof r.id === 'string' &&
                r.id.trim().length > 0 &&
                typeof r.medicationName === 'string' &&
                r.medicationName.trim().length > 0 &&
                typeof r.route === 'string' &&
                r.route.trim().length > 0 &&
                typeof r.dosage === 'string' &&
                typeof r.frequency === 'string' &&
                typeof r.duration === 'string' &&
                (r.concentration === undefined || typeof r.concentration === 'string') &&
                (r.instructions === undefined || typeof r.instructions === 'string')
              );
            }
          );
          if (validPrescriptions.length > 0) {
            setPrescriptions(validPrescriptions);
            restoredDiff = true;
          }
        }
        if (Array.isArray(draft.vaccinations)) {
          const validProtocols = new Set([
            'V10_VANGUARD',
            'ANTIRRABICA',
            'V5_FELINA',
            'GRIPE_ORAL',
            'CUSTOM',
          ]);
          const validStages = new Set(['dose_1', 'dose_2', 'dose_3', 'annual']);
          const validVaccinations = draft.vaccinations.filter(
            (vac): vac is ConsultationVaccinationDraft => {
              if (!vac || typeof vac !== 'object' || Array.isArray(vac)) return false;
              const v = vac as Record<string, unknown>;
              return (
                typeof v.id === 'string' &&
                v.id.trim().length > 0 &&
                typeof v.protocolCode === 'string' &&
                validProtocols.has(v.protocolCode) &&
                typeof v.doseStage === 'string' &&
                validStages.has(v.doseStage) &&
                (v.customVaccineName === undefined || typeof v.customVaccineName === 'string') &&
                (v.notes === undefined || typeof v.notes === 'string') &&
                (v.customIntervalDays === undefined ||
                  (typeof v.customIntervalDays === 'number' &&
                    Number.isInteger(v.customIntervalDays) &&
                    v.customIntervalDays >= 1 &&
                    v.customIntervalDays <= 3650))
              );
            }
          );
          if (validVaccinations.length > 0) {
            setVaccinations(validVaccinations);
            restoredDiff = true;
          }
        }
        if (Array.isArray(draft.selectedItems)) {
          const validIds = new Set((inventoryRef.current || []).map((i) => i.id));
          const deduped = new Map<string, number>();
          for (const rawItem of draft.selectedItems) {
            if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) continue;
            const entry = rawItem as Record<string, unknown>;
            if (
              typeof entry.id === 'string' &&
              validIds.has(entry.id) &&
              typeof entry.quantity === 'number' &&
              Number.isInteger(entry.quantity) &&
              entry.quantity >= 1
            ) {
              deduped.set(entry.id, Math.min(1000, entry.quantity));
            }
          }
          if (deduped.size > 0) {
            setSelectedItems(
              Array.from(deduped.entries()).map(([id, quantity]) => ({ id, quantity }))
            );
            restoredDiff = true;
          }
        }
        if (typeof draft.address === 'string') {
          setAddress(draft.address);
          if (draft.address !== baseAddress) restoredDiff = true;
        }
        if (draft.consultationType === 'Home' || draft.consultationType === 'Hospital') {
          setConsultationType(draft.consultationType);
          if (draft.consultationType !== baseType) restoredDiff = true;
        }
        if (typeof draft.travelFee === 'string') {
          setTravelFee(draft.travelFee);
          if (draft.travelFee !== baseTravelFee) restoredDiff = true;
        }
        if (
          draft.travelDistanceKm === null ||
          (typeof draft.travelDistanceKm === 'number' &&
            Number.isFinite(draft.travelDistanceKm) &&
            draft.travelDistanceKm >= 0 &&
            draft.travelDistanceKm <= 500)
        ) {
          setTravelDistanceKm(draft.travelDistanceKm as number | null);
          if (draft.travelDistanceKm !== baseTravelDistanceKm) restoredDiff = true;
        }
        if (typeof draft.includeTravelFee === 'boolean') {
          setIncludeTravelFee(draft.includeTravelFee);
          if (draft.includeTravelFee !== baseIncludeTravelFee) restoredDiff = true;
        }

        if (restoredDiff) {
          setHasRestoredDraft(true);
        }
      } catch (e) {
        console.warn('Erro ao restaurar rascunho:', e);
      } finally {
        if (active) {
          draftLoadedRef.current = true;
        }
      }
    });

    return () => {
      active = false;
    };
  }, [
    draftKey,
    baseWeight,
    baseNotes,
    basePrescriptionText,
    baseAddress,
    baseType,
    baseTravelFee,
    baseTravelDistanceKm,
    baseIncludeTravelFee,
  ]);

  const isDirtyFromServer =
    notes !== baseNotes ||
    weight !== baseWeight ||
    prescriptionText !== basePrescriptionText ||
    prescriptions.length > 0 ||
    vaccinations.length > 0 ||
    selectedItems.length > 0 ||
    address !== baseAddress ||
    consultationType !== baseType ||
    travelFee !== baseTravelFee ||
    travelDistanceKm !== baseTravelDistanceKm ||
    includeTravelFee !== baseIncludeTravelFee;

  // Salvar rascunho com debounce no localStorage apenas quando houver alterações reais
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (
      !draftKey ||
      typeof window === 'undefined' ||
      !draftLoadedRef.current ||
      finalizedRef.current ||
      showSuccess ||
      !isDirtyFromServer
    ) {
      return;
    }

    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      if (finalizedRef.current) return;
      try {
        const payload = {
          notes,
          weight,
          prescriptionText,
          prescriptions,
          vaccinations,
          selectedItems,
          address,
          consultationType,
          travelFee,
          travelDistanceKm,
          includeTravelFee,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftKey, JSON.stringify(payload));
      } catch (e) {
        console.warn('Erro ao salvar rascunho:', e);
      }
    }, 700);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [
    draftKey,
    showSuccess,
    isDirtyFromServer,
    notes,
    weight,
    prescriptionText,
    prescriptions,
    vaccinations,
    selectedItems,
    address,
    consultationType,
    travelFee,
    travelDistanceKm,
    includeTravelFee,
  ]);

  const handleDiscardDraft = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (draftKey && typeof window !== 'undefined') {
      localStorage.removeItem(draftKey);
    }
    setNotes(baseNotes);
    setWeight(baseWeight);
    setPrescriptionText(basePrescriptionText);
    setPrescriptions([]);
    setVaccinations([]);
    setSelectedItems([]);
    setAddress(baseAddress);
    setConsultationType(baseType);
    setTravelDistanceKm(baseTravelDistanceKm);
    setTravelFee(baseTravelFee);
    setIncludeTravelFee(baseIncludeTravelFee);
    setHasRestoredDraft(false);
    success('Rascunho descartado.');
  };

  const handleCalculateTravelCost = async () => {
    if (!address.trim()) {
      error('Informe o endereço do atendimento domiciliar para calcular o deslocamento.');
      return;
    }
    setCalculatingTravel(true);
    try {
      const res = await fetch('/api/travel-cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationAddress: address }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        error(data.error || 'Não foi possível calcular o deslocamento.');
        return;
      }
      setTravelDistanceKm(data.roundTripKm);
      setTravelFee(String(data.recommendedFee));
      setIncludeTravelFee(true);
      success(
        `Deslocamento calculado: ${data.roundTripKm} km (ida e volta) • R$ ${Number(
          data.recommendedFee
        ).toFixed(2)}`
      );
    } catch {
      error('Erro ao calcular custo de deslocamento.');
    } finally {
      setCalculatingTravel(false);
    }
  };

  const handleAddItem = (id: string) => {
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing) {
        return prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { id, quantity: 1 }];
    });
  };

  const handleRemoveItem = (id: string) => {
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.id === id);
      if (existing && existing.quantity > 1) {
        return prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i));
      }
      return prev.filter((i) => i.id !== id);
    });
  };

  const itemsTotalCents = selectedItems.reduce((acc, item) => {
    const inventoryItem = inventory?.find((i) => i.id === item.id);
    if (!inventoryItem) return acc;
    const unitCents = Math.round(Number(inventoryItem.salePrice || 0) * 100);
    return acc + unitCents * item.quantity;
  }, 0);

  const rawParsedTravelFee =
    consultationType === 'Home' && includeTravelFee && travelFee
      ? parseFloat(travelFee.replace(',', '.')) || 0
      : 0;
  const clampedTravelFee = Number.isFinite(rawParsedTravelFee)
    ? Math.min(500, Math.max(0, rawParsedTravelFee))
    : 0;
  const travelFeeCents = Math.round(clampedTravelFee * 100);
  const totalCents = Math.max(0, itemsTotalCents + travelFeeCents);

  const parsedTravelFee = Number((travelFeeCents / 100).toFixed(2));
  const totalValue = Number((totalCents / 100).toFixed(2));

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget;
    const file = inputEl.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const validation = await validateImageUpload(file, 15 * 1024 * 1024);
      if (!validation.valid) {
        error(validation.error);
        return;
      }

      const { blob, dataUrl } = await compressPetPhoto(file, 1280, 0.85);
      const formData = new FormData();
      formData.append('image', new File([blob], 'consultation.jpg', { type: 'image/jpeg' }));

      const uploadRes = await uploadConsultationImageAction(formData);
      if (!uploadRes.success) {
        error(uploadRes.error);
        return;
      }
      if (!uploadRes.data?.storageRef) {
        error('Erro ao subir imagem');
        return;
      }

      const { storageRef, signedUrl } = uploadRes.data;
      setImages((prev) => [
        ...prev,
        {
          storageRef,
          previewUrl: signedUrl || dataUrl,
        },
      ]);
      success('Imagem adicionada!');
    } catch (err) {
      console.error(err);
      error('Erro ao subir imagem');
    } finally {
      setUploadingImage(false);
      inputEl.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const buildPdfPayload = () => {
    const fullItems = selectedItems
      .map((si) => {
        const item = inventory.find((i) => i.id === si.id);
        return { name: item?.name || 'Item', quantity: si.quantity, type: item?.type };
      })
      .filter((item) => item.type !== 'Consultation')
      .map(({ name, quantity }) => ({ name, quantity }));

    return {
      tutorName: tutorName || 'Não Informado',
      patientName: patientName || 'Não Informado',
      species: translateSpecies(species || ''),
      breed: breed || '',
      color: color || '',
      weight: weight || (lastWeight ? String(lastWeight) : ''),
      birthDate: birthDate || null,
      fertilityStatus: fertilityStatus || null,
      fertilityNotes: fertilityNotes || null,
      clinicalObservations: clinicalObservations || null,
      notes: notes,
      items: fullItems,
      prescriptions: prescriptions,
      prescriptionText: prescriptionText.trim() || undefined,
      date: new Date().toISOString(),
      vetName,
      vetCrmv,
    };
  };

  const handleDownloadRelatorioPDF = async () => {
    await gerarPDFRelatorioAtendimento(buildPdfPayload());
  };

  const handleDownloadReceituarioPDF = async () => {
    await gerarPDFReceituario(buildPdfPayload());
  };

  const handleFinalize = async () => {
    if (!patientId) {
      error('Selecione um paciente pela Busca Rápida antes de iniciar o prontuário.');
      return;
    }

    setLoading(true);
    setSubmitError(null);
    try {
      const fullItems = selectedItems.map((si) => {
        const inv = inventory.find((i) => i.id === si.id);
        return {
          id: si.id,
          name: inv?.name || 'Item',
          quantity: si.quantity,
          unitCost: inv?.unitCost || 0,
          price: inv?.salePrice || 0,
        };
      });

      const result = await salvarProntuario({
        patientId: patientId,
        notes,
        baseFee: totalValue,
        weightKg:
          weight && !isNaN(parseFloat(weight.replace(',', '.')))
            ? parseFloat(weight.replace(',', '.'))
            : lastWeight,
        items: fullItems,
        prescriptions,
        prescriptionText: prescriptionText.trim(),
        vaccinations: vaccinations.map((v) => ({
          protocolCode: v.protocolCode,
          customVaccineName: v.customVaccineName,
          doseStage: v.doseStage,
          customIntervalDays: v.customIntervalDays,
          notes: v.notes,
        })),
        consultationId: consultationId,
        completionDate: new Date().toISOString(),
        images: images.map((img) => img.storageRef),
        type: consultationType,
        address: consultationType === 'Home' ? address : undefined,
        travelDistanceKm:
          consultationType === 'Home' && includeTravelFee ? travelDistanceKm : null,
        travelFee: consultationType === 'Home' && includeTravelFee ? parsedTravelFee : 0,
      });

      if (result.success) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        finalizedRef.current = true;
        if (draftKey && typeof window !== 'undefined') {
          localStorage.removeItem(draftKey);
        }
        setShowSuccess(true);
      } else {
        error(result.error);
        setSubmitError(result.error);
      }
    } catch {
      error('Erro inesperado ao finalizar atendimento.');
      setSubmitError('Erro inesperado ao finalizar atendimento.');
    } finally {
      setLoading(false);
    }
  };

  // PIX e QR Code para tela de sucesso
  const [pixQrCodeUrl, setPixQrCodeUrl] = useState<string>('');

  const effectivePixKey = pixKey || '';
  const effectivePixType = pixKeyType || 'CPF';

  const pixPayload = useMemo(() => {
    if (!effectivePixKey || totalValue <= 0) return '';
    return generatePixPayload({
      key: effectivePixKey,
      keyType: effectivePixType,
      name: vetName || 'Dra Gabriela Soares',
      city: 'Natal',
      amount: totalValue,
    });
  }, [effectivePixKey, effectivePixType, totalValue, vetName]);

  useEffect(() => {
    let isMounted = true;
    if (pixPayload) {
      generatePixQrCodeDataUrl(pixPayload, { width: 220, margin: 1 })
        .then((url) => {
          if (isMounted) setPixQrCodeUrl(url);
        })
        .catch((err) => console.warn('Erro ao gerar QR Code PIX:', err));
    } else {
      Promise.resolve().then(() => {
        if (isMounted) setPixQrCodeUrl('');
      });
    }
    return () => {
      isMounted = false;
    };
  }, [pixPayload]);

  if (showSuccess) {
    return (
      <ConsultationSuccessView
        patientName={patientName}
        tutorName={tutorName}
        tutorPhone={tutorPhone}
        vetName={vetName}
        notes={notes}
        prescriptionText={prescriptionText}
        prescriptions={prescriptions}
        totalValue={totalValue}
        prescriptionsCount={prescriptions.length}
        effectivePixKey={effectivePixKey}
        effectivePixType={effectivePixType}
        pixPayload={pixPayload}
        pixQrCodeUrl={pixQrCodeUrl}
        onDownloadRelatorioPDF={handleDownloadRelatorioPDF}
        onDownloadReceituarioPDF={handleDownloadReceituarioPDF}
        onConfigurePix={() => router.push('/perfil')}
        onGoHome={() => router.push('/')}
        onNotifySuccess={success}
      />
    );
  }

  const ageLabel = birthDate ? formatPatientAge(birthDate) : null;
  const fertilityLabel = fertilityStatus ? formatFertilityStatus(fertilityStatus) : null;

  return (
    <Card className="flex flex-col gap-6 w-full max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex flex-col">
          <h3 className="text-xl font-extrabold text-primary">
            {patientName ? `Atendimento: ${patientName}` : 'Prontuário e Fechamento'}
          </h3>
          {tutorName && (
            <span className="text-xs font-bold text-foreground/50">
              Tutor(a): {tutorName}
              {breed ? ` • ${breed}` : ''}
              {ageLabel ? ` • 🎂 ${ageLabel}` : ''}
              {fertilityLabel ? ` • ${fertilityLabel}` : ''}
            </span>
          )}
        </div>
        {patientId && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownloadRelatorioPDF}
              className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white text-xs font-black transition-all"
              title="Pré-visualizar Relatório em PDF"
            >
              📄 Prévia Relatório
            </button>
            <button
              type="button"
              onClick={handleDownloadReceituarioPDF}
              className="px-3 py-1.5 rounded-xl bg-secondary/10 text-secondary hover:bg-secondary hover:text-white text-xs font-black transition-all"
              title="Pré-visualizar Receita em PDF"
            >
              💊 Prévia Receita
            </button>
          </div>
        )}
      </div>

      {/* Alerta de Rascunho Recuperado */}
      {hasRestoredDraft && (
        <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base shrink-0">📝</span>
            <span className="text-xs font-bold text-foreground/85 truncate sm:overflow-visible">
              Rascunho não finalizado restaurado automaticamente deste dispositivo.
            </span>
          </div>
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="text-[11px] font-black text-error hover:underline px-2.5 py-1 rounded-lg bg-error/10 hover:bg-error/20 transition-colors shrink-0"
          >
            Descartar Rascunho
          </button>
        </div>
      )}

      {!patientId && (
        <div className="p-3 bg-error/10 text-error rounded-xl text-sm font-bold text-center">
          Você não selecionou um paciente. Volte à página inicial e pesquise na Busca Rápida.
        </div>
      )}

      {/* Alerta de Alergias e Observações Clínicas do Paciente */}
      {clinicalObservations && (
        <div className="p-3.5 rounded-2xl bg-error/10 border border-error/25 flex items-start gap-3">
          <span className="text-lg leading-none">⚠️</span>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-error">
              Alerta Clínico / Alergias do Paciente
            </span>
            <p className="text-xs font-bold text-foreground/90 mt-0.5">
              {clinicalObservations}
            </p>
          </div>
        </div>
      )}

      {!consultationId && (
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-foreground/70 uppercase tracking-wider pl-1">
            Tipo de Atendimento
          </label>
          <div className="flex p-1 bg-foreground/5 rounded-2xl border border-border/70 gap-1">
            {(['Home', 'Hospital'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setConsultationType(t)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-[transform,background-color,color] duration-150 active:scale-[0.98] flex items-center justify-center gap-2 ${
                  consultationType === t
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-foreground/70 hover:text-foreground hover:bg-foreground/5'
                }`}
              >
                {t === 'Home' ? '🏠 Domicílio' : '🏥 Consultório / Hospital'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Seção de Domicílio: Endereço, Mapa e Calculadora de Custo de Deslocamento */}
      {consultationType === 'Home' && (
        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/15 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
              🚗 Atendimento a Domicílio & Deslocamento
            </span>
            {address.trim() && (
              <a
                href={buildGoogleMapsUrl(address)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-black hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm"
              >
                🗺️ Abrir no Mapa
              </a>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 items-end">
            <div className="flex-1 w-full">
              <Input
                label="Endereço do Atendimento"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, Número, Bairro, Cidade - UF ou CEP"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCalculateTravelCost}
              disabled={calculatingTravel || !address.trim()}
              className="py-3! px-4! text-xs font-black whitespace-nowrap w-full sm:w-auto"
            >
              {calculatingTravel ? 'Calculando...' : '🧮 Calcular Deslocamento'}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-primary/10">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-foreground/80">
              <input
                type="checkbox"
                checked={includeTravelFee}
                onChange={(e) => setIncludeTravelFee(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary w-4 h-4"
              />
              Incluir taxa de deslocamento no valor da consulta
              {travelDistanceKm ? (
                <span className="text-[11px] font-black text-primary">
                  ({travelDistanceKm} km ida e volta)
                </span>
              ) : null}
            </label>

            {includeTravelFee && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground/60">Taxa (R$):</span>
                <input
                  type="number"
                  step="0.50"
                  value={travelFee}
                  onChange={(e) => setTravelFee(e.target.value)}
                  placeholder="0.00"
                  className="w-24 bg-background border border-border rounded-xl px-3 py-1.5 text-xs font-black text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Evolução Clínica / Anamnese (Relatório de Atendimento) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-foreground/80">
            Anamnese, Exame Físico e Evolução Clínica
          </h4>
          <span className="text-[10px] font-black uppercase tracking-wider text-foreground/40">
            Sai no Relatório Clínico
          </span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-foreground/5 border border-border rounded-xl p-4 shadow-inner min-h-[130px] focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground resize-y text-sm"
          placeholder="Descreva a anamnese, parâmetros vitais (FC, FR, TR, TPC), exame físico, suspeita clínica e recomendações gerais ao tutor..."
        />
      </div>

      {/* Peso do Animal */}
      <div className="flex flex-col gap-2">
        <Input
          label="Peso Atual do Paciente (kg)"
          type="number"
          step="0.1"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder={lastWeight ? `Último peso: ${lastWeight} kg` : 'Ex: 12.5'}
        />
      </div>

      <ConsultationPrescriptionSection
        prescriptionText={prescriptionText}
        onPrescriptionTextChange={setPrescriptionText}
        prescriptions={prescriptions}
        onPrescriptionsChange={setPrescriptions}
        catalogNames={catalogNames}
        onNotifySuccess={success}
        onNotifyError={error}
      />

      <ConsultationVaccinationSection
        species={species}
        vaccinations={vaccinations}
        onVaccinationsChange={setVaccinations}
        onNotifySuccess={success}
        onNotifyError={error}
      />

      {/* Imagens e Anexos */}
      <div className="flex flex-col gap-3">
        <h4 className="font-bold text-foreground/80 flex items-center gap-2">
          Imagens e Anexos
          {uploadingImage && (
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          )}
        </h4>
        <div className="flex flex-wrap gap-4">
          {images.map((img, i) => (
            <div
              key={`${img.storageRef}-${i}`}
              className="relative group w-24 h-24 rounded-2xl overflow-hidden shadow-inner border border-border bg-foreground/5"
            >
              <Image
                src={img.previewUrl}
                alt={`Anexo ${i + 1}`}
                fill
                sizes="96px"
                unoptimized
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                aria-label={`Remover anexo ${i + 1}`}
                className="absolute inset-0 bg-error/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
          <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-foreground/10 hover:border-primary/40 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer group">
            <svg
              className="w-6 h-6 text-foreground/20 group-hover:text-primary transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="text-[10px] font-black text-foreground/30 group-hover:text-primary/60 uppercase tracking-tighter">
              Adicionar
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={uploadingImage}
            />
          </label>
        </div>
      </div>

      <ConsultationSuppliesSection
        inventory={inventory}
        selectedItems={selectedItems}
        onAddItem={handleAddItem}
        onRemoveItem={handleRemoveItem}
        catalogNames={catalogNames}
        parentLoading={loading}
        onNotifySuccess={success}
        onNotifyError={error}
      />

      {/* Resumo Financeiro da Consulta */}
      <div className="mt-4 p-8 rounded-3xl bg-gradient-to-br from-success/5 to-success/15 border border-success/20 shadow-sm flex flex-col items-center justify-center gap-2 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-success/10 transition-colors"></div>
        <span className="text-xs font-black text-success/60 uppercase tracking-[0.2em] relative z-10">
          Valor Total do Atendimento
        </span>
        <div className="flex items-baseline gap-1 relative z-10">
          <span className="text-lg font-black text-success/60">R$</span>
          <span className="text-5xl font-extrabold text-success tracking-tighter flex items-baseline">
            {Math.floor(totalCents / 100)}
            <span className="text-3xl opacity-60">
              ,{String(totalCents % 100).padStart(2, '0')}
            </span>
          </span>
        </div>
        {travelFeeCents > 0 && (
          <span className="text-xs font-bold text-success/80 relative z-10">
            Insumos/Serviços: R$ {(itemsTotalCents / 100).toFixed(2)} + Deslocamento: R${' '}
            {(travelFeeCents / 100).toFixed(2)}
          </span>
        )}
      </div>

      {submitError && (
        <div className="mt-2 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm font-bold text-center animate-in fade-in slide-in-from-bottom-2">
          {submitError}
        </div>
      )}

      <Button
        variant="primary"
        onClick={handleFinalize}
        disabled={loading || uploadingImage || !patientId}
        className="mt-2 py-4 text-lg font-black"
      >
        {loading ? 'Salvando Prontuário...' : 'Finalizar Atendimento & Gerar Documentos'}
      </Button>
    </Card>
  );
}
