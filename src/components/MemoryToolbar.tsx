'use client';

import { useEffect, useRef, useState } from 'react';
import type { MemoryFilter, MemorySort } from '@/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CloseIcon, PlusIcon, ScissorsIcon, SearchIcon } from '@/components/icons';

interface Props {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sort: MemorySort;
  onSortChange: (sort: MemorySort) => void;
  filter: MemoryFilter;
  onFilterChange: (filter: MemoryFilter) => void;
  counts: Record<MemoryFilter, number>;
  showFilters: boolean;
  onPrune: () => void;
  onCreateMemory: (content: string, importance: number, tags: string[]) => Promise<boolean>;
}

const FILTERS: Array<{ id: MemoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'strong', label: 'Strong' },
  { id: 'steady', label: 'Steady' },
  { id: 'fading', label: 'Fading' },
  { id: 'connected', label: 'Linked' },
];

const SORTS: Array<{ id: MemorySort; label: string }> = [
  { id: 'weight', label: 'Weight' },
  { id: 'recent', label: 'Recent' },
  { id: 'accessed', label: 'Most used' },
  { id: 'edges', label: 'Most linked' },
];

export function MemoryToolbar({
  searchQuery,
  onSearchChange,
  sort,
  onSortChange,
  filter,
  onFilterChange,
  counts,
  showFilters,
  onPrune,
  onCreateMemory,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [showPrune, setShowPrune] = useState(false);
  const [content, setContent] = useState('');
  const [importance, setImportance] = useState(0.5);
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses search from anywhere that isn't already a text field.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const reset = () => {
    setContent('');
    setImportance(0.5);
    setTags('');
    setShowCreate(false);
  };

  const submit = async () => {
    if (!content.trim() || saving) return;
    setSaving(true);
    const ok = await onCreateMemory(
      content.trim(),
      importance,
      tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    );
    setSaving(false);
    if (ok) reset();
  };

  return (
    <>
      <div className="toolbar">
        <div className="toolbar-row">
          <div className="search-field">
            <SearchIcon size={16} />
            <label htmlFor="memory-search" className="sr-only">
              Search memories
            </label>
            <input
              id="memory-search"
              ref={searchRef}
              type="search"
              className="search-input"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search memories…"
              autoComplete="off"
            />
            <div className="search-suffix">
              {searchQuery ? (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                >
                  <CloseIcon size={12} />
                </button>
              ) : (
                <span className="kbd" aria-hidden="true">
                  /
                </span>
              )}
            </div>
          </div>

          <div className="toolbar-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPrune(true)}
              title="Forget faded, isolated memories"
            >
              <ScissorsIcon size={14} />
              <span className="btn-label">Prune</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreate((open) => !open)}
              aria-expanded={showCreate}
            >
              {showCreate ? <CloseIcon size={14} /> : <PlusIcon size={14} />}
              <span className="btn-label">{showCreate ? 'Cancel' : 'Memory'}</span>
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="filter-row" role="group" aria-label="Filter memories">
            {FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`filter-pill ${filter === id ? 'active' : ''}`}
                onClick={() => onFilterChange(id)}
                aria-pressed={filter === id}
              >
                {label}
                <span className="count">{counts[id]}</span>
              </button>
            ))}
            <div className="sort-select">
              <label htmlFor="memory-sort" className="sr-only">
                Sort memories
              </label>
              <select
                id="memory-sort"
                className="select"
                value={sort}
                onChange={(event) => onSortChange(event.target.value as MemorySort)}
              >
                {SORTS.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {showCreate && (
          <div className="create-row" style={{ animation: 'rise .24s cubic-bezier(.22,.61,.36,1) both' }}>
            <label htmlFor="new-memory" className="sr-only">
              Memory content
            </label>
            <textarea
              id="new-memory"
              className="textarea"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="What should be remembered?"
              rows={3}
              maxLength={2000}
            />
            <div className="create-controls">
              <label className="range-label">
                Seed
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={importance}
                  onChange={(event) => setImportance(Number(event.target.value))}
                />
                <span className="memory-weight">
                  <small>w</small>
                  {importance.toFixed(2)}
                </span>
              </label>
              <label className="tag-field">
                <span className="sr-only">Tags</span>
                <input
                  className="input"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="tags, comma separated"
                />
              </label>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void submit()}
                disabled={!content.trim() || saving}
              >
                {saving ? 'Saving…' : 'Add memory'}
              </button>
            </div>
          </div>
        )}
      </div>

      {showPrune && (
        <ConfirmDialog
          open={showPrune}
          title="Prune faded memories?"
          description="This permanently forgets memories whose weight has decayed below 0.05 and that have no live connections. Strong or linked memories are kept."
          confirmLabel="Prune"
          onConfirm={onPrune}
          onClose={() => setShowPrune(false)}
        />
      )}
    </>
  );
}
