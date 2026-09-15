import { useStore } from '../components/AppLayout';
import { MemoryStatsPanel } from '../components/MemoryStatsPanel';

export function AnalyticsPage() {
  const store = useStore();

  return (
    <div className="page-analytics">
      <MemoryStatsPanel stats={store.stats} memories={store.memories} />
    </div>
  );
}
