# BeautyDocs design tokens — cherry & cream

Canonical palette for the BeautyDocs 2.0 module (`components/beautydocs/**`,
`app/beautydocs-*`). The whole module — marketing home, navbar, pricing,
testimonials, login and the salon panel/dashboard — uses one **cherry + cream**
system. Do **not** use green here, and do **not** use the PowderBrows gold/marble
tokens (`#D4AF37`, `#F2EDE7`) — those belong to the separate `/` and `/admin`
PowderBrows app.

The style is expressed with Tailwind **arbitrary hex values** (e.g.
`bg-[#8f5263]`), matching the existing house style of the module. Neutral grays
use Tailwind `stone-*`.

## Core

| Role | Value | Notes |
| --- | --- | --- |
| Cherry primary (CTA, active nav, avatar) | `#8f5263` | main brand color |
| Cherry primary hover | `#7e4656` | |
| Cherry deep / pressed | `#6d3d4c` | |
| Cherry accent (icons on tint, links) | `#784454` | |
| Ink — headings | `#241d21` | near-black, cherry-tinted |
| Ink — secondary heading | `#2a2226` | |
| Ink — tertiary | `#3b3035` | |

## Tints & borders

| Role | Value |
| --- | --- |
| Tint — icon chip / badge / active card | `#f1e1e5`, `#eee0e3`, `#f6e9ec` |
| Tint — stronger | `#f0dbe0`, `#f6ebef` |
| Border — primary | `#d7bcc3` |
| Border — soft | `#ecd9de`, `#e4d2d7` |
| Border — strong | `#cdaab3` |
| Border — neutral | `stone-200` |

## Backgrounds (cream)

| Role | Value |
| --- | --- |
| Page (marketing / alt sections) | `#fcfaf8`, `white` (alternate) |
| Card / sidebar surface | `#fdfbfa` |
| Header surface | `#fbfaf7`, `#fbf9f7` |
| App shell / panel background | `#f6f1ef` |
| Login left panel | `#f6f1ef` |
| Login right (dark) panel | bg `#3b2830`, glass card `#241820` |

## Muted text (warm, cherry-tinted grays)

| Role | Value |
| --- | --- |
| Label (uppercase eyebrow) | `#7a6e70` |
| Secondary text | `#8a7a7f` |
| Tertiary text | `#a2969a` |
| Body copy | `text-stone-600` / `text-stone-500` |

Focus ring everywhere: `focus-visible:ring-[#8f5263]`.

## Section rhythm (marketing)

- Alternate section backgrounds: `bg-white` ↔ `bg-[#fcfaf8]`.
- Eyebrow label: `text-sm font-black uppercase tracking-[0.16em] text-[#8f5263]`.
- Heading: `font-black tracking-tight text-[#241d21]` (headings render in the
  Playfair serif via `app/globals.css`; use `font-serif` only where an explicit
  editorial serif is wanted).
- Body: `text-lg leading-8 text-stone-600`.
- Card: `rounded-3xl border border-stone-200 bg-[#fcfaf8]` with
  `hover:border-[#d7bcc3] hover:shadow-[0_16px_40px_rgba(67,49,56,0.08)]`.
- Primary button: `rounded-xl bg-[#8f5263] text-white shadow-[0_12px_30px_rgba(143,82,99,0.25)] hover:bg-[#7e4656]`.

## Fonts

The app loads **Playfair Display** (`--font-playfair`, `font-serif`) and **Lato**
(`--font-lato`, `font-sans`). `globals.css` already routes all `h1..h6` to the
serif. When adapting third-party sections that ask for other fonts (e.g. "LT
Superior Serif", "42 Dotsans"), map serif display → `font-serif`, and small
uppercase label fonts → `font-sans` with `uppercase tracking-[0.14em]`.
