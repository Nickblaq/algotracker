import { MemoryOperation, MemoryEntry } from '../types';

interface Props {
  operations: MemoryOperation[];
  memories: MemoryEntry[];
}

const OP_ICONS: Record<string, string> = {
  create: '✦',
  consolidate: '↑',
  decay: '↓',
  retrieve: '🔍',
  associate: '↔',
  prune: '✂',
};

const OP_COLORS: Record<string, string> = {
  create: 'var(--sensory)',
  consolidate: 'var(--long-term)',
  decay: 'var(--text-dim)',
  retrieve: 'var(--short-term)',
  associate: 'var(--episodic)',
  prune: 'var(--danger)',
};

export function OperationLog({ operations }: Props) {
  return (
    <div className="operation-log">
      {operations.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📋</span>
          <p>No operations yet. Start a conversation or manually create memories to see operations.</p>
        </div>
      ) : (
        <div className="operation-list">
          {operations.map(op => (
            <div key={op.id} className="operation-item">
              <div
                className="operation-icon"
                style={{ backgroundColor: OP_COLORS[op.type] || 'var(--surface-2)' }}
              >
                {OP_ICONS[op.type] || '?'}
              </div>
              <div className="operation-details">
                <div className="operation-header">
                  <span className="operation-type" style={{ color: OP_COLORS[op.type] }}>
                    {op.type.toUpperCase()}
                  </span>
                  <span className="operation-tier">
                    {op.sourceTier}
                    {op.targetTier ? ` → ${op.targetTier}` : ''}
                  </span>
                  <span className="operation-time">
                    {new Date(op.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="operation-desc">{op.details}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
