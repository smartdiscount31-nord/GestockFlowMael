import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { listRepairMedia, RepairMediaItem } from '../../utils/repairMedia';

interface RepairMediaGalleryProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
  useSignedUrl?: boolean;
  bucket?: string;
}

export default function RepairMediaGallery({ ticketId, isOpen, onClose, useSignedUrl = false, bucket = 'app-assets' }: RepairMediaGalleryProps) {
  const [items, setItems] = useState<RepairMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ url: string; type: 'image' | 'video' } | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listRepairMedia(ticketId, bucket, useSignedUrl);
      setItems(list);
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du chargement des médias');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    load();
  }, [isOpen, ticketId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Galerie du ticket #{ticketId.substring(0,8)}</h3>
          <button onClick={onClose} aria-label="Fermer" className="p-2 rounded hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="p-4 overflow-y-auto">
          {loading && (
            <div className="text-center text-gray-600 py-10">Chargement…</div>
          )}
          {error && (
            <div className="text-center text-red-600 py-4">{error}</div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="text-center text-gray-600 py-10">Aucun média</div>
          )}
          {!loading && items.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {items.map((it) => (
                <button
                  key={it.path}
                  onClick={() => {
                    if (it.type === 'image') setViewer({ url: it.url, type: 'image' });
                    else if (it.type === 'video') setViewer({ url: it.url, type: 'video' });
                  }}
                  className="relative group border border-gray-200 rounded-md overflow-hidden bg-gray-50 text-left"
                  title={it.name}
                >
                  {it.type === 'image' ? (
                    <img src={it.url} alt={it.name} className="w-full h-32 object-cover" />
                  ) : it.type === 'video' ? (
                    <div className="w-full h-32 grid place-items-center text-gray-600 bg-black/5">
                      <span className="text-sm">🎬 Vidéo</span>
                    </div>
                  ) : (
                    <div className="w-full h-32 grid place-items-center text-gray-500">{it.name}</div>
                  )}
                  <div className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                    {it.type}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {viewer && (
        <div className="fixed inset-0 z-[60] bg-black/80 grid place-items-center p-4" onClick={() => setViewer(null)}>
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button className="absolute -top-10 right-0 text-white" onClick={() => setViewer(null)} aria-label="Fermer"><X size={24} /></button>
            {viewer.type === 'image' ? (
              <img src={viewer.url} alt="media" className="w-full max-h-[80vh] object-contain" />
            ) : (
              <video src={viewer.url} controls className="w-full max-h-[80vh] bg-black" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
