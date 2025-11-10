import React from 'react';
import { X } from 'lucide-react';

export interface StockOption {
  stock_id: string;
  stock_name: string;
  quantity: number;
}

interface StockSelectionModalProps {
  isOpen: boolean;
  productName: string;
  productSku: string;
  stocks: StockOption[];
  selectedStockId?: string;
  onSelect: (stockId: string) => void;
  onClose: () => void;
}

export const StockSelectionModal: React.FC<StockSelectionModalProps> = ({
  isOpen,
  productName,
  productSku,
  stocks,
  selectedStockId,
  onSelect,
  onClose,
}) => {
  console.log('[StockSelectionModal] Rendered with', stocks.length, 'stock options');

  if (!isOpen) return null;

  const handleStockSelect = (stockId: string) => {
    console.log('[StockSelectionModal] Stock selected:', stockId);
    onSelect(stockId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Sélectionner un dépôt</h3>
            <p className="text-sm text-gray-600 mt-1">
              {productName} <span className="text-gray-400">({productSku})</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stock List */}
        <div className="flex-1 overflow-y-auto p-4">
          {stocks.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucun stock disponible pour ce produit
            </div>
          ) : (
            <div className="space-y-2">
              {stocks.map((stock) => (
                <button
                  key={stock.stock_id}
                  onClick={() => handleStockSelect(stock.stock_id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedStockId === stock.stock_id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        📦 {stock.stock_name}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Quantité disponible:{' '}
                        <span
                          className={`font-semibold ${
                            stock.quantity > 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {stock.quantity}
                        </span>
                      </div>
                    </div>
                    {selectedStockId === stock.stock_id && (
                      <div className="ml-3 text-blue-600">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
};
