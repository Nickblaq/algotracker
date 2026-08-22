import { useState, useRef, useEffect } from 'react';
import { ConversationMessage, MemoryEntry } from '../types';

interface Props {
  messages: ConversationMessage[];
  isProcessing: boolean;
  onSendMessage: (msg: string) => Promise<string>;
  memoriesAccessed: MemoryEntry[];
}

const SUGGESTED_PROMPTS = [
  {
    icon: '📚',
    label: 'Store a fact',
    prompt: "The quick brown fox jumps over the lazy dog. This sentence contains all 26 letters of the English alphabet.",
    description: 'Creates a sensory memory from your input',
  },
  {
    icon: '🔗',
    label: 'Build associations',
    prompt: "What are the connections between memory consolidation in the brain and how this app's hierarchical tiers work?",
    description: 'Links related concepts across memory tiers',
  },
  {
    icon: '🧠',
    label: 'Test recall',
    prompt: "What do you remember about transformer attention mechanisms and working memory?",
    description: 'Retrieves stored memories via similarity search',
  },
  {
    icon: '📖',
    label: 'Episodic memory',
    prompt: "Tell me a story about a user who built a knowledge management system. Remember this as an experience.",
    description: 'Stores a narrative in episodic memory tier',
  },
  {
    icon: '⚡',
    label: 'Procedural knowledge',
    prompt: "Explain step by step how to implement a retrieval-augmented generation (RAG) pipeline with vector embeddings.",
    description: 'Stores procedural (how-to) knowledge',
  },
  {
    icon: '🔄',
    label: 'Memory evolution',
    prompt: "Send several messages in a row: ask me about my favorite color, my pet's name, and what I had for breakfast. Then ask what you remember about me.",
    description: 'Demonstrates decay, consolidation, and tier promotion over time',
  },
];

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
            <div className="suggestion-chips">
              {SUGGESTED_PROMPTS.map((s) => (
                <button
                  key={s.label}
                  className="suggestion-chip"
                  onClick={() => {
                    setInput(s.prompt);
                  }}
                  title={s.description}
                >
                  <span className="chip-icon">{s.icon}</span>
                  <span className="chip-text">
                    <span className="chip-label">{s.label}</span>
                    <span className="chip-desc">{s.description}</span>
                  </span>
                </button>
              ))}
            </div>
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
