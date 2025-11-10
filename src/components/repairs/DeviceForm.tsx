/**
 * DeviceForm Component
 * Formulaire de saisie des informations de l'appareil
 */

import React, { useState } from 'react';
import { Smartphone } from 'lucide-react';

interface DeviceFormProps {
  onDeviceDataChange: (data: DeviceData) => void;
  initialData?: DeviceData;
}

export interface DeviceData {
  device_brand: string;
  device_model: string;
  device_color: string;
  imei: string;
  serial_number: string;
  pin_code: string;
  issue_description: string;
  power_state: 'ok' | 'lcd_off' | 'no_sign';
  price_known: boolean;
  estimate_amount?: number | null;
}

export function DeviceForm({ onDeviceDataChange, initialData }: DeviceFormProps) {
  const [formData, setFormData] = useState<DeviceData>(initialData || {
    device_brand: '',
    device_model: '',
    device_color: '',
    imei: '',
    serial_number: '',
    pin_code: '',
    issue_description: '',
    power_state: 'ok',
    price_known: false,
    estimate_amount: null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  console.log('[DeviceForm] Rendered, formData:', formData);

  const handleChange = (field: keyof DeviceData, value: any) => {
    console.log('[DeviceForm] Champ modifié:', field, value);
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    onDeviceDataChange(newData);

    // Clear error for this field
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const powerStateOptions = [
    { value: 'ok', label: 'Fonctionne normalement', icon: '✅' },
    { value: 'lcd_off', label: 'Écran éteint', icon: '🔲' },
    { value: 'no_sign', label: 'Aucun signe de vie', icon: '❌' },
  ];

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Smartphone size={20} className="text-blue-600" />
        <h3 className="font-semibold text-gray-900">Informations de l'appareil</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="device-brand" className="block text-sm font-medium text-gray-700 mb-1">
            Marque *
          </label>
          <input
            type="text"
            id="device-brand"
            value={formData.device_brand}
            onChange={(e) => handleChange('device_brand', e.target.value)}
            className={`w-full px-3 py-3 border rounded-lg text-base ${
              errors.device_brand ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Apple, Samsung, Xiaomi..."
          />
          {errors.device_brand && <p className="text-red-600 text-sm mt-1">{errors.device_brand}</p>}
        </div>

        <div>
          <label htmlFor="device-model" className="block text-sm font-medium text-gray-700 mb-1">
            Modèle *
          </label>
          <input
            type="text"
            id="device-model"
            value={formData.device_model}
            onChange={(e) => handleChange('device_model', e.target.value)}
            className={`w-full px-3 py-3 border rounded-lg text-base ${
              errors.device_model ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="iPhone 12, Galaxy S21..."
          />
          {errors.device_model && <p className="text-red-600 text-sm mt-1">{errors.device_model}</p>}
        </div>

        <div>
          <label htmlFor="device-color" className="block text-sm font-medium text-gray-700 mb-1">
            Couleur
          </label>
          <input
            type="text"
            id="device-color"
            value={formData.device_color}
            onChange={(e) => handleChange('device_color', e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base"
            placeholder="Noir, Blanc, Bleu..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="device-imei" className="block text-sm font-medium text-gray-700 mb-1">
              IMEI
            </label>
            <input
              type="text"
              id="device-imei"
              value={formData.imei}
              onChange={(e) => handleChange('imei', e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base"
              placeholder="123456789012345"
            />
          </div>

          <div>
            <label htmlFor="device-serial" className="block text-sm font-medium text-gray-700 mb-1">
              Numéro de série
            </label>
            <input
              type="text"
              id="device-serial"
              value={formData.serial_number}
              onChange={(e) => handleChange('serial_number', e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base"
              placeholder="ABC123XYZ"
            />
          </div>
        </div>

        <div>
          <label htmlFor="device-pin" className="block text-sm font-medium text-gray-700 mb-1">
            Code PIN / Déverrouillage
          </label>
          <input
            type="text"
            id="device-pin"
            value={formData.pin_code}
            onChange={(e) => handleChange('pin_code', e.target.value)}
            className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base"
            placeholder="Code fourni par le client"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            État d'alimentation *
          </label>
          <div className="space-y-2">
            {powerStateOptions.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                  formData.power_state === option.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="power_state"
                  value={option.value}
                  checked={formData.power_state === option.value}
                  onChange={(e) => handleChange('power_state', e.target.value as any)}
                  className="w-5 h-5 text-blue-600"
                />
                <span className="text-2xl">{option.icon}</span>
                <span className="text-base font-medium text-gray-900">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="issue-description" className="block text-sm font-medium text-gray-700 mb-1">
            Description du problème *
          </label>
          <textarea
            id="issue-description"
            value={formData.issue_description}
            onChange={(e) => handleChange('issue_description', e.target.value)}
            rows={2}
            className={`w-full px-3 py-3 border rounded-lg text-base resize-y overflow-auto min-h-[60px] max-h-40 md:max-h-48 ${
              errors.issue_description ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Décrivez le problème constaté par le client... (zone ajustable)"
          />
          {errors.issue_description && <p className="text-red-600 text-sm mt-1">{errors.issue_description}</p>}
        </div>

        <div>
          <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={formData.price_known}
              onChange={(e) => handleChange('price_known', e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded"
            />
            <span className="text-base font-medium text-gray-900">
              Prix de réparation connu / Devis déjà établi
            </span>
          </label>
          {formData.price_known && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimation (€)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={formData.estimate_amount ?? ''}
                onChange={(e) => handleChange('estimate_amount', e.target.value === '' ? null : Number(e.target.value))}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base"
                placeholder="0"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
