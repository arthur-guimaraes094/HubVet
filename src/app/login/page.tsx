import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { login, signup } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const params = await searchParams;
  
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
          
          {params?.message && (
            <div className="p-3 bg-red-100 text-red-700 text-sm font-bold rounded-xl text-center shadow-neu-pressed">
              {params.message}
            </div>
          )}

          <div className="flex flex-col gap-4">
            <Input 
              name="email"
              type="email" 
              label="E-mail" 
              placeholder="seu@email.com" 
              required
            />
            <Input 
              name="password"
              type="password" 
              label="Senha" 
              placeholder="••••••••" 
              required
            />
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <Button formAction={login} variant="primary" className="w-full">
              Entrar
            </Button>
            
            {/* Opcional: Remova o botão de cadastro depois de criar a conta principal */}
            <Button formAction={signup} variant="secondary" className="w-full !text-sm mt-2 opacity-50 hover:opacity-100">
              Primeiro acesso? Cadastre-se
            </Button>
          </div>
        </form>
      </Card>
    </main>
  )
}
