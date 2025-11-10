// Utilities for pricing and margins formatting

// Compute margin percentage according to VAT mode
// - normal: sale is HT for computation => (saleHT - purchaseHT) / purchaseHT * 100
// - margin (TVA sur marge): ((sale - purchase) / 1.2) / purchase * 100
export function getMarginPct(
  purchase: number | null | undefined,
  sale: number | null | undefined,
  vatType: 'normal' | 'margin'
): number {
  const p = typeof purchase === 'number' ? purchase : Number(purchase) || 0;
  const s = typeof sale === 'number' ? sale : Number(sale) || 0;
  if (!(p > 0) || !(s > 0)) return 0;

  if (vatType === 'margin') {
    const num = (s - p) / 1.2; // remove 20% VAT from the delta for TVM
    const pct = (num / p) * 100;
    return Number.isFinite(pct) ? pct : 0;
  }
  const pct = ((s - p) / p) * 100;
  return Number.isFinite(pct) ? pct : 0;
}

// Small formatter: keep 1 decimal if abs(value) < 100 else no decimals
export function formatPct(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(v);
  return abs < 100 ? v.toFixed(1) : Math.round(v).toString();
}
