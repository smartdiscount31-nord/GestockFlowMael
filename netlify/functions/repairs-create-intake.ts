// Netlify Function: repairs-create-intake
// Crée un nouveau dossier de prise en charge atelier avec médias et signature

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
  console.log('[repairs-create-intake] Début de la requête');

  if (event.httpMethod !== 'POST') {
    console.log('[repairs-create-intake] Méthode non autorisée:', event.httpMethod);
    return resp(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Seule la méthode POST est autorisée' } });
  }

  try {
    const token = getAuthToken(event);
    if (!token) {
      console.log('[repairs-create-intake] Token manquant');
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Token d\'authentification manquant' } });
    }

    // Supabase client with Authorization header
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Vérifier l'utilisateur
    const { data: userWrap, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userWrap?.user) {
      console.log('[repairs-create-intake] Erreur authentification utilisateur:', userErr);
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Utilisateur non authentifié' } });
    }
    const userId = userWrap.user.id;
    console.log('[repairs-create-intake] Utilisateur authentifié:', userId);

    // Vérifier le rôle de l'utilisateur
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      console.log('[repairs-create-intake] Erreur récupération profil:', profileErr);
      return resp(403, { ok: false, error: { code: 'FORBIDDEN', message: 'Profil utilisateur introuvable' } });
    }

    console.log('[repairs-create-intake] Rôle utilisateur:', profile.role);

    // Vérifier les permissions (MAGASIN, ADMIN, ADMIN_FULL)
    const allowedRoles = ['MAGASIN', 'ADMIN', 'ADMIN_FULL'];
    if (!allowedRoles.includes(profile.role)) {
      console.log('[repairs-create-intake] Rôle non autorisé:', profile.role);
      return resp(403, {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Vous n\'avez pas les permissions nécessaires pour créer un ticket de réparation'
        }
      });
    }

    // Parser le body
    let parsed: any = {};
    try {
      parsed = JSON.parse(event.body || '{}');
    } catch {
      console.log('[repairs-create-intake] Erreur parsing JSON body');
      return resp(400, { ok: false, error: { code: 'BAD_REQUEST', message: 'Corps de requête JSON invalide' } });
    }

    console.log('[repairs-create-intake] Données reçues:', JSON.stringify(parsed, null, 2));

    // Valider les champs obligatoires
    const {
      customer_id,
      device_brand,
      device_model,
      issue_description,
      power_state,
      device_color,
      imei,
      serial_number,
      pin_code,
      assigned_tech,
      cgv_accepted,
      signature_base64,
      photos_base64 // Array de base64 strings
    } = parsed;

    if (!customer_id || !device_brand || !device_model || !issue_description || !power_state) {
      console.log('[repairs-create-intake] Champs obligatoires manquants');
      return resp(400, {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Champs obligatoires manquants: customer_id, device_brand, device_model, issue_description, power_state'
        }
      });
    }

    // VALIDATION OBLIGATOIRE: CGV et signature
    if (!cgv_accepted) {
      console.log('[repairs-create-intake] CGV non acceptées');
      return resp(400, {
        ok: false,
        error: {
          code: 'CGV_NOT_ACCEPTED',
          message: 'Les Conditions Générales de Vente doivent être acceptées pour créer une prise en charge'
        }
      });
    }

    if (!signature_base64 || signature_base64.trim() === '') {
      console.log('[repairs-create-intake] Signature manquante');
      return resp(400, {
        ok: false,
        error: {
          code: 'SIGNATURE_REQUIRED',
          message: 'La signature du client est obligatoire pour valider la prise en charge'
        }
      });
    }

    console.log('[repairs-create-intake] CGV acceptées et signature présente - validation OK');

    // Valider power_state
    const validPowerStates = ['ok', 'lcd_off', 'no_sign'];
    if (!validPowerStates.includes(power_state)) {
      console.log('[repairs-create-intake] power_state invalide:', power_state);
      return resp(400, {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: `power_state invalide. Valeurs acceptées: ${validPowerStates.join(', ')}`
        }
      });
    }

    // Vérifier que le customer existe
    const { data: customer, error: customerErr } = await supabase
      .from('customers')
      .select('id, name')
      .eq('id', customer_id)
      .single();

    if (customerErr || !customer) {
      console.log('[repairs-create-intake] Client introuvable:', customer_id);
      return resp(404, {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `Client avec l'ID ${customer_id} introuvable`
        }
      });
    }

    console.log('[repairs-create-intake] Client trouvé:', customer.name);

    // Créer le ticket de réparation
    const ticketData: any = {
      customer_id,
      device_brand,
      device_model,
      device_color: device_color || null,
      imei: imei || null,
      serial_number: serial_number || null,
      pin_code: pin_code || null,
      issue_description,
      power_state,
      status: 'quote_todo',
      assigned_tech: assigned_tech || null,
      cgv_accepted_at: cgv_accepted ? new Date().toISOString() : null,
      signature_url: null
    };

    console.log('[repairs-create-intake] Création du ticket avec les données:', JSON.stringify(ticketData, null, 2));

    const { data: ticket, error: ticketErr } = await supabase
      .from('repair_tickets')
      .insert(ticketData)
      .select()
      .single();

    if (ticketErr || !ticket) {
      console.log('[repairs-create-intake] Erreur création ticket:', ticketErr);
      return resp(500, {
        ok: false,
        error: {
          code: 'INTERNAL',
          message: `Erreur lors de la création du ticket: ${ticketErr?.message || 'Erreur inconnue'}`
        }
      });
    }

    console.log('[repairs-create-intake] Ticket créé avec succès, ID:', ticket.id);

    // Upload de la signature si fournie
    let signatureUrl: string | null = null;
    if (signature_base64) {
      try {
        console.log('[repairs-create-intake] Upload de la signature');
        const signatureBuffer = Buffer.from(signature_base64, 'base64');
        const signatureFileName = `repair-tickets/${ticket.id}/signature-${Date.now()}.png`;

        const { data: signatureUpload, error: signatureUploadErr } = await supabase.storage
          .from('app-assets')
          .upload(signatureFileName, signatureBuffer, {
            contentType: 'image/png',
            upsert: false
          });

        if (signatureUploadErr) {
          console.log('[repairs-create-intake] Erreur upload signature:', signatureUploadErr);
        } else {
          const { data: signaturePublicUrl } = supabase.storage
            .from('app-assets')
            .getPublicUrl(signatureFileName);

          signatureUrl = signaturePublicUrl.publicUrl;
          console.log('[repairs-create-intake] Signature uploadée:', signatureUrl);

          // Mettre à jour le ticket avec l'URL de la signature
          await supabase
            .from('repair_tickets')
            .update({ signature_url: signatureUrl })
            .eq('id', ticket.id);

          // Créer une entrée dans repair_media pour la signature
          await supabase
            .from('repair_media')
            .insert({
              repair_id: ticket.id,
              kind: 'signature',
              file_url: signatureUrl
            });

          console.log('[repairs-create-intake] Entrée repair_media créée pour la signature');
        }
      } catch (signatureErr: any) {
        console.log('[repairs-create-intake] Exception upload signature:', signatureErr);
      }
    }

    // Upload des photos si fournies
    const uploadedPhotos: string[] = [];
    if (photos_base64 && Array.isArray(photos_base64) && photos_base64.length > 0) {
      console.log('[repairs-create-intake] Upload de', photos_base64.length, 'photos');

      for (let i = 0; i < photos_base64.length; i++) {
        try {
          const photoBase64 = photos_base64[i];
          const photoBuffer = Buffer.from(photoBase64, 'base64');
          const photoFileName = `repair-tickets/${ticket.id}/photo-${Date.now()}-${i}.jpg`;

          const { data: photoUpload, error: photoUploadErr } = await supabase.storage
            .from('app-assets')
            .upload(photoFileName, photoBuffer, {
              contentType: 'image/jpeg',
              upsert: false
            });

          if (photoUploadErr) {
            console.log(`[repairs-create-intake] Erreur upload photo ${i}:`, photoUploadErr);
            continue;
          }

          const { data: photoPublicUrl } = supabase.storage
            .from('app-assets')
            .getPublicUrl(photoFileName);

          const photoUrl = photoPublicUrl.publicUrl;
          uploadedPhotos.push(photoUrl);
          console.log(`[repairs-create-intake] Photo ${i} uploadée:`, photoUrl);

          // Créer une entrée dans repair_media pour la photo
          await supabase
            .from('repair_media')
            .insert({
              repair_id: ticket.id,
              kind: 'photo',
              file_url: photoUrl
            });

          console.log(`[repairs-create-intake] Entrée repair_media créée pour photo ${i}`);
        } catch (photoErr: any) {
          console.log(`[repairs-create-intake] Exception upload photo ${i}:`, photoErr);
        }
      }

      console.log('[repairs-create-intake] Total photos uploadées:', uploadedPhotos.length);
    }

    // Récupérer le ticket complet avec les médias
    const { data: completeTicket, error: completeErr } = await supabase
      .from('repair_tickets')
      .select(`
        *,
        customer:customers(id, name, email, phone),
        media:repair_media(id, kind, file_url, created_at),
        items:repair_items(id, product_id, quantity, reserved, stock_id),
        assigned_technician:profiles!repair_tickets_assigned_tech_fkey(id, email, full_name)
      `)
      .eq('id', ticket.id)
      .single();

    if (completeErr) {
      console.log('[repairs-create-intake] Erreur récupération ticket complet:', completeErr);
      // On retourne quand même le ticket de base
      return resp(200, {
        ok: true,
        data: {
          ticket,
          signature_url: signatureUrl,
          uploaded_photos: uploadedPhotos
        }
      });
    }

    console.log('[repairs-create-intake] Ticket complet récupéré avec succès');

    return resp(200, {
      ok: true,
      data: {
        ticket: completeTicket,
        signature_url: signatureUrl,
        uploaded_photos: uploadedPhotos,
        message: `Ticket de réparation #${ticket.id.substring(0, 8)} créé avec succès`
      }
    });

  } catch (e: any) {
    console.log('[repairs-create-intake] Exception globale:', e);
    return resp(500, {
      ok: false,
      error: {
        code: 'INTERNAL',
        message: `Erreur interne: ${String(e?.message || e)}`
      }
    });
  }
};
