import React, { useState, useEffect, useRef } from 'react';
import { useAppSettingsStore } from '../../store/appSettingsStore';
import { Save, Upload, RefreshCw, Image, FileText, CreditCard, FileOutput, Building2, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Disclosure } from '@headlessui/react';

export const InvoiceSettings: React.FC = () => {
  const { settings, isLoading, error, fetchSettings, updateSettings, uploadLogo, clearError } = useAppSettingsStore();
  
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('France');
  const [siren, setSiren] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [footerText, setFooterText] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [bankBic, setBankBic] = useState('');
  const [cgvQrUrl, setCgvQrUrl] = useState('https://smartdiscount31.com/');
  const [qrCodePreview, setQrCodePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ field: string; success: boolean } | null>(null);
  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    logo: false,
    company: false,
    footer: false,
    terms: false,
    qrcode: false,
    bank: false,
    preview: false
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = (section: string, isOpen: boolean) => {
    console.log(`[InvoiceSettings] Section "${section}" ${isOpen ? 'ouverte' : 'fermée'}`);
    setOpenSections(prev => ({ ...prev, [section]: isOpen }));
  };
  
  useEffect(() => {
    console.log('InvoiceSettings component mounted, fetching settings...');
    fetchSettings();
  }, [fetchSettings]);
  
  useEffect(() => {
    if (settings) {
      console.log('[InvoiceSettings] Loading settings:', settings);
      setLogoPreview(settings.logo_url || null);
      setCompanyName(settings.company_name || '');
      setAddressLine1(settings.address_line1 || '');
      setAddressLine2(settings.address_line2 || '');
      setZip(settings.zip || '');
      setCity(settings.city || '');
      setCountry(settings.country || 'France');
      setSiren(settings.siren || '');
      setEmail(settings.email || '');
      setPhone(settings.phone || '');
      setFooterText(settings.footer_text || '');
      setTermsAndConditions(settings.terms_and_conditions || '');
      setBankName(settings.bank_name || '');
      setBankIban(settings.bank_iban || '');
      setBankBic(settings.bank_bic || '');
      setCgvQrUrl(settings.cgv_qr_url || 'https://smartdiscount31.com/');
    }
  }, [settings]);

  // Generate QR code preview when URL changes
  useEffect(() => {
    const generateQRPreview = async () => {
      if (cgvQrUrl && cgvQrUrl.trim()) {
        try {
          const QRCode = await import('qrcode');
          const qrDataUrl = await QRCode.toDataURL(cgvQrUrl, {
            errorCorrectionLevel: 'M',
            margin: 1,
            width: 150
          });
          console.log('[InvoiceSettings] QR code preview generated for URL:', cgvQrUrl);
          setQrCodePreview(qrDataUrl);
        } catch (error) {
          console.error('[InvoiceSettings] Error generating QR preview:', error);
          setQrCodePreview(null);
        }
      } else {
        setQrCodePreview(null);
      }
    };

    generateQRPreview();
  }, [cgvQrUrl]);
  
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Preview the selected image
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };
  
  const handleLogoUpload = async () => {
    if (!fileInputRef.current?.files?.[0]) return;
    
    setIsSaving(true);
    clearError();
    
    try {
      const file = fileInputRef.current.files[0];
      await uploadLogo(file);
      
      // Show success status
      setSaveStatus({ field: 'logo', success: true });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Error uploading logo:', err);
      setSaveStatus({ field: 'logo', success: false });
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSaveFooterText = async () => {
    setIsSaving(true);
    clearError();
    
    try {
      await updateSettings('footer_text', footerText);
      
      // Show success status
      setSaveStatus({ field: 'footer', success: true });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Error saving footer text:', err);
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
      await updateSettings('terms_and_conditions', termsAndConditions);
      
      // Show success status
      setSaveStatus({ field: 'terms', success: true });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Error saving terms and conditions:', err);
      setSaveStatus({ field: 'terms', success: false });
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSaveCompanyInfo = async () => {
    setIsSaving(true);
    clearError();

    try {
      console.log('[InvoiceSettings] Saving company info:', {
        company_name: companyName,
        address_line1: addressLine1,
        address_line2: addressLine2 || null,
        zip,
        city,
        country,
        siren: siren || null,
        email: email || null,
        phone: phone || null
      });

      await updateSettings({
        company_name: companyName,
        address_line1: addressLine1,
        address_line2: addressLine2 || null,
        zip,
        city,
        country,
        siren: siren || null,
        email: email || null,
        phone: phone || null
      });

      // Show success status
      setSaveStatus({ field: 'company', success: true });
      setTimeout(() => setSaveStatus(null), 3000);
      console.log('[InvoiceSettings] Company info saved successfully');
    } catch (err) {
      console.error('[InvoiceSettings] Error saving company info:', err);
      setSaveStatus({ field: 'company', success: false });
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBankInfo = async () => {
    setIsSaving(true);
    clearError();

    try {
      console.log('[InvoiceSettings] Saving bank info:', {
        bank_name: bankName,
        bank_iban: bankIban,
        bank_bic: bankBic
      });

      await updateSettings({
        bank_name: bankName || null,
        bank_iban: bankIban || null,
        bank_bic: bankBic || null
      });

      // Show success status
      setSaveStatus({ field: 'bank', success: true });
      setTimeout(() => setSaveStatus(null), 3000);
      console.log('[InvoiceSettings] Bank info saved successfully');
    } catch (err) {
      console.error('[InvoiceSettings] Error saving bank info:', err);
      setSaveStatus({ field: 'bank', success: false });
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveCgvQrUrl = async () => {
    setIsSaving(true);
    clearError();

    try {
      console.log('[InvoiceSettings] Saving CGV QR URL:', cgvQrUrl);

      await updateSettings('cgv_qr_url', cgvQrUrl || 'https://smartdiscount31.com/');

      // Show success status
      setSaveStatus({ field: 'qrcode', success: true });
      setTimeout(() => setSaveStatus(null), 3000);
      console.log('[InvoiceSettings] CGV QR URL saved successfully');
    } catch (err) {
      console.error('[InvoiceSettings] Error saving CGV QR URL:', err);
      setSaveStatus({ field: 'qrcode', success: false });
      setTimeout(() => setSaveStatus(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="flex flex-col h-screen">
      <div className="flex-shrink-0 p-6 border-b bg-white">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Réglages Facture</h1>
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
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mt-4">
            {error}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center flex-1">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50" style={{ scrollbarWidth: 'thin' }}>
          {/* Logo Section */}
          <Disclosure>
            {({ open }) => (
              <>
                <Disclosure.Button
                  className="w-full bg-white rounded-lg shadow p-4 hover:bg-gray-50 transition-colors"
                  onClick={() => toggleSection('logo', !open)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Image size={20} className="mr-2 text-blue-600" />
                      <h2 className="text-lg font-semibold">Logo</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {!open && <span className="text-sm text-gray-500 hidden md:inline">Cliquer pour ouvrir les réglages du logo</span>}
                      {open ? <ChevronUp size={20} className="text-gray-600" /> : <ChevronDown size={20} className="text-gray-600" />}
                    </div>
                  </div>
                </Disclosure.Button>
                <Disclosure.Panel className="bg-white rounded-lg shadow p-6 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-gray-600 mb-4">
                  Téléchargez votre logo pour l'afficher sur vos documents (devis, factures, avoirs).
                </p>
                
                <div className="flex items-center space-x-4">
                  <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer">
                    <Upload size={18} />
                    Choisir un fichier
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </label>
                  
                  <button
                    type="button"
                    onClick={handleLogoUpload}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={!fileInputRef.current?.files?.[0] && !logoPreview}
                  >
                    <div className="flex items-center">
                      <Save size={18} className="mr-2" />
                      {isSaving && saveStatus?.field === 'logo' ? 'Enregistrement...' : 'Enregistrer'}
                    </div>
                  </button>
                </div>
                
                {saveStatus?.field === 'logo' && (
                  <div className={`mt-2 text-sm ${saveStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                    {saveStatus.success ? 'Logo enregistré avec succès' : 'Erreur lors de l\'enregistrement du logo'}
                  </div>
                )}
              </div>
              
              <div className="flex justify-center items-center border rounded-lg p-4 bg-gray-50 h-80">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-gray-400 text-center">
                    <Image size={48} className="mx-auto mb-2" />
                    <p>Aucun logo</p>
                  </div>
                )}
              </div>
            </div>
                </Disclosure.Panel>
              </>
            )}
          </Disclosure>

          {/* Company Information Section */}
          <Disclosure>
            {({ open }) => (
              <>
                <Disclosure.Button
                  className="w-full bg-white rounded-lg shadow p-4 hover:bg-gray-50 transition-colors"
                  onClick={() => toggleSection('company', !open)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Building2 size={20} className="mr-2 text-blue-600" />
                      <h2 className="text-lg font-semibold">Informations de la société</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {!open && <span className="text-sm text-gray-500 hidden md:inline">Ouvrir pour configurer les informations de la société</span>}
                      {open ? <ChevronUp size={20} className="text-gray-600" /> : <ChevronDown size={20} className="text-gray-600" />}
                    </div>
                  </div>
                </Disclosure.Button>
                <Disclosure.Panel className="bg-white rounded-lg shadow p-6 mt-2">
            <p className="text-gray-600 mb-4">
              Ces informations apparaîtront sous le logo sur vos documents (devis, factures, avoirs).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de la société <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Votre Entreprise"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse ligne 1 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123 Rue Exemple"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresse ligne 2
                </label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Bâtiment, appartement, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code postal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="75000"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ville <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Paris"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pays <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="France"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro SIREN
                </label>
                <input
                  type="text"
                  value={siren}
                  onChange={(e) => setSiren(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="123 456 789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email professionnel
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="contact@entreprise.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone professionnel
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="+33 1 23 45 67 89"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveCompanyInfo}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={isSaving || !companyName || !addressLine1 || !zip || !city || !country}
              >
                <div className="flex items-center">
                  <Save size={18} className="mr-2" />
                  {isSaving && saveStatus?.field === 'company' ? 'Enregistrement...' : 'Enregistrer'}
                </div>
              </button>
            </div>

            {saveStatus?.field === 'company' && (
              <div className={`mt-2 text-sm ${saveStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                {saveStatus.success ? 'Informations de la société enregistrées avec succès' : 'Erreur lors de l\'enregistrement des informations'}
              </div>
            )}
                </Disclosure.Panel>
              </>
            )}
          </Disclosure>

          {/* Footer Text Section */}
          <Disclosure>
            {({ open }) => (
              <>
                <Disclosure.Button
                  className="w-full bg-white rounded-lg shadow p-4 hover:bg-gray-50 transition-colors"
                  onClick={() => toggleSection('footer', !open)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText size={20} className="mr-2 text-blue-600" />
                      <h2 className="text-lg font-semibold">Texte de pied de page</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {!open && <span className="text-sm text-gray-500 hidden md:inline">Ouvrir pour modifier le texte de pied de page</span>}
                      {open ? <ChevronUp size={20} className="text-gray-600" /> : <ChevronDown size={20} className="text-gray-600" />}
                    </div>
                  </div>
                </Disclosure.Button>
                <Disclosure.Panel className="bg-white rounded-lg shadow p-6 mt-2">
            <p className="text-gray-600 mb-4">
              Ce texte apparaîtra en bas de tous vos documents (devis, factures, avoirs).
            </p>
            
            <div className="mb-4">
              <textarea
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Exemple: Merci pour votre confiance. Tous les prix sont en euros."
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
                </Disclosure.Panel>
              </>
            )}
          </Disclosure>

          {/* Terms and Conditions Section */}
          <Disclosure>
            {({ open }) => (
              <>
                <Disclosure.Button
                  className="w-full bg-white rounded-lg shadow p-4 hover:bg-gray-50 transition-colors"
                  onClick={() => toggleSection('terms', !open)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileOutput size={20} className="mr-2 text-blue-600" />
                      <h2 className="text-lg font-semibold">Conditions Générales de Vente</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {!open && <span className="text-sm text-gray-500 hidden md:inline">Ouvrir pour modifier les CGV</span>}
                      {open ? <ChevronUp size={20} className="text-gray-600" /> : <ChevronDown size={20} className="text-gray-600" />}
                    </div>
                  </div>
                </Disclosure.Button>
                <Disclosure.Panel className="bg-white rounded-lg shadow p-6 mt-2">
            <p className="text-gray-600 mb-4">
              Ces conditions apparaîtront sur vos documents (devis, factures, avoirs).
            </p>
            
            <div className="mb-4">
              <textarea
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Exemple: Les produits restent la propriété de la société jusqu'au paiement intégral."
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
                {saveStatus.success ? 'CGV enregistrées avec succès' : 'Erreur lors de l\'enregistrement des CGV'}
              </div>
            )}
                </Disclosure.Panel>
              </>
            )}
          </Disclosure>

          {/* QR Code CGV Section */}
          <Disclosure>
            {({ open }) => (
              <>
                <Disclosure.Button
                  className="w-full bg-white rounded-lg shadow p-4 hover:bg-gray-50 transition-colors"
                  onClick={() => toggleSection('qrcode', !open)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText size={20} className="mr-2 text-blue-600" />
                      <h2 className="text-lg font-semibold">QR Code CGV</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {!open && <span className="text-sm text-gray-500 hidden md:inline">Configurer l'URL du QR code pour les CGV</span>}
                      {open ? <ChevronUp size={20} className="text-gray-600" /> : <ChevronDown size={20} className="text-gray-600" />}
                    </div>
                  </div>
                </Disclosure.Button>
                <Disclosure.Panel className="bg-white rounded-lg shadow p-6 mt-2">
            <p className="text-gray-600 mb-4">
              Un QR code sera automatiquement ajouté sur vos documents PDF à côté des CGV.
              Configurez l'URL vers laquelle le QR code doit rediriger (par exemple, votre page de conditions générales de vente en ligne).
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">URL des CGV</label>
              <input
                type="url"
                value={cgvQrUrl}
                onChange={(e) => setCgvQrUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://smartdiscount31.com/"
              />
              <p className="text-xs text-gray-500 mt-1">
                Cette URL sera encodée dans le QR code affiché sur vos documents
              </p>
            </div>

            {qrCodePreview && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Aperçu du QR Code</p>
                <div className="flex justify-center">
                  <img
                    src={qrCodePreview}
                    alt="Aperçu QR Code"
                    className="border border-gray-300 rounded"
                  />
                </div>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Scannez pour tester : {cgvQrUrl}
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveCgvQrUrl}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={isSaving}
              >
                <div className="flex items-center">
                  <Save size={18} className="mr-2" />
                  {isSaving && saveStatus?.field === 'qrcode' ? 'Enregistrement...' : 'Enregistrer'}
                </div>
              </button>
            </div>

            {saveStatus?.field === 'qrcode' && (
              <div className={`mt-2 text-sm ${saveStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                {saveStatus.success ? 'URL du QR code enregistrée avec succès' : 'Erreur lors de l\'enregistrement de l\'URL'}
              </div>
            )}
                </Disclosure.Panel>
              </>
            )}
          </Disclosure>

          {/* Bank Info Section */}
          <Disclosure>
            {({ open }) => (
              <>
                <Disclosure.Button
                  className="w-full bg-white rounded-lg shadow p-4 hover:bg-gray-50 transition-colors"
                  onClick={() => toggleSection('bank', !open)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <CreditCard size={20} className="mr-2 text-blue-600" />
                      <h2 className="text-lg font-semibold">Coordonnées bancaires</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {!open && <span className="text-sm text-gray-500 hidden md:inline">Ouvrir pour configurer les coordonnées bancaires</span>}
                      {open ? <ChevronUp size={20} className="text-gray-600" /> : <ChevronDown size={20} className="text-gray-600" />}
                    </div>
                  </div>
                </Disclosure.Button>
                <Disclosure.Panel className="bg-white rounded-lg shadow p-6 mt-2">
            <p className="text-gray-600 mb-4">
              Ces informations apparaîtront sur vos factures pour faciliter les paiements par virement.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banque</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Exemple Banque"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                <input
                  type="text"
                  value={bankIban}
                  onChange={(e) => setBankIban(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">BIC</label>
                <input
                  type="text"
                  value={bankBic}
                  onChange={(e) => setBankBic(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="XXXXXXXX"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveBankInfo}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                disabled={isSaving}
              >
                <div className="flex items-center">
                  <Save size={18} className="mr-2" />
                  {isSaving && saveStatus?.field === 'bank' ? 'Enregistrement...' : 'Enregistrer'}
                </div>
              </button>
            </div>
            
            {saveStatus?.field === 'bank' && (
              <div className={`mt-2 text-sm ${saveStatus.success ? 'text-green-600' : 'text-red-600'}`}>
                {saveStatus.success ? 'Coordonnées bancaires enregistrées avec succès' : 'Erreur lors de l\'enregistrement des coordonnées bancaires'}
              </div>
            )}
                </Disclosure.Panel>
              </>
            )}
          </Disclosure>

          {/* Preview Section */}
          <Disclosure>
            {({ open }) => (
              <>
                <Disclosure.Button
                  className="w-full bg-white rounded-lg shadow p-4 hover:bg-gray-50 transition-colors"
                  onClick={() => toggleSection('preview', !open)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Eye size={20} className="mr-2 text-blue-600" />
                      <h2 className="text-lg font-semibold">Aperçu</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {!open && <span className="text-sm text-gray-500 hidden md:inline">Ouvrir pour voir l'aperçu du document</span>}
                      {open ? <ChevronUp size={20} className="text-gray-600" /> : <ChevronDown size={20} className="text-gray-600" />}
                    </div>
                  </div>
                </Disclosure.Button>
                <Disclosure.Panel className="bg-white rounded-lg shadow p-6 mt-2">

            <div className="border rounded-lg p-6">
              <div className="flex justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">FACTURE</h2>
                  <p className="text-gray-600">N° EXEMPLE-2025-0001</p>
                  <p className="text-gray-600">Date: 01/01/2025</p>
                  <p className="text-gray-600">Échéance: 31/01/2025</p>
                </div>
                <div className="text-right">
                  {logoPreview && (
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="max-h-40 max-w-80 object-contain mb-3"
                    />
                  )}
                  <h3 className="font-bold text-lg">{companyName || 'Votre Entreprise'}</h3>
                  <p>{addressLine1 || '123 Rue Exemple'}</p>
                  {addressLine2 && <p>{addressLine2}</p>}
                  <p>{zip || '75000'} {city || 'Paris'}</p>
                  <p>{country || 'France'}</p>
                  {siren && <p className="mt-1 text-sm">SIREN: {siren}</p>}
                  {email && <p className="mt-1">{email}</p>}
                  {phone && <p>{phone}</p>}
                </div>
              </div>
              
              {/* Bank Info Preview */}
              {(bankName || bankIban || bankBic) && (
                <div className="mb-8">
                  <h3 className="font-bold text-gray-800 mb-2">Coordonnées bancaires</h3>
                  <div className="border-t border-gray-200 pt-2 text-sm text-gray-700 space-y-1">
                    {bankName && <p><span className="font-medium">Banque:</span> {bankName}</p>}
                    {bankIban && <p><span className="font-medium">IBAN:</span> {bankIban}</p>}
                    {bankBic && <p><span className="font-medium">BIC:</span> {bankBic}</p>}
                  </div>
                </div>
              )}
              
              {/* Footer Preview */}
              <div className="text-center text-gray-500 text-sm mt-8 pt-8 border-t">
                {footerText && <p className="mb-2">{footerText}</p>}
                {termsAndConditions && <p>{termsAndConditions}</p>}
              </div>
            </div>
                </Disclosure.Panel>
              </>
            )}
          </Disclosure>
        </div>
      )}
    </div>
  );
};
