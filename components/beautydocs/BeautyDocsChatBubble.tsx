"use client";

import { MessageCircle, X } from "lucide-react";
import { useState } from "react";
import { BeautyDocsChat } from "./BeautyDocsChat";

type BeautyDocsChatBubbleProps =
  | {
      readonly mode: "consumer";
      readonly unreadCount: number;
      readonly onFindSalon: () => void;
    }
  | {
      readonly mode: "admin";
      readonly unreadCount: number;
      readonly tenantSlug: string;
      readonly canWrite: boolean;
      readonly canAssignPractitioner: boolean;
    };

export function BeautyDocsChatBubble(props: BeautyDocsChatBubbleProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open ? (
        <div
          aria-label="Szybki czat BeautyDocs"
          className="fixed bottom-24 right-3 z-[70] h-[min(680px,calc(100dvh-7rem))] w-[min(410px,calc(100vw-1.5rem))] sm:right-6"
          role="dialog"
        >
          {props.mode === "consumer" ? (
            <BeautyDocsChat
              compact
              mode="consumer"
              onClose={() => setOpen(false)}
              onFindSalon={() => {
                setOpen(false);
                props.onFindSalon();
              }}
            />
          ) : (
            <BeautyDocsChat
              canAssignPractitioner={props.canAssignPractitioner}
              canWrite={props.canWrite}
              compact
              mode="admin"
              onClose={() => setOpen(false)}
              tenantSlug={props.tenantSlug}
            />
          )}
        </div>
      ) : null}

      <button
        aria-expanded={open}
        aria-label={open ? "Zamknij szybki czat" : "Otwórz szybki czat"}
        className="fixed bottom-5 right-4 z-[71] grid size-14 place-items-center rounded-full bg-[#245c4d] text-white shadow-[0_12px_35px_rgba(32,70,61,0.34)] ring-4 ring-white/80 transition hover:scale-105 hover:bg-[#173d35] focus-visible:outline-none focus-visible:ring-[#c3d5aa] sm:right-7 sm:size-16"
        onClick={() => setOpen((current) => !current)}
        title="Szybki czat"
        type="button"
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-6 fill-current" />}
        {!open && props.unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-h-6 min-w-6 place-items-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-black text-white">
            {props.unreadCount > 99 ? "99+" : props.unreadCount}
          </span>
        ) : null}
      </button>
    </>
  );
}
