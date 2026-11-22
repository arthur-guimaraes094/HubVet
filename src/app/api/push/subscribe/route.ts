import { NextResponse } from 'next/server'
import { createClient } from '@/infrastructure/database/server'
import { z } from 'zod'

const subscribeSchema = z.object({
  endpoint: z
    .string()
    .url('Endpoint inválido')
    .refine((u) => u.startsWith('https://'), 'Endpoint deve usar HTTPS'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
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

    const rawBody = await request.json()
    const parsed = subscribeSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 })
    }

    const { endpoint, keys } = parsed.data

    // Salva ou atualiza a subscription baseada no endpoint (que é único)
    const { error: dbError } = await supabase.from('push_subscriptions').upsert(
      {
        profile_id: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      { onConflict: 'endpoint' }
    )

    if (dbError) {
      console.error('Database error saving subscription:', dbError)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Error saving subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
