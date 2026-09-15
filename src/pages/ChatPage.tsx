import { useStore } from '../components/AppLayout';
import { MemoryChat } from '../components/MemoryChat';
import { MemoryToolbar } from '../components/MemoryToolbar';

export function ChatPage() {
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
          onSendMessage={(msg) => store.processMessage(msg)}
          memoriesAccessed={store.memories}
          sessions={store.sessions}
          currentSessionId={store.sessionId}
          onNewChat={store.startNewChat}
          onSwitchSession={store.switchSession}
          onDeleteSession={store.deleteSession}
        />
      </div>
    </div>
  );
}
