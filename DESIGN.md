# Design

Visual system for **TrainLog**. This is the single source of truth for the redesign
("Focused Athletic Dark"). Every surface must consume these tokens and components so the
app reads as one cohesive instrument. **OKLCH values are canonical**; hex in comments are
approximations for reference. Read `PRODUCT.md` for the strategic why.

---

## 1. Theme & mood

A dark, focused training instrument. Deep graphite near-black canvas, one electric
violet accent spent only on "what to tap next" and live state, oversized tabular numerics
for the data that matters (weight, reps, timer, streak). Calm everywhere, loud in exactly
one place per screen. Depth comes from layered graphite elevation + soft top-light, never
from glassmorphism or decorative gradients.

**Register: product.** Earned familiarity over novelty. The tool disappears into the task.

---

## 2. Color

All colors are defined as CSS custom properties on `:root` in `src/styles/global.css`.
Use the tokens — never hardcode hex in components or view CSS.

### Canvas & surfaces (cool graphite ramp)
```
--bg:                oklch(0.16 0.014 265);   /* ~#0b0d12  app canvas / behind column   */
--bg-ambient:        oklch(0.13 0.012 265);   /* ~#08090d  desktop backdrop behind app  */
--surface:           oklch(0.205 0.016 265);  /* ~#14161f  cards, sheets                */
--surface-elevated:  oklch(0.245 0.017 265);  /* ~#1a1d28  nav, modals, popovers        */
--surface-high:      oklch(0.29 0.018 265);   /* ~#222634  inputs, wells, active base   */
--border:            oklch(0.33 0.02 265);    /* ~#2b3040  default hairline             */
--border-strong:     oklch(0.42 0.02 265);    /* ~#3c4353  emphasis / focus outline base*/
--border-subtle:     oklch(0.255 0.015 265);  /* ~#1b1f29  faint dividers               */
```

### Text (verify contrast on `--surface`; AA = 4.5:1 body, 3:1 large)
```
--text:            oklch(0.97 0.006 265);  /* ~#f3f5fb  primary                        */
--text-secondary:  oklch(0.80 0.012 265);  /* ~#b8c0cf  secondary, ≥4.5:1 on surface    */
--text-muted:      oklch(0.66 0.014 265);  /* ~#8b94a6  muted body min — still ≥4.5:1   */
--text-faint:      oklch(0.52 0.014 265);  /* ~#6b7284  DECORATIVE/disabled ONLY, never body */
```
Placeholder text uses `--text-muted` (not fainter) so it stays ≥4.5:1.

### Accent — electric violet (the one loud color)
```
--accent:         oklch(0.71 0.16 274);   /* ~#8b7cff  bright violet: CTA fill, progress, ring, active */
--accent-hover:   oklch(0.77 0.14 274);   /* ~#a89dff  hover brighten                 */
--accent-press:   oklch(0.65 0.17 274);   /* ~#7a6bf3  pressed                        */
--on-accent:      oklch(0.17 0.02 274);   /* ~#0e0b1a  near-black INK on accent fills (~7:1) */
--accent-text:    oklch(0.80 0.13 274);   /* ~#b3a8ff  accent as TEXT/ICON on dark (≥4.5:1) */
--accent-subtle:  color-mix(in oklch, var(--accent) 15%, transparent); /* selected/active row tint */
--accent-line:    color-mix(in oklch, var(--accent) 40%, transparent); /* faint accent borders     */
```
**Primary CTAs are a bright violet fill with near-black `--on-accent` ink** (≥16px, weight
650). This is the athletic signature and guarantees AA. Use `--accent-text` when the accent
is text/icon on a dark surface (links, active labels, live values). Never put white body
text on the accent fill (fails AA at UI sizes).

### Semantic (kept visually distinct; always pair with icon/shape, never hue alone)
```
--success:      oklch(0.78 0.15 158);  /* ~#3fd99b emerald — set complete, positive delta */
--danger:       oklch(0.66 0.20 20);   /* ~#f7736a rose   — destructive, negative delta    */
--warning:      oklch(0.82 0.14 85);   /* ~#f5c451 amber  — offline, caution                */
--info:         var(--accent-text);
--on-success:   oklch(0.20 0.03 158);  /* dark ink on success fill */
--on-danger:    oklch(0.99 0 0);       /* white ink on danger fill (bold, ≥16px)            */
--*-subtle:     color-mix(in oklch, <token> 14%, transparent);  /* tinted backgrounds       */
```

### Elevation & glow
```
--shadow-sm:   0 1px 2px rgba(0,0,0,.5);
--shadow-md:   0 6px 20px -6px rgba(0,0,0,.55);
--shadow-lg:   0 18px 48px -12px rgba(0,0,0,.6);
--glow-accent: 0 0 0 1px color-mix(in oklch,var(--accent) 35%,transparent),
               0 8px 30px -6px color-mix(in oklch,var(--accent) 40%,transparent);
```
Glow is reserved for the primary CTA and the live rest-timer ring. Nowhere else.

---

## 3. Typography

Two families on a real contrast axis (proportional sans vs. monospaced instrument) — not
two similar sans. Loaded offline via `@fontsource` (see `src/main.jsx`).

```
--font-sans: 'InterVariable', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'Geist Mono Variable', 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
```

- **Sans (Inter):** all UI — titles, labels, buttons, body, most data. Enable tabular
  figures on any changing numbers: `font-feature-settings: 'tnum' 1, 'cv05' 1;`.
- **Mono (instrument):** ONLY the hero numerics where precision reads as an instrument —
  the running session timer, the rest-timer countdown, the large active weight/reps during
  logging, streak count, and PR figures. Not for tables or labels.

### Scale (fixed rem, product register, ratio ≈1.2; base 1rem = 16px)
```
--text-xs:   0.75rem;    /* 12  micro labels, meta            */
--text-sm:   0.8125rem;  /* 13  secondary                     */
--text-md:   0.9375rem;  /* 15  body / default UI             */
--text-lg:   1.0625rem;  /* 17  emphasized body, list titles  */
--text-xl:   1.25rem;    /* 20  card titles                   */
--text-2xl:  1.5rem;     /* 24  screen section headings       */
--text-3xl:  1.875rem;   /* 30  screen hero title             */
--num-lg:    2.25rem;    /* 36  instrument numerics           */
--num-xl:    3rem;       /* 48  active weight / timer         */
--num-2xl:   4rem;       /* 64  focus moments (rest ring)     */
```
Weights: 400 body, 500 UI, 600 emphasis/labels, 700 titles, 800 hero/instrument.
Inputs render at **16px** minimum (prevents iOS focus-zoom). Use `text-wrap: balance` on
h1–h3, `text-wrap: pretty` on prose. Uppercase micro-labels (SET/TARGET/ACTUAL, section
kickers) are allowed as *functional* column/section labels — keep them ≤13px, tracked
+0.04em, `--text-muted`, and used sparingly. They are not decorative eyebrows.

---

## 4. Spacing, radius, layout

```
--space-2:4 --space-1:2  --space-xs:4  --space-sm:8  --space-md:12
--space-lg:16 --space-xl:24 --space-2xl:32 --space-3xl:48 --space-4xl:64
--radius-xs:6 --radius-sm:8 --radius-md:12 --radius-lg:16 --radius-xl:22 --radius-2xl:28 --radius-full:9999
```
Vary spacing for rhythm; don't apply one uniform gap everywhere. Cards are for genuinely
card-shaped content only — never nest a card in a card. Flexbox for 1D, Grid for 2D;
responsive tiles use `repeat(auto-fit, minmax(160px,1fr))`.

### App shell / responsive
Mobile-first single column. The app column is width-capped and centered so **desktop looks
intentional, not like a stretched phone**:
```
--app-max-width: 480px;
```
- `html` paints `--bg-ambient` (fills the whole viewport, incl. behind the iOS home bar).
- `.app` is `max-width: var(--app-max-width)`, centered with `margin-inline:auto`, sits on
  `--bg`, and on ≥ 520px viewports is lifted off the ambient field with `--shadow-lg` and a
  hairline border (a calm "device column"). Bottom nav + sticky CTAs align to this column.
- Respect `env(safe-area-inset-*)`. Content scroll region is `.view`; nav and sticky CTAs
  are pinned to the column, not the viewport edge on desktop.

Breakpoints (structural, not fluid type): `480px` (small phone → large phone),
`520px` (enter device-column mode), `900px` (optional two-pane for list+detail surfaces
like History/Library/Planner if it genuinely helps — otherwise keep the single column).

### Z-index scale (semantic — never invent 999)
```
--z-base:0 --z-sticky:100 --z-nav:200 --z-dropdown:300 --z-timer:450
--z-backdrop:400 --z-modal:410 --z-toast:500 --z-tooltip:600
```

---

## 5. Motion

State-driven only; the interface conveys change, it doesn't perform. 150–220ms for most
transitions, up to ~280ms for entrances.
```
--dur-fast:120ms --dur:180ms --dur-slow:280ms
--ease-out-quart: cubic-bezier(0.25,1,0.5,1);
--ease-out-expo:  cubic-bezier(0.16,1,0.3,1);
--ease-in-out:    cubic-bezier(0.65,0,0.35,1);
```
Ease OUT (quart/expo) for entrances and feedback; no bounce/elastic. Legitimate motion:
set-complete check pop + row settle, progress-bar fill, rest-ring countdown, streak flame
pulse, view crossfade, sheet slide-up, toast in/out, number roll on a new PR. Premium
materials (blur, mask, clip-path, shadow/glow) are allowed when they materially improve an
effect and stay smooth. **Every animation needs a `@media (prefers-reduced-motion: reduce)`
fallback** (crossfade or instant). Never gate content visibility behind a reveal transition
(it must be visible by default; animation only enhances).

---

## 6. Components (each ships every state: default / hover / focus-visible / active / disabled / loading / error)

- **Button** — one shape system (radius-md, min-height 48px primary / 36px small, gap-sm,
  font-weight 600). Variants: `primary` (accent fill + `--on-accent` ink + `--glow-accent`
  on hover), `secondary` (`--surface-high` + border), `ghost` (transparent, hover tint),
  `danger` (danger fill, white bold ink), `outline-danger`, `text`. Focus-visible = 3px
  `--accent` ring at 45% + 2px offset. Active = `scale(.97)`. Disabled = 45% opacity, no
  hover. Loading = inline spinner, label dimmed, non-interactive.
- **Input / textarea / select** — 16px text, `--surface-high` bg, `--border`, radius-md,
  min-height 48px. Focus = `--accent` border + 3px `--accent-subtle` ring. Error = `--danger`
  border + helper text in `--danger`. Numeric logging inputs are large, center-aligned,
  tabular. Disabled = muted.
- **Checkbox / complete-toggle** — the set-complete control is a ≥40px circular tap target;
  unchecked = hairline ring, checked = accent (or success) fill with a white check + a subtle
  pop. State is never color-only (the check glyph carries it).
- **Segmented control / pill toggle** — the Week/Month switch and similar: `--surface-high`
  track, `--accent-subtle` selected pill, `--text` selected / `--text-secondary` idle,
  180ms slide.
- **Card** — `--surface`, `--border`, radius-lg, `--shadow-md`. Interactive cards get hover
  lift (translateY(-1px) + border-strong). No side-stripe accent borders. No nested cards.
- **Badge / chip** — small, radius-full or radius-sm; exercise letter badges (A/B/C) use
  `--accent-subtle` bg + `--accent-text`.
- **Empty state** — teaches the interface: icon in a soft accent-subtle circle, a one-line
  what + a primary action. Never a bare "Nothing here."
- **Skeleton** — for loading content regions, a shimmer on `--surface-high`; not a centered
  spinner in empty space.
- **Toast** — `--surface-elevated`, radius-lg, `--shadow-lg`, a leading colored status icon
  chip (success/danger/info) — **not** a left border stripe. Auto-dismiss ~2.2s, in/out
  animated, reduced-motion safe.
- **Modal / bottom sheet** — prefer inline/progressive disclosure first; when a sheet is
  right, slide up from bottom with a `--backdrop` scrim, grabber, safe-area padding, focus
  trap, Esc/scrim close. Backdrop = rgba(0,0,0,.6).
- **Progress** — thin track `--surface-high`, `--accent` fill, animated width; the workout
  set-progress and rest ring share this accent language.

Consistency is the rule: the same button, the same input, the same card, screen to screen.
If "save" looks different in two places, one is wrong.

---

## 7. Absolute bans (reject-on-sight)

No side-stripe accent borders (>1px colored left/right border on cards/rows/alerts). No
gradient text (`background-clip:text`). No glassmorphism as default. No hero-metric SaaS
template. No identical icon+heading+text card grids repeated endlessly. No decorative motion
that doesn't convey state. No display/mono font in ordinary UI labels. No custom scrollbars
or reinvented standard controls. No text that overflows its container at any breakpoint
(test heading copy at 360 / 402 / 480 / desktop). Heavy/full-saturation accent on inactive
states is forbidden — inactive is quiet.

---

## 8. The bar

Would a lifter fluent in the best tools (Whoop, Strava, Linear-grade craft) trust this
mid-set and never pause at a subtly-off component? Every set logged in one tap, every screen
glanceable in two seconds under fatigue, one confident accent, honest numbers. If a screen
could be mistaken for a generic SaaS dashboard or a cluttered commercial fitness app, it
has failed — rework it.
