"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function CourtDialog({ children, label, className, onClose, canClose = true, gameId }: {
  children: ReactNode; label: string; className: string; onClose: () => void; canClose?: boolean; gameId?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.showModal();
    return () => { node.close(); document.body.style.overflow = overflow; };
  }, []);
  // These rooms mount after an interaction; rendering immediately keeps reel refs measurable.
  if (typeof document === "undefined") return null;
  return createPortal(<dialog ref={dialog} className={className} aria-label={label} data-court-game={gameId}
    onCancel={event => { event.preventDefault(); if (canClose) onClose(); }}
    onClick={event => { if (event.target === event.currentTarget && canClose) onClose(); }}>
    {children}
  </dialog>, document.body);
}
