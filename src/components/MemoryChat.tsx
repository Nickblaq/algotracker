'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type KeyboardEvent,
} from 'react';
import type { ConversationMessage, MemoryEntry } from '@/types';
import {
  ArrowDownIcon,
  CheckIcon,
  CopyIcon,
  SendIcon,
  SparkIcon,
  SuggestionIcon,
} from '@/components/icons';
import { clockTime, shortSession, truncate } from '@/lib/format';

interface Props {
  messages: ConversationMessage[];
  isProcessing: boolean;
  sessionId: string;
  memoryById: Map<string, MemoryEntry>;
  memoryCount: number;
  onSendMessage: (msg: string) => Promise<string>;
  onClearChat: () => void;
  onNewChat: () => void;
  onRecallMemory: (uid: string) => void;
}

const SUGGESTIONS = [
  'What do you remember about me so far?',
  'Which memories are fading fastest, and why?',
  'Summarise everything you know in three bullets.',
];

export function MemoryChat({
  messages,
  isProcessing,
  sessionId,
  memoryById,
  memoryCount,
  onSendMessage,
  onClearChat,
  onNewChat,
  onRecallMemory,
}: Props) {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

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

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send(input);
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void send(input);
    }
  };

  const copy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1600);
    } catch {
      /* clipboard unavailable — silently ignore */
    }
  }, []);

  const isEmpty = messages.length === 0;
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
            className="btn btn-ghost btn-sm"
            onClick={onNewChat}
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

              return (
                <article
                  key={msg.id}
                  className={`msg ${isUser ? 'msg-user' : 'msg-assistant'} ${isError ? 'msg-error' : ''}`}
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

                    <div className="msg-bubble">{msg.content}</div>

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
                    <span>recalling memories…</span>
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
        <div className="composer">
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your memory graph…"
            rows={1}
            disabled={isProcessing}
          />
          <button
            type="button"
            className="composer-send"
            onClick={() => void send(input)}
            disabled={!input.trim() || isProcessing}
            aria-label="Send message"
          >
            {isProcessing ? (
              <span className="spinner" aria-hidden="true">
                ◌
              </span>
            ) : (
              <SendIcon size={17} />
            )}
          </button>
        </div>
        <div className="composer-foot">
          <span>
            <span className="kbd">↵</span> send · <span className="kbd">⇧</span>
            <span className="kbd">↵</span> newline
          </span>
          {input.length > 240 && <span>{input.length} chars</span>}
        </div>
      </div>
    </div>
  );
}
