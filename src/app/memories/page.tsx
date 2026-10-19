'use client';

import { useState } from 'react';
import { useStore } from '@/components/AppShell';
import { MemoryToolbar } from '@/components/MemoryToolbar';
import { MemoryList } from '@/components/MemoryList';
import { MemoryInsights } from '@/components/MemoryInsights';
import { MemoryDetail } from '@/components/MemoryDetail';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function MemoriesRoute() {
  const store = useStore();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const pendingMemory =
    pendingDelete === null ? null : store.memoryById.get(pendingDelete) ?? null;

  return (
    <div className="page page-memories">
      <div className="memories-wrap">
        <header className="memories-head">
          <span className="eyebrow">Memory graph</span>
          <h1>What your assistant remembers</h1>
          <p className="memories-lede">
            Every memory carries a weight built from use, connections and recency.
            Retrieved memories climb; untouched ones decay and eventually get pruned.
          </p>

          <div className="stat-strip">
            <div className="stat">
              <span className="stat-label">Memories</span>
              <span className="stat-value">{store.stats.totalMemories}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Mean weight</span>
              <span className="stat-value">{store.avgWeight.toFixed(2)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Strongest</span>
              <span className="stat-value">
                {store.strongest ? store.strongest.weight.toFixed(2) : '—'}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">Edges</span>
              <span className="stat-value">{store.totalEdges}</span>
            </div>
          </div>
        </header>

        <MemoryToolbar
          searchQuery={store.searchQuery}
          onSearchChange={store.setSearchQuery}
          sort={store.sort}
          onSortChange={store.setSort}
          filter={store.filter}
          onFilterChange={store.setFilter}
          counts={store.filterCounts}
          showFilters
          onPrune={() => void store.manualPrune()}
          onCreateMemory={store.createManualMemory}
        />

        <MemoryList
          memories={store.filteredMemories}
          totalCount={store.memories.length}
          isLoading={store.isLoadingMemories}
          searchQuery={store.searchQuery}
          onOpen={store.selectMemory}
          onDelete={setPendingDelete}
        />
      </div>

      <aside className="memories-aside" aria-label="Graph insights">
        <MemoryInsights
          memories={store.memories}
          avgWeight={store.avgWeight}
          totalEdges={store.totalEdges}
          onOpen={store.selectMemory}
        />
      </aside>

      <MemoryDetail
        memory={store.selectedMemory}
        onClose={() => store.selectMemory(null)}
        onDelete={(id) => {
          void store.deleteMemory(id);
          store.selectMemory(null);
        }}
      />

      {pendingMemory && (
        <ConfirmDialog
          open
          title="Forget this memory?"
          description={`“${pendingMemory.content.slice(0, 140)}${pendingMemory.content.length > 140 ? '…' : ''}” will be deleted along with its connections.`}
          confirmLabel="Forget"
          onConfirm={() => void store.deleteMemory(pendingMemory.id)}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
