/**
 * Notifications Settings Page
 * Configuration des préférences de notifications utilisateur
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Bell, Clock, Calendar, Volume2, Mail, MessageSquare, Save, AlertCircle } from 'lucide-react';

interface NotificationSettings {
  daily_digest_hour: number;
  active_days: string[];
  enable_sound: boolean;
  enable_popup: boolean;
  enable_email: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  daily_digest_hour: 17,
  active_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  enable_sound: true,
  enable_popup: true,
  enable_email: true,
};

const WEEKDAYS = [
  { id: 'monday', label: 'Lundi', short: 'L' },
  { id: 'tuesday', label: 'Mardi', short: 'Ma' },
  { id: 'wednesday', label: 'Mercredi', short: 'Me' },
  { id: 'thursday', label: 'Jeudi', short: 'J' },
  { id: 'friday', label: 'Vendredi', short: 'V' },
  { id: 'saturday', label: 'Samedi', short: 'S' },
  { id: 'sunday', label: 'Dimanche', short: 'D' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function Notifications() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  console.log('[Notifications] Rendered, settings:', settings);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    console.log('[Notifications] Chargement des paramètres');
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      console.log('[Notifications] User ID:', user.id);

      const { data, error: fetchError } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('[Notifications] Erreur chargement:', fetchError);
        throw fetchError;
      }

      if (data) {
        console.log('[Notifications] Paramètres chargés:', data);
        setSettings({
          daily_digest_hour: data.daily_digest_hour,
          active_days: data.active_days,
          enable_sound: data.enable_sound,
          enable_popup: data.enable_popup,
          enable_email: data.enable_email,
        });
      } else {
        console.log('[Notifications] Aucun paramètre trouvé, utilisation des valeurs par défaut');
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (err: any) {
      console.error('[Notifications] Erreur:', err);
      setError(err.message || 'Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    console.log('[Notifications] Sauvegarde des paramètres:', settings);
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Utilisateur non authentifié');
      }

      const payload = {
        user_id: user.id,
        daily_digest_hour: settings.daily_digest_hour,
        active_days: settings.active_days,
        enable_sound: settings.enable_sound,
        enable_popup: settings.enable_popup,
        enable_email: settings.enable_email,
      };

      console.log('[Notifications] Payload:', payload);

      const { error: saveError } = await supabase
        .from('user_notification_settings')
        .upsert(payload, {
          onConflict: 'user_id',
        });

      if (saveError) {
        console.error('[Notifications] Erreur sauvegarde:', saveError);
        throw saveError;
      }

      console.log('[Notifications] Paramètres sauvegardés avec succès');
      setSuccess('Paramètres sauvegardés avec succès');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('[Notifications] Erreur:', err);
      setError(err.message || 'Erreur lors de la sauvegarde des paramètres');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (dayId: string) => {
    console.log('[Notifications] Toggle day:', dayId);
    setSettings((prev) => {
      const newDays = prev.active_days.includes(dayId)
        ? prev.active_days.filter((d) => d !== dayId)
        : [...prev.active_days, dayId];
      return { ...prev, active_days: newDays };
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Chargement des paramètres...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Bell size={32} className="text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Paramètres de Notifications</h1>
          </div>
          <p className="text-gray-600">
            Configurez vos préférences de notifications pour les rappels et alertes de l'atelier
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
            <Bell size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-600">{success}</p>
          </div>
        )}

        {/* Section: Digest Quotidien */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={24} className="text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Digest Quotidien</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Recevez un récapitulatif quotidien des pièces à commander pour les réparations en cours
          </p>

          <div className="space-y-6">
            {/* Heure du digest */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Heure du rappel quotidien
              </label>
              <select
                value={settings.daily_digest_hour}
                onChange={(e) => {
                  console.log('[Notifications] Heure changée:', e.target.value);
                  setSettings({ ...settings, daily_digest_hour: parseInt(e.target.value, 10) });
                }}
                className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {HOURS.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Le digest sera envoyé à cette heure les jours sélectionnés ci-dessous
              </p>
            </div>

            {/* Jours actifs */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                <Calendar size={18} className="inline mr-2" />
                Jours actifs
              </label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => {
                  const isActive = settings.active_days.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className={`
                        px-4 py-2 rounded-lg font-medium transition-all
                        ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }
                      `}
                    >
                      <span className="hidden md:inline">{day.label}</span>
                      <span className="md:hidden">{day.short}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Sélectionnez les jours où vous souhaitez recevoir le digest quotidien
              </p>
            </div>
          </div>
        </div>

        {/* Section: Canaux de Notification */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={24} className="text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Canaux de Notification</h2>
          </div>
          <p className="text-gray-600 mb-6">
            Choisissez comment vous souhaitez recevoir les notifications
          </p>

          <div className="space-y-4">
            {/* Activer son */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <Volume2 size={20} className="text-gray-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Notifications sonores</h3>
                  <p className="text-sm text-gray-600">
                    Jouer un son lors des nouvelles notifications
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enable_sound}
                  onChange={(e) => {
                    console.log('[Notifications] Son changé:', e.target.checked);
                    setSettings({ ...settings, enable_sound: e.target.checked });
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Activer popup */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-gray-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Notifications popup</h3>
                  <p className="text-sm text-gray-600">
                    Afficher des popups dans l'application
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enable_popup}
                  onChange={(e) => {
                    console.log('[Notifications] Popup changé:', e.target.checked);
                    setSettings({ ...settings, enable_popup: e.target.checked });
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Activer email */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-3">
                <Mail size={20} className="text-gray-600" />
                <div>
                  <h3 className="font-medium text-gray-900">Notifications email</h3>
                  <p className="text-sm text-gray-600">
                    Recevoir des emails pour les notifications importantes
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enable_email}
                  onChange={(e) => {
                    console.log('[Notifications] Email changé:', e.target.checked);
                    setSettings({ ...settings, enable_email: e.target.checked });
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Bouton de sauvegarde */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={20} />
            <span>{saving ? 'Sauvegarde en cours...' : 'Enregistrer les paramètres'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default Notifications;
