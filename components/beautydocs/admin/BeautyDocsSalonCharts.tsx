import type { BeautyDocsTenantAnalytics } from "../../../types/beautydocs-admin";

const CHERRY = "#245c4d";
const TRACK = "#eef3e7";

function formatWeek(weekStart: string): string {
  const parts = weekStart.split("-");
  if (parts.length !== 3) return weekStart;
  return `${Number(parts[2])}.${parts[1]}`;
}

/** A compact single-series weekly bar chart (magnitude over time). */
function WeeklyBars({
  label,
  values,
  weekStarts,
}: {
  readonly label: string;
  readonly values: readonly number[];
  readonly weekStarts: readonly string[];
}) {
  const total = values.reduce((sum, value) => sum + value, 0);
  const max = Math.max(...values, 1);
  const count = values.length;
  const gap = 3;
  const barWidth = (100 - gap * (count - 1)) / count;
  const plotHeight = 40;
  const maxIndex = values.reduce(
    (best, value, index) => (value > values[best] ? index : best),
    0,
  );

  return (
    <div className="rounded-2xl border border-[#e7ecdf] bg-white p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#245c4d]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black tracking-[-0.03em] text-[#173d35]">
        {total}
      </p>
      <svg
        aria-hidden="true"
        className="mt-3 h-16 w-full"
        preserveAspectRatio="none"
        viewBox={`0 0 100 ${plotHeight}`}
      >
        {values.map((value, index) => {
          const height = value === 0 ? 0 : Math.max((value / max) * plotHeight, 2);
          const x = index * (barWidth + gap);
          return (
            <rect
              key={index}
              fill={index === maxIndex && value > 0 ? CHERRY : TRACK}
              height={height || 2}
              opacity={value === 0 ? 0.5 : 1}
              rx={1.4}
              width={barWidth}
              x={x}
              y={plotHeight - (height || 2)}
            />
          );
        })}
      </svg>
      <div className="mt-1.5 flex justify-between text-[10px] font-bold text-[#96a298]">
        <span>{formatWeek(weekStarts[0] ?? "")}</span>
        <span>{formatWeek(weekStarts[count - 1] ?? "")}</span>
      </div>
    </div>
  );
}

/** Ranked horizontal bars — which treatments are documented most. */
function TreatmentBars({
  treatments,
}: {
  readonly treatments: BeautyDocsTenantAnalytics["treatments"];
}) {
  const max = Math.max(...treatments.map((item) => item.count), 1);
  return (
    <div className="rounded-2xl border border-[#e7ecdf] bg-white p-5">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#245c4d]">
        Najczęstsze zabiegi
      </p>
      <ul className="mt-4 space-y-3">
        {treatments.map((item) => (
          <li key={item.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-bold text-[#173d35]">
                {item.label}
              </span>
              <span className="shrink-0 text-sm font-black text-[#245c4d]">
                {item.count}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#f1f6e9]">
              <div
                className="h-full rounded-full bg-[#245c4d]"
                style={{ width: `${Math.max((item.count / max) * 100, 4)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BeautyDocsSalonCharts({
  analytics,
}: {
  readonly analytics: BeautyDocsTenantAnalytics | null;
}) {
  const weeks = analytics?.weeks ?? [];
  const treatments = analytics?.treatments ?? [];
  const weekStarts = weeks.map((week) => week.weekStart);
  const hasTimeData = weeks.some(
    (week) => week.visits > 0 || week.newClients > 0 || week.submissions > 0,
  );
  const hasData = hasTimeData || treatments.length > 0;

  return (
    <section aria-labelledby="salon-charts-heading" className="mt-8">
      <h2
        className="text-lg font-black tracking-[-0.02em] text-[#173d35]"
        id="salon-charts-heading"
      >
        Statystyki salonu
      </h2>
      <p className="mt-1 text-sm text-[#5a6b5a]">Ostatnie 12 tygodni.</p>

      {!hasData ? (
        <div className="mt-4 rounded-2xl border border-dashed border-[#d4decc] bg-[#fcfaf8] p-8 text-center">
          <p className="text-sm font-bold text-[#173d35]">
            Wykresy pojawią się, gdy zaczniesz przyjmować klientki
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#5a6b5a]">
            Dodaj wizyty, klientki i wypełnione formularze, a tutaj zobaczysz
            trendy salonu.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <WeeklyBars
              label="Wizyty"
              values={weeks.map((week) => week.visits)}
              weekStarts={weekStarts}
            />
            <WeeklyBars
              label="Nowe klientki"
              values={weeks.map((week) => week.newClients)}
              weekStarts={weekStarts}
            />
            <WeeklyBars
              label="Formularze"
              values={weeks.map((week) => week.submissions)}
              weekStarts={weekStarts}
            />
          </div>
          {treatments.length > 0 ? (
            <TreatmentBars treatments={treatments} />
          ) : null}
        </div>
      )}
    </section>
  );
}
