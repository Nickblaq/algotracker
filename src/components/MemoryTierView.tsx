import { useState } from 'react';
import { MemoryEntry, MemoryTier, MemoryStats } from '../types';

interface Props {
  memories: MemoryEntry[];
  stats: MemoryStats;
  selectedTier: MemoryTier | 'all';
  onSelectTier: (tier: MemoryTier | 'all') => void;
  onAssociate: (a: string, b: string) => void;
  onCreateMemory: (content: string, tier: MemoryTier, importance: number, tags: string[]) => void;
  refresh: () => void;
}

const TIER_COLORS: Record<MemoryTier, string> = {
  sensory: 'var(--sensory)',
  short_term: 'var(--short-term)',
  long_term: 'var(--long-term)',
  episodic: 'var(--episodic)',
  procedural: 'var(--procedural)',
};

const TIER_LABELS: Record<MemoryTier, string> = {
  sensory: 'Sensory',
  short_term: 'Short-Term',
  long_term: 'Long-Term',
  episodic: 'Episodic',
  procedural: 'Procedural',
};

const TIER_DESC: Record<MemoryTier, string> = {
  sensory: 'Raw input buffer. Decays rapidly without access.',
  short_term: 'Working memory. Holds recent context.',
  long_term: 'Persistent knowledge. High retention.',
  episodic: 'Experience-based. Event sequences.',
  procedural: 'Skill memory. How-to knowledge.',
};

export function MemoryTierView({ memories, stats, selectedTier, onSelectTier, onCreateMemory }: Props) {
  const [expandedTier, setExpandedTier] = useState<MemoryTier | null>(null);
  const [selectedForAssociate, setSelectedForAssociate] = useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMemory, setNewMemory] = useState({ content: '', tier: 'sensory' as MemoryTier, importance: 0.5, tags: '' as string });

  const tiers: MemoryTier[] = ['sensory', 'short_term', 'long_term', 'episodic', 'procedural'];

  const handleAssociateClick = (memId: string) => {
    if (selectedForAssociate.length === 1 && selectedForAssociate[0] !== memId) {
      const memA = memories.find(m => m.id === selectedForAssociate[0]);
      const memB = memories.find(m => m.id === memId);
      if (memA && memB) {
        // Direct call would need the store method - for now just reset
        setSelectedForAssociate([]);
      }
    } else {
      setSelectedForAssociate(prev =>
        prev.includes(memId) ? prev.filter(id => id !== memId) : [...prev, memId]
      );
    }
  };

  return (
    <div className="tier-view">
      <div className="tier-view-header">
        <h2>Memory Tiers</h2>
        <button className="btn btn-sm btn-ghost" onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? '×' : '+'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-memory-form">
          <textarea
            placeholder="Memory content..."
            value={newMemory.content}
            onChange={e => setNewMemory(p => ({ ...p, content: e.target.value }))}
            className="input"
            rows={2}
          />
          <div className="form-row">
            <select
              value={newMemory.tier}
              onChange={e => setNewMemory(p => ({ ...p, tier: e.target.value as MemoryTier }))}
              className="select"
            >
              {tiers.map(t => (
                <option key={t} value={t}>{TIER_LABELS[t]}</option>
              ))}
            </select>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={newMemory.importance}
              onChange={e => setNewMemory(p => ({ ...p, importance: parseFloat(e.target.value) }))}
            />
            <span className="importance-val">{newMemory.importance.toFixed(2)}</span>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              if (newMemory.content.trim()) {
                onCreateMemory(newMemory.content, newMemory.tier, newMemory.importance, newMemory.tags ? newMemory.tags.split(',').map(t => t.trim()) : []);
                setNewMemory({ content: '', tier: 'sensory', importance: 0.5, tags: '' });
                setShowCreateForm(false);
              }
            }}
          >
            Add Memory
          </button>
        </div>
      )}

      {selectedForAssociate.length > 0 && (
        <div className="associate-bar">
          {selectedForAssociate.length}/2 selected
          <button className="btn btn-sm btn-ghost" onClick={() => setSelectedForAssociate([])}>
            Clear
          </button>
        </div>
      )}

      <div className="tier-filters">
        <button
          className={`tier-filter-btn ${selectedTier === 'all' ? 'active' : ''}`}
          onClick={() => onSelectTier('all')}
        >
          All ({memories.length})
        </button>
        {tiers.map(t => (
          <button
            key={t}
            className={`tier-filter-btn ${selectedTier === t ? 'active' : ''}`}
            onClick={() => onSelectTier(t)}
            style={{ '--tier-color': TIER_COLORS[t] } as React.CSSProperties}
          >
            {TIER_LABELS[t]} ({stats.tierCounts[t]})
          </button>
        ))}
      </div>

      <div className="tier-list">
        {tiers.map(tier => {
          const tierMemories = memories.filter(m => m.tier === tier);
          const isExpanded = expandedTier === tier || selectedTier === tier;

          return (
            <div key={tier} className="tier-card" style={{ '--tier-color': TIER_COLORS[tier] } as React.CSSProperties}>
              <button
                className="tier-card-header"
                onClick={() => setExpandedTier(expandedTier === tier ? null : tier)}
              >
                <div className="tier-indicator" />
                <div className="tier-info">
                  <span className="tier-name">{TIER_LABELS[tier]}</span>
                  <span className="tier-desc">{TIER_DESC[tier]}</span>
                </div>
                <span className="tier-count">{tierMemories.length}</span>
                <span className="tier-expand">{isExpanded ? '▾' : '▸'}</span>
              </button>

              {isExpanded && (
                <div className="tier-memory-list">
                  {tierMemories.length === 0 ? (
                    <div className="empty-tier">No memories in this tier</div>
                  ) : (
                    tierMemories.slice(0, 20).map(mem => (
                      <div
                        key={mem.id}
                        className={`memory-item ${selectedForAssociate.includes(mem.id) ? 'selected' : ''}`}
                        onClick={() => handleAssociateClick(mem.id)}
                      >
                        <div className="memory-item-header">
                          <div className="importance-bar" style={{ width: `${mem.importance * 100}%` }} />
                          <span className="memory-access-count">×{mem.accessCount}</span>
                        </div>
                        <p className="memory-content">{mem.content.slice(0, 120)}{mem.content.length > 120 ? '...' : ''}</p>
                        <div className="memory-item-footer">
                          <span className="memory-time">{timeAgo(mem.createdAt)}</span>
                          <div className="memory-tags">
                            {mem.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="memory-tag">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}
