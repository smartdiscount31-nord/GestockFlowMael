// Netlify Function: agenda-events-list
// Liste les événements agenda avec filtres

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
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type, authorization'
      },
      body: ''
    };
  }

  const { createClient } = await import('@supabase/supabase-js');

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[agenda-events-list] Variables d\'environnement manquantes');
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: 'missing_env',
        message: 'Configuration serveur manquante'
      })
    };
  }

  try {
    console.log('[agenda-events-list] Début de la requête');

    if (event.httpMethod !== 'GET') {
      console.error('[agenda-events-list] Méthode non autorisée:', event.httpMethod);
      return {
        statusCode: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          error: 'method_not_allowed',
          message: 'Seul GET est autorisé'
        })
      };
    }

    // Authentification
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    console.log('[agenda-events-list] Auth header présent:', !!authHeader);

    if (!authHeader.startsWith('Bearer ')) {
      console.error('[agenda-events-list] Token manquant ou invalide');
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          error: 'unauthorized',
          message: 'Token d\'authentification manquant'
        })
      };
    }

    const token = authHeader.substring(7);
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('[agenda-events-list] Erreur authentification:', userError?.message);
      return {
        statusCode: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          error: 'unauthorized',
          message: 'Utilisateur non authentifié'
        })
      };
    }

    console.log('[agenda-events-list] Utilisateur:', user.id);

    // Paramètres de filtrage
    const qs = event.queryStringParameters || {};
    const startDate = qs.start_date; // Format YYYY-MM-DD
    const endDate = qs.end_date;
    const source = qs.source; // 'roadmap' ou 'rdv'
    const status = qs.status; // 'a_faire', 'en_cours', 'fait', 'vu'
    const project = qs.project;
    const search = qs.search;

    console.log('[agenda-events-list] Filtres:', { startDate, endDate, source, status, project, search });

    // Construire la requête
    let query = supabase
      .from('agenda_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true });

    // Filtrer par plage de dates (fenêtre ±30 jours par défaut)
    if (startDate) {
      query = query.gte('event_date', startDate);
    }
    if (endDate) {
      query = query.lte('event_date', endDate);
    }

    // Filtres optionnels
    if (source && (source === 'roadmap' || source === 'rdv')) {
      query = query.eq('source', source);
    }
    if (status && ['a_faire', 'en_cours', 'fait', 'vu'].includes(status)) {
      query = query.eq('status', status);
    }
    if (project) {
      query = query.eq('project', project);
    }

    const { data: events, error: eventsError } = await query;

    if (eventsError) {
      console.error('[agenda-events-list] Erreur chargement événements:', eventsError);
      return {
        statusCode: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          error: 'events_error',
          message: eventsError.message || 'Erreur lors du chargement des événements'
        })
      };
    }

    console.log('[agenda-events-list] Événements chargés:', events?.length || 0);

    // Filtrer par recherche textuelle côté serveur
    let filteredEvents = events || [];
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredEvents = filteredEvents.filter((e: any) =>
        e.title?.toLowerCase().includes(searchLower) ||
        e.description?.toLowerCase().includes(searchLower)
      );
      console.log('[agenda-events-list] Après recherche textuelle:', filteredEvents.length);
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: true,
        events: filteredEvents
      })
    };

  } catch (error: any) {
    console.error('[agenda-events-list] Erreur globale:', error);
    console.error('[agenda-events-list] Stack trace:', error.stack);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: 'internal_error',
        message: error.message || 'Erreur serveur interne',
        details: error.stack ? error.stack.substring(0, 200) : ''
      })
    };
  }
};
