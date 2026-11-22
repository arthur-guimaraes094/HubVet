import { NextResponse } from 'next/server'
import { createClient } from '@/infrastructure/database/server'
import { z } from 'zod'
import { isTrustedPushEndpoint } from '@/core/utils/push-endpoint'

const subscribeSchema = z.object({
  endpoint: z
    .string()
    .max(2048)
    .refine(isTrustedPushEndpoint, 'Endpoint de notificação não confiável'),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
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

    const parsed = subscribeSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 })
    }

    const { endpoint, keys } = parsed.data

    // Verifica se o endpoint já pertence a outro usuário antes de atualizar/inserir
    const { data: existing, error: lookupError } = await supabase
      .from('push_subscriptions')
      .select('id, profile_id')
      .eq('endpoint', endpoint)
      .maybeSingle()

    if (lookupError) {
      console.error('Database error checking subscription:', lookupError.code)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    if (existing) {
      if (existing.profile_id !== user.id) {
        return NextResponse.json(
          { error: 'Subscription endpoint belongs to another account' },
          { status: 409 }
        )
      }

      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({
          p256dh: keys.p256dh,
          auth: keys.auth,
        })
        .eq('id', existing.id)
        .eq('profile_id', user.id)

      if (updateError) {
        console.error('Database error updating subscription:', updateError.code)
        return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
      }

      return NextResponse.json({ success: true }, { status: 201 })
    }

    const { error: insertError } = await supabase.from('push_subscriptions').insert({
      profile_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    })

    if (insertError) {
      if (insertError.code === '23505' || insertError.code === '42501') {
        return NextResponse.json(
          { error: 'Subscription endpoint belongs to another account' },
          { status: 409 }
        )
      }
      console.error('Database error saving subscription:', insertError.code)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error(
      'Error saving subscription:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
