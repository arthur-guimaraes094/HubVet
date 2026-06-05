"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { registrarUsuario } from './actions';
import Link from 'next/link';
import { ViewTransition } from "react";

export default function CadastroPage() {
  const { success, error } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  // Form states
  const [fullName, setFullName] = useState('');
  const [crmv, setCrmv] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Client-side validations
    if (password !== confirmPassword) {
      error('As senhas não coincidem.');
      setSubmitError('As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      error('A senha deve ter pelo menos 6 caracteres.');
      setSubmitError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      const result = await registrarUsuario({
        fullName,
        crmv,
        phone,
        email,
        password,
        confirmPassword
      });

      if (result && !result.success) {
        error(result.error || 'Erro ao realizar cadastro.');
        setSubmitError(result.error || 'Erro ao realizar cadastro.');
      } else {
        success('Cadastro realizado com sucesso! Bem-vindo(a).');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar.';
      error(msg);
      setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ViewTransition enter="fade-in" default="none">
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen p-6 max-w-md mx-auto w-full">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-1">HubVet</h1>
          <p className="text-sm font-black text-foreground/50 uppercase tracking-[0.2em]">
            Novo Cadastro Profissional
          </p>
        </div>

        <Card className="w-full !p-8 bg-background/40">
          <form onSubmit={handleRegister} className="flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              <Input 
                label="Nome Completo" 
                type="text" 
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dra. Mariana Souza" 
                required
              />

              <Input 
                label="WhatsApp Profissional" 
                type="tel" 
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(11) 99999-9999" 
                required
              />

              <Input 
                label="Registro CRMV" 
                type="text" 
                value={crmv}
                onChange={(e) => setCrmv(e.target.value)}
                placeholder="CRMV-SP 12345" 
                required
              />

              <div className="h-px bg-foreground/10 my-1"></div>

              <Input 
                label="E-mail de Acesso" 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com" 
                required
              />

              <Input 
                label="Senha" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres" 
                required
              />

              <Input 
                label="Confirmar Senha" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita sua senha" 
                required
              />
            </div>

            {submitError && (
              <div className="p-3 bg-error/10 text-error text-xs font-bold rounded-xl text-center border border-error/20 animate-in fade-in slide-in-from-bottom-2">
                {submitError}
              </div>
            )}

            <div className="flex flex-col gap-3 mt-2">
              <Button 
                variant="primary" 
                type="submit" 
                disabled={loading}
                className="w-full !py-4"
              >
                {loading ? 'Cadastrando...' : 'Criar Conta'}
              </Button>
              
              <Link href="/login" className="w-full text-center">
                <span className="text-[10px] font-black uppercase text-foreground/40 hover:text-primary tracking-widest transition-colors cursor-pointer py-2 block">
                  Já possui conta? Entrar
                </span>
              </Link>
            </div>
          </form>
        </Card>
      </main>
    </ViewTransition>
  );
}
