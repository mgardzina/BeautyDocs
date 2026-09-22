"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

interface PopoverBox {
  readonly left: number;
  readonly width: number;
  readonly placement: "below" | "above";
  readonly offset: number; // distance from the chosen viewport edge
  readonly maxHeight: number;
}

/**
 * Dropdown surface rendered into a portal with fixed positioning so it is never
 * clipped by an ancestor's `overflow: hidden` (cards, modals) and always stays
 * inside the viewport. Anchored to `anchorRef`; flips above when space is tight.
 */
export function BeautyDocsAnchoredPopover({
  open,
  anchorRef,
  onClose,
  width = "anchor",
  minWidth = 176,
  children,
}: {
  readonly open: boolean;
  readonly anchorRef: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
  readonly width?: number | "anchor";
  readonly minWidth?: number;
  readonly children: ReactNode;
}) {
  const popRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<PopoverBox | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const desired = width === "anchor" ? r.width : width;
      const w = Math.min(Math.max(desired, minWidth), vw - 16);
      const left = Math.max(8, Math.min(r.left, vw - w - 8));
      const spaceBelow = vh - r.bottom - 8;
      const spaceAbove = r.top - 8;
      const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(340, Math.max(160, openAbove ? spaceAbove : spaceBelow));
      setBox({
        left,
        width: w,
        placement: openAbove ? "above" : "below",
        offset: openAbove ? vh - r.top + 6 : r.bottom + 6,
        maxHeight,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef, width, minWidth]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || popRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, anchorRef, onClose]);

  if (!open || box === null || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={popRef}
      className="fixed z-[120] flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-[0_16px_40px_-12px_rgba(75,45,55,0.25)]"
      style={{
        left: box.left,
        width: box.width,
        maxHeight: box.maxHeight,
        ...(box.placement === "below"
          ? { top: box.offset }
          : { bottom: box.offset }),
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
