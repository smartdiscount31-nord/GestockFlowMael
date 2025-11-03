// Netlify Function: agenda-reminder-action
// Gère les actions sur les rappels importants (vu, reporter, fait)

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
    console.log('[agenda-reminder-action] Début de la requête');

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

    console.log('[agenda-reminder-action] Utilisateur:', user.id);

    // Parser le body
    const body = JSON.parse(event.body || '{}');
    console.log('[agenda-reminder-action] Données reçues:', body);

    const { event_id, reminder_id, action, notification_id } = body;

    if (!event_id || !action) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'validation_error', message: 'event_id et action sont obligatoires' })
      };
    }

    // Valider l'action
    if (!['vu', 'reporte', 'fait'].includes(action)) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'validation_error', message: 'action invalide' })
      };
    }

    console.log('[agenda-reminder-action] Action:', action, 'pour événement:', event_id);

    // Vérifier que l'événement appartient à l'utilisateur
    const { data: existingEvent, error: fetchError } = await supabase
      .from('agenda_events')
      .select('*')
      .eq('id', event_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError || !existingEvent) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'not_found', message: 'Événement non trouvé' })
      };
    }

    // Traiter l'action (idempotent)
    let updateData: any = {};
    let shouldCancelRetry = false;

    switch (action) {
      case 'vu':
        // Marquer le rendez-vous comme "vu" (ne stoppe pas les rappels)
        if (existingEvent.source === 'rdv') {
          updateData.status = 'vu';
          shouldCancelRetry = true; // Annuler la relance +15min car action prise
        }
        break;

      case 'reporte':
        // Reporter le rappel d'1h (créer un nouveau rappel +1h)
        console.log('[agenda-reminder-action] Report +1h du rappel');
        const retryAt = new Date(Date.now() + 60 * 60 * 1000); // +1 heure

        await supabaseService
          .from('agenda_reminders_queue')
          .insert({
            event_id: event_id,
            run_at: retryAt.toISOString(),
            type: 'retry_15m',
            delivered: false,
            attempt: 0
          })
          .onConflict()
          .ignore();

        shouldCancelRetry = true;
        console.log('[agenda-reminder-action] Nouveau rappel planifié à:', retryAt.toISOString());
        break;

      case 'fait':
        // Marquer l'événement comme "fait" (stoppe tous les rappels)
        updateData.status = 'fait';
        shouldCancelRetry = true;
        break;
    }

    // Mettre à jour l'événement si nécessaire
    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('agenda_events')
        .update(updateData)
        .eq('id', event_id);

      if (updateError) {
        console.error('[agenda-reminder-action] Erreur mise à jour événement:', updateError);
        return {
          statusCode: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'update_error', message: updateError.message })
        };
      }

      console.log('[agenda-reminder-action] Événement mis à jour avec statut:', updateData.status);
    }

    // Annuler la relance +15min si action prise
    if (shouldCancelRetry) {
      console.log('[agenda-reminder-action] Annulation des rappels retry_15m en attente');

      await supabaseService
        .from('agenda_reminders_queue')
        .delete()
        .eq('event_id', event_id)
        .eq('type', 'retry_15m')
        .eq('delivered', false);
    }

    // Si "fait", supprimer tous les rappels non envoyés
    if (action === 'fait') {
      console.log('[agenda-reminder-action] Suppression de tous les rappels en attente');

      await supabaseService
        .from('agenda_reminders_queue')
        .delete()
        .eq('event_id', event_id)
        .eq('delivered', false);
    }

    // Logger l'action dans l'historique
    if (reminder_id) {
      await supabaseService
        .from('agenda_reminders_log')
        .update({ user_action: action })
        .eq('id', reminder_id);
    }

    // Marquer la notification comme lue
    if (notification_id) {
      console.log('[agenda-reminder-action] Marquage notification comme lue:', notification_id);

      await supabaseService
        .from('notifications')
        .update({ read: true })
        .eq('id', notification_id);
    }

    console.log('[agenda-reminder-action] Action traitée avec succès');

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        action,
        message: `Action "${action}" effectuée avec succès`
      })
    };

  } catch (error: any) {
    console.error('[agenda-reminder-action] Erreur globale:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'internal_error', message: error.message })
    };
  }
};
