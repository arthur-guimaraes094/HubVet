'use client'

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { updateInvoiceStatus } from '@/app/financeiro/actions';
import { formatBrazilDate } from '@/core/utils/timezone';

type Invoice = {
  id: string;
  totalAmount: number;
  status: 'pending' | 'paid' | 'cancelled';
  createdAt: string;
  dueDate: string | null;
  patientName: string;
  tutorName: string;
};

export function FinanceDashboard({ initialInvoices }: { initialInvoices: Invoice[] }) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const handleUpdateStatus = async (invoiceId: string, newStatus: 'pending' | 'paid' | 'cancelled') => {
    setIsUpdating(invoiceId);
    try {
      const response = await updateInvoiceStatus(invoiceId, newStatus);
      if (response.success) {
        setInvoices(invoices.map(inv => inv.id === invoiceId ? { ...inv, status: newStatus } : inv));
        toast(`Fatura atualizada para ${newStatus}`, 'success');
      } else {
        toast(response.error || 'Erro ao atualizar fatura', 'error');
      }
    } catch {
      toast('Erro inesperado', 'error');
    } finally {
      setIsUpdating(null);
    }
  };

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.totalAmount, 0);
  const pendingRevenue = invoices.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Receita Total (Paga)</h2>
          <p className="text-3xl font-black text-primary">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}
          </p>
        </Card>
        <Card className="p-6 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">A Receber (Pendente)</h2>
          <p className="text-3xl font-black text-amber-700 dark:text-amber-400">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingRevenue)}
          </p>
        </Card>
        <Card className="p-6 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Faturas Abertas</h2>
          <p className="text-3xl font-black text-foreground">
            {invoices.filter(i => i.status === 'pending').length}
          </p>
        </Card>
      </div>

      {/* Tabela de Faturas */}
      <Card className="p-5 sm:p-6 overflow-x-auto">
        <h2 className="text-xl font-bold mb-4">Últimas Faturas</h2>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Histórico financeiro e faturas</caption>
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th scope="col" className="pb-3 font-medium">Data</th>
              <th scope="col" className="pb-3 font-medium">Paciente / Tutor</th>
              <th scope="col" className="pb-3 font-medium">Valor</th>
              <th scope="col" className="pb-3 font-medium">Status</th>
              <th scope="col" className="pb-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhuma fatura encontrada.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="group">
                  <td className="py-4 text-foreground/85">
                    {formatBrazilDate(invoice.createdAt)}
                  </td>
                  <td className="py-4">
                    <div className="font-semibold text-foreground">{invoice.patientName}</div>
                    <div className="text-xs text-muted-foreground">{invoice.tutorName}</div>
                  </td>
                  <td className="py-4 font-bold text-foreground">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.totalAmount)}
                  </td>
                  <td className="py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                      ${invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 
                        invoice.status === 'pending' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' : 
                        'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'}
                    `}>
                      {invoice.status === 'paid' ? 'Pago' : invoice.status === 'pending' ? 'Pendente' : 'Cancelado'}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    {invoice.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          type="button"
                          variant="secondary" 
                          className="px-3! py-1! text-xs"
                          disabled={isUpdating === invoice.id}
                          aria-label={`Marcar fatura de ${invoice.patientName} como paga`}
                          onClick={() => handleUpdateStatus(invoice.id, 'paid')}
                        >
                          Marcar Pago
                        </Button>
                        <Button 
                          type="button"
                          variant="secondary" 
                          className="px-3! py-1! text-xs"
                          disabled={isUpdating === invoice.id}
                          aria-label={`Cancelar fatura de ${invoice.patientName}`}
                          onClick={() => handleUpdateStatus(invoice.id, 'cancelled')}
                        >
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
