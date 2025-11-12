/**
 * Roadmap Settings Page
 * Configure reminders, Telegram bot (shared or personal)
 */

import React, { useState, useEffect } from 'react';
import { Bell, Bot, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import {
  getSettings,
  saveSettings,
  getTelegramConnectionInfo,
  testTelegram,
  setupPersonalTelegramBot,
  testPersonalTelegramBot,
  revokePersonalTelegramBot,
  switchTelegramMode,
} from '../../lib/roadmapApi';
import type { RoadmapSettings, TelegramConnectionInfo } from '../../types/roadmap';

export default function RoadmapSettings() {
  const [settings, setSettings] = useState<RoadmapSettings | null>(null);
  const [telegramInfo, setTelegramInfo] = useState<TelegramConnectionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Personal bot setup state
  const [botUsername, setBotUsername] = useState('');
  const [botToken, setBotToken] = useState('');
  const [setupStep, setSetupStep] = useState(1);

  console.log('[RoadmapSettings] Rendering');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    console.log('[RoadmapSettings] Loading data');
    setLoading(true);
    try {
      const [settingsData, infoData] = await Promise.all([
        getSettings(),
        getTelegramConnectionInfo(),
      ]);
      console.log('[RoadmapSettings] Data loaded:', { settingsData, infoData });

      if (!settingsData) {
        console.log('[RoadmapSettings] No settings found, provisioning defaults...');
        try {
          const created = await saveSettings({
            default_reminder_days: [],
            eod_hour: 20,
            telegram_enabled: false,
            telegram_mode: 'shared',
          });
          console.log('[RoadmapSettings] Defaults provisioned:', created);
          setSettings(created);
        } catch (provisionErr) {
          console.error('[RoadmapSettings] Provisioning failed:', provisionErr);
          setSettings(null);
        }
      } else {
        setSettings(settingsData);
      }

      setTelegramInfo(infoData);
    } catch (error) {
      console.error('[RoadmapSettings] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReminders = async () => {
    if (!settings) return;

    console.log('[RoadmapSettings] Saving reminder settings');
    setSaving(true);
    setMessage(null);

    try {
      await saveSettings({
        default_reminder_days: settings.default_reminder_days,
        eod_hour: settings.eod_hour,
      });
      setMessage({ type: 'success', text: 'Paramètres de rappels enregistrés' });
    } catch (error) {
      console.error('[RoadmapSettings] Error saving:', error);
      setMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSharedBot = async () => {
    console.log('[RoadmapSettings] Testing shared bot');
    setMessage(null);

    try {
      const result = await testTelegram();
      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.message,
      });
    } catch (error) {
      console.error('[RoadmapSettings] Error testing:', error);
      setMessage({ type: 'error', text: 'Erreur lors du test' });
    }
  };

  const handleToggleTelegram = async () => {
    if (!settings) return;

    console.log('[RoadmapSettings] Toggling Telegram');
    setSaving(true);
    setMessage(null);

    try {
      await saveSettings({
        telegram_enabled: !settings.telegram_enabled,
      });
      await loadData();
      setMessage({
        type: 'success',
        text: settings.telegram_enabled ? 'Telegram désactivé' : 'Telegram activé',
      });
    } catch (error) {
      console.error('[RoadmapSettings] Error toggling:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la modification' });
    } finally {
      setSaving(false);
    }
  };

  const handleSetupPersonalBot = async () => {
    console.log('[RoadmapSettings] Setting up personal bot');
    setMessage(null);

    if (!botUsername || !botToken) {
      setMessage({ type: 'error', text: 'Veuillez remplir tous les champs' });
      return;
    }

    setSaving(true);
    try {
      await setupPersonalTelegramBot(botUsername, botToken);
      await loadData();
      setSetupStep(2);
      setMessage({ type: 'success', text: 'Bot configuré ! Envoyez /start dans Telegram' });
    } catch (error) {
      console.error('[RoadmapSettings] Error setting up bot:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la configuration du bot' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestPersonalBot = async () => {
    console.log('[RoadmapSettings] Testing personal bot');
    setMessage(null);

    try {
      const result = await testPersonalTelegramBot();
      setMessage({
        type: result.success ? 'success' : 'error',
        text: result.message,
      });
    } catch (error) {
      console.error('[RoadmapSettings] Error testing:', error);
      setMessage({ type: 'error', text: 'Erreur lors du test' });
    }
  };

  const handleSwitchMode = async (mode: 'shared' | 'personal') => {
    console.log('[RoadmapSettings] Switching mode to:', mode);
    setMessage(null);
    setSaving(true);

    try {
      await switchTelegramMode(mode);
      await loadData();
      setMessage({
        type: 'success',
        text: `Mode basculé vers: ${mode === 'shared' ? 'Bot partagé' : 'Bot personnel'}`,
      });
    } catch (error: any) {
      console.error('[RoadmapSettings] Error switching mode:', error);
      setMessage({ type: 'error', text: error.message || 'Erreur lors du changement de mode' });
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeBot = async () => {
    if (!confirm('Êtes-vous sûr de vouloir révoquer ce bot ?')) return;

    console.log('[RoadmapSettings] Revoking personal bot');
    setMessage(null);
    setSaving(true);

    try {
      await revokePersonalTelegramBot();
      await loadData();
      setSetupStep(1);
      setBotUsername('');
      setBotToken('');
      setMessage({ type: 'success', text: 'Bot révoqué avec succès' });
    } catch (error) {
      console.error('[RoadmapSettings] Error revoking:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la révocation' });
    } finally {
      setSaving(false);
    }
  };

  const handleInitDefaults = async () => {
    try {
      setSaving(true);
      setMessage(null);
      console.log('[RoadmapSettings] Manual init defaults...');
      const created = await saveSettings({
        default_reminder_days: [],
        eod_hour: 20,
        telegram_enabled: false,
        telegram_mode: 'shared',
      });
      console.log('[RoadmapSettings] Manual defaults created:', created);
      setSettings(created);
      setMessage({ type: 'success', text: 'Paramètres initialisés' });
    } catch (e) {
      console.error('[RoadmapSettings] Manual provisioning failed:', e);
      setMessage({ type: 'error', text: 'Impossible d\'initialiser les paramètres' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Paramètres Feuille de route</h1>
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-700 mb-4">
            Aucun paramètre n’a été trouvé pour votre compte. Cliquez sur le bouton ci-dessous pour initialiser avec des valeurs par défaut.
          </p>
          <button
            onClick={handleInitDefaults}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Initialisation...' : 'Initialiser les paramètres'}
          </button>
        </div>
      </div>
    );
  }

  const activated = !!settings.telegram_enabled;
  const connected = !!telegramInfo?.chat_id;
  // Le test reste possible dès que Telegram est activé (même si non connecté, un message guidera l’utilisateur)
  const canTest = activated;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Paramètres Feuille de route</h1>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Reminders Section */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-5 h-5 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Rappels par défaut</h2>
          </div>
          <p className="text-sm text-gray-600">
            Configurez vos préférences de rappels pour les tâches et événements
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rappels avant événements (jours)
            </label>
            <div className="flex gap-3">
              {[1, 2, 3].map(day => (
                <label key={day} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.default_reminder_days.includes(day)}
                    onChange={(e) => {
                      const newDays = e.target.checked
                        ? [...settings.default_reminder_days, day]
                        : settings.default_reminder_days.filter(d => d !== day);
                      setSettings({ ...settings, default_reminder_days: newDays });
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">J-{day}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Heure du bilan quotidien
            </label>
            <input
              type="number"
              min="0"
              max="23"
              value={settings.eod_hour}
              onChange={(e) => setSettings({ ...settings, eod_hour: parseInt(e.target.value) })}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <span className="ml-2 text-sm text-gray-600">heures (0-23)</span>
          </div>

          <button
            onClick={handleSaveReminders}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Shared Bot Section */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-5 h-5 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Bot Telegram partagé (simple)</h2>
          </div>
          <p className="text-sm text-gray-600">
            Utilisez notre bot partagé pour recevoir vos notifications
          </p>
        </div>

        <div className="p-6 space-y-4">
          {/* Statuts clairs: Activation et Connexion */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">Activation</span>
              {activated ? (
                <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                  <CheckCircle className="w-5 h-5" /> Activé
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-gray-400 text-sm font-medium">
                  <XCircle className="w-5 h-5" /> Désactivé
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm text-gray-700">Connexion</span>
              {connected ? (
                <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium">
                  <CheckCircle className="w-5 h-5" /> Connecté
                </span>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 text-gray-400 text-sm font-medium">
                    <XCircle className="w-5 h-5" /> Non connecté
                  </span>
                  {telegramInfo?.shared_bot_url ? (
                    <a
                      href={telegramInfo.shared_bot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
                    >
                      Connecter
                    </a>
                  ) : (
                    <span className="text-xs text-gray-500">(lien indisponible)</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Lien de connexion si pas connecté et lien disponible */}
          

          {/* Alerte config manquante si pas de lien */}
          

          <div className="flex gap-3">
            <button
              onClick={handleToggleTelegram}
              disabled={saving}
              className={`px-4 py-2 rounded-lg transition-colors ${
                settings.telegram_enabled
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {settings.telegram_enabled ? 'Désactiver' : 'Activer'}
            </button>
            <button
              onClick={handleTestSharedBot}
              disabled={!canTest}
              title={
                !activated ? 'Activez Telegram pour tester' :
                !connected ? 'Connectez d\'abord Telegram via le lien' : ''
              }
              className={`px-4 py-2 rounded-lg transition-colors ${
                canTest ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Envoyer un test
            </button>
          </div>
        </div>
      </div>

      {/* Personal Bot Section */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-5 h-5 text-gray-700" />
            <h2 className="text-xl font-semibold text-gray-900">Mon bot personnel (avancé)</h2>
          </div>
          <p className="text-sm text-gray-600">
            Configurez votre propre bot Telegram pour plus de contrôle
          </p>
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                <strong>Attention:</strong> Le token de votre bot sera stocké de manière sécurisée côté serveur.
                Ne partagez jamais votre token avec d'autres personnes.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {setupStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom d'utilisateur du bot (ex: @monbot)
                </label>
                <input
                  type="text"
                  value={botUsername}
                  onChange={(e) => setBotUsername(e.target.value)}
                  placeholder="@monbot"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  inputMode="text"
                  name="tg-username"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Token du bot
                </label>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="none"
                  inputMode="text"
                  spellCheck={false}
                  name="tg-token"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSetupPersonalBot}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Configuration...' : 'Configurer le webhook'}
                </button>
                <button
                  type="button"
                  onClick={() => { setBotUsername(''); setBotToken(''); console.log('[RoadmapSettings] Cleared personal bot inputs'); }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Effacer
                </button>
              </div>
            </div>
          )}

          {setupStep >= 2 && telegramInfo?.personal_bot_url && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Statut</span>
                <span className={`text-sm font-medium ${
                  telegramInfo.personal_bot_status === 'active' ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {telegramInfo.personal_bot_status === 'active' ? 'Actif' : 'En attente'}
                </span>
              </div>

              {telegramInfo.personal_bot_status !== 'active' && (
                <a
                  href={telegramInfo.personal_bot_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Lier mon chat
                </a>
              )}

              {telegramInfo.personal_bot_status === 'active' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSwitchMode('personal')}
                    disabled={saving || telegramInfo.mode === 'personal'}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {telegramInfo.mode === 'personal' ? 'Activé' : 'Utiliser mon bot'}
                  </button>
                  <button
                    onClick={handleTestPersonalBot}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Tester
                  </button>
                  <button
                    onClick={handleRevokeBot}
                    disabled={saving}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                  >
                    Révoquer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
