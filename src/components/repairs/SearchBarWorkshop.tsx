/**
 * SearchBarWorkshop Component
 * Barre de recherche pour filtrer les tickets de réparation
 * Recherche par nom client, téléphone, ou numéro de réparation
 */

import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarWorkshopProps {
  onSearch: (query: string) => void;
  totalCount: number;
}

export function SearchBarWorkshop({ onSearch, totalCount }: SearchBarWorkshopProps) {
  const [searchQuery, setSearchQuery] = useState('');

  console.log('[SearchBarWorkshop] Rendered with totalCount:', totalCount);

  const handleSearch = (value: string) => {
    console.log('[SearchBarWorkshop] Search query changed:', value);
    setSearchQuery(value);
    onSearch(value);
  };

  const handleClear = () => {
    console.log('[SearchBarWorkshop] Clearing search');
    setSearchQuery('');
    onSearch('');
  };

  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      <div className="relative flex-1 max-w-md">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher par nom, téléphone, n° réparation..."
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Effacer la recherche"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
        <span className="text-sm font-medium text-blue-900">Total tickets:</span>
        <span className="text-lg font-bold text-blue-600">{totalCount}</span>
      </div>
    </div>
  );
}
