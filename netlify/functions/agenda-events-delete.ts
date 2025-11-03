// Netlify Function: agenda-events-delete
// Supprime (archive) un événement agenda

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
        'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
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
    console.log('[agenda-events-delete] Début de la requête');

    if (event.httpMethod !== 'DELETE') {
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

    console.log('[agenda-events-delete] Utilisateur:', user.id);

    // Récupérer l'ID depuis query params ou body
    const qs = event.queryStringParameters || {};
    const eventId = qs.id || (event.body ? JSON.parse(event.body).id : null);

    if (!eventId) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'validation_error', message: 'id est obligatoire' })
      };
    }

    console.log('[agenda-events-delete] ID événement:', eventId);

    // Vérifier que l'événement appartient à l'utilisateur
    const { data: existingEvent, error: fetchError } = await supabase
      .from('agenda_events')
      .select('*')
      .eq('id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError) {
      console.error('[agenda-events-delete] Erreur fetch:', fetchError);
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

    console.log('[agenda-events-delete] Événement trouvé, archivage...');

    // Utiliser la fonction PostgreSQL pour soft delete
    const { error: archiveError } = await supabaseService.rpc('archive_agenda_event', {
      p_event_id: eventId
    });

    if (archiveError) {
      console.error('[agenda-events-delete] Erreur archivage:', archiveError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'archive_error', message: archiveError.message })
      };
    }

    console.log('[agenda-events-delete] Événement archivé avec succès');

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        message: 'Événement archivé avec succès'
      })
    };

  } catch (error: any) {
    console.error('[agenda-events-delete] Erreur globale:', error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'internal_error', message: error.message })
    };
  }
};
