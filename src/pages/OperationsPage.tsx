import { useStore } from '../components/AppLayout';
import { OperationLog } from '../components/OperationLog';

export function OperationsPage() {
  const store = useStore();

  return (
    <div className="page-operations">
      <OperationLog operations={store.operations} memories={store.memories} />
    </div>
  );
}
