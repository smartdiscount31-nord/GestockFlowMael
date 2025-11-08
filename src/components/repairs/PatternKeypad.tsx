/**
 * PatternKeypad Component
 * Clavier numérique (téléphone) avec suivi de séquence en glissé et export PNG (via Konva)
 */

import React from 'react';
import { Stage, Layer, Circle, Text, Arrow } from 'react-konva';

interface PatternKeypadProps {
  onChange?: (pattern: string) => void; // ex: "1-5-9-0"
  onExport?: (imageBase64: string) => void; // PNG sans préfixe data:
}

// Disposition 3x4 avec seulement les chiffres (pas de * ni #)
// 1 2 3
// 4 5 6
// 7 8 9
//   0
const DIGITS = ['1','2','3','4','5','6','7','8','9','0'] as const;

type Digit = typeof DIGITS[number];

type KeyNode = {
  digit: Digit;
  x: number;
  y: number;
  r: number;
};

export function PatternKeypad({ onChange, onExport }: PatternKeypadProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<any>(null);
  const [stageSize, setStageSize] = React.useState({ width: 400, height: 520 });

  const [keys, setKeys] = React.useState<KeyNode[]>([]);
  const [sequence, setSequence] = React.useState<Digit[]>([]);
  const [isDrawing, setIsDrawing] = React.useState(false);

  // Calcule la grille au resize
  React.useEffect(() => {
    const update = () => {
      const w = Math.min(containerRef.current?.offsetWidth || 400, 520);
      const padding = 20;
      const cols = 3;
      const rows = 4;
      const cellW = (w - padding * 2) / cols;
      const cellH = ((w * 1.2) - padding * 2) / rows; // rapport hauteur un peu plus grand
      const size = { width: w, height: Math.round(w * 1.2) };

      const r = Math.min(cellW, cellH) * 0.32; // rayon des touches

      const positions: Array<{ cx: number; cy: number }> = [];
      // Lignes 1..3: 1..9
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const cx = padding + col * cellW + cellW / 2;
          const cy = padding + row * cellH + cellH / 2;
          positions.push({ cx, cy });
        }
      }
      // Ligne 4: 0 centré
      const cx0 = padding + 1 * cellW + cellW / 2; // colonne centrale
      const cy0 = padding + 3 * cellH + cellH / 2;

      const mapped: KeyNode[] = [
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

      setStageSize(size);
      setKeys(mapped);
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const findHitDigit = (x: number, y: number): Digit | null => {
    const SAFE = 0.9; // marge de sécurité pour éviter les faux positifs
    for (const k of keys) {
      const dx = x - k.x;
      const dy = y - k.y;
      if (Math.sqrt(dx * dx + dy * dy) <= k.r * SAFE) return k.digit;
    }
    return null;
  };

  const addDigitIfNew = (d: Digit) => {
    setSequence((prev) => {
      if (prev.includes(d)) return prev; // éviter doublons
      const next = [...prev, d];
      if (onChange) onChange(next.join('-'));
      return next;
    });
  };

  const handleDown = (evt: any) => {
    setIsDrawing(true);
    const stage = evt.target.getStage();
    const p = stage.getPointerPosition();
    if (!p) return;
    const d = findHitDigit(p.x, p.y);
    if (!d) return;
    // Nouveau geste: repartir de zéro puis ajouter le premier chiffre
    setSequence([d]);
    onChange && onChange(String(d));
  };

  const handleMove = (evt: any) => {
    if (!isDrawing) return;
    const stage = evt.target.getStage();
    const p = stage.getPointerPosition();
    if (!p) return;
    const d = findHitDigit(p.x, p.y);
    if (d) addDigitIfNew(d);
  };

  const handleUp = () => {
    setIsDrawing(false);
    // Export automatique de l'image si une séquence existe
    if (sequence.length > 0) {
      handleExport();
    }
  };

  const handleClear = () => {
    setSequence([]);
    if (onChange) onChange('');
  };

  const handleExport = () => {
    if (!stageRef.current) return;
    try {
      const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
      const base64 = dataURL.replace(/^data:image\/png;base64,/, '');
      onExport && onExport(base64);
    } catch (e) {
      console.error('[PatternKeypad] Export error', e);
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="mb-2">
        <h3 className="font-semibold text-gray-900 text-sm">Clavier schéma</h3>
      </div>

      <div ref={containerRef} className="border-2 border-gray-300 rounded-lg bg-gray-50 overflow-hidden mb-3">
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={handleUp}
          onTouchStart={handleDown}
          onTouchMove={handleMove}
          onTouchEnd={handleUp}
        >
          <Layer>
            {/* Flèches entre les touches consécutives */}
            {sequence.length >= 2 && sequence.map((d, i) => {
              if (i === 0) return null;
              const map = new Map(keys.map((k) => [k.digit, k] as const));
              const a = map.get(sequence[i - 1]);
              const b = map.get(d);
              if (!a || !b) return null;
              return (
                <Arrow
                  key={`arrow-${i}`}
                  points={[a.x, a.y, b.x, b.y]}
                  stroke="#2563EB"
                  fill="#2563EB"
                  strokeWidth={3}
                  pointerLength={10}
                  pointerWidth={10}
                  lineCap="round"
                  lineJoin="round"
                />
              );
            })}

            {/* Touches */}
            {keys.map((k) => {
              const idx = sequence.indexOf(k.digit);
              const active = idx >= 0;
              return (
                <React.Fragment key={k.digit}>
                  <Circle
                    x={k.x}
                    y={k.y}
                    radius={k.r}
                    fill={active ? '#DBEAFE' : '#F3F4F6'}
                    stroke={active ? '#2563EB' : '#9CA3AF'}
                    strokeWidth={2}
                  />
                  <Text
                    x={k.x - k.r}
                    y={k.y - 14}
                    width={k.r * 2}
                    height={28}
                    text={k.digit}
                    fontSize={24}
                    fontStyle="bold"
                    align="center"
                    verticalAlign="middle"
                    fill="#111827"
                  />
                  {active && (
                    <React.Fragment>
                      <Circle x={k.x + k.r - 14} y={k.y - k.r + 14} radius={12} fill="#2563EB" />
                      <Text
                        x={k.x + k.r - 26}
                        y={k.y - k.r + 4}
                        width={24}
                        height={16}
                        text={String(idx + 1)}
                        fontSize={12}
                        fontStyle="bold"
                        align="center"
                        verticalAlign="middle"
                        fill="#FFFFFF"
                      />
                    </React.Fragment>
                  )}
                </React.Fragment>
              );
            })}
          </Layer>
        </Stage>
      </div>

      <div className="text-right">
        <button
          type="button"
          onClick={handleClear}
          className="text-sm text-gray-600 hover:text-gray-800 underline"
        >
          Réinitialiser
        </button>
      </div>

      {sequence.length === 0 && (
        <p className="text-sm text-gray-500 text-center mt-2">Glissez votre doigt sur les chiffres pour créer le schéma</p>
      )}
    </div>
  );
}
