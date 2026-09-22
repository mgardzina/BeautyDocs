"use client";

import Link from "next/link";
import { ChevronDown, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BeautyDocsWordmark } from "./BeautyDocsWordmark";

export interface BeautyDocsSidebarNavItem {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly badge?: number;
  readonly active?: boolean;
  readonly href?: string;
  readonly onClick?: () => void;
  readonly expanded?: boolean;
  readonly children?: readonly BeautyDocsSidebarNavItem[];
}

export interface BeautyDocsSidebarGroup {
  readonly label?: string;
  readonly items: readonly BeautyDocsSidebarNavItem[];
}

const ITEM_BASE =
  "flex min-h-11 items-center gap-3 rounded-xl text-sm font-semibold transition-colors active:bg-[#173d35] active:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]/40";
const ITEM_ACTIVE = "bg-[#245c4d] text-white shadow-[0_8px_22px_rgba(36,92,77,0.18)]";
const ITEM_IDLE = "text-[#5a6b5a] hover:bg-[#eff4e7] hover:text-[#173d35]";

/** One sidebar entry, rendered as a link or button, shared by full and mobile navs. */
export function BeautyDocsSidebarItem({
  item,
  compact = false,
  nested = false,
}: {
  readonly item: BeautyDocsSidebarNavItem;
  readonly compact?: boolean;
  readonly nested?: boolean;
}) {
  const Icon = item.icon;
  const stateClass = item.active
    ? nested
      ? "bg-[#eaf0e2] text-[#173d35]"
      : ITEM_ACTIVE
    : item.expanded
      ? "bg-[#f3f7ed] text-[#173d35]"
      : ITEM_IDLE;
  const className = `${ITEM_BASE} ${
    nested
      ? compact
        ? "px-2.5 py-2"
        : "px-3 py-2"
      : compact
        ? "px-3 py-2"
        : "px-3.5 py-2.5"
  } ${stateClass} w-full text-left`;
  const inner = (
    <>
      <Icon
        aria-hidden="true"
        className={`${nested ? "size-4" : "size-[18px]"} shrink-0`}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? (
        <span
          className={`min-w-5 shrink-0 rounded-full px-1.5 py-0.5 text-center text-xs font-black leading-none ${
            item.active
              ? "bg-white/20 text-white"
              : "bg-[#eef3e7] text-[#245c4d]"
          }`}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
      {item.children?.length ? (
        <ChevronDown
          aria-hidden="true"
          className={`size-4 shrink-0 transition-transform ${
            item.expanded ? "rotate-0" : "-rotate-90"
          }`}
        />
      ) : null}
    </>
  );
  if (item.href) {
    return (
      <Link
        aria-current={item.active ? "page" : undefined}
        className={className}
        href={item.href}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      aria-current={item.active ? "page" : undefined}
      className={className}
      onClick={item.onClick}
      type="button"
    >
      {inner}
    </button>
  );
}

/** Just the grouped nav items — used by mobile menus so they match the sidebar. */
export function BeautyDocsSidebarNav({
  groups,
  compact = false,
  className = "",
}: {
  readonly groups: readonly BeautyDocsSidebarGroup[];
  readonly compact?: boolean;
  readonly className?: string;
}) {
  return (
    <nav aria-label="Nawigacja" className={className}>
      {groups.map((group, index) => (
        <div key={group.label ?? index} className={compact ? "contents" : "mb-5 last:mb-0"}>
          {group.label && !compact ? (
            <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#5a6b5a]">
              {group.label}
            </p>
          ) : null}
          <div className={compact ? "contents" : "space-y-0.5"}>
            {group.items.map((item) => (
              <div
                className={compact && item.children?.length ? "col-span-2" : undefined}
                key={item.label}
              >
                <BeautyDocsSidebarItem compact={compact} item={item} />
                {item.expanded && item.children?.length ? (
                  <div
                    className={
                      compact
                        ? "relative ml-4 mt-1 grid grid-cols-2 gap-1 border-l border-[#d6dccd] pl-3"
                        : "relative ml-[1.1rem] mt-1 space-y-0.5 border-l border-[#d6dccd] pl-3"
                    }
                  >
                    {item.children.map((child) => (
                      <BeautyDocsSidebarItem
                        compact={compact}
                        item={child}
                        key={child.label}
                        nested
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Unified light sidebar column shared across every BeautyDocs panel. */
export function BeautyDocsSidebar({
  subtitle,
  logoHref,
  logoOnClick,
  context,
  groups,
  footer,
  footerLabel = "Konto",
}: {
  readonly subtitle: string;
  readonly logoHref?: string;
  readonly logoOnClick?: () => void;
  readonly context?: ReactNode;
  readonly groups: readonly BeautyDocsSidebarGroup[];
  readonly footer?: ReactNode;
  /** Small uppercase label above the footer; pass null to render none. */
  readonly footerLabel?: string | null;
}) {
  const logoClassName =
    "flex items-center px-2 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245c4d]";
  const logoInner = (
    <span className="leading-tight">
      <BeautyDocsWordmark className="block text-[17px] text-[#173d35]" />
      <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-[#5a6b5a]">
        {subtitle}
      </span>
    </span>
  );
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 px-4 py-5">
      {logoOnClick ? (
        <button className={logoClassName} onClick={logoOnClick} type="button">
          {logoInner}
        </button>
      ) : (
        <Link className={logoClassName} href={logoHref ?? "#"}>
          {logoInner}
        </Link>
      )}

      {context ? <div className="px-1">{context}</div> : null}

      <BeautyDocsSidebarNav
        className="min-h-0 flex-1 overflow-y-auto px-1 pb-2"
        groups={groups}
      />

      {footer ? (
        <div className="sticky bottom-0 z-40 mt-auto shrink-0 border-t border-[#e7ecdf] bg-[#f8fbf5] px-1 pt-4">
          {footerLabel ? (
            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#5a6b5a]">
              {footerLabel}
            </p>
          ) : null}
          {footer}
        </div>
      ) : null}
    </div>
  );
}
