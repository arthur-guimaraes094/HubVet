'use client'

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { updateInvoiceStatus } from '@/app/financeiro/actions';

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
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Receita Total (Paga)</h3>
          <p className="text-3xl font-black text-primary">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}
          </p>
        </Card>
        <Card className="p-6 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">A Receber (Pendente)</h3>
          <p className="text-3xl font-black text-amber-600">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingRevenue)}
          </p>
        </Card>
        <Card className="p-6 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Faturas Abertas</h3>
          <p className="text-3xl font-black text-foreground">
            {invoices.filter(i => i.status === 'pending').length}
          </p>
        </Card>
      </div>

      {/* Tabela de Faturas */}
      <Card className="p-6 overflow-x-auto">
        <h2 className="text-xl font-bold mb-4">Últimas Faturas</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b text-muted-foreground">
            <tr>
              <th className="pb-3 font-medium">Data</th>
              <th className="pb-3 font-medium">Paciente / Tutor</th>
              <th className="pb-3 font-medium">Valor</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium text-right">Ações</th>
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
                  <td className="py-4 text-foreground/80">
                    {new Date(invoice.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-4">
                    <div className="font-semibold text-foreground">{invoice.patientName}</div>
                    <div className="text-xs text-muted-foreground">{invoice.tutorName}</div>
                  </td>
                  <td className="py-4 font-bold text-foreground">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.totalAmount)}
                  </td>
                  <td className="py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold
                      ${invoice.status === 'paid' ? 'bg-green-100 text-green-700' : 
                        invoice.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                        'bg-red-100 text-red-700'}
                    `}>
                      {invoice.status === 'paid' ? 'Pago' : invoice.status === 'pending' ? 'Pendente' : 'Cancelado'}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    {invoice.status === 'pending' && (
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="secondary" 
                          className="!px-3 !py-1 text-xs"
                          disabled={isUpdating === invoice.id}
                          onClick={() => handleUpdateStatus(invoice.id, 'paid')}
                        >
                          Marcar Pago
                        </Button>
                        <Button 
                          variant="secondary" 
                          className="!px-3 !py-1 text-xs"
                          disabled={isUpdating === invoice.id}
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
