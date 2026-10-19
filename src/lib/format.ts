/** Small shared formatting helpers for the memory UI. */

export function timeAgo(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  if (diff < 45_000) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fullDate(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Short, readable form of a session id like `s-1712345678901-ab12c`. */
export function shortSession(id: string): string {
  const match = id.match(/s-\d+-(.+)$/);
  if (match) return match[1];
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

/** Weight band used for chips and copy across the UI. */
export function weightBand(weight: number): 'strong' | 'steady' | 'fading' {
  if (weight >= 0.6) return 'strong';
  if (weight >= 0.25) return 'steady';
  return 'fading';
}

export function truncate(text: string, max = 44): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
