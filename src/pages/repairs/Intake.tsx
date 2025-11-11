/**
 * Intake Page
 * Page principale de prise en charge atelier avec wizard multi-étapes
 */

import React, { useState, useEffect } from 'react';
import { ClientForm } from '../../components/repairs/ClientForm';
import { DeviceForm, DeviceData } from '../../components/repairs/DeviceForm';
import { CGVConsent, ConsentData } from '../../components/repairs/CGVConsent';
import { MediaCapture, MediaFile } from '../../components/repairs/MediaCapture';
import { PartSearchAttach, AttachedPart } from '../../components/repairs/PartSearchAttach';
import { PatternKeypad } from '../../components/repairs/PatternKeypad';
import { supabase } from '../../lib/supabase';
import { ChevronLeft, ChevronRight, Check, Save, AlertCircle } from 'lucide-react';

const STORAGE_KEY = 'repair_intake_draft';

interface IntakeFormData {
  client: any | null;
  device: DeviceData | null;
  consent: ConsentData | null;
  media: MediaFile[];
  sketch: string | null;
  // Ajouts pour clavier schéma
  patternImage: string | null;
  patternSequence: string | null;
  parts: AttachedPart[];
}

const INITIAL_FORM_DATA: IntakeFormData = {
  client: null,
  device: null,
  consent: null,
  media: [],
  sketch: null,
  patternImage: null,
  patternSequence: null,
  parts: [],
};

export function Intake() {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<IntakeFormData>(INITIAL_FORM_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  console.log('[Intake] Rendered, step:', currentStep, 'formData:', formData);

  // Charger le brouillon au montage
  useEffect(() => {
    console.log('[Intake] Chargement du brouillon depuis localStorage');
    try {
      const savedDraft = localStorage.getItem(STORAGE_KEY);
      if (savedDraft) {
        const parsedDraft = JSON.parse(savedDraft);
        console.log('[Intake] Brouillon chargé');
        setFormData(parsedDraft);
      }
    } catch (err) {
      console.error('[Intake] Erreur chargement brouillon:', err);
    }
  }, []);

  // Sauvegarder automatiquement dans localStorage
  useEffect(() => {
    console.log('[Intake] Sauvegarde automatique du brouillon');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    } catch (err) {
      console.error('[Intake] Erreur sauvegarde brouillon:', err);
    }
  }, [formData]);

  // Écoute acceptation CGV (postMessage) + check au retour d'onglet (localStorage)
  useEffect(() => {
    const onMessage = (ev: any) => {
      try {
        if (ev?.origin === window.location.origin && ev?.data?.type === 'CGV_ACCEPTED') {
          console.log('[Intake] Message CGV_ACCEPTED reçu');
          setFormData(prev => ({
            ...prev,
            consent: {
              ...(prev.consent || { signature_base64: null, cgv_accepted_at: null, cgv_accepted: false }),
              cgv_accepted: true,
              cgv_accepted_at: new Date().toISOString(),
            }
          }));
          setError(null);
        }
      } catch {}
    };
    const checkLocal = () => {
      try {
        const raw = localStorage.getItem('cgvAccepted');
        const ts = raw ? Number(raw) : 0;
        if (ts && Date.now() - ts < 24 * 60 * 60 * 1000) {
          console.log('[Intake] Auto-cochage CGV depuis localStorage');
          setFormData(prev => ({
            ...prev,
            consent: {
              ...(prev.consent || { signature_base64: null, cgv_accepted_at: null, cgv_accepted: false }),
              cgv_accepted: true,
              cgv_accepted_at: new Date(ts).toISOString(),
            }
          }));
          setError(null);
        }
      } catch {}
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('visibilitychange', checkLocal);
    window.addEventListener('focus', checkLocal);
    // Check immédiat si l'utilisateur revient d'une page déjà ouverte
    checkLocal();
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('visibilitychange', checkLocal);
      window.removeEventListener('focus', checkLocal);
    };
  }, []);

  const clearDraft = () => {
    console.log('[Intake] Suppression du brouillon');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('[Intake] Erreur suppression brouillon:', err);
    }
  };

  const steps = [
    { id: 'client', title: 'Client', icon: '👤' },
    { id: 'device', title: 'Appareil', icon: '📱' },
    { id: 'cgv', title: 'CGV', icon: '📝' },
    { id: 'media', title: 'Médias', icon: '📷' },
    { id: 'sketch', title: 'Schéma', icon: '✏️' },
    { id: 'parts', title: 'Pièces', icon: '🔧' },
    { id: 'summary', title: 'Récap', icon: '✓' },
  ];

  const validateStep = (step: number): boolean => {
    console.log('[Intake] Validation de l\'étape:', step);

    switch (step) {
      case 0: // Client
        if (!formData.client) {
          setError('Veuillez sélectionner ou créer un client');
          return false;
        }
        break;

      case 1: // Device
        if (!formData.device) {
          setError('Veuillez remplir les informations de l\'appareil');
          return false;
        }
        if (!formData.device.device_brand || !formData.device.device_model || !formData.device.issue_description) {
          setError('Marque, modèle et description du problème sont obligatoires');
          return false;
        }
        break;

      case 2: // CGV
        if (!formData.consent || !formData.consent.cgv_accepted) {
          setError('Le client doit accepter les CGV');
          return false;
        }
        if (!formData.consent.signature_base64) {
          setError('La signature du client est obligatoire');
          return false;
        }
        break;

      case 3: // Media - optionnel
        break;

      case 4: // Sketch - optionnel
        break;

      case 5: // Parts - optionnel mais recommandé
        break;

      case 6: // Summary
        break;

      default:
        break;
    }

    setError(null);
    return true;
  };

  const handleNext = () => {
    console.log('[Intake] Passage à l\'étape suivante');
    if (validateStep(currentStep)) {
      setCurrentStep(Math.min(currentStep + 1, steps.length - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevious = () => {
    console.log('[Intake] Retour à l\'étape précédente');
    setCurrentStep(Math.max(currentStep - 1, 0));
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (targetStatus: 'to_repair' | 'parts_to_order' | 'quote_todo') => {
    console.log('[Intake] Soumission du formulaire, statut cible:', targetStatus);

    if (!validateStep(currentStep - 1)) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Session non disponible');
      }

      // Préparer les médias en base64
      const photosBase64 = formData.media
        .filter(m => m.type === 'photo' && m.base64)
        .map(m => m.base64) as string[];

      console.log('[Intake] Médias à uploader:', photosBase64.length);

      // Créer le ticket de réparation
      console.log('[Intake] Appel repairs-create-intake');
      const createResponse = await fetch('/.netlify/functions/repairs-create-intake', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: formData.client.id,
          device_brand: formData.device?.device_brand,
          device_model: formData.device?.device_model,
          device_color: formData.device?.device_color || null,
          imei: formData.device?.imei || null,
          serial_number: formData.device?.serial_number || null,
          pin_code: formData.device?.pin_code || null,
          // Ajouter la séquence du clavier dans la description si présente
          issue_description: formData.device?.issue_description
            ? `${formData.device?.issue_description}${formData.patternSequence ? ` [Pattern: ${formData.patternSequence}]` : ''}`
            : (formData.patternSequence ? `[Pattern: ${formData.patternSequence}]` : ''),
          power_state: formData.device?.power_state,
          cgv_accepted: formData.consent?.cgv_accepted || false,
          signature_base64: formData.consent?.signature_base64 || null,
          estimate_amount: typeof formData.device?.estimate_amount === 'number' ? formData.device?.estimate_amount : null,
          photos_base64: photosBase64,
        }),
      });

      // Parse JSON seulement si le content-type est JSON
      const ct = createResponse.headers.get('content-type') || '';
      const isJson = ct.includes('application/json');
      const safeBody: any = isJson ? (await createResponse.json().catch(() => ({} as any))) : null;

      if (!createResponse.ok) {
        const msg = (safeBody && (safeBody.error?.message || safeBody.message)) || `Erreur lors de la création du ticket (HTTP ${createResponse.status})`;
        throw new Error(msg);
      }

      const createResult = safeBody || {};
      const ticketId = createResult?.data?.ticket?.id;
      console.log('[Intake] Ticket créé:', ticketId);

      // Upload du schéma (dessin) si présent
      if (formData.sketch) {
        console.log('[Intake] Upload du schéma');
        try {
          const schemaBlob = await (await fetch(`data:image/png;base64,${formData.sketch}`)).blob();
          const schemaFileName = `repair-tickets/${ticketId}/diagram-${Date.now()}.png`;

          const { data: schemaUpload, error: schemaError } = await supabase.storage
            .from('app-assets')
            .upload(schemaFileName, schemaBlob, {
              contentType: 'image/png',
              upsert: false,
            });

          if (!schemaError) {
            const { data: schemaPublicUrl } = supabase.storage
              .from('app-assets')
              .getPublicUrl(schemaFileName);

            // Créer une entrée media pour le schéma
            await supabase
              .from('repair_media')
              .insert({
                repair_id: ticketId,
                kind: 'diagram',
                file_url: schemaPublicUrl.publicUrl,
              });

            console.log('[Intake] Schéma uploadé');
          }
        } catch (err) {
          console.error('[Intake] Erreur upload schéma:', err);
        }
      }

      // Upload du schéma clavier (pattern) si présent
      if (formData.patternImage) {
        console.log('[Intake] Upload du schéma clavier');
        try {
          const patternBlob = await (await fetch(`data:image/png;base64,${formData.patternImage}`)).blob();
          const patternFileName = `repair-tickets/${ticketId}/pattern-${Date.now()}.png`;

          const { data: patternUpload, error: patternError } = await supabase.storage
            .from('app-assets')
            .upload(patternFileName, patternBlob, {
              contentType: 'image/png',
              upsert: false,
            });

          if (!patternError) {
            const { data: patternPublicUrl } = supabase.storage
              .from('app-assets')
              .getPublicUrl(patternFileName);

            await supabase
              .from('repair_media')
              .insert({
                repair_id: ticketId,
                kind: 'diagram',
                file_url: patternPublicUrl.publicUrl,
              });

            console.log('[Intake] Schéma clavier uploadé');
          }
        } catch (err) {
          console.error('[Intake] Erreur upload schéma clavier:', err);
        }
      }

      // Attacher les pièces
      for (const part of formData.parts) {
        console.log('[Intake] Traitement pièce:', part.product_name, 'action:', part.action);

        try {
          if (part.action === 'reserve' && part.stock_id) {
            // Réserver la pièce
            console.log('[Intake] Appel repairs-attach-part');
            const attachResponse = await fetch('/.netlify/functions/repairs-attach-part', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                repair_id: ticketId,
                product_id: part.product_id,
                stock_id: part.stock_id,
                quantity: part.quantity,
                purchase_price: part.purchase_price,
                vat_regime: part.vat_regime,
              }),
            });

            if (!attachResponse.ok) {
              console.error('[Intake] Erreur réservation pièce:', part.product_name);
            } else {
              console.log('[Intake] Pièce réservée:', part.product_name);
            }
          } else if (part.action === 'order') {
            // Marquer à commander
            console.log('[Intake] Appel repairs-mark-to-order');
            const orderResponse = await fetch('/.netlify/functions/repairs-mark-to-order', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                repair_id: ticketId,
                product_id: part.product_id,
                quantity: part.quantity,
                purchase_price: part.purchase_price,
                vat_regime: part.vat_regime,
              }),
            });

            if (!orderResponse.ok) {
              console.error('[Intake] Erreur marquage à commander:', part.product_name);
            } else {
              console.log('[Intake] Pièce marquée à commander:', part.product_name);
            }
          }
        } catch (err) {
          console.error('[Intake] Erreur traitement pièce:', part.product_name, err);
        }
      }

      // Mettre à jour le statut final du ticket
      const finalStatus = targetStatus;
      console.log('[Intake] Mise à jour statut final:', finalStatus);
      await supabase
        .from('repair_tickets')
        .update({ status: finalStatus })
        .eq('id', ticketId);

      // Charger le ticket pour générer les étiquettes
      const { data: ticketRows } = await supabase
        .from('repair_tickets')
        .select(`*, customer:customers(name, phone)`) 
        .eq('id', ticketId)
        .limit(1);
      const ticketRow = Array.isArray(ticketRows) ? ticketRows[0] : null;

      let pdfWin: Window | null = null;
      try {
        // Ouvrir un onglet placeholder (anti popup-blocker)
        pdfWin = window.open('', '_blank');
        try { if (pdfWin?.document) { pdfWin.document.write('<p style="font:14px sans-serif">Ouverture des étiquettes…</p>'); pdfWin.document.close(); } } catch {}

        const { generateRepairLabels } = await import('../../utils/repairLabels');
        const labelTicket = {
          id: ticketId,
          repair_number: ticketRow?.repair_number ?? null,
          created_at: ticketRow?.created_at ?? new Date().toISOString(),
          customer: { name: formData.client?.name || ticketRow?.customer?.name || '', phone: formData.client?.phone || ticketRow?.customer?.phone || '' },
          device_brand: formData.device?.device_brand || ticketRow?.device_brand || '',
          device_model: formData.device?.device_model || ticketRow?.device_model || '',
          issue_description: formData.device?.issue_description || ticketRow?.issue_description || '',
          assigned_tech: ticketRow?.assigned_tech || null,
          pin_code: formData.device?.pin_code || ticketRow?.pin_code || null,
          estimate_amount: formData.device?.estimate_amount ?? ticketRow?.estimate_amount ?? null,
        } as any;
        const { clientUrl } = await generateRepairLabels(labelTicket);
        console.log('[Intake] Étiquettes générées (PDF unique):', clientUrl);
        // Persister l’URL pour réimpression rapide (une seule URL suffit)
        await supabase.from('repair_tickets').update({ label_client_url: clientUrl, label_tech_url: clientUrl }).eq('id', ticketId);
        // Naviguer l’onglet unique vers le PDF combiné
        setTimeout(() => { try { if (pdfWin) pdfWin.location.href = clientUrl; } catch {} }, 30);
      } catch (e) {
        try { if (pdfWin) pdfWin.close(); } catch {}
        console.error('[Intake] Erreur génération/ouverte des étiquettes:', e);
        setError('Erreur lors de la génération des étiquettes');
      }

      console.log('[Intake] Prise en charge créée avec succès');
      setSuccess(`Prise en charge créée avec succès ! Ticket #${ticketId.substring(0, 8)}`);

      // Nettoyer le brouillon et réinitialiser le formulaire
      clearDraft();
      setTimeout(() => {
        setFormData(INITIAL_FORM_DATA);
        setCurrentStep(0);
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('[Intake] Erreur soumission:', err);
      setError(err.message || 'Erreur lors de la création de la prise en charge');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <ClientForm
            onClientSelected={(client) => {
              console.log('[Intake] Client sélectionné:', client);
              setFormData({ ...formData, client });
            }}
            initialClient={formData.client}
          />
        );

      case 1:
        return (
          <DeviceForm
            onDeviceDataChange={(device) => {
              console.log('[Intake] Données appareil mises à jour');
              setFormData({ ...formData, device });
            }}
            initialData={formData.device || undefined}
          />
        );

      case 2:
        return (
          <CGVConsent
            onConsentChange={(consent) => {
              console.log('[Intake] Consentement mis à jour');
              setFormData({ ...formData, consent });
            }}
            initialData={formData.consent || undefined}
          />
        );

      case 3:
        return (
          <MediaCapture
            onMediaChange={(media) => {
              console.log('[Intake] Médias mis à jour, count:', media.length);
              setFormData({ ...formData, media });
            }}
            initialMedia={formData.media}
          />
        );

      case 4:
        return (
          <PatternKeypad
            onChange={(pattern) => {
              console.log('[Intake] Séquence clavier:', pattern);
              setFormData({ ...formData, patternSequence: pattern || null });
            }}
            onExport={(imageBase64) => {
              console.log('[Intake] Image schéma clavier capturée');
              setFormData({ ...formData, patternImage: imageBase64 });
            }}
          />
        );

      case 5:
        return (
          <PartSearchAttach
            onPartsChange={(parts) => {
              console.log('[Intake] Pièces mises à jour, count:', parts.length);
              setFormData({ ...formData, parts });
            }}
            initialParts={formData.parts}
          />
        );

      case 6:
        return (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4 text-lg">Récapitulatif</h3>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-700 mb-2">Client</h4>
                <p className="text-gray-900">{formData.client?.name}</p>
                <p className="text-sm text-gray-600">{formData.client?.phone}</p>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-2">Appareil</h4>
                <p className="text-gray-900">{formData.device?.device_brand} {formData.device?.device_model}</p>
                <p className="text-sm text-gray-600">{formData.device?.issue_description}</p>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-2">CGV et Signature</h4>
                <p className="text-sm text-green-600">✓ Acceptées et signées</p>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-2">Médias</h4>
                <p className="text-sm text-gray-600">{formData.media.length} média(s) capturé(s)</p>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-2">Schéma</h4>
                <p className="text-sm text-gray-600">{formData.sketch ? '✓ Schéma créé' : 'Aucun schéma'}</p>
              </div>

              <div>
                <h4 className="font-medium text-gray-700 mb-2">Pièces</h4>
                {formData.parts.length > 0 ? (
                  <ul className="space-y-1">
                    {formData.parts.map((part) => (
                      <li key={part.id} className="text-sm text-gray-600">
                        • {part.product_name} (x{part.quantity}) -{' '}
                        {part.action === 'reserve' ? 'En stock' : 'À commander'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-600">Aucune pièce ajoutée</p>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => handleSubmit('to_repair')}
                disabled={isSubmitting}
                className="w-full px-4 py-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Création en cours...' : 'Valider en "À réparer"'}
              </button>

              <button
                type="button"
                onClick={() => handleSubmit('parts_to_order')}
                disabled={isSubmitting}
                className="w-full px-4 py-4 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Création en cours...' : 'Valider en "Pièces à commander"'}
              </button>

              <button
                type="button"
                onClick={() => handleSubmit('quote_todo')}
                disabled={isSubmitting}
                className="w-full px-4 py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Création en cours...' : 'Valider en "Devis à faire"'}
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Prise en charge client</h1>
          <p className="text-gray-600">Enregistrez les informations de l'appareil et du client</p>
        </div>

        {/* Progress stepper */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 min-w-[80px] p-3 rounded-lg border-2 text-center transition-all ${
                  index === currentStep
                    ? 'border-blue-600 bg-blue-50'
                    : index < currentStep
                    ? 'border-green-600 bg-green-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="text-2xl mb-1">{step.icon}</div>
                <div className={`text-sm font-medium ${
                  index === currentStep ? 'text-blue-900' :
                  index < currentStep ? 'text-green-900' :
                  'text-gray-600'
                }`}>
                  {step.title}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
            <Check size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-green-600">{success}</p>
          </div>
        )}

        {/* Step content */}
        <div className="mb-6">
          {renderStepContent()}
        </div>

        {/* Navigation buttons */}
        {currentStep < steps.length - 1 && (
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrevious}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
              >
                <ChevronLeft size={20} />
                <span>Précédent</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              <span>Suivant</span>
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {currentStep === steps.length - 1 && (
          <button
            type="button"
            onClick={handlePrevious}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
          >
            <ChevronLeft size={20} />
            <span>Modifier</span>
          </button>
        )}

        {/* Auto-save indicator */}
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
          <Save size={16} />
          <span>Sauvegarde automatique activée</span>
        </div>
      </div>
    </div>
  );
}

export default Intake;
