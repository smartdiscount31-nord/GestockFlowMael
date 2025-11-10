/**
 * ClientForm Component
 * Formulaire de saisie/recherche client pour prise en charge atelier
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Plus, User } from 'lucide-react';

interface ClientFormProps {
  onClientSelected: (client: any) => void;
  initialClient?: any;
}

export function ClientForm({ onClientSelected, initialClient }: ClientFormProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(initialClient || null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
  });

  console.log('[ClientForm] Rendered, selectedClient:', selectedClient);

  useEffect(() => {
    if (initialClient) {
      setSelectedClient(initialClient);
      onClientSelected(initialClient);
    }
  }, [initialClient]);

  const searchClients = async (term: string) => {
    if (!term || term.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    console.log('[ClientForm] Recherche clients avec terme:', term);
    setIsSearching(true);

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone')
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(10);

      if (error) {
        console.error('[ClientForm] Erreur recherche:', error);
        setSearchResults([]);
      } else {
        console.log('[ClientForm] Résultats trouvés:', data.length);
        setSearchResults(data || []);
      }
    } catch (err) {
      console.error('[ClientForm] Exception recherche:', err);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      searchClients(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSelectClient = (client: any) => {
    console.log('[ClientForm] Client sélectionné:', client);
    setSelectedClient(client);
    setSearchTerm('');
    setSearchResults([]);
    onClientSelected(client);
  };

  const validateNewClient = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!newClient.name.trim()) {
      newErrors.name = 'Le nom est obligatoire';
    }

    if (!newClient.phone.trim()) {
      newErrors.phone = 'Le téléphone est obligatoire';
    } else if (!/^[\d\s\+\-\(\)]+$/.test(newClient.phone)) {
      newErrors.phone = 'Format de téléphone invalide';
    }

    if (newClient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newClient.email)) {
      newErrors.email = 'Format d\'email invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateClient = async () => {
    console.log('[ClientForm] Création nouveau client:', newClient);

    if (!validateNewClient()) {
      console.log('[ClientForm] Validation échouée');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: newClient.name.trim(),
          email: newClient.email.trim() || null,
          phone: newClient.phone.trim(),
          customer_group: 'particulier',
        })
        .select()
        .single();

      if (error) {
        console.error('[ClientForm] Erreur création client:', error);
        setErrors({ submit: 'Erreur lors de la création du client' });
        return;
      }

      console.log('[ClientForm] Client créé avec succès:', data);
      setSelectedClient(data);
      setShowCreateForm(false);
      setNewClient({ name: '', email: '', phone: '' });
      setErrors({});
      onClientSelected(data);
    } catch (err) {
      console.error('[ClientForm] Exception création client:', err);
      setErrors({ submit: 'Erreur inattendue lors de la création' });
    }
  };

  if (selectedClient) {
    return (
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <User size={20} className="text-blue-600" />
            <h3 className="font-semibold text-gray-900">Client sélectionné</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedClient(null);
              onClientSelected(null);
            }}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Changer
          </button>
        </div>

        <div className="space-y-1 text-sm">
          <p className="text-gray-900 font-medium">{selectedClient.name}</p>
          {selectedClient.phone && <p className="text-gray-600">📞 {selectedClient.phone}</p>}
          {selectedClient.email && <p className="text-gray-600">✉️ {selectedClient.email}</p>}
        </div>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4">Nouveau client</h3>

        <div className="space-y-4">
          <div>
            <label htmlFor="new-client-name" className="block text-sm font-medium text-gray-700 mb-1">
              Nom *
            </label>
            <input
              type="text"
              id="new-client-name"
              value={newClient.name}
              onChange={(e) => {
                setNewClient({ ...newClient, name: e.target.value });
                setErrors({ ...errors, name: '' });
              }}
              className={`w-full px-3 py-3 border rounded-lg text-base ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Nom complet"
            />
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="new-client-phone" className="block text-sm font-medium text-gray-700 mb-1">
              Téléphone *
            </label>
            <input
              type="tel"
              id="new-client-phone"
              value={newClient.phone}
              onChange={(e) => {
                setNewClient({ ...newClient, phone: e.target.value });
                setErrors({ ...errors, phone: '' });
              }}
              className={`w-full px-3 py-3 border rounded-lg text-base ${
                errors.phone ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="06 12 34 56 78"
            />
            {errors.phone && <p className="text-red-600 text-sm mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label htmlFor="new-client-email" className="block text-sm font-medium text-gray-700 mb-1">
              Email (optionnel)
            </label>
            <input
              type="email"
              id="new-client-email"
              value={newClient.email}
              onChange={(e) => {
                setNewClient({ ...newClient, email: e.target.value });
                setErrors({ ...errors, email: '' });
              }}
              className={`w-full px-3 py-3 border rounded-lg text-base ${
                errors.email ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="email@exemple.com"
            />
            {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
          </div>

          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{errors.submit}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button
            type="button"
            onClick={() => {
              setShowCreateForm(false);
              setNewClient({ name: '', email: '', phone: '' });
              setErrors({});
            }}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleCreateClient}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Créer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <h3 className="font-semibold text-gray-900 mb-4">Rechercher un client</h3>

      <div className="relative mb-4">
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Nom, téléphone ou email..."
          className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-base"
        />
      </div>

      {isSearching && (
        <div className="text-center py-4 text-gray-500">
          Recherche en cours...
        </div>
      )}

      {!isSearching && searchResults.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 mb-4 max-h-60 overflow-y-auto">
          {searchResults.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => handleSelectClient(client)}
              className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
            >
              <p className="font-medium text-gray-900">{client.name}</p>
              <p className="text-sm text-gray-600">{client.phone}</p>
              {client.email && <p className="text-sm text-gray-500">{client.email}</p>}
            </button>
          ))}
        </div>
      )}

      {!isSearching && searchTerm.length >= 2 && searchResults.length === 0 && (
        <div className="text-center py-4 text-gray-500 mb-4">
          Aucun client trouvé
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowCreateForm(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
      >
        <Plus size={20} />
        <span>Créer un nouveau client</span>
      </button>
    </div>
  );
}
