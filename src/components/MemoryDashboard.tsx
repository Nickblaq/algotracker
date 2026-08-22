import { useState } from 'react';
import { useMemoryStore } from '../hooks/useMemoryStore';
import { MemoryTierView } from './MemoryTierView';
import { MemoryChat } from './MemoryChat';
import { OperationLog } from './OperationLog';
import { MemoryStatsPanel } from './MemoryStatsPanel';
import { ApiKeyModal } from './ApiKeyModal';
import { MemoryToolbar } from './MemoryToolbar';
import { MemoryMap } from './MemoryMap';

export function MemoryDashboard() {
  const store = useMemoryStore();
  const [apiKey, setApiKey] = useState('');
  const [showApiModal, setShowApiModal] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'operations' | 'stats'>('chat');

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo-mark" />
          <h1>Hierarchical Memory for LLMs</h1>
        </div>
        <div className="header-right">
          <button
            className="btn btn-ghost btn-sm"
            onClick={store.clearChat}
            title="Start a new conversation"
          >
            + New Chat
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setShowApiModal(true)}
          >
            {apiKey ? '● API Connected' : '○ Set API Key'}
          </button>
        </div>
      </header>

      <div className="dashboard-body">
        {/* Left: Memory Tiers */}
        <aside className="dashboard-sidebar">
          <MemoryTierView
            memories={store.filteredMemories}
            stats={store.stats}
            selectedTier={store.selectedTier}
            onSelectTier={store.setSelectedTier}
            onAssociate={store.manualAssociate}
            onCreateMemory={store.createManualMemory}
            refresh={store.refresh}
          />
        </aside>

        {/* Center: Main content */}
        <main className="dashboard-main">
          <MemoryToolbar
            searchQuery={store.searchQuery}
            onSearchChange={store.setSearchQuery}
            onPrune={store.manualPrune}
            onConsolidate={store.manualConsolidate}
            onCreateMemory={store.createManualMemory}
          />

          <div className="main-panels">
            <div className="panel panel-tabs">
              <div className="tab-bar">
                <button
                  className={`tab ${activeTab === 'chat' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('chat')}
                >
                  Chat
                </button>
                <button
                  className={`tab ${activeTab === 'operations' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('operations')}
                >
                  Operations Log
                </button>
                <button
                  className={`tab ${activeTab === 'stats' ? 'tab-active' : ''}`}
                  onClick={() => setActiveTab('stats')}
                >
                  Analytics
                </button>
              </div>

              <div className="tab-content">
                {activeTab === 'chat' && (
                  <MemoryChat
                    messages={store.messages}
                    isProcessing={store.isProcessing}
                    onSendMessage={(msg) => store.processMessage(msg, apiKey)}
                    memoriesAccessed={store.memories}
                  />
                )}
                {activeTab === 'operations' && (
                  <OperationLog operations={store.operations} memories={store.memories} />
                )}
                {activeTab === 'stats' && (
                  <MemoryStatsPanel stats={store.stats} memories={store.memories} />
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Right: Memory Map */}
        <aside className="dashboard-right">
          <MemoryMap memories={store.memories} />
        </aside>
      </div>

      {showApiModal && (
        <ApiKeyModal
          onSetKey={(key) => {
            setApiKey(key);
            setShowApiModal(false);
          }}
          onClose={() => setShowApiModal(false)}
        />
      )}
    </div>
  );
}
