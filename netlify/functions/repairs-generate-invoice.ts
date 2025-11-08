// Netlify Function: repairs-generate-invoice
// Génère un draft de facture à partir d'un ticket de réparation

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
  console.log('[repairs-generate-invoice] Début de la requête');

  if (event.httpMethod !== 'POST') {
    console.log('[repairs-generate-invoice] Méthode non autorisée:', event.httpMethod);
    return resp(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Seule la méthode POST est autorisée' } });
  }

  try {
    const token = getAuthToken(event);
    if (!token) {
      console.log('[repairs-generate-invoice] Token manquant');
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Token d\'authentification manquant' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Vérifier l'utilisateur
    const { data: userWrap, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userWrap?.user) {
      console.log('[repairs-generate-invoice] Erreur authentification:', userErr);
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Utilisateur non authentifié' } });
    }
    const userId = userWrap.user.id;
    console.log('[repairs-generate-invoice] Utilisateur authentifié:', userId);

    // Vérifier le rôle
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      console.log('[repairs-generate-invoice] Erreur récupération profil:', profileErr);
      return resp(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Profil utilisateur introuvable' } });
    }

    console.log('[repairs-generate-invoice] Rôle utilisateur:', profile.role);

    // Vérifier les permissions
    const allowedRoles = ['MAGASIN', 'ADMIN', 'ADMIN_FULL'];
    if (!allowedRoles.includes(profile.role)) {
      console.log('[repairs-generate-invoice] Rôle non autorisé:', profile.role);
      return resp(403, {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Permissions insuffisantes pour générer une facture'
        }
      });
    }

    // Parser le body
    let parsed: any = {};
    try {
      parsed = JSON.parse(event.body || '{}');
    } catch {
      console.log('[repairs-generate-invoice] Erreur parsing JSON');
      return resp(400, { ok: false, error: { code: 'BAD_REQUEST', message: 'Corps de requête JSON invalide' } });
    }

    console.log('[repairs-generate-invoice] Données reçues:', JSON.stringify(parsed, null, 2));

    const { repair_id } = parsed;

    // Valider les champs obligatoires
    if (!repair_id) {
      console.log('[repairs-generate-invoice] repair_id manquant');
      return resp(400, {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Champ obligatoire manquant: repair_id'
        }
      });
    }

    // Récupérer le ticket avec toutes les infos
    const { data: ticket, error: ticketErr } = await supabase
      .from('repair_tickets')
      .select(`
        *,
        customer:customers(*),
        items:repair_items(
          *,
          product:products(id, name, sku, price, vat)
        )
      `)
      .eq('id', repair_id)
      .single();

    if (ticketErr || !ticket) {
      console.log('[repairs-generate-invoice] Ticket introuvable:', repair_id);
      return resp(404, {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Ticket de réparation ${repair_id} introuvable`
        }
      });
    }

    console.log('[repairs-generate-invoice] Ticket trouvé, statut:', ticket.status);

    // Vérifier le statut (ready_to_return ou delivered)
    if (ticket.status !== 'ready_to_return' && ticket.status !== 'delivered') {
      console.log('[repairs-generate-invoice] Statut invalide pour facturation:', ticket.status);
      return resp(409, {
        ok: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Le ticket doit être en statut "ready_to_return" ou "delivered" pour générer une facture. Statut actuel: ${ticket.status}`
        }
      });
    }

    // Vérifier qu'il n'y a pas déjà une facture
    if (ticket.invoice_id) {
      console.log('[repairs-generate-invoice] Facture déjà existante:', ticket.invoice_id);

      // Récupérer la facture existante
      const { data: existingInvoice, error: invoiceErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', ticket.invoice_id)
        .single();

      if (!invoiceErr && existingInvoice) {
        return resp(200, {
          ok: true,
          data: {
            invoice: existingInvoice,
            already_exists: true,
            message: 'Une facture existe déjà pour ce ticket'
          }
        });
      }
    }

    // Vérifier qu'il y a des items
    if (!ticket.items || ticket.items.length === 0) {
      console.log('[repairs-generate-invoice] Aucune pièce attachée');
      return resp(409, {
        ok: false,
        error: {
          code: 'NO_ITEMS',
          message: 'Impossible de générer une facture: aucune pièce n\'est attachée à ce ticket'
        }
      });
    }

    console.log('[repairs-generate-invoice] Nombre de pièces:', ticket.items.length);

    // Créer la facture en mode draft
    const invoiceData: any = {
      customer_id: ticket.customer_id,
      status: 'draft',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // +30 jours
      notes: `Facture pour réparation - Ticket #${ticket.id.substring(0, 8)}\nAppareil: ${ticket.device_brand} ${ticket.device_model}`,
      created_by: userId
    };

    console.log('[repairs-generate-invoice] Création facture draft:', JSON.stringify(invoiceData, null, 2));

    const { data: invoice, error: createInvoiceErr } = await supabase
      .from('invoices')
      .insert(invoiceData)
      .select()
      .single();

    if (createInvoiceErr || !invoice) {
      console.log('[repairs-generate-invoice] Erreur création facture:', createInvoiceErr);
      return resp(500, {
        ok: false,
        error: {
          code: 'INTERNAL',
          message: `Erreur lors de la création de la facture: ${createInvoiceErr?.message || 'Erreur inconnue'}`
        }
      });
    }

    console.log('[repairs-generate-invoice] Facture créée:', invoice.id);

    // Créer les lignes de facture (invoice_items)
    const invoiceItems = ticket.items.map((item: any, index: number) => {
      const product = item.product;
      const unitPrice = product?.price || 0;
      const vatRate = product?.vat || 20;
      const quantity = item.quantity || 1;

      return {
        invoice_id: invoice.id,
        product_id: item.product_id,
        description: product?.name || 'Pièce de réparation',
        quantity,
        unit_price: unitPrice,
        vat_rate: vatRate,
        line_order: index + 1
      };
    });

    console.log('[repairs-generate-invoice] Création de', invoiceItems.length, 'lignes de facture');

    const { error: itemsErr } = await supabase
      .from('invoice_items')
      .insert(invoiceItems);

    if (itemsErr) {
      console.log('[repairs-generate-invoice] Erreur création invoice_items:', itemsErr);

      // Supprimer la facture créée
      await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id);

      return resp(500, {
        ok: false,
        error: {
          code: 'INTERNAL',
          message: `Erreur lors de la création des lignes de facture: ${itemsErr.message}`
        }
      });
    }

    console.log('[repairs-generate-invoice] Lignes de facture créées');

    // Lier la facture au ticket
    const { error: linkErr } = await supabase
      .from('repair_tickets')
      .update({ invoice_id: invoice.id })
      .eq('id', repair_id);

    if (linkErr) {
      console.log('[repairs-generate-invoice] Erreur liaison facture-ticket:', linkErr);
      // Non bloquant, on continue
    } else {
      console.log('[repairs-generate-invoice] Facture liée au ticket');
    }

    // ARCHIVAGE AUTOMATIQUE: Si le statut est 'delivered', archiver automatiquement
    if (ticket.status === 'delivered') {
      console.log('[repairs-generate-invoice] Ticket en statut delivered - archivage automatique');

      try {
        // Libérer les réservations de stock
        console.log('[repairs-generate-invoice] Appel RPC fn_repair_release_reservations');
        const { error: releaseErr } = await supabase.rpc('fn_repair_release_reservations', {
          p_repair_id: repair_id
        });

        if (releaseErr) {
          console.error('[repairs-generate-invoice] Erreur libération réservations:', releaseErr);
          // Non bloquant, on continue
        } else {
          console.log('[repairs-generate-invoice] Réservations libérées avec succès');
        }

        // Archiver le ticket
        const { error: archiveErr } = await supabase
          .from('repair_tickets')
          .update({ status: 'archived' })
          .eq('id', repair_id);

        if (archiveErr) {
          console.error('[repairs-generate-invoice] Erreur archivage ticket:', archiveErr);
          // Non bloquant, on continue
        } else {
          console.log('[repairs-generate-invoice] Ticket archivé automatiquement');
        }
      } catch (archiveEx: any) {
        console.error('[repairs-generate-invoice] Exception archivage:', archiveEx);
        // Non bloquant, on continue
      }
    }

    // Récupérer la facture complète avec les items
    const { data: completeInvoice, error: fetchErr } = await supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(*),
        items:invoice_items(
          *,
          product:products(id, name, sku)
        )
      `)
      .eq('id', invoice.id)
      .single();

    if (fetchErr) {
      console.log('[repairs-generate-invoice] Erreur récupération facture complète:', fetchErr);
      // On retourne quand même la facture de base
      return resp(200, {
        ok: true,
        data: {
          invoice,
          message: `Facture draft #${invoice.id.substring(0, 8)} créée avec succès`
        }
      });
    }

    console.log('[repairs-generate-invoice] Facture complète récupérée');

    return resp(200, {
      ok: true,
      data: {
        invoice: completeInvoice,
        invoice_id: invoice.id,
        invoice_url: `/invoices/${invoice.id}`,
        message: `Facture draft #${invoice.id.substring(0, 8)} créée avec succès. La facture doit être finalisée via le module de facturation.`
      }
    });

  } catch (e: any) {
    console.log('[repairs-generate-invoice] Exception globale:', e);
    return resp(500, {
      ok: false,
      error: {
        code: 'INTERNAL',
        message: `Erreur interne: ${String(e?.message || e)}`
      }
    });
  }
};
