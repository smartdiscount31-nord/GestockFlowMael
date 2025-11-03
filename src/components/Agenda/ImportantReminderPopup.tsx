/**
 * ImportantReminderPopup - Popup modal pour les rappels importants
 * Avec focus-trap, gestion ESC, et actions Vu/Reporter/Fait
 */

import React, { useEffect, useRef } from 'react';
import { AlertCircle, Eye, Clock, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ImportantReminderPopupProps {
  eventId: string;
  eventTitle: string;
  eventDateTime: string;
  reminderId?: string;
  notificationId?: string;
  onClose: () => void;
}

export function ImportantReminderPopup({
  eventId,
  eventTitle,
  eventDateTime,
  reminderId,
  notificationId,
  onClose
}: ImportantReminderPopupProps) {
  console.log('[ImportantReminderPopup] Affichage popup pour événement:', eventId);

  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Focus trap et gestion ESC
  useEffect(() => {
    console.log('[ImportantReminderPopup] Initialisation focus trap');

    // Focus initial sur le premier bouton
    if (firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }

    // Gestion ESC
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('[ImportantReminderPopup] ESC pressed, fermeture');
        onClose();
      }
    };

    // Focus trap: empêcher la navigation hors de la modale
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusableElements = modal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      if (e.shiftKey) {
        // Shift+Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener('keydown', handleEsc);
    window.addEventListener('keydown', handleTab);

    return () => {
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('keydown', handleTab);
    };
  }, [onClose]);

  // Handler d'action (vu, reporter, fait)
  const handleAction = async (action: 'vu' | 'reporte' | 'fait') => {
    console.log('[ImportantReminderPopup] Action:', action);
    setProcessing(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Non authentifié');
      }

      const response = await fetch('/.netlify/functions/agenda-reminder-action', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          event_id: eventId,
          reminder_id: reminderId,
          action,
          notification_id: notificationId
        })
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || `Erreur ${response.status}`);
      }

      const result = await response.json();
      console.log('[ImportantReminderPopup] Action traitée avec succès:', result);

      // Fermer le popup après succès
      onClose();

    } catch (err: any) {
      console.error('[ImportantReminderPopup] Erreur action:', err);
      setError(err.message || 'Erreur lors du traitement');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      {/* Overlay - non cliquable */}
      <div
        className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4"
        aria-hidden="true"
      >
        {/* Modal centrée */}
        <div
          ref={modalRef}
          className="bg-white rounded-lg shadow-2xl max-w-md w-full border-4 border-red-400 animate-pulse-border"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reminder-title"
          aria-describedby="reminder-description"
        >
          {/* Header avec icône */}
          <div className="flex items-center gap-3 p-6 border-b border-gray-200 bg-red-50">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle size={28} className="text-red-600" />
            </div>
            <div className="flex-1">
              <h2 id="reminder-title" className="text-lg font-bold text-gray-900">
                Rappel Important
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Ne pas oublier votre rendez-vous
              </p>
            </div>
          </div>

          {/* Contenu */}
          <div className="p-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {eventTitle}
              </h3>
              <p className="text-base text-gray-700 flex items-center gap-2">
                <Clock size={18} className="text-gray-500" />
                {eventDateTime}
              </p>
            </div>

            <p id="reminder-description" className="text-sm text-gray-600">
              Cet événement nécessite votre attention. Veuillez confirmer que vous avez pris connaissance de ce rappel.
            </p>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3 text-red-800 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 p-6 bg-gray-50 border-t border-gray-200">
            <button
              ref={firstFocusableRef}
              onClick={() => handleAction('vu')}
              disabled={processing}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              aria-label="Marquer comme vu"
            >
              <Eye size={18} />
              {processing ? 'Traitement...' : '✅ Vu'}
            </button>

            <button
              onClick={() => handleAction('reporte')}
              disabled={processing}
              className="w-full px-4 py-3 bg-orange-600 text-white rounded-md text-sm font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              aria-label="Reporter d'une heure"
            >
              <Clock size={18} />
              {processing ? 'Traitement...' : '🕓 Reporter 1h'}
            </button>

            <button
              onClick={() => handleAction('fait')}
              disabled={processing}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              aria-label="Marquer comme fait"
            >
              <CheckCircle size={18} />
              {processing ? 'Traitement...' : '☑️ Fait'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse-border {
          0%, 100% {
            border-color: #f87171;
          }
          50% {
            border-color: #dc2626;
          }
        }
        .animate-pulse-border {
          animation: pulse-border 2s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
