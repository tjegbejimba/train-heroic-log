
# TrainLog Roadmap

## Current Status
✅ **MVP Core Complete:**
- CSV import with parsing
- Date strip calendar (week view)
- Workout detail view with exercises
- YouTube link management per exercise
- localStorage persistence
- PWA setup with service worker
- ActiveWorkoutView (live set logging)
- Month view calendar with toggle
- HistoryView (completed workout list with target vs actual)
- LibraryView (exercise list, search, YouTube link management)
- Per-exercise notes in ActiveWorkoutView
- Month/year picker (jump to any month)
- Workout Templates (save, rename, duplicate, delete)
- Weekly Planner with template picker
- Template management in Settings
- Overall workout session notes
- Total volume per session in History
- PR (personal record) indicators in History
- Toast notifications for key actions
- View fade-in transitions
- Data backup/restore (JSON export/import)
- Storage usage indicator
- Clear all data with confirmation
- Responsive CSS for all views
- Unit tests (32 tests, all passing)
- PWA icons (192x192, 512x512)
- Improved service worker (network-first + versioned cache)
- NAS backend with offline-first sync
- YouTube link bulk importer (standalone GUI + CLI)
- Exercise history drilldown (tap exercise in Library → see all logged sessions)
- Grouped set display ("3 × 8 @ 135 lb" instead of repeating identical sets)
- Flexible template set editor (Reps/Time toggle, unit header, removable value column, copy-last-set)
- Active workout session: auto-fill target on complete, unit-aware labels, bodyweight hides weight input, next-set highlight, incomplete confirmation modal
- Rest timer with +/−15s and Skip (auto-starts after each completed set)
- Haptic feedback on set complete
- Rest duration setting (30s / 1min / 90s / 2min / 3min, default 90s)

🚧 **Next Up:**
- Deploy to Synology NAS
- Manual device testing, Lighthouse audit

---

## Bugs & Issues Found in Code Audit

### 🐛 Active Workout

**BUG: `extractVideoId` duplicated across two files**
Both `ActiveWorkoutView.jsx` (line 387) and `ExerciseRow.jsx` (line 113) define their own local `extractVideoId` function with identical logic. Neither handles YouTube Shorts URLs (`/shorts/VIDEO_ID`) or URLs with query params beyond `v=` (e.g. `?v=abc&t=30s`). Both will return an empty string and silently fail to embed. Should be extracted to a shared util and expanded to cover Shorts + `?t=` timestamp trimming.

**BUG: `LogSetRow` local state goes stale when `loggedSet` prop changes externally**
`LogSetRow.jsx` initializes `localReps`, `localWeight`, and `isCompleted` from `loggedSet` only once in `useState` (lines 17–19). If the parent re-renders with a different `loggedSet` — e.g. after crash-recovery reload fills in auto-filled values, or if the same exercise title appears twice in a workout — the displayed inputs don't update to match. The fix is a `useEffect` that syncs from `loggedSet` when it changes and the row is not in an actively-editing state.

**BUG: Rest timer restarts from scratch on every set complete — even for completed sets**
`ActiveWorkoutView.jsx` line 88 starts the rest timer whenever `newSetData.completed` is true. Toggling a set back to incomplete then back to complete re-triggers the timer. But more critically, `saveLog` on line 85 persists the log, and on crash-recovery (line 24) the existing log is loaded. On resume, `useEffect` at line 47 re-initialises, does nothing because exercises are already populated — but the timer does not re-activate. This is fine, but toggling an already-completed set checkbox still re-fires the timer, which is confusing.

**BUG: `handleCompleteWorkout` doesn't save `currentLog.exercises` if they were updated after the last `saveLog` call**
`ActiveWorkoutView.jsx` line 112: `handleCompleteWorkout` sets `completedAt` on `currentLog` and calls `saveLog`. But `currentLog` is React state — the closure always captures the latest state at call time, so this is actually correct. However, if the user taps "Finish Anyway" in the incomplete-sets modal, `handleCompleteWorkout` runs after the modal confirm callback at line 376 (via `setShowCompleteModal(false)` and then `handleCompleteWorkout()`). Since `setShowCompleteModal` is a state setter and `handleCompleteWorkout` is called synchronously in the same callback, the `currentLog` used to build `completed` is the pre-setState snapshot, but because `setShowCompleteModal` doesn't affect `currentLog`, this is actually safe. Low severity — no bug, but worth noting.

**BUG: Exercise note input loses focus unexpectedly on mobile**
`ActiveWorkoutView.jsx` lines 286–305: when `editingNote` equals an exercise title, an `<input>` is rendered with `autoFocus` and `onBlur={() => setEditingNote(null)}`. On iOS Safari, the virtual keyboard appearance causes a layout shift and re-render that triggers `onBlur` prematurely, dismissing the note input before the user finishes typing. Should use a `ref` + `focus()` instead of `autoFocus`, and guard the blur so it doesn't dismiss when the keyboard itself is still open (or use a `<textarea>` with a manual "Done" tap instead of blur-to-save).

**BUG: Crash recovery modal appears even if the active session's workout no longer exists**
`App.jsx` line 100: `if (session && Object.keys(workouts).length > 0)` — this shows the resume modal as long as there are *any* workouts, even if the specific workout in `session.logKey` was deleted since the session started. Tapping "Resume" navigates to `ROUTE_ACTIVE_WORKOUT` and `ActiveWorkoutView` renders "Workout not found" (line 130). Should also check `workouts[parseLogKey(session.logKey).workoutTitle]` exists.

**BUG: Workout note (session-level textarea) fires `saveLog` on every keystroke**
`ActiveWorkoutView.jsx` line 105: `updateWorkoutNote` is called `onChange` of the textarea. Every character typed triggers a `writeLS` + `pushToServer`. For long-form notes this is excessive — a 500ms debounce should be applied to `updateWorkoutNote` (separate from the sync-layer debounce, which only debounces per-key).

### 🐛 History View

**BUG: PR detection uses `log.key` but `isSetPR` receives `log.key` which may be undefined**
`HistoryView.jsx` line 36: `allLogs` from `useWorkoutLogs` maps `[key, log]` entries and spreads `log` with an added `key` property. The spread `...log` overwrites fields from the log object, including any top-level `key` field already present in stored logs. However log objects stored by `saveLog` in `ActiveWorkoutView` include a `logKey` field at the top level (line 29), not `key`. In `HistoryView`, the `prMap` builder (line 32) stores `logKey: log.key`, but `isSetPR` (line 87) compares `pr.logKey === logKey` where `logKey` is the `log.key` value from the list. This works because `allLogs` always synthesises a `.key` field from the map key. But for old logs that were saved with a `key` field inside the log object itself, the spread could shadow. Low risk today, but fragile.

**BUG: Volume calculation and PR detection are unit-unaware — always uses "lbs"**
`HistoryView.jsx` lines 65–79: `calcVolume` multiplies `actualReps * actualWeight` unconditionally and labels the result "lbs". If a user logs kg, % 1RM, or RPE sets, those numbers are still added and labeled as pounds. The `formatVolume` function (line 81) always appends "lbs". Should check `set.unit` and either normalize to a common unit or suppress the volume line for mixed-unit workouts.

**BUG: PR logic only tracks absolute max weight, ignores rep scheme**
`HistoryView.jsx` lines 18–45: `prMap` stores the single highest weight per exercise across all time, irrespective of rep count. A 1-rep max is treated the same as a 10-rep max. A new 10-rep PR at lower weight than an old 1-rep max will never be flagged. The existing roadmap notes this but it manifests as incorrect PR badges shown (or not shown) today.

### 🐛 Template Editor

**BUG: Removing the last exercise in a block removes the entire block, but this can put the editor into a 0-block state**
`TemplateEditorView.jsx` lines 72–82: `removeExercise` calls `removeBlock` when no exercises remain. `removeBlock` at line 53 returns early if `blocks.length <= 1`. So removing the last exercise of the only block is silently ignored — the empty exercise stays. The Save button check at line 210 filters out exercises without titles, so saving with only empty exercises hits `cleanBlocks.length === 0` and `handleSave` returns early (no toast, no error). The user's "Save Template" click appears to do nothing — no feedback is given that the template is invalid because all exercises are untitled.

**BUG: Template name uniqueness is not enforced in `TemplateEditorView` / `handleSave`**
`App.jsx` line 395 overwrites the existing template with `saveTemplate(updated.id, updated)`. Renaming a template to the name of an *existing different* template silently creates two templates with the same name. This causes ambiguity in the WeekPlanner picker (two identically-named entries) and in `handleSetWorkoutDate` (line 129 uses `templateList.find(t => t.name === workoutTitle)` which returns the first match).

**BUG: Saving a template edit with a renamed template does not update `th_schedule` entries**
`App.jsx` lines 397–410: when the template name changes (`tpl.name !== updated.name`), the workout in `th_workouts` is updated (old key deleted, new key added). But `th_schedule` is not touched. Schedule entries pointing to the old name become orphaned — those dates still show the old workout name, which now has no matching workout, rendering an empty Training view on that date.

**BUG: `cloneBlock` in `TemplateEditorView` reads `repsLabel` (line 458) but the data model uses `repsUnit`**
`TemplateEditorView.jsx` line 458: `repsLabel: ex.repsLabel || 'Reps'`. The rest of the file uses `ex.repsUnit` consistently (lines 143, 149, 354, etc.). `repsLabel` is a dead field — it comes from older code and `cloneBlock` preserves it unnecessarily, but more importantly any exercise with only a `repsLabel` field (not `repsUnit`) loaded into the editor will show the default "reps" because `ex.repsUnit` would be undefined. In practice, CSV-imported exercises don't have `repsUnit` until the template editor touches them.

### 🐛 Planner

**BUG: "Copy to Next Week" navigates to next week and applies a draft but does NOT call `applyPlan` — user must manually tap "Apply Plan"**
`WeekPlannerView.jsx` lines 134–165: `repeatNextWeek` builds `newDraft`, calls `setWeekStart(nextWeekDates[0])`, and `setDraft(newDraft)`. The draft is staged and visible, but the user must then tap "Apply Plan" to commit it to the schedule. The `goToNextWeek` helper (line 61) resets `draft` to `{}` on week navigation, but `repeatNextWeek` sets the new draft *before* changing the week. Because `setWeekStart` and `setDraft` are both synchronous state setters in the same call, both updates batch together — the draft survives the week change. This is intentional but unintuitive: the user sees their filled-in week but doesn't know they need to apply. Toast or auto-apply would help.

**BUG: Clearing a day in draft then applying removes the workout from `th_workouts` even if other scheduled dates still use it**
`App.jsx` lines 138–150: `handleSetWorkoutDate` checks `stillUsed` across `schedule` — the *already committed* schedule, not the draft. If the planner has multiple days being cleared in the same draft, only the first committed clear sees the others as "still used". The second clear's `stillUsed` check will see 0 other references (since the first clear already removed it from schedule) and delete the workout. Low risk since drafts clear one day at a time, but if someone drafts "clear all 5 days of the same workout" and applies, the workout may be deleted prematurely.

### 🐛 Navigation & App Shell

**BUG: `ROUTE_EDIT_TEMPLATE` full `SettingsView` fallback duplicates all sync/clear props inline**
`App.jsx` lines 417–456: when `params.templateId` doesn't match a template, the fallback renders a full `SettingsView` with all props duplicated. This is a copy-paste of lines 334–378. Any change to the Settings route's prop list must be updated in both places. Not a user-visible bug but a maintenance hazard — the duplicate is already out of sync (no import needed) since both blocks are identical, but one typo will cause a silent divergence.

**BUG: `Modal` component has no Escape-key handler or overlay click-to-dismiss**
`Modal.jsx` renders a fixed overlay but does not listen for `keydown` to close on Escape, and clicking the overlay background doesn't dismiss it. All modal usages (cancel workout, delete log, delete template, clear week) require the user to tap a button. On mobile this is fine, but it's an accessibility and UX gap. The `showClearConfirm` modal in `SettingsView.jsx` (line 442) is a raw `<div>` modal that also lacks Escape handling.

**BUG: `NavBar` uses `ROUTE_PLANNER` for the Planner tab but `TAB_TRAINING = 'training'` for Training**
`NavBar.jsx` lines 12–16: the tab array mixes route constants (`ROUTE_PLANNER = 'planner'`) and tab constants (`TAB_TRAINING = 'training'`, `TAB_HISTORY = 'history'`, `TAB_LIBRARY = 'library'`, `TAB_SETTINGS = 'settings'`). `ROUTE_PLANNER` and `TAB_TRAINING` etc. happen to have the same string values (`constants.js` lines 10–25), so this works. But it's semantically inconsistent — if any route value ever changes, the NavBar active-tab highlight will silently break.

**BUG: DateStrip "TODAY" button doesn't switch back from month view to week view**
`TrainingView.jsx` lines 47–64: when `viewMode === 'month'`, `DateStrip` is not rendered at all — `MonthCalendar` is shown instead. The `MonthCalendar` component has its own "TODAY" button (line 159) that navigates both the displayed month and `currentDate`. But the main `DateStrip`'s "TODAY" button is hidden. When the user is in month view and taps the MonthCalendar Today button, the displayed month does update (line 73–83 in `MonthCalendar.jsx`). This part works. However, the `viewMode` toggle button only exists inside `DateStrip` (week mode) — there is no toggle back to week view visible from the MonthCalendar except the "Week View" button rendered in `training-view__month-controls` (line 57). This is correct and not a bug, but it's easy to miss.

### 🐛 Library

**BUG: Exercise notes `notesDraft` initialised from `exercise.notes` on open, but `exercise.notes` from `useMemo` may be stale**
`LibraryView.jsx` line 473: `setNotesDraft(exercise.notes || '')` is called when the user opens the edit textarea. `exercise.notes` comes from the `useMemo` at line 92. If two edits happen back-to-back quickly (open, save, immediately re-open), the `exercises` memo may not have re-run yet (React batches state updates), so the draft initialises from the old value and silently discards the just-saved text. Low probability but reproducible with fast taps.

**BUG: Bulk import "Save" does not show a toast or clear the panel after saving**
`LibraryView.jsx` lines 196–204: `handleBulkSave` calls `setManyYouTubeLinks` and `setBulkSaved(...)`. The panel stays open with a confirmation message, but no toast fires (the toast system isn't wired into `LibraryView` — `showToast` is not imported). The user sees the inline "Saved N links" text but must manually close the panel. Minor UX gap, not a bug per se, but inconsistent with other save actions.

### 🐛 Sync & Data

**BUG: `onClearAllData` with selected keys calls `localStorage.removeItem` directly, bypassing `removeLS`**
`App.jsx` line 351: `keys.forEach((k) => localStorage.removeItem(k))`. `removeLS` in `src/storage/index.js` (line 35) calls `pushToServer(key, null)` to signal deletion to the server. Direct `removeItem` skips this signal. After a partial clear, the server still holds the deleted keys' data. On next app startup, `pullFromServer` will see server data for those keys and restore them — undoing the user's clear. The fix is to use `removeLS` in the partial-clear path.

**BUG: `failedKeys` in `sync.js` is module-level state and does not survive page reloads**
`sync.js` line 17: `let failedKeys = new Set()`. After a page reload, any keys that failed to push are forgotten. `retryFailedPushes` (called on next successful pull) will only retry keys that failed *in the current session*. Keys that failed before a reload are silently abandoned. The existing roadmap lists this but it is an active data-loss risk when offline.

**BUG: `pullFromServer` merge strategy for object types uses `{ ...local, ...data }` (server wins)**
`sync.js` lines 86–88: `merged = { ...local, ...data }`. Server wins on all keys. If the user is offline on device A and makes changes, then device B makes different changes and pushes, when device A reconnects the pull will overwrite device A's changes with server's (device B's) version. For a single-user app this is probably fine, but if two sessions are open simultaneously (desktop + mobile), one session's data will clobber the other's. No conflict resolution exists.

---

## Audit-Found Issues: Detailed Findings by Area

### Active Workout

- 🐛 **`extractVideoId` is copy-pasted in two files** — `src/views/ActiveWorkoutView.jsx:387` and `src/components/ExerciseRow.jsx:113`. Neither handles Shorts URLs (`/shorts/ID`) or playlist URLs. Should be moved to `src/utils/youtube.js`.
- 🐛 **Rest timer re-fires when un-completing and re-completing a set** — `ActiveWorkoutView.jsx:88`. The guard only checks `!wasCompleted && newSetData.completed` which correctly skips already-complete sets, but toggling off then on again restarts the timer. Intentional or not, it's confusing when reviewing logged sets.
- 🐛 **Exercise note input uses `onBlur` to commit — collapses on iOS keyboard show/hide** — `ActiveWorkoutView.jsx:293`. Should commit on explicit "Done" or outside-tap, not raw blur.
- 🐛 **`LogSetRow` local state doesn't re-sync when `loggedSet` prop updates** — `LogSetRow.jsx:17–19`. Stale state if parent re-renders with changed prop values (e.g. after crash-recovery load).
- 🐛 **Crash-recovery "Resume" offered even when workout was deleted** — `App.jsx:100`. `session.logKey`'s workout may not exist in `workouts` anymore.
- 🐛 **Session note fires `saveLog` + `pushToServer` on every keystroke** — `ActiveWorkoutView.jsx:105`. Needs debounce.
- 💡 **"Last time" reference in set rows** — show what weight/reps were used for this exercise in the most recent completed log. High value for progressive overload decisions.
- 💡 **Quick weight adjust buttons** — `+2.5 / +5 / −5` taps on the weight field instead of typing.
- 💡 **Workout completion summary screen** — after finishing, show total volume, sets done, duration, PRs hit before returning to Training.
- 💡 **Auto-scroll to next set** after completing current set + starting rest timer.
- ✨ **Rest timer pause/resume** — currently only Skip. Tapping the timer face could pause it.
- ✨ **Back/swipe guard on iOS** — intercept browser back gesture during active workout to show the cancel modal instead of silently navigating away.
- ✨ **Set completion undo** — toggling the checkmark off is not discoverable. Long-press or a visible undo affordance would help.

### History

- 🐛 **Volume always labeled "lbs" regardless of unit** — `HistoryView.jsx:83`. Should be unit-aware or hidden for mixed-unit sessions.
- 🐛 **PR detection only tracks absolute max weight, ignores rep count** — `HistoryView.jsx:18–45`. 10 × 100 kg won't be flagged as a PR if the user ever lifted 105 kg for 1 rep.
- 💡 **"Last time" reference** — show previous session's reps/weight as a tooltip or inline hint when viewing the current session.
- 💡 **Filter/search history** — search by workout title or exercise name.
- 💡 **Export history as CSV** — let users pull all completed sessions as a spreadsheet.
- ✨ **PR badges per rep scheme** — track best weight for 1, 3, 5, 8, 10, 12, 15 reps separately.
- ✨ **Bodyweight rep PR** — for bodyweight exercises, track highest rep count achieved.

### Exercise History Drilldown

- 💡 **Sparkline / mini chart** — volume trend or max weight over time for this exercise.
- 💡 **PR indicator per session row** — highlight which set/session was a record.
- ✨ **Sort order toggle** — newest-first (current) vs oldest-first (to see progression).

### Library

- 🐛 **Notes draft may initialise stale on rapid re-open** — `LibraryView.jsx:473`. `exercise.notes` from memo may not have updated yet on fast double-tap.
- 🐛 **Bulk save has no toast** — `LibraryView.jsx:196`. `showToast` not available in `LibraryView`; only inline confirmation shown. Inconsistent with rest of app.
- ✨ **Show which workouts contain an exercise** — currently just the title with "History →". Adding "in 3 workouts" would be informative.
- ✨ **YouTube link preview thumbnail** — show a thumbnail image instead of the raw URL text.

### Templates

- 🐛 **Removing last exercise in the only block gives no feedback** — `TemplateEditorView.jsx:72–82`. `removeBlock` is blocked but user gets no feedback; "Save Template" silently does nothing if all exercises are untitled.
- 🐛 **Duplicate template names allowed** — `App.jsx:395`. Two templates with the same name break `templateList.find` in multiple places.
- 🐛 **Template rename doesn't update `th_schedule`** — `App.jsx:401–410`. Schedule entries keep the old name and become orphaned.
- 🐛 **`cloneBlock` reads dead field `repsLabel` instead of `repsUnit`** — `TemplateEditorView.jsx:458`. CSV-imported exercises missing `repsUnit` will default to `reps` even if they were parsed differently.
- 💡 **Template divergence warning in ActiveWorkout** — if the scheduled workout's template was edited since the session was created, show a banner.
- 💡 **Per-exercise rest duration** — override the global rest duration per exercise in the template editor.
- ✨ **Template search in picker modal** — already exists in WeekPlannerView, but not in the "Save as Template" flow from TrainingView.
- ✨ **Template preview shows part labels** — the Settings template preview (`SettingsView.jsx:376–384`) shows exercise list but no block/part grouping. Should show "Part A: Squat (4 sets), Part B: Leg Press (3 sets)..." with superset indication.

### Planner

- 🐛 **"Copy to Next Week" requires manual Apply Plan — not obvious** — `WeekPlannerView.jsx:134–165`. User sees filled week but needs a second tap. Should auto-apply or show clearer prompt.
- 🐛 **Partial draft clearing can delete workouts prematurely** — `App.jsx:138–150`. Multi-day clears in a single draft batch may evict shared workout objects too early.
- 💡 **Draft persistence across week navigation** — currently `goToPrevWeek`/`goToNextWeek` reset `draft` to `{}`. Unsaved changes are silently discarded.
- 💡 **Unsaved changes guard** — confirm dialog when leaving WeekPlannerView via NavBar with pending draft changes.
- 💡 **Rest day label** — allow explicitly marking a day as "Rest Day" (distinct from unscheduled).
- ✨ **Sticky "Apply Plan" button** — pin to bottom of viewport so it's always visible while scrolling the 7-day grid.
- ✨ **Tap scheduled workout name to navigate** — in WeekPlannerView, tapping the workout name for an *already applied* day navigates to it in TrainingView. Currently only works for non-draft days (`!isDrafted && onNavigateToDate`). Draft days should show a tooltip like "Apply plan first to navigate."

### Sync & Data

- 🐛 **Partial clear uses `localStorage.removeItem` instead of `removeLS`** — `App.jsx:351`. Server keeps deleted keys; pull on next startup restores them, undoing the clear.
- 🐛 **`failedKeys` not persisted across page reloads** — `sync.js:17`. Failed pushes are forgotten on reload; data may never reach the server.
- 🐛 **Sync merge is server-wins with no conflict UI** — `sync.js:86–88`. No notification when server data overwrites local changes.
- 💡 **Sync conflict UI** — lightweight banner: "X items restored from server" when pull overwrites local changes.
- 💡 **Failed push retry on reconnect** — persist `failedKeys` to localStorage under a `th_sync_failed` key; retry on next pull success.
- ✨ **Storage indicator live updates** — `storageUsage` in `SettingsView.jsx:69` only recalculates when `templateList` changes (line 84). It should also recalculate when logs or workouts change.

### Navigation

- 🐛 **No browser history integration** — `App.jsx:108`: `// TODO: Update browser history`. Browser back button doesn't work. On iOS PWA, swipe-back from Settings goes to the OS home screen, not the previous view.
- 🐛 **`ROUTE_EDIT_TEMPLATE` fallback duplicates all SettingsView props** — `App.jsx:417–456`. Maintenance hazard; two copies of sync/clear prop bindings.
- ✨ **Deep-link support** — hash-based routing (`#/history`, `#/library`) would allow sharing links to specific views and support browser back/forward.

### Import

- ✨ **Drag-and-drop CSV** — allow dragging a CSV file onto the ImportView drop zone instead of only a file picker button.
- ✨ **Import progress indicator** — for large CSVs, show a spinner during parse (currently synchronous).
- ✨ **Re-import warning** — when re-importing a CSV that already matches existing workout names, warn the user that the existing template/workout data will be overwritten (it silently updates today via `App.jsx:176–183`).

### Settings

- 🐛 **"Clear Data" with partial selection calls `localStorage.removeItem` not `removeLS`** — `App.jsx:351` (see Sync section).
- 🐛 **`showClearConfirm` modal is a raw `<div>`, not using `Modal` component** — `SettingsView.jsx:442`. No Escape-key close, no outside-click dismiss. Inconsistent with the rest of the app.
- 💡 **Theme selector** — dark-only today; a light/auto theme toggle would help.
- ✨ **Version display** — `SettingsView.jsx` hardcodes `v0.1.0` (line 426). Should read from `package.json` via Vite's `import.meta.env.VITE_APP_VERSION`.

### Accessibility & UX

- 🐛 **`Modal` component has no Escape handler or overlay dismiss** — `Modal.jsx`. Standard UX expectation; WCAG 2.1 SC 2.1.1.
- ✨ **Focus management** — when a modal opens, focus should move to it; when closed, focus should return to the trigger element.
- ✨ **Touch target sizes** — some small `btn-icon` and `btn-icon--small` buttons (e.g. set delete X in template editor) may be smaller than 44px, the iOS minimum recommended touch target.
- ✨ **Keyboard shortcut** — spacebar to toggle the current highlighted (next) set as complete during ActiveWorkout on desktop.

---

## Phase 1: Core Workout Logging (MVP)

### ActiveWorkoutView Implementation
- [x] Build SetRow component for active workout logging
- [x] Display target reps/weight as reference
- [x] Input fields for actual reps logged
- [x] Input field for actual weight used
- [x] Checkbox to mark set as complete
- [x] Visual feedback when complete (strikethrough, checkmark)
- [x] Implement session timer/elapsed time display
- [x] Build session header with workout name + elapsed time + cancel button
- [x] Add "Complete Workout" button that appears when all sets checked
- [x] Add crash recovery - session persists if browser closes
- [x] Add per-exercise notes input (optional notes during logging)
- [x] Track startedAt, completedAt timestamps in WorkoutLog
- [x] Auto-fill target reps/weight when marking a set complete
- [x] Unit-aware labels in set rows (shows "lb", "kg", "sec" etc. not just "Weight")
- [x] Bodyweight exercises hide the weight input
- [x] Highlight next incomplete set per exercise
- [x] Confirmation modal when finishing with incomplete sets

### HistoryView Implementation
- [x] List all completed workouts sorted by date (newest first)
- [x] Show: date, workout title, duration, list of exercises logged
- [x] Tap to expand and view full workout details with actual logged values
- [x] Show comparison: target vs actual for each set
- [x] Add delete button for individual logs (with confirm modal)

### LibraryView Implementation
- [x] Flatten all exercises from all workouts into single list
- [x] Group by exercise name (same exercise appears in multiple workouts)
- [x] Show YouTube link for each exercise (if set)
- [x] Quick edit YouTube link from library
- [x] Count: how many workouts contain this exercise
- [x] Search/filter by exercise name
- [x] Exercise history drilldown: tap an exercise to see all dates it was completed

---

## Phase 2: Calendar Enhancements

### Month View Calendar
- [x] Add toggle button in DateStrip (or separate view) to switch between week/month
- [x] Build full month calendar grid (7 columns, 6 rows)
- [x] Show workout dots/status per day (scheduled, completed, missed)
- [x] Tap day to select and load that workout in TrainingView
- [x] Month/year picker (jump to any month)
- [x] Highlight today visually
- [x] Show workouts on month cells (abbreviated, e.g. "Upper A")
- [x] Mobile responsive (ensure readable on small screens)

---

## Phase 3: Workout Templates & Weekly Planning

### Workout Templates Feature
- [x] Add "Save as Template" button on WorkoutPreviewCard
- [x] Store templates separately in localStorage: `th_templates` Map<templateId, TemplateWorkout>
- [x] Each template stores: { id, name, createdDate, blocks, notes }
- [ ] Update ImportView: offer option to "Save imported workouts as templates"
- [ ] Templates tab in LibraryView to browse all saved templates

### Weekly Planner
- [x] New view: "Planner" with dedicated nav tab
- [x] Display 7-day grid (Mon-Sun)
- [x] For each day:
  - Show currently scheduled workout (if any)
  - Button to pick a template from template library
  - Auto-populate that day's schedule with the template
  - Show workout name in the day cell
- [x] "Apply Plan" button to save the weekly plan to schedule
- [x] Draft mode: preview changes before applying (yellow highlight)
- [x] Option to recur plan (Copy to Next Week)
- [x] Clear week button
- [ ] Tap a day with an existing workout to navigate to that workout in TrainingView (partially implemented — blocked for drafts)

### Template Management
- [x] Settings page section for templates:
  - List all templates with expand/collapse
  - Rename template
  - Delete template (with confirm)
  - Preview template details (exercise list)
  - Duplicate template
- [x] Flexible set editor per exercise:
  - Reps/Time column label toggle
  - Unit selector at column header level (one unit per exercise)
  - Value column can be hidden (for sets/reps only exercises)
  - Adding a set copies the previous set's values
- [ ] Import templates from CSV (batch load multiple workouts as templates)
- [ ] Export templates as JSON for backup

---

## Phase 3.5: Superset Support

A **part** (code: `block`) can contain multiple exercises — these should be treated as a superset: performed back-to-back before resting. The data model already stores multiple exercises per block; UI support is partially in place.

### Display
- [x] Detect parts with 2+ exercises and render them as a grouped superset in WorkoutPreviewCard and TrainingView
- [x] Label superset parts visually ("Superset" badge) in TrainingView and ActiveWorkoutView
- [x] Single-exercise parts continue to render as today (no visual change)

### Active Workout Logging
- [x] In ActiveWorkoutView, present superset exercises grouped together under their part
- [ ] Log sets for each exercise in the superset in sequence (e.g. Exercise A set 1 → Exercise B set 1 → rest → repeat)
- [ ] Rest timer should trigger after completing all exercises in the superset, not after each individual exercise

### Templates & Manual Creation
- [x] When building or editing a template, allow adding a second (or third) exercise to a part to form a superset
- [ ] Show superset grouping in template preview in Settings

---

## Phase 4: Workout Timers

- [x] **Rest timer** — after completing a set, auto-starts a countdown; vibrates when done
- [x] **Haptic feedback** — short vibration when marking a set complete
- [x] **Rest duration setting** — global default (30s / 1min / 90s / 2min / 3min) in Settings
- [ ] **Audio cue** — optional beep/chime when rest timer ends (in addition to vibration)
- [ ] **Per-exercise rest duration** — override the global default on a per-exercise basis in the template editor
- [ ] **Timed set countdown** — for time-based exercises (unit = sec), auto-start a count-up or countdown when beginning a set; auto-complete when it hits zero
- [ ] **AMRAP / stopwatch** — count-up timer for open-ended sets
- [ ] **Rest timer pause/resume** — tap to pause mid-rest

---

## Phase 4.5: Logging Enhancements

### Session Notes & Metadata
- [ ] Add notes field per set (e.g., "felt weak", "RPE 8")
- [x] Add notes field per exercise (e.g., "elbow pain", "tempo felt good")
- [x] Add notes field for overall workout (e.g., "tired today", "great session")
- [x] Display notes in HistoryView when reviewing logs

### Weight/Strength Tracking
- [ ] Track 1-rep max (1RM) or estimated max per exercise
- [ ] Show progression graph: weight over time for each exercise
- [x] Display: total volume lifted per session (sum of reps × weight)
- [x] Show PR (personal record) indicators in history
- [ ] Fix PR logic to be rep-scheme-aware (5RM, 10RM, etc.)
- [ ] Fix volume label to be unit-aware (not always "lbs")

### Logging Quality of Life
- [ ] **"Last time" reference** — show previous logged reps/weight in each set row
- [ ] **Quick weight adjust** — +2.5 / +5 / −5 buttons on the weight input
- [ ] **Workout completion summary screen** — total volume, sets completed, duration, PRs hit
- [ ] **Swipe to complete** — swipe a set row right to mark it done (mobile gesture)

---

## Phase 5: Polish & Deployment

### UI/UX Polish
- [x] Responsive CSS tweaks for all breakpoints
- [ ] Add loading indicators for long operations
- [x] Add success toasts after save actions
- [x] Smooth transitions between views (fade-in)
- [ ] Keyboard shortcuts (spacebar to complete set)
- [x] Haptic feedback on mobile (vibrate on set complete)
- [ ] Fix `Modal` component: add Escape-key close + overlay click to dismiss
- [ ] Fix focus management when modals open/close

### Testing
- [x] Unit tests for CSV parser (Vitest) — 16 tests
- [x] Unit tests for date normalization — 8 tests
- [x] Unit tests for ExerciseData parsing edge cases — 16 tests
- [ ] Integration tests for import flow
- [ ] Manual testing on iOS Safari
- [ ] Manual testing on Android Chrome

### PWA & Installability
- [x] Create 192x192 and 512x512 app icons (SVG + PNG)
- [x] Updated service worker with network-first for code, cache-first for assets, versioned cache busting
- [ ] Test "Add to Home Screen" on iOS
- [ ] Test "Install App" on Android
- [ ] Verify offline functionality works
- [ ] Run Lighthouse PWA audit (aim for 100)

### Data Management
- [ ] Add data export: export logs as CSV
- [x] Add data backup: export all data as JSON
- [x] Add data import: restore from backup JSON
- [x] Settings page:
  - Storage usage indicator (how much localStorage used)
  - Clear all data button (with confirm)
  - View app version/build info
- [ ] Fix partial-clear to use `removeLS` instead of `localStorage.removeItem`

### Deployment (Synology NAS via Docker)
- [x] Docker Compose + nginx config for self-hosting
- [x] Build optimized production bundle: `npm run build`
- [ ] Deploy to Synology: copy repo, `npm run build && docker compose up -d`
- [ ] Set up reverse proxy / HTTPS on Synology (if accessing outside LAN)

---

## Phase 6: Landing Page

A public-facing landing page for the app — purpose and content TBD.

- [ ] Decide on audience and purpose (personal project showcase, invite others, etc.)
- [ ] Determine what to show: features, screenshots, install instructions, demo?
- [ ] Design and build the page (separate from the app itself or as a `/` route?)
- [ ] Decide on hosting (same NAS, GitHub Pages, or separate)

---

## Phase 7: Advanced Features (Future)

### Analytics & Insights
- [ ] Total volume by muscle group over time
- [ ] Average completion rate (% of planned workouts completed)
- [ ] Exercise frequency heatmap
- [ ] Strength progression trends
- [ ] Body weight tracking (if user logs it)

### Social (Optional)
- [ ] Share workout screenshots
- [ ] Export workout to image/PDF
- [ ] Share week plan with friend

### NAS Backend
- [x] Node/Express API server with JSON file storage
- [x] Offline-first sync layer (localStorage primary, background push/pull to server)
- [x] Sync status indicator in Settings (online/offline/checking)
- [x] Manual Pull/Push sync buttons in Settings
- [x] Docker Compose with API container + nginx proxy
- [x] YouTube link bulk importer (standalone GUI tool + CLI script)
- [ ] Sync across multiple devices (currently single-user)
- [ ] Data survives app reinstalls or browser clears
- [ ] Persist `failedKeys` across page reloads so retry works after reload
- [ ] Sync conflict notification UI

### Integrations (Future)
- [ ] Apple Health integration (export workouts)
- [ ] Google Fit integration
- [ ] Discord webhook for workout completion notifications

### Advanced Scheduling
- [ ] Recurring week templates (auto-schedule next week)
- [ ] Deload week suggestion (after 4 weeks of training)
- [ ] Auto-adjust weights based on rep performance

---

## Implementation Priority

**Critical Bugs (fix before beta):**
1. 🐛 Partial clear uses `localStorage.removeItem` not `removeLS` → data restored from server on next load (`App.jsx:351`)
2. 🐛 Template rename doesn't update `th_schedule` → orphaned schedule entries (`App.jsx:401`)
3. 🐛 Crash-recovery "Resume" offered when workout was deleted → shows "Workout not found" (`App.jsx:100`)
4. 🐛 Duplicate template names silently allowed → breaks planner picker (`App.jsx:395`)
5. 🐛 `cloneBlock` reads dead `repsLabel` field → repsUnit lost for CSV-imported exercises (`TemplateEditorView.jsx:458`)

**High Priority (next sprint):**
6. "Last time" reference in set rows (helps progressive overload every session)
7. Per-exercise rest duration in template editor
8. Workout completion summary screen + PR summary on finish
9. Fix PR logic to be rep-scheme-aware
10. Fix volume label (always shows "lbs")
11. Extract `extractVideoId` to shared util + support Shorts URLs
12. `Modal` component: add Escape key handler + overlay dismiss

**Medium Priority:**
13. Audio cue for rest timer end
14. Timed set countdown (for sec/time exercises)
15. Quick weight adjust buttons (+2.5 / +5 / −5)
16. Progression/volume trend chart per exercise (sparkline in ExerciseHistory)
17. Export logs as CSV
18. Swipe to complete set
19. Sticky "Apply Plan" button in WeekPlanner
20. Draft persistence across week navigation in WeekPlanner
21. Unsaved changes guard when navigating away from WeekPlanner
22. Persist `failedKeys` across reloads

**Low Priority (Future):**
23. Rest timer pause/resume
24. Auto-scroll to next set after completing
25. Set completion undo affordance
26. Sync conflict UI ("X items restored from server")
27. Deep-link / hash routing
28. Focus management for modals (accessibility)
29. Storage indicator live updates
30. Analytics
31. Social/sharing
32. Advanced scheduling
33. Health integrations

---

## Quick Reference: Key Files

| Area | File | Key Lines |
|------|------|-----------|
| Active workout logging | `src/views/ActiveWorkoutView.jsx` | 47–67 (init), 70–91 (set update), 111–118 (complete) |
| Set row component | `src/components/LogSetRow.jsx` | 17–29 (stale state init), 49–67 (auto-fill) |
| Rest timer | `src/components/RestTimer.jsx` | 8–16 (countdown effect) |
| PR detection | `src/views/HistoryView.jsx` | 16–45 (prMap), 87–96 (isSetPR) |
| Template editor | `src/views/TemplateEditorView.jsx` | 72–82 (removeExercise), 201–217 (handleSave) |
| Template clone | `src/views/TemplateEditorView.jsx` | 453–464 (cloneBlock, repsLabel bug) |
| Schedule clearing | `src/App.jsx` | 125–152 (handleSetWorkoutDate) |
| Template rename | `src/App.jsx` | 395–411 (onSave, schedule not updated) |
| Partial clear bug | `src/App.jsx` | 344–355 (uses removeItem not removeLS) |
| Sync pull merge | `src/storage/sync.js` | 81–95 (server-wins merge) |
| Sync failedKeys | `src/storage/sync.js` | 17 (in-memory, lost on reload) |
| YouTube video ID | `src/views/ActiveWorkoutView.jsx:387`, `src/components/ExerciseRow.jsx:113` | Duplicated, no Shorts support |
| NavBar route mixing | `src/components/NavBar.jsx` | 12–16 (ROUTE_PLANNER vs TAB_*) |

---

## Notes

- All data persists in localStorage (offline-first) with background sync to NAS backend
- NAS backend stores JSON files in a Docker volume — data survives browser clears
- iOS may evict PWA localStorage after ~7 days of inactivity; NAS sync mitigates this
- Weekly planner doesn't auto-sync future dates; user confirms before applying
- Performance should be fine until 1000+ workouts or 5000+ logs
- `th_settings` is device-local (not synced to server) — intentional for per-device preferences

---

## Potential Features (Beta Discussion)

Features surfaced by end-to-end flow audit — discuss before beta release.

### Active Workout
- **Workout completion summary screen** — after finishing, show total volume, sets completed, duration, and any PRs hit before returning to Training view (reinforces accomplishment)
- **Swipe-to-complete sets** — horizontal swipe on a set row to mark done with auto-fill (native fitness app feel on mobile)
- **Auto-scroll to next set** — after completing a set and starting rest timer, scroll to next incomplete set so it's ready when timer ends
- **Set completion undo affordance** — long-press completed set or visible "undo" button (currently toggling the checkmark is not discoverable)
- **Rest timer pause/resume** — tap timer to pause mid-rest (e.g., if interrupted); currently only supports Skip
- **Per-exercise rest duration** — override global rest setting per exercise in template editor (e.g., 2 min for squats, 45s for curls); stored as `restDuration` field on exercise object
- **Template divergence warning** — if the workout being logged differs from its source template (template was edited since schedule was set), show a banner in ActiveWorkoutView
- **Back/swipe guard** — intercept iOS swipe-back during an active workout to show the cancel modal instead of silently leaving

### Strength & Progress Tracking
- **Rep-based PR tracking** — track best weight per rep count (1RM, 5RM, 10RM) instead of just absolute max; badge new per-rep-scheme records
- **Bodyweight rep PR tracking** — for exercises with no weight, track highest rep count over time and badge new rep maxes
- **Volume trend + max weight sparkline** — show a mini chart in the ExerciseHistory drilldown so users can see progress at a glance
- **PR summary on workout completion** — list PRs achieved in that session on the completion screen
- **PR indicators in ExerciseHistory drilldown** — highlight which session/set was a record in the exercise history table

### Scheduling & Planner
- **Sticky "Apply Plan" button** — pin to bottom of viewport in WeekPlanner so it stays visible while scrolling the 7-day grid
- **Draft persistence across week navigation** — keep unsaved planner drafts when navigating prev/next week
- **Unsaved changes guard** — confirm dialog when leaving WeekPlanner via NavBar while there are unsaved drafts
- **Rest day label** — allow explicitly marking a planner day as "Rest Day" (distinct from blank/unscheduled)
- **MonthCalendar auto-follows currentDate** — when user taps Today in DateStrip while month view is open, auto-navigate the calendar to the correct month
- **Schedule healing after template rename/delete** — automatically update or nullify `th_schedule` entries when a template is renamed or deleted

### Sync & Data
- **Sync conflict UI** — lightweight notification when server-wins merge restores something the user deleted while offline ("3 items restored from server")
- **Failed push retry on reconnect** — persist `failedKeys` across page reloads and retry automatically when server is reachable again
- **Storage indicator live updates** — subscribe to sync events to refresh the byte count in Settings in real time
- **Export logs as CSV** — let users pull their full history as a spreadsheet

---

## Questions for User

- Should templates auto-update when editing an original imported workout?
- Should weekly planner show predicted dates or let user pick specific dates?
- Should we show "add to calendar" vs "replace calendar" when planning a week?
- Should templates include YouTube links or just exercise structure?
- For bodyweight exercises, should we track rep PRs separately from weighted PRs?
- Should completing a workout always show a summary screen, or only when PRs were hit?
- Should the "Clear Data" partial-clear use `removeLS` (sync-aware) instead of `removeItem` directly? (Current answer: yes, it's a bug)
- Should completing a workout with 0 sets logged be blocked, or allowed (e.g. as a notes-only/missed session)?
- Should iOS swipe-back during an active workout trigger the cancel confirmation modal, or silently leave?
- Crash recovery: if the template was edited after the in-progress session started, should we reconcile the new exercise list or log against the old snapshot?
- Template rename/delete: auto-update orphaned schedule entries, or prompt the user to re-assign affected days?
- Should "Copy to Next Week" auto-apply, or keep the current draft-then-apply flow?
- Should duplicate template names be blocked outright, or just warned?
