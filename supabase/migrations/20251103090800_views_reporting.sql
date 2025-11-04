-- 20251103_views_reporting.sql
-- Vues de reporting (filtre période à appliquer côté requête: WHERE day BETWEEN $from AND $to)

-- a) Ventes par régime de TVA (normal vs marge) – factures moins avoirs
-- Hypothèses:
-- - invoice_items.quantity, invoice_items.unit_price (TTC saisi) existent
-- - products.vat_type = 'normal' | 'margin'
-- - products.purchase_price_with_fees présent pour base marge
CREATE OR REPLACE VIEW public.sales_by_vat_regime AS
SELECT
  i.date_issued::date AS day,
  CASE WHEN (p.vat_type)::text ILIKE 'margin' THEN 'margin' ELSE 'normal' END AS vat_regime,
  SUM((ii.quantity)::numeric * (ii.unit_price)::numeric) AS gross_ttc,
  SUM(
    CASE WHEN (p.vat_type)::text ILIKE 'margin'
         THEN GREATEST(((ii.quantity)::numeric * (ii.unit_price)::numeric) - (COALESCE(p.purchase_price_with_fees,0)::numeric * (ii.quantity)::numeric), 0) / 1.2
         ELSE ((ii.quantity)::numeric * (ii.unit_price)::numeric) / 1.2
    END
  ) AS ht_base,
  SUM(
    CASE WHEN (p.vat_type)::text ILIKE 'margin'
         THEN (GREATEST(((ii.quantity)::numeric * (ii.unit_price)::numeric) - (COALESCE(p.purchase_price_with_fees,0)::numeric * (ii.quantity)::numeric), 0) / 1.2) * 0.20
         ELSE (((ii.quantity)::numeric * (ii.unit_price)::numeric) - ((ii.quantity)::numeric * (ii.unit_price)::numeric) / 1.2)
    END
  ) AS vat_amount,
  COUNT(DISTINCT i.id) AS doc_count
FROM public.invoices i
JOIN public.invoice_items ii ON ii.invoice_id = i.id
LEFT JOIN public.products p ON p.id = ii.product_id
WHERE i.status IN ('sent','paid','partial','late')
GROUP BY 1,2

UNION ALL

SELECT
  cn.date_issued::date AS day,
  CASE WHEN (p2.vat_type)::text ILIKE 'margin' THEN 'margin' ELSE 'normal' END AS vat_regime,
  -SUM((cni.qty)::numeric * (cni.unit_price)::numeric) AS gross_ttc,
  -SUM(
    CASE WHEN (p2.vat_type)::text ILIKE 'margin'
         THEN GREATEST(((cni.qty)::numeric * (cni.unit_price)::numeric) - (COALESCE(p2.purchase_price_with_fees,0)::numeric * (cni.qty)::numeric), 0) / 1.2
         ELSE ((cni.qty)::numeric * (cni.unit_price)::numeric) / 1.2
    END
  ) AS ht_base,
  -SUM(
    CASE WHEN (p2.vat_type)::text ILIKE 'margin'
         THEN (GREATEST(((cni.qty)::numeric * (cni.unit_price)::numeric) - (COALESCE(p2.purchase_price_with_fees,0)::numeric * (cni.qty)::numeric), 0) / 1.2) * 0.20
         ELSE (((cni.qty)::numeric * (cni.unit_price)::numeric) - ((cni.qty)::numeric * (cni.unit_price)::numeric) / 1.2)
    END
  ) AS vat_amount,
  COUNT(DISTINCT cn.id) AS doc_count
FROM public.credit_notes cn
JOIN public.credit_note_items cni ON cni.credit_note_id = cn.id
LEFT JOIN public.products p2 ON p2.id = cni.product_id
GROUP BY 1,2;


-- b) Ventes par type interne (document_type depuis billing_document_types)
CREATE OR REPLACE VIEW public.sales_by_type AS
SELECT
  i.date_issued::date AS day,
  COALESCE(dt.document_type, 'unknown') AS type_internal,
  SUM((ii.quantity)::numeric * (ii.unit_price)::numeric) AS gross_ttc,
  COUNT(DISTINCT i.id) AS doc_count
FROM public.invoices i
JOIN public.invoice_items ii ON ii.invoice_id = i.id
LEFT JOIN public.billing_document_types dt ON dt.id = i.document_type_id
WHERE i.status IN ('sent','paid','partial','late')
GROUP BY 1,2;


-- c) Refunds par canal (amazon|store)
CREATE OR REPLACE VIEW public.refunds_by_channel AS
SELECT
  r.processed_at::date AS day,
  r.channel,
  COUNT(*) AS nb_refunds,
  SUM(r.refund_amount_gross) AS amount_ttc,
  SUM(r.refund_taxable_base) AS base_ht_rectifiee,
  SUM(r.refund_vat_amount) AS tva_rectifiee,
  SUM(r.fees) AS fees,
  SUM(r.refund_amount_gross - r.fees) AS net_after_fees
FROM public.refunds r
GROUP BY 1,2;


-- d) Synthèse globale (Brut, Avoirs+Refunds, Net)
CREATE OR REPLACE VIEW public.sales_global_summary AS
WITH s AS (
  SELECT i.date_issued::date AS day, SUM((ii.quantity)::numeric * (ii.unit_price)::numeric) AS brut_ttc
  FROM public.invoices i
  JOIN public.invoice_items ii ON ii.invoice_id = i.id
  WHERE i.status IN ('sent','paid','partial','late')
  GROUP BY 1
), c AS (
  SELECT cn.date_issued::date AS day, SUM((cni.qty)::numeric * (cni.unit_price)::numeric) AS avoirs_ttc
  FROM public.credit_notes cn
  JOIN public.credit_note_items cni ON cni.credit_note_id = cn.id
  GROUP BY 1
), r AS (
  SELECT processed_at::date AS day, SUM(refund_amount_gross) AS refunds_ttc
  FROM public.refunds
  GROUP BY 1
)
SELECT
  d.day,
  COALESCE(s.brut_ttc,0) AS brut_ttc,
  COALESCE(c.avoirs_ttc,0) + COALESCE(r.refunds_ttc,0) AS avoirs_refunds_ttc,
  COALESCE(s.brut_ttc,0) - (COALESCE(c.avoirs_ttc,0) + COALESCE(r.refunds_ttc,0)) AS net_ttc
FROM (
  SELECT day FROM s
  UNION
  SELECT day FROM c
  UNION
  SELECT day FROM r
) d
LEFT JOIN s ON s.day = d.day
LEFT JOIN c ON c.day = d.day
LEFT JOIN r ON r.day = d.day;


-- Accès lecture (adapter selon vos rôles)
GRANT SELECT ON public.sales_by_vat_regime TO authenticated;
GRANT SELECT ON public.sales_by_type TO authenticated;
GRANT SELECT ON public.refunds_by_channel TO authenticated;
GRANT SELECT ON public.sales_global_summary TO authenticated;
