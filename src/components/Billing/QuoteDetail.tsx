import React, { useState, useEffect, useRef } from 'react';
import { useQuoteStore } from '../../store/quoteStore';
import {
  ArrowLeft,
  FileText,
  User,
  Calendar,
  DollarSign,
  Send,
  Download,
  Copy,
  Printer,
  CheckCircle,
  XCircle,
  FileOutput
} from 'lucide-react';
import { QuoteStatus } from '../../types/billing';
import { EmailSender } from './EmailSender';
import { useAppSettingsStore } from '../../store/appSettingsStore';
import { CGVQRCode } from './CGVQRCode';
import { generateQuotePDF } from '../../utils/pdfGenerator';

interface QuoteDetailProps {
  quoteId: string;
  onBack?: () => void;
}

// Status badge component
const StatusBadge: React.FC<{ status: QuoteStatus }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'draft': return 'bg-gray-200 text-gray-800';
      case 'sent': return 'bg-blue-200 text-blue-800';
      case 'accepted': return 'bg-green-200 text-green-800';
      case 'refused': return 'bg-red-200 text-red-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'draft': return 'Brouillon';
      case 'sent': return 'Envoyé';
      case 'accepted': return 'Accepté';
      case 'refused': return 'Refusé';
      default: return status;
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
      {getStatusText()}
    </span>
  );
};

export const QuoteDetail: React.FC<QuoteDetailProps> = ({ quoteId, onBack }) => {
  const { currentQuote, isLoading, error, getQuoteById, sendQuote, acceptQuote, refuseQuote } = useQuoteStore();
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const quoteRef = useRef<HTMLDivElement>(null);
  const { settings, fetchSettings } = useAppSettingsStore();
  
  useEffect(() => {
    console.log('QuoteDetail component mounted, fetching quote...');
    getQuoteById(quoteId);
  }, [quoteId, getQuoteById]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);
  
  const handleSendQuote = async () => {
    if (currentQuote?.status === 'draft') {
      await sendQuote(quoteId);
    }
    setIsEmailModalOpen(true);
  };
  
  const handleAcceptQuote = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir marquer ce devis comme accepté ?')) {
      await acceptQuote(quoteId);
    }
  };
  
  const handleRefuseQuote = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir marquer ce devis comme refusé ?')) {
      await refuseQuote(quoteId);
    }
  };
  
  const handleConvertToOrder = () => {
    // Redirect to order creation page with quote ID
    window.location.href = `/orders/new?fromQuote=${quoteId}`;
  };
  
  const handleConvertToInvoice = () => {
    // Redirect to invoice creation page with quote ID
    window.location.href = `/invoices/new?fromQuote=${quoteId}`;
  };
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPDF = async () => {
    if (!currentQuote) return;

    console.log('Starting PDF generation for quote:', currentQuote.quote_number);
    setIsGeneratingPdf(true);

    try {
      const pdf = await generateQuotePDF(currentQuote, settings, settings?.logo_url);

      // Ouvrir le PDF dans un nouvel onglet
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');

      // Télécharger automatiquement
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Devis_${currentQuote.quote_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('PDF generated and opened successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erreur lors de la génération du PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };
  
  const handleDuplicate = () => {
    // Redirect to quote creation page with duplicate flag
    window.location.href = `/quotes/new?duplicate=${quoteId}`;
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR').format(date);
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
        {error}
      </div>
    );
  }
  
  if (!currentQuote) {
    return (
      <div className="text-center py-6 text-gray-500">
        Devis non trouvé
      </div>
    );
  }
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          {onBack && (
            <button
              onClick={onBack}
              className="mr-4 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="text-2xl font-bold">Devis {currentQuote.quote_number}</h1>
        </div>
        <StatusBadge status={currentQuote.status} />
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSendQuote}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Send size={18} />
          Envoyer par email
        </button>
        
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          disabled={isGeneratingPdf}
        >
          <Download size={18} />
          {isGeneratingPdf ? 'Génération...' : 'Télécharger PDF'}
        </button>
        
        <button
          onClick={handleDuplicate}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
        >
          <Copy size={18} />
          Dupliquer
        </button>
        
        {currentQuote.status === 'sent' && (
          <>
            <button
              onClick={handleAcceptQuote}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <CheckCircle size={18} />
              Accepter
            </button>
            
            <button
              onClick={handleRefuseQuote}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              <XCircle size={18} />
              Refuser
            </button>
          </>
        )}
        
        {currentQuote.status === 'accepted' && (
          <>
            <button
              onClick={handleConvertToOrder}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              <FileOutput size={18} />
              Convertir en commande
            </button>
            
            <button
              onClick={handleConvertToInvoice}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <FileOutput size={18} />
              Convertir en facture
            </button>
          </>
        )}
      </div>
      
      {/* Quote Document - Aperçu correspondant au PDF */}
      <div ref={quoteRef} className="bg-white rounded-lg shadow mx-auto" style={{ width: '210mm', padding: '10mm' }}>
        {/* Header - Nouvelle mise en page optimisée */}
        <div className="grid grid-cols-3 gap-4 mb-6" style={{ height: '60mm' }}>
          {/* Logo à gauche */}
          <div className="flex items-start">
            {settings?.logo_url && (
              <img
                src={settings.logo_url}
                alt="Logo"
                className="object-contain"
                style={{ maxWidth: '50mm', maxHeight: '25mm' }}
              />
            )}
          </div>

          {/* Centre : Titre et informations du document */}
          <div className="text-center flex flex-col justify-start pt-2">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">DEVIS</h2>
            <p className="text-sm mb-1">N° {currentQuote.quote_number}</p>
            <p className="text-sm mb-1">Date: {formatDate(currentQuote.date_issued)}</p>
            <p className="text-sm">Validité: {formatDate(currentQuote.date_expiry)}</p>
          </div>

          {/* Droite : Informations de l'entreprise */}
          <div className="text-right text-sm pt-2">
            <h3 className="font-bold text-base mb-1">{settings?.company_name || 'Votre Entreprise'}</h3>
            <p className="text-xs leading-tight">{settings?.address_line1 || '123 Rue Exemple'}</p>
            {settings?.address_line2 && <p className="text-xs leading-tight">{settings.address_line2}</p>}
            <p className="text-xs leading-tight">{(settings?.zip || '75000')} {(settings?.city || 'Paris')}</p>
            <p className="text-xs leading-tight">{settings?.country || 'France'}</p>
            {settings?.siren && <p className="text-xs leading-tight mt-1">SIREN: {settings.siren}</p>}
            {settings?.email && <p className="text-xs leading-tight">{settings.email}</p>}
            {settings?.phone && <p className="text-xs leading-tight">{settings.phone}</p>}
          </div>
        </div>
        
        {/* Customer Info - 3 colonnes optimisées */}
        <div className="grid grid-cols-3 gap-4 mb-6 text-sm" style={{ minHeight: '35mm' }}>
          {/* Colonne 1 : Informations client */}
          <div>
            <h3 className="font-bold text-gray-800 mb-1 text-xs">Client</h3>
            <p className="font-semibold leading-tight">{currentQuote.customer?.name}</p>
            {currentQuote.customer?.email && <p className="text-xs leading-tight">{currentQuote.customer.email}</p>}
            {currentQuote.customer?.phone && <p className="text-xs leading-tight">{currentQuote.customer.phone}</p>}
          </div>

          {/* Colonne 2 : Adresse de facturation */}
          {currentQuote.billing_address_json && (
            <div>
              <h3 className="font-bold text-gray-800 mb-1 text-xs">Adresse de facturation</h3>
              <p className="text-xs leading-tight">{currentQuote.billing_address_json.line1}</p>
              {currentQuote.billing_address_json.line2 && <p className="text-xs leading-tight">{currentQuote.billing_address_json.line2}</p>}
              <p className="text-xs leading-tight">{currentQuote.billing_address_json.zip} {currentQuote.billing_address_json.city}</p>
              <p className="text-xs leading-tight">{currentQuote.billing_address_json.country}</p>
            </div>
          )}

          {/* Colonne 3 : Adresse de livraison */}
          {currentQuote.shipping_address_json && (
            <div>
              <h3 className="font-bold text-gray-800 mb-1 text-xs">Adresse de livraison</h3>
              <p className="text-xs leading-tight">{currentQuote.shipping_address_json.line1}</p>
              {currentQuote.shipping_address_json.line2 && <p className="text-xs leading-tight">{currentQuote.shipping_address_json.line2}</p>}
              <p className="text-xs leading-tight">{currentQuote.shipping_address_json.zip} {currentQuote.shipping_address_json.city}</p>
              <p className="text-xs leading-tight">{currentQuote.shipping_address_json.country}</p>
            </div>
          )}
        </div>
        
        {/* Items Table - Optimisé */}
        <div className="mb-6">
          <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                  Description
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase">
                  Qté
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-700 uppercase">
                  Prix unit. HT
                </th>
                <th className="px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase">
                  TVA
                </th>
                <th className="px-2 py-2 text-right text-xs font-medium text-gray-700 uppercase">
                  Total HT
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentQuote.items?.map((item, index) => (
                <tr key={item.id || index} className="text-sm">
                  <td className="px-2 py-2 text-gray-900">
                    {item.description}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-900">
                    {item.quantity}
                  </td>
                  <td className="px-2 py-2 text-right text-gray-900">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-900">
                    {item.tax_rate}%
                  </td>
                  <td className="px-2 py-2 text-right text-gray-900">
                    {formatCurrency(item.total_price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Totals - Optimisé */}
        <div className="flex justify-end mb-6">
          <div className="w-56">
            <div className="flex justify-between py-1 border-b text-sm">
              <span className="font-medium">Total HT:</span>
              <span>{formatCurrency(currentQuote.total_ht)}</span>
            </div>
            <div className="flex justify-between py-1 border-b text-sm">
              <span className="font-medium">TVA:</span>
              <span>{formatCurrency(currentQuote.tva)}</span>
            </div>
            <div className="flex justify-between py-1 border-b font-bold text-base">
              <span>Total TTC:</span>
              <span>{formatCurrency(currentQuote.total_ttc)}</span>
            </div>
          </div>
        </div>
        
        {/* Notes */}
        {currentQuote.note && (
          <div className="mb-4">
            <h3 className="font-bold text-gray-800 mb-2">Notes</h3>
            <div className="border-t border-gray-200 pt-2">
              <p className="whitespace-pre-line">{currentQuote.note}</p>
            </div>
          </div>
        )}
        
        {/* Footer - Optimisé */}
        <div className="text-gray-500 text-xs mt-4 pt-4 border-t">
          <div className="text-center">
            {settings?.footer_text ? (
              <p className="mb-1 whitespace-pre-line leading-tight">{settings.footer_text}</p>
            ) : (
              <p className="leading-tight">Merci pour votre confiance. Tous les prix sont en euros.</p>
            )}
          </div>

          {/* CGV */}
          <div className="mt-2">
            <div className="text-center">
              {settings?.terms_and_conditions ? (
                <p className="whitespace-pre-line inline-block leading-tight">{settings.terms_and_conditions}</p>
              ) : (
                <p className="inline-block leading-tight">
                  Conditions générales de vente : Les produits restent la propriété de la société
                  jusqu'au paiement intégral.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Email Modal */}
      <EmailSender
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        documentType="quote"
        documentId={quoteId}
        documentNumber={currentQuote.quote_number}
        customerName={currentQuote.customer?.name || ''}
        customerEmail={currentQuote.customer?.email || ''}
        documentRef={quoteRef}
        additionalData={{
          expiryDate: formatDate(currentQuote.date_expiry),
          totalAmount: currentQuote.total_ttc
        }}
      />
    </div>
  );
};
