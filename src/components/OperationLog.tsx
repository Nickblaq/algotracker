import { MemoryOperation, MemoryEntry } from '../types';

interface Props {
  operations: MemoryOperation[];
  memories: MemoryEntry[];
}

const OP_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  create: { icon: '✦', color: '#F97316', bg: '#FFF7ED' },
  consolidate: { icon: '↑', color: '#0EA5E9', bg: '#F0F9FF' },
  decay: { icon: '↓', color: '#94A3B8', bg: '#F1F5F9' },
  retrieve: { icon: '🔍', color: '#EAB308', bg: '#FEFCE8' },
  associate: { icon: '↔', color: '#8B5CF6', bg: '#F5F3FF' },
  prune: { icon: '✂', color: '#DC2626', bg: '#FEE2E2' },
};

export function OperationLog({ operations }: Props) {
  return (
    <div className="operation-log">
      {operations.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📋</span>
          <p>No operations yet. Start a conversation or create memories to see activity here.</p>
        </div>
      ) : (
        operations.map(op => {
          const cfg = OP_CONFIG[op.type] || { icon: '?', color: '#94A3B8', bg: '#F1F5F9' };
          return (
            <div key={op.id} className="operation-item">
              <div
                className="operation-icon"
                style={{ backgroundColor: cfg.bg, color: cfg.color }}
              >
                {cfg.icon}
              </div>
              <div className="operation-details">
                <div className="operation-header">
                  <span className="operation-type" style={{ color: cfg.color }}>
                    {op.type}
                  </span>
                  <span className="operation-tier">
                    {op.sourceTier}
                    {op.targetTier ? ` → ${op.targetTier}` : ''}
                  </span>
                  <span className="operation-time">
                    {new Date(op.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="operation-desc">{op.details}</p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
