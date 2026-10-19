'use client';

import type { MemoryEntry } from '@/types';
import { truncate } from '@/lib/format';

interface Props {
  memories: MemoryEntry[];
  avgWeight: number;
  totalEdges: number;
  onOpen: (id: string) => void;
}

export function MemoryInsights({ memories, avgWeight, totalEdges, onOpen }: Props) {
  const strong = memories.filter((mem) => mem.weight >= 0.6).length;
  const steady = memories.filter((mem) => mem.weight >= 0.25 && mem.weight < 0.6).length;
  const fading = memories.filter((mem) => mem.weight < 0.25).length;
  const total = Math.max(1, memories.length);

  const top = [...memories].sort((a, b) => b.weight - a.weight).slice(0, 5);
  const connected = memories.filter((mem) => mem.edgeCount > 0).length;

  return (
    <div>
      <section className="insight-card" aria-labelledby="distribution-title">
        <h2 className="insight-title" id="distribution-title">
          Weight distribution
        </h2>
        <div className="distribution" role="img" aria-label={`${strong} strong, ${steady} steady, ${fading} fading`}>
          <span className="dist-strong" style={{ width: `${(strong / total) * 100}%` }} />
          <span className="dist-steady" style={{ width: `${(steady / total) * 100}%` }} />
          <span className="dist-fading" style={{ width: `${(fading / total) * 100}%` }} />
        </div>
        <div className="legend">
          <div className="legend-row">
            <span className="swatch dist-strong" />
            Strong <span className="value">{strong}</span>
          </div>
          <div className="legend-row">
            <span className="swatch dist-steady" />
            Steady <span className="value">{steady}</span>
          </div>
          <div className="legend-row">
            <span className="swatch dist-fading" />
            Fading <span className="value">{fading}</span>
          </div>
        </div>
        <p className="insight-note">
          Mean weight {avgWeight.toFixed(2)} · {connected} of {memories.length} memories
          carry live connections ({totalEdges} edges).
        </p>
      </section>

      <section className="insight-card" aria-labelledby="strongest-title">
        <h2 className="insight-title" id="strongest-title">
          Strongest memories
        </h2>
        <div className="top-list">
          {top.map((mem) => (
            <button
              key={mem.id}
              type="button"
              className="top-item"
              onClick={() => onOpen(mem.id)}
              title={mem.content}
            >
              <span className="top-item-text">{truncate(mem.content, 42)}</span>
              <span className="top-item-value">{mem.weight.toFixed(2)}</span>
              <span className="top-item-track">
                <span
                  className="top-item-fill"
                  style={{ width: `${Math.max(3, mem.weight * 100)}%` }}
                />
              </span>
            </button>
          ))}
          {top.length === 0 && <p className="insight-note">No memories yet.</p>}
        </div>
      </section>
    </div>
  );
}
