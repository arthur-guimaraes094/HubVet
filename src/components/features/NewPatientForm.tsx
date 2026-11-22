"use client";

import React, { useState, useId, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { addPatientAndTutor, getTutors, uploadPetPhotoAction } from '@/app/pacientes/actions';
import { useToast } from '@/components/ui/Toast';
import { compressPetPhoto } from '@/core/utils/image-compress';
import { validateImageUpload } from '@/core/utils/upload-validation';
import { fetchAddressByCep, formatCep, formatFullAddress } from '@/core/utils/cep';
import { estimateBirthDateFromAge, formatPatientAge } from '@/core/utils/age';
import {
  COMMON_COAT_COLORS,
  FALLBACK_DOG_BREEDS_PT,
  FALLBACK_CAT_BREEDS_PT,
} from '@/core/utils/pet-attributes';
import Image from 'next/image';

interface Tutor {
  id: string;
  name: string;
  address?: string | null;
}

interface NewPatientFormProps {
  initialTutorId?: string;
  initialTutorName?: string;
}

export function NewPatientForm({ initialTutorId, initialTutorName }: NewPatientFormProps) {
  const { success, error } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const speciesSelectId = useId();
  const fertilitySelectId = useId();
  const tutorSearchInputId = useId();
  const tutorListboxId = useId();
  const clinicalObsId = useId();

  // Tutor
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [tutorSelectionMode, setTutorSelectionMode] = useState<'new' | 'existing'>(
    initialTutorId ? 'existing' : 'new'
  );
  const [selectedTutorId, setSelectedTutorId] = useState(initialTutorId || '');
  const [tutorName, setTutorName] = useState('');
  const [tutorPhone, setTutorPhone] = useState('');
  const [tutorCpf, setTutorCpf] = useState('');

  // Endereço Completo do Tutor
  const [tutorCep, setTutorCep] = useState('');
  const [tutorStreet, setTutorStreet] = useState('');
  const [tutorNumber, setTutorNumber] = useState('');
  const [tutorComplement, setTutorComplement] = useState('');
  const [tutorNeighborhood, setTutorNeighborhood] = useState('');
  const [tutorCity, setTutorCity] = useState('');
  const [tutorState, setTutorState] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);

  // Paciente
  const [patientName, setPatientName] = useState('');
  const [patientSpecies, setPatientSpecies] = useState('');
  const [patientWeight, setPatientWeight] = useState('');
  const [patientBreed, setPatientBreed] = useState('');
  const [patientColor, setPatientColor] = useState('');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [patientPhotoRef, setPatientPhotoRef] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Idade / Nascimento
  const [ageMode, setAgeMode] = useState<'approx' | 'exact'>('approx');
  const [approxYears, setApproxYears] = useState('');
  const [approxMonths, setApproxMonths] = useState('');
  const [exactBirthDate, setExactBirthDate] = useState('');

  // Fertilidade e Observações Clínicas (Alergias, etc.)
  const [fertilityStatus, setFertilityStatus] = useState('');
  const [fertilityNotes, setFertilityNotes] = useState('');
  const [clinicalObservations, setClinicalObservations] = useState('');

  // Opções da API externa de raças e cores
  const [breedOptions, setBreedOptions] = useState<string[]>(FALLBACK_DOG_BREEDS_PT);
  const [colorOptions, setColorOptions] = useState<string[]>(COMMON_COAT_COLORS);

  // Searchable Tutor
  const [tutorSearch, setTutorSearch] = useState(initialTutorName || '');
  const [isTutorListOpen, setIsTutorListOpen] = useState(false);
  const [activeTutorIndex, setActiveTutorIndex] = useState(-1);
  const tutorComboRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tutorComboRef.current && !tutorComboRef.current.contains(event.target as Node)) {
        setIsTutorListOpen(false);
        setActiveTutorIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      getTutors().then((data) => setTutors(data as unknown as Tutor[]));
    }
  }, [isOpen]);

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

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    if (value.length <= 3) {
      setTutorCpf(value);
    } else if (value.length <= 6) {
      setTutorCpf(`${value.slice(0, 3)}.${value.slice(3)}`);
    } else if (value.length <= 9) {
      setTutorCpf(`${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`);
    } else {
      setTutorCpf(
        `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`
      );
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    if (value.length <= 2) {
      setTutorPhone(value);
      return;
    }

    const ddd = value.slice(0, 2);
    const part1 = value.slice(2, value.length <= 10 ? 6 : 7);
    const part2 = value.slice(value.length <= 10 ? 6 : 7);

    if (part2) {
      setTutorPhone(`(${ddd}) ${part1}-${part2}`);
    } else {
      setTutorPhone(`(${ddd}) ${part1}`);
    }
  };

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setTutorCep(formatted);

    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8) {
      setLoadingCep(true);
      const found = await fetchAddressByCep(digits);
      setLoadingCep(false);
      if (found) {
        if (found.street) setTutorStreet(found.street);
        if (found.neighborhood) setTutorNeighborhood(found.neighborhood);
        if (found.city) setTutorCity(found.city);
        if (found.state) setTutorState(found.state);
      }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget;
    const file = inputEl.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      error('A foto deve ter no máximo 15MB');
      inputEl.value = '';
      return;
    }

    const previousPreviewUrl = photoPreviewUrl;
    const previousPhotoRef = patientPhotoRef;

    setUploadingPhoto(true);
    try {
      const validation = await validateImageUpload(file, 15 * 1024 * 1024);
      if (!validation.valid) {
        error(validation.error);
        return;
      }

      const { blob, dataUrl } = await compressPetPhoto(file, 400, 0.82);
      // Mostra prévia imediata (somente preview; nunca salvo no banco)
      setPhotoPreviewUrl(dataUrl);

      const formData = new FormData();
      formData.append('photo', new File([blob], 'pet-photo.jpg', { type: 'image/jpeg' }));

      const uploadRes = await uploadPetPhotoAction(formData);
      if (!uploadRes.success) {
        setPhotoPreviewUrl(previousPreviewUrl);
        setPatientPhotoRef(previousPhotoRef);
        error(uploadRes.error || 'Erro ao salvar foto do pet.');
        return;
      }
      if (!uploadRes.data?.storageRef) {
        setPhotoPreviewUrl(previousPreviewUrl);
        setPatientPhotoRef(previousPhotoRef);
        error('Erro ao salvar foto do pet.');
        return;
      }

      setPatientPhotoRef(uploadRes.data.storageRef);
      setPhotoPreviewUrl(uploadRes.data.signedUrl || dataUrl);
      success('Foto do pet carregada!');
    } catch (err) {
      console.error(err);
      setPhotoPreviewUrl(previousPreviewUrl);
      setPatientPhotoRef(previousPhotoRef);
      error('Erro ao processar foto do pet.');
    } finally {
      setUploadingPhoto(false);
      inputEl.value = '';
    }
  };

  const filteredTutors = tutors.filter((t) =>
    t.name.toLowerCase().includes(tutorSearch.toLowerCase())
  );

  const showTutorListbox =
    isTutorListOpen && (tutorSearch.trim().length > 0 || filteredTutors.length > 0);
  const clampedActiveTutorIndex =
    activeTutorIndex >= 0 && activeTutorIndex < filteredTutors.length ? activeTutorIndex : -1;
  const activeTutorOptionId =
    clampedActiveTutorIndex >= 0
      ? `${tutorListboxId}-option-${filteredTutors[clampedActiveTutorIndex].id}`
      : undefined;

  const handleSelectTutor = (tutor: Tutor) => {
    setSelectedTutorId(tutor.id);
    setTutorSearch(tutor.name);
    setIsTutorListOpen(false);
    setActiveTutorIndex(-1);
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

    if (tutorSelectionMode === 'new' && !tutorName) {
      error('Nome do tutor é obrigatório');
      return;
    }

    if (tutorSelectionMode === 'existing' && !selectedTutorId) {
      error('Selecione um tutor existente');
      return;
    }

    if (!patientName || !patientSpecies || !patientWeight) {
      error('Preencha os campos obrigatórios');
      return;
    }

    const fullTutorAddr = formatFullAddress({
      cep: tutorCep,
      street: tutorStreet,
      number: tutorNumber,
      complement: tutorComplement,
      neighborhood: tutorNeighborhood,
      city: tutorCity,
      state: tutorState,
    });

    setLoading(true);
    try {
      const result = await addPatientAndTutor({
        tutorId: tutorSelectionMode === 'existing' ? selectedTutorId : undefined,
        tutorName: tutorSelectionMode === 'new' ? tutorName : undefined,
        tutorPhone: tutorSelectionMode === 'new' ? tutorPhone : undefined,
        tutorCpf: tutorSelectionMode === 'new' ? tutorCpf : undefined,
        tutorCep: tutorSelectionMode === 'new' ? tutorCep : undefined,
        tutorStreet: tutorSelectionMode === 'new' ? tutorStreet : undefined,
        tutorNumber: tutorSelectionMode === 'new' ? tutorNumber : undefined,
        tutorComplement: tutorSelectionMode === 'new' ? tutorComplement : undefined,
        tutorNeighborhood: tutorSelectionMode === 'new' ? tutorNeighborhood : undefined,
        tutorCity: tutorSelectionMode === 'new' ? tutorCity : undefined,
        tutorState: tutorSelectionMode === 'new' ? tutorState : undefined,
        tutorAddress: tutorSelectionMode === 'new' ? fullTutorAddr : undefined,
        patientName,
        patientSpecies,
        patientWeight:
          patientWeight && !isNaN(parseFloat(patientWeight.replace(',', '.')))
            ? parseFloat(patientWeight.replace(',', '.'))
            : 0,
        patientBreed,
        patientColor,
        patientPhotoUrl: patientPhotoRef,
        patientBirthDate: computedBirthDate,
        isBirthDateEstimated: ageMode === 'approx' && !!computedBirthDate,
        fertilityStatus: fertilityStatus || null,
        fertilityNotes: fertilityNotes || null,
        clinicalObservations: clinicalObservations || null,
      });

      if (!result.success) {
        error(result.error);
        return;
      }

      success('Paciente cadastrado com sucesso!');
      setIsOpen(false);

      // Limpar form
      setSelectedTutorId('');
      setTutorSearch('');
      setTutorName('');
      setTutorPhone('');
      setTutorCpf('');
      setTutorCep('');
      setTutorStreet('');
      setTutorNumber('');
      setTutorComplement('');
      setTutorNeighborhood('');
      setTutorCity('');
      setTutorState('');
      setPatientName('');
      setPatientSpecies('');
      setPatientWeight('');
      setPatientBreed('');
      setPatientColor('');
      setPhotoPreviewUrl(null);
      setPatientPhotoRef(null);
      setApproxYears('');
      setApproxMonths('');
      setExactBirthDate('');
      setFertilityStatus('');
      setFertilityNotes('');
      setClinicalObservations('');
    } catch {
      error('Ocorreu um erro inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)} className="px-4! py-2! text-sm">
        + Novo Paciente
      </Button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Novo Cadastro"
        showCloseButton={false}
        maxWidth="max-w-lg"
      >
        <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em] -mt-4 mb-5">
          Tutor e Paciente
        </p>

        <form
          onSubmit={handleSave}
          className="flex flex-col gap-6 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar"
        >
          {/* Dados do Tutor */}
          <div className="flex flex-col gap-5 p-5 bg-foreground/2 rounded-3xl border border-foreground/5">
            <div className="flex justify-between items-center gap-2 px-1 flex-wrap">
              <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.15em]">
                Responsável (Tutor)
              </span>
              <div
                role="radiogroup"
                aria-label="Tipo de cadastro de tutor"
                className="flex bg-background shadow-inner border border-border-strong p-0.5 rounded-full gap-0.5"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={tutorSelectionMode === 'new'}
                  onClick={() => setTutorSelectionMode('new')}
                  className={`min-h-[36px] py-1.5 px-3.5 rounded-full transition-all text-[11px] font-black uppercase tracking-wider ${
                    tutorSelectionMode === 'new'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground/80 hover:text-foreground'
                  }`}
                >
                  Novo
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={tutorSelectionMode === 'existing'}
                  onClick={() => setTutorSelectionMode('existing')}
                  className={`min-h-[36px] py-1.5 px-3.5 rounded-full transition-all text-[11px] font-black uppercase tracking-wider ${
                    tutorSelectionMode === 'existing'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground/80 hover:text-foreground'
                  }`}
                >
                  Existente
                </button>
              </div>
            </div>

            {tutorSelectionMode === 'new' ? (
              <div className="flex flex-col gap-4">
                <Input
                  label="Nome Completo *"
                  autoComplete="name"
                  placeholder="Ex: João da Silva"
                  value={tutorName}
                  onChange={(e) => setTutorName(e.target.value)}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="CPF"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={tutorCpf}
                    onChange={handleCpfChange}
                    maxLength={14}
                  />
                  <Input
                    label="WhatsApp"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(84) 99999-9999"
                    value={tutorPhone}
                    onChange={handlePhoneChange}
                    maxLength={15}
                  />
                </div>

                {/* Endereço Completo do Tutor */}
                <div className="pt-2 border-t border-foreground/5 flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-black text-primary uppercase tracking-[0.15em]">
                      <span aria-hidden="true">📍</span> Endereço Residencial (Consulta Domiciliar)
                    </span>
                    {loadingCep && (
                      <span role="status" aria-live="polite" className="text-[11px] font-bold text-primary animate-pulse">
                        Buscando CEP...
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="CEP"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      placeholder="00000-000"
                      value={tutorCep}
                      onChange={handleCepChange}
                      maxLength={9}
                    />
                    <div className="col-span-2">
                      <Input
                        label="Rua / Logradouro"
                        autoComplete="street-address"
                        placeholder="Ex: Rua das Embarcações"
                        value={tutorStreet}
                        onChange={(e) => setTutorStreet(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="Número"
                      placeholder="Ex: 171"
                      value={tutorNumber}
                      onChange={(e) => setTutorNumber(e.target.value)}
                    />
                    <div className="col-span-2">
                      <Input
                        label="Complemento"
                        placeholder="Apto, Bloco, Casa..."
                        value={tutorComplement}
                        onChange={(e) => setTutorComplement(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-3">
                    <div className="col-span-2">
                      <Input
                        label="Bairro"
                        placeholder="Ex: Nova Parnamirim"
                        value={tutorNeighborhood}
                        onChange={(e) => setTutorNeighborhood(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        label="Cidade"
                        placeholder="Ex: Parnamirim"
                        value={tutorCity}
                        onChange={(e) => setTutorCity(e.target.value)}
                      />
                    </div>
                    <Input
                      label="UF"
                      placeholder="RN"
                      value={tutorState}
                      onChange={(e) => setTutorState(e.target.value.toUpperCase().slice(0, 2))}
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div
                ref={tutorComboRef}
                onBlur={(e) => {
                  if (!tutorComboRef.current?.contains(e.relatedTarget as Node)) {
                    setIsTutorListOpen(false);
                    setActiveTutorIndex(-1);
                  }
                }}
                className="flex flex-col gap-2 relative"
              >
                <label
                  htmlFor={tutorSearchInputId}
                  className="text-[11px] font-bold text-foreground/75 uppercase tracking-wider pl-1"
                >
                  Pesquisar Tutor *
                </label>
                <div className="relative">
                  <input
                    id={tutorSearchInputId}
                    type="text"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={showTutorListbox}
                    aria-controls={tutorListboxId}
                    aria-activedescendant={showTutorListbox ? activeTutorOptionId : undefined}
                    autoComplete="off"
                    placeholder="Digite o nome do tutor..."
                    value={tutorSearch}
                    onChange={(e) => {
                      setTutorSearch(e.target.value);
                      setSelectedTutorId('');
                      setIsTutorListOpen(true);
                      setActiveTutorIndex(-1);
                    }}
                    onFocus={() => setIsTutorListOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        if (!isTutorListOpen) {
                          setIsTutorListOpen(true);
                          setActiveTutorIndex(filteredTutors.length > 0 ? 0 : -1);
                        } else if (filteredTutors.length > 0) {
                          setActiveTutorIndex((prev) =>
                            prev + 1 < filteredTutors.length ? prev + 1 : 0
                          );
                        }
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (!isTutorListOpen) {
                          setIsTutorListOpen(true);
                          setActiveTutorIndex(
                            filteredTutors.length > 0 ? filteredTutors.length - 1 : -1
                          );
                        } else if (filteredTutors.length > 0) {
                          setActiveTutorIndex((prev) =>
                            prev > 0 ? prev - 1 : filteredTutors.length - 1
                          );
                        }
                      } else if (
                        e.key === 'Enter' &&
                        showTutorListbox &&
                        clampedActiveTutorIndex >= 0
                      ) {
                        e.preventDefault();
                        const chosen = filteredTutors[clampedActiveTutorIndex];
                        if (chosen) handleSelectTutor(chosen);
                      } else if (e.key === 'Escape' && isTutorListOpen) {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsTutorListOpen(false);
                        setActiveTutorIndex(-1);
                      }
                    }}
                    className="w-full bg-background rounded-2xl px-5 py-3.5 shadow-inner border border-border-strong outline-none focus-visible:ring-2 focus-visible:ring-primary text-foreground placeholder:text-muted-foreground font-medium transition-all"
                    required={tutorSelectionMode === 'existing'}
                  />
                  {showTutorListbox && (
                    <ul
                      id={tutorListboxId}
                      role="listbox"
                      aria-label="Tutores cadastrados"
                      className="absolute top-full left-0 right-0 z-20 mt-2 bg-card border border-border-strong rounded-2xl shadow-xl max-h-60 overflow-y-auto p-2 animate-in fade-in slide-in-from-top-2"
                    >
                      {filteredTutors.length > 0 ? (
                        filteredTutors.map((t, index) => {
                          const isActive = index === clampedActiveTutorIndex;
                          const isSelected = t.id === selectedTutorId;
                          return (
                            <li
                              key={t.id}
                              id={`${tutorListboxId}-option-${t.id}`}
                              role="option"
                              aria-selected={isSelected}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSelectTutor(t)}
                              onMouseEnter={() => setActiveTutorIndex(index)}
                              className={`w-full text-left px-4 py-3 rounded-xl cursor-pointer transition-colors font-medium text-sm flex items-center justify-between ${
                                isActive || isSelected
                                  ? 'bg-primary/15 text-primary font-bold'
                                  : 'hover:bg-primary/10 hover:text-primary text-foreground'
                              }`}
                            >
                              <div className="flex flex-col min-w-0">
                                <span>{t.name}</span>
                                {t.address && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[240px]">
                                    <span aria-hidden="true">📍</span> {t.address}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0 ml-2">
                                {isSelected ? 'Selecionado' : 'Selecionar'}
                              </span>
                            </li>
                          );
                        })
                      ) : (
                        <li className="p-4 text-center text-sm text-muted-foreground italic">
                          Nenhum tutor encontrado
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dados do Paciente */}
          <div className="flex flex-col gap-5 p-5 bg-foreground/2 rounded-3xl border border-foreground/5">
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-[0.2em] pl-1">
              Informações do Pet
            </span>

            {/* Foto do Pet */}
            <div className="flex items-center gap-4 px-1">
              <label className="relative w-20 h-20 rounded-full bg-card border-2 border-dashed border-primary/40 hover:border-primary flex items-center justify-center cursor-pointer overflow-hidden shrink-0 group transition-all shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
                {photoPreviewUrl ? (
                  <Image
                    src={photoPreviewUrl}
                    alt={patientName ? `Foto de ${patientName}` : 'Foto do paciente'}
                    fill
                    sizes="80px"
                    unoptimized
                    className="object-cover"
                  />
                ) : (
                  <div aria-hidden="true" className="flex flex-col items-center justify-center text-center p-1">
                    <span className="text-2xl">📷</span>
                    <span className="text-[9px] font-black text-primary uppercase tracking-tighter">
                      {uploadingPhoto ? 'Enviando...' : 'Foto'}
                    </span>
                  </div>
                )}
                <span className="sr-only">
                  {uploadingPhoto ? 'Enviando foto do paciente...' : 'Adicionar foto do paciente'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="sr-only"
                  disabled={uploadingPhoto}
                />
              </label>

              <div className="flex-1">
                <Input
                  label="Nome do Pet *"
                  placeholder="Ex: Rex, Mel..."
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
                  className="text-[11px] font-bold text-foreground/75 uppercase tracking-wider pl-1"
                >
                  Espécie *
                </label>
                <select
                  id={speciesSelectId}
                  value={patientSpecies}
                  onChange={(e) => setPatientSpecies(e.target.value)}
                  required
                  className={`w-full bg-card rounded-xl px-4 py-3 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary font-medium transition-all border border-border-strong appearance-none ${
                    !patientSpecies ? 'text-muted-foreground' : 'text-foreground'
                  }`}
                >
                  <option value="">Selecione...</option>
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
                inputMode="decimal"
                step="0.01"
                placeholder="0.0"
                value={patientWeight}
                onChange={(e) => setPatientWeight(e.target.value)}
                required
              />
            </div>

            {/* Raça e Pelagem vindas da API com Autocomplete */}
            <div className="grid grid-cols-2 gap-3">
              <AutocompleteInput
                label="Raça (API / Busca)"
                placeholder="Ex: SRD, Shih Tzu..."
                value={patientBreed}
                onChange={setPatientBreed}
                options={breedOptions}
              />
              <AutocompleteInput
                label="Pelagem / Cor"
                placeholder="Ex: Caramelo, Branco..."
                value={patientColor}
                onChange={setPatientColor}
                options={colorOptions}
              />
            </div>

            {/* Idade do Paciente */}
            <div className="flex flex-col gap-3 pt-2 border-t border-foreground/5">
              <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
                <span className="text-[11px] font-bold text-foreground/75 uppercase tracking-wider">
                  <span aria-hidden="true">🎂</span> Idade do Paciente
                </span>
                <div 
                  role="radiogroup" 
                  aria-label="Formato da idade"
                  className="flex bg-foreground/5 border border-border-strong p-0.5 rounded-xl gap-0.5"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={ageMode === 'approx'}
                    onClick={() => setAgeMode('approx')}
                    className={`min-h-[32px] py-1.5 px-3 rounded-lg text-xs font-bold transition-[transform,background-color,color] duration-150 active:scale-[0.97] ${
                      ageMode === 'approx'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-foreground/80 hover:text-foreground'
                    }`}
                  >
                    Anos / Meses
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={ageMode === 'exact'}
                    onClick={() => setAgeMode('exact')}
                    className={`min-h-[32px] py-1.5 px-3 rounded-lg text-xs font-bold transition-[transform,background-color,color] duration-150 active:scale-[0.97] ${
                      ageMode === 'exact'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-foreground/80 hover:text-foreground'
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
                    inputMode="numeric"
                    min="0"
                    max="35"
                    placeholder="Ex: 2"
                    value={approxYears}
                    onChange={(e) => setApproxYears(e.target.value)}
                  />
                  <Input
                    label="Meses"
                    type="number"
                    inputMode="numeric"
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
                <span className="text-xs font-bold text-primary pl-1">
                  Idade registrada: {formatPatientAge(computedBirthDate)}
                </span>
              )}
            </div>

            {/* Observação de Fertilidade */}
            <div className="flex flex-col gap-3 pt-2 border-t border-foreground/5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor={fertilitySelectId}
                    className="text-[11px] font-bold text-foreground/75 uppercase tracking-wider pl-1"
                  >
                    Fertilidade / Reprodução
                  </label>
                  <select
                    id={fertilitySelectId}
                    value={fertilityStatus}
                    onChange={(e) => setFertilityStatus(e.target.value)}
                    className="w-full bg-card rounded-xl px-4 py-3 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary font-medium transition-all border border-border-strong appearance-none text-foreground"
                  >
                    <option value="">Não informado</option>
                    <option value="Neutered">Castrado(a)</option>
                    <option value="Intact">Inteiro(a) / Não Castrado(a)</option>
                    <option value="Breeding">Reprodutor(a) / Gestante</option>
                  </select>
                </div>
                <Input
                  label="Obs. de Fertilidade"
                  placeholder="Ex: Castrado há 1 ano, último cio..."
                  value={fertilityNotes}
                  onChange={(e) => setFertilityNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Observações do Pet (Alergias, etc.) */}
            <div className="flex flex-col gap-2 pt-2 border-t border-foreground/5">
              <label
                htmlFor={clinicalObsId}
                className="text-[11px] font-black text-red-700 dark:text-red-300 uppercase tracking-[0.15em] pl-1"
              >
                <span aria-hidden="true">⚠️</span> Alergias e Observações Importantes
              </label>
              <textarea
                id={clinicalObsId}
                value={clinicalObservations}
                onChange={(e) => setClinicalObservations(e.target.value)}
                placeholder="Ex: Alérgico a Dipirona, cardiopata, temperamento arisco..."
                className="w-full bg-card rounded-xl px-4 py-3 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary text-foreground font-medium placeholder:text-muted-foreground transition-all border border-border-strong min-h-[72px] resize-y text-sm"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsOpen(false)}
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
              {loading ? 'Salvando...' : 'Finalizar Cadastro'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
