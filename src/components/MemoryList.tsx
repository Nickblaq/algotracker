'use client';

import type { CSSProperties } from 'react';
import type { MemoryEntry } from '@/types';
import { ClockIcon, GraphIcon, LinkIcon, SearchIcon, TrashIcon } from '@/components/icons';
import { timeAgo, truncate, weightBand } from '@/lib/format';

interface Props {
  memories: MemoryEntry[];
  totalCount: number;
  isLoading: boolean;
  searchQuery: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function MemoryList({
  memories,
  totalCount,
  isLoading,
  searchQuery,
  onOpen,
  onDelete,
}: Props) {
  if (isLoading && totalCount === 0) {
    return (
      <div className="skeleton-list" aria-hidden="true">
        <div className="skeleton-card" />
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </div>
    );
  }

  if (memories.length === 0) {
    const searching = searchQuery.trim().length > 0;
    return (
      <div className="empty-state">
        {searching ? <SearchIcon size={26} /> : <GraphIcon size={26} />}
        <h3>{searching ? 'No matching memories' : 'Nothing remembered yet'}</h3>
        <p>
          {searching
            ? `Nothing matches “${truncate(searchQuery, 40)}”. Try a different word, or clear the filters.`
            : 'Send a chat message or add a memory to start growing the graph.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="list-meta">
        <span>
          Showing <strong>{memories.length}</strong> of {totalCount}{' '}
          {totalCount === 1 ? 'memory' : 'memories'}
        </span>
        <span>heaviest first</span>
      </div>

      <div className="memory-grid">
        {memories.map((mem, index) => {
          const band = weightBand(mem.weight);
          return (
            <article
              key={mem.id}
              className="memory-card"
              role="button"
              tabIndex={0}
              aria-label={`Open memory: ${truncate(mem.content, 70)}`}
              onClick={() => onOpen(mem.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen(mem.id);
                }
              }}
              style={
                {
                  '--weight': mem.weight,
                  animationDelay: `${Math.min(index, 8) * 18}ms`,
                } as CSSProperties
              }
            >
              <div className="memory-meter" aria-hidden="true" />
              <div className="memory-body">
                <p className="memory-text">{mem.content}</p>
                <div className="memory-foot">
                  <span
                    className={`memory-weight ${band === 'fading' ? 'is-fading' : ''}`}
                    title={`Emergent weight ${mem.weight.toFixed(3)} · ${band}`}
                  >
                    <small>w</small>
                    {mem.weight.toFixed(2)}
                  </span>
                  <span className="memory-meta" title={`${mem.accessCount} retrievals`}>
                    ×{mem.accessCount}
                  </span>
                  <span className="memory-meta" title="Last used">
                    <ClockIcon size={11} />
                    {timeAgo(mem.lastAccessed)}
                  </span>
                  <div className="memory-tags">
                    {mem.edgeCount > 0 && (
                      <span className="memory-tag memory-tag-edge" title="Graph connections">
                        <LinkIcon size={9} /> {mem.edgeCount}
                      </span>
                    )}
                    {mem.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="memory-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="memory-delete"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(mem.id);
                }}
                aria-label={`Delete memory: ${truncate(mem.content, 50)}`}
                title="Forget this memory"
              >
                <TrashIcon size={13} />
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}
