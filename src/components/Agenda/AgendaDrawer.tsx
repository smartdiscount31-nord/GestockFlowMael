/**
 * AgendaDrawer - Drawer/Modal d'édition d'événement
 * Desktop: drawer latéral - Mobile: modale plein écran
 */

import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import type { AgendaEvent } from '../../pages/Agenda';
import { supabase } from '../../lib/supabase';

interface AgendaDrawerProps {
  event: AgendaEvent | null;
  isCreating: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function AgendaDrawer({ event, isCreating, onClose, onSave }: AgendaDrawerProps) {
  console.log('[AgendaDrawer] Ouverture', isCreating ? 'création' : 'édition', event?.id);

  // États du formulaire
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_date: '',
    event_time: '',
    source: 'roadmap' as 'roadmap' | 'rdv',
    status: 'a_faire' as 'a_faire' | 'en_cours' | 'fait' | 'vu',
    important: false,
    project: '',
    custom_reminders: ['24h', '2h', 'now']
  });

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialiser le formulaire
  useEffect(() => {
    if (event && !isCreating) {
      console.log('[AgendaDrawer] Chargement données événement');
      setFormData({
        title: event.title,
        description: event.description,
        event_date: event.event_date,
        event_time: event.event_time || '',
        source: event.source,
        status: event.status,
        important: event.important,
        project: event.project || '',
        custom_reminders: event.custom_reminders
      });
    } else {
      // Nouvelle création: date du jour par défaut
      const today = new Date().toISOString().split('T')[0];
      setFormData(prev => ({ ...prev, event_date: today }));
    }
  }, [event, isCreating]);

  // Handler de sauvegarde
  const handleSave = async () => {
    console.log('[AgendaDrawer] Sauvegarde...', formData);
    setSaving(true);
    setError(null);

    try {
      // Validation
      if (!formData.title.trim()) {
        throw new Error('Le titre est obligatoire');
      }
      if (!formData.event_date) {
        throw new Error('La date est obligatoire');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      const payload = {
        ...formData,
        project: formData.project.trim() || null
      };

      let url = '';
      let method = '';

      if (isCreating) {
        url = '/.netlify/functions/agenda-events-create';
        method = 'POST';
      } else {
        url = '/.netlify/functions/agenda-events-update';
        method = 'PUT';
        (payload as any).id = event!.id;
      }

      console.log('[AgendaDrawer] Requête:', method, url, payload);

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('[AgendaDrawer] Réponse status:', response.status);

      const responseText = await response.text();
      console.log('[AgendaDrawer] Réponse brute:', responseText.substring(0, 100));

      if (!response.ok) {
        console.error('[AgendaDrawer] Erreur HTTP:', response.status, responseText);
        let errorMessage = `Erreur ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = responseText.substring(0, 100);
        }
        throw new Error(errorMessage);
      }

      let result;
      try {
        result = JSON.parse(responseText);
        console.log('[AgendaDrawer] Sauvegarde réussie:', result);
      } catch (parseError: any) {
        console.error('[AgendaDrawer] Erreur parsing JSON:', parseError);
        throw new Error('Réponse invalide du serveur');
      }

      onSave();

    } catch (err: any) {
      console.error('[AgendaDrawer] Erreur sauvegarde:', err);
      setError(err.message || 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Handler de suppression
  const handleDelete = async () => {
    if (!event) return;

    const confirmed = window.confirm('Êtes-vous sûr de vouloir supprimer cet événement ?');
    if (!confirmed) return;

    console.log('[AgendaDrawer] Suppression événement:', event.id);
    setDeleting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      const response = await fetch(`/.netlify/functions/agenda-events-delete?id=${event.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[AgendaDrawer] Réponse suppression status:', response.status);

      const responseText = await response.text();
      console.log('[AgendaDrawer] Réponse suppression brute:', responseText.substring(0, 100));

      if (!response.ok) {
        console.error('[AgendaDrawer] Erreur suppression HTTP:', response.status, responseText);
        let errorMessage = `Erreur ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = responseText.substring(0, 100);
        }
        throw new Error(errorMessage);
      }

      console.log('[AgendaDrawer] Suppression réussie');
      onSave();

    } catch (err: any) {
      console.error('[AgendaDrawer] Erreur suppression:', err);
      setError(err.message || 'Erreur de suppression');
    } finally {
      setDeleting(false);
    }
  };

  // Gestion ESC pour fermer
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('[AgendaDrawer] ESC pressed, fermeture');
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
        aria-hidden="true"
      ></div>

      {/* Drawer/Modal */}
      <div
        className="fixed inset-y-0 right-0 sm:right-0 sm:w-[500px] w-full bg-white shadow-xl z-50 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 id="drawer-title" className="text-lg font-semibold text-gray-900">
            {isCreating ? 'Nouvel événement' : 'Modifier l\'événement'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulaire */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3 text-red-800 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Titre */}
            <div>
              <label htmlFor="event-title" className="block text-sm font-medium text-gray-700 mb-1">
                Titre <span className="text-red-500">*</span>
              </label>
              <input
                id="event-title"
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Réunion équipe, Appel client..."
                required
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="event-description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="event-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="Détails supplémentaires..."
              ></textarea>
            </div>

            {/* Type (Source) */}
            <div>
              <label htmlFor="event-source" className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, source: 'roadmap' })}
                  className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                    formData.source === 'roadmap'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  📌 Feuille de route
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, source: 'rdv' })}
                  className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                    formData.source === 'rdv'
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  📅 Rendez-vous
                </button>
              </div>
            </div>

            {/* Date et heure */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="event-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="event-date"
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="event-time" className="block text-sm font-medium text-gray-700 mb-1">
                  Heure
                </label>
                <input
                  id="event-time"
                  type="time"
                  value={formData.event_time}
                  onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Statut */}
            <div>
              <label htmlFor="event-status" className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                id="event-status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="a_faire">À faire</option>
                <option value="en_cours">En cours</option>
                <option value="fait">Fait</option>
                {formData.source === 'rdv' && <option value="vu">Vu</option>}
              </select>
            </div>

            {/* Projet */}
            <div>
              <label htmlFor="event-project" className="block text-sm font-medium text-gray-700 mb-1">
                Projet / Catégorie
              </label>
              <input
                id="event-project"
                type="text"
                value={formData.project}
                onChange={(e) => setFormData({ ...formData, project: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: App, IA, Formation, Smartdiscount..."
                list="project-suggestions"
              />
              <datalist id="project-suggestions">
                <option value="App" />
                <option value="IA" />
                <option value="Formation" />
                <option value="Smartdiscount" />
              </datalist>
            </div>

            {/* Événement important */}
            <div className="flex items-center gap-2">
              <input
                id="event-important"
                type="checkbox"
                checked={formData.important}
                onChange={(e) => setFormData({ ...formData, important: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="event-important" className="text-sm font-medium text-gray-700">
                Événement important (déclenche un popup de rappel)
              </label>
            </div>
          </div>
        </div>

        {/* Footer avec boutons */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          {!isCreating && (
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 size={16} />
              {deleting ? 'Suppression...' : 'Supprimer'}
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              disabled={saving || deleting}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annuler
            </button>

            <button
              onClick={handleSave}
              disabled={saving || deleting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save size={16} />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
