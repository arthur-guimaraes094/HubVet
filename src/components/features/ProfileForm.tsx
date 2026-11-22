"use client";

import React, { useState, useRef, useEffect, useId } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { updateProfile, signOut } from '@/app/perfil/actions';
import { fetchAddressByCep, formatCep } from '@/core/utils/cep';
import { compressPetPhoto } from '@/core/utils/image-compress';
import { validateImageUpload } from '@/core/utils/upload-validation';
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
    pix_key?: string;
    pix_key_type?: string;
  };
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const router = useRouter();
  const { success, error } = useToast();
  const pixKeyTypeId = useId();

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
  const [pixKey, setPixKey] = useState<string>(initialData.pix_key || '');
  const [pixKeyType, setPixKeyType] = useState<string>(initialData.pix_key_type || 'CPF');

  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    initialData.avatar_url || null
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const blobPreviewUrlRef = useRef<string | null>(null);

  const revokeBlobPreview = () => {
    if (blobPreviewUrlRef.current) {
      URL.revokeObjectURL(blobPreviewUrlRef.current);
      blobPreviewUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (blobPreviewUrlRef.current) {
        URL.revokeObjectURL(blobPreviewUrlRef.current);
        blobPreviewUrlRef.current = null;
      }
    };
  }, []);

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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEl = e.currentTarget;
    const file = inputEl.files?.[0];
    if (!file) return;

    try {
      const validation = await validateImageUpload(file, 15 * 1024 * 1024);
      if (!validation.valid) {
        error(validation.error);
        return;
      }

      revokeBlobPreview();
      const objectUrl = URL.createObjectURL(file);
      blobPreviewUrlRef.current = objectUrl;
      setAvatarFile(file);
      setAvatarPreview(objectUrl);
    } finally {
      inputEl.value = '';
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
      formData.append('pixKey', pixKey);
      formData.append('pixKeyType', pixKeyType);
      if (avatarFile) {
        const { blob } = await compressPetPhoto(avatarFile, 512, 0.85);
        formData.append('avatar', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
      }

      const result = await updateProfile(formData);
      if (!result.success) {
        error(result.error);
        setSubmitError(result.error);
        return;
      }
      if (result.data?.avatarUrl) {
        revokeBlobPreview();
        setAvatarPreview(result.data.avatarUrl);
      }
      setAvatarFile(null);
      success('Perfil atualizado com sucesso!');
    } catch {
      error('Erro ao atualizar perfil.');
      setSubmitError('Erro ao atualizar perfil.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('hubvet_')) {
            keysToRemove.push(key);
          }
        }
        for (const key of keysToRemove) {
          localStorage.removeItem(key);
        }
      } catch {
        // ignore storage errors on sign-out
      }
    }
    await signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <Card className="flex flex-col gap-8 w-full max-w-2xl mx-auto p-5 sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tighter">
          Dados Profissionais
        </h2>
        <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">
          Configurações da Conta &amp; Deslocamento
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-8">
        {/* Avatar Upload */}
        <div className="flex items-center justify-center mb-4">
          <label className="relative flex items-center justify-center w-32 h-32 bg-background rounded-full cursor-pointer overflow-hidden group shadow-sm border border-border-strong hover:shadow-inner transition-all p-1.5 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
            <div className="w-full h-full rounded-full overflow-hidden bg-foreground/5 flex items-center justify-center">
              {avatarPreview ? (
                <Image
                  src={avatarPreview}
                  alt={fullName ? `Foto de perfil de ${fullName}` : 'Foto de perfil profissional'}
                  width={128}
                  height={128}
                  unoptimized
                  className="w-full h-full object-cover"
                  priority
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="text-4xl font-black text-muted-foreground group-hover:text-primary transition-colors tracking-tighter"
                >
                  MV
                </span>
              )}
            </div>
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
            >
              <span className="text-white text-[10px] font-black uppercase tracking-widest">
                Alterar
              </span>
            </div>
            <span className="sr-only">Alterar foto do perfil</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarChange}
            />
          </label>
        </div>

        <div className="flex flex-col gap-6">
          <Input
            label="E-mail de Acesso"
            type="email"
            autoComplete="email"
            value={initialData.email}
            disabled
            readOnly
          />

          <Input
            label="Nome Completo (Exibido no Receituário e Relatório)"
            type="text"
            autoComplete="name"
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
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(84) 98636-5455"
            />
          </div>

          <div className="p-5 rounded-3xl bg-foreground/3 border border-border flex flex-col gap-4 mt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black text-primary uppercase tracking-[0.15em]">
                <span aria-hidden="true">🚗</span> Parâmetros de Cálculo de Deslocamento Domiciliar
              </span>
              {loadingCep && (
                <span role="status" aria-live="polite" className="text-[11px] font-bold text-primary animate-pulse">
                  Buscando CEP...
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="CEP Base de Partida"
                inputMode="numeric"
                autoComplete="postal-code"
                placeholder="59152-250"
                value={baseCep}
                onChange={handleBaseCepChange}
                maxLength={9}
              />
              <Input
                label="Valor Recomendado por Km (R$/km)"
                type="number"
                inputMode="decimal"
                step="0.10"
                placeholder="2.50"
                value={kmRate}
                onChange={(e) => setKmRate(e.target.value)}
              />
            </div>

            <Input
              label="Endereço Base de Partida"
              autoComplete="street-address"
              placeholder="Rua das Embarcações, 171, Nova Parnamirim"
              value={baseAddress}
              onChange={(e) => setBaseAddress(e.target.value)}
            />
            <span className="text-xs text-muted-foreground italic px-1">
              O sistema calcula automaticamente a distância de ida e volta até a residência do tutor e multiplica pela taxa de R$/km configurada acima.
            </span>
          </div>

          {/* Dados de Pagamento (PIX) */}
          <div className="flex flex-col gap-4 p-5 rounded-2xl bg-foreground/[0.02] border border-border">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground">
                <span aria-hidden="true">💳</span> Dados de Pagamento (Cobrança PIX)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={pixKeyTypeId}
                  className="text-sm font-semibold text-foreground/85"
                >
                  Tipo de Chave
                </label>
                <select
                  id={pixKeyTypeId}
                  value={pixKeyType}
                  onChange={(e) => setPixKeyType(e.target.value)}
                  className="w-full bg-card border border-border-strong rounded-xl px-3.5 py-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="CPF">CPF</option>
                  <option value="Telefone">Telefone Celular</option>
                  <option value="Email">E-mail</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="Aleatória">Chave Aleatória (EVP)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Chave PIX"
                  placeholder="Ex: 84986365455 ou seu@email.com"
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                />
              </div>
            </div>
            <span className="text-xs text-muted-foreground italic px-1">
              Esta chave será exibida na tela de finalização de consultas com botão de cópia rápida e opção de envio no WhatsApp do tutor.
            </span>
          </div>
        </div>

        <div className="pt-4 flex flex-col gap-4">
          {submitError && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-error/10 border border-error/30 text-red-700 dark:text-red-300 text-sm font-bold text-center animate-in fade-in slide-in-from-bottom-2"
            >
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
            className="w-full py-4! text-red-700! dark:text-red-300! border-error/30! hover:bg-error/10!"
          >
            Encerrar Sessão
          </Button>
        </div>
      </form>
    </Card>
  );
}
