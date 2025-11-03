// Netlify Function: agenda-events-create
// Crée un nouvel événement agenda

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

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'missing_env' })
    };
  }

  try {
    console.log('[agenda-events-create] Début de la requête');

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'unauthorized' })
      };
    }

    console.log('[agenda-events-create] Utilisateur:', user.id);

    // Parser le body
    const body = JSON.parse(event.body || '{}');
    console.log('[agenda-events-create] Données reçues:', body);

    // Validation des champs obligatoires
    if (!body.title || !body.event_date || !body.source) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'validation_error',
          message: 'title, event_date et source sont obligatoires'
        })
      };
    }

    // Validation du source
    if (!['roadmap', 'rdv'].includes(body.source)) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'validation_error',
          message: 'source doit être roadmap ou rdv'
        })
      };
    }

    // Préparer les données
    const eventData: any = {
      user_id: user.id,
      title: body.title.trim(),
      description: body.description?.trim() || '',
      event_date: body.event_date,
      event_time: body.event_time || null,
      source: body.source,
      status: body.status || 'a_faire',
      important: body.important === true,
      project: body.project?.trim() || null,
      custom_reminders: body.custom_reminders || ['24h', '2h', 'now']
    };

    console.log('[agenda-events-create] Données à insérer:', eventData);

    // Insérer l'événement
    const { data: newEvent, error: insertError } = await supabase
      .from('agenda_events')
      .insert(eventData)
      .select()
      .single();

    if (insertError) {
      console.error('[agenda-events-create] Erreur insertion:', insertError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'insert_error', message: insertError.message })
      };
    }

    console.log('[agenda-events-create] Événement créé:', newEvent.id);

    return {
      statusCode: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        event: newEvent
      })
    };

  } catch (error: any) {
    console.error('[agenda-events-create] Erreur globale:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'internal_error', message: error.message })
    };
  }
};
