import { useState } from 'react';
import { MemoryTier } from '../types';

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onPrune: () => void;
  onConsolidate: () => void;
  onCreateMemory: (content: string, tier: MemoryTier, importance: number, tags: string[]) => void;
}

const TIER_OPTIONS: MemoryTier[] = ['sensory', 'short_term', 'long_term', 'episodic', 'procedural'];

export function MemoryToolbar({ searchQuery, onSearchChange, onPrune, onConsolidate, onCreateMemory }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newTier, setNewTier] = useState<MemoryTier>('sensory');
  const [newImportance, setNewImportance] = useState(0.5);

  const handleCreate = () => {
    if (newContent.trim()) {
      onCreateMemory(newContent, newTier, newImportance, []);
      setNewContent('');
      setShowCreate(false);
    }
  };

  return (
    <div className="memory-toolbar">
      <div className="toolbar-row">
        <div className="search-box">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search memories..."
            className="search-input"
          />
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-sm btn-ghost" onClick={onConsolidate} title="Trigger consolidation">
            ↑ Consolidate
          </button>
          <button className="btn btn-sm btn-ghost" onClick={onPrune} title="Prune low-importance memories">
            ✂ Prune
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? '× Cancel' : '+ New Memory'}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="create-row">
          <textarea
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            placeholder="Enter memory content..."
            className="input create-input"
            rows={2}
          />
          <div className="create-controls">
            <select
              value={newTier}
              onChange={e => setNewTier(e.target.value as MemoryTier)}
              className="select"
            >
              {TIER_OPTIONS.map(t => (
                <option key={t} value={t}>{t.replace('_', ' ')}</option>
              ))}
            </select>
            <label className="range-label">
              Importance:
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={newImportance}
                onChange={e => setNewImportance(parseFloat(e.target.value))}
              />
              {newImportance.toFixed(2)}
            </label>
            <button className="btn btn-primary btn-sm" onClick={handleCreate}>
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
