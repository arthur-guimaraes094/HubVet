"use client";

import React, { useState, useId, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AutocompleteInput } from '@/components/ui/AutocompleteInput';
import { addPatientAndTutor, getTutors, uploadPetPhotoAction } from '@/app/pacientes/actions';
import { useToast } from '@/components/ui/Toast';
import { compressPetPhoto } from '@/core/utils/image-compress';
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
  const [patientPhotoUrl, setPatientPhotoUrl] = useState<string | null>(null);
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
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      error('A foto deve ter no máximo 15MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const { blob, dataUrl } = await compressPetPhoto(file, 400, 0.82);
      // Mostra prévia imediata
      setPatientPhotoUrl(dataUrl);

      const formData = new FormData();
      formData.append('photo', new File([blob], 'pet-photo.jpg', { type: 'image/jpeg' }));

      const uploadRes = await uploadPetPhotoAction(formData);
      if (uploadRes.success && uploadRes.data?.publicUrl) {
        setPatientPhotoUrl(uploadRes.data.publicUrl);
      }
      success('Foto do pet carregada!');
    } catch (err) {
      console.error(err);
      error('Erro ao processar foto do pet.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const filteredTutors = tutors.filter((t) =>
    t.name.toLowerCase().includes(tutorSearch.toLowerCase())
  );

  const handleSelectTutor = (tutor: Tutor) => {
    setSelectedTutorId(tutor.id);
    setTutorSearch(tutor.name);
    setIsTutorListOpen(false);
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
        patientPhotoUrl,
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
      setPatientPhotoUrl(null);
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
        <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-60 -mt-6 mb-6">
          Tutor e Paciente
        </p>

        <form
          onSubmit={handleSave}
          className="flex flex-col gap-6 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar"
        >
          {/* Dados do Tutor */}
          <div className="flex flex-col gap-5 p-5 bg-foreground/2 rounded-3xl border border-foreground/5">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.2em]">
                Responsável (Tutor)
              </span>
              <div className="flex bg-background shadow-inner border border-border p-0.5 rounded-full scale-90">
                <button
                  type="button"
                  onClick={() => setTutorSelectionMode('new')}
                  className={`p-1.5 px-3 rounded-full transition-all text-[8px] font-black uppercase tracking-widest ${
                    tutorSelectionMode === 'new'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-foreground/40'
                  }`}
                >
                  Novo
                </button>
                <button
                  type="button"
                  onClick={() => setTutorSelectionMode('existing')}
                  className={`p-1.5 px-3 rounded-full transition-all text-[8px] font-black uppercase tracking-widest ${
                    tutorSelectionMode === 'existing'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-foreground/40'
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
                  placeholder="Ex: João da Silva"
                  value={tutorName}
                  onChange={(e) => setTutorName(e.target.value)}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="CPF"
                    placeholder="000.000.000-00"
                    value={tutorCpf}
                    onChange={handleCpfChange}
                    maxLength={14}
                  />
                  <Input
                    label="WhatsApp"
                    placeholder="(84) 99999-9999"
                    value={tutorPhone}
                    onChange={handlePhoneChange}
                    maxLength={15}
                  />
                </div>

                {/* Endereço Completo do Tutor */}
                <div className="pt-2 border-t border-foreground/5 flex flex-col gap-3">
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">
                      📍 Endereço Residencial (Para Consulta Domiciliar)
                    </span>
                    {loadingCep && (
                      <span className="text-[9px] font-bold text-primary animate-pulse">
                        Buscando CEP...
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="CEP"
                      placeholder="00000-000"
                      value={tutorCep}
                      onChange={handleCepChange}
                      maxLength={9}
                    />
                    <div className="col-span-2">
                      <Input
                        label="Rua / Logradouro"
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
              <div className="flex flex-col gap-2 relative">
                <span className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em] pl-4">
                  Pesquisar Tutor
                </span>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Digite o nome do tutor..."
                    value={tutorSearch}
                    onChange={(e) => {
                      setTutorSearch(e.target.value);
                      setSelectedTutorId('');
                      setIsTutorListOpen(true);
                    }}
                    onFocus={() => setIsTutorListOpen(true)}
                    className="w-full bg-background rounded-2xl px-6 py-4 shadow-inner border border-foreground/3 outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-medium transition-all"
                    required={tutorSelectionMode === 'existing'}
                  />
                  {isTutorListOpen && tutorSearch && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-2 bg-background border border-border rounded-2xl shadow-xl max-h-60 overflow-y-auto p-2 animate-in fade-in slide-in-from-top-2">
                      {filteredTutors.length > 0 ? (
                        filteredTutors.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleSelectTutor(t)}
                            className="w-full text-left px-4 py-3 rounded-xl hover:bg-primary/10 hover:text-primary transition-all font-medium text-sm flex items-center justify-between"
                          >
                            <div className="flex flex-col">
                              <span>{t.name}</span>
                              {t.address && (
                                <span className="text-[10px] text-foreground/40 truncate max-w-[240px]">
                                  📍 {t.address}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] opacity-40">Selecionar</span>
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-foreground/40 italic">
                          Nenhum tutor encontrado
                        </div>
                      )}
                    </div>
                  )}
                  {isTutorListOpen && (
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsTutorListOpen(false)}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dados do Paciente */}
          <div className="flex flex-col gap-5 p-5 bg-foreground/2 rounded-3xl border border-foreground/5">
            <span className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.2em] pl-1">
              Informações do Pet
            </span>

            {/* Foto do Pet */}
            <div className="flex items-center gap-4 px-1">
              <label className="relative w-20 h-20 rounded-full bg-card border-2 border-dashed border-primary/30 hover:border-primary flex items-center justify-center cursor-pointer overflow-hidden shrink-0 group transition-all shadow-sm">
                {patientPhotoUrl ? (
                  <Image
                    src={patientPhotoUrl}
                    alt="Foto do Pet"
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
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black text-foreground/40 uppercase tracking-[0.2em]">
                  🎂 Idade do Paciente
                </span>
                <div className="flex bg-background border border-border p-0.5 rounded-full scale-90">
                  <button
                    type="button"
                    onClick={() => setAgeMode('approx')}
                    className={`p-1 px-2.5 rounded-full text-[8px] font-black uppercase tracking-wider transition-all ${
                      ageMode === 'approx' ? 'bg-primary text-white' : 'text-foreground/40'
                    }`}
                  >
                    Anos / Meses
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgeMode('exact')}
                    className={`p-1 px-2.5 rounded-full text-[8px] font-black uppercase tracking-wider transition-all ${
                      ageMode === 'exact' ? 'bg-primary text-white' : 'text-foreground/40'
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

            {/* Observação de Fertilidade */}
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
                  placeholder="Ex: Castrado há 1 ano, último cio..."
                  value={fertilityNotes}
                  onChange={(e) => setFertilityNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Observações do Pet (Alergias, etc.) */}
            <div className="flex flex-col gap-2 pt-2 border-t border-foreground/5">
              <label className="text-[10px] font-black text-error/80 uppercase tracking-[0.2em] pl-4">
                ⚠️ Alergias e Observações Importantes
              </label>
              <textarea
                value={clinicalObservations}
                onChange={(e) => setClinicalObservations(e.target.value)}
                placeholder="Ex: Alérgico a Dipirona, cardiopata, temperamento arisco..."
                className="w-full bg-card rounded-xl px-4 py-3 shadow-sm outline-none focus:ring-2 focus:ring-primary/40 text-foreground font-medium placeholder:text-foreground/40 transition-all border border-border min-h-[72px] resize-y text-sm"
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
