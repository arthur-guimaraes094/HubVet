"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { updateProfile, signOut } from '@/app/perfil/actions';
import { fetchAddressByCep, formatCep } from '@/core/utils/cep';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface ProfileFormProps {
  initialData: {
    email: string;
    full_name: string;
    crmv: string;
    phone: string;
    avatar_url?: string;
    base_cep?: string;
    base_address?: string;
    km_rate?: number;
  };
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const router = useRouter();
  const { success, error } = useToast();

  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fullName, setFullName] = useState(initialData.full_name || '');
  const [crmv, setCrmv] = useState(initialData.crmv || '');
  const [phone, setPhone] = useState(initialData.phone || '');
  const [baseCep, setBaseCep] = useState(initialData.base_cep || '59152-250');
  const [baseAddress, setBaseAddress] = useState(
    initialData.base_address || 'Rua das Embarcações, 171, Nova Parnamirim, Parnamirim - RN'
  );
  const [kmRate, setKmRate] = useState((initialData.km_rate ?? 2.5).toString());
  const [loadingCep, setLoadingCep] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    initialData.avatar_url || null
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);

    if (value.length <= 2) {
      setPhone(value);
      return;
    }

    const ddd = value.slice(0, 2);
    const part1 = value.slice(2, value.length <= 10 ? 6 : 7);
    const part2 = value.slice(value.length <= 10 ? 6 : 7);

    if (part2) {
      setPhone(`(${ddd}) ${part1}-${part2}`);
    } else {
      setPhone(`(${ddd}) ${part1}`);
    }
  };

  const handleBaseCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setBaseCep(formatted);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8) {
      setLoadingCep(true);
      const found = await fetchAddressByCep(digits);
      setLoadingCep(false);
      if (found) {
        const composed = [found.street, found.neighborhood, `${found.city} - ${found.state}`]
          .filter(Boolean)
          .join(', ');
        if (composed) setBaseAddress(composed);
      }
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSubmitError(null);
    try {
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('crmv', crmv);
      formData.append('phone', phone);
      formData.append('baseCep', baseCep);
      formData.append('baseAddress', baseAddress);
      formData.append('kmRate', kmRate);
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      const result = await updateProfile(formData);
      if (!result.success) {
        error(result.error);
        setSubmitError(result.error);
        return;
      }
      success('Perfil atualizado com sucesso!');
    } catch {
      error('Erro ao atualizar perfil.');
      setSubmitError('Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <Card className="flex flex-col gap-8 w-full max-w-2xl mx-auto p-10">
      <div className="flex flex-col gap-1">
        <h3 className="text-3xl font-black text-foreground tracking-tighter">Meu Perfil</h3>
        <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-60">
          Configurações da Conta & Deslocamento
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-8">
        {/* Avatar Upload */}
        <div className="flex items-center justify-center mb-4">
          <label className="relative flex items-center justify-center w-32 h-32 bg-background rounded-full cursor-pointer overflow-hidden group shadow-sm border border-border hover:shadow-inner transition-all p-1.5">
            <div className="w-full h-full rounded-full overflow-hidden bg-foreground/5 flex items-center justify-center">
              {avatarPreview ? (
                <Image
                  src={avatarPreview}
                  alt="Avatar"
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                  priority
                />
              ) : (
                <span className="text-4xl font-black text-foreground/20 group-hover:text-primary transition-colors tracking-tighter">
                  MV
                </span>
              )}
            </div>
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-[10px] font-black uppercase tracking-widest">
                Alterar
              </span>
            </div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </label>
        </div>

        <div className="flex flex-col gap-6">
          <Input
            label="E-mail de Acesso"
            type="email"
            value={initialData.email}
            disabled
            readOnly
          />

          <Input
            label="Nome Completo (Exibido no Receituário e Relatório)"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ex: Dra. Gabriela Soares"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Registro CRMV"
              type="text"
              value={crmv}
              onChange={(e) => setCrmv(e.target.value)}
              placeholder="Ex: CRMV-RN 1234"
            />

            <Input
              label="WhatsApp Profissional"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(84) 98636-5455"
            />
          </div>

          <div className="p-5 rounded-3xl bg-foreground/3 border border-border flex flex-col gap-4 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                🚗 Parâmetros de Cálculo de Deslocamento Domiciliar
              </span>
              {loadingCep && (
                <span className="text-[9px] font-bold text-primary animate-pulse">
                  Buscando CEP...
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="CEP Base de Partida"
                placeholder="59152-250"
                value={baseCep}
                onChange={handleBaseCepChange}
                maxLength={9}
              />
              <Input
                label="Valor Recomendado por Km (R$/km)"
                type="number"
                step="0.10"
                placeholder="2.50"
                value={kmRate}
                onChange={(e) => setKmRate(e.target.value)}
              />
            </div>

            <Input
              label="Endereço Base de Partida"
              placeholder="Rua das Embarcações, 171, Nova Parnamirim"
              value={baseAddress}
              onChange={(e) => setBaseAddress(e.target.value)}
            />
            <span className="text-[11px] text-foreground/50 italic px-1">
              O sistema calcula automaticamente a distância de ida e volta até a residência do tutor e multiplica pela taxa de R$/km configurada acima.
            </span>
          </div>
        </div>

        <div className="pt-4 flex flex-col gap-4">
          {submitError && (
            <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm font-bold text-center animate-in fade-in slide-in-from-bottom-2">
              {submitError}
            </div>
          )}
          <Button
            variant="primary"
            type="submit"
            disabled={loading}
            className="w-full py-6! shadow-sm border border-border hover:shadow-sm"
          >
            {loading ? 'Salvando...' : 'Salvar Perfil'}
          </Button>

          <Button
            variant="secondary"
            type="button"
            onClick={handleSignOut}
            className="w-full py-4! text-error border-error/10 hover:bg-error/10"
          >
            Encerrar Sessão
          </Button>
        </div>
      </form>
    </Card>
  );
}
