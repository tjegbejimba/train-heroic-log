# Product

## Register

product

## Users

**Primary user: a committed strength/hypertrophy lifter running a structured program.**
Represented by TJ — a developer and DJ who lifts on a repeating split (Push / Pull / Legs /
Upper-Lower). He imports programming from TrainHeroic (CSV), schedules sessions across the
week, and logs actual reps + weight set-by-set while training.

**Context of use is demanding and physical:**
- Early mornings and dim garage/commercial gyms — low ambient light, glare-sensitive.
- Phone propped up or held with chalky/sweaty hands, one-handed, gloves sometimes on.
- Glancing for 2–3 seconds between sets while under fatigue; then resting with a timer running.
- Frequently offline or on flaky gym Wi-Fi — the app must never block on the network.

**The job to be done:** "Tell me exactly what to do next, let me record what I actually did
in one tap, keep me honest about progression, and stay out of my way." Secondary jobs:
plan the week, review history/PRs to confirm progressive overload, and manage the exercise
library (form-cue notes + reference videos).

## Product Purpose

TrainLog is an offline-first PWA for logging strength workouts, inspired by TrainHeroic but
faster, private (data lives on-device with background sync to a personal NAS), and tuned for
one athlete's real training loop. It exists because commercial apps are slow, cloud-locked,
cluttered with social/upsell noise, and awkward to use mid-set.

Success looks like:
- A logged set takes **one tap** and near-zero cognitive load.
- The next action on every screen is obvious at a glance (glanceable at arm's length).
- The lifter trusts the numbers enough to drive week-over-week progression from them.
- It works flawlessly offline and feels instantaneous.
- It looks good enough that opening it is a small motivator, not a chore.

## Brand Personality

**Focused · Athletic · Precise.** A quiet, confident training instrument — not a hype
machine, not a corporate SaaS dashboard. Voice is direct and encouraging without being
loud: "Start Workout," "Crushed it," "Rest up and come back strong." Think the calm
competence of a good coach and the legibility of a well-made piece of gym equipment.
Emotional goals: **momentum, clarity, and earned pride** — the app should make consistency
feel rewarding and the current rep feel important.

## Anti-references

- **Cluttered commercial fitness apps** (social feeds, streak-guilt, upsell banners, ads,
  achievement confetti spam). No engagement-bait.
- **Generic SaaS admin dashboards** — flat gray cards in identical grids, tiny data, a
  "hero metric" template, indigo-on-white blandness. This is a tool for a body, not a CRM.
- **Neon "cyber-gym" gamification** — no glowing HUD gimmicks, no XP bars, no aggressive
  gradients or 3D chrome. Energy comes from typography, contrast, and one confident accent,
  not decoration.
- **Skeuomorphic "paper notebook" logging** — this is a precise digital instrument.

## Design Principles

1. **The current action is sacred.** On every screen, the single most useful next action is
   the most prominent thing. Everything else defers to it. Mid-set, that's logging a set;
   on Training, it's Start Workout; on a rest day, it's plan/preview.
2. **Glanceable under fatigue.** Optimize for a 2-second read at arm's length: big tabular
   numbers, high contrast, generous thumb-sized targets (≥48px), no reliance on subtle color
   alone. If a tired lifter can't parse it instantly, it's wrong.
3. **Calm canvas, one loud accent.** The interface is quiet and dark; the electric accent is
   spent only on "what to tap next," progress, and live state. Restraint makes the accent mean
   something.
4. **Earned momentum.** Reward consistency with honest, specific feedback (streaks, volume,
   PRs, "you beat last time") — never empty confetti. Progress is shown, not celebrated for
   its own sake.
5. **Never block on the network.** Offline is the default assumption. State is written locally
   first and always; sync is invisible until it matters. The UI is instantaneous.

## Accessibility & Inclusion

- **Target WCAG 2.1 AA.** Body/label text ≥ 4.5:1 against its surface; large/bold text ≥ 3:1;
  interactive state never signaled by color alone (pair with icon/shape/weight). This is
  non-negotiable given the low-light, high-fatigue usage.
- **Touch ergonomics:** primary targets ≥ 48px, comfortable spacing, reachable in the bottom
  two-thirds of the screen for one-handed thumb use; respect iOS safe areas.
- **Reduced motion:** every animation has a `prefers-reduced-motion: reduce` alternative
  (crossfade or instant). Motion never gates content visibility.
- **Legibility:** tabular figures for all reps/weights/timers so digits don't shift; avoid
  thin weights for data; support Dynamic-Type-friendly sizing where practical.
- Color-vision considerations: success/danger/warning are reinforced with icon + label, not
  hue alone.
