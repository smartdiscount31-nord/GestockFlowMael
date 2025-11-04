import React, { useState, useEffect } from 'react';
import { CustomerList } from '../components/Customers/CustomerList';
import { CustomerForm } from '../components/Customers/CustomerForm';
import { CustomerDetail } from '../components/Customers/CustomerDetail';
import { useCustomerStore } from '../store/customerStore';

export const Customers: React.FC = () => {
  const [view, setView] = useState<'list' | 'new' | 'edit' | 'view'>('list');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const { customers, fetchCustomers, addCustomer, updateCustomer } = useCustomerStore();

  useEffect(() => {
    // Check if we have a customer ID in session storage
    const editId = sessionStorage.getItem('editCustomerId');
    const viewId = sessionStorage.getItem('viewCustomerId');
    
    if (editId) {
      setSelectedCustomerId(editId);
      setView('edit');
      sessionStorage.removeItem('editCustomerId');
    } else if (viewId) {
      setSelectedCustomerId(viewId);
      setView('view');
      sessionStorage.removeItem('viewCustomerId');
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const selectedCustomer = (customers || []).find((c: any) => c.id === selectedCustomerId) || null;

  const handleCreate = async (payload: any) => {
    // payload: { name, email, phone, customer_group, address? ... }
    const base = {
      name: (payload?.name || '').trim(),
      email: payload?.email || null,
      phone: payload?.phone || null,
      customer_group: ((payload?.customer_group || 'particulier').toLowerCase() === 'pro') ? 'pro' : 'particulier',
      address: payload?.address || null,
    };
    const res = await addCustomer(base);
    if (res?.id) {
      await fetchCustomers();
      setSelectedCustomerId(res.id);
      setView('view');
    } else {
      // stay on form; error already set in store
      console.warn('[Customers] addCustomer returned null');
    }
  };

  const handleUpdate = async (payload: any) => {
    if (!selectedCustomerId) return;
    const base: any = {
      name: (payload?.name || '').trim(),
      email: payload?.email || null,
      phone: payload?.phone || null,
      customer_group: ((payload?.customer_group || 'particulier').toLowerCase() === 'pro') ? 'pro' : 'particulier',
      address: payload?.address || null,
    };
    const res = await updateCustomer(selectedCustomerId, base);
    if (res?.id) {
      await fetchCustomers();
      setView('view');
    } else {
      console.warn('[Customers] updateCustomer returned null');
    }
  };

  const renderContent = () => {
    switch (view) {
      case 'new':
        return <CustomerForm onSave={handleCreate} onCancel={() => setView('list')} />;
      case 'edit':
        return selectedCustomer ? (
          <CustomerForm 
            customer={selectedCustomer} 
            onSave={handleUpdate}
            onCancel={() => setView('list')}
          />
        ) : (
          <div>Erreur: ID client manquant</div>
        );
      case 'view':
        return selectedCustomer ? (
          <CustomerDetail 
            customer={selectedCustomer}
            onClose={() => setView('list')}
            onEdit={() => setView('edit')}
          />
        ) : (
          <div>Erreur: ID client manquant</div>
        );
      case 'list':
      default:
        return (
          <CustomerList
            customers={customers}
            onNew={() => setView('new')}
            onEdit={(id: string) => {
              setSelectedCustomerId(id);
              setView('edit');
            }}
            onView={(id: string) => {
              setSelectedCustomerId(id);
              setView('view');
            }}
          />
        );
    }
  };

  return (
    <div className="container mx-auto">
      {renderContent()}
    </div>
  );
};
