import React from 'react';
import { supabase } from '../../lib/supabase';

type RefundAgg = {
  day: string;
  channel: 'amazon' | 'store';
  nb_refunds: number;
  amount_ttc: number;
  base_ht_rectifiee: number;
  tva_rectifiee: number;
  fees: number;
  net_after_fees: number;
};

type RefundRow = {
  id: string;
  processed_at: string;
  channel: 'amazon' | 'store';
  order_id: string | null;
  invoice_id: string | null;
  reason_code: string | null;
  refund_amount_gross: number;
  refund_taxable_base: number;
  refund_vat_amount: number;
  fees: number;
  source_event_id: string;
};

type InvoiceRef = { id: string; invoice_number: string | null };

function yyyyMmDd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function exportCSV<T extends object>(rows: T[], filename: string) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0] as any);
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [
    headers.join(';'),
    ...rows.map((r: any) => headers.map(h => escape(r[h])).join(';'))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function RefundsPage() {
  const [from, setFrom] = React.useState<string>(yyyyMmDd(startOfMonth()));
  const [to, setTo] = React.useState<string>(yyyyMmDd(new Date()));
  const [channel, setChannel] = React.useState<'all' | 'amazon' | 'store'>('all');

  const [aggs, setAggs] = React.useState<RefundAgg[]>([]);
  const [rows, setRows] = React.useState<(RefundRow & { invoice_no?: string | null; net?: number; regime?: string })[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1) Aggrégats par canal (vue)
      const aggQuery = supabase
        .from('refunds_by_channel')
        .select('*')
        .gte('day', from)
        .lte('day', to)
        .order('day', { ascending: true });
      const { data: aggData, error: aggErr } = await aggQuery;
      if (aggErr) throw aggErr;
      const aggFiltered = (aggData as any[] || []).filter((r) => channel === 'all' ? true : (r.channel === channel));
      setAggs(aggFiltered);

      // 2) Liste détaillée
      let listQuery = supabase
        .from('refunds')
        .select('id, processed_at, channel, order_id, invoice_id, reason_code, refund_amount_gross, refund_taxable_base, refund_vat_amount, fees, source_event_id')
        .gte('processed_at', from)
        .lte('processed_at', to)
        .order('processed_at', { ascending: false });
      if (channel !== 'all') {
        listQuery = listQuery.eq('channel', channel);
      }
      const { data: list, error: listErr } = await listQuery;
      if (listErr) throw listErr;

      const refunds: RefundRow[] = (list as any[]) || [];

      // 3) Enrichissements: invoice_no, regime (mix ou normal/margin selon refund_items), net
      const invoiceIds = Array.from(new Set(refunds.map(r => r.invoice_id).filter(Boolean))) as string[];
      let invMap: Record<string, string | null> = {};
      if (invoiceIds.length) {
        const { data: invs } = await supabase
          .from('invoices')
          .select('id, invoice_number')
          .in('id', invoiceIds);
        (invs as InvoiceRef[] || []).forEach(r => { invMap[r.id] = r.invoice_number || null; });
      }

      // Detect regime per refund via refund_items
      const refundIds = refunds.map(r => r.id);
      let regimeMap: Record<string, string> = {};
      if (refundIds.length) {
        const { data: items } = await supabase
          .from('refund_items')
          .select('refund_id, vat_regime')
          .in('refund_id', refundIds);
        const byRefund: Record<string, Set<string>> = {};
        (items as any[] || []).forEach((ri: any) => {
          const k = String(ri.refund_id);
          byRefund[k] = byRefund[k] || new Set<string>();
          if (ri.vat_regime) byRefund[k].add(String(ri.vat_regime));
        });
        Object.entries(byRefund).forEach(([rid, set]) => {
          regimeMap[rid] = set.size <= 1 ? (Array.from(set)[0] || '') : 'mix';
        });
      }

      const result = refunds.map(r => ({
        ...r,
        invoice_no: r.invoice_id ? (invMap[r.invoice_id] ?? null) : null,
        net: Number(r.refund_amount_gross || 0) - Number(r.fees || 0),
        regime: regimeMap[r.id] || ''
      }));

      setRows(result);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [from, to, channel]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Remboursements</h1>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Du</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Au</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Canal</label>
          <select value={channel} onChange={(e) => setChannel(e.target.value as any)} className="border rounded px-2 py-1">
            <option value="all">Tous</option>
            <option value="amazon">Amazon</option>
            <option value="store">Magasin</option>
          </select>
        </div>
        <button className="px-3 py-1.5 bg-blue-600 text-white rounded" onClick={reload}>Recharger</button>
        <button className="px-3 py-1.5 bg-gray-100 rounded border" onClick={() => exportCSV(rows, `refunds_${channel}_${from}_${to}.csv`)}>Export CSV</button>
      </div>

      {/* Synthèse par jour et canal */}
      <div className="bg-white rounded shadow p-3">
        <h3 className="font-medium mb-2">Synthèse par canal</h3>
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Jour</th>
                <th className="text-left px-3 py-2">Canal</th>
                <th className="text-right px-3 py-2">Nb refunds</th>
                <th className="text-right px-3 py-2">TTC</th>
                <th className="text-right px-3 py-2">Base HT</th>
                <th className="text-right px-3 py-2">TVA</th>
                <th className="text-right px-3 py-2">Frais</th>
                <th className="text-right px-3 py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {(aggs || []).map((r, idx) => (
                <tr key={`${r.day}-${r.channel}-${idx}`} className="border-t">
                  <td className="px-3 py-1.5">{r.day}</td>
                  <td className="px-3 py-1.5">{r.channel}</td>
                  <td className="px-3 py-1.5 text-right">{r.nb_refunds}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.amount_ttc || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.base_ht_rectifiee || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.tva_rectifiee || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.fees || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.net_after_fees || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tableau détaillé */}
      <div className="bg-white rounded shadow p-3">
        <h3 className="font-medium mb-2">Détails</h3>
        {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
        {loading && <div className="text-sm text-gray-500 mb-2">Chargement…</div>}
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Canal</th>
                <th className="text-left px-3 py-2">Order ID</th>
                <th className="text-left px-3 py-2">Facture</th>
                <th className="text-left px-3 py-2">Motif</th>
                <th className="text-right px-3 py-2">TTC</th>
                <th className="text-right px-3 py-2">Base HT</th>
                <th className="text-right px-3 py-2">TVA</th>
                <th className="text-left px-3 py-2">Régime</th>
                <th className="text-right px-3 py-2">Frais</th>
                <th className="text-right px-3 py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-1.5">{String(r.processed_at).slice(0, 10)}</td>
                  <td className="px-3 py-1.5">{r.channel}</td>
                  <td className="px-3 py-1.5">{r.order_id || ''}</td>
                  <td className="px-3 py-1.5">
                    {r.invoice_id ? (r.invoice_no || r.invoice_id.slice(0, 8) + '…') : ''}
                  </td>
                  <td className="px-3 py-1.5">{r.reason_code || ''}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.refund_amount_gross || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.refund_taxable_base || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.refund_vat_amount || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5">{r.regime || ''}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.fees || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.net || 0).toFixed(2)}</td>
                </tr>
              ))}
              {(!rows || rows.length === 0) && (
                <tr>
                  <td className="px-3 py-2 text-center text-gray-500" colSpan={11}>Aucun remboursement sur la période</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
