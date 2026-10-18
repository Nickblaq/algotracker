'use client';

import { useStore } from '@/components/AppShell';
import { MemoryChat } from '@/components/MemoryChat';
import { MemoryToolbar } from '@/components/MemoryToolbar';

export default function ChatRoute() {
  const store = useStore();

  return (
    <div className="page-chat">
      <MemoryToolbar
        searchQuery={store.searchQuery}
        onSearchChange={store.setSearchQuery}
        onPrune={store.manualPrune}
        onConsolidate={store.manualConsolidate}
        onCreateMemory={store.createManualMemory}
      />
      <div className="page-chat-body">
        <MemoryChat
          messages={store.messages}
          isProcessing={store.isProcessing}
          onSendMessage={store.processMessage}
          onClearChat={store.clearChat}
        />
      </div>
    </div>
  );
}
