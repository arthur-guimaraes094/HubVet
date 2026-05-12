import { NextResponse } from 'next/server'
import { createClient } from '@/infrastructure/database/server'

export async function POST(request: Request) {
  try {
    const subscription = await request.json()
    const supabase = await createClient()

    const { data: { session }, error: authError } = await supabase.auth.getSession()

    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // A assinatura do web-push tem chaves (keys) de autenticação que precisam ser salvas
    const endpoint = subscription.endpoint
    const p256dh = subscription.keys.p256dh
    const auth = subscription.keys.auth

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 })
    }

    // Salva ou atualiza a subscription baseada no endpoint (que é único)
    const { error: dbError } = await supabase
      .from('push_subscriptions')
      .upsert({
        profile_id: session.user.id,
        endpoint: endpoint,
        p256dh: p256dh,
        auth: auth,
      }, { onConflict: 'endpoint' })

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
