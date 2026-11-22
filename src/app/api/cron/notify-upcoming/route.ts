import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { Database } from '@/types/supabase';
import { getBrazilDateString, getBrazilDayBoundsUtc } from '@/core/utils/timezone';

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

function isValidCronSecret(authHeader: string | null, secret: string): boolean {
  if (!authHeader) return false;
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(authHeader, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendPushAndCleanupExpired(
  supabase: ReturnType<typeof createClient<Database>>,
  sub: PushSubscriptionRow,
  payload: string
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      payload
    );
    return true;
  } catch (err: unknown) {
    const statusCode =
      typeof err === 'object' && err !== null && 'statusCode' in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    if (statusCode === 404 || statusCode === 410) {
      await supabase.from('push_subscriptions').delete().eq('id', sub.id);
    }
    console.error('Failed to send push to subscription:', sub.id, err);
    return false;
  }
}

export async function GET(request: Request) {
  try {
    // 1. Segurança: Validar CRON_SECRET com comparação em tempo constante (fail closed)
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error('CRON_SECRET is not configured in environment variables.');
      return new Response('Internal Server Error: Cron secret not configured', { status: 500 });
    }
    const authHeader = request.headers.get('authorization');
    if (!isValidCronSecret(authHeader, cronSecret)) {
      return new Response('Unauthorized', { status: 401 });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('VAPID keys not configured. Skipping push notification.');
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    // 2. Exigir Service Role Key explicitamente para o job administrativo
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase URL or Service Role Key for cron job.');
      return NextResponse.json(
        { error: 'Supabase admin credentials not configured' },
        { status: 500 }
      );
    }
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // 3. Buscar todas as consultas do dia atual em horário do Brasil (BRT)
    const now = new Date();
    const { startOfDayUtc, endOfDayUtc } = getBrazilDayBoundsUtc(now);

    const { data: consultations, error } = await supabase
      .from('consultations')
      .select('id, profile_id, date, status, profiles(full_name)')
      .gte('date', startOfDayUtc)
      .lte('date', endOfDayUtc)
      .neq('status', 'Completed')
      .neq('status', 'Canceled')
      .order('date', { ascending: true });

    if (error) {
      throw error;
    }

    const notificationsSent: string[] = [];

    if (consultations && consultations.length > 0) {
      // 4. Agrupar consultas por usuário (profile_id)
      const userConsultations = consultations.reduce((acc, curr) => {
        if (!acc[curr.profile_id]) {
          acc[curr.profile_id] = [];
        }
        acc[curr.profile_id].push(curr);
        return acc;
      }, {} as Record<string, typeof consultations>);

      for (const profileId of Object.keys(userConsultations)) {
        const userAgenda = userConsultations[profileId];
        const firstConsultation = userAgenda[0];
        const totalConsultations = userAgenda.length;
        const profileObj = Array.isArray(firstConsultation.profiles)
          ? firstConsultation.profiles[0]
          : firstConsultation.profiles;
        const userName = profileObj?.full_name?.split(' ')[0] || 'Veterinário';

        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('profile_id', profileId);

        if (subscriptions && subscriptions.length > 0) {
          const payload = JSON.stringify({
            title: 'Sua agenda começou!',
            body: `Olá ${userName}, hoje você possui ${totalConsultations} consulta(s). Veja na sua agenda.`,
            url: '/agenda',
          });

          for (const sub of subscriptions) {
            const sent = await sendPushAndCleanupExpired(supabase, sub, payload);
            if (sent) {
              notificationsSent.push(profileId);
            }
          }
        }
      }
    }

    // 5. Avisos Programados de Vacinas (próximos 7 dias ou vencidas em BRT)
    const inSevenDaysStr = getBrazilDateString(now, 7);

    const { data: dueVaccines } = await supabase
      .from('patient_vaccinations')
      .select('id, profile_id, patient_id, vaccine_name, next_due_date, next_dose_label, notified_at, patients(name)')
      .is('completed_by_vaccination_id', null)
      .is('notified_at', null)
      .lte('next_due_date', inSevenDaysStr);

    if (dueVaccines && dueVaccines.length > 0) {
      const vaccinesByUser = dueVaccines.reduce((acc, vac) => {
        if (!acc[vac.profile_id]) acc[vac.profile_id] = [];
        acc[vac.profile_id].push(vac);
        return acc;
      }, {} as Record<string, typeof dueVaccines>);

      for (const profileId of Object.keys(vaccinesByUser)) {
        const userVacs = vaccinesByUser[profileId];
        if (!userVacs || userVacs.length === 0) continue;

        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('profile_id', profileId);

        let deliveredCount = 0;

        if (subscriptions && subscriptions.length > 0) {
          const firstVac = userVacs[0];
          const petObj = Array.isArray(firstVac.patients)
            ? firstVac.patients[0]
            : firstVac.patients;
          const petName = petObj?.name || 'Paciente';

          const bodyText =
            userVacs.length === 1
              ? `A vacina ${firstVac.vaccine_name} (${firstVac.next_dose_label || 'Reforço'}) de ${petName} vence em ${firstVac.next_due_date.split('-').reverse().join('/')}.`
              : `Você possui ${userVacs.length} protocolo(s) vacinal(is) próximos do vencimento. Toque para avisar os tutores no WhatsApp.`;

          const payload = JSON.stringify({
            title: '💉 Aviso Programado de Vacina',
            body: bodyText,
            url: firstVac.patient_id ? `/pacientes/${firstVac.patient_id}` : '/',
          });

          for (const sub of subscriptions) {
            const sent = await sendPushAndCleanupExpired(supabase, sub, payload);
            if (sent) {
              deliveredCount++;
              notificationsSent.push(`vaccine:${profileId}`);
            }
          }
        }

        // Só marcar notified_at se ao menos uma notificação foi entregue com sucesso
        if (deliveredCount > 0) {
          const vacIds = userVacs.map((v) => v.id);
          await supabase
            .from('patient_vaccinations')
            .update({ notified_at: new Date().toISOString() })
            .in('id', vacIds);
        }
      }
    }

    return NextResponse.json(
      { success: true, notifiedUsers: notificationsSent },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error in cron job:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
