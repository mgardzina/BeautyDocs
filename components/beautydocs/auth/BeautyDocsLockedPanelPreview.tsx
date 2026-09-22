import {
  Bell,
  CalendarDays,
  ClipboardList,
  HeartPulse,
  Home,
  Inbox,
  LayoutDashboard,
  Mail,
  MessageCircle,
  PackageSearch,
  PenLine,
  Search,
  Settings,
  Sparkles,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { BeautyDocsWordmark } from "../BeautyDocsWordmark";

interface PreviewNavItem {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly active?: boolean;
}

interface PreviewStat {
  readonly label: string;
  readonly sub: string;
  readonly icon: LucideIcon;
  readonly highlight?: boolean;
}

const OWNER_NAV: PreviewNavItem[] = [
  { icon: LayoutDashboard, label: "Przegląd", active: true },
  { icon: UsersRound, label: "Klientki" },
  { icon: CalendarDays, label: "Kalendarz" },
  { icon: Inbox, label: "Skrzynka" },
  { icon: MessageCircle, label: "Czat" },
  { icon: ClipboardList, label: "Formularze" },
  { icon: PackageSearch, label: "Produkty i urządzenia" },
  { icon: Settings, label: "Ustawienia" },
];

const OWNER_STATS: PreviewStat[] = [
  { icon: ClipboardList, label: "Podpisane formularze", sub: "kompletne dokumenty", highlight: true },
  { icon: UsersRound, label: "Klientki", sub: "kartoteki w salonie" },
  { icon: PackageSearch, label: "Aktywne formularze", sub: "dostępne dla klientek" },
];

const CLIENT_NAV: PreviewNavItem[] = [
  { icon: Home, label: "Start", active: true },
  { icon: Search, label: "Znajdź salon" },
  { icon: CalendarDays, label: "Moje wizyty" },
  { icon: UserRound, label: "Dane osobowe" },
  { icon: HeartPulse, label: "Wywiad medyczny" },
  { icon: PackageSearch, label: "Katalog" },
  { icon: PenLine, label: "Mój podpis" },
  { icon: Inbox, label: "Skrzynka" },
];

const CLIENT_STATS: PreviewStat[] = [
  { icon: ClipboardList, label: "Podpisane formularze", sub: "kompletne dokumenty", highlight: true },
  { icon: CalendarDays, label: "Oczekujące", sub: "czekają na podpis salonu" },
  { icon: PackageSearch, label: "Wszystkie formularze", sub: "wszystkie w historii" },
];

/**
 * A static, inert mock of the real panel chrome — sidebar, header, hero and
 * a few stat cards — used purely as a "you're almost in" backdrop behind the
 * e-mail verification card. It renders no live data and has no interaction;
 * it exists only to make the verification step feel like an arrival rather
 * than a detour to a separate marketing page.
 */
export function BeautyDocsLockedPanelPreview({
  variant,
}: {
  readonly variant: "owner" | "client";
}) {
  const nav = variant === "owner" ? OWNER_NAV : CLIENT_NAV;
  const stats = variant === "owner" ? OWNER_STATS : CLIENT_STATS;
  const eyebrow = variant === "owner" ? "Panel salonu" : "Strefa klientki";
  const heroTitle = variant === "owner" ? "Dzień dobry!" : "Dzień dobry!";
  const heroBody =
    variant === "owner"
      ? "Najważniejsze informacje o Twoim salonie w jednym miejscu."
      : "Twoje wizyty, dokumenty i kontakt z salonem w jednym miejscu.";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none flex min-h-screen w-full select-none bg-[#f7f8f4] text-[#173d35]"
    >
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-[#e3e8dd] bg-[#fbfcf8] px-4 py-6 lg:flex">
        <div className="px-2">
          <BeautyDocsWordmark className="text-lg text-[#173d35]" />
          <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-[#8a9a85]">
            {eyebrow}
          </p>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map(({ icon: Icon, label, active }) => (
            <div
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold ${
                active
                  ? "bg-[#245c4d] text-white"
                  : "text-[#4d5c49]"
              }`}
              key={label}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between gap-4 border-b border-[#e3e8dd] bg-white/80 px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#8a9a85]">
              {eyebrow}
            </p>
            <p className="mt-1 h-4 w-32 rounded-full bg-[#e3e8dd]" />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full border border-[#e3e8dd] bg-white text-[#4d5c49]">
              <Bell className="size-4" />
            </span>
            <span className="size-9 rounded-full bg-[#d7e3cd]" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-5 py-7 sm:px-8">
          <div className="rounded-[28px] bg-gradient-to-br from-[#173d35] to-[#245c4d] p-6 text-white sm:p-8">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#bcd7c7]">
              <Sparkles className="size-3.5" /> {heroTitle}
            </p>
            <p className="mt-3 max-w-md text-sm leading-6 text-[#dcebe3]">{heroBody}</p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {stats.map(({ icon: Icon, label, sub, highlight }) => (
              <div
                className={`rounded-2xl border p-5 ${
                  highlight
                    ? "border-transparent bg-[#245c4d] text-white"
                    : "border-[#e3e8dd] bg-white"
                }`}
                key={label}
              >
                <div
                  className={`flex size-9 items-center justify-center rounded-xl ${
                    highlight ? "bg-white/15" : "bg-[#eef3e7] text-[#245c4d]"
                  }`}
                >
                  <Icon className="size-4" />
                </div>
                <p className="mt-4 text-2xl font-black">0</p>
                <p
                  className={`mt-1 text-xs font-bold ${highlight ? "text-white/70" : "text-[#8a9a85]"}`}
                >
                  {sub}
                </p>
                <p className={`text-sm font-black ${highlight ? "text-white" : "text-[#173d35]"}`}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

/** Small mail glyph used at the top of the verification card. */
export function BeautyDocsVerifyMailArt() {
  return (
    <div className="bd-auth-mail-art" aria-hidden="true">
      <Mail size={54} strokeWidth={1.2} />
      <span>✳</span>
    </div>
  );
}
