// Netlify Function: agenda-daily-summary
// Génère le récapitulatif quotidien à 19h (Europe/Paris) des tâches non terminées

export const handler = async (event: any) => {
  const { createClient } = await import('@supabase/supabase-js');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[agenda-daily-summary] Variables d\'environnement manquantes');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'missing_env' })
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('[agenda-daily-summary] Début génération digest quotidien');

    // Calculer la date du jour en Europe/Paris
    const nowParis = new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' });
    const todayParis = new Date(nowParis);
    const todayDateStr = todayParis.toISOString().split('T')[0]; // Format YYYY-MM-DD

    console.log('[agenda-daily-summary] Date du jour (Europe/Paris):', todayDateStr);

    // Charger tous les utilisateurs ayant des événements aujourd'hui non terminés
    const { data: unfinishedEvents, error: fetchError } = await supabase
      .from('agenda_events')
      .select('*')
      .eq('event_date', todayDateStr)
      .neq('status', 'fait')
      .eq('archived', false)
      .order('event_time', { ascending: true });

    if (fetchError) {
      console.error('[agenda-daily-summary] Erreur chargement événements:', fetchError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'fetch_error', message: fetchError.message })
      };
    }

    console.log('[agenda-daily-summary] Événements non terminés aujourd\'hui:', unfinishedEvents?.length || 0);

    if (!unfinishedEvents || unfinishedEvents.length === 0) {
      console.log('[agenda-daily-summary] Aucun événement à résumer');
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, summaries_sent: 0 })
      };
    }

    // Grouper les événements par utilisateur
    const eventsByUser = new Map<string, any[]>();
    for (const event of unfinishedEvents) {
      if (!eventsByUser.has(event.user_id)) {
        eventsByUser.set(event.user_id, []);
      }
      eventsByUser.get(event.user_id)!.push(event);
    }

    console.log('[agenda-daily-summary] Utilisateurs concernés:', eventsByUser.size);

    let summariesSent = 0;
    let errors = 0;

    // Pour chaque utilisateur, créer une notification de récapitulatif
    for (const [userId, userEvents] of eventsByUser) {
      try {
        console.log('[agenda-daily-summary] Génération digest pour utilisateur:', userId, 'avec', userEvents.length, 'événements');

        // Vérifier s'il existe déjà un digest non lu pour aujourd'hui (idempotence)
        const { data: existingDigest } = await supabase
          .from('notifications')
          .select('id')
          .eq('type', 'agenda_daily_summary')
          .eq('user_id', userId)
          .eq('read', false)
          .gte('created_at', todayDateStr + ' 00:00:00')
          .lte('created_at', todayDateStr + ' 23:59:59')
          .maybeSingle();

        if (existingDigest) {
          console.log('[agenda-daily-summary] Digest déjà existant pour cet utilisateur aujourd\'hui, skip');
          continue;
        }

        // Construire le message
        const eventsList = userEvents
          .map(e => `• ${e.title}${e.event_time ? ' à ' + e.event_time.substring(0, 5) : ''}`)
          .join('\n');

        const notificationTitle = `Feuille de route — Tâches non terminées (${userEvents.length})`;
        const notificationMessage = `Vous avez ${userEvents.length} tâche${userEvents.length > 1 ? 's' : ''} non terminée${userEvents.length > 1 ? 's' : ''} aujourd'hui :\n\n${eventsList}`;

        console.log('[agenda-daily-summary] Création notification digest');

        // Créer la notification
        const { data: notification, error: notifError } = await supabase
          .from('notifications')
          .insert({
            type: 'agenda_daily_summary',
            title: notificationTitle,
            message: notificationMessage,
            severity: 'warning',
            link: `/agenda?date=${todayDateStr}`,
            user_id: userId,
            read: false,
            metadata: {
              is_daily_summary: true,
              date: todayDateStr,
              event_ids: userEvents.map(e => e.id),
              event_count: userEvents.length
            }
          })
          .select()
          .single();

        if (notifError) {
          console.error('[agenda-daily-summary] Erreur création notification:', notifError);
          errors++;
          continue;
        }

        console.log('[agenda-daily-summary] Notification digest créée:', notification.id);
        summariesSent++;

      } catch (err: any) {
        console.error('[agenda-daily-summary] Erreur génération digest individuel:', err);
        errors++;
      }
    }

    console.log('[agenda-daily-summary] Traitement terminé. Summaries sent:', summariesSent, 'Errors:', errors);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        summaries_sent: summariesSent,
        errors,
        users_processed: eventsByUser.size
      })
    };

  } catch (error: any) {
    console.error('[agenda-daily-summary] Erreur globale:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'internal_error', message: error.message })
    };
  }
};
