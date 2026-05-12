"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { updateProfile, signOut } from '@/app/perfil/actions';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface ProfileFormProps {
  initialData: {
    email: string;
    full_name: string;
    crmv: string;
    phone: string;
    avatar_url?: string;
  }
}

export function ProfileForm({ initialData }: ProfileFormProps) {
  const router = useRouter();
  const { success, error } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fullName, setFullName] = useState(initialData.full_name || '');
  const [crmv, setCrmv] = useState(initialData.crmv || '');
  const [phone, setPhone] = useState(initialData.phone || '');

  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialData.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove tudo que não for número
    if (value.length > 11) value = value.slice(0, 11); // Limite de 11 dígitos

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
        <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-60">Configurações da Conta</p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-8">
        
        {/* Avatar Upload */}
        <div className="flex items-center justify-center mb-4">
          <label className="relative flex items-center justify-center w-32 h-32 bg-background rounded-full cursor-pointer overflow-hidden group shadow-sm border border-border hover:shadow-inner border border-border bg-foreground/5 transition-all border border-foreground/[0.03] p-1.5">
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
                <span className="text-4xl font-black text-foreground/20 group-hover:text-primary transition-colors tracking-tighter">MV</span>
              )}
            </div>
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-[10px] font-black uppercase tracking-widest">Alterar</span>
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
            label="Nome Completo" 
            type="text" 
            value={fullName} 
            onChange={(e) => setFullName(e.target.value)} 
            placeholder="Ex: Dra. Ana Silva" 
          />
          
          <Input 
            label="Registro CRMV" 
            type="text" 
            value={crmv} 
            onChange={(e) => setCrmv(e.target.value)} 
            placeholder="Ex: CRMV-SP 12345" 
          />
          
          <Input 
            label="WhatsApp Profissional" 
            type="tel" 
            value={phone} 
            onChange={handlePhoneChange} 
            placeholder="(11) 99999-9999" 
          />
        </div>

        <div className="pt-4 flex flex-col gap-4">
          {submitError && (
            <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm font-bold text-center animate-in fade-in slide-in-from-bottom-2">
              {submitError}
            </div>
          )}
          <Button variant="primary" type="submit" disabled={loading} className="w-full !py-6 shadow-sm border border-border hover:shadow-sm border border-border">
            {loading ? 'Salvando...' : 'Salvar Perfil'}
          </Button>

          <Button variant="secondary" type="button" onClick={handleSignOut} className="w-full !py-4 text-error border-error/10 hover:bg-error/10">
            Encerrar Sessão
          </Button>
        </div>
      </form>
    </Card>
  );
}
