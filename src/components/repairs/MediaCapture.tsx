/**
 * MediaCapture Component
 * Capture et upload de photos/vidéos
 */

import React, { useState, useRef } from 'react';
import { Camera, Video, Trash2, Upload, AlertCircle } from 'lucide-react';

interface MediaCaptureProps {
  onMediaChange: (media: MediaFile[]) => void;
  initialMedia?: MediaFile[];
}

export interface MediaFile {
  id: string;
  type: 'photo' | 'video';
  file: File;
  preview: string;
  base64?: string;
}

export function MediaCapture({ onMediaChange, initialMedia }: MediaCaptureProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>(initialMedia || []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  console.log('[MediaCapture] Rendered, mediaFiles count:', mediaFiles.length);

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (files: FileList | null, type: 'photo' | 'video') => {
    if (!files || files.length === 0) return;

    console.log('[MediaCapture] Fichiers sélectionnés:', files.length, 'type:', type);
    setIsProcessing(true);
    setError(null);

    try {
      const newMediaFiles: MediaFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validation de taille (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          console.warn('[MediaCapture] Fichier trop volumineux ignoré:', file.name);
          setError(`Le fichier ${file.name} dépasse 10MB et a été ignoré`);
          continue;
        }

        // Créer un preview
        const preview = URL.createObjectURL(file);

        // Convertir en base64 pour l'upload
        const base64 = await convertFileToBase64(file);

        const mediaFile: MediaFile = {
          id: `${Date.now()}-${i}`,
          type,
          file,
          preview,
          base64,
        };

        newMediaFiles.push(mediaFile);
        console.log('[MediaCapture] Fichier traité:', file.name, 'base64 length:', base64.length);
      }

      const updatedMedia = [...mediaFiles, ...newMediaFiles];
      setMediaFiles(updatedMedia);
      onMediaChange(updatedMedia);

      console.log('[MediaCapture] Total médias après ajout:', updatedMedia.length);
    } catch (err) {
      console.error('[MediaCapture] Erreur traitement fichiers:', err);
      setError('Erreur lors du traitement des fichiers');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveMedia = (id: string) => {
    console.log('[MediaCapture] Suppression média:', id);
    const mediaToRemove = mediaFiles.find(m => m.id === id);
    if (mediaToRemove) {
      URL.revokeObjectURL(mediaToRemove.preview);
    }

    const updatedMedia = mediaFiles.filter(m => m.id !== id);
    setMediaFiles(updatedMedia);
    onMediaChange(updatedMedia);
  };

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Camera size={20} className="text-blue-600" />
        <h3 className="font-semibold text-gray-900">Photos et Vidéos</h3>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Boutons de capture */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          disabled={isProcessing}
          className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Camera size={24} className="text-blue-600" />
          <span className="text-sm font-medium text-gray-900">Prendre photo</span>
        </button>

        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          disabled={isProcessing}
          className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Video size={24} className="text-blue-600" />
          <span className="text-sm font-medium text-gray-900">Enregistrer vidéo</span>
        </button>
      </div>

      {/* Inputs cachés */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        onChange={(e) => handleFileSelect(e.target.files, 'photo')}
        className="hidden"
      />

      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        multiple
        onChange={(e) => handleFileSelect(e.target.files, 'video')}
        className="hidden"
      />

      {/* Liste des médias */}
      {isProcessing && (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-blue-600">
            <Upload size={20} className="animate-bounce" />
            <span className="font-medium">Traitement en cours...</span>
          </div>
        </div>
      )}

      {mediaFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {mediaFiles.length} média{mediaFiles.length > 1 ? 's' : ''} capturé{mediaFiles.length > 1 ? 's' : ''}
          </p>

          <div className="grid grid-cols-2 gap-3">
            {mediaFiles.map((media) => (
              <div key={media.id} className="relative group">
                <div className="aspect-video rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                  {media.type === 'photo' ? (
                    <img
                      src={media.preview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={media.preview}
                      className="w-full h-full object-cover"
                      controls
                    />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveMedia(media.id)}
                  className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                >
                  <Trash2 size={16} />
                </button>

                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                  {media.type === 'photo' ? '📷 Photo' : '🎥 Vidéo'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {mediaFiles.length === 0 && !isProcessing && (
        <div className="text-center py-8 text-gray-500">
          <Camera size={48} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aucun média capturé</p>
        </div>
      )}
    </div>
  );
}
