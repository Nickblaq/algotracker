import { useState, useRef, useEffect, useCallback } from 'react';
import { ConversationMessage, MemoryEntry } from '../types';
import type { ChatSession } from '../lib/api';

interface Props {
  messages: ConversationMessage[];
  isProcessing: boolean;
  onSendMessage: (msg: string) => Promise<string>;
  memoriesAccessed: MemoryEntry[];
  sessions: ChatSession[];
  currentSessionId: string;
  onNewChat: () => void;
  onSwitchSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export function MemoryChat({
  messages,
  isProcessing,
  onSendMessage,
  sessions,
  currentSessionId,
  onNewChat,
  onSwitchSession,
  onDeleteSession,
}: Props) {
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);
  const userScrolledRef = useRef(false);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;
    userScrolledRef.current = !isAtBottom;
  }, []);

  useEffect(() => {
    const newMessageCount = messages.length;
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = newMessageCount;
    if (newMessageCount > prevCount && !userScrolledRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    const msg = input;
    setInput('');
    await onSendMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-panel">
      {/* Chat header with history toggle */}
      <div className="chat-header">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setShowHistory(!showHistory)}
          title="Chat history"
        >
          {showHistory ? '✕' : '☰'} History
        </button>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => { onNewChat(); setShowHistory(false); }}
        >
          + New Chat
        </button>
      </div>

      <div className="chat-body-wrapper">
        {/* History sidebar */}
        {showHistory && (
          <div className="chat-history-panel">
            <div className="chat-history-list">
              {sessions.length === 0 ? (
                <div className="chat-history-empty">No previous chats</div>
              ) : (
                sessions.map(session => (
                  <div
                    key={session.id}
                    className={`chat-history-item ${session.id === currentSessionId ? 'active' : ''}`}
                  >
                    <button
                      className="chat-history-item-btn"
                      onClick={() => { onSwitchSession(session.id); setShowHistory(false); }}
                    >
                      <div className="chat-history-title">{session.title}</div>
                      <div className="chat-history-meta">
                        {session.messageCount} messages · {timeAgo(session.lastMessageAt)}
                      </div>
                    </button>
                    <button
                      className="chat-history-delete"
                      onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                      title="Delete chat"
                    >
                      🗑
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="chat-messages" ref={messagesContainerRef} onScroll={handleScroll}>
          {messages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-icon">🧠</div>
              <h3>Hierarchical Memory</h3>
              <p>
                Start a conversation. The memory system captures, stores, and
                retrieves information across five cognitive tiers.
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'user' ? '👤' : '🤖'}
              </div>
              <div className="message-body">
                <div className="message-meta">
                  <span className="message-role">{msg.role}</span>
                  <span className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="message-content">{msg.content}</div>
                {msg.memoriesAccessed.length > 0 && (
                  <div className="message-memories">
                    <span className="memories-badge">🧠 {msg.memoriesAccessed.length} memories accessed</span>
                  </div>
                )}
                {msg.memoriesCreated.length > 0 && (
                  <div className="message-memories">
                    <span className="memories-created">+ {msg.memoriesCreated.length} memories created</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="chat-message chat-message-assistant">
              <div className="message-avatar">🤖</div>
              <div className="message-body">
                <div className="typing-indicator">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="chat-input-area">
        <div className="input-wrapper">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="chat-textarea"
            rows={1}
            disabled={isProcessing}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="send-btn"
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
