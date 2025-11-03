// Netlify Function: agenda-events-update
// Met à jour un événement agenda existant

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
        'Access-Control-Allow-Methods': 'PUT, PATCH, OPTIONS',
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
    console.log('[agenda-events-update] Début de la requête');

    if (!['PUT', 'PATCH'].includes(event.httpMethod)) {
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

    console.log('[agenda-events-update] Utilisateur:', user.id);

    // Parser le body
    const body = JSON.parse(event.body || '{}');
    console.log('[agenda-events-update] Données reçues:', body);

    const eventId = body.id;
    if (!eventId) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'validation_error', message: 'id est obligatoire' })
      };
    }

    // Vérifier que l'événement appartient à l'utilisateur
    const { data: existingEvent, error: fetchError } = await supabase
      .from('agenda_events')
      .select('*')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[agenda-events-update] Erreur fetch:', fetchError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'fetch_error', message: fetchError.message })
      };
    }

    if (!existingEvent) {
      return {
        statusCode: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'not_found', message: 'Événement non trouvé' })
      };
    }

    console.log('[agenda-events-update] Événement existant trouvé:', existingEvent.id);

    // Préparer les données de mise à jour
    const updateData: any = {};
    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.description !== undefined) updateData.description = body.description.trim();
    if (body.event_date !== undefined) updateData.event_date = body.event_date;
    if (body.event_time !== undefined) updateData.event_time = body.event_time;
    if (body.source !== undefined && ['roadmap', 'rdv'].includes(body.source)) {
      updateData.source = body.source;
    }
    if (body.status !== undefined && ['a_faire', 'en_cours', 'fait', 'vu'].includes(body.status)) {
      updateData.status = body.status;
    }
    if (body.important !== undefined) updateData.important = body.important === true;
    if (body.project !== undefined) updateData.project = body.project?.trim() || null;
    if (body.custom_reminders !== undefined) updateData.custom_reminders = body.custom_reminders;

    console.log('[agenda-events-update] Données de mise à jour:', updateData);

    // Mettre à jour l'événement
    const { data: updatedEvent, error: updateError } = await supabase
      .from('agenda_events')
      .update(updateData)
      .eq('id', eventId)
      .select()
      .single();

    if (updateError) {
      console.error('[agenda-events-update] Erreur mise à jour:', updateError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'update_error', message: updateError.message })
      };
    }

    console.log('[agenda-events-update] Événement mis à jour:', updatedEvent.id);

    // Si le statut passe à "fait", supprimer les rappels non envoyés
    if (updateData.status === 'fait') {
      console.log('[agenda-events-update] Statut = fait, suppression des rappels en attente');
      const { error: deleteRemindersError } = await supabaseService
        .from('agenda_reminders_queue')
        .delete()
        .eq('event_id', eventId)
        .eq('delivered', false);

      if (deleteRemindersError) {
        console.error('[agenda-events-update] Erreur suppression rappels:', deleteRemindersError);
      } else {
        console.log('[agenda-events-update] Rappels en attente supprimés');
      }
    }

    // Si date/heure changée, recréer les rappels
    if (updateData.event_date !== undefined || updateData.event_time !== undefined || updateData.custom_reminders !== undefined) {
      console.log('[agenda-events-update] Date/heure/rappels modifiés, recréation des rappels');

      // Supprimer les anciens rappels non livrés
      await supabaseService
        .from('agenda_reminders_queue')
        .delete()
        .eq('event_id', eventId)
        .eq('delivered', false);

      // Recréer les rappels via la fonction PostgreSQL
      const { error: createRemindersError } = await supabaseService.rpc('create_agenda_reminders', {
        p_event_id: eventId
      });

      if (createRemindersError) {
        console.error('[agenda-events-update] Erreur recréation rappels:', createRemindersError);
      } else {
        console.log('[agenda-events-update] Rappels recréés');
      }
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        event: updatedEvent
      })
    };

  } catch (error: any) {
    console.error('[agenda-events-update] Erreur globale:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'internal_error', message: error.message })
    };
  }
};
