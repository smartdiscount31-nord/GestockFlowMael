// Netlify Function: repairs-status-update
// Change le statut d'un ticket de réparation avec validations métier

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

const VALID_STATUSES = [
  'quote_todo',
  'parts_to_order',
  'waiting_parts',
  'to_repair',
  'in_repair',
  'drying',
  'ready_to_return',
  'awaiting_customer',
  'delivered',
  'archived'
];

function resp(statusCode: number, body: any): NetlifyResponse {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

function getAuthToken(event: NetlifyEvent): string | null {
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  console.log('[repairs-status-update] Début de la requête');

  if (event.httpMethod !== 'POST') {
    console.log('[repairs-status-update] Méthode non autorisée:', event.httpMethod);
    return resp(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Seule la méthode POST est autorisée' } });
  }

  try {
    const token = getAuthToken(event);
    if (!token) {
      console.log('[repairs-status-update] Token manquant');
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Token d\'authentification manquant' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Vérifier l'utilisateur
    const { data: userWrap, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userWrap?.user) {
      console.log('[repairs-status-update] Erreur authentification:', userErr);
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Utilisateur non authentifié' } });
    }
    const userId = userWrap.user.id;
    console.log('[repairs-status-update] Utilisateur authentifié:', userId);

    // Vérifier le rôle
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      console.log('[repairs-status-update] Erreur récupération profil:', profileErr);
      return resp(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Profil utilisateur introuvable' } });
    }

    console.log('[repairs-status-update] Rôle utilisateur:', profile.role);

    // Vérifier les permissions
    const allowedRoles = ['MAGASIN', 'ADMIN', 'ADMIN_FULL'];
    if (!allowedRoles.includes(profile.role)) {
      console.log('[repairs-status-update] Rôle non autorisé:', profile.role);
      return resp(403, {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Permissions insuffisantes pour modifier le statut'
        }
      });
    }

    // Parser le body
    let parsed: any = {};
    try {
      parsed = JSON.parse(event.body || '{}');
    } catch {
      console.log('[repairs-status-update] Erreur parsing JSON');
      return resp(400, { ok: false, error: { code: 'BAD_REQUEST', message: 'Corps de requête JSON invalide' } });
    }

    console.log('[repairs-status-update] Données reçues:', JSON.stringify(parsed, null, 2));

    const {
      repair_id,
      new_status,
      note
    } = parsed;

    // Valider les champs obligatoires
    if (!repair_id || !new_status) {
      console.log('[repairs-status-update] Champs obligatoires manquants');
      return resp(400, {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Champs obligatoires manquants: repair_id, new_status'
        }
      });
    }

    // Valider le nouveau statut
    if (!VALID_STATUSES.includes(new_status)) {
      console.log('[repairs-status-update] Statut invalide:', new_status);
      return resp(400, {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: `Statut invalide. Valeurs acceptées: ${VALID_STATUSES.join(', ')}`
        }
      });
    }

    // Récupérer le ticket actuel
    const { data: ticket, error: ticketErr } = await supabase
      .from('repair_tickets')
      .select('*')
      .eq('id', repair_id)
      .single();

    if (ticketErr || !ticket) {
      console.log('[repairs-status-update] Ticket introuvable:', repair_id);
      return resp(404, {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Ticket de réparation ${repair_id} introuvable`
        }
      });
    }

    console.log('[repairs-status-update] Ticket trouvé, statut actuel:', ticket.status);

    // Vérifier si le statut est déjà le bon
    if (ticket.status === new_status) {
      console.log('[repairs-status-update] Statut déjà défini');
      return resp(200, {
        ok: true,
        data: {
          ticket,
          message: 'Le statut est déjà défini sur cette valeur'
        }
      });
    }

    // Validations métier selon le statut cible
    if (new_status === 'ready_to_return' || new_status === 'to_repair') {
      // Vérifier que toutes les pièces sont réservées
      const { data: items, error: itemsErr } = await supabase
        .from('repair_items')
        .select('id, reserved')
        .eq('repair_id', repair_id);

      if (itemsErr) {
        console.log('[repairs-status-update] Erreur récupération items:', itemsErr);
        return resp(500, {
          ok: false,
          error: {
            code: 'INTERNAL',
            message: 'Erreur lors de la vérification des pièces'
          }
        });
      }

      if (!items || items.length === 0) {
        console.log('[repairs-status-update] Aucune pièce attachée');
        return resp(409, {
          ok: false,
          error: {
            code: 'NO_PARTS',
            message: `Impossible de passer en statut "${new_status}": aucune pièce n'est attachée à ce ticket`
          }
        });
      }

      const unreservedItems = items.filter(i => !i.reserved);
      if (unreservedItems.length > 0) {
        console.log('[repairs-status-update] Pièces non réservées:', unreservedItems.length);
        return resp(409, {
          ok: false,
          error: {
            code: 'PARTS_NOT_RESERVED',
            message: `Impossible de passer en statut "${new_status}": ${unreservedItems.length} pièce(s) ne sont pas encore réservées`
          }
        });
      }

      console.log('[repairs-status-update] Toutes les pièces sont réservées, validation OK');
    }

    // Si passage en archived, vérifier qu'il y a une facture ou qu'on est en delivered
    if (new_status === 'archived') {
      if (!ticket.invoice_id && ticket.status !== 'delivered') {
        console.log('[repairs-status-update] Conditions d\'archivage non remplies');
        return resp(409, {
          ok: false,
          error: {
            code: 'CANNOT_ARCHIVE',
            message: 'Impossible d\'archiver: le ticket doit avoir une facture associée ou être en statut "delivered"'
          }
        });
      }
    }

    // Mettre à jour le statut
    const { data: updatedTicket, error: updateErr } = await supabase
      .from('repair_tickets')
      .update({ status: new_status })
      .eq('id', repair_id)
      .select()
      .single();

    if (updateErr || !updatedTicket) {
      console.log('[repairs-status-update] Erreur mise à jour statut:', updateErr);
      return resp(500, {
        ok: false,
        error: {
          code: 'INTERNAL',
          message: `Erreur lors de la mise à jour du statut: ${updateErr?.message || 'Erreur inconnue'}`
        }
      });
    }

    console.log('[repairs-status-update] Statut mis à jour avec succès');

    // Le trigger fn_repair_log_status va automatiquement créer l'entrée dans repair_status_history
    // Mais on peut ajouter une note si fournie
    if (note) {
      const { error: historyErr } = await supabase
        .from('repair_status_history')
        .update({ note })
        .eq('repair_id', repair_id)
        .eq('new_status', new_status)
        .order('changed_at', { ascending: false })
        .limit(1);

      if (historyErr) {
        console.log('[repairs-status-update] Erreur ajout note à l\'historique:', historyErr);
        // Non bloquant
      } else {
        console.log('[repairs-status-update] Note ajoutée à l\'historique');
      }
    }

    // Récupérer l'historique complet
    const { data: history, error: historyFetchErr } = await supabase
      .from('repair_status_history')
      .select('*')
      .eq('repair_id', repair_id)
      .order('changed_at', { ascending: false });

    if (historyFetchErr) {
      console.log('[repairs-status-update] Erreur récupération historique:', historyFetchErr);
    }

    console.log('[repairs-status-update] Changement de statut terminé avec succès');

    return resp(200, {
      ok: true,
      data: {
        ticket: updatedTicket,
        history: history || [],
        message: `Statut changé de "${ticket.status}" à "${new_status}"`
      }
    });

  } catch (e: any) {
    console.log('[repairs-status-update] Exception globale:', e);
    return resp(500, {
      ok: false,
      error: {
        code: 'INTERNAL',
        message: `Erreur interne: ${String(e?.message || e)}`
      }
    });
  }
};
