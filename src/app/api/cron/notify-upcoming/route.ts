import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { Database } from '@/types/supabase';

// Configuração do Web Push
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:contato@hubvet.com',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export async function GET(request: Request) {
  try {
    // 1. Segurança: Validar CRON_SECRET de forma rígida (fail closed)
    const authHeader = request.headers.get('authorization');
    if (!process.env.CRON_SECRET) {
      console.error('CRON_SECRET is not configured in environment variables.');
      return new Response('Internal Server Error: Cron secret not configured', { status: 500 });
    }
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys not configured. Skipping push notification.');
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    // 2. Cliente Supabase com Service Role Key para ignorar RLS e ler todos os agendamentos
    // Se não existir, tenta com a ANON KEY (pode falhar se o RLS bloquear leitura geral)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    // 3. Buscar todas as consultas de hoje
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

    const { data: consultations, error } = await supabase
      .from('consultations')
      .select('id, profile_id, date, status, profiles(full_name)')
      .gte('date', startOfDay)
      .lte('date', endOfDay)
      .neq('status', 'Completed')
      .neq('status', 'Canceled')
      .order('date', { ascending: true });

    if (error) {
      throw error;
    }

    if (!consultations || consultations.length === 0) {
      return NextResponse.json({ message: 'Nenhuma consulta hoje.' }, { status: 200 });
    }

    // 4. Agrupar por usuário (profile_id)
    const userConsultations = consultations.reduce((acc, curr) => {
      if (!acc[curr.profile_id]) {
        acc[curr.profile_id] = [];
      }
      acc[curr.profile_id].push(curr);
      return acc;
    }, {} as Record<string, typeof consultations>);

    const notificationsSent = [];

    // 5. Para cada usuário, pegar a primeira consulta e verificar o horário
    for (const profileId of Object.keys(userConsultations)) {
      const userAgenda = userConsultations[profileId];
      const firstConsultation = userAgenda[0]; // Como já ordenamos por data, o 0 é a primeira
      
      // Como o Vercel Hobby limita a execução do Cron a 1 vez por dia,
      // enviamos a notificação de resumo matinal diretamente se houver consultas hoje.
      if (true) {
        const totalConsultations = userAgenda.length;
        const userName = firstConsultation.profiles?.full_name?.split(' ')[0] || 'Veterinário';

        // Buscar as inscrições (celulares) desse usuário
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('profile_id', profileId);

        if (subscriptions && subscriptions.length > 0) {
          const payload = JSON.stringify({
            title: 'Sua agenda começou!',
            body: `Olá ${userName}, hoje você possui ${totalConsultations} consulta(s). Veja na sua agenda.`,
            url: '/agenda'
          });

          // Disparar para todos os dispositivos do usuário
          for (const sub of subscriptions) {
            try {
              const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.p256dh,
                  auth: sub.auth
                }
              };

              await webpush.sendNotification(pushSubscription, payload);
              notificationsSent.push(profileId);
            } catch (err) {
              console.error('Failed to send push to subscription:', sub.id, err);
              // Pode ser que a inscrição tenha expirado, o ideal seria deletar:
              // if (err.statusCode === 410) { await supabase.from('push_subscriptions').delete().eq('id', sub.id) }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true, notifiedUsers: notificationsSent }, { status: 200 });

  } catch (error: unknown) {
    console.error('Error in cron job:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
