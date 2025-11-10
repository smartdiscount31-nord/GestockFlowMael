/**
 * QR Code Generator Utility
 * Génère un QR code pour les CGV des documents PDF
 */

import QRCode from 'qrcode';

/**
 * Génère un QR code en base64 à partir d'une URL
 * @param url - L'URL à encoder dans le QR code
 * @param size - La taille du QR code en pixels (par défaut 70px pour ~2.5cm)
 * @returns Une promesse contenant l'image QR code en format data URL base64
 */
export async function generateCGVQRCode(url: string, size: number = 70): Promise<string> {
  try {
    console.log('[QRCodeGenerator] Génération du QR code pour URL:', url);

    const qrDataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M', // Niveau de correction d'erreur moyen
      margin: 1, // Marge minimale autour du QR code
      width: size, // Taille en pixels
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    console.log('[QRCodeGenerator] QR code généré avec succès, taille:', size, 'px');
    return qrDataUrl;
  } catch (error) {
    console.error('[QRCodeGenerator] Erreur lors de la génération du QR code:', error);
    throw new Error('Impossible de générer le QR code');
  }
}

/**
 * Dessine une flèche simple pointant vers la droite sur un canvas jsPDF
 * @param doc - L'instance jsPDF
 * @param startX - Position X de départ de la flèche
 * @param startY - Position Y de départ de la flèche (centre vertical)
 * @param endX - Position X de fin de la flèche
 * @param color - Couleur de la flèche (par défaut gris #555)
 */
export function drawArrowToPDF(
  doc: any,
  startX: number,
  startY: number,
  endX: number,
  color: string = '#555555'
): void {
  try {
    console.log('[QRCodeGenerator] Dessin d\'une flèche de', startX, 'à', endX);

    // Convertir la couleur hex en RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Configuration du style
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.5);

    // Ligne horizontale principale
    doc.line(startX, startY, endX, startY);

    // Pointe de la flèche (triangle)
    const arrowHeadSize = 2; // Taille de la pointe en mm
    doc.line(endX, startY, endX - arrowHeadSize, startY - arrowHeadSize / 2);
    doc.line(endX, startY, endX - arrowHeadSize, startY + arrowHeadSize / 2);

    console.log('[QRCodeGenerator] Flèche dessinée avec succès');
  } catch (error) {
    console.error('[QRCodeGenerator] Erreur lors du dessin de la flèche:', error);
  }
}

/**
 * Ajoute un QR code avec flèche dans le footer d'un PDF
 * @param doc - L'instance jsPDF
 * @param qrCodeDataUrl - L'image QR code en base64
 * @param cgvTextEndX - Position X de fin du texte des CGV
 * @param cgvTextY - Position Y du texte des CGV
 * @param pageWidth - Largeur de la page en mm
 */
export function addQRCodeWithArrowToPDF(
  doc: any,
  qrCodeDataUrl: string,
  cgvTextEndX: number,
  cgvTextY: number,
  pageWidth: number
): void {
  try {
    console.log('[QRCodeGenerator] Ajout du QR code avec flèche dans le PDF');

    // Taille du QR code en mm (environ 2.5 cm = 25 mm)
    const qrSize = 25;

    // Position du QR code (à droite avec une marge)
    const qrX = pageWidth - qrSize - 15; // 15mm de marge à droite
    const qrY = cgvTextY - 5; // Aligné avec le début du texte CGV, légèrement au-dessus

    // Position de la flèche
    const arrowStartX = cgvTextEndX + 5; // 5mm après le texte
    const arrowEndX = qrX - 5; // 5mm avant le QR code
    const arrowY = cgvTextY + 5; // Centre vertical de la flèche

    // Dessiner la flèche si il y a assez d'espace
    if (arrowEndX > arrowStartX) {
      drawArrowToPDF(doc, arrowStartX, arrowY, arrowEndX);
    }

    // Ajouter le QR code
    doc.addImage(qrCodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    console.log('[QRCodeGenerator] QR code et flèche ajoutés avec succès');
  } catch (error) {
    console.error('[QRCodeGenerator] Erreur lors de l\'ajout du QR code au PDF:', error);
  }
}
