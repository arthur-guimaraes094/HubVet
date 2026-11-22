'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground font-sans">
        <main
          id="main-content"
          tabIndex={-1}
          className="max-w-md w-full p-8 rounded-2xl border border-border bg-card shadow-sm text-center flex flex-col items-center gap-4"
          role="alert"
        >
          <h1 className="text-2xl font-black">Falha crítica no aplicativo</h1>
          <p className="text-sm text-muted-foreground">
            Não foi possível renderizar a estrutura principal. Tente recarregar a página.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="min-h-[44px] px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold"
          >
            Recarregar sistema
          </button>
        </main>
      </body>
    </html>
  );
}
