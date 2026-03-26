
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

## Phase 1: Core Workout Logging (MVP)

### ActiveWorkoutView Implementation
- [x] Build SetRow component for active workout logging
  - Display target reps/weight as reference
  - Input fields for actual reps logged
  - Input field for actual weight used
  - Checkbox to mark set as complete
  - Visual feedback when complete (strikethrough, checkmark)
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
- [x] Exercise history drilldown: tap an exercise to see all dates it was completed, with actual reps and weight logged per set

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
- [ ] Tap a day with an existing workout to navigate to that workout in TrainingView

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

A **part** (code: `block`) can contain multiple exercises — these should be treated as a superset: performed back-to-back before resting. The data model already stores multiple exercises per block; what's missing is UI support.

### Display
- [ ] Detect parts with 2+ exercises and render them as a grouped superset in WorkoutPreviewCard and TrainingView
- [ ] Label superset parts visually (e.g. "Superset" badge, bracket grouping, or alternating indent)
- [ ] Single-exercise parts continue to render as today (no visual change)

### Active Workout Logging
- [ ] In ActiveWorkoutView, present superset exercises grouped together under their part
- [ ] Log sets for each exercise in the superset in sequence (e.g. Exercise A set 1 → Exercise B set 1 → rest → repeat)
- [ ] Rest timer (if added) should trigger after completing all exercises in the superset, not after each individual exercise

### Templates & Manual Creation
- [ ] When building or editing a template, allow adding a second (or third) exercise to a part to form a superset
- [ ] Show superset grouping in template preview in Settings

---

## Phase 4: Workout Timers

Timers during an active session to support rest periods, timed sets, and countdowns.

- [x] **Rest timer** — after completing a set, auto-starts a countdown; vibrates when done
- [x] **Haptic feedback** — short vibration when marking a set complete
- [x] **Rest duration setting** — global default (30s / 1min / 90s / 2min / 3min) in Settings
- [ ] **Audio cue** — optional beep/chime when rest timer ends (in addition to vibration)
- [ ] **Per-exercise rest duration** — override the global default on a per-exercise basis in the template editor
- [ ] **Timed set countdown** — for time-based exercises (unit = sec), auto-start a count-up or countdown when beginning a set; auto-complete when it hits zero
- [ ] **AMRAP / stopwatch** — count-up timer for open-ended sets
- [ ] Timer visible and controllable without leaving the current set row

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

### Logging Quality of Life
- [ ] **"Last time" reference** — show previous logged reps/weight in each set row as a reference (great for progressive overload decisions)
- [ ] **Quick weight adjust** — +2.5 / +5 / −5 buttons on the weight input instead of always typing
- [ ] **Workout completion summary screen** — after finishing, show a summary card: total volume, sets completed, duration, PRs hit
- [ ] **Swipe to complete** — swipe a set row right to mark it done (mobile gesture)

---

## Phase 5: Polish & Deployment

### UI/UX Polish
- [x] Responsive CSS tweaks for all breakpoints
- [ ] Add loading indicators for long operations
- [x] Add success toasts after save actions
- [x] Smooth transitions between views (fade-in)
- [ ] Keyboard shortcuts (optional: spacebar to complete set)
- [x] Haptic feedback on mobile (vibrate on set complete)

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

**High Priority (next up):**
1. "Last time" reference in set rows (helps with progressive overload every session)
2. Per-exercise rest duration in template editor
3. Workout completion summary screen + PR summary on finish
4. Audio cue for rest timer end
5. Timed set countdown (for sec/time exercises)
6. Schedule healing after template rename/delete (data correctness bug — orphans schedule entries)
7. MonthCalendar follow currentDate prop (month view doesn't sync when user taps Today)

**Medium Priority:**
8. Quick weight adjust buttons (+2.5 / +5 / −5)
9. Progression/volume trend chart per exercise (sparkline in ExerciseHistory drilldown)
10. Rep-based PR tracking (5RM, 10RM, etc.) + bodyweight rep PR badges
11. Export logs as CSV
12. Swipe to complete set
13. Sticky "Apply Plan" button in WeekPlanner
14. Draft persistence across week navigation in WeekPlanner
15. Unsaved changes guard when navigating away from WeekPlanner

**Low Priority (Future):**
16. Rest timer pause/resume
17. Auto-scroll to next set after completing
18. Set completion undo affordance
19. Sync conflict UI ("X items restored from server")
20. Failed push retry on reconnect (persist failedKeys across reloads)
21. Analytics
22. Social/sharing
23. Advanced scheduling
24. Health integrations

---

## Quick Reference: Files to Create/Modify

### For ActiveWorkoutView
- `src/components/LogSetRow.jsx` — set logging row (auto-fill, haptic, unit labels)
- `src/components/RestTimer.jsx` — rest countdown timer
- `src/views/ActiveWorkoutView.jsx` — full session view
- `src/styles/active-workout.css` — styling
- `src/hooks/useSettings.js` — device-local preferences (rest duration, etc.)

### For Templates & Planner
- `src/hooks/useTemplates.js` — Hook for template CRUD
- `src/views/WeekPlannerView.jsx` — Weekly planning UI
- `src/views/TemplatesView.jsx` — Browse/manage templates
- `src/components/TemplatePicker.jsx` — Modal to select template
- `src/views/TemplateEditorView.jsx` — Edit template blocks/exercises/sets
- `src/constants.js` — Add LS_TEMPLATES key

### For Month View
- `src/components/MonthCalendar.jsx` — Full month grid
- `src/components/CalendarToggle.jsx` — Week/Month toggle button
- `src/views/TrainingView.jsx` — Add month view option

### Styling
- `src/styles/calendar.css` — Month calendar styles
- `src/styles/planner.css` — Planner + Settings styles
- `src/styles/active-workout.css` — Session + timer styles

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
- Should the "Clear Data" partial-clear use removeLS (sync-aware) instead of removeItem directly?
