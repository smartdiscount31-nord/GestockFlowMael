import React from 'react';

// Rendu statique du pattern sur la même grille que PatternKeypad (lecture seule)
// sequence: "1-5-9-8-2"

const DIGITS = ['1','2','3','4','5','6','7','8','9','0'] as const;

type Digit = typeof DIGITS[number];

type KeyNode = {
  digit: Digit;
  x: number;
  y: number;
  r: number;
};

interface PatternPreviewProps {
  sequence?: string | null;
  width?: number; // px
}

export default function PatternPreview({ sequence, width = 320 }: PatternPreviewProps) {
  const seq = React.useMemo<Digit[]>(() => {
    const s = String(sequence || '').trim();
    if (!s) return [];
    return s.split('-').map(v => v as Digit).filter(v => DIGITS.includes(v as any));
  }, [sequence]);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = Math.min(width, 520);
    const H = Math.round(W * 1.2);
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calcule la grille identique au PatternKeypad
    const padding = 20;
    const cols = 3;
    const rows = 4;
    const cellW = (W - padding * 2) / cols;
    const cellH = ((W * 1.2) - padding * 2) / rows;
    const r = Math.min(cellW, cellH) * 0.32;

    const positions: Array<{ cx: number; cy: number }> = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const cx = padding + col * cellW + cellW / 2;
        const cy = padding + row * cellH + cellH / 2;
        positions.push({ cx, cy });
      }
    }
    const cx0 = padding + 1 * cellW + cellW / 2;
    const cy0 = padding + 3 * cellH + cellH / 2;

    const keys: KeyNode[] = [
      { digit: '1', x: positions[0].cx, y: positions[0].cy, r },
      { digit: '2', x: positions[1].cx, y: positions[1].cy, r },
      { digit: '3', x: positions[2].cx, y: positions[2].cy, r },
      { digit: '4', x: positions[3].cx, y: positions[3].cy, r },
      { digit: '5', x: positions[4].cx, y: positions[4].cy, r },
      { digit: '6', x: positions[5].cx, y: positions[5].cy, r },
      { digit: '7', x: positions[6].cx, y: positions[6].cy, r },
      { digit: '8', x: positions[7].cx, y: positions[7].cy, r },
      { digit: '9', x: positions[8].cx, y: positions[8].cy, r },
      { digit: '0', x: cx0, y: cy0, r },
    ];

    // Helpers
    const getKey = (d: Digit) => keys.find(k => k.digit === d)!;

    // Fond
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#F9FAFB';
    ctx.fillRect(0, 0, W, H);

    // Traits entre points consécutifs
    if (seq.length >= 2) {
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 1; i < seq.length; i++) {
        const a = getKey(seq[i - 1]);
        const b = getKey(seq[i]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // Touches
    for (const k of keys) {
      const activeIdx = seq.lastIndexOf(k.digit);
      const active = activeIdx >= 0;

      // Cercle
      ctx.beginPath();
      ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#DBEAFE' : '#F3F4F6';
      ctx.strokeStyle = active ? '#2563EB' : '#9CA3AF';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Digit
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 24px Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(k.digit, k.x, k.y);

      // Ordre si actif
      if (active) {
        const badgeR = 12;
        const bx = k.x + k.r - 14;
        const by = k.y - k.r + 14;
        ctx.beginPath();
        ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
        ctx.fillStyle = '#2563EB';
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
        ctx.fillText(String(activeIdx + 1), bx, by);
      }
    }
  }, [seq, width]);

  if (!seq.length) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <canvas ref={canvasRef} style={{ width, height: Math.round(width * 1.2) }} />
    </div>
  );
}
