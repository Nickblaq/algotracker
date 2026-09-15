import { useStore } from '../components/AppLayout';
import { MemoryTierView } from '../components/MemoryTierView';
import { MemoryMap } from '../components/MemoryMap';

export function MemoriesPage() {
  const store = useStore();

  return (
    <div className="page-memories">
      <div className="page-memories-sidebar">
        <MemoryTierView
          memories={store.filteredMemories}
          stats={store.stats}
          selectedTier={store.selectedTier}
          onSelectTier={store.setSelectedTier}
          onAssociate={store.manualAssociate}
          onCreateMemory={store.createManualMemory}
          refresh={store.refresh}
        />
      </div>
      <div className="page-memories-map">
        <MemoryMap memories={store.memories} />
      </div>
    </div>
  );
}
