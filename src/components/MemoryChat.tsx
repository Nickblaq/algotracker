import { useState, useRef, useEffect } from 'react';
import { ConversationMessage, MemoryEntry } from '../types';

interface Props {
  messages: ConversationMessage[];
  isProcessing: boolean;
  onSendMessage: (msg: string) => Promise<string>;
  memoriesAccessed: MemoryEntry[];
}

export function MemoryChat({ messages, isProcessing, onSendMessage }: Props) {
  const [input, setInput] = useState('');
  const [lastRetrieved, setLastRetrieved] = useState<MemoryEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    const msg = input;
    setInput('');
    try {
      // The response is handled by the store, but we can track last retrieved
    } catch {
      // Error handled by store
    }
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
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">🧠</div>
            <h3>Start a Conversation</h3>
            <p>Type a message to see how the hierarchical memory system captures, stores, and retrieves information across different memory tiers.</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? '👤' : msg.role === 'assistant' ? '🤖' : '⚙️'}
            </div>
            <div className="message-body">
              <div className="message-meta">
                <span className="message-role">{msg.role}</span>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString()}
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
                  <span className="memories-badge memories-created">+ {msg.memoriesCreated.length} memories created</span>
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

      <div className="chat-input-area">
        <div className="input-wrapper">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... The memory system will capture and store relevant information."
            className="chat-textarea"
            rows={1}
            disabled={isProcessing}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="send-btn"
          >
            {isProcessing ? (
              <span className="send-spinner" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
