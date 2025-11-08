/**
 * PartSearchAttach Component
 * Recherche et association de pièces avec gestion de stock
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Plus, Package, ShoppingCart, AlertCircle, X } from 'lucide-react';

interface PartSearchAttachProps {
  onPartsChange: (parts: AttachedPart[]) => void;
  initialParts?: AttachedPart[];
}

export interface AttachedPart {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  stock_id: string | null;
  stock_name: string | null;
  quantity: number;
  action: 'reserve' | 'order' | 'quick_create';
  purchase_price?: number;
  vat_regime?: 'normal' | 'margin';
}

interface QuickCreateFormData {
  sku: string;
  name: string;
  purchase_price: string;
  vat_type: 'normal' | 'margin';
  ean: string;
  quantity: string;
  stock_id: string;
}

export function PartSearchAttach({ onPartsChange, initialParts }: PartSearchAttachProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [attachedParts, setAttachedParts] = useState<AttachedPart[]>(initialParts || []);
  const [stocks, setStocks] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedStock, setSelectedStock] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [availableStocks, setAvailableStocks] = useState<any[]>([]);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickCreateData, setQuickCreateData] = useState<QuickCreateFormData>({
    sku: '',
    name: '',
    purchase_price: '',
    vat_type: 'normal',
    ean: '',
    quantity: '1',
    stock_id: '',
  });
  const [error, setError] = useState<string | null>(null);

  console.log('[PartSearchAttach] Rendered, attachedParts:', attachedParts.length);

  useEffect(() => {
    loadStocks();
  }, []);

  const loadStocks = async () => {
    console.log('[PartSearchAttach] Chargement des stocks');
    try {
      const { data, error } = await supabase
        .from('stocks')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('[PartSearchAttach] Erreur chargement stocks:', error);
      } else {
        console.log('[PartSearchAttach] Stocks chargés:', data.length);
        setStocks(data || []);
        if (data && data.length > 0 && !selectedStock) {
          setSelectedStock(data[0].id);
          setQuickCreateData({ ...quickCreateData, stock_id: data[0].id });
        }
      }
    } catch (err) {
      console.error('[PartSearchAttach] Exception chargement stocks:', err);
    }
  };

  const searchProducts = async (term: string) => {
    if (!term || term.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    console.log('[PartSearchAttach] Recherche produits avec terme:', term);
    setIsSearching(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          purchase_price,
          vat_type,
          product_stocks!inner (
            id,
            quantity,
            stock:stocks (
              id,
              name
            )
          )
        `)
        .or(`name.ilike.%${term}%,sku.ilike.%${term}%`)
        .limit(10);

      if (error) {
        console.error('[PartSearchAttach] Erreur recherche:', error);
        setSearchResults([]);
        setError('Erreur lors de la recherche');
      } else {
        console.log('[PartSearchAttach] Résultats trouvés:', data?.length);
        // Enrichir les données avec le total des stocks
        const enrichedData = (data || []).map(product => {
          const stocks = product.product_stocks || [];
          const totalStock = stocks.reduce((sum: number, ps: any) => sum + (ps.quantity || 0), 0);
          return {
            ...product,
            stocks,
            totalStock
          };
        });
        console.log('[PartSearchAttach] Données enrichies avec stocks:', enrichedData);
        setSearchResults(enrichedData);
      }
    } catch (err) {
      console.error('[PartSearchAttach] Exception recherche:', err);
      setSearchResults([]);
      setError('Erreur inattendue lors de la recherche');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchProducts(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSelectProduct = (product: any) => {
    console.log('[PartSearchAttach] Produit sélectionné:', product);
    setSelectedProduct(product);
    setSearchTerm('');
    setSearchResults([]);

    // Filtrer les stocks disponibles (quantité > 0)
    const availStocks = (product.stocks || [])
      .filter((ps: any) => ps.quantity > 0)
      .map((ps: any) => ({
        id: ps.stock?.id,
        name: ps.stock?.name,
        quantity: ps.quantity,
        product_stock_id: ps.id
      }));

    console.log('[PartSearchAttach] Stocks disponibles pour ce produit:', availStocks);
    setAvailableStocks(availStocks);

    // Présélectionner le premier stock disponible s'il existe
    if (availStocks.length > 0) {
      setSelectedStock(availStocks[0].id);
    } else {
      setSelectedStock('');
    }

    // Réinitialiser la quantité
    setQuantity(1);
  };

  const handleAttachPart = (action: 'reserve' | 'order') => {
    if (!selectedProduct) {
      setError('Aucun produit sélectionné');
      return;
    }

    if (action === 'reserve' && !selectedStock) {
      setError('Veuillez sélectionner un stock');
      return;
    }

    if (quantity <= 0) {
      setError('La quantité doit être supérieure à 0');
      return;
    }

    // Validation de la quantité pour les réservations
    if (action === 'reserve') {
      const selectedStockInfo = availableStocks.find(s => s.id === selectedStock);
      if (!selectedStockInfo) {
        setError('Stock sélectionné introuvable');
        return;
      }

      if (quantity > selectedStockInfo.quantity) {
        setError(`Quantité insuffisante. Maximum disponible: ${selectedStockInfo.quantity}`);
        return;
      }

      console.log('[PartSearchAttach] Validation OK - Stock disponible:', selectedStockInfo.quantity, 'Quantité demandée:', quantity);
    }

    console.log('[PartSearchAttach] Ajout pièce, action:', action);

    const stockInfo = action === 'reserve'
      ? availableStocks.find(s => s.id === selectedStock)
      : null;

    const newPart: AttachedPart = {
      id: `${Date.now()}-${selectedProduct.id}`,
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      product_sku: selectedProduct.sku,
      stock_id: action === 'reserve' ? selectedStock : null,
      stock_name: stockInfo?.name || null,
      quantity,
      action,
      purchase_price: selectedProduct.purchase_price,
      vat_regime: selectedProduct.vat_type,
    };

    const updatedParts = [...attachedParts, newPart];
    setAttachedParts(updatedParts);
    onPartsChange(updatedParts);

    setSelectedProduct(null);
    setAvailableStocks([]);
    setQuantity(1);
    setError(null);

    console.log('[PartSearchAttach] Pièce ajoutée, total:', updatedParts.length);
  };

  const handleQuickCreate = async () => {
    console.log('[PartSearchAttach] Création rapide article:', quickCreateData);

    if (!quickCreateData.sku || !quickCreateData.name || !quickCreateData.purchase_price) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!quickCreateData.stock_id) {
      setError('Veuillez sélectionner un stock');
      return;
    }

    const qty = parseInt(quickCreateData.quantity);
    if (isNaN(qty) || qty <= 0) {
      setError('Quantité invalide');
      return;
    }

    try {
      // Créer le produit
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          sku: quickCreateData.sku,
          name: quickCreateData.name,
          purchase_price: parseFloat(quickCreateData.purchase_price),
          vat_type: quickCreateData.vat_type,
          ean: quickCreateData.ean || null,
          stock_management: 'simple',
        })
        .select()
        .single();

      if (productError) {
        console.error('[PartSearchAttach] Erreur création produit:', productError);
        setError('Erreur lors de la création du produit');
        return;
      }

      console.log('[PartSearchAttach] Produit créé:', product.id);

      // Ajouter le stock
      const { error: stockError } = await supabase
        .from('product_stocks')
        .insert({
          product_id: product.id,
          stock_id: quickCreateData.stock_id,
          quantity: qty,
        });

      if (stockError) {
        console.error('[PartSearchAttach] Erreur ajout stock:', stockError);
        setError('Produit créé mais erreur lors de l\'ajout du stock');
      } else {
        console.log('[PartSearchAttach] Stock ajouté, quantité:', qty);
      }

      // Ajouter à la liste des pièces attachées
      const stockInfo = stocks.find(s => s.id === quickCreateData.stock_id);

      const newPart: AttachedPart = {
        id: `${Date.now()}-${product.id}`,
        product_id: product.id,
        product_name: product.name,
        product_sku: product.sku,
        stock_id: quickCreateData.stock_id,
        stock_name: stockInfo?.name || null,
        quantity: qty,
        action: 'quick_create',
        purchase_price: parseFloat(quickCreateData.purchase_price),
        vat_regime: quickCreateData.vat_type,
      };

      const updatedParts = [...attachedParts, newPart];
      setAttachedParts(updatedParts);
      onPartsChange(updatedParts);

      setShowQuickCreate(false);
      setQuickCreateData({
        sku: '',
        name: '',
        purchase_price: '',
        vat_type: 'normal',
        ean: '',
        quantity: '1',
        stock_id: stocks[0]?.id || '',
      });
      setError(null);

      console.log('[PartSearchAttach] Article créé et ajouté avec succès');
    } catch (err) {
      console.error('[PartSearchAttach] Exception création article:', err);
      setError('Erreur inattendue lors de la création');
    }
  };

  const handleRemovePart = (id: string) => {
    console.log('[PartSearchAttach] Suppression pièce:', id);
    const updatedParts = attachedParts.filter(p => p.id !== id);
    setAttachedParts(updatedParts);
    onPartsChange(updatedParts);
  };

  if (showQuickCreate) {
    return (
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Créer un article rapide</h3>
          <button
            type="button"
            onClick={() => {
              setShowQuickCreate(false);
              setError(null);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
            <input
              type="text"
              value={quickCreateData.sku}
              onChange={(e) => setQuickCreateData({ ...quickCreateData, sku: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="REF-001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
            <input
              type="text"
              value={quickCreateData.name}
              onChange={(e) => setQuickCreateData({ ...quickCreateData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Écran iPhone 12"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix d'achat *</label>
              <input
                type="number"
                step="0.01"
                value={quickCreateData.purchase_price}
                onChange={(e) => setQuickCreateData({ ...quickCreateData, purchase_price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Régime TVA *</label>
              <select
                value={quickCreateData.vat_type}
                onChange={(e) => setQuickCreateData({ ...quickCreateData, vat_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="normal">Normal</option>
                <option value="margin">Marge</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">EAN</label>
            <input
              type="text"
              value={quickCreateData.ean}
              onChange={(e) => setQuickCreateData({ ...quickCreateData, ean: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Code-barres"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
              <input
                type="number"
                min="1"
                value={quickCreateData.quantity}
                onChange={(e) => setQuickCreateData({ ...quickCreateData, quantity: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
              <select
                value={quickCreateData.stock_id}
                onChange={(e) => setQuickCreateData({ ...quickCreateData, stock_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                {stocks.map((stock) => (
                  <option key={stock.id} value={stock.id}>{stock.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={() => {
              setShowQuickCreate(false);
              setError(null);
            }}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleQuickCreate}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Créer et ajouter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Package size={20} className="text-blue-600" />
        <h3 className="font-semibold text-gray-900">Pièces nécessaires</h3>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Liste des pièces attachées */}
      {attachedParts.length > 0 && (
        <div className="mb-4 space-y-2">
          {attachedParts.map((part) => (
            <div key={part.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{part.product_name}</p>
                  <p className="text-sm text-gray-600">SKU: {part.product_sku}</p>
                  <p className="text-sm text-gray-600">Quantité: {part.quantity}</p>
                  {part.stock_name && <p className="text-sm text-gray-600">Stock: {part.stock_name}</p>}
                  <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded ${
                    part.action === 'reserve' ? 'bg-green-100 text-green-700' :
                    part.action === 'order' ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {part.action === 'reserve' ? '✓ En stock' :
                     part.action === 'order' ? '🛒 À commander' :
                     '⚡ Créé'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePart(part.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recherche produit */}
      {!selectedProduct && (
        <>
          <div className="relative mb-4">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un produit..."
              className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-base"
            />
          </div>

          {isSearching && (
            <div className="text-center py-4 text-gray-500">
              Recherche en cours...
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 mb-4 max-h-64 overflow-y-auto">
              {searchResults.map((product) => {
                const hasStock = product.totalStock > 0;
                const stockList = product.stocks || [];

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelectProduct(product)}
                    className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-gray-900">{product.name}</p>
                    <p className="text-sm text-gray-600">SKU: {product.sku}</p>

                    {/* Affichage des stocks disponibles */}
                    <div className="mt-1 flex flex-wrap gap-2">
                      {stockList.map((ps: any) => (
                        <span
                          key={ps.id}
                          className={`text-xs px-2 py-0.5 rounded ${
                            ps.quantity > 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {ps.stock?.name}: {ps.quantity}
                        </span>
                      ))}
                      {stockList.length === 0 && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                          Aucun stock
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowQuickCreate(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
          >
            <Plus size={20} />
            <span>Créer article rapide</span>
          </button>
        </>
      )}

      {/* Actions si produit sélectionné */}
      {selectedProduct && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="font-medium text-gray-900">{selectedProduct.name}</p>
            <p className="text-sm text-gray-600">SKU: {selectedProduct.sku}</p>
          </div>

          {/* Afficher les stocks disponibles */}
          {availableStocks.length > 0 ? (
            <>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800 mb-2">Stocks disponibles :</p>
                <div className="flex flex-wrap gap-2">
                  {availableStocks.map((stock) => (
                    <span key={stock.id} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                      {stock.name}: {stock.quantity}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label>
                  <input
                    type="number"
                    min="1"
                    max={availableStocks.find(s => s.id === selectedStock)?.quantity || 999}
                    value={quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      const maxQty = availableStocks.find(s => s.id === selectedStock)?.quantity || 999;
                      setQuantity(Math.min(val, maxQty));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  {availableStocks.find(s => s.id === selectedStock) && (
                    <p className="text-xs text-gray-500 mt-1">
                      Max: {availableStocks.find(s => s.id === selectedStock)?.quantity}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <select
                    value={selectedStock}
                    onChange={(e) => setSelectedStock(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {availableStocks.map((stock) => (
                      <option key={stock.id} value={stock.id}>
                        {stock.name} ({stock.quantity} dispo)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-800">
                ⚠️ Aucun stock disponible pour ce produit. Vous pouvez uniquement le commander.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleAttachPart('reserve')}
              disabled={availableStocks.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Package size={18} />
              <span>Attribuer</span>
            </button>
            <button
              type="button"
              onClick={() => handleAttachPart('order')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
            >
              <ShoppingCart size={18} />
              <span>À commander</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setSelectedProduct(null);
              setAvailableStocks([]);
              setQuantity(1);
            }}
            className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
