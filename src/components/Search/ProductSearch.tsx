/**
 * ProductSearch Component
 * Specialized search component for products
 */

import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface ProductSearchProps {
  onSearch?: (query: string) => void;
  placeholder?: string;
  initialQuery?: string;
}

export function ProductSearch({ onSearch, placeholder = 'Rechercher un produit...', initialQuery = '' }: ProductSearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const debounceRef = useRef<number | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[ProductSearch] Search query:', query);
    if (onSearch) {
      onSearch(query);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    // Debounce 300ms to avoid flooding
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      if (onSearch) onSearch(value);
    }, 300);
  };

  // Synchroniser si le parent change la valeur initiale (ex: recherche globale)
  React.useEffect(() => {
    setQuery(initialQuery || '');
  }, [initialQuery]);

  return (
    <div className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              if (onSearch) onSearch(query);
            }
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
    </div>
  );
}
