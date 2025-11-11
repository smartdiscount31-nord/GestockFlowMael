import { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';
import { generateCGVQRCode } from './qrCodeGenerator';

async function getPublicRepairUrl(repairId: string): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/.netlify/functions/repairs-public-link-create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({ repair_id: repairId })
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.public_url || null;
  } catch {
    return null;
  }
}

export interface RepairTicketForLabels {
  id: string;
  repair_number?: string | null;
  created_at: string;
  customer?: { name?: string | null; phone?: string | null } | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  device_brand: string;
  device_model: string;
  issue_description: string;
  assigned_tech?: string | null;
  pin_code?: string | null;
  estimate_amount?: number | null;
}

function eur(amount?: number | null): string {
  if (amount == null || isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount)} €`;
  }
}

function headerBlock(doc: jsPDF, x: number, y: number, width: number) {
  // En-tête compact sur 2 lignes max, aligné au même Y que le QR
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  doc.text('SMARTDISCOUNT31 Nord - 58 Av des Etats Unis', x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.0);
  doc.text('Lun - Ven | 10H - 19H | Tel : 06 10 66 89 75', x, y + 2.4);
}

function fieldLine(doc: jsPDF, label: string, value: string, x: number, y: number, width: number) {
  const labelW = 16; // mm réservés au libellé
  const valueX = x + labelW;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  const maxValueWidth = width - labelW - 1.5;
  const lines = doc.splitTextToSize(value || '—', maxValueWidth);
  doc.text(lines as any, valueX, y);
  // ligne de séparation
  doc.setLineWidth(0.2);
  const lastY = y + (Array.isArray(lines) ? (lines.length - 1) * 2.8 : 0);
  doc.line(x, lastY + 1.6, x + width, lastY + 1.6);
  return lastY + 3.2; // prochain y
}

function fieldLineWithTextOffset(doc: jsPDF, label: string, value: string, x: number, y: number, width: number, textDy: number, drawBottomLine: boolean = true) {
  const labelW = 16;
  const valueX = x + labelW;
  // Texte décalé
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.text(label, x, y + textDy);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  const maxValueWidth = width - labelW - 1.5;
  const lines = doc.splitTextToSize(value || '—', maxValueWidth);
  doc.text(lines as any, valueX, y + textDy);
  // Ligne au niveau d'origine (sans décalage)
  doc.setLineWidth(0.2);
  const lastY = y + (Array.isArray(lines) ? (lines.length - 1) * 2.8 : 0);
  if (drawBottomLine) {
    doc.line(x, lastY + 1.6, x + width, lastY + 1.6);
  }
  return lastY + 3.2;
}

async function buildClientLabel(ticket: RepairTicketForLabels): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: [32, 57], orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 0.6;
const x = margin;
let y = margin + 0.6; // petit décalage top
const contentW = pageW - margin * 2;

  // QR en haut-gauche
  const qrSize = 11; // 10-12mm
  const publicUrl = await getPublicRepairUrl(ticket.id);
  const url = publicUrl || `${window.location.origin}/repair/status/${ticket.id}`;
  const qr = await generateCGVQRCode(url, 180);
  doc.addImage(qr, 'PNG', x, margin, qrSize, qrSize);

  // Header à droite du QR
const headX = x + qrSize + 1.0;
headerBlock(doc, headX, margin + 5.6, contentW - (qrSize + 1.0));
// Nom client sous l'en-tête
const nameForHeader = ticket.customer?.name ?? ticket.customer_name ?? '';
doc.setFont('helvetica', 'bold');
doc.setFontSize(5.4);
doc.text(nameForHeader || '—', headX, margin + 10.6);

// Champs (grille)
// Démarrage des champs remonté (max entre bas du QR et zone nom) + décalage 3mm
y = Math.max(margin + qrSize + 1.2, margin + 10.6 + 1.0) + 3.0;
  
  const custPhone = ticket.customer?.phone ?? ticket.customer_phone ?? '';
  const model = `${ticket.device_brand || ''} ${ticket.device_model || ''}`.trim();
  const panne = (ticket.issue_description || '').replace(/\s*\[(?:pattern|Pattern)\s*:\s*[^\]]+\]\s*/i, '').trim();

  
  y = fieldLine(doc, 'TEL :', custPhone || '—', x, y, contentW);
  y = fieldLineWithTextOffset(doc, 'MODELE :', model || '—', x, y, contentW, 0.3, true);
  y = fieldLineWithTextOffset(doc, 'PANNE :', panne || '—', x, y, contentW, 0.3, true);
  
  y = fieldLineWithTextOffset(doc, 'PRIX :', eur(ticket.estimate_amount), x, y, contentW, 0.3, true);

  // Date en bas
  const created = new Date(ticket.created_at);
  const locale = created.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text(locale, margin, pageH - 1.5);

  return doc;
}

async function buildTechLabel(ticket: RepairTicketForLabels): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: [32, 57], orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 0.6;
const x = margin;
let y = margin + 0.6;
const contentW = pageW - margin * 2;

  const qrSize = 11;
  const publicUrl2 = await getPublicRepairUrl(ticket.id);
  const url = publicUrl2 || `${window.location.origin}/repair/status/${ticket.id}`;
  const qr = await generateCGVQRCode(url, 180);
  doc.addImage(qr, 'PNG', x, margin, qrSize, qrSize);

const headX = x + qrSize + 1.0;
headerBlock(doc, headX, margin + 5.6, contentW - (qrSize + 1.0));
// Nom client sous l'en-tête
const nameForHeader = ticket.customer?.name ?? ticket.customer_name ?? '';
doc.setFont('helvetica', 'bold');
doc.setFontSize(5.4);
doc.text(nameForHeader || '—', headX, margin + 10.6);

y = Math.max(margin + qrSize + 1.2, margin + 10.6 + 1.0) + 3.0;
  
  const custPhone = ticket.customer?.phone ?? ticket.customer_phone ?? '';
  const model = `${ticket.device_brand || ''} ${ticket.device_model || ''}`.trim();
  const panne = (ticket.issue_description || '').replace(/\s*\[(?:pattern|Pattern)\s*:\s*[^\]]+\]\s*/i, '').trim();

  const patternMatch = (ticket.issue_description || '').match(/\[(?:pattern|Pattern)\s*:\s*([^\]]+)\]/);
  const pattern = patternMatch ? patternMatch[1] : null;
  const vp = ticket.pin_code ? `PIN: ${ticket.pin_code}${pattern ? '  |  PATTERN: ' + pattern : ''}` : (pattern ? `PATTERN: ${pattern}` : '—');

  
  y = fieldLine(doc, 'TEL :', custPhone || '—', x, y, contentW);
  y = fieldLineWithTextOffset(doc, 'MODELE :', model || '—', x, y, contentW, 0.3, true);
  y = fieldLineWithTextOffset(doc, 'PANNE :', panne || '—', x, y, contentW, 0.3, true);
  y = fieldLineWithTextOffset(doc, 'V - P :', vp, x, y, contentW, 0.3, true);
  y = fieldLineWithTextOffset(doc, 'PRIX :', eur(ticket.estimate_amount), x, y, contentW, 0.3, false);

  const created = new Date(ticket.created_at);
  const locale = created.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text(locale, margin, pageH - 0.9);

  return doc;
}

async function uploadWithFallback(buffer: Blob | Uint8Array, path: string): Promise<{ url: string; persisted: boolean }> {
  // Tentative 1: application/octet-stream (souvent acceptée par les buckets restreints)
  try {
    const { error } = await supabase.storage.from('app-assets').upload(path, buffer, {
      contentType: 'application/octet-stream',
      upsert: true
    });
    if (error) throw error;
    const { data } = supabase.storage.from('app-assets').getPublicUrl(path);
    return { url: data.publicUrl, persisted: true };
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    // Tentative 2: application/pdf
    try {
      const { error: err2 } = await supabase.storage.from('app-assets').upload(path, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });
      if (err2) throw err2;
      const { data } = supabase.storage.from('app-assets').getPublicUrl(path);
      return { url: data.publicUrl, persisted: true };
    } catch (e2) {
      // Fallback final: ne pas persister, renvoyer une URL locale blob:
      let blob: Blob;
      if (buffer instanceof Blob) {
        blob = buffer;
      } else if (buffer instanceof Uint8Array) {
        // Convertir en ArrayBuffer "classique" en copiant les octets (évite SharedArrayBuffer)
        const ab = new ArrayBuffer(buffer.byteLength);
        new Uint8Array(ab).set(buffer);
        blob = new Blob([ab], { type: 'application/pdf' });
      } else {
        // Dernier recours (types élargis si jamais):
        blob = new Blob([buffer as any], { type: 'application/pdf' });
      }
      const localUrl = URL.createObjectURL(blob);
      return { url: localUrl, persisted: false };
    }
  }
}

/**
 * Génération 2 pages: une page = une étiquette (DYMO: avance/coupe à chaque page)
 * Format unitaire: [32, 57] en landscape
 */
async function drawClientOnPage(doc: jsPDF, ticket: RepairTicketForLabels) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 0.6;
  const x = margin;
  let y = margin + 0.6;
  const contentW = pageW - margin * 2;

  const qrSize = 15;
  const qrY = margin;
  const publicUrl = await getPublicRepairUrl(ticket.id);
  const url = publicUrl || `${window.location.origin}/repair/status/${ticket.id}`;
  const qr = await generateCGVQRCode(url, 180);
  doc.addImage(qr, 'PNG', 0, qrY, qrSize, qrSize);

  // En-tête aligné à droite
  const rightX = pageW - (margin + 3);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.2);
  const y1 = margin + 3.8;
  doc.text('SMARTDISCOUNT31 Nord', rightX, y1, { align: 'right' } as any);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.0);
  const y2 = y1 + 2.0;
  doc.text('58 Av des Etats Unis', rightX, y2, { align: 'right' } as any);
  const y3 = y2 + 2.0;
  doc.text('Lun - Ven | 10H - 19H | Tel : 06 10 66 89 75', rightX, y3, { align: 'right' } as any);

  // Nom client centré
  const nameForHeader = ticket.customer?.name ?? ticket.customer_name ?? '';
  const nameY = y3 + 6.0;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.4);
  doc.text(nameForHeader || '—', (pageW / 2) - 5, nameY, { align: 'center' } as any);

  // Démarrer sous le QR et le nom client
  y = Math.max(qrY + qrSize + 1.0, nameY + 1.0);
  const custPhone = ticket.customer?.phone ?? ticket.customer_phone ?? '';

  // TEL non affiché sur l'étiquette client

  const model = `${ticket.device_brand || ''} ${ticket.device_model || ''}`.trim();
  const panne = (ticket.issue_description || '').replace(/\s*\[(?:pattern|Pattern)\s*:\s*[^\]]+\]\s*/i, '').trim();

  // TEL centré ci-dessus
  y += 1;
  y = fieldLineWithTextOffset(doc, 'MODELE :', model || '—', x, y, contentW, 0.3, true);
  y = fieldLineWithTextOffset(doc, 'PANNE :', panne || '—', x, y, contentW, 0.3, true);
  y = fieldLineWithTextOffset(doc, 'PRIX :', eur(ticket.estimate_amount), x, y, contentW, 0.3, true);

  const created = new Date(ticket.created_at);
  const locale = created.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
  doc.text(locale, margin, pageH - 1.5);
  const dateW = (doc as any).getTextWidth ? (doc as any).getTextWidth(locale) : (doc.getStringUnitWidth(locale) * doc.getFontSize() / (doc as any).internal.scaleFactor);
  doc.text('Ticket client', margin + dateW + 2, pageH - 1.5);
}

async function drawTechOnPage(doc: jsPDF, ticket: RepairTicketForLabels) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 0.6;
  const x = margin;
  let y = margin + 0.6;
  const contentW = pageW - margin * 2;

  const qrSize = 15;
  const qrY = 0;
  const publicUrl2 = await getPublicRepairUrl(ticket.id);
  const url = publicUrl2 || `${window.location.origin}/repair/status/${ticket.id}`;
  const qr = await generateCGVQRCode(url, 180);
  doc.addImage(qr, 'PNG', 0, qrY, qrSize, qrSize);

  // En-tête aligné à droite
  const rightX2 = pageW - (margin + 3);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.2);
  const y1b = margin + 3.8;
  doc.text('SMARTDISCOUNT31 Nord', rightX2, y1b, { align: 'right' } as any);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(5.0);
  const y2b = y1b + 2.0;
  doc.text('58 Av des Etats Unis', rightX2, y2b, { align: 'right' } as any);
  const y3b = y2b + 2.0;
  doc.text('Lun - Ven | 10H - 19H | Tel : 06 10 66 89 75', rightX2, y3b, { align: 'right' } as any);

  // Nom client centré
  const nameForHeader = ticket.customer?.name ?? ticket.customer_name ?? '';
  const nameY2 = y3b + 3.0;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.4);
  doc.text(nameForHeader || '—', (pageW / 2) - 5, nameY2, { align: 'center' } as any);

  // Démarrer sous le QR et le nom client
  const custPhone = ticket.customer?.phone ?? ticket.customer_phone ?? '';
  // TEL centré sous le nom (étiquette technicien)
  const telStr2 = `TEL : ${custPhone || '—'}`;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.0);
  doc.text(telStr2, pageW / 2, nameY2 + 1.8, { align: 'center' } as any);
  y = Math.max(qrY + qrSize + 1.0, nameY2 + 2.8);
  const model = `${ticket.device_brand || ''} ${ticket.device_model || ''}`.trim();
  const panne = (ticket.issue_description || '').replace(/\s*\[(?:pattern|Pattern)\s*:\s*[^\]]+\]\s*/i, '').trim();

  const patternMatch = (ticket.issue_description || '').match(/\[(?:pattern|Pattern)\s*:\s*([^\]]+)\]/);
  const pattern = patternMatch ? patternMatch[1] : null;
  const vp = ticket.pin_code ? `PIN: ${ticket.pin_code}${pattern ? '  |  PATTERN: ' + pattern : ''}` : (pattern ? `PATTERN: ${pattern}` : '—');

  // TEL centré non réimprimé ici (centrage géré au-dessus si besoin)
  y += 1;
  y = fieldLineWithTextOffset(doc, 'MODELE :', model || '—', x, y, contentW, 0.3, true);
  y = fieldLineWithTextOffset(doc, 'PANNE :', panne || '—', x, y, contentW, 0.3, true);
  y = fieldLineWithTextOffset(doc, 'V - P :', vp, x, y, contentW, 0.3, true);
  y = fieldLineWithTextOffset(doc, 'PRIX :', eur(ticket.estimate_amount), x, y, contentW, 0.3, false);

  const created = new Date(ticket.created_at);
  const locale = created.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
  doc.text(locale, margin, pageH - 0.9);
  const dateW2 = (doc as any).getTextWidth ? (doc as any).getTextWidth(locale) : (doc.getStringUnitWidth(locale) * doc.getFontSize() / (doc as any).internal.scaleFactor);
  doc.text('Ticket technicien', margin + dateW2 + 2, pageH - 0.9);
}

async function buildTwoPageLabels(ticket: RepairTicketForLabels): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: [32, 57], orientation: 'landscape' });
  await drawClientOnPage(doc, ticket);
  doc.addPage(); // 2e page = 2e étiquette
  await drawTechOnPage(doc, ticket);
  return doc;
}


export async function generateRepairLabels(ticket: RepairTicketForLabels): Promise<{ clientUrl: string; techUrl: string; persisted: boolean; }> {
  // PDF 2 pages: 1 page = 1 étiquette (DYMO)
  const doc = await buildTwoPageLabels(ticket);
  const blob = doc.output('blob');
  const safeNumber = ticket.repair_number || ticket.id.substring(0,8);
  const path = `labels/repairs/${ticket.id}/labels-${safeNumber}.pdf`;
  const res = await uploadWithFallback(blob, path);
  // Même URL pour client/tech (un seul PDF contient les 2 pages)
  return { clientUrl: res.url, techUrl: res.url, persisted: res.persisted };
}
