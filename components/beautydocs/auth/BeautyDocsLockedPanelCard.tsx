"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { BeautyDocsLockedPanelPreview } from "./BeautyDocsLockedPanelPreview";

/**
 * Shared "you've basically arrived" shell: a static, inert preview of the
 * real panel dimmed behind a floating white card. Used for every step of
 * account setup that happens after the account doesn't exist yet — e-mail
 * verification, finishing personal/company details, and the final
 * confirmation — so the whole journey feels like one continuous arrival
 * instead of a detour through a separate marketing page.
 */
export function BeautyDocsLockedPanelCard({
  variant,
  maxWidthClassName = "max-w-md",
  children,
}: {
  readonly variant: "owner" | "client";
  readonly maxWidthClassName?: string;
  readonly children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  return (
    // "bd-auth-page" reapplies the green shadcn theme tokens (--primary,
    // --secondary, input/button skins) that shared form components expect —
    // without it they fall back to the panel's own cherry theme, since this
    // overlay renders outside the normal auth page wrapper.
    <div className="bd-auth-page fixed inset-0 z-40 overflow-y-auto">
      <div aria-hidden="true" className="fixed inset-0">
        <BeautyDocsLockedPanelPreview variant={variant} />
        <div className="absolute inset-0 bg-[#0c1712]/55" />
      </div>
      {/*
        A normal-flow wrapper (not absolutely positioned) so content taller
        than the viewport pushes the container's height instead of being
        clipped: centering with `items-center` inside an `absolute inset-0`
        box pins that box to the viewport, so any overflow above the fold
        becomes unreachable by scroll. `min-h-full` keeps short content
        centered while letting tall content grow and scroll normally.
      */}
      <div className="relative z-10 flex min-h-full items-center justify-center p-4 py-8 sm:p-6">
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className={`w-full ${maxWidthClassName} overflow-hidden rounded-[28px] bg-white shadow-2xl`}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 16 }}
          transition={
            reduceMotion
              ? { duration: 0.15 }
              : { type: "spring", bounce: 0, duration: 0.35 }
          }
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}
