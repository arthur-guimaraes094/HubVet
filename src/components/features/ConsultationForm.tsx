"use client";

import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { salvarProntuario } from '@/app/prontuario/actions';
import { addInventoryItem } from '@/app/estoque/actions';
import {
  gerarPDFReceituario,
  gerarPDFRelatorioAtendimento,
  PrescriptionItem,
} from '@/core/use-cases/generate-pdf';
import {
  VaccineProtocolCode,
  calculateVaccineSchedule,
} from '@/core/use-cases/vaccine-protocols';
import { VET_SUPPLIES_CATALOG } from '@/core/data/vet-supplies-catalog';
import { buildGoogleMapsUrl } from '@/core/utils/cep';
import { formatPatientAge, formatFertilityStatus } from '@/core/utils/age';
import { translateSpecies } from '@/core/utils/translations';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/infrastructure/database/client';
import Image from 'next/image';

export type InventoryItem = {
  id: string;
  name: string;
  type: 'Medication' | 'Vaccine' | 'Material' | 'Consultation';
  unitCost: number;
  salePrice: number;
  concentration?: string;
};

interface ConsultationVaccinationDraft {
  id: string;
  protocolCode: VaccineProtocolCode;
  customVaccineName?: string;
  doseStage: 'dose_1' | 'dose_2' | 'dose_3' | 'annual';
  customIntervalDays?: number;
  notes?: string;
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
  vetName?: string;
  vetCrmv?: string;
}

export function ConsultationForm({
  inventory,
  patientId,
  patientName,
  tutorName,
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
  vetName,
  vetCrmv,
}: ConsultationFormProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const [weight, setWeight] = useState<string>(lastWeight ? String(lastWeight) : '');
  const [notes, setNotes] = useState<string>(initialNotes || '');
  const [selectedItems, setSelectedItems] = useState<{ id: string; quantity: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [consultationType, setConsultationType] = useState<'Home' | 'Hospital'>(initialType);

  // Endereço e Custo de Deslocamento (Consultas a Domicílio)
  const [address, setAddress] = useState<string>(tutorAddress || '');
  const [travelDistanceKm, setTravelDistanceKm] = useState<number | null>(
    initialTravelDistanceKm ?? null
  );
  const [travelFee, setTravelFee] = useState<string>(
    initialTravelFee && initialTravelFee > 0 ? String(initialTravelFee) : ''
  );
  const [includeTravelFee, setIncludeTravelFee] = useState<boolean>(
    Boolean(initialTravelFee && initialTravelFee > 0)
  );
  const [calculatingTravel, setCalculatingTravel] = useState(false);

  // Módulo de Receitas (Prescrição Domiciliar)
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [showRxForm, setShowRxForm] = useState(false);
  const [rxMedication, setRxMedication] = useState('');
  const [rxConcentration, setRxConcentration] = useState('');
  const [rxRoute, setRxRoute] = useState('Uso Oral');
  const [rxDosage, setRxDosage] = useState('');
  const [rxFrequency, setRxFrequency] = useState('');
  const [rxDuration, setRxDuration] = useState('');
  const [rxInstructions, setRxInstructions] = useState('');

  // Registro de Protocolo Vacinal na Consulta
  const [vaccinations, setVaccinations] = useState<ConsultationVaccinationDraft[]>([]);
  const [showVacForm, setShowVacForm] = useState(false);
  const [vacProtocol, setVacProtocol] = useState<VaccineProtocolCode>(
    species === 'Feline' ? 'V5_FELINA' : 'V10_VANGUARD'
  );
  const [vacDoseStage, setVacDoseStage] = useState<'dose_1' | 'dose_2' | 'dose_3' | 'annual'>(
    'dose_1'
  );
  const [vacCustomName, setVacCustomName] = useState('');
  const [vacCustomInterval, setVacCustomInterval] = useState('365');

  // Estados para novo item ad-hoc no catálogo
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemConcentration, setNewItemConcentration] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('Medication');

  const catalogNames = useMemo(
    () => Array.from(new Set(VET_SUPPLIES_CATALOG.map((c) => c.name))),
    []
  );

  const handleSelectRxCatalogItem = (val: string) => {
    setRxMedication(val);
    const match = VET_SUPPLIES_CATALOG.find(
      (c) => c.name.toLowerCase() === val.toLowerCase()
    );
    if (match) {
      if (match.concentration) setRxConcentration(match.concentration);
      if (match.defaultRoute) setRxRoute(match.defaultRoute);
      if (match.defaultFrequency) setRxFrequency(match.defaultFrequency);
      if (match.defaultDuration) setRxDuration(match.defaultDuration);
    }
  };

  const handleAddPrescription = () => {
    if (!rxMedication.trim()) {
      error('Informe o nome do medicamento para a receita.');
      return;
    }
    if (!rxDosage.trim() && !rxFrequency.trim()) {
      error('Informe ao menos a dose ou frequência de administração.');
      return;
    }

    const newRx: PrescriptionItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      medicationName: rxMedication.trim(),
      concentration: rxConcentration.trim() || undefined,
      route: rxRoute.trim() || 'Uso Oral',
      dosage: rxDosage.trim(),
      frequency: rxFrequency.trim(),
      duration: rxDuration.trim(),
      instructions: rxInstructions.trim() || undefined,
    };

    setPrescriptions((prev) => [...prev, newRx]);
    setRxMedication('');
    setRxConcentration('');
    setRxDosage('');
    setRxFrequency('');
    setRxDuration('');
    setRxInstructions('');
    setShowRxForm(false);
    success('Medicamento adicionado ao receituário!');
  };

  const handleRemovePrescription = (id: string) => {
    setPrescriptions((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddVaccinationDraft = () => {
    if (vacProtocol === 'CUSTOM' && !vacCustomName.trim()) {
      error('Informe o nome da vacina personalizada.');
      return;
    }
    const draft: ConsultationVaccinationDraft = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      protocolCode: vacProtocol,
      customVaccineName: vacProtocol === 'CUSTOM' ? vacCustomName.trim() : undefined,
      doseStage: vacDoseStage,
      customIntervalDays:
        vacProtocol === 'CUSTOM' ? parseInt(vacCustomInterval, 10) || 365 : undefined,
    };
    setVaccinations((prev) => [...prev, draft]);
    setShowVacForm(false);
    setVacCustomName('');
    success('Protocolo vacinal adicionado ao atendimento!');
  };

  const handleRemoveVaccinationDraft = (id: string) => {
    setVaccinations((prev) => prev.filter((v) => v.id !== id));
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

  const handleSelectCatalogForNewItem = (val: string) => {
    setNewItemName(val);
    const match = VET_SUPPLIES_CATALOG.find(
      (c) => c.name.toLowerCase() === val.toLowerCase()
    );
    if (match) {
      if (match.concentration) setNewItemConcentration(match.concentration);
      if (match.category === 'Vaccine') setNewItemCategory('Vaccine');
      else if (match.category === 'Medication') setNewItemCategory('Medication');
      else if (match.category === 'Consultation') setNewItemCategory('Consultation');
      else setNewItemCategory('Material');
    }
  };

  const handleAddNewInventoryItem = async () => {
    if (!newItemName || !newItemPrice) {
      error('Preencha nome e valor de aplicação do novo item.');
      return;
    }

    try {
      setLoading(true);
      const result = await addInventoryItem({
        name: newItemName,
        type: newItemCategory as 'Medication' | 'Vaccine' | 'Material' | 'Consultation',
        concentration: newItemConcentration,
        unitCost: parseFloat(newItemPrice) * 0.5,
        salePrice: parseFloat(newItemPrice),
      });

      if (result.success) {
        success(`${newItemName} cadastrado no catálogo!`);
        setNewItemName('');
        setNewItemPrice('');
        setNewItemConcentration('');
        setShowNewItemForm(false);
        router.refresh();
      } else {
        error(result.error);
      }
    } catch {
      error('Erro ao cadastrar novo item.');
    } finally {
      setLoading(false);
    }
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

  const itemsTotalValue = selectedItems.reduce((acc, item) => {
    const inventoryItem = inventory?.find((i) => i.id === item.id);
    return acc + (inventoryItem ? inventoryItem.salePrice * item.quantity : 0);
  }, 0);

  const parsedTravelFee =
    consultationType === 'Home' && includeTravelFee && travelFee
      ? parseFloat(travelFee.replace(',', '.')) || 0
      : 0;

  const totalValue = itemsTotalValue + parsedTravelFee;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      error('Imagem muito grande (máx 5MB)');
      return;
    }

    setUploadingImage(true);
    try {
      const supabase = createClient();
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('consultations')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('consultations').getPublicUrl(fileName);

      setImages((prev) => [...prev, publicUrl]);
      success('Imagem adicionada!');
    } catch (err) {
      console.error(err);
      error('Erro ao subir imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const [showSuccess, setShowSuccess] = useState(false);

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
        vaccinations: vaccinations.map((v) => ({
          protocolCode: v.protocolCode,
          customVaccineName: v.customVaccineName,
          doseStage: v.doseStage,
          customIntervalDays: v.customIntervalDays,
          notes: v.notes,
        })),
        consultationId: consultationId,
        completionDate: new Date().toISOString(),
        images: images,
        type: consultationType,
        address: consultationType === 'Home' ? address : undefined,
        travelDistanceKm:
          consultationType === 'Home' && includeTravelFee ? travelDistanceKm : null,
        travelFee: consultationType === 'Home' && includeTravelFee ? parsedTravelFee : 0,
      });

      if (result.success) {
        setShowSuccess(true);
      } else {
        error(result.error);
        setSubmitError(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const [searchTerm, setSearchTerm] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const previewSchedule = useMemo(() => {
    return calculateVaccineSchedule({
      protocolCode: vacProtocol,
      customVaccineName: vacCustomName || 'Vacina Personalizada',
      doseStage: vacDoseStage,
      appliedDate: todayStr,
      customIntervalDays: parseInt(vacCustomInterval, 10) || 365,
    });
  }, [vacProtocol, vacCustomName, vacDoseStage, todayStr, vacCustomInterval]);

  if (showSuccess) {
    return (
      <Card className="flex flex-col items-center justify-center gap-8 py-14 text-center w-full max-w-2xl mx-auto animate-in zoom-in-95 duration-500">
        <div className="text-6xl animate-bounce">✅</div>
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-black text-foreground tracking-tight">
            Atendimento Finalizado!
          </h2>
          <p className="text-foreground/50 font-medium text-sm max-w-md mx-auto">
            O prontuário, prescrições e protocolos vacinais foram salvos com sucesso. Gere abaixo os documentos oficiais em PDF no papel timbrado:
          </p>
        </div>

        <div className="flex flex-col gap-3.5 w-full max-w-md px-4">
          <Button
            variant="primary"
            onClick={handleDownloadRelatorioPDF}
            className="w-full py-4 text-base font-black shadow-sm flex items-center justify-center gap-3"
          >
            📄 Baixar Relatório de Atendimento (PDF)
          </Button>

          <Button
            variant="primary"
            onClick={handleDownloadReceituarioPDF}
            className="w-full py-4 text-base font-black bg-secondary! hover:bg-secondary/90! text-white shadow-sm flex items-center justify-center gap-3"
          >
            💊 Baixar Receituário Veterinário (PDF)
            {prescriptions.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-black">
                {prescriptions.length}
              </span>
            )}
          </Button>

          <Button
            variant="secondary"
            onClick={() => router.push('/')}
            className="w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2 mt-2"
          >
            Voltar ao Início
          </Button>
        </div>
      </Card>
    );
  }

  const filteredInventory =
    inventory?.filter(
      (item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.type.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

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
          <label className="text-sm font-bold text-foreground/60 ml-1">
            Tipo de Atendimento
          </label>
          <div className="flex gap-4">
            {(['Home', 'Hospital'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setConsultationType(t)}
                className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                  consultationType === t
                    ? 'bg-primary text-white shadow-inner border border-border'
                    : 'bg-background text-foreground shadow-sm border border-border hover:bg-foreground/5'
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
            Sai no Relatório e Receita
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

      {/* Módulo de Receitas (Prescrição Domiciliar Estruturada) */}
      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-foreground/[0.02] border border-border">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="font-extrabold text-foreground text-base flex items-center gap-2">
              💊 Módulo de Receitas (Prescrição Domiciliar)
              {prescriptions.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-black">
                  {prescriptions.length}
                </span>
              )}
            </h4>
            <p className="text-xs text-foreground/50 font-medium">
              Adicione os medicamentos prescritos com posologia para gerar o Receituário no papel timbrado
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRxForm(!showRxForm)}
            className="text-xs font-black text-white bg-primary px-3.5 py-2 rounded-xl hover:bg-primary/90 transition-colors shrink-0"
          >
            {showRxForm ? 'Cancelar' : '+ Prescrever Medicamento'}
          </button>
        </div>

        {showRxForm && (
          <div className="p-4 rounded-2xl bg-card border border-primary/20 flex flex-col gap-3 mt-1 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <AutocompleteInput
                  label="Medicamento *"
                  value={rxMedication}
                  onChange={handleSelectRxCatalogItem}
                  options={catalogNames}
                  placeholder="Digite ou busque (Ex: Dipirona, Agemoxi, Maxicam...)"
                />
              </div>
              <Input
                label="Concentração"
                value={rxConcentration}
                onChange={(e) => setRxConcentration(e.target.value)}
                placeholder="Ex: 50mg, 500mg/ml"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground/85">
                  Via de Administração
                </label>
                <select
                  value={rxRoute}
                  onChange={(e) => setRxRoute(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="Uso Oral">Uso Oral</option>
                  <option value="Uso Tópico">Uso Tópico</option>
                  <option value="Uso Otológico">Uso Otológico</option>
                  <option value="Uso Oftálmico">Uso Oftálmico</option>
                  <option value="Uso Subcutâneo">Uso Subcutâneo</option>
                  <option value="Uso Intranasal / Inalatório">Uso Intranasal / Inalatório</option>
                </select>
              </div>
              <Input
                label="Dose *"
                value={rxDosage}
                onChange={(e) => setRxDosage(e.target.value)}
                placeholder="Ex: 1 comprimido, 12 gotas"
              />
              <Input
                label="Frequência *"
                value={rxFrequency}
                onChange={(e) => setRxFrequency(e.target.value)}
                placeholder="Ex: A cada 12 horas (BID)"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Período / Duração"
                value={rxDuration}
                onChange={(e) => setRxDuration(e.target.value)}
                placeholder="Ex: Durante 7 dias"
              />
              <Input
                label="Observações (Opcional)"
                value={rxInstructions}
                onChange={(e) => setRxInstructions(e.target.value)}
                placeholder="Ex: Administrar após alimentação"
              />
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={handleAddPrescription}
              className="w-full py-2.5 text-xs font-black"
            >
              Adicionar à Receita
            </Button>
          </div>
        )}

        {prescriptions.length > 0 && (
          <div className="flex flex-col gap-2 mt-1">
            {prescriptions.map((rx, idx) => (
              <div
                key={rx.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-primary">
                      {idx + 1}. {rx.medicationName}
                    </span>
                    {rx.concentration && (
                      <span className="text-[11px] font-bold text-foreground/60">
                        ({rx.concentration})
                      </span>
                    )}
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                      {rx.route}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/75 font-medium">
                    {[rx.dosage && `Dose: ${rx.dosage}`, rx.frequency, rx.duration]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                  {rx.instructions && (
                    <p className="text-[11px] text-foreground/50 italic">
                      Obs: {rx.instructions}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePrescription(rx.id)}
                  className="text-xs font-bold text-error hover:underline px-2 py-1 shrink-0"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Protocolos Vacinais Aplicados na Consulta */}
      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-foreground/[0.02] border border-border">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="font-extrabold text-foreground text-base flex items-center gap-2">
              💉 Protocolo Vacinal Aplicado
              {vaccinations.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-success/15 text-success text-xs font-black">
                  {vaccinations.length}
                </span>
              )}
            </h4>
            <p className="text-xs text-foreground/50 font-medium">
              Agenda automaticamente o retorno (+21 dias para V10/V5 inicial ou +1 ano para reforço anual)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowVacForm(!showVacForm)}
            className="text-xs font-black text-primary bg-primary/10 px-3.5 py-2 rounded-xl hover:bg-primary/20 transition-colors shrink-0"
          >
            {showVacForm ? 'Cancelar' : '+ Programar Vacina'}
          </button>
        </div>

        {showVacForm && (
          <div className="p-4 rounded-2xl bg-card border border-primary/20 flex flex-col gap-3 mt-1 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground/85">
                  Protocolo Vacinal
                </label>
                <select
                  value={vacProtocol}
                  onChange={(e) => {
                    const code = e.target.value as VaccineProtocolCode;
                    setVacProtocol(code);
                    if (code === 'ANTIRRABICA' || code === 'GRIPE_ORAL') {
                      setVacDoseStage('dose_1');
                    }
                  }}
                  className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="V10_VANGUARD">V10 Vanguard (Canino - 3 doses 21d + Anual)</option>
                  <option value="ANTIRRABICA">Vacina Antirrábica (Dose única Anual)</option>
                  <option value="V5_FELINA">V5 Viral Felina (Felino - 3 doses 21d + Anual)</option>
                  <option value="GRIPE_ORAL">Vacina Gripe Oral (Dose única Anual)</option>
                  <option value="CUSTOM">Outra Vacina Personalizada</option>
                </select>
              </div>

              {(vacProtocol === 'V10_VANGUARD' || vacProtocol === 'V5_FELINA') && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-foreground/85">
                    Etapa do Protocolo
                  </label>
                  <select
                    value={vacDoseStage}
                    onChange={(e) =>
                      setVacDoseStage(
                        e.target.value as 'dose_1' | 'dose_2' | 'dose_3' | 'annual'
                      )
                    }
                    className="w-full bg-card border border-border rounded-xl px-3.5 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="dose_1">1ª Dose Inicial (Retorno em 21 dias)</option>
                    <option value="dose_2">2ª Dose Inicial (Retorno em 21 dias)</option>
                    <option value="dose_3">3ª Dose Final (Reforço em 1 ano)</option>
                    <option value="annual">Reforço Anual (Retorno em 1 ano)</option>
                  </select>
                </div>
              )}

              {(vacProtocol === 'ANTIRRABICA' || vacProtocol === 'GRIPE_ORAL') && (
                <div className="flex flex-col justify-end">
                  <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/15 text-xs font-bold text-primary">
                    Dose única • Próximo reforço programado para +1 ano (365 dias)
                  </div>
                </div>
              )}
            </div>

            {vacProtocol === 'CUSTOM' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Nome da Vacina *"
                  value={vacCustomName}
                  onChange={(e) => setVacCustomName(e.target.value)}
                  placeholder="Ex: Vacina Giárdia"
                />
                <Input
                  label="Intervalo Próxima Dose (dias)"
                  type="number"
                  value={vacCustomInterval}
                  onChange={(e) => setVacCustomInterval(e.target.value)}
                  placeholder="Ex: 21 ou 365"
                />
              </div>
            )}

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-success/10 border border-success/20 text-xs font-bold text-success">
              <span>
                Próxima dose ({previewSchedule.nextDoseLabel}):{' '}
                {previewSchedule.nextDueDate.split('-').reverse().join('/')}
              </span>
              <Button
                type="button"
                variant="primary"
                onClick={handleAddVaccinationDraft}
                className="py-1.5! px-3! text-xs font-black"
              >
                Confirmar Vacina
              </Button>
            </div>
          </div>
        )}

        {vaccinations.length > 0 && (
          <div className="flex flex-col gap-2">
            {vaccinations.map((v) => {
              const sched = calculateVaccineSchedule({
                protocolCode: v.protocolCode,
                customVaccineName: v.customVaccineName,
                doseStage: v.doseStage,
                appliedDate: todayStr,
                customIntervalDays: v.customIntervalDays,
              });
              return (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-card border border-border"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-foreground">
                      💉 {sched.vaccineName} • {sched.currentDoseLabel}
                    </span>
                    <span className="text-[11px] font-bold text-primary">
                      Próxima dose ({sched.nextDoseLabel}):{' '}
                      {sched.nextDueDate.split('-').reverse().join('/')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveVaccinationDraft(v.id)}
                    className="text-xs font-bold text-error hover:underline"
                  >
                    Remover
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Imagens e Anexos */}
      <div className="flex flex-col gap-3">
        <h4 className="font-bold text-foreground/80 flex items-center gap-2">
          Imagens e Anexos
          {uploadingImage && (
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          )}
        </h4>
        <div className="flex flex-wrap gap-4">
          {images.map((url, i) => (
            <div
              key={i}
              className="relative group w-24 h-24 rounded-2xl overflow-hidden shadow-inner border border-border bg-foreground/5"
            >
              <Image src={url} alt="Anexo" fill sizes="96px" className="object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
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

      {/* Insumos Utilizados (Catálogo / Maleta) */}
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-foreground/80">
            Insumos e Procedimentos Cobrados (Maleta)
          </h4>
          <button
            type="button"
            onClick={() => setShowNewItemForm(!showNewItemForm)}
            className="text-xs font-black text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors"
          >
            {showNewItemForm ? 'Cancelar' : '+ Cadastrar Novo'}
          </button>
        </div>

        {showNewItemForm && (
          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AutocompleteInput
                label="Nome do Item"
                value={newItemName}
                onChange={handleSelectCatalogForNewItem}
                options={catalogNames}
                placeholder="Ex: Vacina V10, Dipirona..."
              />
              <Input
                label="Concentração (Opcional)"
                value={newItemConcentration}
                onChange={(e) => setNewItemConcentration(e.target.value)}
                placeholder="Ex: 500mg"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-foreground/30 uppercase tracking-widest pl-1">
                  Categoria
                </label>
                <select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value)}
                  className="w-full bg-card rounded-xl px-4 py-3 shadow-inner border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm font-bold text-foreground"
                >
                  <option className="bg-card text-foreground" value="Consultation">
                    Consulta
                  </option>
                  <option className="bg-card text-foreground" value="Medication">
                    Medicamento
                  </option>
                  <option className="bg-card text-foreground" value="Vaccine">
                    Vacina
                  </option>
                  <option className="bg-card text-foreground" value="Material">
                    Material/Serviço
                  </option>
                </select>
              </div>
              <Input
                label="Valor Aplicação (R$)"
                type="number"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder="Ex: 50.00"
              />
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={handleAddNewInventoryItem}
              className="w-full py-2"
            >
              Confirmar Cadastro
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar item na maleta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-foreground/5 rounded-2xl px-6 py-4 shadow-inner border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground font-medium placeholder:text-foreground/30 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-foreground/20 hover:text-foreground/60 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3 max-h-[320px] overflow-y-auto p-2 scrollbar-none rounded-3xl">
            {filteredInventory.length > 0 ? (
              filteredInventory.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleAddItem(item.id)}
                  className="flex items-center gap-3 px-5 py-3 bg-background shadow-sm hover:shadow-inner hover:bg-foreground/5 rounded-full border border-border hover:border-primary/20 transition-all duration-300 group"
                >
                  <div className="flex flex-col items-start leading-tight">
                    <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] font-black opacity-40 group-hover:opacity-60 transition-opacity uppercase tracking-widest">
                        {item.type === 'Medication'
                          ? 'Medicamento'
                          : item.type === 'Vaccine'
                          ? 'Vacina'
                          : item.type === 'Consultation'
                          ? 'Consulta'
                          : 'Material'}
                      </span>
                      {item.concentration && (
                        <span className="text-[9px] font-bold text-primary/40 group-hover:text-primary/60">
                          • {item.concentration}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-4 w-px bg-foreground/5 group-hover:bg-primary/10 mx-1"></div>
                  <span className="text-xs font-black text-primary/40 group-hover:text-primary transition-colors">
                    R$ {item.salePrice.toFixed(2)}
                  </span>
                </button>
              ))
            ) : (
              <p className="w-full text-center py-8 text-foreground/20 text-sm font-bold italic tracking-wide">
                Nenhum item encontrado no catálogo.
              </p>
            )}
          </div>
        </div>

        {selectedItems.length > 0 && (
          <div className="mt-4 p-5 rounded-2xl bg-foreground/5 shadow-inner flex flex-col gap-3 border border-primary/5 animate-in zoom-in-95 duration-300">
            <span className="text-xs font-black text-foreground/40 uppercase tracking-widest pl-1">
              Itens Selecionados
            </span>
            <div className="flex flex-col gap-2">
              {selectedItems.map((item) => {
                const invItem = inventory.find((i) => i.id === item.id);
                return (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-3 bg-card rounded-2xl border border-border hover:border-primary/20 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-black text-primary shadow-sm border border-border">
                        {item.quantity}x
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-foreground">
                          {invItem?.name || 'Item Novo'}
                        </span>
                        {invItem?.concentration && (
                          <span className="text-[10px] font-medium text-foreground/40 leading-none">
                            {invItem.concentration}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-xs text-foreground/60">
                        R$ {invItem ? (invItem.salePrice * item.quantity).toFixed(2) : '0.00'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-error/10 text-error hover:bg-error hover:text-white transition-all duration-200"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                            d="M20 12H4"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Resumo Financeiro da Consulta */}
      <div className="mt-4 p-8 rounded-3xl bg-gradient-to-br from-success/5 to-success/15 border border-success/20 shadow-sm flex flex-col items-center justify-center gap-2 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-success/10 transition-colors"></div>
        <span className="text-xs font-black text-success/60 uppercase tracking-[0.2em] relative z-10">
          Valor Total do Atendimento
        </span>
        <div className="flex items-baseline gap-1 relative z-10">
          <span className="text-lg font-black text-success/60">R$</span>
          <span className="text-5xl font-extrabold text-success tracking-tighter flex items-baseline">
            {totalValue > 0 ? Math.floor(totalValue) : '0'}
            <span className="text-3xl opacity-60">
              ,{totalValue > 0 ? (totalValue % 1).toFixed(2).substring(2) : '00'}
            </span>
          </span>
        </div>
        {parsedTravelFee > 0 && (
          <span className="text-xs font-bold text-success/80 relative z-10">
            Insumos/Serviços: R$ {itemsTotalValue.toFixed(2)} + Deslocamento: R${' '}
            {parsedTravelFee.toFixed(2)}
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
        disabled={loading || !patientId}
        className="mt-2 py-4 text-lg font-black"
      >
        {loading ? 'Salvando Prontuário...' : 'Finalizar Atendimento & Gerar Documentos'}
      </Button>
    </Card>
  );
}
