// The site's own replacement for window.confirm / window.alert. Call it like
// the browser versions, but await it:
//
//   if (!(await confirmDialog("Sell this item?"))) return;
//   await alertDialog("Something went wrong.");
//
// It works from any code (no hook or provider needed): requests are queued
// here and <ConfirmDialogHost /> (mounted once in the root layout) renders
// them. With no host mounted (tests, server render) confirmDialog falls back
// to the browser's confirm so a call can never silently hang.

export type DialogTone = "default" | "danger";

export type DialogOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  message: string;
  title?: string;
  tone?: DialogTone;
};

export type DialogRequest = DialogOptions & {
  id: number;
  kind: "alert" | "confirm";
  resolve: (confirmed: boolean) => void;
};

type Listener = (queue: DialogRequest[]) => void;

let queue: DialogRequest[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(queue);
}

export function subscribeToDialogs(listener: Listener) {
  listeners.add(listener);
  listener(queue);
  return () => {
    listeners.delete(listener);
  };
}

export function settleDialog(id: number, confirmed: boolean) {
  const request = queue.find((entry) => entry.id === id);
  if (!request) return;
  queue = queue.filter((entry) => entry.id !== id);
  emit();
  request.resolve(confirmed);
}

function enqueue(kind: DialogRequest["kind"], input: string | DialogOptions): Promise<boolean> {
  const options = typeof input === "string" ? { message: input } : input;
  if (typeof window === "undefined" || listeners.size === 0) {
    if (typeof window === "undefined") return Promise.resolve(false);
    if (kind === "alert") {
      window.alert(options.message);
      return Promise.resolve(true);
    }
    return Promise.resolve(window.confirm(options.message));
  }
  return new Promise<boolean>((resolve) => {
    queue = [...queue, { ...options, id: nextId++, kind, resolve }];
    emit();
  });
}

export function confirmDialog(input: string | DialogOptions) {
  return enqueue("confirm", input);
}

export async function alertDialog(input: string | DialogOptions) {
  await enqueue("alert", input);
}
