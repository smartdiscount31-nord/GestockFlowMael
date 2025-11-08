// Netlify Function: repairs-ticket-pdf
// Génère les PDF pour tickets de réparation (A4 et Dymo)
// Note: Cette fonction nécessite jsPDF et qrcode qui sont déjà dans le projet

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

/**
 * Génère un QR Code en base64 à partir d'un texte
 */
async function generateQRCode(text: string): Promise<string> {
  const QRCode = await import('qrcode');
  try {
    const qrDataUrl = await QRCode.toDataURL(text, {
      width: 150,
      margin: 1,
      errorCorrectionLevel: 'M'
    });
    return qrDataUrl;
  } catch (err) {
    console.error('[repairs-ticket-pdf] Erreur génération QR code:', err);
    return '';
  }
}

/**
 * Génère le PDF A4 complet pour la fiche de réparation
 */
async function generateA4PDF(ticket: any, customer: any, companySettings: any, photos: any[]): Promise<Buffer> {
  const jsPDF = (await import('jspdf')).default;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  console.log('[repairs-ticket-pdf] Génération PDF A4 pour ticket:', ticket.id);

  let yPos = 20;
  const leftMargin = 20;
  const pageWidth = 210;
  const contentWidth = pageWidth - 2 * leftMargin;

  // En-tête avec logo si disponible
  if (companySettings?.logo_url) {
    try {
      // Note: En production, il faudrait charger l'image via fetch puis la convertir en base64
      // Pour l'instant on affiche juste le nom de l'entreprise
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(companySettings.name || 'Atelier de Réparation', leftMargin, yPos);
      yPos += 8;
    } catch (logoErr) {
      console.log('[repairs-ticket-pdf] Impossible de charger le logo');
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(companySettings?.name || 'Atelier de Réparation', leftMargin, yPos);
      yPos += 8;
    }
  } else {
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(companySettings?.name || 'Atelier de Réparation', leftMargin, yPos);
    yPos += 8;
  }

  // Ligne de séparation
  doc.setLineWidth(0.5);
  doc.line(leftMargin, yPos, pageWidth - leftMargin, yPos);
  yPos += 10;

  // Titre du document
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Fiche de Prise en Charge - Ticket #${ticket.id.substring(0, 8)}`, leftMargin, yPos);
  yPos += 10;

  // Informations client
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Informations Client', leftMargin, yPos);
  yPos += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nom: ${customer.name || 'N/A'}`, leftMargin, yPos);
  yPos += 5;
  doc.text(`Téléphone: ${customer.phone || 'N/A'}`, leftMargin, yPos);
  yPos += 5;
  doc.text(`Email: ${customer.email || 'N/A'}`, leftMargin, yPos);
  yPos += 10;

  // Informations appareil
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Informations Appareil', leftMargin, yPos);
  yPos += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Marque: ${ticket.device_brand}`, leftMargin, yPos);
  yPos += 5;
  doc.text(`Modèle: ${ticket.device_model}`, leftMargin, yPos);
  yPos += 5;
  if (ticket.device_color) {
    doc.text(`Couleur: ${ticket.device_color}`, leftMargin, yPos);
    yPos += 5;
  }
  if (ticket.imei) {
    doc.text(`IMEI: ${ticket.imei}`, leftMargin, yPos);
    yPos += 5;
  }
  if (ticket.serial_number) {
    doc.text(`Numéro de série: ${ticket.serial_number}`, leftMargin, yPos);
    yPos += 5;
  }
  if (ticket.pin_code) {
    doc.text(`Code PIN: ${ticket.pin_code}`, leftMargin, yPos);
    yPos += 5;
  }

  doc.text(`État d'alimentation: ${ticket.power_state === 'ok' ? 'Fonctionne' : ticket.power_state === 'lcd_off' ? 'Écran éteint' : 'Aucun signe de vie'}`, leftMargin, yPos);
  yPos += 10;

  // Description du problème
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Description du Problème', leftMargin, yPos);
  yPos += 6;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const issueLines = doc.splitTextToSize(ticket.issue_description, contentWidth);
  doc.text(issueLines, leftMargin, yPos);
  yPos += issueLines.length * 5 + 5;

  // Photos (miniatures)
  if (photos && photos.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Photos jointes', leftMargin, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text(`${photos.length} photo(s) disponible(s) dans le système`, leftMargin, yPos);
    yPos += 10;
  }

  // Signature si disponible
  if (ticket.signature_url) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Signature Client', leftMargin, yPos);
    yPos += 6;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Signature enregistrée dans le système', leftMargin, yPos);
    yPos += 10;
  }

  // CGV et QR Code
  if (ticket.cgv_accepted_at && companySettings?.cgv_qr_url) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`CGV acceptées le: ${new Date(ticket.cgv_accepted_at).toLocaleDateString('fr-FR')}`, leftMargin, yPos);
    yPos += 5;

    // Générer QR code pour les CGV
    const qrCode = await generateQRCode(companySettings.cgv_qr_url);
    if (qrCode) {
      doc.text('Scannez pour consulter les CGV:', leftMargin, yPos);
      yPos += 5;
      doc.addImage(qrCode, 'PNG', leftMargin, yPos, 30, 30);
      yPos += 35;
    }
  }

  // Pied de page
  const footerY = 280;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, leftMargin, footerY);

  // Convertir en buffer
  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
}

/**
 * Génère l'étiquette Dymo (format petit pour coller sur le téléphone)
 */
async function generateDymoLabel(ticket: any, customer: any): Promise<Buffer> {
  const jsPDF = (await import('jspdf')).default;

  // Dimensions Dymo similaires aux étiquettes IMEI: 62mm x 29mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [62, 29]
  });

  console.log('[repairs-ticket-pdf] Génération étiquette Dymo pour ticket:', ticket.id);

  // Petite marge
  const margin = 2;
  let yPos = 5;

  // Numéro de ticket (gros et visible)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`#${ticket.id.substring(0, 8).toUpperCase()}`, margin, yPos);
  yPos += 6;

  // Nom client (tronqué si trop long)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const customerName = customer.name.length > 20 ? customer.name.substring(0, 20) + '...' : customer.name;
  doc.text(customerName, margin, yPos);
  yPos += 5;

  // Modèle appareil
  doc.setFontSize(8);
  const deviceInfo = `${ticket.device_brand} ${ticket.device_model}`;
  const deviceTruncated = deviceInfo.length > 25 ? deviceInfo.substring(0, 25) + '...' : deviceInfo;
  doc.text(deviceTruncated, margin, yPos);
  yPos += 4;

  // IMEI ou Serial si disponible
  if (ticket.imei) {
    doc.setFontSize(7);
    doc.text(`IMEI: ${ticket.imei}`, margin, yPos);
  } else if (ticket.serial_number) {
    doc.setFontSize(7);
    doc.text(`S/N: ${ticket.serial_number}`, margin, yPos);
  }

  // Convertir en buffer
  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
}

export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  console.log('[repairs-ticket-pdf] Début de la requête');

  if (event.httpMethod !== 'POST') {
    console.log('[repairs-ticket-pdf] Méthode non autorisée:', event.httpMethod);
    return resp(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Seule la méthode POST est autorisée' } });
  }

  try {
    const token = getAuthToken(event);
    if (!token) {
      console.log('[repairs-ticket-pdf] Token manquant');
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Token d\'authentification manquant' } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Vérifier l'utilisateur
    const { data: userWrap, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userWrap?.user) {
      console.log('[repairs-ticket-pdf] Erreur authentification:', userErr);
      return resp(401, { ok: false, error: { code: 'UNAUTHORIZED', message: 'Utilisateur non authentifié' } });
    }

    // Parser le body
    let parsed: any = {};
    try {
      parsed = JSON.parse(event.body || '{}');
    } catch {
      console.log('[repairs-ticket-pdf] Erreur parsing JSON');
      return resp(400, { ok: false, error: { code: 'BAD_REQUEST', message: 'Corps de requête JSON invalide' } });
    }

    const { repair_id, format } = parsed;

    if (!repair_id) {
      return resp(400, {
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Champ obligatoire manquant: repair_id' }
      });
    }

    // Valider le format (a4, dymo, ou both par défaut)
    const pdfFormat = format || 'both';
    if (!['a4', 'dymo', 'both'].includes(pdfFormat)) {
      return resp(400, {
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Format invalide. Valeurs acceptées: a4, dymo, both' }
      });
    }

    console.log('[repairs-ticket-pdf] Format demandé:', pdfFormat);

    // Récupérer le ticket complet
    const { data: ticket, error: ticketErr } = await supabase
      .from('repair_tickets')
      .select(`
        *,
        customer:customers(*),
        media:repair_media(*)
      `)
      .eq('id', repair_id)
      .single();

    if (ticketErr || !ticket) {
      console.log('[repairs-ticket-pdf] Ticket introuvable:', repair_id);
      return resp(404, {
        ok: false,
        error: { code: 'NOT_FOUND', message: `Ticket ${repair_id} introuvable` }
      });
    }

    console.log('[repairs-ticket-pdf] Ticket trouvé');

    // Récupérer les paramètres de l'entreprise
    const { data: companySettings, error: settingsErr } = await supabase
      .from('company_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (settingsErr) {
      console.log('[repairs-ticket-pdf] Erreur récupération company_settings:', settingsErr);
    }

    const photos = ticket.media?.filter((m: any) => m.kind === 'photo') || [];

    let a4Url: string | null = null;
    let dymoUrl: string | null = null;

    // Générer le PDF A4 si demandé
    if (pdfFormat === 'a4' || pdfFormat === 'both') {
      console.log('[repairs-ticket-pdf] Génération PDF A4');
      const a4Buffer = await generateA4PDF(ticket, ticket.customer, companySettings, photos);

      const a4FileName = `repair-tickets/${ticket.id}/ticket-a4-${Date.now()}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('app-assets')
        .upload(a4FileName, a4Buffer, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadErr) {
        console.log('[repairs-ticket-pdf] Erreur upload PDF A4:', uploadErr);
      } else {
        const { data: publicUrl } = supabase.storage
          .from('app-assets')
          .getPublicUrl(a4FileName);

        a4Url = publicUrl.publicUrl;
        console.log('[repairs-ticket-pdf] PDF A4 uploadé:', a4Url);
      }
    }

    // Générer l'étiquette Dymo si demandée
    if (pdfFormat === 'dymo' || pdfFormat === 'both') {
      console.log('[repairs-ticket-pdf] Génération étiquette Dymo');
      const dymoBuffer = await generateDymoLabel(ticket, ticket.customer);

      const dymoFileName = `repair-tickets/${ticket.id}/label-dymo-${Date.now()}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from('app-assets')
        .upload(dymoFileName, dymoBuffer, {
          contentType: 'application/pdf',
          upsert: false
        });

      if (uploadErr) {
        console.log('[repairs-ticket-pdf] Erreur upload étiquette Dymo:', uploadErr);
      } else {
        const { data: publicUrl } = supabase.storage
          .from('app-assets')
          .getPublicUrl(dymoFileName);

        dymoUrl = publicUrl.publicUrl;
        console.log('[repairs-ticket-pdf] Étiquette Dymo uploadée:', dymoUrl);
      }
    }

    return resp(200, {
      ok: true,
      data: {
        ticket_id: ticket.id,
        a4_pdf_url: a4Url,
        dymo_label_url: dymoUrl,
        message: 'PDF(s) généré(s) avec succès'
      }
    });

  } catch (e: any) {
    console.log('[repairs-ticket-pdf] Exception globale:', e);
    return resp(500, {
      ok: false,
      error: {
        code: 'INTERNAL',
        message: `Erreur interne: ${String(e?.message || e)}`
      }
    });
  }
};
