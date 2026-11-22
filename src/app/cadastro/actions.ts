'use server'

import type { ActionResponse } from '@/core/types/actions'

export async function registrarUsuario(_rawData: unknown): Promise<ActionResponse> {
  void _rawData
  return {
    success: false,
    error: 'Cadastro público desativado. Este sistema é de uso restrito.',
  }
}
