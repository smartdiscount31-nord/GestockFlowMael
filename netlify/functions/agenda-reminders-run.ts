// Netlify Function: agenda-reminders-run
// Vérifie et envoie les rappels en attente (cron */5 min)

export const handler = async (event: any) => {
  const { createClient } = await import('@supabase/supabase-js');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[agenda-reminders-run] Variables d\'environnement manquantes');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'missing_env' })
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('[agenda-reminders-run] Début du traitement des rappels');
    const now = new Date();
    console.log('[agenda-reminders-run] Heure UTC actuelle:', now.toISOString());

    // Charger les rappels à envoyer (run_at <= maintenant, delivered = false)
    const { data: pendingReminders, error: fetchError } = await supabase
      .from('agenda_reminders_queue')
      .select(`
        *,
        event:agenda_events!inner(
          id,
          user_id,
          title,
          description,
          event_date,
          event_time,
          source,
          status,
          important,
          project
        )
      `)
      .eq('delivered', false)
      .lte('run_at', now.toISOString())
      .limit(100);

    if (fetchError) {
      console.error('[agenda-reminders-run] Erreur chargement rappels:', fetchError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'fetch_error', message: fetchError.message })
      };
    }

    console.log('[agenda-reminders-run] Rappels en attente:', pendingReminders?.length || 0);

    if (!pendingReminders || pendingReminders.length === 0) {
      console.log('[agenda-reminders-run] Aucun rappel à traiter');
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, processed: 0 })
      };
    }

    let processed = 0;
    let errors = 0;

    // Traiter chaque rappel
    for (const reminder of pendingReminders) {
      try {
        console.log('[agenda-reminders-run] Traitement rappel:', reminder.id, 'pour événement:', reminder.event.id);

        // Vérifier que l'événement n'est pas "fait" (pas de rappel si déjà terminé)
        if (reminder.event.status === 'fait') {
          console.log('[agenda-reminders-run] Événement déjà fait, skip rappel');

          // Marquer comme livré pour ne plus le traiter
          await supabase
            .from('agenda_reminders_queue')
            .update({ delivered: true })
            .eq('id', reminder.id);

          continue;
        }

        // Créer le message de notification
        const eventDateTime = `${reminder.event.event_date}${reminder.event.event_time ? ' à ' + reminder.event.event_time.substring(0, 5) : ''}`;
        let notificationTitle = '';
        let notificationMessage = '';

        if (reminder.type === '24h') {
          notificationTitle = `Rappel 24h : ${reminder.event.title}`;
          notificationMessage = `Votre ${reminder.event.source === 'rdv' ? 'rendez-vous' : 'tâche'} est prévu(e) demain (${eventDateTime})`;
        } else if (reminder.type === '2h') {
          notificationTitle = `Rappel 2h : ${reminder.event.title}`;
          notificationMessage = `Votre ${reminder.event.source === 'rdv' ? 'rendez-vous' : 'tâche'} est dans 2 heures (${eventDateTime})`;
        } else if (reminder.type === 'now') {
          notificationTitle = `C'est maintenant : ${reminder.event.title}`;
          notificationMessage = `Votre ${reminder.event.source === 'rdv' ? 'rendez-vous' : 'tâche'} commence maintenant`;
        } else if (reminder.type === 'retry_15m') {
          notificationTitle = `Rappel relance : ${reminder.event.title}`;
          notificationMessage = `Rappel important non traité pour votre ${reminder.event.source === 'rdv' ? 'rendez-vous' : 'tâche'}`;
        }

        console.log('[agenda-reminders-run] Création notification:', notificationTitle);

        // Créer la notification
        const notificationData: any = {
          type: 'agenda_reminder',
          title: notificationTitle,
          message: notificationMessage,
          severity: reminder.event.important ? 'urgent' : 'info',
          link: '/agenda',
          user_id: reminder.event.user_id,
          read: false
        };

        // Ajouter un flag spécial pour les rappels importants (popup)
        if (reminder.event.important) {
          notificationData.metadata = {
            is_important_reminder: true,
            event_id: reminder.event.id,
            reminder_id: reminder.id,
            event_title: reminder.event.title,
            event_datetime: eventDateTime
          };
        }

        const { data: notification, error: notifError } = await supabase
          .from('notifications')
          .insert(notificationData)
          .select()
          .single();

        if (notifError) {
          console.error('[agenda-reminders-run] Erreur création notification:', notifError);
          errors++;
          continue;
        }

        console.log('[agenda-reminders-run] Notification créée:', notification.id);

        // Marquer le rappel comme livré
        await supabase
          .from('agenda_reminders_queue')
          .update({
            delivered: true,
            attempt: reminder.attempt + 1
          })
          .eq('id', reminder.id);

        // Logger dans l'historique
        await supabase
          .from('agenda_reminders_log')
          .insert({
            event_id: reminder.event.id,
            reminder_type: reminder.type,
            notification_id: notification.id,
            delivered_at: now.toISOString()
          });

        console.log('[agenda-reminders-run] Rappel traité avec succès');

        // Si rappel important, planifier une relance +15 min
        if (reminder.event.important && reminder.type !== 'retry_15m') {
          const retryAt = new Date(now.getTime() + 15 * 60 * 1000); // +15 minutes
          console.log('[agenda-reminders-run] Planification relance +15min à:', retryAt.toISOString());

          await supabase
            .from('agenda_reminders_queue')
            .insert({
              event_id: reminder.event.id,
              run_at: retryAt.toISOString(),
              type: 'retry_15m',
              delivered: false,
              attempt: 0
            })
            .onConflict()
            .ignore();

          console.log('[agenda-reminders-run] Relance planifiée');
        }

        processed++;

      } catch (err: any) {
        console.error('[agenda-reminders-run] Erreur traitement rappel individuel:', err);
        errors++;
      }
    }

    console.log('[agenda-reminders-run] Traitement terminé. Processed:', processed, 'Errors:', errors);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        processed,
        errors,
        total: pendingReminders.length
      })
    };

  } catch (error: any) {
    console.error('[agenda-reminders-run] Erreur globale:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'internal_error', message: error.message })
    };
  }
};
