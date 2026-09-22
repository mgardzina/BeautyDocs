"use client";

import { BeautyDocsDialog } from "../BeautyDocsDialog";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Phone,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import type {
  BeautyDocsAdminClientList,
  BeautyDocsAdminFormList,
  BeautyDocsAdminVisit,
  BeautyDocsAdminVisitList,
  BeautyDocsBookingSchedule,
} from "../../../types/beautydocs-admin";
import { BeautyDocsPhoneNumberField } from "../BeautyDocsPhoneNumberField";

const HOUR_HEIGHT = 70;
const CALENDAR_TOP_GUTTER = 16;
type CalendarView = "day" | "week" | "month" | "year";
interface CalendarHours {
  readonly startHour: number;
  readonly endHour: number;
}

const DEFAULT_BOOKING_SCHEDULE: BeautyDocsBookingSchedule = {
  slotIntervalMinutes: 30,
  days: Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    enabled: weekday < 5,
    opensAt: "09:00",
    closesAt: "17:00",
  })),
};

const CALENDAR_VIEW_OPTIONS: readonly {
  readonly value: CalendarView;
  readonly label: string;
}[] = [
  { value: "day", label: "Dzień" },
  { value: "week", label: "Tydzień" },
  { value: "month", label: "Miesiąc" },
  { value: "year", label: "Rok" },
];

export function BeautyDocsVisitsCalendar({
  tenantSlug,
}: {
  readonly tenantSlug: string;
}) {
  const [today, setToday] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [calendarView, setCalendarView] = useState<CalendarView>("week");
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultTime, setCreateDefaultTime] = useState("10:00");
  const [movingVisitId, setMovingVisitId] = useState<string | null>(null);
  const [visits, setVisits] = useState<readonly BeautyDocsAdminVisit[]>([]);
  const [bookingSchedule, setBookingSchedule] =
    useState<BeautyDocsBookingSchedule>(DEFAULT_BOOKING_SCHEDULE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  const calendarPanRef = useRef<{
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  } | null>(null);
  const suppressCalendarClickRef = useRef(false);
  const [calendarPanning, setCalendarPanning] = useState(false);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekAnchor, index)),
    [weekAnchor],
  );
  const miniMonthDays = useMemo(
    () => monthCalendarDays(selectedDate),
    [selectedDate],
  );
  const visibleRange = useMemo(
    () => calendarVisibleRange(calendarView, selectedDate, weekAnchor),
    [calendarView, selectedDate, weekAnchor],
  );
  const calendarHours = useMemo(
    () => scheduleCalendarHours(bookingSchedule, visits),
    [bookingSchedule, visits],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const dateFrom = dateKey(visibleRange.first);
    const dateTo = dateKey(visibleRange.last);
    try {
      const response = await fetch(
        `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}` +
          `/visits?from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}`,
        { cache: "no-store", credentials: "same-origin" },
      );
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as BeautyDocsAdminVisitList;
      setVisits(Array.isArray(body.items) ? body.items : []);
      setBookingSchedule(body.bookingSchedule ?? DEFAULT_BOOKING_SCHEDULE);
    } catch {
      setError("Nie udało się pobrać kalendarza wizyt.");
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [tenantSlug, visibleRange]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refreshCurrentTime = window.setInterval(() => {
      setToday(new Date());
    }, 30_000);
    return () => window.clearInterval(refreshCurrentTime);
  }, []);

  useEffect(() => {
    if (!calendarExpanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCalendarExpanded(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [calendarExpanded]);

  const visitsByDay = useMemo(() => {
    const result = new Map<string, BeautyDocsAdminVisit[]>();
    for (const visit of visits) {
      const key = visitDateKey(visit.startsAt);
      result.set(key, [...(result.get(key) ?? []), visit]);
    }
    return result;
  }, [visits]);
  const selectedVisit =
    visits.find((visit) => visit.id === selectedVisitId) ?? visits[0] ?? null;
  const planned = visits.filter((visit) => visit.status === "PLANNED").length;
  const withForms = visits.filter((visit) => visit.formSubmitted).length;

  function selectCalendarDate(date: Date) {
    setSelectedDate(date);
    setWeekAnchor(startOfWeek(date));
  }

  function moveSelectedDay(amount: number) {
    const next = addDays(selectedDate, amount);
    setSelectedDate(next);
    setWeekAnchor(startOfWeek(next));
    setSelectedVisitId(null);
  }

  function moveWeek(amount: number) {
    const next = addDays(selectedDate, amount * 7);
    setSelectedDate(next);
    setWeekAnchor(startOfWeek(next));
    setSelectedVisitId(null);
  }

  function goToToday() {
    const current = new Date(today);
    setSelectedDate(current);
    setWeekAnchor(startOfWeek(current));
    setSelectedVisitId(null);
  }

  function changeCalendarView(view: CalendarView) {
    setCalendarView(view);
    setWeekAnchor(startOfWeek(selectedDate));
    setSelectedVisitId(null);
  }

  function zoomToMonth(date: Date) {
    setSelectedDate(date);
    setWeekAnchor(startOfWeek(date));
    setCalendarView("month");
    setSelectedVisitId(null);
  }

  function handleVisitCreated(visit: BeautyDocsAdminVisit) {
    const visitDate = calendarDateFromVisit(visit.startsAt);
    setSelectedDate(visitDate);
    setWeekAnchor(startOfWeek(visitDate));
    setSelectedVisitId(visit.id);
    setVisits((current) => [
      ...current.filter((item) => item.id !== visit.id),
      visit,
    ]);
    setCreateOpen(false);
  }

  function openCreateDialog(date: Date, time = "10:00") {
    setSelectedDate(date);
    setCreateDefaultTime(time);
    setCreateOpen(true);
  }

  async function handleVisitDrop(
    visitId: string,
    day: Date,
    minutesFromStart: number,
  ) {
    const visit = visits.find((item) => item.id === visitId);
    if (visit?.status !== "PLANNED" || movingVisitId !== null) return;
    const start = new Date(day);
    start.setHours(
      calendarHours.startHour + Math.floor(minutesFromStart / 60),
      minutesFromStart % 60,
      0,
      0,
    );
    if (
      !bookingStartAllowed(
        bookingSchedule,
        start,
        visitDurationMinutes(visit),
      )
    ) {
      setError("Ten termin wypada poza godzinami przyjęć salonu.");
      return;
    }
    if (start <= new Date()) {
      setError("Nie można przenieść wizyty na termin, który już minął.");
      return;
    }
    setMovingVisitId(visitId);
    setError(null);
    try {
      const response = await fetch(
        `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}/visits`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitId, startsAt: start.toISOString() }),
        },
      );
      if (!response.ok) {
        setError(
          response.status === 409
            ? "Nie można przenieść wizyty — ten termin jest zajęty albo już minął."
            : "Nie udało się przenieść wizyty.",
        );
        return;
      }
      const updated = (await response.json()) as BeautyDocsAdminVisit;
      setVisits((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSelectedDate(calendarDateFromVisit(updated.startsAt));
      setSelectedVisitId(updated.id);
    } catch {
      setError("Nie udało się przenieść wizyty.");
    } finally {
      setMovingVisitId(null);
    }
  }

  function startCalendarPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, select, [data-calendar-event="true"]')) return;
    const viewport = calendarScrollRef.current;
    if (viewport === null || viewport.scrollWidth <= viewport.clientWidth) return;
    calendarPanRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: viewport.scrollLeft,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setCalendarPanning(true);
  }

  function moveCalendarPan(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = calendarPanRef.current;
    const viewport = calendarScrollRef.current;
    if (pan === null || viewport === null || pan.pointerId !== event.pointerId) return;
    const distance = event.clientX - pan.startX;
    if (Math.abs(distance) > 4) pan.moved = true;
    if (pan.moved) viewport.scrollLeft = pan.startScrollLeft - distance;
  }

  function endCalendarPan(event: ReactPointerEvent<HTMLDivElement>) {
    const pan = calendarPanRef.current;
    if (pan === null || pan.pointerId !== event.pointerId) return;
    suppressCalendarClickRef.current = pan.moved;
    calendarPanRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setCalendarPanning(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#245c4d]">
            Kalendarz salonu
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Kalendarz</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            Rezerwacje klientek połączone z właściwymi formularzami zabiegowymi.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <CalendarStat
          icon={<CalendarDays className="size-5" />}
          label="W tym okresie"
          value={visits.length}
        />
        <CalendarStat
          icon={<Clock3 className="size-5" />}
          label="Zaplanowane"
          value={planned}
        />
        <CalendarStat
          icon={<ClipboardCheck className="size-5" />}
          label="Z formularzem"
          value={withForms}
        />
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      ) : null}

      {calendarExpanded ? (
        <button
          aria-label="Zamknij rozszerzony kalendarz"
          className="fixed inset-0 z-[60] cursor-default bg-[#173d35]/45 backdrop-blur-sm"
          onClick={() => setCalendarExpanded(false)}
          type="button"
        />
      ) : null}

      <section
        className={`overflow-hidden border border-[#e0e5da] bg-white shadow-[0_18px_60px_rgba(51,76,70,0.12)] ${
          calendarExpanded
            ? "fixed inset-2 z-[70] flex flex-col rounded-[28px] sm:inset-4"
            : "rounded-[28px]"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#eaeee5] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="min-w-16 overflow-hidden rounded-2xl border border-[#e5eadd] bg-white text-center shadow-sm">
              <span className="block bg-[#547b59] px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                {monthShort(selectedDate)}
              </span>
              <span className="block py-1.5 text-2xl font-black leading-7 text-[#173d35]">
                {selectedDate.getDate()}
              </span>
            </span>
            <div>
              <p className="text-base font-black text-[#173d35]">
                {formatFullDate(selectedDate)}
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                {formatCalendarRange(calendarView, visibleRange.first, visibleRange.last)}
                {calendarView === "week" ? " · przeciągnij siatkę w bok" : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-[#173d35] px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[#245c4d]"
              onClick={() => openCreateDialog(selectedDate)}
              type="button"
            >
              <Plus className="size-4" />
              Dodaj wizytę
            </button>
            <label className="relative inline-flex items-center gap-2 rounded-xl border border-[#dde2d5] bg-white px-3 py-2 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-[0.08em] text-stone-400">
                Widok
              </span>
              <select
                aria-label="Widok kalendarza"
                className="cursor-pointer appearance-none bg-transparent py-0.5 pr-5 text-xs font-black text-[#173d35] outline-none"
                onChange={(event) =>
                  changeCalendarView(event.target.value as CalendarView)
                }
                value={calendarView}
              >
                {CALENDAR_VIEW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronRight className="pointer-events-none absolute right-2.5 size-3.5 rotate-90 text-stone-400" />
            </label>
            <div className="flex items-center rounded-2xl border border-[#dde2d5] bg-white p-1 shadow-sm">
            <button
              aria-label="Poprzedni dzień"
              className="grid size-10 place-items-center rounded-xl text-stone-500 transition hover:bg-[#f0f5ea] hover:text-[#245c4d]"
              onClick={() => moveSelectedDay(-1)}
              type="button"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              className="rounded-xl px-4 py-2 text-xs font-black text-[#173d35] transition hover:bg-[#f0f5ea]"
              onClick={goToToday}
              type="button"
            >
              Dzisiaj
            </button>
            <button
              aria-label="Następny dzień"
              className="grid size-10 place-items-center rounded-xl text-stone-500 transition hover:bg-[#f0f5ea] hover:text-[#245c4d]"
              onClick={() => moveSelectedDay(1)}
              type="button"
            >
              <ChevronRight className="size-5" />
            </button>
            </div>
            <button
              aria-pressed={calendarExpanded}
              className="inline-flex items-center gap-2 rounded-xl border border-[#dde2d5] bg-white px-3.5 py-2.5 text-xs font-black text-[#173d35] shadow-sm transition hover:bg-[#f0f5ea] hover:text-[#245c4d]"
              onClick={() => setCalendarExpanded((current) => !current)}
              type="button"
            >
              {calendarExpanded ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
              {calendarExpanded ? "Zwiń" : "Rozszerz"}
            </button>
          </div>
        </div>

        <div
          className={`grid ${
            calendarExpanded
              ? "min-h-0 flex-1 overflow-hidden md:grid-cols-[230px_minmax(0,1fr)]"
              : "xl:grid-cols-[248px_minmax(0,1fr)]"
          }`}
        >
          <aside
            className={`border-b border-[#eaeee5] bg-[#fcfdfb] p-5 ${
              calendarExpanded
                ? "overflow-y-auto md:border-b-0 md:border-r"
                : "xl:border-b-0 xl:border-r"
            }`}
          >
            <MiniMonthCalendar
              days={miniMonthDays}
              onSelect={selectCalendarDate}
              selectedDate={selectedDate}
              today={today}
              visitsByDay={visitsByDay}
            />
            <div className="mt-6 border-t border-[#eaeee5] pt-5">
              <SelectedVisitDetails
                tenantSlug={tenantSlug}
                visit={selectedVisit}
              />
            </div>
          </aside>

          <div className={`min-w-0 ${calendarExpanded ? "overflow-y-auto" : ""}`}>
            {calendarView === "week" ? (
              <>
            <div
              aria-label="Tygodniowy kalendarz. Przeciągnij w bok, aby zobaczyć kolejne dni."
              className={`hidden touch-pan-x overflow-x-auto overscroll-x-contain lg:block ${
                calendarPanning ? "cursor-grabbing select-none" : "cursor-grab"
              }`}
              onClickCapture={(event) => {
                if (!suppressCalendarClickRef.current) return;
                event.preventDefault();
                event.stopPropagation();
                suppressCalendarClickRef.current = false;
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  event.currentTarget.scrollBy({
                    left: event.key === "ArrowLeft" ? -240 : 240,
                    behavior: "smooth",
                  });
                }
              }}
              onPointerCancel={endCalendarPan}
              onPointerDown={startCalendarPan}
              onPointerMove={moveCalendarPan}
              onPointerUp={endCalendarPan}
              ref={calendarScrollRef}
              role="region"
              tabIndex={0}
            >
              <div className="min-w-[940px]">
                <div className="grid grid-cols-[64px_repeat(7,minmax(116px,1fr))_64px] border-b border-[#e5e9df] bg-white">
                  <button
                    aria-label="Poprzedni tydzień"
                    className="sticky left-0 z-30 grid min-h-[70px] place-items-center border-r border-[#e5e9df] bg-[#fcfdfb] text-[#6ba697] transition hover:bg-[#f0f5e9] hover:text-[#43776a]"
                    onClick={() => moveWeek(-1)}
                    title="Poprzedni tydzień"
                    type="button"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  {days.map((day) => {
                    const isToday = dateKey(day) === dateKey(today);
                    const isSelected = dateKey(day) === dateKey(selectedDate);
                    return (
                      <button
                        className={`border-l border-[#edf0e8] px-2 py-3.5 text-center transition hover:bg-[#f8fbf5] ${
                          isSelected ? "bg-[#f8fbf3]" : ""
                        }`}
                        key={dateKey(day)}
                        onClick={() => setSelectedDate(day)}
                        type="button"
                      >
                        <span className="block text-[10px] font-black uppercase tracking-[0.08em] text-stone-500">
                          {weekdayLong(day)}
                        </span>
                        <span
                          className={`mx-auto mt-1.5 inline-flex rounded-full px-2 py-1 text-[10px] font-black tabular-nums ${
                            isToday
                              ? "bg-[#245c4d] text-white"
                              : "text-stone-400"
                          }`}
                        >
                          {formatWeekHeaderDate(day)}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    aria-label="Następny tydzień"
                    className="grid min-h-[70px] place-items-center border-l border-[#e5e9df] bg-[#fcfdfb] text-[#6ba697] transition hover:bg-[#f0f5e9] hover:text-[#43776a]"
                    onClick={() => moveWeek(1)}
                    title="Następny tydzień"
                    type="button"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>

                <div className="relative grid grid-cols-[64px_repeat(7,minmax(116px,1fr))_64px] pt-4">
                  <TimeLabels hours={calendarHours} />
                  {days.map((day) => (
                    <CalendarDayColumn
                      bookingSchedule={bookingSchedule}
                      calendarHours={calendarHours}
                      day={day}
                      isSelected={dateKey(day) === dateKey(selectedDate)}
                      key={dateKey(day)}
                      movingVisitId={movingVisitId}
                      onCreateAt={openCreateDialog}
                      onDropVisit={handleVisitDrop}
                      onSelectVisit={setSelectedVisitId}
                      selectedVisitId={selectedVisit?.id ?? null}
                      today={today}
                      visits={visitsByDay.get(dateKey(day)) ?? []}
                    />
                  ))}
                  <div
                    aria-hidden="true"
                    className="border-l border-[#eaeee5] bg-[#fcfdfb]"
                    style={{ height: calendarHeight(calendarHours) }}
                  />
                  {days.some((day) => dateKey(day) === dateKey(today)) ? (
                    <CurrentTimeIndicator hours={calendarHours} now={today} />
                  ) : null}
                  {loading ? (
                    <div className="absolute inset-y-0 left-[64px] right-[64px] z-20 grid place-items-center bg-white/70 backdrop-blur-[1px]">
                      <span className="inline-flex items-center gap-2 rounded-full border border-[#e5eadd] bg-white px-4 py-2 text-xs font-bold text-stone-600 shadow-sm">
                        <LoaderCircle className="size-4 animate-spin text-[#245c4d]" />
                        Aktualizujemy kalendarz
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <MobileWeekList
              days={days}
              loading={loading}
              onSelectVisit={setSelectedVisitId}
              selectedVisitId={selectedVisit?.id ?? null}
              today={today}
              visitsByDay={visitsByDay}
            />
              </>
            ) : calendarView === "day" ? (
              <DayCalendarView
                bookingSchedule={bookingSchedule}
                calendarHours={calendarHours}
                day={selectedDate}
                loading={loading}
                movingVisitId={movingVisitId}
                onCreateAt={openCreateDialog}
                onDropVisit={handleVisitDrop}
                onSelectVisit={setSelectedVisitId}
                selectedVisitId={selectedVisit?.id ?? null}
                today={today}
                visits={visitsByDay.get(dateKey(selectedDate)) ?? []}
              />
            ) : calendarView === "month" ? (
              <MonthCalendarView
                bookingSchedule={bookingSchedule}
                loading={loading}
                month={selectedDate}
                onCreateAt={openCreateDialog}
                onSelectDate={setSelectedDate}
                onSelectVisit={setSelectedVisitId}
                selectedDate={selectedDate}
                selectedVisitId={selectedVisit?.id ?? null}
                today={today}
                visitsByDay={visitsByDay}
              />
            ) : (
              <YearCalendarView
                loading={loading}
                onSelectDate={zoomToMonth}
                today={today}
                visitsByDay={visitsByDay}
                year={selectedDate.getFullYear()}
              />
            )}
          </div>
        </div>
      </section>

      {createOpen ? (
        <CreateVisitDialog
          bookingSchedule={bookingSchedule}
          defaultDate={selectedDate}
          defaultTime={createDefaultTime}
          onClose={() => setCreateOpen(false)}
          onCreated={handleVisitCreated}
          tenantSlug={tenantSlug}
        />
      ) : null}
    </div>
  );
}

function CreateVisitDialog({
  bookingSchedule,
  defaultDate,
  defaultTime,
  onClose,
  onCreated,
  tenantSlug,
}: {
  readonly bookingSchedule: BeautyDocsBookingSchedule;
  readonly defaultDate: Date;
  readonly defaultTime: string;
  readonly onClose: () => void;
  readonly onCreated: (visit: BeautyDocsAdminVisit) => void;
  readonly tenantSlug: string;
}) {
  const [clientSearch, setClientSearch] = useState("");
  const [today] = useState(() => new Date());
  const [clients, setClients] = useState<BeautyDocsAdminClientList["items"]>([]);
  const [forms, setForms] = useState<BeautyDocsAdminFormList["forms"]>([]);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [clientId, setClientId] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [formCode, setFormCode] = useState("");
  const [visitDate, setVisitDate] = useState(() =>
    initialManualVisitDate(defaultDate, defaultTime, bookingSchedule),
  );
  const [visitTime, setVisitTime] = useState(defaultTime);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedForm = forms.find((form) => form.code === formCode) ?? null;
  const durationMinutes = selectedForm?.durationMinutes ?? 60;
  const availableTimes = useMemo(
    () => manualVisitTimes(bookingSchedule, visitDate, durationMinutes),
    [bookingSchedule, durationMinutes, visitDate],
  );

  useEffect(() => {
    if (!availableTimes.includes(visitTime)) {
      setVisitTime(availableTimes[0] ?? "");
    }
  }, [availableTimes, visitTime]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoadingOptions(true);
      try {
        const rawSearch = clientSearch.trim();
        const search = rawSearch.length >= 2 ? rawSearch : "";
        const clientsUrl =
          `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}/clients` +
          `?search=${encodeURIComponent(search)}&page=1&pageSize=100`;
        const [clientsResponse, formsResponse] = await Promise.all([
          fetch(clientsUrl, {
            cache: "no-store",
            credentials: "same-origin",
            signal: controller.signal,
          }),
          fetch(
            `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}/forms`,
            {
              cache: "no-store",
              credentials: "same-origin",
              signal: controller.signal,
            },
          ),
        ]);
        if (!clientsResponse.ok || !formsResponse.ok) throw new Error("load failed");
        const clientsBody = (await clientsResponse.json()) as BeautyDocsAdminClientList;
        const formsBody = (await formsResponse.json()) as BeautyDocsAdminFormList;
        const nextClients = Array.isArray(clientsBody.items) ? clientsBody.items : [];
        const nextForms = Array.isArray(formsBody.forms)
          ? formsBody.forms.filter((form) => form.enabled && form.version !== null)
          : [];
        setClients(nextClients);
        setForms(nextForms);
        setClientId((current) =>
          nextClients.some((client) => client.id === current)
            ? current
            : (nextClients[0]?.id ?? ""),
        );
        setFormCode((current) =>
          nextForms.some((form) => form.code === current)
            ? current
            : (nextForms[0]?.code ?? ""),
        );
        setError(null);
      } catch (loadError) {
        if ((loadError as Error).name !== "AbortError") {
          setError("Nie udało się pobrać klientek i formularzy.");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingOptions(false);
      }
    }, clientSearch ? 250 : 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [clientSearch, tenantSlug]);

  async function submitVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const hasClient =
      clientMode === "existing"
        ? Boolean(clientId)
        : newClientName.trim().length >= 2;
    if (!hasClient || !formCode || !visitDate || !visitTime) return;
    if (
      clientMode === "new" &&
      newClientPhone.trim() &&
      newClientPhone.replace(/\D/g, "").length < 8
    ) {
      setError("Wpisz pełny numer telefonu albo pozostaw to pole puste.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const localStart = new Date(`${visitDate}T${visitTime}:00`);
      if (!Number.isFinite(localStart.getTime())) throw new Error("invalid date");
      if (localStart <= new Date()) {
        setError("Wybierz datę i godzinę, które jeszcze nie minęły.");
        return;
      }
      const response = await fetch(
        `/api/beautydocs-preview/admin/tenants/${encodeURIComponent(tenantSlug)}/visits`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: clientMode === "existing" ? clientId : null,
            newClient:
              clientMode === "new"
                ? {
                    fullName: newClientName.trim(),
                    phone: newClientPhone.trim() || null,
                    email: newClientEmail.trim() || null,
                  }
                : null,
            formCode,
            startsAt: localStart.toISOString(),
          }),
        },
      );
      if (!response.ok) {
        setError(
          response.status === 409
            ? "Ta godzina jest już zajęta. Wybierz inny termin."
            : response.status === 422
              ? "Cały zabieg musi mieścić się w godzinach przyjęć salonu."
              : "Nie udało się dodać wizyty. Spróbuj ponownie.",
        );
        return;
      }
      onCreated((await response.json()) as BeautyDocsAdminVisit);
    } catch {
      setError("Nie udało się dodać wizyty.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BeautyDocsDialog open onClose={onClose} title="Dodaj wizytę" className="max-w-xl">
      <div className="my-auto w-full max-w-xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#eaeee5] px-6 py-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#547b59]">
              Kalendarz salonu
            </p>
            <h2 className="mt-1 text-2xl font-black text-[#173d35]">Dodaj wizytę</h2>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              Wybierz istniejącą klientkę albo dodaj nową bez zakładania jej konta.
              {selectedForm
                ? ` Ten zabieg potrwa ${formatVisitDuration(durationMinutes)}.`
                : " Czas wizyty zostanie pobrany z wybranego formularza."}
            </p>
          </div>
          <button
            aria-label="Zamknij"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-500 transition hover:bg-[#eef3e7] hover:text-[#245c4d]"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <form className="space-y-4 p-6" onSubmit={submitVisit}>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#f0f3ed] p-1">
            <button
              className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${
                clientMode === "existing"
                  ? "bg-white text-[#406f63] shadow-sm"
                  : "text-stone-500 hover:text-[#406f63]"
              }`}
              onClick={() => setClientMode("existing")}
              type="button"
            >
              Z listy klientek
            </button>
            <button
              className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${
                clientMode === "new"
                  ? "bg-white text-[#406f63] shadow-sm"
                  : "text-stone-500 hover:text-[#406f63]"
              }`}
              onClick={() => setClientMode("new")}
              type="button"
            >
              Nowa klientka
            </button>
          </div>

          {clientMode === "existing" ? (
            <>
              <label className="block">
                <span className="text-xs font-black text-[#173d35]">Znajdź klientkę</span>
                <input
                  className="mt-2 w-full rounded-xl border border-[#d9ded2] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#547b59] focus:ring-2 focus:ring-[#e6eedc]"
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder="Imię, nazwisko, telefon lub e-mail"
                  type="search"
                  value={clientSearch}
                />
              </label>

              <label className="block">
                <span className="text-xs font-black text-[#173d35]">Klientka</span>
                <select
                  className="mt-2 w-full rounded-xl border border-[#d9ded2] bg-white px-4 py-3 text-sm outline-none focus:border-[#547b59] focus:ring-2 focus:ring-[#e6eedc]"
                  disabled={loadingOptions || clients.length === 0}
                  onChange={(event) => setClientId(event.target.value)}
                  required
                  value={clientId}
                >
                  {clients.length === 0 ? <option value="">Brak klientek</option> : null}
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.firstName} {client.lastName}
                      {client.phone ? ` · ${client.phone}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {clients.length === 0 && !loadingOptions ? (
                <button
                  className="w-full rounded-xl border border-dashed border-[#d1d9c5] bg-[#f8fbf5] px-4 py-3 text-xs font-black text-[#508376]"
                  onClick={() => setClientMode("new")}
                  type="button"
                >
                  Brak klientek — dodaj nową bez konta
                </button>
              ) : null}
            </>
          ) : (
            <div className="space-y-4 rounded-2xl border border-[#e5eadd] bg-[#fcfdfa] p-4">
              <label className="block">
                <span className="text-xs font-black text-[#173d35]">Imię i nazwisko *</span>
                <input
                  autoFocus
                  className="mt-2 w-full rounded-xl border border-[#d9ded2] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#547b59] focus:ring-2 focus:ring-[#e6eedc]"
                  maxLength={281}
                  onChange={(event) => setNewClientName(event.target.value)}
                  placeholder="np. Anna Kowalska"
                  required
                  value={newClientName}
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black text-[#173d35]">Telefon</span>
                  <div className="mt-2">
                    <BeautyDocsPhoneNumberField
                      id="manual-visit-client-phone"
                      onChange={setNewClientPhone}
                      value={newClientPhone}
                    />
                  </div>
                  <span className="mt-1.5 block text-[10px] text-stone-400">
                    Opcjonalnie
                  </span>
                </label>
                <label className="block">
                  <span className="text-xs font-black text-[#173d35]">E-mail</span>
                  <input
                    className="mt-2 w-full rounded-xl border border-[#d9ded2] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#547b59] focus:ring-2 focus:ring-[#e6eedc]"
                    maxLength={320}
                    onChange={(event) => setNewClientEmail(event.target.value)}
                    placeholder="opcjonalnie"
                    type="email"
                    value={newClientEmail}
                  />
                </label>
              </div>
              <p className="text-[11px] leading-5 text-stone-500">
                Zapiszemy ją w kartotece salonu. Nie musi mieć konta w aplikacji.
              </p>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-black text-[#173d35]">Rodzaj formularza</span>
            <select
              className="mt-2 w-full rounded-xl border border-[#d9ded2] bg-white px-4 py-3 text-sm outline-none focus:border-[#547b59] focus:ring-2 focus:ring-[#e6eedc]"
              disabled={loadingOptions || forms.length === 0}
              onChange={(event) => setFormCode(event.target.value)}
              required
              value={formCode}
            >
              {forms.length === 0 ? (
                <option value="">Brak aktywnych formularzy</option>
              ) : null}
              {forms.map((form) => (
                <option key={form.code} value={form.code}>
                  {form.name} · {formatVisitDuration(form.durationMinutes)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black text-[#173d35]">Data</span>
              <input
                className="mt-2 w-full rounded-xl border border-[#d9ded2] bg-white px-4 py-3 text-sm outline-none focus:border-[#547b59] focus:ring-2 focus:ring-[#e6eedc]"
                min={dateKey(today)}
                onChange={(event) => setVisitDate(event.target.value)}
                required
                type="date"
                value={visitDate}
              />
            </label>
            <label className="block">
              <span className="text-xs font-black text-[#173d35]">Godzina</span>
              <select
                className="mt-2 w-full rounded-xl border border-[#d9ded2] bg-white px-4 py-3 text-sm outline-none focus:border-[#547b59] focus:ring-2 focus:ring-[#e6eedc]"
                onChange={(event) => setVisitTime(event.target.value)}
                required
                value={visitTime}
              >
                {availableTimes.length === 0 ? (
                  <option value="">Salon nie przyjmuje w tym dniu</option>
                ) : null}
                {availableTimes.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </label>
          </div>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              className="rounded-xl px-5 py-3 text-sm font-black text-stone-600 transition hover:bg-stone-100"
              onClick={onClose}
              type="button"
            >
              Anuluj
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173d35] px-5 py-3 text-sm font-black text-white transition hover:bg-[#245c4d] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                saving ||
                loadingOptions ||
                !formCode ||
                !visitTime ||
                (clientMode === "existing"
                  ? !clientId
                  : newClientName.trim().length < 2)
              }
              type="submit"
            >
              {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Zapisz wizytę
            </button>
          </div>
        </form>
      </div>
    </BeautyDocsDialog>
  );
}

function MiniMonthCalendar({
  days,
  onSelect,
  selectedDate,
  today,
  visitsByDay,
}: {
  readonly days: readonly Date[];
  readonly onSelect: (date: Date) => void;
  readonly selectedDate: Date;
  readonly today: Date;
  readonly visitsByDay: ReadonlyMap<string, readonly BeautyDocsAdminVisit[]>;
}) {
  const month = selectedDate.getMonth();
  const monthLabel = new Intl.DateTimeFormat("pl-PL", {
    month: "long",
    year: "numeric",
  }).format(selectedDate);

  function changeMonth(amount: number) {
    onSelect(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + amount, 1, 12));
  }

  return (
    <div className="min-w-0 overflow-x-auto">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black capitalize text-[#173d35]">{monthLabel}</p>
        <div className="flex items-center">
          <button
            aria-label="Poprzedni miesiąc"
            className="grid size-11 place-items-center rounded-lg text-stone-600 hover:bg-[#eef3e7] hover:text-[#245c4d]"
            onClick={() => changeMonth(-1)}
            type="button"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            aria-label="Następny miesiąc"
            className="grid size-11 place-items-center rounded-lg text-stone-600 hover:bg-[#eef3e7] hover:text-[#245c4d]"
            onClick={() => changeMonth(1)}
            type="button"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="mt-4 grid min-w-[14rem] grid-cols-7 text-center [@media(pointer:coarse)]:min-w-[19.25rem] text-xs font-semibold uppercase tracking-[0.04em] text-stone-600">
        {['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mt-2 grid min-w-[14rem] grid-cols-7 gap-y-1 [@media(pointer:coarse)]:min-w-[19.25rem]">
        {days.map((day) => {
          const key = dateKey(day);
          const selected = key === dateKey(selectedDate);
          const current = key === dateKey(today);
          const outside = day.getMonth() !== month;
          const hasVisits = (visitsByDay.get(key)?.length ?? 0) > 0;
          return (
            <button
              aria-label={formatFullDate(day)}
              aria-pressed={selected}
              className={`bd-calendar-day relative mx-auto grid size-8 place-items-center rounded-full text-xs font-bold transition ${
                selected
                  ? "bg-[#173d35] text-white shadow-sm"
                  : current
                    ? "bg-[#e9f0df] text-[#467f71]"
                    : outside
                      ? "text-stone-300 hover:bg-stone-100"
                      : "text-stone-700 hover:bg-[#eef3e7]"
              }`}
              key={key}
              onClick={() => onSelect(day)}
              type="button"
            >
              {day.getDate()}
              {hasVisits ? (
                <span
                  className={`absolute bottom-0.5 size-1 rounded-full ${
                    selected ? "bg-white" : "bg-[#5ca492]"
                  }`}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SelectedVisitDetails({
  tenantSlug,
  visit,
}: {
  readonly tenantSlug: string;
  readonly visit: BeautyDocsAdminVisit | null;
}) {
  if (visit === null) {
    return (
      <div className="rounded-2xl border border-dashed border-[#e0e5da] bg-white px-4 py-6 text-center">
        <CalendarDays className="mx-auto size-5 text-stone-300" />
        <p className="mt-2 text-xs font-bold text-stone-500">Brak wizyt w tym tygodniu</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#547b59]">
            Wybrana wizyta
          </p>
          <p className="mt-2 text-sm font-black leading-5 text-[#173d35]">
            {visit.treatmentName}
          </p>
        </div>
        <span
          className={`mt-0.5 size-2.5 shrink-0 rounded-full ${
            visit.status === "CANCELLED" ? "bg-stone-300" : "bg-emerald-500"
          }`}
        />
      </div>
      <div className="mt-4 space-y-3 text-xs text-stone-600">
        <p className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-[#62a191]" />
          <span>
            <strong className="block font-black text-[#354637]">
              {formatVisitDate(visit.startsAt)}
            </strong>
            {formatVisitTimeRange(visit.startsAt, visit.endsAt)}
          </span>
        </p>
        <p className="flex items-center gap-2">
          <UserRound className="size-4 shrink-0 text-[#62a191]" />
          <span className="font-bold text-[#354637]">{visit.clientName}</span>
        </p>
        {visit.clientPhone ? (
          <p className="flex items-center gap-2">
            <Phone className="size-4 shrink-0 text-[#62a191]" />
            {visit.clientPhone}
          </p>
        ) : null}
      </div>
      <div
        className={`mt-4 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.06em] ${
          visit.formSubmitted
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        {visit.formSubmitted ? "Formularz wypełniony" : "Oczekuje na formularz"}
      </div>
      <Link
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#173d35] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#245c4d]"
        href={`/panel/${encodeURIComponent(tenantSlug)}/clients/${encodeURIComponent(visit.clientId)}`}
      >
        Otwórz kartę klientki
      </Link>
    </div>
  );
}

function TimeLabels({ hours }: { readonly hours: CalendarHours }) {
  const height = calendarHeight(hours);
  return (
    <div
      className="sticky left-0 z-30 border-r border-[#eaeee5] bg-[#fcfdfb] shadow-[4px_0_10px_rgba(49,70,52,0.04)]"
      style={{ height }}
    >
      {Array.from(
        { length: hours.endHour - hours.startHour + 1 },
        (_, index) => {
          const hour = hours.startHour + index;
          return (
            <span
              className="absolute right-3 -translate-y-1/2 text-[10px] font-bold text-stone-400"
              key={hour}
              style={{ top: index * HOUR_HEIGHT }}
            >
              {String(hour).padStart(2, "0")}:00
            </span>
          );
        },
      )}
    </div>
  );
}

function CurrentTimeIndicator({
  hours,
  now,
}: {
  readonly hours: CalendarHours;
  readonly now: Date;
}) {
  const minutesFromStart =
    (now.getHours() - hours.startHour) * 60 + now.getMinutes();
  const calendarMinutes = (hours.endHour - hours.startHour) * 60;
  if (minutesFromStart < 0 || minutesFromStart > calendarMinutes) return null;

  const top = (minutesFromStart / 60) * HOUR_HEIGHT;
  const label = new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  return (
    <div
      aria-label={`Aktualna godzina: ${label}`}
      className="pointer-events-none absolute inset-x-0 z-40 flex -translate-y-1/2 items-center"
      role="img"
      style={{ top: top + CALENDAR_TOP_GUTTER }}
    >
      <div className="sticky left-0 z-10 w-16 shrink-0 pr-1.5 text-right">
        <span className="inline-flex rounded-md bg-[#4fb69c] px-1.5 py-0.5 text-[9px] font-black tabular-nums text-white shadow-sm">
          {label}
        </span>
      </div>
      <span className="relative h-0.5 flex-1 bg-[#5bc6ab] shadow-[0_1px_4px_rgba(79,182,156,0.2)]">
        <span className="absolute -left-1 top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2 border-white bg-[#4fb69c] shadow-sm" />
      </span>
    </div>
  );
}

function CalendarDayColumn({
  bookingSchedule,
  calendarHours,
  day,
  isSelected,
  movingVisitId,
  onCreateAt,
  onDropVisit,
  onSelectVisit,
  selectedVisitId,
  today,
  visits,
}: {
  readonly bookingSchedule: BeautyDocsBookingSchedule;
  readonly calendarHours: CalendarHours;
  readonly day: Date;
  readonly isSelected: boolean;
  readonly movingVisitId: string | null;
  readonly onCreateAt: (date: Date, time: string) => void;
  readonly onDropVisit: (
    visitId: string,
    day: Date,
    minutesFromStart: number,
  ) => void;
  readonly onSelectVisit: (id: string) => void;
  readonly selectedVisitId: string | null;
  readonly today: Date;
  readonly visits: readonly BeautyDocsAdminVisit[];
}) {
  const [dragActive, setDragActive] = useState(false);
  const dayInPast = dateKey(day) < dateKey(today);
  const dayOpen = bookingDay(bookingSchedule, day)?.enabled === true;
  const height = calendarHeight(calendarHours);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    if (dayInPast || !dayOpen) return;
    const visitId = event.dataTransfer.getData("text/plain");
    if (!visitId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeY = Math.max(0, Math.min(bounds.height, event.clientY - bounds.top));
    const rawMinutes = (relativeY / bounds.height) * 60 *
      (calendarHours.endHour - calendarHours.startHour);
    const roundedMinutes =
      Math.round(rawMinutes / bookingSchedule.slotIntervalMinutes) *
      bookingSchedule.slotIntervalMinutes;
    const maxMinutes =
      (calendarHours.endHour - calendarHours.startHour) * 60 -
      bookingSchedule.slotIntervalMinutes;
    void onDropVisit(visitId, day, Math.min(roundedMinutes, maxMinutes));
  }

  return (
    <div
      className={`relative border-l border-[#ebeee7] transition-colors ${
        dragActive
          ? "bg-[#ecf3e3] ring-2 ring-inset ring-[#75b8a7]"
          : isSelected
            ? "bg-[#fbfdf8]"
            : "bg-white"
      }`}
      onDragEnter={(event) => {
        if (!dayInPast && dayOpen) {
          event.preventDefault();
          setDragActive(true);
        }
      }}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        setDragActive(false);
      }}
      onDragOver={(event) => {
        if (dayInPast || !dayOpen) {
          event.dataTransfer.dropEffect = "none";
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={handleDrop}
      style={{
        height,
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_HEIGHT - 1}px, #ebeee7 ${HOUR_HEIGHT - 1}px, #ebeee7 ${HOUR_HEIGHT}px)`,
      }}
    >
      {Array.from(
        { length: calendarHours.endHour - calendarHours.startHour },
        (_, index) => {
          const hour = calendarHours.startHour + index;
          const time = `${String(hour).padStart(2, "0")}:00`;
          const slotStart = new Date(day);
          slotStart.setHours(hour, 0, 0, 0);
          const past = slotStart <= today;
          const withinSchedule = bookingStartAllowed(bookingSchedule, slotStart);
          const disabled = past || !withinSchedule;
          return (
            <button
              aria-label={
                past
                  ? `Termin minął: ${formatFullDate(day)}, ${time}`
                  : !withinSchedule
                    ? `Poza godzinami przyjęć: ${formatFullDate(day)}, ${time}`
                    : `Dodaj wizytę: ${formatFullDate(day)}, ${time}`
              }
              className={`group absolute inset-x-0 z-0 flex items-start justify-end p-2 text-[#547b59] outline-none focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#547b59] ${
                disabled ? "cursor-not-allowed bg-stone-50/60" : ""
              }`}
              disabled={disabled}
              key={time}
              onClick={() => onCreateAt(day, time)}
              style={{ top: index * HOUR_HEIGHT, height: HOUR_HEIGHT }}
              type="button"
            >
              {!disabled ? (
                <span className="grid size-6 translate-y-1 place-items-center rounded-full border border-[#cdd9bd] bg-white opacity-0 shadow-sm transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                  <Plus className="size-3.5" />
                </span>
              ) : null}
            </button>
          );
        },
      )}
      {visits.map((visit) => {
        const position = visitPosition(visit, calendarHours);
        if (position === null) return null;
        return (
          <VisitTimeCard
            moving={movingVisitId === visit.id}
            key={visit.id}
            onDragEnd={() => setDragActive(false)}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", visit.id);
            }}
            onSelect={() => onSelectVisit(visit.id)}
            selected={selectedVisitId === visit.id}
            style={position}
            visit={visit}
          />
        );
      })}
    </div>
  );
}

function VisitTimeCard({
  moving,
  onDragEnd,
  onDragStart,
  onSelect,
  selected,
  style,
  visit,
}: {
  readonly moving: boolean;
  readonly onDragEnd: () => void;
  readonly onDragStart: (event: DragEvent<HTMLButtonElement>) => void;
  readonly onSelect: () => void;
  readonly selected: boolean;
  readonly style: CSSProperties;
  readonly visit: BeautyDocsAdminVisit;
}) {
  const cancelled = visit.status === "CANCELLED";
  const tone = cancelled
    ? "border-stone-300 bg-stone-100 text-stone-500"
    : visit.formSubmitted
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : "border-[#bacf9c] bg-[#f1f7e8] text-[#39655a]";
  return (
    <button
      data-calendar-event="true"
      className={`absolute left-1.5 right-1.5 z-10 overflow-hidden rounded-xl border-l-[3px] p-2 text-left shadow-[0_5px_14px_rgba(48,73,67,0.08)] transition hover:-translate-y-0.5 hover:shadow-md ${tone} ${
        selected ? "ring-2 ring-[#245c4d] ring-offset-1" : ""
      } ${visit.status === "PLANNED" ? "cursor-grab active:cursor-grabbing" : ""} ${
        moving ? "animate-pulse opacity-60" : ""
      }`}
      draggable={visit.status === "PLANNED" && !moving}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      onClick={onSelect}
      style={style}
      type="button"
    >
      <span className="block truncate text-[10px] font-black leading-3.5">
        {visit.treatmentName}
      </span>
      <span className="mt-1 block text-[9px] font-bold opacity-75">
        {formatVisitTimeRange(visit.startsAt, visit.endsAt)}
      </span>
      <span className="mt-1 block truncate text-[9px] opacity-80">
        {visit.clientName}
      </span>
      {visit.formSubmitted ? (
        <Check className="absolute right-1.5 top-1.5 size-3" />
      ) : null}
    </button>
  );
}

function DayCalendarView({
  bookingSchedule,
  calendarHours,
  day,
  loading,
  movingVisitId,
  onCreateAt,
  onDropVisit,
  onSelectVisit,
  selectedVisitId,
  today,
  visits,
}: {
  readonly bookingSchedule: BeautyDocsBookingSchedule;
  readonly calendarHours: CalendarHours;
  readonly day: Date;
  readonly loading: boolean;
  readonly movingVisitId: string | null;
  readonly onCreateAt: (date: Date, time: string) => void;
  readonly onDropVisit: (
    visitId: string,
    day: Date,
    minutesFromStart: number,
  ) => void;
  readonly onSelectVisit: (id: string) => void;
  readonly selectedVisitId: string | null;
  readonly today: Date;
  readonly visits: readonly BeautyDocsAdminVisit[];
}) {
  return (
    <div className="relative">
      <div className="grid grid-cols-[64px_minmax(0,1fr)] border-b border-[#eaeee5] bg-white">
        <div className="border-r border-[#eaeee5] bg-[#fcfdfb]" />
        <div className="px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.1em] text-stone-400">
            {weekdayShort(day)}
          </p>
          <p className="mt-1 text-sm font-black capitalize text-[#2a382c]">
            {formatFullDate(day)} · {visits.length} {visits.length === 1 ? "wizyta" : "wizyt"}
          </p>
        </div>
      </div>
      <div className="relative grid grid-cols-[64px_minmax(0,1fr)] pt-4">
        <TimeLabels hours={calendarHours} />
        <CalendarDayColumn
          bookingSchedule={bookingSchedule}
          calendarHours={calendarHours}
          day={day}
          isSelected
          movingVisitId={movingVisitId}
          onCreateAt={onCreateAt}
          onDropVisit={onDropVisit}
          onSelectVisit={onSelectVisit}
          selectedVisitId={selectedVisitId}
          today={today}
          visits={visits}
        />
        {dateKey(day) === dateKey(today) ? (
          <CurrentTimeIndicator hours={calendarHours} now={today} />
        ) : null}
      </div>
      {loading ? <CalendarLoadingOverlay /> : null}
    </div>
  );
}

function MonthCalendarView({
  bookingSchedule,
  loading,
  month,
  onCreateAt,
  onSelectDate,
  onSelectVisit,
  selectedDate,
  selectedVisitId,
  today,
  visitsByDay,
}: {
  readonly bookingSchedule: BeautyDocsBookingSchedule;
  readonly loading: boolean;
  readonly month: Date;
  readonly onCreateAt: (date: Date, time: string) => void;
  readonly onSelectDate: (date: Date) => void;
  readonly onSelectVisit: (id: string) => void;
  readonly selectedDate: Date;
  readonly selectedVisitId: string | null;
  readonly today: Date;
  readonly visitsByDay: ReadonlyMap<string, readonly BeautyDocsAdminVisit[]>;
}) {
  const days = monthCalendarDays(month);
  return (
    <div className="relative overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b border-[#eaeee5] bg-[#fcfdfb]">
          {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Niedz"].map((label) => (
            <span
              className="border-l border-[#eaeee5] px-2 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.08em] text-stone-400 first:border-l-0"
              key={label}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = dateKey(day);
            const dayVisits = visitsByDay.get(key) ?? [];
            const outside = day.getMonth() !== month.getMonth();
            const current = key === dateKey(today);
            const selected = key === dateKey(selectedDate);
            const past = key < dateKey(today);
            const dayOpen = bookingDay(bookingSchedule, day)?.enabled === true;
            return (
              <div
                className={`group relative min-h-28 border-b border-l border-[#ebeee7] p-2 first:border-l-0 ${
                  outside ? "bg-stone-50/70 text-stone-300" : "bg-white"
                } ${selected ? "ring-2 ring-inset ring-[#adc58b]" : ""}`}
                key={key}
              >
                <button
                  className={`grid size-7 place-items-center rounded-full text-[11px] font-black ${
                    current ? "bg-[#245c4d] text-white" : "text-[#173d35]"
                  }`}
                  onClick={() => onSelectDate(day)}
                  type="button"
                >
                  {day.getDate()}
                </button>
                {!past && !outside && dayOpen ? (
                  <button
                    aria-label={`Dodaj wizytę: ${formatFullDate(day)}`}
                    className="absolute right-2 top-2 grid size-6 place-items-center rounded-full border border-[#d4dec5] bg-white text-[#5a9586] opacity-0 shadow-sm transition group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => onCreateAt(day, "10:00")}
                    type="button"
                  >
                    <Plus className="size-3.5" />
                  </button>
                ) : null}
                <div className="mt-1.5 space-y-1">
                  {dayVisits.slice(0, 3).map((visit) => (
                    <button
                      className={`block w-full truncate rounded-md px-1.5 py-1 text-left text-[9px] font-bold ${
                        selectedVisitId === visit.id
                          ? "bg-[#245c4d] text-white"
                          : visit.formSubmitted
                            ? "bg-emerald-50 text-emerald-800"
                            : "bg-[#eff5e6] text-[#245c4d]"
                      }`}
                      key={visit.id}
                      onClick={() => onSelectVisit(visit.id)}
                      type="button"
                    >
                      {formatVisitTime(visit.startsAt)} {visit.clientName}
                    </button>
                  ))}
                  {dayVisits.length > 3 ? (
                    <p className="px-1 text-[9px] font-black text-stone-400">
                      +{dayVisits.length - 3} więcej
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {loading ? <CalendarLoadingOverlay /> : null}
    </div>
  );
}

function YearCalendarView({
  loading,
  onSelectDate,
  today,
  visitsByDay,
  year,
}: {
  readonly loading: boolean;
  readonly onSelectDate: (date: Date) => void;
  readonly today: Date;
  readonly visitsByDay: ReadonlyMap<string, readonly BeautyDocsAdminVisit[]>;
  readonly year: number;
}) {
  return (
    <div className="bd-calendar-months relative grid gap-4 bg-[#fafbf8] p-4 sm:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 12 }, (_, monthIndex) => {
        const month = new Date(year, monthIndex, 1, 12);
        const days = monthCalendarDays(month);
        const monthCount = days.reduce(
          (total, day) =>
            day.getMonth() === monthIndex
              ? total + (visitsByDay.get(dateKey(day))?.length ?? 0)
              : total,
          0,
        );
        return (
          <section
            className="min-w-0 overflow-x-auto rounded-2xl border border-[#e5eadf] bg-white p-4 shadow-sm"
            key={monthIndex}
          >
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => onSelectDate(month)}
              type="button"
            >
              <span className="text-sm font-black capitalize text-[#2a382c]">
                {new Intl.DateTimeFormat("pl-PL", { month: "long" }).format(month)}
              </span>
              <span className="rounded-full bg-[#eef3e7] px-2 py-1 text-[9px] font-black text-[#508578]">
                {monthCount}
              </span>
            </button>
            <div className="mt-3 grid grid-cols-7 text-center text-xs font-semibold uppercase text-stone-600">
              {["P", "W", "Ś", "C", "P", "S", "N"].map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>
            <div className="mt-1 grid min-w-[14rem] grid-cols-7 gap-y-0.5 [@media(pointer:coarse)]:min-w-[19.25rem]">
              {days.map((day) => {
                const outside = day.getMonth() !== monthIndex;
                const count = visitsByDay.get(dateKey(day))?.length ?? 0;
                const current = dateKey(day) === dateKey(today);
                return (
                  <button
                    aria-label={formatFullDate(day)}
                    className={`bd-calendar-day relative mx-auto grid size-8 place-items-center rounded-full text-xs font-bold ${
                      outside
                        ? "pointer-events-none text-transparent"
                        : current
                          ? "bg-[#245c4d] text-white"
                          : "text-stone-600 hover:bg-[#eef3e7]"
                    }`}
                    disabled={outside}
                    key={dateKey(day)}
                    onClick={() => onSelectDate(day)}
                    type="button"
                  >
                    {day.getDate()}
                    {count > 0 && !outside ? (
                      <span
                        className={`absolute bottom-0 size-1 rounded-full ${
                          current ? "bg-white" : "bg-[#6fb3a2]"
                        }`}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      {loading ? <CalendarLoadingOverlay /> : null}
    </div>
  );
}

function CalendarLoadingOverlay() {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-white/70 backdrop-blur-[1px]">
      <span className="inline-flex items-center gap-2 rounded-full border border-[#e5eadd] bg-white px-4 py-2 text-xs font-bold text-stone-600 shadow-sm">
        <LoaderCircle className="size-4 animate-spin text-[#245c4d]" />
        Aktualizujemy kalendarz
      </span>
    </div>
  );
}

function MobileWeekList({
  days,
  loading,
  onSelectVisit,
  selectedVisitId,
  today,
  visitsByDay,
}: {
  readonly days: readonly Date[];
  readonly loading: boolean;
  readonly onSelectVisit: (id: string) => void;
  readonly selectedVisitId: string | null;
  readonly today: Date;
  readonly visitsByDay: ReadonlyMap<string, readonly BeautyDocsAdminVisit[]>;
}) {
  return (
    <div className="divide-y divide-[#eaeee5] lg:hidden">
      {loading ? (
        <p className="flex items-center justify-center gap-2 px-5 py-8 text-xs font-bold text-stone-500">
          <LoaderCircle className="size-4 animate-spin text-[#245c4d]" />
          Aktualizujemy kalendarz
        </p>
      ) : (
        days.map((day) => {
          const dayVisits = visitsByDay.get(dateKey(day)) ?? [];
          const current = dateKey(day) === dateKey(today);
          return (
            <div className="p-4" key={dateKey(day)}>
              <div className="flex items-center gap-2">
                <span
                  className={`grid size-8 place-items-center rounded-full text-xs font-black ${
                    current ? "bg-[#245c4d] text-white" : "bg-[#eef3e7] text-[#3f6d62]"
                  }`}
                >
                  {day.getDate()}
                </span>
                <p className="text-xs font-black capitalize text-[#2b392d]">
                  {formatFullDate(day)}
                </p>
              </div>
              <div className="mt-3 space-y-2 pl-10">
                {dayVisits.map((visit) => (
                  <button
                    className={`w-full rounded-xl border p-3 text-left ${
                      selectedVisitId === visit.id
                        ? "border-[#5b9b8b] bg-[#f1f7e9]"
                        : "border-[#e0e5da] bg-white"
                    }`}
                    key={visit.id}
                    onClick={() => onSelectVisit(visit.id)}
                    type="button"
                  >
                    <span className="text-xs font-black text-[#173d35]">
                      {formatVisitTimeRange(visit.startsAt, visit.endsAt)}
                    </span>
                    <span className="mt-1 block text-xs font-black text-[#173d35]">
                      {visit.treatmentName}
                    </span>
                    <span className="mt-1 block text-[11px] text-stone-500">
                      {visit.clientName}
                    </span>
                  </button>
                ))}
                {dayVisits.length === 0 ? (
                  <p className="text-[11px] text-stone-400">Brak wizyt</p>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function CalendarStat({
  icon,
  label,
  value,
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#e3e8dd] bg-white p-4 shadow-sm">
      <span className="grid size-10 place-items-center rounded-xl bg-[#eef3e6] text-[#245c4d]">
        {icon}
      </span>
      <div>
        <p className="text-2xl font-black text-[#173d35]">{value}</p>
        <p className="text-xs text-stone-500">{label}</p>
      </div>
    </div>
  );
}

function startOfWeek(value: Date): Date {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function addDays(value: Date, amount: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function monthCalendarDays(value: Date): readonly Date[] {
  const first = new Date(value.getFullYear(), value.getMonth(), 1, 12);
  const calendarStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, index) => addDays(calendarStart, index));
}

function calendarVisibleRange(
  view: CalendarView,
  selectedDate: Date,
  weekAnchor: Date,
): { readonly first: Date; readonly last: Date } {
  if (view === "day") {
    return { first: selectedDate, last: selectedDate };
  }
  if (view === "week") {
    return { first: weekAnchor, last: addDays(weekAnchor, 6) };
  }
  if (view === "month") {
    const firstOfMonth = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      1,
      12,
    );
    const first = startOfWeek(firstOfMonth);
    return { first, last: addDays(first, 41) };
  }
  return {
    first: new Date(selectedDate.getFullYear(), 0, 1, 12),
    last: new Date(selectedDate.getFullYear(), 11, 31, 12),
  };
}

function initialManualVisitDate(
  defaultDate: Date,
  defaultTime: string,
  schedule: BeautyDocsBookingSchedule,
): string {
  const now = new Date();
  const candidate = new Date(defaultDate);
  const [hour, minute] = defaultTime.split(":").map(Number);
  candidate.setHours(hour, minute, 0, 0);
  const firstDay = candidate > now ? candidate : now;
  for (let offset = 0; offset <= 31; offset += 1) {
    const day = addDays(firstDay, offset);
    if (manualVisitTimes(schedule, dateKey(day)).length > 0) return dateKey(day);
  }
  return dateKey(addDays(now, 1));
}

function manualVisitTimes(
  schedule: BeautyDocsBookingSchedule,
  visitDate: string,
  durationMinutes = 60,
): readonly string[] {
  const date = new Date(`${visitDate}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return [];
  const day = bookingDay(schedule, date);
  if (day?.enabled !== true) return [];
  const opensAt = clockMinutes(day.opensAt);
  const closesAt = clockMinutes(day.closesAt);
  if (opensAt === null || closesAt === null) return [];
  const now = new Date();
  const times: string[] = [];
  for (
    let start = opensAt;
    start + durationMinutes <= closesAt;
    start += schedule.slotIntervalMinutes
  ) {
    const candidate = new Date(date);
    candidate.setHours(Math.floor(start / 60), start % 60, 0, 0);
    if (candidate <= now) continue;
    times.push(formatClockMinutes(start));
  }
  return times;
}

function calendarDateFromVisit(value: string): Date {
  const parts = zonedDateParts(value);
  return new Date(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    12,
  );
}

function dateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function visitDateKey(value: string): string {
  const parts = zonedDateParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function zonedDateParts(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Warsaw",
  }).formatToParts(new Date(value));
  for (const part of parts) {
    if (part.type !== "literal") result[part.type] = part.value;
  }
  return result;
}

function visitPosition(
  visit: BeautyDocsAdminVisit,
  hours: CalendarHours,
): CSSProperties | null {
  const parts = zonedDateParts(visit.startsAt);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const startsAt = new Date(visit.startsAt).getTime();
  const endsAt = visit.endsAt
    ? new Date(visit.endsAt).getTime()
    : startsAt + 60 * 60 * 1_000;
  const topMinutes = (hour - hours.startHour) * 60 + minute;
  const durationMinutes = Math.max(30, (endsAt - startsAt) / 60_000);
  const height = calendarHeight(hours);
  if (
    topMinutes >= (hours.endHour - hours.startHour) * 60 ||
    topMinutes + durationMinutes <= 0
  ) {
    return null;
  }
  const top = Math.max(0, (topMinutes / 60) * HOUR_HEIGHT + 4);
  const unclampedHeight = (durationMinutes / 60) * HOUR_HEIGHT - 8;
  return {
    top,
    height: Math.max(54, Math.min(unclampedHeight, height - top - 4)),
  };
}

function scheduleCalendarHours(
  schedule: BeautyDocsBookingSchedule,
  visits: readonly BeautyDocsAdminVisit[],
): CalendarHours {
  const starts: number[] = [];
  const ends: number[] = [];
  for (const day of schedule.days) {
    if (!day.enabled) continue;
    const opensAt = clockMinutes(day.opensAt);
    const closesAt = clockMinutes(day.closesAt);
    if (opensAt !== null) starts.push(opensAt);
    if (closesAt !== null) ends.push(closesAt);
  }
  for (const visit of visits) {
    const start = zonedDateParts(visit.startsAt);
    starts.push(Number(start.hour) * 60 + Number(start.minute));
    if (visit.endsAt) {
      const end = zonedDateParts(visit.endsAt);
      ends.push(Number(end.hour) * 60 + Number(end.minute));
    }
  }
  const firstMinute = starts.length > 0 ? Math.min(...starts) : 9 * 60;
  const lastMinute = ends.length > 0 ? Math.max(...ends) : 17 * 60;
  const startHour = Math.max(0, Math.floor(firstMinute / 60));
  const endHour = Math.min(
    24,
    Math.max(startHour + 1, Math.ceil(lastMinute / 60)),
  );
  return { startHour, endHour };
}

function calendarHeight(hours: CalendarHours): number {
  return (hours.endHour - hours.startHour) * HOUR_HEIGHT;
}

function bookingDay(
  schedule: BeautyDocsBookingSchedule,
  date: Date,
): BeautyDocsBookingSchedule["days"][number] | undefined {
  const weekday = (date.getDay() + 6) % 7;
  return schedule.days.find((day) => day.weekday === weekday);
}

function bookingStartAllowed(
  schedule: BeautyDocsBookingSchedule,
  startsAt: Date,
  durationMinutes = 60,
): boolean {
  const day = bookingDay(schedule, startsAt);
  if (day?.enabled !== true) return false;
  const opensAt = clockMinutes(day.opensAt);
  const closesAt = clockMinutes(day.closesAt);
  if (opensAt === null || closesAt === null) return false;
  const start = startsAt.getHours() * 60 + startsAt.getMinutes();
  return (
    start >= opensAt &&
    start + durationMinutes <= closesAt &&
    (start - opensAt) % schedule.slotIntervalMinutes === 0
  );
}

function visitDurationMinutes(visit: BeautyDocsAdminVisit): number {
  if (!visit.endsAt) return 60;
  const duration =
    (new Date(visit.endsAt).getTime() - new Date(visit.startsAt).getTime()) /
    60_000;
  return Number.isFinite(duration) && duration > 0 ? duration : 60;
}

function formatVisitDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (remainder === 0) return `${hours} godz.`;
  return `${hours} godz. ${remainder} min`;
}

function clockMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatClockMinutes(value: number): string {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function weekdayShort(value: Date): string {
  return new Intl.DateTimeFormat("pl-PL", { weekday: "short" })
    .format(value)
    .replace(".", "");
}

function weekdayLong(value: Date): string {
  return new Intl.DateTimeFormat("pl-PL", { weekday: "long" }).format(value);
}

function formatWeekHeaderDate(value: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(value)
    .replace(".", "");
}

function monthShort(value: Date): string {
  return new Intl.DateTimeFormat("pl-PL", { month: "short" })
    .format(value)
    .replace(".", "");
}

function formatFullDate(value: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(value);
}

function formatVisitDate(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function formatVisitTime(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(new Date(value));
}

function formatVisitTimeRange(startsAt: string, endsAt: string | null): string {
  return `${formatVisitTime(startsAt)}${endsAt ? `–${formatVisitTime(endsAt)}` : ""}`;
}

function formatWeekRange(first: Date, last: Date): string {
  const formatter = new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${formatter.format(first)} – ${formatter.format(last)}`;
}

function formatCalendarRange(
  view: CalendarView,
  first: Date,
  last: Date,
): string {
  if (view === "day") return formatFullDate(first);
  if (view === "month") {
    return new Intl.DateTimeFormat("pl-PL", {
      month: "long",
      year: "numeric",
    }).format(addDays(first, 7));
  }
  if (view === "year") return String(first.getFullYear());
  return formatWeekRange(first, last);
}
