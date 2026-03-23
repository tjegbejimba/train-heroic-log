
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

🚧 **Next Up:**
- Manual device testing, Lighthouse audit, deployment

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
- [ ] Exercise history drilldown: tap an exercise to see all dates it was completed, with actual reps and weight logged per set

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
- [ ] (Maybe) Tap a day with an existing workout to navigate to that workout in TrainingView

### Template Management
- [x] Settings page section for templates:
  - List all templates with expand/collapse
  - Rename template
  - Delete template (with confirm)
  - Preview template details (exercise list)
  - Duplicate template
- [ ] Import templates from CSV (batch load multiple workouts as templates)
- [ ] Export templates as JSON for backup

---

## Phase 4: Logging Enhancements

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

---

## Phase 5: Polish & Deployment

### UI/UX Polish
- [x] Responsive CSS tweaks for all breakpoints
- [ ] Add loading indicators for long operations
- [x] Add success toasts after save actions
- [x] Smooth transitions between views (fade-in)
- [ ] Keyboard shortcuts (optional: spacebar to complete set)
- [ ] Haptic feedback on mobile (vibrate on set complete)

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

## Phase 6: Advanced Features (Future)

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

### NAS Backend (Future)
- [ ] Add a lightweight backend (e.g., Node/Express or SQLite) hosted on Synology NAS
- [ ] Store workout logs server-side instead of localStorage — eliminates iOS eviction risk
- [ ] Sync across multiple devices
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

**High Priority (MVP):**
1. ActiveWorkoutView (blocking live logging)
2. HistoryView (see completed workouts)
3. Month view calendar (user requested)
4. Workout templates (user requested)
5. Weekly planner (user requested)

**Medium Priority (Polish):**
6. LibraryView (nice to have, not blocking)
7. Session timer
8. Workout notes
9. CSS polish & responsiveness
10. PWA icons & testing

**Low Priority (Future):**
11. Data export
12. Analytics
13. Advanced scheduling

---

## Quick Reference: Files to Create/Modify

### For ActiveWorkoutView
- `src/components/SetRow.jsx` — NEW: Display + log a single set
- `src/components/SessionHeader.jsx` — NEW: Timer + cancel button
- `src/views/ActiveWorkoutView.jsx` — MODIFY: Implement full UI
- `src/styles/active-workout.css` — NEW: Styling

### For Templates & Planner
- `src/hooks/useTemplates.js` — NEW: Hook for template CRUD
- `src/views/WeekPlannerView.jsx` — NEW: Weekly planning UI
- `src/views/TemplatesView.jsx` — NEW: Browse/manage templates
- `src/components/TemplatePicker.jsx` — NEW: Modal to select template
- `src/constants.js` — MODIFY: Add LS_TEMPLATES key

### For Month View
- `src/components/MonthCalendar.jsx` — NEW: Full month grid
- `src/components/CalendarToggle.jsx` — NEW: Week/Month toggle button
- `src/views/TrainingView.jsx` — MODIFY: Add month view option

### Styling
- `src/styles/calendar.css` — NEW: Month calendar styles
- `src/styles/planner.css` — NEW: Planner styles
- `src/styles/templates.css` — NEW: Template browser styles

---

## Notes

- All data persists in localStorage — no backend needed
- Templates are local to browser; not synced to cloud
- iOS may evict PWA localStorage after ~7 days of inactivity if device storage is low; consider NAS backend (see Phase 6) as a long-term solution
- Weekly planner doesn't auto-sync future dates; user confirms before applying
- Performance should be fine until 1000+ workouts or 5000+ logs

---

## Questions for User

- Should templates auto-update when editing an original imported workout?
- Should weekly planner show predicted dates or let user pick specific dates?
- Should we show "add to calendar" vs "replace calendar" when planning a week?
- Should templates include YouTube links or just exercise structure?

