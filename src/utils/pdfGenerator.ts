import { jsPDF } from 'jspdf';
import { PDF_CONFIG, calculatePagination } from './pdfLayoutConfig';
import { InvoiceWithDetails, QuoteWithDetails, CreditNoteWithDetails, VatRegime } from '../types/billing';
import { generateCGVQRCode, addQRCodeWithArrowToPDF } from './qrCodeGenerator';

console.log('pdfGenerator.ts loaded');

/**
 * Convertit une URL d'image en Data URL avec ses dimensions
 */
async function loadImageAsDataUrl(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    console.log('Loading image from URL:', url);
    const response = await fetch(url);
    const blob = await response.blob();

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        // Créer une image pour obtenir les dimensions
        const img = new Image();
        img.onload = () => {
          console.log('Image loaded with dimensions:', img.width, 'x', img.height);
          resolve({ dataUrl, width: img.width, height: img.height });
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error loading image:', error);
    return null;
  }
}

/**
 * Calcule les dimensions du logo en préservant le ratio d'aspect
 */
function calculateLogoSize(originalWidth: number, originalHeight: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  console.log('Calculating logo size from:', originalWidth, 'x', originalHeight, 'max:', maxWidth, 'x', maxHeight);

  const aspectRatio = originalWidth / originalHeight;
  let width = maxWidth;
  let height = maxWidth / aspectRatio;

  // Si la hauteur dépasse le maximum, recalculer à partir de la hauteur
  if (height > maxHeight) {
    height = maxHeight;
    width = maxHeight * aspectRatio;
  }

  console.log('Logo size calculated:', width, 'x', height);
  return { width, height };
}

/**
 * Formate un montant en euros
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

/**
 * Formate une date
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR').format(date);
}

/**
 * Dessine l'en-tête du document
 */
function drawHeader(
  doc: jsPDF,
  type: 'invoice' | 'quote' | 'credit_note',
  documentNumber: string,
  dateIssued: string,
  dateDueOrExpiry: string,
  companyInfo: any,
  logoData: { dataUrl: string; width: number; height: number } | null
) {
  console.log('Drawing header for document type:', type);
  const { header, fonts } = PDF_CONFIG;

  // Logo à gauche avec préservation du ratio
  if (logoData) {
    try {
      const logoSize = calculateLogoSize(
        logoData.width,
        logoData.height,
        header.logo.maxWidth,
        header.logo.maxHeight
      );

      doc.addImage(
        logoData.dataUrl,
        'PNG',
        header.logo.x,
        header.logo.y,
        logoSize.width,
        logoSize.height
      );
      console.log('Logo added successfully with preserved aspect ratio');
    } catch (error) {
      console.error('Error adding logo:', error);
    }
  }

  // Centre : Titre et informations du document
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fonts.title);

  const title = type === 'invoice' ? 'FACTURE' : type === 'quote' ? 'DEVIS' : 'AVOIR';
  doc.text(title, header.center.x, header.center.titleY, { align: 'center' });

  doc.setFontSize(fonts.normal);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° ${documentNumber}`, header.center.x, header.center.numberY, { align: 'center' });
  doc.text(`Date: ${formatDate(dateIssued)}`, header.center.x, header.center.dateY, { align: 'center' });

  if (type === 'invoice') {
    doc.text(`Échéance: ${formatDate(dateDueOrExpiry)}`, header.center.x, header.center.dueY, { align: 'center' });
  } else if (type === 'quote') {
    doc.text(`Validité: ${formatDate(dateDueOrExpiry)}`, header.center.x, header.center.dueY, { align: 'center' });
  }

  // Droite : Informations de l'entreprise
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fonts.normal);
  let yPos = header.company.y;
  doc.text(companyInfo.company_name || 'SMARTDISCOUNT31', header.company.x, yPos);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fonts.small);
  yPos += header.company.lineHeight;

  if (companyInfo.address_line1) {
    doc.text(companyInfo.address_line1, header.company.x, yPos);
    yPos += header.company.lineHeight;
  }

  if (companyInfo.address_line2) {
    doc.text(companyInfo.address_line2, header.company.x, yPos);
    yPos += header.company.lineHeight;
  }

  if (companyInfo.zip && companyInfo.city) {
    doc.text(`${companyInfo.zip} ${companyInfo.city}`, header.company.x, yPos);
    yPos += header.company.lineHeight;
  }

  if (companyInfo.country) {
    doc.text(companyInfo.country, header.company.x, yPos);
    yPos += header.company.lineHeight;
  }

  if (companyInfo.siren) {
    doc.text(`SIREN: ${companyInfo.siren}`, header.company.x, yPos);
    yPos += header.company.lineHeight;
  }

  if (companyInfo.email) {
    doc.text(companyInfo.email, header.company.x, yPos);
    yPos += header.company.lineHeight;
  }

  if (companyInfo.phone) {
    doc.text(companyInfo.phone, header.company.x, yPos);
  }

  console.log('Header drawn successfully');
}

/**
 * Dessine la section client (3 colonnes)
 */
function drawClientSection(
  doc: jsPDF,
  customer: any,
  billingAddress: any,
  shippingAddress: any
) {
  console.log('Drawing client section');
  const { client, fonts } = PDF_CONFIG;

  // Colonne 1 : Informations client
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(client.labelFontSize);
  let yPos = client.y;
  doc.text('Client', client.col1X, yPos);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(client.contentFontSize);
  yPos += client.lineHeight + 1;

  if (customer?.name) {
    doc.setFont('helvetica', 'bold');
    doc.text(customer.name, client.col1X, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += client.lineHeight;
  }

  if (customer?.email) {
    doc.text(customer.email, client.col1X, yPos);
    yPos += client.lineHeight;
  }

  if (customer?.phone) {
    doc.text(customer.phone, client.col1X, yPos);
  }

  // Colonne 2 : Adresse de facturation
  if (billingAddress) {
    yPos = client.y;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(client.labelFontSize);
    doc.text('Adresse de facturation', client.col2X, yPos);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(client.contentFontSize);
    yPos += client.lineHeight + 1;

    if (billingAddress.line1) {
      doc.text(billingAddress.line1, client.col2X, yPos);
      yPos += client.lineHeight;
    }

    if (billingAddress.line2) {
      doc.text(billingAddress.line2, client.col2X, yPos);
      yPos += client.lineHeight;
    }

    if (billingAddress.zip && billingAddress.city) {
      doc.text(`${billingAddress.zip} ${billingAddress.city}`, client.col2X, yPos);
      yPos += client.lineHeight;
    }

    if (billingAddress.country) {
      doc.text(billingAddress.country, client.col2X, yPos);
    }
  }

  // Colonne 3 : Adresse de livraison
  if (shippingAddress) {
    yPos = client.y;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(client.labelFontSize);
    doc.text('Adresse de livraison', client.col3X, yPos);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(client.contentFontSize);
    yPos += client.lineHeight + 1;

    if (shippingAddress.line1) {
      doc.text(shippingAddress.line1, client.col3X, yPos);
      yPos += client.lineHeight;
    }

    if (shippingAddress.line2) {
      doc.text(shippingAddress.line2, client.col3X, yPos);
      yPos += client.lineHeight;
    }

    if (shippingAddress.zip && shippingAddress.city) {
      doc.text(`${shippingAddress.zip} ${shippingAddress.city}`, client.col3X, yPos);
      yPos += client.lineHeight;
    }

    if (shippingAddress.country) {
      doc.text(shippingAddress.country, client.col3X, yPos);
    }
  }

  console.log('Client section drawn successfully');
}

/**
 * Dessine l'en-tête du tableau des articles
 */
function drawTableHeader(doc: jsPDF, yPos: number, showVatColumn: boolean) {
  console.log('Drawing table header at y:', yPos, 'showVatColumn:', showVatColumn);
  const { table, colors } = PDF_CONFIG;
  const cols = showVatColumn ? table.columns : table.columnsNoVat;

  // Fond gris pour l'en-tête
  doc.setFillColor(...colors.tableHeader);
  doc.rect(PDF_CONFIG.margin.left, yPos, PDF_CONFIG.pageWidth - 2 * PDF_CONFIG.margin.left, table.headerHeight, 'F');

  // Bordure
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.3);
  doc.rect(PDF_CONFIG.margin.left, yPos, PDF_CONFIG.pageWidth - 2 * PDF_CONFIG.margin.left, table.headerHeight);

  // Texte des en-têtes
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(table.headerFontSize);
  doc.setTextColor(0, 0, 0);

  const headerY = yPos + table.headerHeight / 2 + 1.5;

  doc.text('DESCRIPTION', cols.description.x + table.padding, headerY);
  doc.text('QTÉ', cols.quantity.x + (cols.quantity.width / 2), headerY, { align: 'center' });

  if (showVatColumn) {
    doc.text('PRIX UNIT. HT', cols.unitPrice.x + (cols.unitPrice.width / 2), headerY, { align: 'center' });
    doc.text('TVA', cols.tax.x + (cols.tax.width / 2), headerY, { align: 'center' });
    doc.text('TOTAL HT', cols.total.x + (cols.total.width / 2), headerY, { align: 'center' });
  } else {
    doc.text('PRIX UNIT.', cols.unitPrice.x + (cols.unitPrice.width / 2), headerY, { align: 'center' });
    doc.text('TOTAL', cols.total.x + (cols.total.width / 2), headerY, { align: 'center' });
  }

  console.log('Table header drawn successfully');
}

/**
 * Dessine une ligne du tableau
 */
function drawTableRow(
  doc: jsPDF,
  yPos: number,
  item: any,
  showVatColumn: boolean
) {
  const { table, colors } = PDF_CONFIG;
  const cols = showVatColumn ? table.columns : table.columnsNoVat;

  // Bordure de ligne
  doc.setDrawColor(...colors.border);
  doc.setLineWidth(0.2);
  doc.line(PDF_CONFIG.margin.left, yPos + table.rowHeight, PDF_CONFIG.pageWidth - PDF_CONFIG.margin.right, yPos + table.rowHeight);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(table.contentFontSize);
  doc.setTextColor(0, 0, 0);

  const textY = yPos + table.rowHeight / 2 + 2;

  // Description (avec gestion du texte long)
  const descLines = doc.splitTextToSize(item.description || '', cols.description.width - 2 * table.padding);
  doc.text(descLines[0] || '', cols.description.x + table.padding, textY);

  // Quantité
  doc.text(String(item.quantity || 0), cols.quantity.x + cols.quantity.width - table.padding, textY, { align: 'right' });

  // Prix unitaire
  doc.text(formatCurrency(item.unit_price || 0), cols.unitPrice.x + cols.unitPrice.width - table.padding, textY, { align: 'right' });

  // TVA (si affichée)
  if (showVatColumn) {
    doc.text(`${item.tax_rate || 0}%`, cols.tax.x + cols.tax.width - table.padding, textY, { align: 'right' });
  }

  // Total
  doc.text(formatCurrency(item.total_price || 0), cols.total.x + cols.total.width - table.padding, textY, { align: 'right' });
}

/**
 * Dessine le tableau des articles
 */
function drawItemsTable(
  doc: jsPDF,
  items: any[],
  startY: number,
  pageNum: number,
  totalPages: number,
  isFirstPage: boolean,
  showVatColumn: boolean
): number {
  console.log('Drawing items table, page:', pageNum, 'isFirstPage:', isFirstPage);
  const { table } = PDF_CONFIG;

  let currentY = startY;

  // En-tête du tableau
  drawTableHeader(doc, currentY, showVatColumn);
  currentY += table.headerHeight;

  // Lignes des articles
  items.forEach((item) => {
    drawTableRow(doc, currentY, item, showVatColumn);
    currentY += table.rowHeight;
  });

  // Bordure de fermeture du tableau
  doc.setDrawColor(...PDF_CONFIG.colors.border);
  doc.setLineWidth(0.3);
  doc.rect(
    PDF_CONFIG.margin.left,
    startY,
    PDF_CONFIG.pageWidth - 2 * PDF_CONFIG.margin.left,
    currentY - startY
  );

  console.log('Items table drawn, final Y:', currentY);
  return currentY;
}

/**
 * Dessine la section des totaux
 */
function drawTotals(
  doc: jsPDF,
  yPos: number,
  data: {
    total_ht: number;
    tva: number;
    total_ttc: number;
    amount_paid?: number;
    vat_regime?: string;
    legal_mention?: string;
  }
): number {
  console.log('Drawing totals at y:', yPos);
  const { totals, fonts } = PDF_CONFIG;
  const xStart = PDF_CONFIG.pageWidth - PDF_CONFIG.margin.right - totals.boxWidth;

  let currentY = yPos + 5;

  // Mention légale si présente
  if (data.legal_mention) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(fonts.tiny);
    const mentionLines = doc.splitTextToSize(data.legal_mention, totals.boxWidth + 30);
    doc.text(mentionLines, xStart - 30, currentY);
    currentY += mentionLines.length * 3 + 3;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(totals.fontSize);

  const vatRegime = data.vat_regime || 'normal';

  if (vatRegime === 'normal') {
    // Total HT
    doc.text('Total HT:', xStart, currentY);
    doc.text(formatCurrency(data.total_ht), xStart + totals.boxWidth, currentY, { align: 'right' });
    currentY += totals.lineHeight;

    // TVA
    doc.text('TVA:', xStart, currentY);
    doc.text(formatCurrency(data.tva), xStart + totals.boxWidth, currentY, { align: 'right' });
    currentY += totals.lineHeight;
  }

  // Total TTC
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(totals.totalFontSize);

  const totalLabel = vatRegime === 'normal' ? 'Total TTC:' : vatRegime === 'margin' ? 'Total TTC:' : 'Total:';
  doc.text(totalLabel, xStart, currentY);
  doc.text(formatCurrency(data.total_ttc), xStart + totals.boxWidth, currentY, { align: 'right' });
  currentY += totals.lineHeight + 2;

  // Montant payé (pour les factures)
  if (data.amount_paid && data.amount_paid > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(totals.fontSize);
    doc.setTextColor(0, 128, 0);

    doc.text('Montant payé:', xStart, currentY);
    doc.text(formatCurrency(data.amount_paid), xStart + totals.boxWidth, currentY, { align: 'right' });
    currentY += totals.lineHeight;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    const remaining = Math.max(0, data.total_ttc - data.amount_paid);
    doc.text('Reste à payer:', xStart, currentY);
    doc.text(formatCurrency(remaining), xStart + totals.boxWidth, currentY, { align: 'right' });
    currentY += totals.lineHeight;
  }

  doc.setTextColor(0, 0, 0);
  console.log('Totals drawn, final Y:', currentY);
  return currentY;
}

/**
 * Dessine le footer
 */
function drawFooter(
  doc: jsPDF,
  yPos: number,
  pageNum: number,
  totalPages: number,
  footerData: {
    bank_name?: string;
    bank_iban?: string;
    bank_bic?: string;
    footer_text?: string;
    terms_and_conditions?: string;
    cgv_qr_url?: string;
  }
) {
  console.log('Drawing footer at y:', yPos, 'page:', pageNum, '/', totalPages);
  const { footer, pagination, fonts, margin } = PDF_CONFIG;

  let currentY = yPos + 5;

  // Coordonnées bancaires (sur la dernière page seulement)
  if (pageNum === totalPages && (footerData.bank_name || footerData.bank_iban || footerData.bank_bic)) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fonts.small);
    doc.text('Coordonnées bancaires', margin.left, currentY);
    currentY += footer.lineHeight;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(footer.fontSize);

    if (footerData.bank_name) {
      doc.text(`Banque: ${footerData.bank_name}`, margin.left, currentY);
      currentY += footer.lineHeight;
    }

    if (footerData.bank_iban) {
      doc.text(`IBAN: ${footerData.bank_iban}`, margin.left, currentY);
      currentY += footer.lineHeight;
    }

    if (footerData.bank_bic) {
      doc.text(`BIC: ${footerData.bank_bic}`, margin.left, currentY);
      currentY += footer.lineHeight + 2;
    }
  }

  // Texte du footer (sur la dernière page seulement)
  if (pageNum === totalPages) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(footer.fontSize);

    if (footerData.footer_text) {
      const footerLines = doc.splitTextToSize(footerData.footer_text, PDF_CONFIG.pageWidth - 2 * margin.left);
      doc.text(footerLines, PDF_CONFIG.pageWidth / 2, currentY, { align: 'center' });
      currentY += footerLines.length * footer.lineHeight + 2;
    } else {
      doc.text('Merci pour votre confiance. Tous les prix sont en euros.', PDF_CONFIG.pageWidth / 2, currentY, { align: 'center' });
      currentY += footer.lineHeight + 2;
    }

    // Conditions générales
    if (footerData.terms_and_conditions) {
      const termsLines = doc.splitTextToSize(footerData.terms_and_conditions, PDF_CONFIG.pageWidth - 2 * margin.left);
      doc.text(termsLines, PDF_CONFIG.pageWidth / 2, currentY, { align: 'center' });
      currentY += termsLines.length * footer.lineHeight;
    }
  }

  // QR Code CGV (sur la dernière page seulement)
  if (pageNum === totalPages && footerData.cgv_qr_url) {
    console.log('Adding CGV QR code to footer');
    // Générer le QR code de manière asynchrone n'est pas possible ici
    // Le QR code sera ajouté dans la fonction principale avant l'appel à drawFooter
  }

  // Numéro de page (sur toutes les pages)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(pagination.fontSize);
  doc.text(`Page ${pageNum}/${totalPages}`, PDF_CONFIG.pageWidth / 2, pagination.y, { align: 'center' });

  console.log('Footer drawn successfully');
}

/**
 * Génère un PDF pour une facture
 */
export async function generateInvoicePDF(
  invoice: InvoiceWithDetails,
  companySettings: any,
  logoUrl?: string | null
): Promise<jsPDF> {
  console.log('Generating invoice PDF for:', invoice.invoice_number);

  const doc = new jsPDF({
    orientation: PDF_CONFIG.orientation,
    unit: PDF_CONFIG.unit,
    format: PDF_CONFIG.format,
  });

  // Charger le logo avec ses dimensions
  const logoData = logoUrl ? await loadImageAsDataUrl(logoUrl) : null;

  // Générer le QR code CGV si l'URL est définie
  let qrCodeDataUrl: string | null = null;
  if (companySettings.cgv_qr_url) {
    try {
      console.log('Generating CGV QR code for invoice PDF');
      qrCodeDataUrl = await generateCGVQRCode(companySettings.cgv_qr_url, 70);
    } catch (error) {
      console.error('Error generating CGV QR code:', error);
    }
  }

  // Calculer la pagination
  const items = invoice.items || [];
  const pagination = calculatePagination(items.length);
  console.log('Pagination calculated:', pagination);

  const showVatColumn = invoice.vat_regime === 'normal';

  let itemIndex = 0;

  for (let pageNum = 1; pageNum <= pagination.totalPages; pageNum++) {
    console.log('Drawing page:', pageNum);

    if (pageNum > 1) {
      doc.addPage();
    }

    const isFirstPage = pageNum === 1;

    // En-tête (sur la première page seulement)
    if (isFirstPage) {
      drawHeader(
        doc,
        'invoice',
        invoice.invoice_number,
        invoice.date_issued,
        invoice.date_due,
        companySettings,
        logoData
      );

      drawClientSection(
        doc,
        invoice.customer,
        invoice.billing_address_json,
        invoice.shipping_address_json
      );
    }

    // Tableau des articles
    const itemsOnThisPage = pagination.itemsPerPage[pageNum - 1];
    const itemsForThisPage = items.slice(itemIndex, itemIndex + itemsOnThisPage);
    itemIndex += itemsOnThisPage;

    const tableStartY = isFirstPage ? PDF_CONFIG.table.startY : PDF_CONFIG.margin.top;
    const tableEndY = drawItemsTable(
      doc,
      itemsForThisPage,
      tableStartY,
      pageNum,
      pagination.totalPages,
      isFirstPage,
      showVatColumn
    );

    // Totaux et footer (sur la dernière page seulement)
    if (pageNum === pagination.totalPages) {
      const totalsY = drawTotals(doc, tableEndY, {
        total_ht: invoice.total_ht,
        tva: invoice.tva,
        total_ttc: invoice.total_ttc,
        amount_paid: invoice.amount_paid,
        vat_regime: invoice.vat_regime,
        legal_mention: invoice.legal_mention,
      });

      drawFooter(doc, totalsY, pageNum, pagination.totalPages, {
        bank_name: companySettings.bank_name,
        bank_iban: companySettings.bank_iban,
        bank_bic: companySettings.bank_bic,
        footer_text: companySettings.footer_text,
        terms_and_conditions: companySettings.terms_and_conditions,
        cgv_qr_url: companySettings.cgv_qr_url,
      });

      // Ajouter le QR code CGV avec flèche si disponible
      if (qrCodeDataUrl) {
        try {
          console.log('Adding QR code with arrow to invoice PDF');
          // Position du texte CGV (approximative)
          const cgvTextEndX = PDF_CONFIG.pageWidth / 2 + 60; // Après le texte centré
          const cgvTextY = totalsY + 20; // Position approximative du texte CGV
          addQRCodeWithArrowToPDF(doc, qrCodeDataUrl, cgvTextEndX, cgvTextY, PDF_CONFIG.pageWidth);
        } catch (error) {
          console.error('Error adding QR code to PDF:', error);
        }
      }
    } else {
      // Numéro de page seulement
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(PDF_CONFIG.pagination.fontSize);
      doc.text(`Page ${pageNum}/${pagination.totalPages}`, PDF_CONFIG.pageWidth / 2, PDF_CONFIG.pagination.y, { align: 'center' });
    }
  }

  console.log('Invoice PDF generated successfully');
  return doc;
}

/**
 * Génère un PDF pour un devis
 */
export async function generateQuotePDF(
  quote: any,
  companySettings: any,
  logoUrl?: string | null
): Promise<jsPDF> {
  console.log('Generating quote PDF for:', quote.quote_number);

  const doc = new jsPDF({
    orientation: PDF_CONFIG.orientation,
    unit: PDF_CONFIG.unit,
    format: PDF_CONFIG.format,
  });

  const logoData = logoUrl ? await loadImageAsDataUrl(logoUrl) : null;

  // Générer le QR code CGV si l'URL est définie
  let qrCodeDataUrl: string | null = null;
  if (companySettings.cgv_qr_url) {
    try {
      console.log('Generating CGV QR code for quote PDF');
      qrCodeDataUrl = await generateCGVQRCode(companySettings.cgv_qr_url, 70);
    } catch (error) {
      console.error('Error generating CGV QR code:', error);
    }
  }

  const items = quote.items || [];
  const pagination = calculatePagination(items.length);
  console.log('Pagination calculated:', pagination);

  const showVatColumn = true; // Les devis affichent toujours la TVA

  let itemIndex = 0;

  for (let pageNum = 1; pageNum <= pagination.totalPages; pageNum++) {
    console.log('Drawing page:', pageNum);

    if (pageNum > 1) {
      doc.addPage();
    }

    const isFirstPage = pageNum === 1;

    if (isFirstPage) {
      drawHeader(
        doc,
        'quote',
        quote.quote_number,
        quote.date_issued,
        quote.date_expiry,
        companySettings,
        logoData
      );

      drawClientSection(
        doc,
        quote.customer,
        quote.billing_address_json,
        quote.shipping_address_json
      );
    }

    const itemsOnThisPage = pagination.itemsPerPage[pageNum - 1];
    const itemsForThisPage = items.slice(itemIndex, itemIndex + itemsOnThisPage);
    itemIndex += itemsOnThisPage;

    const tableStartY = isFirstPage ? PDF_CONFIG.table.startY : PDF_CONFIG.margin.top;
    const tableEndY = drawItemsTable(
      doc,
      itemsForThisPage,
      tableStartY,
      pageNum,
      pagination.totalPages,
      isFirstPage,
      showVatColumn
    );

    if (pageNum === pagination.totalPages) {
      const totalsY = drawTotals(doc, tableEndY, {
        total_ht: quote.total_ht,
        tva: quote.tva,
        total_ttc: quote.total_ttc,
        vat_regime: 'normal',
      });

      drawFooter(doc, totalsY, pageNum, pagination.totalPages, {
        footer_text: companySettings.footer_text,
        terms_and_conditions: companySettings.terms_and_conditions,
        cgv_qr_url: companySettings.cgv_qr_url,
      });

      // Ajouter le QR code CGV avec flèche si disponible
      if (qrCodeDataUrl) {
        try {
          console.log('Adding QR code with arrow to quote PDF');
          const cgvTextEndX = PDF_CONFIG.pageWidth / 2 + 60;
          const cgvTextY = totalsY + 20;
          addQRCodeWithArrowToPDF(doc, qrCodeDataUrl, cgvTextEndX, cgvTextY, PDF_CONFIG.pageWidth);
        } catch (error) {
          console.error('Error adding QR code to PDF:', error);
        }
      }
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(PDF_CONFIG.pagination.fontSize);
      doc.text(`Page ${pageNum}/${pagination.totalPages}`, PDF_CONFIG.pageWidth / 2, PDF_CONFIG.pagination.y, { align: 'center' });
    }
  }

  console.log('Quote PDF generated successfully');
  return doc;
}

/**
 * Génère un PDF pour un avoir
 */
export async function generateCreditNotePDF(
  creditNote: any,
  companySettings: any,
  logoUrl?: string | null
): Promise<jsPDF> {
  console.log('Generating credit note PDF for:', creditNote.credit_note_number);

  const doc = new jsPDF({
    orientation: PDF_CONFIG.orientation,
    unit: PDF_CONFIG.unit,
    format: PDF_CONFIG.format,
  });

  const logoData = logoUrl ? await loadImageAsDataUrl(logoUrl) : null;

  // Générer le QR code CGV si l'URL est définie
  let qrCodeDataUrl: string | null = null;
  if (companySettings.cgv_qr_url) {
    try {
      console.log('Generating CGV QR code for credit note PDF');
      qrCodeDataUrl = await generateCGVQRCode(companySettings.cgv_qr_url, 70);
    } catch (error) {
      console.error('Error generating CGV QR code:', error);
    }
  }

  const items = creditNote.items || [];
  const pagination = calculatePagination(items.length);
  console.log('Pagination calculated:', pagination);

  const showVatColumn = true; // Les avoirs affichent toujours la TVA

  let itemIndex = 0;

  for (let pageNum = 1; pageNum <= pagination.totalPages; pageNum++) {
    console.log('Drawing page:', pageNum);

    if (pageNum > 1) {
      doc.addPage();
    }

    const isFirstPage = pageNum === 1;

    if (isFirstPage) {
      drawHeader(
        doc,
        'credit_note',
        creditNote.credit_note_number,
        creditNote.date_issued,
        creditNote.date_issued, // Pas de date d'échéance pour les avoirs
        companySettings,
        logoData
      );

      // Pour les avoirs, on affiche uniquement les infos client de base
      const customerInfo = creditNote.invoice?.customer || {};
      drawClientSection(
        doc,
        customerInfo,
        null,
        null
      );

      // Motif de l'avoir
      if (creditNote.reason) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(PDF_CONFIG.fonts.small);
        doc.text('Motif:', PDF_CONFIG.margin.left, PDF_CONFIG.client.y + PDF_CONFIG.client.height - 10);

        doc.setFont('helvetica', 'normal');
        const reasonLines = doc.splitTextToSize(creditNote.reason, PDF_CONFIG.pageWidth - 2 * PDF_CONFIG.margin.left);
        doc.text(reasonLines, PDF_CONFIG.margin.left, PDF_CONFIG.client.y + PDF_CONFIG.client.height - 6);
      }
    }

    const itemsOnThisPage = pagination.itemsPerPage[pageNum - 1];
    const itemsForThisPage = items.slice(itemIndex, itemIndex + itemsOnThisPage);
    itemIndex += itemsOnThisPage;

    const tableStartY = isFirstPage ? PDF_CONFIG.table.startY : PDF_CONFIG.margin.top;
    const tableEndY = drawItemsTable(
      doc,
      itemsForThisPage,
      tableStartY,
      pageNum,
      pagination.totalPages,
      isFirstPage,
      showVatColumn
    );

    if (pageNum === pagination.totalPages) {
      // Pour les avoirs, afficher simplement le total
      const xStart = PDF_CONFIG.pageWidth - PDF_CONFIG.margin.right - PDF_CONFIG.totals.boxWidth;
      let currentY = tableEndY + 5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(PDF_CONFIG.totals.totalFontSize);
      doc.text('Total de l\'avoir:', xStart, currentY);
      doc.text(formatCurrency(creditNote.total_amount), xStart + PDF_CONFIG.totals.boxWidth, currentY, { align: 'right' });

      drawFooter(doc, currentY + 5, pageNum, pagination.totalPages, {
        footer_text: companySettings.credit_note_footer_text || companySettings.footer_text,
        terms_and_conditions: companySettings.credit_note_terms || companySettings.terms_and_conditions,
        cgv_qr_url: companySettings.cgv_qr_url,
      });

      // Ajouter le QR code CGV avec flèche si disponible
      if (qrCodeDataUrl) {
        try {
          console.log('Adding QR code with arrow to credit note PDF');
          const cgvTextEndX = PDF_CONFIG.pageWidth / 2 + 60;
          const cgvTextY = currentY + 10;
          addQRCodeWithArrowToPDF(doc, qrCodeDataUrl, cgvTextEndX, cgvTextY, PDF_CONFIG.pageWidth);
        } catch (error) {
          console.error('Error adding QR code to PDF:', error);
        }
      }
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(PDF_CONFIG.pagination.fontSize);
      doc.text(`Page ${pageNum}/${pagination.totalPages}`, PDF_CONFIG.pageWidth / 2, PDF_CONFIG.pagination.y, { align: 'center' });
    }
  }

  console.log('Credit note PDF generated successfully');
  return doc;
}
