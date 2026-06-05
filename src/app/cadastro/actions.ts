'use server'

import { createClient } from '@/infrastructure/database/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { ActionResponse } from '@/core/types/actions'

const signupSchema = z.object({
  fullName: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  crmv: z.string().min(4, 'O CRMV deve ter pelo menos 4 caracteres'),
  phone: z.string().min(10, 'O telefone/WhatsApp deve ser válido'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword']
})

export async function registrarUsuario(rawData: unknown): Promise<ActionResponse> {
  try {
    const result = signupSchema.safeParse(rawData)
    if (!result.success) {
      return { 
        success: false, 
        error: 'Dados de cadastro inválidos', 
        fieldErrors: result.error.flatten().fieldErrors 
      }
    }

    const { email, password, fullName, crmv, phone } = result.data
    const supabase = await createClient()

    // 1. Cadastrar usuário no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    })

    if (authError) {
      console.error('Erro no Supabase Auth Sign Up:', authError)
      return { success: false, error: authError.message || 'Erro ao criar conta de usuário' }
    }

    const userId = authData.user?.id
    if (!userId) {
      return { success: false, error: 'Erro ao obter ID do usuário cadastrado' }
    }

    // 2. Atualizar a tabela public.profiles com as informações fornecidas.
    // A trigger no Postgres insere automaticamente uma linha em public.profiles para o novo user.id.
    // Atualizamos essa linha com o nome completo, crmv e telefone.
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        crmv: crmv,
        phone: phone
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Erro ao atualizar tabela profiles:', profileError)
      // Nota: O usuário foi criado na tabela auth, mas a atualização do perfil falhou.
      // Retornamos um erro informativo.
      return { success: false, error: 'Usuário criado, mas erro ao salvar detalhes do perfil: ' + profileError.message }
    }

    revalidatePath('/')
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro interno do servidor';
    console.error('Erro crítico na action registrarUsuario:', err);
    return { success: false, error: errorMessage };
  }

  // Redireciona para o painel principal após o cadastro bem-sucedido
  redirect('/')
}
