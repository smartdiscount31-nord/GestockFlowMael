// Netlify Function: agenda-daily-summary-action
// Gère les actions groupées sur le digest quotidien (reporter, marquer fait)

export const handler = async (event: any) => {
  const ALLOW_ORIGIN = 'https://dev-gestockflow.netlify.app';
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOW_ORIGIN,
    'Access-Control-Allow-Credentials': 'true'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, authorization'
      },
      body: ''
    };
  }

  const { createClient } = await import('@supabase/supabase-js');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'missing_env' })
    };
  }

  try {
    console.log('[agenda-daily-summary-action] Début de la requête');

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'method_not_allowed' })
      };
    }

    // Authentification
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'unauthorized' })
      };
    }

    const token = authHeader.substring(7);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'unauthorized' })
      };
    }

    console.log('[agenda-daily-summary-action] Utilisateur:', user.id);

    // Parser le body
    const body = JSON.parse(event.body || '{}');
    console.log('[agenda-daily-summary-action] Données reçues:', body);

    const { event_ids, action, notification_id } = body;

    if (!event_ids || !Array.isArray(event_ids) || event_ids.length === 0 || !action) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'validation_error', message: 'event_ids (array) et action sont obligatoires' })
      };
    }

    // Valider l'action
    if (!['reporter', 'fait'].includes(action)) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'validation_error', message: 'action invalide (reporter ou fait)' })
      };
    }

    console.log('[agenda-daily-summary-action] Action:', action, 'pour', event_ids.length, 'événements');

    // Vérifier que tous les événements appartiennent à l'utilisateur
    const { data: userEvents, error: fetchError } = await supabase
      .from('agenda_events')
      .select('id, event_date, source')
      .in('id', event_ids)
      .eq('user_id', user.id);

    if (fetchError) {
      console.error('[agenda-daily-summary-action] Erreur fetch événements:', fetchError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'fetch_error', message: fetchError.message })
      };
    }

    if (!userEvents || userEvents.length === 0) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'not_found', message: 'Aucun événement trouvé' })
      };
    }

    console.log('[agenda-daily-summary-action] Événements trouvés:', userEvents.length);

    let updated = 0;
    let errors = 0;

    // Traiter l'action (idempotent)
    for (const evt of userEvents) {
      try {
        if (action === 'reporter') {
          // Reporter à demain
          const currentDate = new Date(evt.event_date);
          const tomorrowDate = new Date(currentDate);
          tomorrowDate.setDate(tomorrowDate.getDate() + 1);
          const tomorrowDateStr = tomorrowDate.toISOString().split('T')[0];

          console.log('[agenda-daily-summary-action] Report événement', evt.id, 'de', evt.event_date, 'à', tomorrowDateStr);

          const { error: updateError } = await supabase
            .from('agenda_events')
            .update({ event_date: tomorrowDateStr })
            .eq('id', evt.id);

          if (updateError) {
            console.error('[agenda-daily-summary-action] Erreur mise à jour:', updateError);
            errors++;
            continue;
          }

          // Supprimer les rappels non envoyés de l'ancienne date
          await supabaseService
            .from('agenda_reminders_queue')
            .delete()
            .eq('event_id', evt.id)
            .eq('delivered', false);

          // Recréer les rappels pour la nouvelle date
          await supabaseService.rpc('create_agenda_reminders', { p_event_id: evt.id });

          updated++;

        } else if (action === 'fait') {
          // Marquer comme fait
          console.log('[agenda-daily-summary-action] Marquage événement', evt.id, 'comme fait');

          const { error: updateError } = await supabase
            .from('agenda_events')
            .update({ status: 'fait' })
            .eq('id', evt.id);

          if (updateError) {
            console.error('[agenda-daily-summary-action] Erreur mise à jour:', updateError);
            errors++;
            continue;
          }

          // Supprimer tous les rappels non envoyés
          await supabaseService
            .from('agenda_reminders_queue')
            .delete()
            .eq('event_id', evt.id)
            .eq('delivered', false);

          updated++;
        }

      } catch (err: any) {
        console.error('[agenda-daily-summary-action] Erreur traitement événement individuel:', err);
        errors++;
      }
    }

    // Marquer la notification digest comme lue
    if (notification_id) {
      console.log('[agenda-daily-summary-action] Marquage notification comme lue:', notification_id);

      await supabaseService
        .from('notifications')
        .update({ read: true })
        .eq('id', notification_id);
    }

    console.log('[agenda-daily-summary-action] Action groupée terminée. Updated:', updated, 'Errors:', errors);

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        action,
        updated,
        errors,
        total: event_ids.length,
        message: `${updated} événement(s) traité(s) avec succès`
      })
    };

  } catch (error: any) {
    console.error('[agenda-daily-summary-action] Erreur globale:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'internal_error', message: error.message })
    };
  }
};
