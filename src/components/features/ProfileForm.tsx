"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { updateProfile, signOut } from '@/app/perfil/actions';
import { useRouter } from 'next/navigation';

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
    try {
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('crmv', crmv);
      formData.append('phone', phone);
      if (avatarFile) {
        formData.append('avatar', avatarFile);
      }

      await updateProfile(formData);
      success('Perfil atualizado com sucesso!');
    } catch (err: any) {
      error(err.message || 'Erro ao atualizar perfil.');
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
    <Card className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      <h3 className="text-xl font-extrabold text-primary">Meu Perfil</h3>

      <form onSubmit={handleSave} className="flex flex-col gap-5">
        
        {/* Avatar Upload */}
        <div className="flex items-center justify-center mb-4">
          <label className="relative flex items-center justify-center w-28 h-28 bg-background border-2 border-dashed border-foreground/20 rounded-full cursor-pointer hover:border-primary transition-colors overflow-hidden group shadow-neu-sm hover:shadow-neu-pressed">
            {avatarPreview ? (
              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-foreground/40 group-hover:text-primary transition-colors">MV</span>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white text-xs font-semibold">Alterar</span>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleAvatarChange} 
            />
          </label>
        </div>

        <Input 
          label="E-mail (Credencial de Login)" 
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
          label="Número do CRMV" 
          type="text" 
          value={crmv} 
          onChange={(e) => setCrmv(e.target.value)} 
          placeholder="Ex: CRMV-SP 12345" 
        />
        
        <Input 
          label="Telefone Profissional" 
          type="tel" 
          value={phone} 
          onChange={handlePhoneChange} 
          placeholder="(11) 99999-9999" 
        />

        <div className="pt-4 flex flex-col gap-3">
          <Button variant="primary" type="submit" disabled={loading} className="w-full py-4 text-lg">
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>

          <Button variant="secondary" type="button" onClick={handleSignOut} className="w-full py-3 text-error border-error/20 hover:bg-error/10">
            Sair (Logout)
          </Button>
        </div>
      </form>
    </Card>
  );
}
