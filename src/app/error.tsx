'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button, buttonClasses } from '@/components/ui/Button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex-1 flex flex-col items-center justify-center p-6 outline-none"
    >
      <Card
        role="alert"
        className="max-w-md w-full p-8 text-center flex flex-col items-center gap-4"
      >
        <h1 className="text-2xl font-black text-foreground tracking-tight">Algo deu errado</h1>
        <p className="text-sm text-muted-foreground font-medium">
          Ocorreu um erro inesperado ao carregar esta página. Seus dados salvos estão seguros.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
          <Button type="button" variant="primary" onClick={() => reset()}>
            Tentar novamente
          </Button>
          <Link href="/" className={buttonClasses('secondary')}>
            Voltar ao Painel
          </Link>
        </div>
      </Card>
    </main>
  );
}
