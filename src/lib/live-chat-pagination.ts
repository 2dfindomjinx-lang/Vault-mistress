export const CHAT_PAGE_SIZE = 50;

export type ChatPosition = { created_at: string; id: string };

// Keep Postgres microseconds intact: Date.toISOString() would truncate them.
export function chatCursor(row: ChatPosition) {
  return `${row.created_at}|${row.id}`;
}

export function parseChatCursor(value: string | null): ChatPosition | null {
  if (!value) return null;
  const [created_at, id, extra] = value.split("|");
  if (extra !== undefined || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(created_at ?? "") ||
      !Number.isFinite(Date.parse(created_at)) || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id ?? "")) return null;
  return { created_at, id };
}

export function mergeChatMessages<T extends ChatPosition>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  // API timestamps are returned in the same UTC format, including microseconds.
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
