import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { login } from './actions'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Acesse sua conta no HubVet, o prontuário expresso digital veterinário.',
}

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  auth_unavailable: 'Erro de conexão com o servidor de autenticação. Tente novamente.',
  invalid_input: 'Informe um e-mail válido e sua senha.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const errorCode = params?.error
  const errorMessage =
    errorCode && Object.prototype.hasOwnProperty.call(LOGIN_ERROR_MESSAGES, errorCode)
      ? LOGIN_ERROR_MESSAGES[errorCode]
      : null

  return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-screen p-6 max-w-md mx-auto w-full">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary mb-2">HubVet</h1>
        <p className="text-lg font-medium text-foreground/80">
          Acesso Restrito
        </p>
      </div>

      <Card className="w-full">
        <form className="flex flex-col gap-6">
          {errorMessage && (
            <div
              role="alert"
              className="p-3 bg-red-100 text-red-700 text-sm font-bold rounded-xl text-center shadow-inner border border-border"
            >
              {errorMessage}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <Input
              name="email"
              type="email"
              label="E-mail"
              placeholder="seu@email.com"
              autoComplete="email"
              required
            />
            <Input
              name="password"
              type="password"
              label="Senha"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <Button formAction={login} variant="primary" className="w-full">
              Entrar
            </Button>
          </div>
        </form>
      </Card>
    </main>
  )
}
