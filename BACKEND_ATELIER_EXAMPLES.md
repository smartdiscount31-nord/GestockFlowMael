# Exemples d'Utilisation - Backend Atelier

Ce document fournit des exemples concrets d'appel aux fonctions backend du module Atelier.

## Configuration

```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const apiBase = `${SUPABASE_URL}/functions/v1`;

// Helper pour appeler les fonctions
async function callFunction(functionName: string, payload: any, token: string) {
  const response = await fetch(`${apiBase}/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Erreur inconnue');
  }

  return data;
}
```

---

## 1. Créer un ticket de prise en charge

```typescript
import { supabase } from './lib/supabase';

async function createRepairTicket(ticketData: {
  customer_id: string;
  device_brand: string;
  device_model: string;
  issue_description: string;
  power_state: 'ok' | 'lcd_off' | 'no_sign';
  photos?: File[];
  signature?: string; // Data URL from canvas
}) {
  // Obtenir le token
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');

  // Convertir les photos en base64
  const photosBase64 = await Promise.all(
    (ticketData.photos || []).map(async (file) => {
      const buffer = await file.arrayBuffer();
      return Buffer.from(buffer).toString('base64');
    })
  );

  // Convertir la signature (si data URL)
  let signatureBase64 = null;
  if (ticketData.signature?.startsWith('data:')) {
    signatureBase64 = ticketData.signature.split(',')[1];
  }

  const payload = {
    customer_id: ticketData.customer_id,
    device_brand: ticketData.device_brand,
    device_model: ticketData.device_model,
    device_color: ticketData.device_color,
    imei: ticketData.imei,
    serial_number: ticketData.serial_number,
    pin_code: ticketData.pin_code,
    issue_description: ticketData.issue_description,
    power_state: ticketData.power_state,
    cgv_accepted: true,
    signature_base64: signatureBase64,
    photos_base64: photosBase64
  };

  const result = await callFunction('repairs-create-intake', payload, session.access_token);

  console.log('Ticket créé:', result.data.ticket.id);
  return result.data;
}

// Utilisation
const ticket = await createRepairTicket({
  customer_id: 'customer-uuid',
  device_brand: 'Apple',
  device_model: 'iPhone 14 Pro',
  issue_description: 'Écran fissuré après chute',
  power_state: 'ok',
  photos: [photoFile1, photoFile2]
});
```

---

## 2. Attacher une pièce avec réservation de stock

```typescript
async function attachPartToTicket(
  repairId: string,
  productId: string,
  stockId: string,
  quantity: number
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');

  try {
    const result = await callFunction('repairs-attach-part', {
      repair_id: repairId,
      product_id: productId,
      stock_id: stockId,
      quantity: quantity,
      purchase_price: 85.50,
      vat_regime: 'normal'
    }, session.access_token);

    console.log('Pièce attachée et stock réservé:', result.data.reservation);
    return result.data;
  } catch (error: any) {
    if (error.message.includes('Stock insuffisant')) {
      // Proposer de commander la pièce
      console.warn('Stock insuffisant, basculer vers commande');
      throw error;
    }
    throw error;
  }
}

// Utilisation
try {
  await attachPartToTicket(
    'repair-uuid',
    'product-uuid',
    'stock-uuid',
    1
  );
} catch (error) {
  console.error('Erreur:', error);
  // Afficher modal pour commander la pièce
}
```

---

## 3. Marquer une pièce à commander

```typescript
async function markPartToOrder(
  repairId: string,
  productId: string,
  supplierName: string
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');

  const result = await callFunction('repairs-mark-to-order', {
    repair_id: repairId,
    product_id: productId,
    quantity: 1,
    supplier_name: supplierName,
    purchase_price: 85.50
  }, session.access_token);

  console.log('Pièce marquée à commander');
  return result.data;
}

// Utilisation
await markPartToOrder('repair-uuid', 'product-uuid', 'iFixit');
```

---

## 4. Commander des pièces en batch

```typescript
async function orderPartsBatch(orders: Array<{
  repair_id: string;
  product_id: string;
  supplier_name: string;
  expected_date: string;
  purchase_price: number;
  quantity?: number;
}>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');

  const result = await callFunction('repairs-order-batch', {
    items: orders
  }, session.access_token);

  console.log(`${result.data.success} pièces commandées sur ${result.data.processed}`);
  console.log(`Coût total estimé: ${result.data.total_cost_estimate}€`);

  return result.data;
}

// Utilisation - Commander toutes les pièces du jour
const ordersToday = [
  {
    repair_id: 'repair-1',
    product_id: 'product-a',
    supplier_name: 'iFixit',
    expected_date: '2024-12-15',
    purchase_price: 85.50,
    quantity: 1
  },
  {
    repair_id: 'repair-2',
    product_id: 'product-b',
    supplier_name: 'iFixit',
    expected_date: '2024-12-15',
    purchase_price: 45.00,
    quantity: 2
  }
];

const result = await orderPartsBatch(ordersToday);
```

---

## 5. Changer le statut d'un ticket

```typescript
async function updateTicketStatus(
  repairId: string,
  newStatus: string,
  note?: string
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');

  try {
    const result = await callFunction('repairs-status-update', {
      repair_id: repairId,
      new_status: newStatus,
      note: note
    }, session.access_token);

    console.log(result.data.message);
    return result.data;
  } catch (error: any) {
    if (error.message.includes('pièces ne sont pas encore réservées')) {
      alert('Impossible de changer le statut: toutes les pièces doivent être réservées');
    }
    throw error;
  }
}

// Utilisation
await updateTicketStatus(
  'repair-uuid',
  'ready_to_return',
  'Réparation terminée et testée'
);
```

---

## 6. Générer une facture

```typescript
async function generateInvoiceFromTicket(repairId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');

  const result = await callFunction('repairs-generate-invoice', {
    repair_id: repairId
  }, session.access_token);

  console.log('Facture créée:', result.data.invoice_id);
  console.log('URL:', result.data.invoice_url);

  // Rediriger vers la facture
  window.location.href = result.data.invoice_url;

  return result.data;
}

// Utilisation
const invoice = await generateInvoiceFromTicket('repair-uuid');
```

---

## 7. Générer les PDF du ticket

```typescript
async function generateTicketPDFs(repairId: string, format: 'a4' | 'dymo' | 'both' = 'both') {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');

  const result = await callFunction('repairs-ticket-pdf', {
    repair_id: repairId,
    format: format
  }, session.access_token);

  if (result.data.a4_pdf_url) {
    console.log('PDF A4:', result.data.a4_pdf_url);
    // Ouvrir dans un nouvel onglet
    window.open(result.data.a4_pdf_url, '_blank');
  }

  if (result.data.dymo_label_url) {
    console.log('Étiquette Dymo:', result.data.dymo_label_url);
    // Envoyer à l'imprimante Dymo
    printDymoLabel(result.data.dymo_label_url);
  }

  return result.data;
}

// Utilisation
await generateTicketPDFs('repair-uuid', 'both');
```

---

## 8. Archiver un ticket

```typescript
async function archiveTicket(repairId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Non authentifié');

  const result = await callFunction('repairs-archive', {
    repair_id: repairId
  }, session.access_token);

  console.log(result.data.message);
  console.log(`${result.data.reservations_released} réservations libérées`);

  return result.data;
}

// Utilisation (ADMIN uniquement)
await archiveTicket('repair-uuid');
```

---

## 9. Récupérer les compteurs du kanban

```typescript
async function getRepairCounts() {
  const { data, error } = await supabase.rpc('fn_repair_counts');

  if (error) throw error;

  // Convertir en objet pour faciliter l'accès
  const counts: Record<string, number> = {};
  data.forEach((row: any) => {
    counts[row.status] = row.count;
  });

  return counts;
}

// Utilisation
const counts = await getRepairCounts();
console.log('Devis à faire:', counts.quote_todo);
console.log('En réparation:', counts.in_repair);
```

---

## 10. Afficher les pièces à commander du jour

```typescript
async function getPartsToOrder() {
  const { data, error } = await supabase
    .from('repair_parts_to_order')
    .select('*')
    .order('expected_date', { ascending: true });

  if (error) throw error;

  // Grouper par fournisseur
  const bySupplier: Record<string, any[]> = {};
  data.forEach(part => {
    const supplier = part.supplier_name || 'Non défini';
    if (!bySupplier[supplier]) {
      bySupplier[supplier] = [];
    }
    bySupplier[supplier].push(part);
  });

  return { parts: data, bySupplier };
}

// Utilisation
const { parts, bySupplier } = await getPartsToOrder();
Object.entries(bySupplier).forEach(([supplier, parts]) => {
  console.log(`${supplier}: ${parts.length} pièces`);
});
```

---

## 11. Composant React - Modal de prise en charge

```tsx
import { useState } from 'react';
import { supabase } from './lib/supabase';

export function RepairIntakeModal({ customerId, onClose, onSuccess }: {
  customerId: string;
  onClose: () => void;
  onSuccess: (ticket: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    device_brand: '',
    device_model: '',
    device_color: '',
    imei: '',
    serial_number: '',
    pin_code: '',
    issue_description: '',
    power_state: 'ok' as 'ok' | 'lcd_off' | 'no_sign'
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [signature, setSignature] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non authentifié');

      // Convertir photos en base64
      const photosBase64 = await Promise.all(
        photos.map(async (file) => {
          const buffer = await file.arrayBuffer();
          return Buffer.from(buffer).toString('base64');
        })
      );

      const signatureBase64 = signature ? signature.split(',')[1] : null;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/repairs-create-intake`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customer_id: customerId,
          ...formData,
          cgv_accepted: true,
          signature_base64: signatureBase64,
          photos_base64: photosBase64
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Erreur');
      }

      onSuccess(result.data.ticket);
    } catch (error) {
      console.error('Erreur création ticket:', error);
      alert('Erreur lors de la création du ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal">
      <form onSubmit={handleSubmit}>
        <h2>Nouvelle Prise en Charge</h2>

        <input
          type="text"
          placeholder="Marque (ex: Apple)"
          value={formData.device_brand}
          onChange={e => setFormData({...formData, device_brand: e.target.value})}
          required
        />

        <input
          type="text"
          placeholder="Modèle (ex: iPhone 14 Pro)"
          value={formData.device_model}
          onChange={e => setFormData({...formData, device_model: e.target.value})}
          required
        />

        <textarea
          placeholder="Description du problème"
          value={formData.issue_description}
          onChange={e => setFormData({...formData, issue_description: e.target.value})}
          required
        />

        <select
          value={formData.power_state}
          onChange={e => setFormData({...formData, power_state: e.target.value as any})}
        >
          <option value="ok">Fonctionne</option>
          <option value="lcd_off">Écran éteint</option>
          <option value="no_sign">Aucun signe de vie</option>
        </select>

        <input
          type="file"
          multiple
          accept="image/*"
          onChange={e => setPhotos(Array.from(e.target.files || []))}
        />

        {/* Canvas pour signature */}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button type="submit" disabled={loading}>
            {loading ? 'Création...' : 'Créer le ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

---

## 12. Hook React - Gestion du kanban

```tsx
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

export function useRepairKanban() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const loadTickets = async () => {
    const { data, error } = await supabase
      .from('repair_tickets')
      .select(`
        *,
        customer:customers(id, name, phone),
        items:repair_items(
          id,
          quantity,
          reserved,
          product:products(id, name, sku)
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTickets(data);
    }
  };

  const loadCounts = async () => {
    const { data, error } = await supabase.rpc('fn_repair_counts');

    if (!error && data) {
      const countsObj: Record<string, number> = {};
      data.forEach((row: any) => {
        countsObj[row.status] = row.count;
      });
      setCounts(countsObj);
    }
  };

  const moveTicket = async (ticketId: string, newStatus: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/repairs-status-update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        repair_id: ticketId,
        new_status: newStatus
      })
    });

    if (response.ok) {
      await loadTickets();
      await loadCounts();
    }
  };

  useEffect(() => {
    Promise.all([loadTickets(), loadCounts()]).finally(() => setLoading(false));

    // Real-time subscriptions
    const ticketsSubscription = supabase
      .channel('repair_tickets_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'repair_tickets' }, () => {
        loadTickets();
        loadCounts();
      })
      .subscribe();

    return () => {
      ticketsSubscription.unsubscribe();
    };
  }, []);

  return { tickets, counts, loading, moveTicket, refresh: () => Promise.all([loadTickets(), loadCounts()]) };
}

// Utilisation
function KanbanBoard() {
  const { tickets, counts, loading, moveTicket } = useRepairKanban();

  if (loading) return <div>Chargement...</div>;

  return (
    <div className="kanban">
      <Column
        title="Devis à faire"
        count={counts.quote_todo || 0}
        tickets={tickets.filter(t => t.status === 'quote_todo')}
        onMove={moveTicket}
      />
      {/* Autres colonnes... */}
    </div>
  );
}
```

---

## Notes importantes

- Toujours vérifier que l'utilisateur est authentifié avant d'appeler les fonctions
- Gérer les erreurs 422 (stock insuffisant) en proposant de commander
- Gérer les erreurs 409 (contraintes métier) en affichant des messages clairs
- Les fonctions retournent toujours `{ ok: true/false, data/error }`
- Utiliser les subscriptions real-time Supabase pour mettre à jour le UI automatiquement
