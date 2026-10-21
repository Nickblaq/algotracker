export interface MemoryEntry {
  id: string;
  content: string;
  weight: number; // emergent 0-1; rises with use, decays with time
  edgeCount: number;
  importance: number; // authored seed 0-1
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface MemoryStats {
  totalMemories: number;
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  memoriesAccessed: string[];
  memoriesCreated: string[];
}

export interface ChatSession {
  sessionId: string;
  title: string;
  messageCount: number;
  lastActivity: number; // epoch ms
}

export type MemorySort = 'weight' | 'recent' | 'accessed' | 'edges';

export type MemoryFilter = 'all' | 'strong' | 'steady' | 'fading' | 'connected';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}
