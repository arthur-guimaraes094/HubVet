import { createClient } from '@/infrastructure/database/server';
import { FinanceDashboard } from '@/components/features/FinanceDashboard';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ViewTransition } from 'react';
import { Metadata } from 'next';

export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Financeiro',
  description: 'Acompanhe suas receitas, faturas de atendimentos e controle financeiro de sua clínica.',
};

export default async function FinanceiroPage() {
  const supabase = await createClient();

  // Buscar faturas com pacientes relacionados
  const { data: rawInvoices, error: invoicesError } = await supabase
    .from('invoices')
    .select(`
      id,
      total_amount,
      status,
      created_at,
      due_date,
      patients (
        id,
        name,
        species,
        tutors (
          id,
          name
        )
      )
    `)
    .order('created_at', { ascending: false });

  if (invoicesError) {
    console.error('Erro ao buscar faturas:', invoicesError);
  }

  // Buscar faturas itens (opcional, para exibir os detalhes se quisermos)
  // No Dashboard inicial, vamos focar no resumo e lista de faturas
  
  // Transformando dados para um formato mais limpo para o front-end
  const invoices = rawInvoices?.map(inv => ({
    id: inv.id,
    totalAmount: inv.total_amount,
    status: inv.status,
    createdAt: inv.created_at,
    dueDate: inv.due_date,
    patientName: inv.patients?.name || 'Desconhecido',
    tutorName: inv.patients?.tutors?.name || 'Desconhecido'
  })) || [];

  return (
    <ViewTransition enter="fade-in" default="none">
      <main className="flex-1 flex flex-col p-8 gap-8 w-full max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-foreground">Financeiro</h1>
            <p className="text-muted-foreground mt-1">Gestão de Faturas e Receitas</p>
          </div>
          <Link href="/">
            <Button variant="secondary" className="!px-4 !py-2 text-sm">Voltar</Button>
          </Link>
        </div>

        <FinanceDashboard initialInvoices={invoices} />
      </main>
    </ViewTransition>
  );
}
