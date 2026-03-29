# TrainLog Roadmap

---

## ✅ Completed

### Core
- CSV import (TrainHeroic format) with exercise parsing
- Date strip (week view) + month calendar with toggle + month/year picker
- Workout detail view with exercises, sets, notes
- Active workout session — set logging, timer, crash recovery, auto-fill, bodyweight support
- Rest timer with circular progress ring, +/−15s, Skip, haptic feedback
- Rest duration setting (30s / 1min / 90s / 2min / 3min)
- History view — completed sessions, target vs actual, delete with confirm
- Library view — exercise list, search, YouTube link management
- Exercise history drilldown — tap exercise → see all logged sessions
- Grouped set display ("3 × 8 @ 135 lb" instead of repeating identical sets)
- Per-exercise notes (global coaching tips, propagates across workouts)
- Workout templates — save, rename, duplicate, delete
- Weekly planner with template picker and draft/apply flow
- Session notes (workout-level textarea)
- Data backup / restore (JSON export + import)
- Storage usage indicator
- Toast notifications
- View fade-in transitions
- PWA setup — service worker, icons, installable
- NAS backend — offline-first sync to Synology via Node/Express
- YouTube bulk importer — CLI, standalone GUI, and in-app batch import
- Unit tests (56 tests, all passing)

### Bugs Fixed
- `extractVideoId` duplicated across two files → moved to `src/utils/youtube.js`, now supports Shorts + `embed/` URLs
- `LogSetRow` local state went stale when `loggedSet` prop changed externally → `useEffect` sync added
- Exercise note input collapsed on iOS keyboard show/hide → fixed with `ref.focus()` + blur guard
- Crash recovery "Resume" offered even when the workout was deleted → now checks `workouts[workoutTitle]` exists
- Session note textarea fired `saveLog` on every keystroke → debounced 500ms
- Volume calculation always labeled "lbs" regardless of unit → now groups by unit, skips non-summable (RPE, %)
- PR detection only tracked absolute max weight → now tracks per-rep-count (`prMap[exercise][repCount]`)
- Template rename did not update `th_schedule` → schedule entries updated on rename
- Duplicate template names allowed → validation added on save
- `cloneBlock` read dead field `repsLabel` instead of `repsUnit` → backward-compat fix applied
- `onClearAllData` called `localStorage.removeItem` directly, bypassing `removeLS` → fixed
- `failedKeys` lost on page reload → persisted to `sessionStorage`
- `Modal` had no Escape key or overlay click to dismiss → added

### Features Added
- **Reps as a unit** — independent unit dropdowns on both reps and weight sides of set rows
- **Web Push Notifications** — VAPID server infrastructure, service worker push handler, local rest-timer notification
- **Daily workout reminder** — server-side cron at user-configured time with auto-detected timezone
- **ICS calendar export** — future-only `.ics` download with optional end date
- **Progress charts** — SVG weight-over-time line chart in ExerciseHistoryView; PR dots in yellow; volume sparkline
- **"Last time" hints** — previous session's reps/weight shown below target in each set row
- **Quick weight adjust** — ±2.5 buttons flanking the weight input
- **Workout completion summary** — modal after finishing shows total sets, volume, and PRs hit
- **Audio cue on rest end** — Web Audio API beep (880 Hz, 150 ms) when rest timer reaches zero
- **TrainingView redesign** — workout card with blue header, exercise chips, prominent "Start Workout" CTA; rest day empty state
- **HistoryView redesign** — timeline layout (date column + card), PR count badge, inline PR badges per set, compact trash icon
- **LibraryView redesign** — sticky search bar, compact rows with set summary + YouTube icon, tap to expand

---

## 🐛 Open Bugs

### Active Workout
- Rest timer re-fires when a completed set is un-checked then re-checked — confusing when reviewing logged sets
- `handleCompleteWorkout` closure captures pre-modal state snapshot — low risk but fragile

### History
- PR logic in `getSetPR` uses synthesised `log.key` field; old logs with a top-level `key` stored in the object itself could shadow it — low risk but fragile

### Template Editor
- Removing the last exercise in the only block is silently ignored; "Save Template" then does nothing with no error toast

### Planner
- "Copy to Next Week" stages the draft but requires a manual "Apply Plan" tap — not obvious to users
- Multi-day clear in a single draft batch can prematurely delete workout objects that are still in use

### Sync & Data
- Sync merge is server-wins with no notification — if two sessions are open simultaneously one will silently overwrite the other

### Navigation
- No browser history integration — back button doesn't work; iOS PWA swipe-back exits to home screen
- `ROUTE_EDIT_TEMPLATE` fallback in `App.jsx` duplicates all `SettingsView` prop bindings — maintenance hazard

### Library
- Notes draft may initialise from stale memo value on rapid double-tap open/save/reopen

---

## 💡 Feature Ideas

### Active Workout
- Auto-scroll to next set after completing current set + starting rest timer
- Per-exercise rest duration override in the template editor
- Template divergence warning — banner if the scheduled workout's template was edited since the session started

### History & Progress
- Filter / search history by workout title or exercise name
- Export history as CSV
- Bodyweight rep PR tracking — for bodyweight exercises, track highest rep count
- Sort order toggle in exercise drilldown (newest-first vs oldest-first to see progression)

### Library
- Show which workouts contain each exercise ("in 3 workouts")
- YouTube link preview thumbnail instead of raw URL text

### Planner
- Draft persistence across week navigation — currently `goToPrevWeek` / `goToNextWeek` silently discard unsaved changes
- Unsaved changes guard — confirm dialog when leaving WeekPlannerView with a pending draft
- Rest day label — explicitly mark a day as "Rest Day" (distinct from unscheduled)
- Tap scheduled workout name in planner to navigate to it in TrainingView

### Settings & Data
- Theme selector — dark-only today; light / auto toggle
- Sync conflict notification — lightweight banner when server data overwrites local changes
- Version display reads from `package.json` via `import.meta.env.VITE_APP_VERSION`

### Import
- Re-import warning — alert when a CSV re-import would overwrite existing workout data
- Drag-and-drop CSV onto the import zone

---

## ✨ Polish

- **Rest timer pause/resume** — tapping the timer face pauses it (currently only Skip)
- **iOS swipe-back guard** — intercept browser back gesture during active workout to show cancel modal
- **Set completion undo** — long-press or visible undo affordance (toggling off is not discoverable)
- **Sticky "Apply Plan" button** — pin to bottom of viewport so it's always visible while scrolling the 7-day grid
- **PR badges per rep scheme** — track best weight for 1, 3, 5, 8, 10 reps separately in History
- **Focus management** — move focus into modals on open; return focus to trigger on close (WCAG 2.1 SC 2.1.1)
- **Keyboard shortcut** — spacebar to complete the highlighted set during ActiveWorkout on desktop
- **Deep-link / hash routing** — `#/history`, `#/library` for browser back/forward and shareable links
- **Storage indicator live updates** — recalculate when logs or workouts change, not just templates
- **Template preview shows part labels** — "Part A: Squat (4 sets), Part B: Leg Press…" with superset indication
- **Import progress indicator** — spinner during large CSV parse (currently synchronous and blocking)
