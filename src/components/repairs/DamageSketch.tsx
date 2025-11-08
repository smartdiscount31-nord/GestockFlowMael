/**
 * DamageSketch Component
 * Schéma interactif pour annoter les dégâts avec Konva.js
 */

import React, { useState, useRef } from 'react';
import { Stage, Layer, Line, Circle, Text, Arrow } from 'react-konva';
import { Pen, Undo, Redo, Trash2, Download } from 'lucide-react';

interface DamageSketchProps {
  onSketchChange: (sketchBase64: string | null) => void;
  initialSketch?: string | null;
}

interface DrawingLine {
  tool: 'pen' | 'arrow' | 'circle' | 'number';
  points?: number[];
  x?: number;
  y?: number;
  radius?: number;
  number?: number;
  color: string;
}

export function DamageSketch({ onSketchChange, initialSketch }: DamageSketchProps) {
  const [tool, setTool] = useState<'pen' | 'arrow' | 'circle' | 'number'>('pen');
  const [lines, setLines] = useState<DrawingLine[]>([]);
  const [history, setHistory] = useState<DrawingLine[][]>([]);
  const [historyStep, setHistoryStep] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentNumber, setCurrentNumber] = useState(1);
  const [hasSketch, setHasSketch] = useState(!!initialSketch);

  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [stageSize, setStageSize] = useState({ width: 400, height: 300 });

  console.log('[DamageSketch] Rendered, tool:', tool, 'lines:', lines.length);

  React.useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setStageSize({ width, height: Math.round(width * 0.75) });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();

    console.log('[DamageSketch] Début dessin, outil:', tool, 'position:', point);
    setIsDrawing(true);

    if (tool === 'pen' || tool === 'arrow') {
      setLines([...lines, { tool, points: [point.x, point.y], color: '#EF4444' }]);
    } else if (tool === 'circle') {
      setLines([...lines, { tool, x: point.x, y: point.y, radius: 0, color: '#EF4444' }]);
    } else if (tool === 'number') {
      setLines([...lines, { tool, x: point.x, y: point.y, number: currentNumber, color: '#2563EB' }]);
      setCurrentNumber(currentNumber + 1);
      setIsDrawing(false);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return;

    const stage = e.target.getStage();
    const point = stage.getPointerPosition();

    const lastLine = lines[lines.length - 1];

    if ((tool === 'pen' || tool === 'arrow') && lastLine.points) {
      lastLine.points = lastLine.points.concat([point.x, point.y]);
      setLines([...lines.slice(0, -1), lastLine]);
    } else if (tool === 'circle' && lastLine.x !== undefined && lastLine.y !== undefined) {
      const dx = point.x - lastLine.x;
      const dy = point.y - lastLine.y;
      const radius = Math.sqrt(dx * dx + dy * dy);
      lastLine.radius = radius;
      setLines([...lines.slice(0, -1), lastLine]);
    }
  };

  const handleMouseUp = () => {
    console.log('[DamageSketch] Fin dessin');
    setIsDrawing(false);

    // Sauvegarder dans l'historique
    setHistory([...history.slice(0, historyStep + 1), lines]);
    setHistoryStep(historyStep + 1);
  };

  const handleUndo = () => {
    if (historyStep > 0) {
      console.log('[DamageSketch] Annuler');
      setHistoryStep(historyStep - 1);
      setLines(history[historyStep - 1] || []);
    }
  };

  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      console.log('[DamageSketch] Refaire');
      setHistoryStep(historyStep + 1);
      setLines(history[historyStep + 1]);
    }
  };

  const handleClear = () => {
    console.log('[DamageSketch] Tout effacer');
    setLines([]);
    setHistory([...history.slice(0, historyStep + 1), []]);
    setHistoryStep(historyStep + 1);
    setCurrentNumber(1);
    setHasSketch(false);
    onSketchChange(null);
  };

  const handleExport = async () => {
    console.log('[DamageSketch] Export du schéma');
    if (!stageRef.current) {
      console.error('[DamageSketch] Stage ref non disponible');
      return;
    }

    try {
      const dataURL = stageRef.current.toDataURL({ pixelRatio: 2 });
      const base64 = dataURL.replace(/^data:image\/png;base64,/, '');
      console.log('[DamageSketch] Schéma exporté, taille base64:', base64.length);
      setHasSketch(true);
      onSketchChange(base64);
    } catch (err) {
      console.error('[DamageSketch] Erreur export:', err);
    }
  };

  const tools = [
    { id: 'pen', icon: <Pen size={20} />, label: 'Stylo' },
    { id: 'arrow', icon: <span className="text-xl">➜</span>, label: 'Flèche' },
    { id: 'circle', icon: <span className="text-xl">○</span>, label: 'Cercle' },
    { id: 'number', icon: <span className="text-xl">#</span>, label: 'Numéro' },
  ];

  return (
    <div className="bg-white rounded-lg p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Schéma des dégâts</h3>
        {hasSketch && (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
            ✓ Enregistré
          </span>
        )}
      </div>

      {/* Barre d'outils */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTool(t.id as any)}
              className={`p-2 rounded transition-colors ${
                tool === t.id
                  ? 'bg-blue-600 text-white'
                  : 'hover:bg-gray-100 text-gray-700'
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="flex gap-1 border border-gray-200 rounded-lg p-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyStep === 0}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Annuler"
          >
            <Undo size={20} />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyStep >= history.length - 1}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Refaire"
          >
            <Redo size={20} />
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="p-2 rounded hover:bg-red-100 text-red-600"
            title="Tout effacer"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="border-2 border-gray-300 rounded-lg bg-gray-50 overflow-hidden mb-4">
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleMouseDown}
          onTouchMove={handleMouseMove}
          onTouchEnd={handleMouseUp}
        >
          <Layer>
            {lines.map((line, i) => {
              if (line.tool === 'pen' && line.points) {
                return (
                  <Line
                    key={i}
                    points={line.points}
                    stroke={line.color}
                    strokeWidth={3}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                  />
                );
              } else if (line.tool === 'arrow' && line.points) {
                return (
                  <Arrow
                    key={i}
                    points={line.points}
                    stroke={line.color}
                    strokeWidth={3}
                    fill={line.color}
                    pointerLength={10}
                    pointerWidth={10}
                  />
                );
              } else if (line.tool === 'circle' && line.x !== undefined && line.y !== undefined) {
                return (
                  <Circle
                    key={i}
                    x={line.x}
                    y={line.y}
                    radius={line.radius || 0}
                    stroke={line.color}
                    strokeWidth={3}
                  />
                );
              } else if (line.tool === 'number' && line.x !== undefined && line.y !== undefined) {
                return (
                  <React.Fragment key={i}>
                    <Circle
                      x={line.x}
                      y={line.y}
                      radius={18}
                      fill={line.color}
                    />
                    <Text
                      x={line.x - 18}
                      y={line.y - 10}
                      width={36}
                      height={20}
                      text={String(line.number)}
                      fontSize={16}
                      fontStyle="bold"
                      fill="white"
                      align="center"
                      verticalAlign="middle"
                    />
                  </React.Fragment>
                );
              }
              return null;
            })}
          </Layer>
        </Stage>
      </div>

      {/* Bouton d'export */}
      <button
        type="button"
        onClick={handleExport}
        disabled={lines.length === 0}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download size={20} />
        <span>Enregistrer le schéma</span>
      </button>

      {lines.length === 0 && (
        <p className="text-sm text-gray-500 text-center mt-2">
          Utilisez les outils ci-dessus pour annoter les dégâts
        </p>
      )}
    </div>
  );
}
