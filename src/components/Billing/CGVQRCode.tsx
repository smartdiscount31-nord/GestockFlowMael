import React, { useState, useEffect } from 'react';
import { generateCGVQRCode } from '../../utils/qrCodeGenerator';

interface CGVQRCodeProps {
  cgvUrl: string;
}

/**
 * Composant qui affiche un QR code avec une flèche pointant vers lui
 * depuis le texte des CGV dans le footer des documents PDF
 */
export const CGVQRCode: React.FC<CGVQRCodeProps> = ({ cgvUrl }) => {
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);

  useEffect(() => {
    const loadQRCode = async () => {
      if (cgvUrl && cgvUrl.trim()) {
        try {
          console.log('[CGVQRCode] Génération du QR code pour:', cgvUrl);
          const qrImage = await generateCGVQRCode(cgvUrl, 70);
          setQrCodeImage(qrImage);
        } catch (error) {
          console.error('[CGVQRCode] Erreur lors de la génération du QR code:', error);
          setQrCodeImage(null);
        }
      }
    };

    loadQRCode();
  }, [cgvUrl]);

  if (!qrCodeImage) {
    return null;
  }

  return (
    <div className="flex items-center justify-end gap-3 mt-2">
      {/* Flèche pointant vers la droite */}
      <svg
        width="40"
        height="20"
        viewBox="0 0 40 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-gray-500"
        style={{ opacity: 0.7 }}
      >
        <line
          x1="0"
          y1="10"
          x2="35"
          y2="10"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <polygon
          points="35,10 30,7 30,13"
          fill="currentColor"
        />
      </svg>

      {/* QR Code */}
      <div className="flex-shrink-0">
        <img
          src={qrCodeImage}
          alt="QR Code CGV"
          style={{
            width: '70px',
            height: '70px',
            border: '1px solid #e5e7eb'
          }}
        />
      </div>
    </div>
  );
};
