'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/components/AppShell';
import { MemoryChat } from '@/components/MemoryChat';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function ChatRoute() {
  const store = useStore();
  const router = useRouter();
  const [confirmClear, setConfirmClear] = useState(false);

  const handleRecall = (uid: string) => {
    store.selectMemory(uid);
    router.push('/memories');
  };

  return (
    <div className="page page-chat">
      <MemoryChat
        messages={store.messages}
        isProcessing={store.isProcessing}
        sessionId={store.sessionId}
        memoryById={store.memoryById}
        memoryCount={store.stats.totalMemories}
        onSendMessage={store.processMessage}
        onClearChat={() => setConfirmClear(true)}
        onNewChat={store.startNewChat}
        onRecallMemory={handleRecall}
      />

      <ConfirmDialog
        open={confirmClear}
        title="Clear this conversation?"
        description="The messages in this session will be deleted. Memories already learned from it stay in the graph."
        confirmLabel="Clear chat"
        onConfirm={store.clearChat}
        onClose={() => setConfirmClear(false)}
      />
    </div>
  );
}
