/**
 * Configuration de mise en page pour la génération de PDFs
 * Toutes les mesures sont en millimètres (mm) pour jsPDF
 */

export const PDF_CONFIG = {
  // Format de page
  format: 'a4' as const,
  orientation: 'portrait' as const,
  unit: 'mm' as const,

  // Dimensions A4
  pageWidth: 210,
  pageHeight: 297,

  // Marges
  margin: {
    left: 10,
    right: 10,
    top: 10,
    bottom: 10,
  },

  // Zones de l'en-tête
  header: {
    height: 60,
    logo: {
      maxWidth: 50,
      maxHeight: 25,
      x: 10,
      y: 12,
    },
    center: {
      x: 105, // Centre de la page
      titleY: 18,
      numberY: 28,
      dateY: 35,
      dueY: 42,
    },
    company: {
      x: 155, // Début colonne droite
      y: 12,
      lineHeight: 4,
    },
  },

  // Section client (3 colonnes)
  client: {
    y: 75,
    height: 35,
    columnWidth: 63, // (210 - 2*10) / 3
    col1X: 10,  // Client info
    col2X: 73,  // Billing address
    col3X: 136, // Shipping address
    lineHeight: 4.5,
    labelFontSize: 9,
    contentFontSize: 9,
  },

  // Tableau des articles
  table: {
    startY: 115,
    headerHeight: 8,
    rowHeight: 8,
    headerFontSize: 8,
    contentFontSize: 9,
    padding: 2,
    columns: {
      description: { x: 10, width: 85 },
      quantity: { x: 95, width: 20, align: 'right' as const },
      unitPrice: { x: 115, width: 25, align: 'right' as const },
      tax: { x: 140, width: 20, align: 'right' as const },
      total: { x: 160, width: 40, align: 'right' as const },
    },
    // Colonnes sans TVA (margin/export)
    columnsNoVat: {
      description: { x: 10, width: 100 },
      quantity: { x: 110, width: 25, align: 'right' as const },
      unitPrice: { x: 135, width: 30, align: 'right' as const },
      total: { x: 165, width: 35, align: 'right' as const },
    },
  },

  // Section totaux
  totals: {
    boxWidth: 55,
    lineHeight: 6,
    fontSize: 10,
    totalFontSize: 12,
  },

  // Footer
  footer: {
    minHeight: 50,
    fontSize: 8,
    lineHeight: 4,
  },

  // Pagination
  pagination: {
    fontSize: 8,
    y: 290, // Près du bas de la page
  },

  // Tailles de police
  fonts: {
    title: 16,
    subtitle: 12,
    normal: 10,
    small: 9,
    tiny: 8,
  },

  // Couleurs
  colors: {
    primary: [0, 0, 0] as [number, number, number],
    secondary: [100, 100, 100] as [number, number, number],
    border: [200, 200, 200] as [number, number, number],
    tableHeader: [245, 245, 245] as [number, number, number],
  },
};

/**
 * Calcule le nombre d'articles qui peuvent tenir sur une page
 */
export function calculateItemsPerPage(isFirstPage: boolean): number {
  const availableHeight = isFirstPage
    ? PDF_CONFIG.pageHeight - PDF_CONFIG.table.startY - PDF_CONFIG.footer.minHeight - PDF_CONFIG.totals.lineHeight * 6
    : PDF_CONFIG.pageHeight - PDF_CONFIG.margin.top - PDF_CONFIG.table.headerHeight - PDF_CONFIG.footer.minHeight;

  return Math.floor(availableHeight / PDF_CONFIG.table.rowHeight);
}

/**
 * Calcule la pagination pour un nombre donné d'articles
 */
export function calculatePagination(itemCount: number): {
  totalPages: number;
  itemsPerPage: number[];
} {
  const firstPageCapacity = calculateItemsPerPage(true);
  const otherPageCapacity = calculateItemsPerPage(false);

  if (itemCount <= firstPageCapacity) {
    return {
      totalPages: 1,
      itemsPerPage: [itemCount],
    };
  }

  const remainingItems = itemCount - firstPageCapacity;
  const additionalPages = Math.ceil(remainingItems / otherPageCapacity);

  const itemsPerPage: number[] = [firstPageCapacity];
  let remaining = remainingItems;

  for (let i = 0; i < additionalPages; i++) {
    const itemsOnThisPage = Math.min(remaining, otherPageCapacity);
    itemsPerPage.push(itemsOnThisPage);
    remaining -= itemsOnThisPage;
  }

  return {
    totalPages: 1 + additionalPages,
    itemsPerPage,
  };
}
