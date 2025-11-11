import React, { useState, useEffect } from 'react';
import { useAppSettingsStore } from '../../store/appSettingsStore';
import { Save, RefreshCw, FileText, FileOutput } from 'lucide-react';

export const CreditNoteSettings: React.FC = () => {
  const { settings, isLoading, error, fetchSettings, updateSettings, clearError } = useAppSettingsStore();

  const [footerText, setFooterText] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ field: string; success: boolean } | null>(null);

  useEffect(() => {
    console.log('CreditNoteSettings component mounted, fetching settings...');
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setFooterText(settings.credit_note_footer_text || '');
      setTermsAndConditions(settings.credit_note_terms || '');
    }
  }, [settings]);

  const handleSaveFooterText = async () => {
    setIsSaving(true);
    clearError();

    try {
      console.log('[CreditNoteSettings] Saving credit note footer text...');
      await updateSettings('credit_note_footer_text', footerText || null);

      setSaveStatus({ field: 'footer', success: true });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Error saving credit note footer text:', err);
      setSaveStatus({ field: 'footer', success: false });
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTermsAndConditions = async () => {
    setIsSaving(true);
    clearError();

    try {
      console.log('[CreditNoteSettings] Saving credit note terms...');
      await updateSettings('credit_note_terms', termsAndConditions || null);

      setSaveStatus({ field: 'terms', success: true });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Error saving credit note terms:', err);
      setSaveStatus({ field: 'terms', success: false });
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Réglages Avoir</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => fetchSettings()}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full"
            title="Rafraîchir"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
        <p className="text-sm">
          <strong>Note:</strong> Ces paramètres sont spécifiques aux avoirs (credit notes).
          Si vous laissez ces champs vides, les paramètres généraux de facturation seront utilisés.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Footer Text Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <FileText size={20} className="mr-2 text-blue-600" />
              <h2 className="text-lg font-semibold">Texte de pied de page pour les avoirs</h2>
            </div>

            <p className="text-gray-600 mb-4">
              Ce texte apparaîtra en bas de tous vos avoirs. Si vous laissez ce champ vide,
              le texte de pied de page général sera utilisé.
            </p>

            <div className="mb-4">
              <textarea
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Exemple: Merci de votre compréhension. Cet avoir sera déduit de votre prochaine facture."
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveFooterText}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={isSaving}
              >
                <div className="flex items-center">
                  <Save size={18} className="mr-2" />
                  {isSaving && saveStatus?.field === 'footer' ? 'Enregistrement...' : 'Enregistrer'}
                </div>
              </button>
            </div>

            {saveStatus?.field === 'footer' && (
              <div className={`mt-2 text-sm ${saveStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                {saveStatus.success ? 'Texte de pied de page enregistré avec succès' : 'Erreur lors de l\'enregistrement du texte de pied de page'}
              </div>
            )}
          </div>

          {/* Terms and Conditions Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-4">
              <FileOutput size={20} className="mr-2 text-blue-600" />
              <h2 className="text-lg font-semibold">Conditions spécifiques aux avoirs</h2>
            </div>

            <p className="text-gray-600 mb-4">
              Ces conditions apparaîtront sur vos avoirs. Si vous laissez ce champ vide,
              les conditions générales de vente seront utilisées.
            </p>

            <div className="mb-4">
              <textarea
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Exemple: Cet avoir est valable 12 mois et peut être utilisé pour tout achat dans notre établissement."
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveTermsAndConditions}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={isSaving}
              >
                <div className="flex items-center">
                  <Save size={18} className="mr-2" />
                  {isSaving && saveStatus?.field === 'terms' ? 'Enregistrement...' : 'Enregistrer'}
                </div>
              </button>
            </div>

            {saveStatus?.field === 'terms' && (
              <div className={`mt-2 text-sm ${saveStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                {saveStatus.success ? 'Conditions enregistrées avec succès' : 'Erreur lors de l\'enregistrement des conditions'}
              </div>
            )}
          </div>

          {/* Preview Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Aperçu</h2>

            <div className="border rounded-lg p-6">
              <div className="flex justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">AVOIR</h2>
                  <p className="text-gray-600">N° EXEMPLE-AVOIR-2025-0001</p>
                  <p className="text-gray-600">Date: 01/01/2025</p>
                  <p className="text-gray-600">Facture: EXEMPLE-2025-0001</p>
                </div>
                <div className="text-right">
                  {settings?.logo_url && (
                    <img
                      src={settings.logo_url}
                      alt="Logo"
                      className="max-h-20 max-w-40 object-contain mb-2"
                    />
                  )}
                  <h3 className="font-bold text-lg">{settings?.company_name || 'Votre Entreprise'}</h3>
                  <p>{settings?.address_line1 || '123 Rue Exemple'}</p>
                  {settings?.address_line2 && <p>{settings.address_line2}</p>}
                  <p>{(settings?.zip || '75000')} {(settings?.city || 'Paris')}</p>
                  <p>{settings?.country || 'France'}</p>
                </div>
              </div>

              {/* Preview Footer */}
              <div className="text-center text-gray-500 text-sm mt-8 pt-8 border-t">
                {(footerText || settings?.footer_text) ? (
                  <p className="mb-2 whitespace-pre-line">{footerText || settings?.footer_text}</p>
                ) : (
                  <p className="mb-2">Merci pour votre confiance. Tous les prix sont en euros.</p>
                )}
                {(termsAndConditions || settings?.terms_and_conditions) ? (
                  <p className="whitespace-pre-line">{termsAndConditions || settings?.terms_and_conditions}</p>
                ) : (
                  <p>
                    Conditions générales de vente : Les produits restent la propriété de la société
                    jusqu'au paiement intégral.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
