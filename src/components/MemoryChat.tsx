'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { ChatSession, ConversationMessage, MemoryEntry } from '@/types';
import {
  ArrowDownIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  PencilIcon,
  SendIcon,
  SparkIcon,
  StopIcon,
  SuggestionIcon,
} from '@/components/icons';
import { MarkdownText } from '@/components/MarkdownText';
import { clockTime, shortSession, truncate } from '@/lib/format';

interface Props {
  messages: ConversationMessage[];
  isProcessing: boolean;
  sessionId: string;
  memoryById: Map<string, MemoryEntry>;
  memoryCount: number;
  sessions: ChatSession[];
  editingId: string | null;
  onSendMessage: (msg: string) => Promise<string>;
  onStop: () => void;
  onEditStart: (id: string) => void;
  onEditCancel: () => void;
  onSelectSession: (id: string) => void;
  onClearChat: () => void;
  onNewChat: () => void;
  onRecallMemory: (uid: string) => void;
}

const SUGGESTIONS = [
  'What do you remember about me so far?',
  'Which memories are fading fastest, and why?',
  'Summarise everything you know in three bullets.',
];

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
  sessionId,
  memoryById,
  memoryCount,
  sessions,
  editingId,
  onSendMessage,
  onStop,
  onEditStart,
  onEditCancel,
  onSelectSession,
  onClearChat,
  onNewChat,
  onRecallMemory,
}: Props) {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pinnedRef = useRef(true);

  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [input, autoGrow]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
    pinnedRef.current = true;
    setShowScrollButton(false);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    pinnedRef.current = distance < 80;
    setShowScrollButton(distance > 240);
  }, []);

  useEffect(() => {
    if (pinnedRef.current) scrollToBottom(messages.length > 1 ? 'smooth' : 'auto');
  }, [messages, isProcessing, scrollToBottom]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isProcessing) return;
      setInput('');
      pinnedRef.current = true;
      await onSendMessage(trimmed);
      textareaRef.current?.focus();
    },
    [isProcessing, onSendMessage],
  );

  // Enter is newline-only: sending happens with the send button.
  const copy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1600);
    } catch {
      /* clipboard unavailable — silently ignore */
    }
  }, []);

  const beginEdit = useCallback(
    (msg: ConversationMessage) => {
      if (isProcessing) return;
      setInput(msg.content);
      onEditStart(msg.id);
      setShowHistory(false);
      textareaRef.current?.focus();
    },
    [isProcessing, onEditStart],
  );

  const cancelEdit = useCallback(() => {
    onEditCancel();
    textareaRef.current?.focus();
  }, [onEditCancel]);

  const isEmpty = messages.length === 0;
  const editing = editingId !== null;
  const sessionLabel = useMemo(
    () => (sessionId ? shortSession(sessionId) : ''),
    [sessionId],
  );

  return (
    <div className="chat-shell">
      <div className="chat-topbar">
        <div className="chat-topbar-title">
          <strong>Conversation</strong>
          <span className="chat-topbar-meta">
            {sessionLabel ? `session ${sessionLabel}` : 'new session'} ·{' '}
            {memoryCount} memories in graph
          </span>
        </div>
        <div className="chat-topbar-actions">
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${showHistory ? 'active' : ''}`}
            onClick={() => setShowHistory((open) => !open)}
            aria-expanded={showHistory}
            title="Past conversations"
          >
            <ClockIcon size={14} />
            History
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onNewChat}
            disabled={isProcessing}
            title="Start a fresh session"
          >
            New
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClearChat}
            disabled={isEmpty || isProcessing}
            title="Clear this conversation"
          >
            Clear
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="session-panel" role="list" aria-label="Past conversations">
          {sessions.length === 0 ? (
            <p className="session-empty">No past conversations yet.</p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.sessionId}
                type="button"
                role="listitem"
                className={`session-item ${session.sessionId === sessionId ? 'active' : ''}`}
                onClick={() => {
                  onSelectSession(session.sessionId);
                  setShowHistory(false);
                }}
                disabled={isProcessing}
              >
                <span className="session-item-title">
                  {truncate(session.title || 'Untitled conversation', 44)}
                </span>
                <span className="session-item-meta">
                  {session.messageCount}{' '}
                  {session.messageCount === 1 ? 'message' : 'messages'} ·{' '}
                  {timeAgo(session.lastActivity)}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="chat-scroll" ref={scrollRef} onScroll={handleScroll}>
        {isEmpty ? (
          <div className="chat-empty">
            <div className="chat-empty-mark" aria-hidden="true">
              <SparkIcon size={22} />
            </div>
            <h2>Ask something worth remembering.</h2>
            <p>
              Every reply reads from your memory graph and writes back to it. Memories
              that keep getting recalled gain weight; the rest fade.
            </p>
            <div className="suggestion-list">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="suggestion"
                  onClick={() => void send(suggestion)}
                  disabled={isProcessing}
                >
                  <SuggestionIcon size={15} />
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-thread">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isError = /^Error:/i.test(msg.content);
              const recalled = msg.memoriesAccessed
                .map((uid) => memoryById.get(uid))
                .filter((mem): mem is MemoryEntry => Boolean(mem));
              const isEditing = editingId === msg.id;

              return (
                <article
                  key={msg.id}
                  className={`msg ${isUser ? 'msg-user' : 'msg-assistant'} ${isError ? 'msg-error' : ''} ${isEditing ? 'msg-editing' : ''}`}
                >
                  <div className="msg-avatar" aria-hidden="true">
                    {isUser ? 'You' : 'HM'}
                  </div>
                  <div className="msg-body">
                    <div className="msg-meta">
                      <span className="msg-author">{isUser ? 'You' : 'Assistant'}</span>
                      <time dateTime={new Date(msg.timestamp).toISOString()}>
                        {clockTime(msg.timestamp)}
                      </time>
                      <span className="msg-actions">
                        {isUser && !isProcessing && (
                          <button
                            type="button"
                            className="icon-btn msg-edit-btn"
                            onClick={() => beginEdit(msg)}
                            aria-label="Edit message"
                            title="Edit this message — the messages after it are removed once the edit is sent"
                          >
                            <PencilIcon size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => void copy(msg.id, msg.content)}
                          aria-label={copiedId === msg.id ? 'Copied' : 'Copy message'}
                          title={copiedId === msg.id ? 'Copied' : 'Copy message'}
                        >
                          {copiedId === msg.id ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                        </button>
                      </span>
                    </div>

                    {isUser || isError ? (
                      <div className="msg-bubble">{msg.content}</div>
                    ) : (
                      <div className="msg-bubble">
                        <MarkdownText>{msg.content}</MarkdownText>
                      </div>
                    )}

                    {recalled.length > 0 && (
                      <div className="msg-recall">
                        {recalled.slice(0, 3).map((mem) => (
                          <button
                            key={mem.id}
                            type="button"
                            className="recall-chip"
                            onClick={() => onRecallMemory(mem.id)}
                            title={`${mem.content} — open in memory graph`}
                          >
                            <span className="recall-weight">{mem.weight.toFixed(2)}</span>
                            <span className="recall-text">
                              {truncate(mem.content, 40)}
                            </span>
                          </button>
                        ))}
                        {recalled.length > 3 && (
                          <span className="chip">+{recalled.length - 3} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}

            {isProcessing && (
              <div className="msg msg-assistant">
                <div className="msg-avatar" aria-hidden="true">
                  HM
                </div>
                <div className="msg-body">
                  <div className="msg-meta">
                    <span className="msg-author">Assistant</span>
                    <span>thinking…</span>
                  </div>
                  <div className="typing" aria-label="Assistant is thinking">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {showScrollButton && (
          <button
            type="button"
            className="scroll-bottom"
            onClick={() => scrollToBottom()}
          >
            <ArrowDownIcon size={13} /> Latest
          </button>
        )}
      </div>

      <div className="composer-wrap">
        {editing && (
          <div className="edit-banner" role="status">
            <span>
              Editing message — resending stores the new version, then removes the
              messages after it.
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={cancelEdit}
            >
              Cancel
            </button>
          </div>
        )}
        <div className="composer">
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              editing ? 'Edit your message…' : 'Message your memory graph…'
            }
            rows={1}
          />
          {isProcessing ? (
            <button
              type="button"
              className="composer-send composer-stop"
              onClick={onStop}
              aria-label="Stop generating"
              title="Stop — no reply is stored"
            >
              <StopIcon size={15} />
            </button>
          ) : (
            <button
              type="button"
              className="composer-send"
              onClick={() => void send(input)}
              disabled={!input.trim()}
              aria-label={editing ? 'Send edited message' : 'Send message'}
              title={editing ? 'Send edit' : 'Send'}
            >
              <SendIcon size={17} />
            </button>
          )}
        </div>
        {input.length > 240 && (
          <div className="composer-foot">
            <span>{input.length} chars</span>
          </div>
        )}
      </div>
    </div>
  );
}
