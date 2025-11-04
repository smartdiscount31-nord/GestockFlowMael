import React, { useState, useEffect } from 'react';
import { useQuoteStore, getDocumentTypes } from '../../store/quoteStore';
import { useCustomerStore } from '../../store/customerStore';
import { useProductStore } from '../../store/productStore';
import {
  Save,
  Plus,
  Trash2,
  User,
  Calendar,
  FileText,
  MapPin,
  CreditCard,
  Search,
  X,
  Upload
} from 'lucide-react';
import {
  QuoteInsert,
  QuoteItemInsert,
  CustomerWithAddresses,
  Address,
  DocumentItem,
  DocumentType
} from '../../types/billing';
import { ProductWithStock } from '../../types/supabase';
import { CSVImportArticles } from './CSVImportArticles';
import { ProductSearch } from '../Search/ProductSearch';
import { supabase } from '../../lib/supabase';

interface QuoteFormProps {
  quoteId?: string;
  onSaved?: (id: string) => void;
}

export const QuoteForm: React.FC<QuoteFormProps> = ({ quoteId, onSaved }) => {
  const { 
    currentQuote, 
    isLoading, 
    error, 
    getQuoteById
  } = useQuoteStore();
  
  const { customers, fetchCustomers } = useCustomerStore();
  const { products, fetchProducts } = useProductStore();
  
  // Form state
  const [formData, setFormData] = useState<Partial<QuoteInsert>>({
    customer_id: '',
    status: 'draft',
    date_issued: new Date().toISOString().split('T')[0],
    date_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    note: '',
    billing_address_json: null,
    shipping_address_json: null,
    document_type_id: ''
  });

  // Document types
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  
  // Items state
  const [items, setItems] = useState<Partial<QuoteItemInsert>[]>([]);
  
  // UI state
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithAddresses | null>(null);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<ProductWithStock[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [newItem, setNewItem] = useState<Partial<QuoteItemInsert>>({
    product_id: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    tax_rate: 20,
    total_price: 0
  });
  // Contexte client/prix + UX
  const [docCustomerType, setDocCustomerType] = useState<'pro' | 'particulier'>('particulier');
  const [isClientSectionCollapsed, setIsClientSectionCollapsed] = useState(false);
  const [billingManual, setBillingManual] = useState(false);
  const [shippingManual, setShippingManual] = useState(false);
  
  // Totals
  const [totals, setTotals] = useState({
    totalHT: 0,
    totalTVA: 0,
    totalTTC: 0
  });
  
  // Load data on mount
  useEffect(() => {
    console.log('QuoteForm component mounted');

    const loadInitialData = async () => {
      try {
        console.log('Loading initial data...');

        // Load customers and products
        await Promise.all([
          fetchCustomers(),
          fetchProducts()
        ]);

        // Load document types
        console.log('Loading document types...');
        const types = await getDocumentTypes();
        console.log(`Loaded ${types.length} document types:`, types);

        if (types.length === 0) {
          console.warn('No document types found. Please create at least one document type.');
        }

        setDocumentTypes(types);

        // Load quote if editing
        if (quoteId) {
          console.log(`Loading quote with ID: ${quoteId}`);
          await getQuoteById(quoteId);
        }

        console.log('Initial data loaded successfully');
      } catch (err) {
        console.error('Error loading initial data:', err);
      }
    };

    loadInitialData();
  }, [quoteId, fetchCustomers, fetchProducts, getQuoteById]);
  
  // Update form when quote is loaded
  useEffect(() => {
    if (currentQuote && quoteId) {
      console.log('Updating form with current quote data:', currentQuote);
      setFormData({
        customer_id: currentQuote.customer_id,
        status: currentQuote.status,
        date_issued: currentQuote.date_issued,
        date_expiry: currentQuote.date_expiry,
        note: currentQuote.note || '',
        billing_address_json: currentQuote.billing_address_json,
        shipping_address_json: currentQuote.shipping_address_json,
        document_type_id: currentQuote.document_type_id || ''
      });
      
      // Find and set the selected customer
      const customer = customers.find(c => c.id === currentQuote.customer_id);
      if (customer) {
        setSelectedCustomer(customer);
      }
      
      // Set items
      if (currentQuote.items) {
        setItems(currentQuote.items.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          total_price: item.total_price
        })));
      }
    }
  }, [currentQuote, quoteId, customers]);
  
  // Filter products when search term changes
  useEffect(() => {
    if (productSearchTerm.trim() === '') {
      setFilteredProducts([]);
    } else {
      const lowercasedSearch = productSearchTerm.toLowerCase();
      setFilteredProducts(
        products.filter(product => 
          product.name.toLowerCase().includes(lowercasedSearch) ||
          product.sku.toLowerCase().includes(lowercasedSearch)
        ).slice(0, 10) // Limit to 10 results
      );
    }
  }, [productSearchTerm, products]);
  
  // Calculate totals when items change
  useEffect(() => {
    let totalHT = 0;
    let totalTVA = 0;
    
    items.forEach(item => {
      if (item.total_price) {
        totalHT += item.total_price;
        totalTVA += item.total_price * ((item.tax_rate || 20) / 100);
      }
    });
    
    const totalTTC = totalHT + totalTVA;
    
    setTotals({
      totalHT,
      totalTVA,
      totalTTC
    });
    
    // Update form data with new totals
    setFormData(prev => ({
      ...prev,
      total_ht: totalHT,
      total_ttc: totalTTC,
      tva: totalTVA
    }));
  }, [items]);
  
  // Handle customer selection
  const handleCustomerSelect = (customer: CustomerWithAddresses) => {
    console.log('Customer selected:', customer);
    setSelectedCustomer(customer);
    setFormData(prev => ({ ...prev, customer_id: customer.id }));
    // Prix basé sur groupe client
    const cg = ((customer as any)?.customer_group || '').toLowerCase() === 'pro' ? 'pro' : 'particulier';
    setDocCustomerType(cg as 'pro' | 'particulier');
    setCustomerSearchTerm('');
    setShowCustomerDropdown(false);
    setIsClientSectionCollapsed(true);
    setBillingManual(false);
    setShippingManual(false);
    
    // Set default addresses if available
    if (customer.addresses && customer.addresses.length > 0) {
      const billingAddress = customer.addresses.find(addr => addr.address_type === 'billing' && addr.is_default);
      const shippingAddress = customer.addresses.find(addr => addr.address_type === 'shipping' && addr.is_default);
      
      if (billingAddress) {
        const addressJson: Address = {
          line1: billingAddress.line1,
          line2: billingAddress.line2 || '',
          zip: billingAddress.zip,
          city: billingAddress.city,
          country: billingAddress.country
        };
        setFormData(prev => ({ ...prev, billing_address_json: addressJson }));
      }
      
      if (shippingAddress) {
        const addressJson: Address = {
          line1: shippingAddress.line1,
          line2: shippingAddress.line2 || '',
          zip: shippingAddress.zip,
          city: shippingAddress.city,
          country: shippingAddress.country
        };
        setFormData(prev => ({ ...prev, shipping_address_json: addressJson }));
      }
    }
  };
  
  // Handle product selection
  const handleProductSelect = (product: ProductWithStock) => {
    console.log('Product selected:', product);
    const base = docCustomerType === 'pro'
      ? Number((product as any).pro_price || 0)
      : Number((product as any).retail_price || 0);
    setNewItem({
      product_id: (product as any).id,
      description: (product as any).name,
      quantity: 1,
      unit_price: base,
      tax_rate: 20,
      total_price: base
    });
    setProductSearchTerm('');
    setShowProductDropdown(false);
  };
  
  // Handle adding a new item
  const handleAddItem = () => {
    if (!newItem.description || !newItem.quantity || !newItem.unit_price) {
      alert('Veuillez remplir tous les champs de l\'article');
      return;
    }
    
    const itemToAdd = {
      ...newItem,
      total_price: (newItem.quantity || 0) * (newItem.unit_price || 0)
    };
    
    setItems(prev => [...prev, itemToAdd]);
    setNewItem({
      product_id: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_rate: 20,
      total_price: 0
    });
    setProductSearchTerm('');
  };
  
  // Handle updating an item
  const handleUpdateItem = (index: number, field: keyof QuoteItemInsert, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Recalculate total price if quantity or unit price changes
      if (field === 'quantity' || field === 'unit_price') {
        const quantity = field === 'quantity' ? value : updated[index].quantity;
        const unitPrice = field === 'unit_price' ? value : updated[index].unit_price;
        updated[index].total_price = quantity * unitPrice;
      }
      
      return updated;
    });
  };
  
  // Handle removing an item
  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };
  
  // Handle CSV import
  const handleImportedItems = (importedItems: DocumentItem[]) => {
    console.log('Imported items:', importedItems);
    // Add imported items to the current items list
    setItems(prev => [
      ...prev,
      ...importedItems.map(item => ({
        product_id: item.product_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        total_price: item.total_price
      }))
    ]);
  };
  
  // Handle form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    console.log('Submitting form with data:', formData);

    if (!formData.customer_id) {
      alert('Veuillez sélectionner un client');
      return;
    }
    if (!formData.document_type_id) {
      alert('Veuillez sélectionner un type de document');
      return;
    }
    if (items.length === 0) {
      alert('Veuillez ajouter au moins un article');
      return;
    }

    try {
      if (quoteId) {
        // Update existing quote via Supabase
        console.log('Updating quote with ID:', quoteId);
        const { error: updateErr } = await (supabase as any)
          .from('quotes' as any)
          .update({
            customer_id: (formData as any).customer_id,
            status: (formData as any).status || 'draft',
            date_issued: (formData as any).date_issued,
            date_expiry: (formData as any).date_expiry,
            note: (formData as any).note || '',
            total_ht: (totals as any).totalHT,
            total_ttc: (totals as any).totalTTC,
            tva: (totals as any).totalTVA,
            document_type_id: (formData as any).document_type_id
          } as any)
          .eq('id' as any, quoteId as any);
        if (updateErr) throw updateErr;

        // Sync items: add/update/delete
        const { data: existingItems, error: itemsErr } = await (supabase as any)
          .from('quote_items' as any)
          .select('id' as any)
          .eq('quote_id' as any, quoteId as any);
        if (itemsErr) throw itemsErr;

        // Add new
        const itemsToAdd = (items as any[]).filter((it: any) => !it.id);
        if (itemsToAdd.length > 0) {
          const { error: addErr } = await (supabase as any)
            .from('quote_items' as any)
            .insert(itemsToAdd.map((it: any) => ({
              quote_id: quoteId,
              product_id: it.product_id,
              description: it.description,
              quantity: it.quantity,
              unit_price: it.unit_price,
              tax_rate: it.tax_rate,
              total_price: it.total_price
            })) as any);
          if (addErr) throw addErr;
        }

        // Update existing
        for (const it of (items as any[]).filter((x: any) => x.id)) {
          const { error: updItErr } = await (supabase as any)
            .from('quote_items' as any)
            .update({
              product_id: (it as any).product_id,
              description: (it as any).description,
              quantity: (it as any).quantity,
              unit_price: (it as any).unit_price,
              tax_rate: (it as any).tax_rate,
              total_price: (it as any).total_price
            } as any)
            .eq('id' as any, (it as any).id as any);
          if (updItErr) throw updItErr;
        }

        // Delete removed
        const existingIds = ((existingItems as any[]) || []).map((it: any) => it.id);
        const currentIds = (items as any[]).filter((x: any) => x.id).map((x: any) => x.id);
        const toDelete = existingIds.filter((id: string) => !currentIds.includes(id));
        if (toDelete.length > 0) {
          const { error: delErr } = await (supabase as any)
            .from('quote_items' as any)
            .delete()
            .in('id' as any, toDelete as any);
          if (delErr) throw delErr;
        }

        console.log('Quote updated successfully');
        if (onSaved) {
          onSaved(quoteId);
        } else if ((window as any).__setCurrentPage) {
          (window as any).__setCurrentPage('quotes-list');
        }
      } else {
        // Create new quote
        console.log('Creating new quote');
        const { data: qData, error: qErr } = await (supabase as any)
          .from('quotes' as any)
          .insert([{
            customer_id: (formData as any).customer_id,
            status: (formData as any).status || 'draft',
            date_issued: (formData as any).date_issued,
            date_expiry: (formData as any).date_expiry,
            note: (formData as any).note || '',
            total_ht: (totals as any).totalHT,
            total_ttc: (totals as any).totalTTC,
            tva: (totals as any).totalTVA,
            document_type_id: (formData as any).document_type_id
          }] as any)
          .select()
          .single();
        if (qErr) throw qErr;

        const newId = (qData as any).id;

        if ((items as any[]).length > 0) {
          const { error: addErr } = await (supabase as any)
            .from('quote_items' as any)
            .insert((items as any[]).map((it: any) => ({
              quote_id: newId,
              product_id: it.product_id,
              description: it.description,
              quantity: it.quantity,
              unit_price: it.unit_price,
              tax_rate: it.tax_rate,
              total_price: it.total_price
            })) as any);
          if (addErr) throw addErr;
        }

        console.log('Quote created successfully');
        if (onSaved) {
          onSaved(newId);
        } else if ((window as any).__setCurrentPage) {
          (window as any).__setCurrentPage('quotes-list');
        }
      }
    } catch (err) {
      console.error('Error saving quote:', err);
      alert('Erreur lors de l’enregistrement du devis (voir console)');
    }
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };
  
  // Show loading state
  if (isLoading && !formData.customer_id && !currentQuote) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du formulaire...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          {quoteId ? 'Modifier le devis' : 'Nouveau devis'}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              console.log('Retour à la liste des devis');
              if ((window as any).__setCurrentPage) {
                (window as any).__setCurrentPage('quotes-list');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            disabled={isLoading}
          >
            <Save size={18} />
            {isLoading ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
          <button
            type="button"
            onClick={() => {
              console.log('Error dismissed');
            }}
            className="absolute top-2 right-2 text-red-700 hover:text-red-900"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {documentTypes.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
          <p className="font-medium">Attention: Aucun type de document disponible</p>
          <p className="text-sm mt-1">
            Vous devez créer au moins un type de document avant de pouvoir créer un devis.
            <button
              type="button"
              onClick={() => {
                console.log('Navigation vers la page des types de documents');
                if ((window as any).__setCurrentPage) {
                  (window as any).__setCurrentPage('document-types');
                }
              }}
              className="ml-2 underline font-medium hover:text-yellow-900"
            >
              Gérer les types de documents
            </button>
          </p>
        </div>
      )}

      <form className="space-y-8">
        {/* Customer and Quote Details Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <User size={20} className="mr-2" />
              Informations client et devis
            </h2>
            <button
              type="button"
              onClick={() => setIsClientSectionCollapsed(v => !v)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              title={isClientSectionCollapsed ? 'Déplier' : 'Replier'}
            >
              {isClientSectionCollapsed ? 'Déplier' : 'Replier'}
            </button>
          </div>
          
          {isClientSectionCollapsed && selectedCustomer && (
            <div className="p-3 mb-4 bg-gray-50 border rounded-md">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-medium">{selectedCustomer.name}</div>
                  {selectedCustomer.email && <div className="text-sm text-gray-600">{selectedCustomer.email}</div>}
                  {selectedCustomer.phone && <div className="text-sm text-gray-600">{selectedCustomer.phone}</div>}
                </div>
                <span className={`h-fit px-2 py-1 rounded-full text-xs ${docCustomerType === 'pro' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                  {docCustomerType === 'pro' ? 'Pro' : 'Particulier'}
                </span>
              </div>
              {(formData.billing_address_json || formData.shipping_address_json) && (
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                  {formData.billing_address_json && (
                    <div>
                      <div className="font-medium">Facturation</div>
                      <div>{formData.billing_address_json.line1}</div>
                      {formData.billing_address_json.line2 && <div>{formData.billing_address_json.line2}</div>}
                      <div>{formData.billing_address_json.zip} {formData.billing_address_json.city}</div>
                      <div>{formData.billing_address_json.country}</div>
                    </div>
                  )}
                  {formData.shipping_address_json && (
                    <div>
                      <div className="font-medium">Livraison</div>
                      <div>{formData.shipping_address_json.line1}</div>
                      {formData.shipping_address_json.line2 && <div>{formData.shipping_address_json.line2}</div>}
                      <div>{formData.shipping_address_json.zip} {formData.shipping_address_json.city}</div>
                      <div>{formData.shipping_address_json.country}</div>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => setIsClientSectionCollapsed(false)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Modifier
                </button>
              </div>
            </div>
          )}
          
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isClientSectionCollapsed ? 'hidden' : ''}`}>
            {/* Customer Selection */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerSearchTerm || (selectedCustomer ? selectedCustomer.name : '')}
                  onChange={(e) => {
                    setCustomerSearchTerm(e.target.value);
                    setShowCustomerDropdown(true);
                    if (selectedCustomer && e.target.value !== selectedCustomer.name) {
                      setSelectedCustomer(null);
                      setFormData(prev => ({ ...prev, customer_id: '' }));
                    }
                  }}
                  placeholder="Rechercher un client..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  onFocus={() => setShowCustomerDropdown(true)}
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
              
              {showCustomerDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md max-h-60 overflow-auto">
                  <div className="p-2">
                    <input
                      type="text"
                      value={customerSearchTerm}
                      onChange={(e) => setCustomerSearchTerm(e.target.value)}
                      placeholder="Filtrer les clients..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <ul className="py-1">
                    {customers
                      .filter(customer => 
                        customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                        (customer.email && customer.email.toLowerCase().includes(customerSearchTerm.toLowerCase()))
                      )
                      .map(customer => (
                        <li 
                          key={customer.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                          onClick={() => handleCustomerSelect(customer)}
                        >
                          <div>
                            <div className="font-medium">{customer.name}</div>
                            {customer.email && <div className="text-sm text-gray-500">{customer.email}</div>}
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            customer.customer_group === 'pro' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {customer.customer_group === 'pro' ? 'Pro' : 'Particulier'}
                          </span>
                        </li>
                      ))}
                    {customers.filter(customer => 
                      customer.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
                      (customer.email && customer.email.toLowerCase().includes(customerSearchTerm.toLowerCase()))
                    ).length === 0 && (
                      <li className="px-4 py-2 text-gray-500">
                        Aucun client trouvé
                      </li>
                    )}
                  </ul>
                </div>
              )}
              
              {selectedCustomer && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <div className="flex justify-between">
                    <div>
                      <p className="font-medium">{selectedCustomer.name}</p>
                      {selectedCustomer.email && <p className="text-sm text-gray-500">{selectedCustomer.email}</p>}
                      {selectedCustomer.phone && <p className="text-sm text-gray-500">{selectedCustomer.phone}</p>}
                    </div>
                    <span className={`h-fit px-2 py-1 rounded-full text-xs ${
                      selectedCustomer.customer_group === 'pro' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {selectedCustomer.customer_group === 'pro' ? 'Pro' : 'Particulier'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Quote Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statut
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="draft">Brouillon</option>
                <option value="sent">Envoyé</option>
                <option value="accepted">Accepté</option>
                <option value="refused">Refusé</option>
              </select>
            </div>

            {/* Document Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de document <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.document_type_id || ''}
                onChange={(e) => {
                  console.log('Document type selected:', e.target.value);
                  setFormData(prev => ({ ...prev, document_type_id: e.target.value }));
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">-- Sélectionner un type --</option>
                {documentTypes.map(type => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Date Issued */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'émission
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.date_issued}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_issued: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>
            
            {/* Date Expiry */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date d'expiration
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={formData.date_expiry}
                  onChange={(e) => setFormData(prev => ({ ...prev, date_expiry: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              </div>
            </div>
          </div>
          
          {/* Addresses Section */}
          <div className={`mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 ${isClientSectionCollapsed ? 'hidden' : ''}`}>
            {/* Billing Address */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Adresse de facturation
                </label>
                <label className="text-xs text-gray-600 flex items-center gap-1">
                  <input type="checkbox" checked={billingManual} onChange={(e) => setBillingManual(e.target.checked)} />
                  Saisie manuelle
                </label>
              </div>
              {billingManual && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  <input className="px-3 py-2 border rounded-md col-span-2" placeholder="Ligne 1"
                         value={formData.billing_address_json?.line1 || ''}
                         onChange={(e) => setFormData(prev => ({ ...prev, billing_address_json: { ...(prev.billing_address_json as any) || {}, line1: e.target.value } as any }))} />
                  <input className="px-3 py-2 border rounded-md col-span-2" placeholder="Ligne 2"
                         value={formData.billing_address_json?.line2 || ''}
                         onChange={(e) => setFormData(prev => ({ ...prev, billing_address_json: { ...(prev.billing_address_json as any) || {}, line2: e.target.value } as any }))} />
                  <input className="px-3 py-2 border rounded-md" placeholder="Code postal"
                         value={formData.billing_address_json?.zip || ''}
                         onChange={(e) => setFormData(prev => ({ ...prev, billing_address_json: { ...(prev.billing_address_json as any) || {}, zip: e.target.value } as any }))} />
                  <input className="px-3 py-2 border rounded-md" placeholder="Ville"
                         value={formData.billing_address_json?.city || ''}
                         onChange={(e) => setFormData(prev => ({ ...prev, billing_address_json: { ...(prev.billing_address_json as any) || {}, city: e.target.value } as any }))} />
                  <input className="px-3 py-2 border rounded-md col-span-2" placeholder="Pays"
                         value={formData.billing_address_json?.country || ''}
                         onChange={(e) => setFormData(prev => ({ ...prev, billing_address_json: { ...(prev.billing_address_json as any) || {}, country: e.target.value } as any }))} />
                </div>
              )}
              {selectedCustomer && selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (
                <select
                  onChange={(e) => {
                    const addressId = e.target.value;
                    if (addressId) {
                      const address = selectedCustomer.addresses?.find(a => a.id === addressId);
                      if (address) {
                        const addressJson: Address = {
                          line1: address.line1,
                          line2: address.line2 || '',
                          zip: address.zip,
                          city: address.city,
                          country: address.country
                        };
                        setFormData(prev => ({ ...prev, billing_address_json: addressJson }));
                      }
                    } else {
                      setFormData(prev => ({ ...prev, billing_address_json: null }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  defaultValue={selectedCustomer.addresses.find(a => a.address_type === 'billing' && a.is_default)?.id || ''}
                >
                  <option value="">Sélectionner une adresse</option>
                  {selectedCustomer.addresses
                    .filter(address => address.address_type === 'billing')
                    .map(address => (
                      <option key={address.id} value={address.id}>
                        {address.line1}, {address.zip} {address.city}
                      </option>
                    ))}
                </select>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  Aucune adresse de facturation disponible
                </div>
              )}
              
              {formData.billing_address_json && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <p>{formData.billing_address_json.line1}</p>
                  {formData.billing_address_json.line2 && <p>{formData.billing_address_json.line2}</p>}
                  <p>{formData.billing_address_json.zip} {formData.billing_address_json.city}</p>
                  <p>{formData.billing_address_json.country}</p>
                </div>
              )}
            </div>
            
            {/* Shipping Address */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Adresse de livraison
                </label>
                <label className="text-xs text-gray-600 flex items-center gap-1">
                  <input type="checkbox" checked={shippingManual} onChange={(e) => setShippingManual(e.target.checked)} />
                  Saisie manuelle
                </label>
              </div>
              {shippingManual && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                  <input className="px-3 py-2 border rounded-md col-span-2" placeholder="Ligne 1"
                         value={formData.shipping_address_json?.line1 || ''}
                         onChange={(e) => setFormData(prev => ({ ...prev, shipping_address_json: { ...(prev.shipping_address_json as any) || {}, line1: e.target.value } as any }))} />
                  <input className="px-3 py-2 border rounded-md col-span-2" placeholder="Ligne 2"
                         value={formData.shipping_address_json?.line2 || ''}
                         onChange={(e) => setFormData(prev => ({ ...prev, shipping_address_json: { ...(prev.shipping_address_json as any) || {}, line2: e.target.value } as any }))} />
                  <input className="px-3 py-2 border rounded-md" placeholder="Code postal"
                         value={formData.shipping_address_json?.zip || ''}
                         onChange={(e) => setFormData(prev => ({ ...prev, shipping_address_json: { ...(prev.shipping_address_json as any) || {}, zip: e.target.value } as any }))} />
                  <input className="px-3 py-2 border rounded-md" placeholder="Ville"
                         value={formData.shipping_address_json?.city || ''}
                         onChange={(e) => setFormData(prev => ({ ...prev, shipping_address_json: { ...(prev.shipping_address_json as any) || {}, city: e.target.value } as any }))} />
                  <input className="px-3 py-2 border rounded-md col-span-2" placeholder="Pays"
                         value={formData.shipping_address_json?.country || ''}
                         onChange={(e) => setFormData(prev => ({ ...prev, shipping_address_json: { ...(prev.shipping_address_json as any) || {}, country: e.target.value } as any }))} />
                </div>
              )}
              {selectedCustomer && selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (
                <select
                  onChange={(e) => {
                    const addressId = e.target.value;
                    if (addressId) {
                      const address = selectedCustomer.addresses?.find(a => a.id === addressId);
                      if (address) {
                        const addressJson: Address = {
                          line1: address.line1,
                          line2: address.line2 || '',
                          zip: address.zip,
                          city: address.city,
                          country: address.country
                        };
                        setFormData(prev => ({ ...prev, shipping_address_json: addressJson }));
                      }
                    } else {
                      setFormData(prev => ({ ...prev, shipping_address_json: null }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  defaultValue={selectedCustomer.addresses.find(a => a.address_type === 'shipping' && a.is_default)?.id || ''}
                >
                  <option value="">Sélectionner une adresse</option>
                  {selectedCustomer.addresses
                    .filter(address => address.address_type === 'shipping')
                    .map(address => (
                      <option key={address.id} value={address.id}>
                        {address.line1}, {address.zip} {address.city}
                      </option>
                    ))}
                </select>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  Aucune adresse de livraison disponible
                </div>
              )}
              
              {formData.shipping_address_json && (
                <div className="mt-2 p-3 bg-gray-50 rounded-md">
                  <p>{formData.shipping_address_json.line1}</p>
                  {formData.shipping_address_json.line2 && <p>{formData.shipping_address_json.line2}</p>}
                  <p>{formData.shipping_address_json.zip} {formData.shipping_address_json.city}</p>
                  <p>{formData.shipping_address_json.country}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Note */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Notes ou informations supplémentaires..."
            />
          </div>
        </div>
        
        {/* Items Section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center">
              <FileText size={20} className="mr-2" />
              Articles
            </h2>
            
            {/* CSV Import Button */}
            <CSVImportArticles 
              onImportComplete={handleImportedItems}
              documentType="quote"
            />
          </div>
          
          {/* Add New Item */}
          <div className="mb-6 p-4 border border-gray-200 rounded-md">
            <h3 className="text-md font-medium mb-3">Ajouter un article</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Product Search */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Produit
                </label>
                <div className="relative">
                  <ProductSearch onSearch={(q) => { setProductSearchTerm(q); setShowProductDropdown(true); }} initialQuery={productSearchTerm} />
                </div>
                
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md max-h-60 overflow-auto">
                    <ul className="py-1">
                      {filteredProducts.map(product => (
                        <li 
                          key={product.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleProductSelect(product)}
                        >
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                          <div className="text-sm text-gray-500">
                            Prix: {formatCurrency(docCustomerType === 'pro' ? Number((product as any).pro_price || 0) : Number((product as any).retail_price || 0))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newItem.description}
                  onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Description de l'article"
                  required
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantité <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={newItem.quantity}
                  onChange={(e) => {
                    const quantity = parseInt(e.target.value);
                    setNewItem(prev => ({
                      ...prev,
                      quantity,
                      total_price: quantity * (prev.unit_price || 0)
                    }));
                  }}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              {/* Unit Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prix unitaire HT <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={newItem.unit_price}
                  onChange={(e) => {
                    const unitPrice = parseFloat(e.target.value);
                    setNewItem(prev => ({
                      ...prev,
                      unit_price: unitPrice,
                      total_price: (prev.quantity || 0) * unitPrice
                    }));
                  }}
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              {/* Tax Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Taux TVA (%)
                </label>
                <select
                  value={newItem.tax_rate}
                  onChange={(e) => setNewItem(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="20">20%</option>
                  <option value="10">10%</option>
                  <option value="5.5">5.5%</option>
                  <option value="2.1">2.1%</option>
                  <option value="0">0%</option>
                </select>
              </div>
              
              {/* Total Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total HT
                </label>
                <input
                  type="number"
                  value={newItem.total_price}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                <Plus size={18} />
                Ajouter l'article
              </button>
            </div>
          </div>
          
          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantité
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prix unitaire HT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TVA
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total HT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.length > 0 ? (
                  items.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => handleUpdateItem(index, 'description', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value))}
                          min="1"
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => handleUpdateItem(index, 'unit_price', parseFloat(e.target.value))}
                          min="0"
                          step="0.01"
                          className="w-24 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={item.tax_rate}
                          onChange={(e) => handleUpdateItem(index, 'tax_rate', parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="20">20%</option>
                          <option value="10">10%</option>
                          <option value="5.5">5.5%</option>
                          <option value="2.1">2.1%</option>
                          <option value="0">0%</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formatCurrency(item.total_price || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      Aucun article ajouté
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Totals */}
          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs">
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Total HT:</span>
                  <span className="font-medium">{formatCurrency(totals.totalHT)}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">TVA:</span>
                  <span className="font-medium">{formatCurrency(totals.totalTVA)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Total TTC:</span>
                  <span>{formatCurrency(totals.totalTTC)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Bouton d'action en bas */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Save size={18} />
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
};
