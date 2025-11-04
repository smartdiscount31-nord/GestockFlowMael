/**
 * CustomerList Component
 * Displays list of customers + actions (Nouveau, Import CSV, Sample)
 * - Import CSV basé sur PapaParse
 * - Progression via useCSVImport
 *
 * CSV attendu (en-têtes):
 * name,customer_group,email,phone,zone,siren,billing_line1,billing_line2,billing_zip,billing_city,billing_country,billing_region,shipping_same_as_billing,shipping_line1,shipping_line2,shipping_zip,shipping_city,shipping_country,shipping_region
 */

import React, { useRef } from 'react';
import Papa from 'papaparse';
import type { ParseResult } from 'papaparse';
import type { Customer } from '../../types/supabase';
import { supabase } from '../../lib/supabase';
import { useCSVImport } from '../../hooks/useCSVImport';

interface CustomerListProps {
  customers?: Customer[];
  onNew?: () => void;
  onEdit?: (id: string) => void;
  onView?: (id: string) => void;
}

type CsvRow = {
  [key: string]: string | undefined;
};

function toStr(v: any): string {
  return (v ?? '').toString().trim();
}
function toNull(v: any): string | null {
  const s = toStr(v);
  return s === '' ? null : s;
}
function toBool(v: any): boolean {
  const s = toStr(v).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'oui';
}
function normalizeGroup(v: any): 'pro' | 'particulier' {
  const s = toStr(v).toLowerCase();
  return s === 'pro' ? 'pro' : 'particulier';
}

export function CustomerList({ customers = [], onNew, onEdit, onView }: CustomerListProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { importState, startImport, incrementProgress, setImportSuccess, setImportError, closeDialog } = useCSVImport();

  const handleClickImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // reset value so selecting the same file again will trigger change
    e.currentTarget.value = '';
    if (!file) return;

    // Détection du séparateur (prend en charge , ; ou tab) et forçage des guillemets
    const head = await file.slice(0, 2048).text();
    const counts = {
      ',': (head.match(/,/g) || []).length,
      ';': (head.match(/;/g) || []).length,
      '\t': (head.match(/\t/g) || []).length,
    };
    let delimiter: ',' | ';' | '\t' = ',';
    if (counts[';'] >= counts[','] && counts[';'] >= counts['\t']) {
      delimiter = ';';
    } else if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';']) {
      delimiter = '\t';
    }

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      delimiter,
      quoteChar: '"',
      escapeChar: '"',
      complete: async (results: ParseResult<CsvRow>) => {
        const rows: CsvRow[] = ((results.data as CsvRow[]) || []).filter((r: CsvRow) => Object.keys(r || {}).length > 0);
        if (rows.length === 0) {
          setImportError([{ line: 0, message: 'Fichier vide ou en-têtes introuvables.' }]);
          return;
        }

        startImport(rows.length, 'Import des clients…');

        const errors: { line: number; message: string }[] = [];
        let processed = 0;

        for (let i = 0; i < rows.length; i++) {
          const lineNo = i + 2; // 1 header + 1-based
          const r: CsvRow = rows[i] || {};

          try {
            // Extract client
            const name = toStr(r['name']);
            const customer_group = normalizeGroup(r['customer_group']);
            if (!name) {
              errors.push({ line: lineNo, message: "Champ 'name' manquant." });
              incrementProgress();
              continue;
            }

            // Insert client
            const customerInsert: any = {
              name,
              email: toNull(r['email']),
              phone: toNull(r['phone']),
              customer_group,
              zone: toNull(r['zone']),
              siren: toNull(r['siren']),
            };

            const { data: cust, error: e1 } = await supabase
              .from('customers')
              .insert([customerInsert])
              .select('id')
              .single();

            if (e1) {
              errors.push({ line: lineNo, message: `Insertion client: ${e1.message}` });
              incrementProgress();
              continue;
            }

            const customerId = (cust as any)?.id;

            // Billing address
            const billing_line1 = toStr(r['billing_line1']);
            if (billing_line1) {
              const billingAddress = {
                customer_id: customerId,
                address_type: 'billing',
                line1: billing_line1,
                line2: toNull(r['billing_line2']),
                zip: toNull(r['billing_zip']),
                city: toNull(r['billing_city']),
                country: toStr(r['billing_country']) || 'France',
                region: toNull(r['billing_region']),
                is_default: true,
              };
              const { error: e2 } = await supabase.from('customer_addresses').insert([billingAddress]);
              if (e2) {
                errors.push({ line: lineNo, message: `Adresse facturation: ${e2.message}` });
              }
            }

            // Shipping address
            const same = toBool(r['shipping_same_as_billing']);
            if (same && billing_line1) {
              const shippingAddress = {
                customer_id: customerId,
                address_type: 'shipping',
                line1: billing_line1,
                line2: toNull(r['billing_line2']),
                zip: toNull(r['billing_zip']),
                city: toNull(r['billing_city']),
                country: toStr(r['billing_country']) || 'France',
                region: toNull(r['billing_region']),
                is_default: true,
              };
              const { error: e3 } = await supabase.from('customer_addresses').insert([shippingAddress]);
              if (e3) {
                errors.push({ line: lineNo, message: `Adresse livraison (copie): ${e3.message}` });
              }
            } else {
              const shipping_line1 = toStr(r['shipping_line1']);
              if (shipping_line1) {
                const shippingAddress = {
                  customer_id: customerId,
                  address_type: 'shipping',
                  line1: shipping_line1,
                  line2: toNull(r['shipping_line2']),
                  zip: toNull(r['shipping_zip']),
                  city: toNull(r['shipping_city']),
                  country: toStr(r['shipping_country']) || 'France',
                  region: toNull(r['shipping_region']),
                  is_default: true,
                };
                const { error: e4 } = await supabase.from('customer_addresses').insert([shippingAddress]);
                if (e4) {
                  errors.push({ line: lineNo, message: `Adresse livraison: ${e4.message}` });
                }
              }
            }
          } catch (err: any) {
            errors.push({ line: lineNo, message: `Exception: ${err?.message || String(err)}` });
          } finally {
            processed += 1;
            incrementProgress();
          }
        }

        if (errors.length > 0) {
          setImportError(errors);
        } else {
          setImportSuccess(`Import terminé (${processed} clients).`);
        }
      },
      error: (error: any, _file: any) => {
        setImportError([{ line: 0, message: `Erreur de parsing CSV: ${error?.message || String(error)}` }]);
      },
    });
  };

  const sampleHref = '/samples/clients_import_sample.csv';

  return (
    <div className="space-y-4">
      {/* Actions header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clients</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Nouveau client
          </button>

          <button
            onClick={handleClickImport}
            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            title="Importer un fichier CSV"
          >
            Importer CSV
          </button>

          <a
            href={sampleHref}
            target="_blank"
            rel="noreferrer"
            download
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            title="Télécharger le sample CSV"
          >
            Sample CSV
          </a>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFileSelected}
          />
        </div>
      </div>

      {/* Progress / result panel */}
      {importState.isDialogOpen && (
        <div className="rounded-md border p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="font-medium">Import CSV</div>
            <button
              onClick={closeDialog}
              className="text-gray-600 hover:text-gray-900"
              title="Fermer"
            >
              ✕
            </button>
          </div>
          <div className="text-sm text-gray-700 mb-2">
            Statut: {importState.status} • {importState.current}/{importState.total}
          </div>
          {importState.successMessage && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2 mb-2">
              {importState.successMessage}
            </div>
          )}
          {importState.errors.length > 0 && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
              <div className="font-medium mb-1">Erreurs:</div>
              <ul className="list-disc pl-5 space-y-0.5">
                {importState.errors.map((e, idx) => (
                  <li key={idx}>
                    Ligne {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* List */}
      {customers.length === 0 ? (
        <div className="text-center py-12 bg-white border rounded-lg">
          <p className="text-gray-500 mb-3">Aucun client trouvé</p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={onNew}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Nouveau client
            </button>
            <button
              onClick={handleClickImport}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
            >
              Importer CSV
            </button>
            <a
              href={sampleHref}
              target="_blank"
              rel="noreferrer"
              download
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Sample CSV
            </a>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Nom</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Téléphone</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  onClick={() => onView?.(customer.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 text-sm text-gray-900">{customer.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{(customer as any).email || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{(customer as any).phone || '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onView?.(customer.id);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                        title="Voir"
                      >
                        Voir
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit?.(customer.id);
                        }}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Modifier"
                      >
                        Modifier
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
