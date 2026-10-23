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
        const userName = firstConsultation.profiles?.full_name?.split(' ')[0] || 'Veterinário';

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
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                payload
              );
              notificationsSent.push(profileId);
            } catch (err) {
              console.error('Failed to send push to subscription:', sub.id, err);
            }
          }
        }
      }
    }

    // 5. Avisos Programados de Vacinas (próximos 7 dias ou vencidas)
    const inSevenDays = new Date(now);
    inSevenDays.setDate(inSevenDays.getDate() + 7);
    const inSevenDaysStr = inSevenDays.toISOString().split('T')[0];

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
            try {
              await webpush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: { p256dh: sub.p256dh, auth: sub.auth },
                },
                payload
              );
              notificationsSent.push(`vaccine:${profileId}`);
            } catch (err) {
              console.error('Failed to send vaccine push:', sub.id, err);
            }
          }
        }

        // Atualizar flag notified_at
        const vacIds = userVacs.map((v) => v.id);
        await supabase
          .from('patient_vaccinations')
          .update({ notified_at: new Date().toISOString() })
          .in('id', vacIds);
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
