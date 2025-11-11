/**
 * CGVConsent Component
 * Acceptation des CGV avec signature électronique
 */

import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { FileText, Trash2 } from 'lucide-react';

interface CGVConsentProps {
  onConsentChange: (data: ConsentData) => void;
  initialData?: ConsentData;
}

export interface ConsentData {
  cgv_accepted: boolean;
  signature_base64: string | null;
  cgv_accepted_at: string | null;
}

export function CGVConsent({ onConsentChange, initialData }: CGVConsentProps) {
  const [consentData, setConsentData] = useState<ConsentData>(initialData || {
    cgv_accepted: false,
    signature_base64: null,
    cgv_accepted_at: null,
  });

  const sigPadRef = useRef<SignatureCanvas>(null);
  const [hasSignature, setHasSignature] = useState(false);

  console.log('[CGVConsent] Rendered, consentData:', consentData);

  const handleCGVAcceptChange = (accepted: boolean) => {
    console.log('[CGVConsent] CGV acceptées:', accepted);
    const newData = {
      ...consentData,
      cgv_accepted: accepted,
      cgv_accepted_at: accepted ? new Date().toISOString() : null,
    };
    setConsentData(newData);
    onConsentChange(newData);
  };

  const handleClearSignature = () => {
    console.log('[CGVConsent] Effacement de la signature');
    if (sigPadRef.current) {
      sigPadRef.current.clear();
      setHasSignature(false);
      const newData = {
        ...consentData,
        signature_base64: null,
      };
      setConsentData(newData);
      onConsentChange(newData);
    }
  };

  const handleValidateSignature = () => {
    console.log('[CGVConsent] Validation de la signature');
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      const dataURL = sigPadRef.current.toDataURL('image/png');
      // Convert to base64 without data URL prefix
      const base64 = dataURL.replace(/^data:image\/png;base64,/, '');
      console.log('[CGVConsent] Signature capturée, taille base64:', base64.length);

      const newData = {
        ...consentData,
        signature_base64: base64,
      };
      setConsentData(newData);
      onConsentChange(newData);
      setHasSignature(true);
    } else {
      console.log('[CGVConsent] Signature vide');
    }
  };

  const handleSignatureEnd = () => {
    console.log('[CGVConsent] Fin du dessin de signature');
    handleValidateSignature();
  };

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <FileText size={20} className="text-blue-600" />
        <h3 className="font-semibold text-gray-900">CGV et Signature</h3>
      </div>

      <div className="space-y-6">
        {/* Lien d'ouverture CGV en fenêtre séparée */}
        <div className="mb-2">
          <button
            type="button"
            onClick={() => {
              try {
                const returnTo = `${location.pathname}${location.search}`;
                const url = `/cgv?returnTo=${encodeURIComponent(returnTo)}`;
                window.open(url, '_blank', 'noopener,noreferrer');
              } catch {
                window.open('/cgv', '_blank', 'noopener,noreferrer');
              }
            }}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Conditions Générales de Vente
          </button>
        </div>
        {/* Acceptation CGV */}
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-start gap-3 mb-3">
            <input
              type="checkbox"
              id="cgv-accept"
              checked={consentData.cgv_accepted}
              onChange={(e) => handleCGVAcceptChange(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded mt-1"
            />
            <label htmlFor="cgv-accept" className="flex-1 text-base text-gray-900 cursor-pointer">
              J'ai pris connaissance et j'accepte les{' '}
              <a
                href="/cgv"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800"
                onClick={(e) => {
                  e.preventDefault();
                  try {
                    const returnTo = `${location.pathname}${location.search}`;
                    const url = `/cgv?returnTo=${encodeURIComponent(returnTo)}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                  } catch {
                    window.open('/cgv', '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                Conditions Générales de Vente
              </a>
            </label>
          </div>

          {consentData.cgv_accepted && consentData.cgv_accepted_at && (
            <p className="text-sm text-gray-600 ml-8">
              ✓ Accepté le {new Date(consentData.cgv_accepted_at).toLocaleString('fr-FR')}
            </p>
          )}
        </div>

        {/* Signature électronique */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Signature du client *
          </label>

          {consentData.signature_base64 && hasSignature ? (
            <div className="border-2 border-green-500 rounded-lg p-4 bg-green-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-700 font-medium">✓ Signature enregistrée</span>
                <button
                  type="button"
                  onClick={() => {
                    setHasSignature(false);
                    handleClearSignature();
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Modifier
                </button>
              </div>
              <img
                src={`data:image/png;base64,${consentData.signature_base64}`}
                alt="Signature"
                className="w-full h-32 object-contain bg-white rounded border border-gray-200"
              />
            </div>
          ) : (
            <>
              <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
                <SignatureCanvas
                  ref={sigPadRef}
                  canvasProps={{
                    className: 'w-full h-48 touch-none',
                    style: { touchAction: 'none' }
                  }}
                  onEnd={handleSignatureEnd}
                  backgroundColor="rgb(255, 255, 255)"
                  penColor="rgb(0, 0, 0)"
                  minWidth={1}
                  maxWidth={3}
                />
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleClearSignature}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                >
                  <Trash2 size={18} />
                  <span>Effacer</span>
                </button>
                <button
                  type="button"
                  onClick={handleValidateSignature}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Valider
                </button>
              </div>

              <p className="text-sm text-gray-500 mt-2 text-center">
                Signez avec votre doigt ou stylet
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
