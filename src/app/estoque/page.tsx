import { createClient } from '@/infrastructure/database/server';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { InventoryItemForm } from '@/components/features/InventoryItemForm';
import { CatalogList } from '@/components/features/CatalogList';
import Link from 'next/link';
import { Metadata } from 'next';

export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Catálogo de Insumos',
  description: 'Gerencie o catálogo de medicamentos, vacinas, procedimentos e materiais utilizados nos atendimentos.',
};

export default async function EstoquePage() {
  const supabase = await createClient();
  
  const { data: rawInventory, error } = await supabase
    .from('inventory')
    .select('*')
    .order('name', { ascending: true });

  const inventory = rawInventory?.map(item => ({
    id: item.id,
    name: item.name,
    type: item.type,
    concentration: item.concentration,
    unitCost: item.unit_cost,
    salePrice: item.sale_price
  })) || [];

  return (
    <main className="flex-1 flex flex-col p-8 gap-8 w-full max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 px-2">
        <div>
          <h1 className="text-5xl font-black text-foreground tracking-tighter">Maleta</h1>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] opacity-70 mt-1">Catálogo de Itens e Materiais</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <InventoryItemForm />
          <Link href="/" className="flex-1 md:flex-none">
            <Button variant="secondary" className="w-full !px-8 !py-4">Voltar</Button>
          </Link>
        </div>
      </div>

      {error ? (
        <Card className="bg-error/10 border-error/20">
          <p className="text-red-500 font-bold">Erro ao buscar catálogo: {error.message}</p>
        </Card>
      ) : !inventory || inventory.length === 0 ? (
        <Card className="text-center py-16 flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-foreground/5 rounded-full flex items-center justify-center text-3xl opacity-40">💊</div>
          <p className="text-foreground/60 font-bold text-lg">Seu catálogo está vazio.</p>
          <InventoryItemForm />
        </Card>
      ) : (
        <CatalogList initialItems={inventory} />
      )}
    </main>
  );
}
