// Keep an ambiguous paid request through component remounts/page reloads.
// Scope includes the signed-in user and the exact operation. Never expire a
// pending receipt by time: a lost response is not proof the charge failed.
const pending = new Map<string, string>();
export function paidRequestId(scope: string): string {
  const key = `vault:paid-request:${scope}`;
  let id = pending.get(key);
  try { id ??= sessionStorage.getItem(key) ?? undefined; } catch { /* storage disabled */ }
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) id = crypto.randomUUID();
  pending.set(key, id);
  try { sessionStorage.setItem(key, id); } catch { /* in-memory retry remains safe */ }
  return id;
}
export function finishPaidRequest(scope: string) {
  const key = `vault:paid-request:${scope}`;
  pending.delete(key);
  try { sessionStorage.removeItem(key); } catch { /* storage disabled */ }
}
// 5xx, malformed responses and network failures are ambiguous: reuse the ID.
export function isDefinitiveRejection(status: number) {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}
