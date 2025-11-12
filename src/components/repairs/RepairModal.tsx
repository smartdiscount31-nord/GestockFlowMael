/**
 * RepairModal Component
 * Modal détaillée pour afficher et gérer un ticket de réparation
 */

import React, { useState, useEffect } from 'react';
import { X, Calendar, User, Package, Camera, Clock, FileText, Bell, DollarSign } from 'lucide-react';
import PatternPreview from './PatternPreview';
import RepairMediaGallery from './RepairMediaGallery';
import { supabase } from '../../lib/supabase';
import { Toast } from '../Notifications/Toast';

interface Ticket {
  id: string;
  repair_number?: string; // numéro lisible humain ex: 101125-001
  created_at: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  device_brand: string;
  device_model: string;
  device_color?: string;
  imei?: string;
  serial_number?: string;
  pin_code?: string;
  issue_description: string;
  power_state: string;
  status: string;
  assigned_tech?: string;
  cgv_accepted_at?: string;
  signature_url?: string;
  invoice_id?: string;
}

interface RepairModalProps {
  ticket: Ticket | null;
  onClose: () => void;
  onStatusChange: () => void;
}

export function RepairModal({ ticket, onClose, onStatusChange }: RepairModalProps) {
  const [statusHistory, setStatusHistory] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const [parts, setParts] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  // Préselectionner le statut courant quand on ouvre la fiche
  useEffect(() => {
    if (ticket?.status) setSelectedStatus(ticket.status);
  }, [ticket]);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [newCallNote, setNewCallNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  console.log('[RepairModal] Opened for ticket:', ticket?.id);

  const editRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ticket) {
      loadTicketDetails();
      setIsEditing(true);
      setEdit({
        device_brand: ticket.device_brand,
        device_model: ticket.device_model,
        device_color: ticket.device_color || '',
        imei: ticket.imei || '',
        serial_number: ticket.serial_number || '',
        pin_code: ticket.pin_code || '',
        issue_description: ticket.issue_description || '',
        estimate_amount: undefined,
        assigned_tech: ticket.assigned_tech || '',
        power_state: ticket.power_state || ''
      });
    }
    // Scroll vers l'édition après un petit délai pour garantir le rendu
    setTimeout(() => {
      try { editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
    }, 150);
  }, [ticket]);

  const loadTicketDetails = async () => {
    if (!ticket) return;

    console.log('[RepairModal] Loading details for ticket:', ticket.id);

    try {
      const { data: historyData } = await supabase
        .from('repair_status_history')
        .select('*')
        .eq('repair_id', ticket.id)
        .order('changed_at', { ascending: false });

      console.log('[RepairModal] Status history loaded:', historyData?.length);
      setStatusHistory(historyData || []);

      const { data: mediaData } = await supabase
        .from('repair_media')
        .select('*')
        .eq('repair_id', ticket.id)
        .order('created_at', { ascending: false });

      console.log('[RepairModal] Media loaded:', mediaData?.length);
      setMedia(mediaData || []);

      const { data: partsData } = await supabase
        .from('repair_items')
        .select(`
          *,
          product:products(name, sku)
        `)
        .eq('repair_id', ticket.id);

      console.log('[RepairModal] Parts loaded:', partsData?.length);
      setParts(partsData || []);

      const { data: remindersData } = await supabase
        .from('repair_reminders')
        .select('*')
        .eq('repair_id', ticket.id)
        .order('remind_at', { ascending: false });

      console.log('[RepairModal] Reminders loaded:', remindersData?.length);
      setReminders(remindersData || []);

      // Historique des appels (nouvelle section)
      const { data: callsData } = await supabase
        .from('repair_call_logs')
        .select('*')
        .eq('repair_id', ticket.id)
        .order('created_at', { ascending: false });

      console.log('[RepairModal] Call logs loaded:', callsData?.length);
      setCallLogs(callsData || []);

      // Charger le prix de la prestation (estimate_amount)
      try {
        const { data: ticketRow } = await supabase
          .from('repair_tickets')
          .select('estimate_amount')
          .eq('id', ticket.id)
          .single();
        if (ticketRow) {
          setEdit((prev: any) => ({ ...(prev || {}), estimate_amount: ticketRow.estimate_amount ?? '' }));
        }
      } catch {}

    } catch (error) {
      console.error('[RepairModal] Error loading ticket details:', error);
    }
  };

  const handleStatusChange = async () => {
    if (!ticket || !selectedStatus) return;

    console.log('[RepairModal] Changing status from', ticket.status, 'to', selectedStatus);
    setIsChangingStatus(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session non disponible');

      const response = await fetch('/.netlify/functions/repairs-status-update', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repair_id: ticket.id,
          new_status: selectedStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erreur lors du changement de statut');
      }

      console.log('[RepairModal] Status changed successfully');
      setToast({ message: 'Statut mis à jour avec succès', type: 'success' });
      onStatusChange();
      setTimeout(() => onClose(), 1500);
    } catch (error: any) {
      console.error('[RepairModal] Error changing status:', error);
      setToast({ message: error.message, type: 'error' });
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!ticket) return;

    console.log('[RepairModal] Generating invoice for ticket:', ticket.id);
    setIsGeneratingInvoice(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session non disponible');

      const response = await fetch('/.netlify/functions/repairs-generate-invoice', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repair_id: ticket.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Erreur lors de la génération de la facture');
      }

      const result = await response.json();
      console.log('[RepairModal] Invoice generated:', result.data.invoice_id);
      setToast({ message: 'Facture générée avec succès', type: 'success' });

      sessionStorage.setItem('viewInvoiceId', result.data.invoice_id);
      if ((window as any).__setCurrentPage) {
        (window as any).__setCurrentPage('invoice-detail');
      }

      setTimeout(() => onClose(), 500);
    } catch (error: any) {
      console.error('[RepairModal] Error generating invoice:', error);
      setToast({ message: error.message, type: 'error' });
    } finally {
      setIsGeneratingInvoice(false);
    }
  };

  const handleAddReminder = async () => {
    if (!ticket || !reminderDate || !reminderTime || !reminderMessage) {
      setToast({ message: 'Veuillez remplir tous les champs', type: 'error' });
      return;
    }

    console.log('[RepairModal] Adding reminder');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const remindAt = new Date(`${reminderDate}T${reminderTime}`);

      const { error } = await supabase
        .from('repair_reminders')
        .insert({
          repair_id: ticket.id,
          remind_at: remindAt.toISOString(),
          message: reminderMessage,
          created_by: user?.id,
          done: false,
        });

      if (error) throw error;

      console.log('[RepairModal] Reminder added successfully');
      setToast({ message: 'Rappel ajouté avec succès', type: 'success' });
      setShowReminderForm(false);
      setReminderDate('');
      setReminderTime('');
      setReminderMessage('');
      loadTicketDetails();
    } catch (error: any) {
      console.error('[RepairModal] Error adding reminder:', error);
      setToast({ message: error.message, type: 'error' });
    }
  };

  const handleMarkReminderDone = async (reminderId: string) => {
    console.log('[RepairModal] Marking reminder as done:', reminderId);

    try {
      const { error } = await supabase
        .from('repair_reminders')
        .update({ done: true })
        .eq('id', reminderId);

      if (error) throw error;

      console.log('[RepairModal] Reminder marked as done');
      loadTicketDetails();
    } catch (error: any) {
      console.error('[RepairModal] Error marking reminder as done:', error);
      setToast({ message: error.message, type: 'error' });
    }
  };

  const handleSaveEdit = async () => {
    if (!ticket || !edit) return;
    try {
      const payload: any = {
        device_brand: edit.device_brand,
        device_model: edit.device_model,
        device_color: edit.device_color || null,
        imei: edit.imei || null,
        serial_number: edit.serial_number || null,
        pin_code: edit.pin_code || null,
        issue_description: edit.issue_description || '',
        assigned_tech: edit.assigned_tech || null,
        power_state: edit.power_state || null,
      };
      if (edit.estimate_amount !== undefined && edit.estimate_amount !== null && edit.estimate_amount !== '') {
        const n = Number(edit.estimate_amount);
        if (!Number.isNaN(n)) payload.estimate_amount = n; else payload.estimate_amount = null;
      }
      const { error } = await supabase.from('repair_tickets').update(payload).eq('id', ticket.id);
      if (error) throw error;
      setToast({ message: 'Fiche mise à jour', type: 'success' });
      setIsEditing(false);
      await loadTicketDetails();
      onStatusChange();
    } catch (e: any) {
      setToast({ message: e?.message || 'Erreur mise à jour', type: 'error' });
    }
  };

  if (!ticket) return null;

  const statusOptions = [
    { value: 'quote_todo', label: 'Devis à faire' },
    { value: 'parts_to_order', label: 'Pièces à commander' },
    { value: 'waiting_parts', label: 'Attente pièces' },
    { value: 'to_repair', label: 'À réparer' },
    { value: 'in_repair', label: 'En réparation' },
    { value: 'drying', label: 'Séchage' },
    { value: 'ready_to_return', label: 'Prêt à rendre' },
    { value: 'delivered', label: 'Livré' },
    { value: 'archived', label: 'Archivé' },
  ];



  // Extraction du pattern depuis la description (ex: "[Pattern: 0-7-8-4-5-1]")
  const parseDescription = (desc: string) => {
    if (!desc) return { cleaned: '', pattern: null as string | null };
    const m = desc.match(/\[(?:pattern|Pattern)\s*:\s*([^\]]+)\]/);
    const pattern = m ? m[1].trim() : null;
    const cleaned = m ? desc.replace(m[0], '').trim().replace(/\s{2,}/g, ' ') : desc;
    return { cleaned, pattern };
  };
  const { cleaned: issueText, pattern: issuePattern } = parseDescription(ticket.issue_description || '');

  // Mapping FR pour affichage des statuts
  const STATUS_LABELS: Record<string, string> = {
    quote_todo: 'Devis à faire',
    parts_to_order: 'Pièces à commander',
    waiting_parts: 'Attente pièces',
    to_repair: 'À réparer',
    in_repair: 'En réparation',
    drying: 'Séchage',
    ready_to_return: 'Prêt à rendre',
    awaiting_customer: 'Attente client',
    delivered: 'Livré',
    archived: 'Archivé',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">Fiche de réparation #{ticket.repair_number ? ticket.repair_number : ticket.id.substring(0, 8)}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fermer"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <User size={18} />
                  Client
                </h3>
                <p className="text-gray-700">{ticket.customer_name}</p>
                <p className="text-sm text-gray-600">{ticket.customer_phone}</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Package size={18} />
                  Appareil
                </h3>
                <p className="text-gray-700">{ticket.device_brand} {ticket.device_model}</p>
                {ticket.device_color && <p className="text-sm text-gray-600">Couleur: {ticket.device_color}</p>}
                {ticket.imei && <p className="text-sm text-gray-600">IMEI: {ticket.imei}</p>}
                {ticket.serial_number && <p className="text-sm text-gray-600">N° série: {ticket.serial_number}</p>}
                {ticket.pin_code && <p className="text-sm text-gray-600">Code PIN: {ticket.pin_code}</p>}
                <p className="text-sm text-gray-600">État: {ticket.power_state}</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Panne décrite</h3>
                <p className="text-gray-700">{issueText}</p>
                <p className="text-gray-900 mt-2">
                  <span className="text-sm text-gray-600">Prix de la prestation: </span>
                  <span className="font-semibold">
                    {(edit && edit.estimate_amount !== undefined && edit.estimate_amount !== null && edit.estimate_amount !== '')
                      ? `${Math.round(Number(edit.estimate_amount))} €`
                      : '—'}
                  </span>
                </p>
              </div>
              {issuePattern && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Schéma (Pattern)</h3>
                  <PatternPreview sequence={issuePattern} width={280} />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Calendar size={18} />
                  Dates
                </h3>
                <p className="text-sm text-gray-600">Créé le: {new Date(ticket.created_at).toLocaleString('fr-FR')}</p>
                {ticket.cgv_accepted_at && (
                  <p className="text-sm text-gray-600">CGV acceptées: {new Date(ticket.cgv_accepted_at).toLocaleString('fr-FR')}</p>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Prix de la prestation</h3>
                <p className="text-gray-700">{(edit && edit.estimate_amount !== undefined && edit.estimate_amount !== null && edit.estimate_amount !== '') ? `${Math.round(Number(edit.estimate_amount))} €` : '—'}</p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Actions</h3>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Changer le statut...</option>
                      {statusOptions.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleStatusChange}
                      disabled={!selectedStatus || isChangingStatus}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isChangingStatus ? 'Changement...' : 'Valider'}
                    </button>
                  </div>

                  {ticket.status === 'ready_to_return' && (
                    <button
                      onClick={handleGenerateInvoice}
                      disabled={isGeneratingInvoice}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <DollarSign size={18} />
                      {isGeneratingInvoice ? 'Génération...' : 'Générer facture'}
                    </button>
                  )}
                </div>
                <div>
                  <button
                    onClick={() => setIsEditing(v => !v)}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
                  >
                    {isEditing ? 'Fermer l’édition' : 'Modifier la fiche'}
                  </button>
                </div>
              </div>
            </div>

          {/* Bandeau mode édition */}
          {isEditing && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800 font-medium">Mode édition actif</p>
            </div>
          )}

          {/* Edition complète de la fiche */}
          {isEditing && edit && (
            <div ref={editRef} className="p-4 border border-gray-200 rounded-lg bg-white">
              <h3 className="font-semibold text-gray-900 mb-3">Édition de la fiche</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input className="px-3 py-2 border rounded" placeholder="Marque"
                  value={edit.device_brand} onChange={(e)=>setEdit({ ...edit, device_brand: e.target.value })} />
                <input className="px-3 py-2 border rounded" placeholder="Modèle"
                  value={edit.device_model} onChange={(e)=>setEdit({ ...edit, device_model: e.target.value })} />
                <input className="px-3 py-2 border rounded" placeholder="Couleur"
                  value={edit.device_color} onChange={(e)=>setEdit({ ...edit, device_color: e.target.value })} />
                <input className="px-3 py-2 border rounded" placeholder="IMEI"
                  value={edit.imei} onChange={(e)=>setEdit({ ...edit, imei: e.target.value })} />
                <input className="px-3 py-2 border rounded" placeholder="N° Série"
                  value={edit.serial_number} onChange={(e)=>setEdit({ ...edit, serial_number: e.target.value })} />
                <input className="px-3 py-2 border rounded" placeholder="Code PIN"
                  value={edit.pin_code} onChange={(e)=>setEdit({ ...edit, pin_code: e.target.value })} />
                <select className="px-3 py-2 border rounded" value={edit.power_state}
                  onChange={(e)=>setEdit({ ...edit, power_state: e.target.value })}>
                  <option value="">État d’alimentation…</option>
                  <option value="on">Allumé</option>
                  <option value="off">Éteint</option>
                  <option value="unknown">Inconnu</option>
                </select>
                <input className="px-3 py-2 border rounded" placeholder="Montant devis (€)"
                  value={edit.estimate_amount ?? ''} onChange={(e)=>setEdit({ ...edit, estimate_amount: e.target.value })} />
                <input className="px-3 py-2 border rounded md:col-span-2" placeholder="Technicien assigné"
                  value={edit.assigned_tech} onChange={(e)=>setEdit({ ...edit, assigned_tech: e.target.value })} />
                <textarea className="px-3 py-2 border rounded md:col-span-2" rows={3} placeholder="Description/Panne"
                  value={edit.issue_description} onChange={(e)=>setEdit({ ...edit, issue_description: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 mt-3">
                <button className="px-4 py-2 bg-gray-100 rounded" onClick={()=>setIsEditing(false)}>Annuler</button>
                <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={handleSaveEdit}>Enregistrer</button>
              </div>
            </div>
          )}

          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock size={18} />
              Historique des statuts
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {statusHistory.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {(STATUS_LABELS[entry.old_status] || entry.old_status)} → {(STATUS_LABELS[entry.new_status] || entry.new_status)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {new Date(entry.changed_at).toLocaleString('fr-FR')}
                    </p>
                    {entry.note && <p className="text-xs text-gray-500 mt-1">{entry.note}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {media.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Camera size={18} />
                  Médias ({media.length})
                </h3>
                <button
                  onClick={() => setShowGallery(true)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Voir la galerie
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {media.map((m) => (
                  <div key={m.id} className="relative cursor-zoom-in" onClick={() => setShowGallery(true)}>
                    {m.kind === 'photo' || m.kind === 'diagram' || m.kind === 'signature' ? (
                      <img
                        src={m.file_url}
                        alt={m.kind || 'media'}
                        loading="lazy"
                        onError={(e) => { try { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; } catch {} }}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200"
                      />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
                        <FileText size={32} className="text-gray-400" />
                      </div>
                    )}
                    <span className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                      {m.kind}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {parts.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Package size={18} />
                Pièces ({parts.length})
              </h3>
              <div className="space-y-2">
                {parts.map((part) => (
                  <div key={part.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        {part.product?.name}
                        {!part.product || !part.product?.sku ? (
                          <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-purple-100 text-purple-700 align-middle">Éphémère</span>
                        ) : null}
                      </p>
                      <p className="text-sm text-gray-600">
                        Quantité: {part.quantity} • {part.reserved ? '✅ Réservée' : '⚠️ À commander'}
                      </p>
                    </div>
                    {part.purchase_price && (
                      <p className="font-medium text-gray-900">{part.purchase_price.toFixed(2)} €</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <textarea
                value={newCallNote}
                onChange={(e) => setNewCallNote(e.target.value)}
                placeholder="Note (optionnelle)"
                className="w-full px-3 py-2 border border-blue-200 rounded-lg resize-none"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      await supabase.from('repair_call_logs').insert({
                        repair_id: ticket.id,
                        created_by: user?.id || null,
                        note: newCallNote || null,
                      });
                      setNewCallNote('');
                      loadTicketDetails();
                      onStatusChange();
                      setToast({ message: 'Appel enregistré', type: 'success' });
                    } catch (e: any) {
                      setToast({ message: e?.message || 'Erreur enregistrement appel', type: 'error' });
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Ajouter un suivi d’appel client
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {callLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(log.created_at).toLocaleString('fr-FR')}
                    </p>
                    {log.note && <p className="text-sm text-gray-700">{log.note}</p>}
                  </div>
                </div>
              ))}
              {callLogs.length === 0 && (
                <div className="text-sm text-gray-500">Aucun appel enregistré</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <RepairMediaGallery ticketId={ticket.id} isOpen={showGallery} onClose={() => setShowGallery(false)} />
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={3000}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
