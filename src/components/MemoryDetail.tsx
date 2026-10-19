'use client';

import { useEffect, useState } from 'react';
import type { MemoryEntry } from '@/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  CheckIcon,
  CloseIcon,
  CopyIcon,
  LinkIcon,
  TrashIcon,
} from '@/components/icons';
import { fullDate, timeAgo, weightBand } from '@/lib/format';

interface Props {
  memory: MemoryEntry | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function MemoryDetail({ memory, onClose, onDelete }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!memory) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [memory, onClose]);

  if (!memory) return null;

  const band = weightBand(memory.weight);
  const copied = copiedId === memory.id;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(memory.content);
      setCopiedId(memory.id);
      window.setTimeout(
        () => setCopiedId((current) => (current === memory.id ? null : current)),
        1600,
      );
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <>
      <div
        className="overlay"
        role="presentation"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-detail-title"
        >
          <div className="modal-head">
            <h2 id="memory-detail-title">Memory</h2>
            <span className={`chip ${band === 'strong' ? 'chip-accent' : band === 'steady' ? 'chip-strong' : ''}`}>
              {band}
            </span>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <CloseIcon size={18} />
            </button>
          </div>

          <div className="modal-body">
            <p className="modal-text">{memory.content}</p>

            <div className="weight-scale">
              <div className="weight-scale-head">
                <span>Emergent weight</span>
                <strong>{memory.weight.toFixed(3)}</strong>
              </div>
              <div
                className="weight-scale-track"
                role="meter"
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={Number(memory.weight.toFixed(3))}
                aria-label="Emergent weight"
              >
                <div
                  className="weight-scale-fill"
                  style={{ width: `${Math.max(2, memory.weight * 100)}%` }}
                />
              </div>
              <p className="insight-note">
                Rises each time it is retrieved; decays with time since last use.
              </p>
            </div>

            <div className="detail-grid">
              <div className="detail-cell">
                <span className="label">Retrievals</span>
                <span className="value">{memory.accessCount}</span>
              </div>
              <div className="detail-cell">
                <span className="label">Connections</span>
                <span className="value">
                  {memory.edgeCount > 0 ? (
                    <>
                      <LinkIcon size={12} /> {memory.edgeCount}
                    </>
                  ) : (
                    'none'
                  )}
                </span>
              </div>
              <div className="detail-cell">
                <span className="label">Seed importance</span>
                <span className="value">{memory.importance.toFixed(2)}</span>
              </div>
              <div className="detail-cell">
                <span className="label">Last used</span>
                <span className="value">
                  {timeAgo(memory.lastAccessed)}
                  <br />
                  <small style={{ color: 'var(--muted)', fontWeight: 400 }}>
                    {fullDate(memory.lastAccessed)}
                  </small>
                </span>
              </div>
              <div className="detail-cell">
                <span className="label">Created</span>
                <span className="value">{fullDate(memory.createdAt)}</span>
              </div>
              <div className="detail-cell">
                <span className="label">ID</span>
                <span className="value" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                  {memory.id}
                </span>
              </div>
            </div>

            {memory.tags.length > 0 && (
              <div className="modal-tags">
                {memory.tags.map((tag) => (
                  <span key={tag} className="memory-tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="modal-foot">
            <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
              {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <span className="grow" />
            <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
              <TrashIcon size={14} />
              Forget
            </button>
          </div>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          open={confirming}
          title="Forget this memory?"
          description="It will be deleted from the graph along with its connections. This cannot be undone."
          confirmLabel="Forget"
          onConfirm={() => onDelete(memory.id)}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
