'use client';

import { useStore } from '@/components/AppShell';
import { MemoryTierView } from '@/components/MemoryTierView';

export default function MemoriesRoute() {
  const store = useStore();

  return (
    <div className="page-memories">
      <div className="page-memories-sidebar">
        <MemoryTierView
          memories={store.filteredMemories}
          stats={store.stats}
          selectedTier={store.selectedTier}
          onSelectTier={store.setSelectedTier}
          onCreateMemory={store.createManualMemory}
        />
      </div>
    </div>
  );
}
