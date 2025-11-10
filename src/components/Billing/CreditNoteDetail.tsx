import React, { useState, useEffect, useRef } from 'react';
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
  FileOutput,
  CheckCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { CreditNoteStatus, CreditNoteWithDetails } from '../../types/billing';
import { EmailSender } from './EmailSender';
import { useAppSettingsStore } from '../../store/appSettingsStore';
import { CGVQRCode } from './CGVQRCode';
import { generateCreditNotePDF } from '../../utils/pdfGenerator';

interface CreditNoteDetailProps {
  creditNoteId: string;
  onBack?: () => void;
}

// Status badge component
const StatusBadge: React.FC<{ status: CreditNoteStatus }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'draft': return 'bg-gray-200 text-gray-800';
      case 'sent': return 'bg-blue-200 text-blue-800';
      case 'processed': return 'bg-green-200 text-green-800';
      default: return 'bg-gray-200 text-gray-800';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'draft': return 'Brouillon';
      case 'sent': return 'Envoyé';
      case 'processed': return 'Traité';
      default: return status;
    }
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor()}`}>
      {getStatusText()}
    </span>
  );
};

export const CreditNoteDetail: React.FC<CreditNoteDetailProps> = ({ creditNoteId, onBack }) => {
  const [creditNote, setCreditNote] = useState<CreditNoteWithDetails | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const creditNoteRef = useRef<HTMLDivElement>(null);
  const { settings, fetchSettings } = useAppSettingsStore();
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);
  
  useEffect(() => {
    console.log('CreditNoteDetail component mounted, fetching credit note...');
    fetchCreditNote();
  }, [creditNoteId]);
  
  const fetchCreditNote = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log(`Fetching credit note with ID: ${creditNoteId}`);
      
      // Fetch credit note with customer details
      const { data: creditNoteData, error: creditNoteError } = await supabase
        .from('credit_notes')
        .select(`
          *,
          invoice:invoices(id, invoice_number, customer:customers(id, name, email)),
          document_type:billing_document_types(*)
        `)
        .eq('id', creditNoteId)
        .single();
        
      if (creditNoteError) throw creditNoteError;
      
      console.log('Credit note data fetched:', creditNoteData);
      setCreditNote(creditNoteData);
      
      // Fetch credit note items
      const { data: itemsData, error: itemsError } = await supabase
        .from('credit_note_items')
        .select(`
          *,
          product:products(id, name, sku)
        `)
        .eq('credit_note_id', creditNoteId);
        
      if (itemsError) throw itemsError;
      
      console.log('Credit note items fetched:', itemsData);
      setItems(itemsData || []);

      // Set invoice from credit note data
      if (creditNoteData.invoice) {
        console.log('Invoice data loaded:', creditNoteData.invoice);
        setInvoice(creditNoteData.invoice);
      }
    } catch (error) {
      console.error(`Error fetching credit note with ID ${creditNoteId}:`, error);
      setError(error instanceof Error ? error.message : `An error occurred while fetching credit note with ID ${creditNoteId}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateCreditNoteStatus = async (status: CreditNoteStatus) => {
    if (!creditNote) return;
    
    try {
      const { error } = await supabase
        .from('credit_notes')
        .update({ status })
        .eq('id', creditNoteId);
        
      if (error) throw error;
      
      // Update local state
      setCreditNote({ ...creditNote, status });
    } catch (error) {
      console.error('Error updating credit note status:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while updating credit note status');
    }
  };
  
  const handleSendCreditNote = async () => {
    if (!creditNote) return;
    
    try {
      // If credit note is in draft status, update it to sent
      if (creditNote.status === 'draft') {
        await updateCreditNoteStatus('sent');
      }
      
      // Open email modal
      setIsEmailModalOpen(true);
    } catch (error) {
      console.error('Error updating credit note status:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while updating credit note status');
    }
  };
  
  const handleMarkAsProcessed = async () => {
    if (window.confirm('Êtes-vous sûr de vouloir marquer cet avoir comme traité ?')) {
      await updateCreditNoteStatus('processed');
    }
  };
  
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPDF = async () => {
    if (!creditNote) return;

    console.log('Starting PDF generation for credit note:', creditNote.credit_note_number);
    setIsGeneratingPdf(true);

    try {
      // Préparer les données pour le PDF
      const creditNoteData = {
        ...creditNote,
        items: items,
        invoice: invoice,
      };

      const pdf = await generateCreditNotePDF(creditNoteData, settings, settings?.logo_url);

      // Ouvrir le PDF dans un nouvel onglet
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');

      // Télécharger automatiquement
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Avoir_${creditNote.credit_note_number}.pdf`;
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
    // Redirect to credit note creation page with duplicate flag
    window.location.href = `/credit-notes/new?duplicate=${creditNoteId}`;
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
  
  if (!creditNote) {
    return (
      <div className="text-center py-6 text-gray-500">
        Avoir non trouvé
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
          <h1 className="text-2xl font-bold">Avoir {creditNote.credit_note_number}</h1>
        </div>
        <StatusBadge status={creditNote.status} />
      </div>
      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleSendCreditNote}
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
        
        {creditNote.status === 'sent' && (
          <button
            onClick={handleMarkAsProcessed}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <CheckCircle size={18} />
            Marquer comme traité
          </button>
        )}
      </div>
      
      {/* Credit Note Document - Aperçu correspondant au PDF */}
      <div ref={creditNoteRef} className="bg-white rounded-lg shadow mx-auto" style={{ width: '210mm', padding: '10mm' }}>
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
            <h2 className="text-2xl font-bold text-gray-800 mb-2">AVOIR</h2>
            <p className="text-sm mb-1">N° {creditNote.credit_note_number}</p>
            <p className="text-sm">Date: {formatDate(creditNote.date_issued)}</p>
            {invoice && (
              <p className="text-xs mt-2 text-gray-600">
                Facture:{' '}
                <button
                  onClick={() => window.location.href = `/invoices/${invoice.id}`}
                  className="text-blue-600 hover:text-blue-900 underline"
                >
                  {invoice.invoice_number}
                </button>
              </p>
            )}
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
        
        {/* Customer Info et Motif - Optimisé */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm" style={{ minHeight: '30mm' }}>
          {/* Colonne 1 : Client */}
          <div>
            <h3 className="font-bold text-gray-800 mb-1 text-xs">Client</h3>
            <p className="font-semibold leading-tight">{invoice?.customer?.name || 'Client non trouvé'}</p>
            {invoice?.customer?.email && <p className="text-xs leading-tight">{invoice.customer.email}</p>}
          </div>

          {/* Colonne 2 : Motif */}
          <div>
            <h3 className="font-bold text-gray-800 mb-1 text-xs">Motif</h3>
            <p className="text-xs leading-tight">{creditNote.reason}</p>
          </div>
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
              {items.map((item, index) => (
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
        
        {/* Total - Optimisé */}
        <div className="flex justify-end mb-6">
          <div className="w-56">
            <div className="flex justify-between py-1 font-bold text-base">
              <span>Total de l'avoir:</span>
              <span>{formatCurrency(creditNote.total_amount)}</span>
            </div>
          </div>
        </div>
        
        {/* Footer - Optimisé */}
        <div className="text-gray-500 text-xs mt-4 pt-4 border-t">
          <div className="text-center">
            {(settings?.credit_note_footer_text || settings?.footer_text) ? (
              <p className="mb-1 whitespace-pre-line leading-tight">{settings.credit_note_footer_text || settings.footer_text}</p>
            ) : (
              <p className="leading-tight">Merci pour votre confiance. Tous les prix sont en euros.</p>
            )}
          </div>

          {/* CGV */}
          <div className="mt-2">
            <div className="text-center">
              {(settings?.credit_note_terms || settings?.terms_and_conditions) ? (
                <p className="whitespace-pre-line inline-block leading-tight">{settings.credit_note_terms || settings.terms_and_conditions}</p>
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
        documentType="credit_note"
        documentId={creditNoteId}
        documentNumber={creditNote.credit_note_number}
        customerName={invoice?.customer?.name || ''}
        customerEmail={invoice?.customer?.email || ''}
        documentRef={creditNoteRef}
        additionalData={{
          totalAmount: creditNote.total_amount,
          invoiceNumber: creditNote.invoice_number
        }}
      />
    </div>
  );
};
