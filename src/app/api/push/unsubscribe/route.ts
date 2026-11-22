import { NextResponse } from 'next/server'
import { createClient } from '@/infrastructure/database/server'
import { z } from 'zod'
import { isTrustedPushEndpoint } from '@/core/utils/push-endpoint'

const unsubscribeSchema = z.object({
  endpoint: z
    .string()
    .max(2048)
    .refine(isTrustedPushEndpoint, 'Endpoint inválido'),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    const parsed = unsubscribeSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid endpoint' }, { status: 400 })
    }

    const { error: dbError } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', parsed.data.endpoint)
      .eq('profile_id', user.id)

    if (dbError) {
      console.error('Database error removing subscription:', dbError.code)
      return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error(
      'Error removing subscription:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
