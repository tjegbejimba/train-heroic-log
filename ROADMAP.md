# TrainLog Roadmap

## Current Status
✅ **MVP Core Complete:**
- CSV import with parsing
- Date strip calendar (week view)
- Workout detail view with exercises
- YouTube link management per exercise
- localStorage persistence
- PWA setup with service worker

🚧 **In Progress:**
- ActiveWorkoutView (live set logging)
- Other views (History, Library)

---

## Phase 1: Core Workout Logging (MVP)

### ActiveWorkoutView Implementation
- [ ] Build SetRow component for active workout logging
  - Display target reps/weight as reference
  - Input fields for actual reps logged
  - Input field for actual weight used
  - Checkbox to mark set as complete
  - Visual feedback when complete (strikethrough, checkmark)
- [ ] Implement session timer/elapsed time display
- [ ] Build session header with workout name + elapsed time + cancel button
- [ ] Add "Complete Workout" button that appears when all sets checked
- [ ] Add crash recovery - session persists if browser closes
- [ ] Add per-exercise notes input (optional notes during logging)
- [ ] Track startedAt, completedAt timestamps in WorkoutLog

### HistoryView Implementation
- [ ] List all completed workouts sorted by date (newest first)
- [ ] Show: date, workout title, duration, list of exercises logged
- [ ] Tap to expand and view full workout details with actual logged values
- [ ] Show comparison: target vs actual for each set
- [ ] Add delete button for individual logs (with confirm modal)

### LibraryView Implementation
- [ ] Flatten all exercises from all workouts into single list
- [ ] Group by exercise name (same exercise appears in multiple workouts)
- [ ] Show YouTube link for each exercise (if set)
- [ ] Quick edit YouTube link from library
- [ ] Count: how many workouts contain this exercise
- [ ] Search/filter by exercise name

---

## Phase 2: Calendar Enhancements

### Month View Calendar
- [ ] Add toggle button in DateStrip (or separate view) to switch between week/month
- [ ] Build full month calendar grid (7 columns, 6 rows)
- [ ] Show workout dots/status per day (scheduled, completed, missed)
- [ ] Tap day to select and load that workout in TrainingView
- [ ] Month/year picker (jump to any month)
- [ ] Highlight today visually
- [ ] Show workouts on month cells (abbreviated, e.g. "Upper A")
- [ ] Mobile responsive (ensure readable on small screens)

---

## Phase 3: Workout Templates & Weekly Planning

### Workout Templates Feature
- [ ] Add "Save as Template" button on WorkoutDetailView
- [ ] Create TemplateView/modal to name and save current workout as template
- [ ] Store templates separately in localStorage: `th_templates` Map<templateId, TemplateWorkout>
- [ ] Each template stores: { id, name, createdDate, blocks, exercises, externalNotes }
- [ ] Update ImportView: offer option to "Save imported workouts as templates"
- [ ] Templates tab in LibraryView to browse all saved templates

### Weekly Planner
- [ ] New view: "PlanWeek" or "Planner"
- [ ] Display 7-day grid (Mon-Sun)
- [ ] For each day:
  - Show currently scheduled workout (if any)
  - Button to pick a template from template library
  - Auto-populate that day's schedule with the template
  - Show workout name in the day cell
- [ ] "Apply Plan" button to save the weekly plan to schedule
- [ ] Preview mode: see the full week before committing
- [ ] Option to recur plan (apply same template pattern to next week)
- [ ] Clear week button

### Template Management
- [ ] Settings page section for templates:
  - List all templates with edit/delete buttons
  - Rename template
  - Delete template (with confirm)
  - Preview template details
  - Duplicate template
- [ ] Import templates from CSV (batch load multiple workouts as templates)
- [ ] Export templates as JSON for backup

---

## Phase 4: Logging Enhancements

### Session Notes & Metadata
- [ ] Add notes field per set (e.g., "felt weak", "RPE 8")
- [ ] Add notes field per exercise (e.g., "elbow pain", "tempo felt good")
- [ ] Add notes field for overall workout (e.g., "tired today", "great session")
- [ ] Display notes in HistoryView when reviewing logs

### Weight/Strength Tracking
- [ ] Track 1-rep max (1RM) or estimated max per exercise
- [ ] Show progression graph: weight over time for each exercise
- [ ] Display: total volume lifted per session (sum of reps × weight)
- [ ] Show PR (personal record) indicators in history

---

## Phase 5: Polish & Deployment

### UI/UX Polish
- [ ] Responsive CSS tweaks for all breakpoints
- [ ] Add loading indicators for long operations
- [ ] Add success toasts after save actions
- [ ] Smooth transitions between views
- [ ] Keyboard shortcuts (optional: spacebar to complete set)
- [ ] Haptic feedback on mobile (vibrate on set complete)

### Testing
- [ ] Unit tests for CSV parser (Vitest)
- [ ] Unit tests for date normalization
- [ ] Unit tests for ExerciseData parsing edge cases
- [ ] Integration tests for import flow
- [ ] Manual testing on iOS Safari
- [ ] Manual testing on Android Chrome

### PWA & Installability
- [ ] Create 192x192 and 512x512 app icons
- [ ] Test "Add to Home Screen" on iOS
- [ ] Test "Install App" on Android
- [ ] Verify offline functionality works
- [ ] Run Lighthouse PWA audit (aim for 100)

### Data Management
- [ ] Add data export: export logs as CSV
- [ ] Add data backup: export all data as JSON
- [ ] Add data import: restore from backup JSON
- [ ] Settings page:
  - Storage usage indicator (how much localStorage used)
  - Clear all data button (with confirm)
  - Reset to factory defaults
  - View app version/build info

### Deployment
- [ ] Build optimized production bundle: `npm run build`
- [ ] Deploy to Netlify (recommended: auto-deploy from GitHub)
- [ ] Deploy to Vercel as alternative
- [ ] Set up GitHub Actions for automated builds
- [ ] Create public landing page on GitHub README
- [ ] Share link for user testing

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
- Weekly planner doesn't auto-sync future dates; user confirms before applying
- Performance should be fine until 1000+ workouts or 5000+ logs

---

## Questions for User

- Should templates auto-update when editing an original imported workout?
- Should weekly planner show predicted dates or let user pick specific dates?
- Should we show "add to calendar" vs "replace calendar" when planning a week?
- Should templates include YouTube links or just exercise structure?

