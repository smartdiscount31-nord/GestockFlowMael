import React from 'react';
import { supabase } from '../../lib/supabase';

type VatRow = {
  day: string;
  vat_regime: 'normal' | 'margin';
  ht_base: number;
  vat_amount: number;
  gross_ttc: number;
  doc_count: number;
};

type GlobalRow = {
  day: string;
  brut_ttc: number;
  avoirs_refunds_ttc: number;
  net_ttc: number;
};

type TypeRow = {
  day: string;
  type_internal: string;
  gross_ttc: number;
  doc_count: number;
};

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

export default function SalesSummary() {
  const [from, setFrom] = React.useState<string>(yyyyMmDd(startOfMonth()));
  const [to, setTo] = React.useState<string>(yyyyMmDd(new Date()));
  const [active, setActive] = React.useState<'vat' | 'global' | 'type'>('vat');

  const [vatRows, setVatRows] = React.useState<VatRow[]>([]);
  const [globalRows, setGlobalRows] = React.useState<GlobalRow[]>([]);
  const [typeRows, setTypeRows] = React.useState<TypeRow[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (active === 'vat') {
        const { data, error } = await supabase
          .from('sales_by_vat_regime')
          .select('*')
          .gte('day', from)
          .lte('day', to)
          .order('day', { ascending: true });
        if (error) throw error;
        setVatRows((data as any[]) || []);
      } else if (active === 'global') {
        const { data, error } = await supabase
          .from('sales_global_summary')
          .select('*')
          .gte('day', from)
          .lte('day', to)
          .order('day', { ascending: true });
        if (error) throw error;
        setGlobalRows((data as any[]) || []);
      } else if (active === 'type') {
        const { data, error } = await supabase
          .from('sales_by_type')
          .select('*')
          .gte('day', from)
          .lte('day', to)
          .order('day', { ascending: true });
        if (error) throw error;
        setTypeRows((data as any[]) || []);
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, [active, from, to]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-semibold">Synthèse Ventes & TVA</h1>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Du</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Au</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border rounded px-2 py-1" />
        </div>
        <button className="px-3 py-1.5 bg-blue-600 text-white rounded" onClick={reload}>Recharger</button>
        {active === 'vat' && (
          <button className="px-3 py-1.5 bg-gray-100 rounded border" onClick={() => exportCSV(vatRows, `synthese_tva_${from}_${to}.csv`)}>Export CSV</button>
        )}
        {active === 'global' && (
          <button className="px-3 py-1.5 bg-gray-100 rounded border" onClick={() => exportCSV(globalRows, `synthese_globale_${from}_${to}.csv`)}>Export CSV</button>
        )}
        {active === 'type' && (
          <button className="px-3 py-1.5 bg-gray-100 rounded border" onClick={() => exportCSV(typeRows, `ventes_par_type_${from}_${to}.csv`)}>Export CSV</button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          className={`px-3 py-1.5 rounded border ${active === 'vat' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}
          onClick={() => setActive('vat')}
        >
          Synthèse TVA
        </button>
        <button
          className={`px-3 py-1.5 rounded border ${active === 'global' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}
          onClick={() => setActive('global')}
        >
          Global (Brut / Avoirs-Refunds / Net)
        </button>
        <button
          className={`px-3 py-1.5 rounded border ${active === 'type' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white'}`}
          onClick={() => setActive('type')}
        >
          Par type (vehicle/retail/repair/b2b)
        </button>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {loading && <div className="text-sm text-gray-500">Chargement…</div>}

      {active === 'vat' && (
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Jour</th>
                <th className="text-left px-3 py-2">Régime</th>
                <th className="text-right px-3 py-2">Base HT</th>
                <th className="text-right px-3 py-2">TVA</th>
                <th className="text-right px-3 py-2">TTC</th>
                <th className="text-right px-3 py-2">Docs</th>
              </tr>
            </thead>
            <tbody>
              {vatRows.map((r, idx) => (
                <tr key={`${r.day}-${r.vat_regime}-${idx}`} className="border-t">
                  <td className="px-3 py-1.5">{r.day}</td>
                  <td className="px-3 py-1.5">{r.vat_regime}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.ht_base || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.vat_amount || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.gross_ttc || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{r.doc_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active === 'global' && (
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Jour</th>
                <th className="text-right px-3 py-2">Brut TTC</th>
                <th className="text-right px-3 py-2">Avoirs + Refunds</th>
                <th className="text-right px-3 py-2">Net TTC</th>
              </tr>
            </thead>
            <tbody>
              {globalRows.map((r, idx) => (
                <tr key={`${r.day}-${idx}`} className="border-t">
                  <td className="px-3 py-1.5">{r.day}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.brut_ttc || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.avoirs_refunds_ttc || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.net_ttc || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {active === 'type' && (
        <div className="overflow-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Jour</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-right px-3 py-2">TTC</th>
                <th className="text-right px-3 py-2">Docs</th>
              </tr>
            </thead>
            <tbody>
              {typeRows.map((r, idx) => (
                <tr key={`${r.day}-${r.type_internal}-${idx}`} className="border-t">
                  <td className="px-3 py-1.5">{r.day}</td>
                  <td className="px-3 py-1.5">{r.type_internal}</td>
                  <td className="px-3 py-1.5 text-right">{Number(r.gross_ttc || 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{r.doc_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
