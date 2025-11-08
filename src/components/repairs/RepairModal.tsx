/**
 * RepairModal Component
 * Modal détaillée pour afficher et gérer un ticket de réparation
 */

import React, { useState, useEffect } from 'react';
import { X, Calendar, User, Package, Camera, Clock, FileText, Bell, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Toast } from '../Notifications/Toast';

interface Ticket {
  id: string;
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
  const [parts, setParts] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  console.log('[RepairModal] Opened for ticket:', ticket?.id);

  useEffect(() => {
    if (ticket) {
      loadTicketDetails();
    }
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

  if (!ticket) return null;

  const statusOptions = [
    { value: 'quote_todo', label: 'Devis à faire' },
    { value: 'parts_to_order', label: 'Pièces à commander' },
    { value: 'waiting_parts', label: 'Attente pièces' },
    { value: 'to_repair', label: 'À réparer' },
    { value: 'in_repair', label: 'En réparation' },
    { value: 'drying', label: 'Séchage' },
    { value: 'ready_to_return', label: 'Prêt à rendre' },
    { value: 'awaiting_customer', label: 'Attente client' },
    { value: 'delivered', label: 'Livré' },
    { value: 'archived', label: 'Archivé' },
  ];

  const lastReminder = reminders.find(r => !r.done);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-gray-900">Fiche de réparation #{ticket.id.substring(0, 8)}</h2>
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
                <p className="text-gray-700">{ticket.issue_description}</p>
              </div>
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
              </div>

              {lastReminder && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800">
                    Dernier rappel: {new Date(lastReminder.remind_at).toLocaleDateString('fr-FR')}
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">{lastReminder.message}</p>
                </div>
              )}
            </div>
          </div>

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
                      {entry.old_status} → {entry.new_status}
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
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Camera size={18} />
                Médias ({media.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {media.map((m) => (
                  <div key={m.id} className="relative">
                    {m.kind === 'photo' || m.kind === 'diagram' || m.kind === 'signature' ? (
                      <img
                        src={m.file_url}
                        alt={m.kind}
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
                      <p className="font-medium text-gray-900">{part.product?.name}</p>
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

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Bell size={18} />
                Rappels ({reminders.length})
              </h3>
              <button
                onClick={() => setShowReminderForm(!showReminderForm)}
                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                + Ajouter rappel
              </button>
            </div>

            {showReminderForm && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <textarea
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  placeholder="Message du rappel..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddReminder}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Enregistrer
                  </button>
                  <button
                    onClick={() => setShowReminderForm(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {reminders.map((reminder) => (
                <div key={reminder.id} className={`flex items-start gap-3 p-3 rounded-lg ${reminder.done ? 'bg-gray-50 opacity-60' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <input
                    type="checkbox"
                    checked={reminder.done}
                    onChange={() => handleMarkReminderDone(reminder.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(reminder.remind_at).toLocaleString('fr-FR')}
                    </p>
                    <p className="text-sm text-gray-700">{reminder.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

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
