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

<<<<<<< HEAD
async function uploadWithFallback(buffer: Blob | Uint8Array, path: string): Promise<{ url: string; persisted: boolean }> {
  // Tentative 1: application/pdf
  try {
    const { error } = await supabase.storage.from('app-assets').upload(path, buffer, {
      contentType: 'application/pdf',
      upsert: true
    });
    if (error) throw error;
    const { data } = supabase.storage.from('app-assets').getPublicUrl(path);
    return { url: data.publicUrl, persisted: true };
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    // Tentative 2: application/octet-stream (certains buckets restreignent les PDF)
    try {
      const { error: err2 } = await supabase.storage.from('app-assets').upload(path, buffer, {
        contentType: 'application/octet-stream',
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
=======
async function uploadPdf(buffer: Blob | Uint8Array, path: string): Promise<string> {
  const { error } = await supabase.storage.from('app-assets').upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: true
  });
  if (error) throw error;
  const { data } = supabase.storage.from('app-assets').getPublicUrl(path);
  return data.publicUrl;
>>>>>>> 9fce888 (Update repairLabels.ts)
}

export async function generateRepairLabels(ticket: RepairTicketForLabels): Promise<{ clientUrl: string; techUrl: string; persisted: boolean; }> {
  const clientDoc = await buildClientLabel(ticket);
  const techDoc = await buildTechLabel(ticket);

  // Export en Blob
  const clientBlob = clientDoc.output('blob');
  const techBlob = techDoc.output('blob');

  const safeNumber = ticket.repair_number || ticket.id.substring(0,8);
  const clientPath = `labels/repairs/${ticket.id}/label-client-${safeNumber}.pdf`;
  const techPath = `labels/repairs/${ticket.id}/label-tech-${safeNumber}.pdf`;

  const [clientRes, techRes] = await Promise.all([
    uploadWithFallback(clientBlob, clientPath),
    uploadWithFallback(techBlob, techPath)
  ]);

  // persisted vrai seulement si les deux ont été persistés
  const persisted = clientRes.persisted && techRes.persisted;
  return { clientUrl: clientRes.url, techUrl: techRes.url, persisted };
}
