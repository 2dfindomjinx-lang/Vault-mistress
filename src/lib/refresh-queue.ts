// One in-flight read and at most one trailing refresh. Events arriving during
// a read are not discarded; hidden tabs keep a pending refresh until resumed.
export function createRefreshQueue(
  refresh: () => Promise<void>,
  { delayMs = 250, minimumIntervalMs = 1200, visible = () => true }: {
    delayMs?: number; minimumIntervalMs?: number; visible?: () => boolean;
  } = {},
) {
  let disposed = false;
  let busy = false;
  let dirty = false;
  let lastStart = -Infinity;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (disposed || busy || timer !== undefined || !dirty || !visible()) return;
    const wait = Math.max(delayMs, lastStart + minimumIntervalMs * 2 ** Math.min(failures, 4) - Date.now());
    timer = setTimeout(async () => {
      timer = undefined;
      if (disposed || !visible()) return;
      busy = true;
      dirty = false;
      lastStart = Date.now();
      try { await refresh(); failures = 0; }
      catch { failures++; dirty = true; }
      finally { busy = false; schedule(); }
    }, wait);
  };
  return {
    request() { dirty = true; schedule(); },
    dispose() { disposed = true; if (timer !== undefined) clearTimeout(timer); },
  };
}
