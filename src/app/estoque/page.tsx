import { createClient } from '@/infrastructure/database/server';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { NewInventoryItemForm } from '@/components/features/NewInventoryItemForm';
import Link from 'next/link';

export const revalidate = 0;

export default async function EstoquePage() {
  const supabase = await createClient();
  
  const { data: inventory, error } = await supabase
    .from('inventory')
    .select('*')
    .order('name', { ascending: true });

  return (
    <main className="flex-1 flex flex-col p-8 gap-8 w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-foreground">Minha Maleta (Estoque)</h1>
        <div className="flex gap-4">
          <NewInventoryItemForm />
          <Link href="/">
            <Button variant="secondary" className="!px-4 !py-2 text-sm">Voltar</Button>
          </Link>
        </div>
      </div>

      {error ? (
        <Card className="bg-error/10 border-error/20">
          <p className="text-red-500 font-bold">Erro ao buscar estoque: {error.message}</p>
        </Card>
      ) : inventory?.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-foreground/60 font-bold text-lg">Seu estoque está vazio.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {inventory?.map((item) => (
            <Card key={item.id} className="flex flex-col gap-3">
              <div className="flex justify-between items-start border-b border-foreground/10 pb-3">
                <div>
                  <h2 className="text-xl font-extrabold text-primary">{item.name}</h2>
                  <span className="text-xs font-bold text-foreground/60 uppercase tracking-wider">{item.type}</span>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Custo Un.</span>
                  <span className="text-sm font-bold text-foreground">R$ {item.unit_cost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-foreground/50 uppercase tracking-wider">Preço Venda</span>
                  <span className="text-sm font-bold text-success">R$ {item.sale_price.toFixed(2)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
