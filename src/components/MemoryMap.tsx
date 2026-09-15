import { useMemo, useRef, useEffect } from 'react';
import { MemoryEntry } from '../types';

interface Props {
  memories: MemoryEntry[];
}

interface Node {
  id: string;
  x: number;
  y: number;
  tier: string;
  importance: number;
  content: string;
}

const TIER_COLORS: Record<string, string> = {
  sensory: '#F97316',
  short_term: '#EAB308',
  long_term: '#0EA5E9',
  episodic: '#8B5CF6',
  procedural: '#EC4899',
};

export function MemoryMap({ memories }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const nodes = useMemo(() => {
    const center = { x: 180, y: 160 };
    const tierGroups: Record<string, MemoryEntry[]> = {};

    memories.slice(0, 60).forEach(m => {
      if (!tierGroups[m.tier]) tierGroups[m.tier] = [];
      tierGroups[m.tier].push(m);
    });

    const tierAngles: Record<string, number> = {
      sensory: 0,
      short_term: Math.PI * 0.4,
      long_term: Math.PI * 0.8,
      episodic: Math.PI * 1.2,
      procedural: Math.PI * 1.6,
    };

    const result: Node[] = [];
    Object.entries(tierGroups).forEach(([tier, mems]) => {
      const baseAngle = tierAngles[tier] || 0;
      mems.forEach((mem, i) => {
        const radius = 50 + (i * 16) + Math.random() * 8;
        const angle = baseAngle + (i * 0.15);
        result.push({
          id: mem.id,
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
          tier: mem.tier,
          importance: mem.importance,
          content: mem.content,
        });
      });
    });

    return result;
  }, [memories]);

  const edges = useMemo(() => {
    const result: Array<{ from: Node; to: Node }> = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    memories.forEach(mem => {
      const from = nodeMap.get(mem.id);
      if (!from) return;
      mem.associations.forEach(assocId => {
        const to = nodeMap.get(assocId);
        if (to) result.push({ from, to });
      });
    });

    return result;
  }, [memories, nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = 360;
    const h = 320;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    // Draw edges
    edges.forEach(({ from, to }) => {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Draw nodes
    nodes.forEach(node => {
      const radius = 2 + node.importance * 4;
      const color = TIER_COLORS[node.tier] || '#94A3B8';

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.6 + node.importance * 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Draw center
    ctx.beginPath();
    ctx.arc(180, 160, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#E2E8F0';
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#64748B';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CORE', 180, 163);
  }, [nodes, edges]);

  return (
    <div className="memory-map">
      <div className="map-header">
        <h3>Memory Map</h3>
        <span className="map-count">{memories.length} nodes</span>
      </div>
      <canvas
        ref={canvasRef}
        className="map-canvas"
        style={{ width: 360, height: 320 }}
      />
      <div className="map-legend">
        {Object.entries(TIER_COLORS).map(([tier, color]) => (
          <div key={tier} className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: color }} />
            <span>{tier.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
