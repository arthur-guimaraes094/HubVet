"use client";

import React, { useState, useId, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { updatePatient, uploadPetPhotoAction } from '@/app/pacientes/actions';
import { useToast } from '@/components/ui/Toast';
import { useRouter } from 'next/navigation';
import { compressPetPhoto } from '@/core/utils/image-compress';
import {
  calculateYearsAndMonths,
  estimateBirthDateFromAge,
  formatPatientAge,
} from '@/core/utils/age';
import {
  COMMON_COAT_COLORS,
  FALLBACK_DOG_BREEDS_PT,
  FALLBACK_CAT_BREEDS_PT,
} from '@/core/utils/pet-attributes';
import Image from 'next/image';

export interface EditablePatient {
  id: string;
  name: string;
  species: string;
  weight_kg: number | null;
  breed?: string | null;
  color?: string | null;
  photo_url?: string | null;
  birth_date?: string | null;
  is_birth_date_estimated?: boolean | null;
  fertility_status?: string | null;
  fertility_notes?: string | null;
  clinical_observations?: string | null;
}

interface EditPatientModalProps {
  patient: EditablePatient;
  isOpen: boolean;
  onClose: () => void;
}

export function EditPatientModal({ patient, isOpen, onClose }: EditPatientModalProps) {
  const { success, error } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const speciesSelectId = useId();
  const fertilitySelectId = useId();

  const initialAge = calculateYearsAndMonths(patient.birth_date);

  const [patientName, setPatientName] = useState(patient.name);
  const [patientSpecies, setPatientSpecies] = useState(patient.species);
  const [patientWeight, setPatientWeight] = useState(patient.weight_kg?.toString() || '');
  const [patientBreed, setPatientBreed] = useState(patient.breed || '');
  const [patientColor, setPatientColor] = useState(patient.color || '');
  const [patientPhotoUrl, setPatientPhotoUrl] = useState<string | null>(patient.photo_url || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [ageMode, setAgeMode] = useState<'approx' | 'exact'>(
    patient.birth_date && !patient.is_birth_date_estimated ? 'exact' : 'approx'
  );
  const [approxYears, setApproxYears] = useState(
    initialAge ? initialAge.years.toString() : ''
  );
  const [approxMonths, setApproxMonths] = useState(
    initialAge ? initialAge.months.toString() : ''
  );
  const [exactBirthDate, setExactBirthDate] = useState(patient.birth_date || '');

  const [fertilityStatus, setFertilityStatus] = useState(patient.fertility_status || '');
  const [fertilityNotes, setFertilityNotes] = useState(patient.fertility_notes || '');
  const [clinicalObservations, setClinicalObservations] = useState(
    patient.clinical_observations || ''
  );

  const [breedOptions, setBreedOptions] = useState<string[]>(FALLBACK_DOG_BREEDS_PT);
  const [colorOptions, setColorOptions] = useState<string[]>(COMMON_COAT_COLORS);

  useEffect(() => {
    const speciesParam = patientSpecies || 'Canine';
    let active = true;
    fetch(`/api/breeds?species=${encodeURIComponent(speciesParam)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (Array.isArray(data.breeds)) setBreedOptions(data.breeds);
        if (Array.isArray(data.colors)) setColorOptions(data.colors);
      })
      .catch(() => {
        if (!active) return;
        setBreedOptions(
          speciesParam === 'Feline' ? FALLBACK_CAT_BREEDS_PT : FALLBACK_DOG_BREEDS_PT
        );
      });
    return () => {
      active = false;
    };
  }, [patientSpecies]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      error('A foto deve ter no máximo 15MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const { blob, dataUrl } = await compressPetPhoto(file, 400, 0.82);
      setPatientPhotoUrl(dataUrl);

      const formData = new FormData();
      formData.append('photo', new File([blob], 'pet-photo.jpg', { type: 'image/jpeg' }));

      const uploadRes = await uploadPetPhotoAction(formData);
      if (uploadRes.success && uploadRes.data?.publicUrl) {
        setPatientPhotoUrl(uploadRes.data.publicUrl);
      }
      success('Foto atualizada!');
    } catch (err) {
      console.error(err);
      error('Erro ao enviar foto.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const computedBirthDate = React.useMemo(() => {
    if (ageMode === 'exact') {
      return exactBirthDate || null;
    }
    const y = parseInt(approxYears || '0', 10);
    const m = parseInt(approxMonths || '0', 10);
    if ((!approxYears && !approxMonths) || (isNaN(y) && isNaN(m))) {
      return null;
    }
    return estimateBirthDateFromAge(isNaN(y) ? 0 : y, isNaN(m) ? 0 : m);
  }, [ageMode, exactBirthDate, approxYears, approxMonths]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patientName || !patientSpecies || !patientWeight) {
      error('Preencha os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const result = await updatePatient(patient.id, {
        name: patientName,
        species: patientSpecies,
        weight_kg: parseFloat(patientWeight.replace(',', '.')),
        breed: patientBreed,
        color: patientColor,
        photo_url: patientPhotoUrl,
        birth_date: computedBirthDate,
        is_birth_date_estimated: ageMode === 'approx' && !!computedBirthDate,
        fertility_status: fertilityStatus || null,
        fertility_notes: fertilityNotes || null,
        clinical_observations: clinicalObservations || null,
      });

      if (!result.success) {
        error(result.error || 'Erro ao atualizar paciente');
        return;
      }

      success('Paciente atualizado com sucesso!');
      onClose();
      router.refresh();
    } catch {
      error('Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar Paciente"
      showCloseButton={false}
      maxWidth="max-w-lg"
    >
      <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-60 -mt-6 mb-6">
        {patient.name}
      </p>

      <form
        onSubmit={handleSave}
        className="flex flex-col gap-6 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar"
      >
        <div className="flex flex-col gap-5 p-5 bg-foreground/2 rounded-3xl border border-foreground/5">
          <span className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.2em] pl-1">
            Informações do Pet
          </span>

          <div className="flex items-center gap-4 px-1">
            <label className="relative w-20 h-20 rounded-full bg-card border-2 border-dashed border-primary/30 hover:border-primary flex items-center justify-center cursor-pointer overflow-hidden shrink-0 group transition-all shadow-sm">
              {patientPhotoUrl ? (
                <Image
                  src={patientPhotoUrl}
                  alt={patientName}
                  fill
                  sizes="80px"
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-1">
                  <span className="text-2xl">📷</span>
                  <span className="text-[8px] font-black text-primary uppercase tracking-tighter">
                    {uploadingPhoto ? 'Enviando...' : 'Foto'}
                  </span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
                disabled={uploadingPhoto}
              />
            </label>

            <div className="flex-1">
              <Input
                label="Nome do Pet *"
                placeholder="Ex: Rex"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label
                htmlFor={speciesSelectId}
                className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] pl-4"
              >
                Espécie *
              </label>
              <select
                id={speciesSelectId}
                value={patientSpecies}
                onChange={(e) => setPatientSpecies(e.target.value)}
                required
                className={`w-full bg-card rounded-xl px-4 py-3 shadow-sm outline-none focus:ring-2 focus:ring-primary/40 font-medium transition-all border border-border appearance-none ${
                  !patientSpecies ? 'text-foreground/40' : 'text-foreground'
                }`}
              >
                <option value=""></option>
                <option value="Canine" className="text-foreground">
                  Cão (Canino)
                </option>
                <option value="Feline" className="text-foreground">
                  Gato (Felino)
                </option>
                <option value="Other" className="text-foreground">
                  Outros
                </option>
              </select>
            </div>

            <Input
              label="Peso (kg) *"
              type="number"
              step="0.01"
              placeholder="0.0"
              value={patientWeight}
              onChange={(e) => setPatientWeight(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <AutocompleteInput
              label="Raça"
              placeholder="Ex: SRD, Poodle..."
              value={patientBreed}
              onChange={setPatientBreed}
              options={breedOptions}
            />
            <AutocompleteInput
              label="Pelagem / Cor"
              placeholder="Ex: Branco, Caramelo..."
              value={patientColor}
              onChange={setPatientColor}
              options={colorOptions}
            />
          </div>

          {/* Idade */}
          <div className="flex flex-col gap-3 pt-2 border-t border-foreground/5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-foreground/70 uppercase tracking-wider">
                🎂 Idade do Paciente
              </span>
              <div 
                role="radiogroup" 
                aria-label="Formato da idade"
                className="flex bg-foreground/5 border border-border/70 p-0.5 rounded-xl gap-0.5"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={ageMode === 'approx'}
                  onClick={() => setAgeMode('approx')}
                  className={`py-1 px-3 rounded-lg text-xs font-bold transition-[transform,background-color,color] duration-150 active:scale-[0.97] ${
                    ageMode === 'approx' ? 'bg-primary text-white shadow-sm' : 'text-foreground/70 hover:text-foreground'
                  }`}
                >
                  Anos / Meses
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={ageMode === 'exact'}
                  onClick={() => setAgeMode('exact')}
                  className={`py-1 px-3 rounded-lg text-xs font-bold transition-[transform,background-color,color] duration-150 active:scale-[0.97] ${
                    ageMode === 'exact' ? 'bg-primary text-white shadow-sm' : 'text-foreground/70 hover:text-foreground'
                  }`}
                >
                  Data de Nasc.
                </button>
              </div>
            </div>

            {ageMode === 'approx' ? (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Anos"
                  type="number"
                  min="0"
                  max="35"
                  placeholder="Ex: 2"
                  value={approxYears}
                  onChange={(e) => setApproxYears(e.target.value)}
                />
                <Input
                  label="Meses"
                  type="number"
                  min="0"
                  max="11"
                  placeholder="Ex: 4"
                  value={approxMonths}
                  onChange={(e) => setApproxMonths(e.target.value)}
                />
              </div>
            ) : (
              <Input
                label="Data de Nascimento"
                type="date"
                value={exactBirthDate}
                onChange={(e) => setExactBirthDate(e.target.value)}
              />
            )}
            {computedBirthDate && (
              <span className="text-[10px] font-bold text-primary pl-3">
                Idade registrada: {formatPatientAge(computedBirthDate)}
              </span>
            )}
          </div>

          {/* Fertilidade */}
          <div className="flex flex-col gap-3 pt-2 border-t border-foreground/5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor={fertilitySelectId}
                  className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] pl-4"
                >
                  Fertilidade / Reprodução
                </label>
                <select
                  id={fertilitySelectId}
                  value={fertilityStatus}
                  onChange={(e) => setFertilityStatus(e.target.value)}
                  className="w-full bg-card rounded-xl px-4 py-3 shadow-sm outline-none focus:ring-2 focus:ring-primary/40 font-medium transition-all border border-border appearance-none text-foreground"
                >
                  <option value="">Não informado</option>
                  <option value="Neutered">Castrado(a)</option>
                  <option value="Intact">Inteiro(a) / Não Castrado(a)</option>
                  <option value="Breeding">Reprodutor(a) / Gestante</option>
                </select>
              </div>
              <Input
                label="Obs. de Fertilidade"
                placeholder="Ex: Castrado há 1 ano..."
                value={fertilityNotes}
                onChange={(e) => setFertilityNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Observações / Alergias */}
          <div className="flex flex-col gap-2 pt-2 border-t border-foreground/5">
            <label className="text-[10px] font-black text-error/80 uppercase tracking-[0.2em] pl-4">
              ⚠️ Alergias e Observações Importantes
            </label>
            <textarea
              value={clinicalObservations}
              onChange={(e) => setClinicalObservations(e.target.value)}
              placeholder="Ex: Alérgico a Dipirona, cardiopata, temperamento..."
              className="w-full bg-card rounded-xl px-4 py-3 shadow-sm outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-medium placeholder:text-foreground/40 transition-all border border-border min-h-[72px] resize-y text-sm"
            />
          </div>
        </div>

        <div className="flex gap-4 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1 py-5! uppercase font-black text-[10px] tracking-widest"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || uploadingPhoto}
            className="flex-2 py-5! shadow-sm border border-border uppercase font-black text-[10px] tracking-widest"
          >
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
