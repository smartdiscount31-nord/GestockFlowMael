// Netlify Function: repairs-archive
// Archive un ticket de réparation terminé et libère les réservations de stock

import { createClient } from '@supabase/supabase-js';

interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string>;
  body: string | null;
}

interface NetlifyResponse {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function resp(statusCode: number, body: any): NetlifyResponse {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

function getAuthToken(event: NetlifyEvent): string | null {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  console.log('[repairs-archive] Début de la requête');

  if (event.httpMethod !== 'POST') {
    console.log('[repairs-archive] Méthode non autorisée:', event.httpMethod);
    return resp(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Seule la méthode POST est autorisée' } });
  }

  try {
    const token = getAuthToken(event);
    if (!token) {
      console.log('[repairs-archive] Token manquant');
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Token d\'authentification manquant' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Vérifier l'utilisateur
    const { data: userWrap, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userWrap?.user) {
      console.log('[repairs-archive] Erreur authentification:', userErr);
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Utilisateur non authentifié' } });
    }
    const userId = userWrap.user.id;
    console.log('[repairs-archive] Utilisateur authentifié:', userId);

    // Vérifier le rôle (ADMIN et ADMIN_FULL uniquement)
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      console.log('[repairs-archive] Erreur récupération profil:', profileErr);
      return resp(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Profil utilisateur introuvable' } });
    }

    console.log('[repairs-archive] Rôle utilisateur:', profile.role);

    // Vérifier les permissions (ADMIN et ADMIN_FULL uniquement)
    const allowedRoles = ['ADMIN', 'ADMIN_FULL'];
    if (!allowedRoles.includes(profile.role)) {
      console.log('[repairs-archive] Rôle non autorisé:', profile.role);
      return resp(403, {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Seuls les administrateurs peuvent archiver des tickets'
        }
      });
    }

    // Parser le body
    let parsed: any = {};
    try {
      parsed = JSON.parse(event.body || '{}');
    } catch {
      console.log('[repairs-archive] Erreur parsing JSON');
      return resp(400, { ok: false, error: { code: 'BAD_REQUEST', message: 'Corps de requête JSON invalide' } });
    }

    console.log('[repairs-archive] Données reçues:', JSON.stringify(parsed, null, 2));

    const { repair_id } = parsed;

    // Valider les champs obligatoires
    if (!repair_id) {
      console.log('[repairs-archive] repair_id manquant');
      return resp(400, {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Champ obligatoire manquant: repair_id'
        }
      });
    }

    // Récupérer le ticket
    const { data: ticket, error: ticketErr } = await supabase
      .from('repair_tickets')
      .select('*')
      .eq('id', repair_id)
      .single();

    if (ticketErr || !ticket) {
      console.log('[repairs-archive] Ticket introuvable:', repair_id);
      return resp(404, {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Ticket de réparation ${repair_id} introuvable`
        }
      });
    }

    console.log('[repairs-archive] Ticket trouvé, statut:', ticket.status);

    // Vérifier si déjà archivé
    if (ticket.status === 'archived') {
      console.log('[repairs-archive] Ticket déjà archivé');
      return resp(200, {
        ok: true,
        data: {
          ticket,
          message: 'Le ticket est déjà archivé'
        }
      });
    }

    // Vérifier les conditions d'archivage (invoice_id défini OU statut delivered)
    if (!ticket.invoice_id && ticket.status !== 'delivered') {
      console.log('[repairs-archive] Conditions d\'archivage non remplies');
      return resp(409, {
        ok: false,
        error: {
          code: 'CANNOT_ARCHIVE',
          message: 'Impossible d\'archiver: le ticket doit avoir une facture associée ou être en statut "delivered"'
        }
      });
    }

    console.log('[repairs-archive] Conditions d\'archivage remplies');

    // Appeler la RPC fn_repair_release_reservations
    console.log('[repairs-archive] Appel RPC fn_repair_release_reservations');
    const { error: releaseErr } = await supabase.rpc('fn_repair_release_reservations', {
      p_repair_id: repair_id
    });

    if (releaseErr) {
      console.log('[repairs-archive] Erreur libération réservations:', releaseErr);
      return resp(500, {
        ok: false,
        error: {
          code: 'INTERNAL',
          message: `Erreur lors de la libération des réservations: ${releaseErr.message}`
        }
      });
    }

    console.log('[repairs-archive] Réservations libérées avec succès');

    // Compter les réservations libérées
    const { data: reservations, error: countErr } = await supabase
      .from('stock_reservations')
      .select('id')
      .eq('repair_id', repair_id)
      .eq('released', true);

    const reservationsCount = reservations?.length || 0;
    console.log('[repairs-archive] Nombre de réservations libérées:', reservationsCount);

    // Changer le statut en archived
    const { data: updatedTicket, error: updateErr } = await supabase
      .from('repair_tickets')
      .update({ status: 'archived' })
      .eq('id', repair_id)
      .select()
      .single();

    if (updateErr || !updatedTicket) {
      console.log('[repairs-archive] Erreur mise à jour statut:', updateErr);
      return resp(500, {
        ok: false,
        error: {
          code: 'INTERNAL',
          message: `Erreur lors de l'archivage du ticket: ${updateErr?.message || 'Erreur inconnue'}`
        }
      });
    }

    console.log('[repairs-archive] Ticket archivé avec succès');

    // Récupérer l'historique complet
    const { data: history, error: historyErr } = await supabase
      .from('repair_status_history')
      .select('*')
      .eq('repair_id', repair_id)
      .order('changed_at', { ascending: false });

    if (historyErr) {
      console.log('[repairs-archive] Erreur récupération historique:', historyErr);
    }

    return resp(200, {
      ok: true,
      data: {
        ticket: updatedTicket,
        reservations_released: reservationsCount,
        history: history || [],
        message: `Ticket #${ticket.id.substring(0, 8)} archivé avec succès. ${reservationsCount} réservation(s) libérée(s).`
      }
    });

  } catch (e: any) {
    console.log('[repairs-archive] Exception globale:', e);
    return resp(500, {
      ok: false,
      error: {
        code: 'INTERNAL',
        message: `Erreur interne: ${String(e?.message || e)}`
      }
    });
  }
};
