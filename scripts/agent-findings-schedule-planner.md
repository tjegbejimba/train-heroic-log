# Schedule & Planner Flow — Agent Findings

## Bugs Fixed

### 1. Timezone bug: `toISOString()` returns wrong date for users in UTC- timezones after ~8pm local time
- **Root cause**: `new Date().toISOString()` always returns the UTC date. For a user in UTC-5 at 10pm local time, UTC is already the next day, so `toISOString().split('T')[0]` returns tomorrow's date as "today".
- **Affected files / lines**:
  - `src/App.jsx:72` — initial `currentDate` state
  - `src/components/DateStrip.jsx:56` — `goToToday()` callback
  - `src/components/DateStrip.jsx:100` — inline `today` inside `week.map()`
  - `src/components/MonthCalendar.jsx:79` — `goToToday()` callback
  - `src/components/MonthCalendar.jsx:104` — inline `today` for status indicators
  - `src/views/WeekPlannerView.jsx:44` — `today` constant used for "This Week" nav and today-highlight
- **Fix**: Replaced all `new Date().toISOString().split('T')[0]` calls with a local-date formatter using `getFullYear()`, `getMonth()`, `getDate()`. The `today` constant in `DateStrip` was also moved outside the `.map()` loop (was being recomputed on every iteration).

### 2. `MonthCalendar`: redundant double-negative in `isPast` expression
- **File**: `src/components/MonthCalendar.jsx:182`
- **Before**: `const isPast = dateStr < today && dateStr !== today;`
- **After**: `const isPast = dateStr < today;`
- **Why**: If `dateStr < today` is true (string comparison on ISO dates), `dateStr !== today` is trivially true. The extra condition added noise and could mislead readers into thinking edge cases existed.

### 3. `MonthCalendar`: missed-indicator expression always evaluated the redundant branch
- **File**: `src/components/MonthCalendar.jsx:204`
- **Before**: `{isCompleted ? '✓' : isCompleted === false && isPast ? '✗' : '•'}`
- **After**: `{isCompleted ? '✓' : isPast ? '✗' : '•'}`
- **Why**: `isCompleted` is the result of `completedDates.has(dateStr)` — a boolean. Inside the `!isCompleted` ternary branch, `isCompleted` is always `false`, so `isCompleted === false` is always `true` and contributed nothing. The simplified form is equivalent and clearer.

### 4. `WeekPlannerView.repeatNextWeek`: skipped days left with stale next-week schedule entries
- **File**: `src/views/WeekPlannerView.jsx:149-153`
- **Before**: When a current-week day has a workout whose name matches no template (skipped), the corresponding next-week date was silently left out of the draft — meaning whatever was previously scheduled on that next-week day was not overwritten. This created an inconsistent copy where rest-day entries were explicitly cleared but skipped-workout entries were silently preserved.
- **After**: Skipped days now also receive `newDraft[nextDate] = null`, so the copy is consistent: every day of the destination week is explicitly set (either to a template ID or to null/rest). The skipped-count toast is still shown.

---

## Bugs Found (not fixed)

### 5. `TrainingView` passes `setWorkoutDate` as a prop but never uses it
- **File**: `src/App.jsx:207` — `setWorkoutDate={setWorkoutDate}` is passed to `TrainingView`
- **File**: `src/views/TrainingView.jsx:9-22` — `TrainingView` does not declare `setWorkoutDate` in its props list, and never calls it
- The stale prop is harmless (React ignores extra props) but indicates dead code from a refactor that wasn't cleaned up.

### 6. `WeekPlannerView`: `today` is computed at component render time (module scope inside the function)
- **File**: `src/views/WeekPlannerView.jsx:44-45`
- `today` is computed once when the component first renders and never recalculates. If a user leaves the app open past midnight, the "today" highlight and "This Week" logic will show the wrong day until they reload. (Same issue was fixed in DateStrip by moving `today` computation into a component-level `const` that still re-evaluates on re-renders — but a `useMemo` with a daily timer would be the ideal long-term fix for all components.)

### 7. `MonthCalendar`: `displayMonth` does not sync when `currentDate` prop changes from outside
- **File**: `src/components/MonthCalendar.jsx:14-17`
- `displayMonth` is initialized from `currentDate` once, but if the parent sets `currentDate` to a date in a different month (e.g., user clicks "Today" in the parent's `DateStrip` while the month view is open), `displayMonth` stays on the old month. The user would have to manually navigate months to find the selected date.
- **Suggested fix**: Add a `useEffect` that updates `displayMonth` when `currentDate` changes to a month outside the currently displayed month.

### 8. `WeekPlannerView`: draft is silently lost on week navigation
- **File**: `src/views/WeekPlannerView.jsx:53-65` (`goToPrevWeek`, `goToNextWeek`, `goToThisWeek`)
- When the user navigates to another week while `hasDraftChanges` is true, `setDraft({})` discards all unsaved changes without warning. The user can accidentally lose a week of planned changes by clicking "Prev" or "Next" while "Apply Plan" is visible.

### 9. `WeekPlannerView`: workout navigation disabled for drafted days even when draft matches current schedule
- **File**: `src/views/WeekPlannerView.jsx:213`
- `onClick={() => !isDrafted && onNavigateToDate(dateStr)}` — if a day is in the draft (even if its template happens to match what's already saved), the navigation button becomes a no-op. A user who opens the template picker and immediately cancels without selecting anything would still find the "go to workout" link dead until they Apply or navigate away.

---

## UX Issues

### U1. DateStrip shows no explicit left/right navigation arrows
- The strip is horizontally scrollable but has no prev/next buttons. On mobile, if a user navigates to a date far in the past or future via the month calendar and then switches back to week view, the strip re-centers on the selected date (thanks to `scrollIntoView`) — this works but is non-obvious. Consider adding chevron buttons for +1/-1 day navigation.

### U2. Month calendar "▾" caret on the `DateStrip` header is decorative, not interactive
- **File**: `src/components/DateStrip.jsx:81`
- The `▾` next to the month/year label looks like a dropdown trigger but clicking it does nothing (clicking the calendar toggle button is elsewhere). The `▾` is inside the `<h2>` with no handler. This can confuse users who expect it to open the month picker.

### U3. "Copy to Next Week" always navigates the view to next week — no confirmation
- After `repeatNextWeek()`, the view jumps to next week and the full draft is displayed. There is no preview or undo. A user who accidentally clicks "Copy to Next Week" must navigate back and manually clear the draft (or navigate away to lose it).

### U4. Clear Week modal mentions "Apply Plan" in its message, but the button only appears when `hasDraftChanges`
- **File**: `src/views/WeekPlannerView.jsx:333`
- After "Clear Week", `hasDraftChanges` becomes true and "Apply Plan" appears. The modal message correctly says "You'll need to Apply Plan to save changes." This is accurate but may be confusing if users don't notice the new button appearing below after dismissing the modal.

### U5. "Change" button appears on drafted days even when the day already has a draft assignment
- When a day has a draft workout, the button label still reads "Change" (same as non-drafted days with an assigned workout). No visual cue distinguishes "this is a saved assignment" from "this is an unsaved draft assignment" beyond the `planner-day--draft` card styling.

---

## Suggested Features (for roadmap)

- **Sticky "Apply Plan" button**: Move the "Apply Plan" button to a fixed position at the bottom of the viewport (above the nav bar) so it remains visible as the user scrolls through the 7-day grid.
- **Draft persistence across week navigation**: Store drafts keyed by week (e.g., `{ 'week-2024-W03': { ...draftForThatWeek } }`) so unsaved changes survive prev/next week navigation without warning the user.
- **Unsaved changes guard**: Show a confirmation dialog when the user navigates away from WeekPlannerView (via the NavBar) while `hasDraftChanges` is true.
- **"Apply & go to week" shortcut**: After "Copy to Next Week", offer a single-tap "Apply" confirmation so the user can confirm and save the next week's plan in one action instead of two.
- **MonthCalendar follows currentDate**: When `currentDate` prop changes to a different month (e.g., tapping TODAY in DateStrip while month view is open), auto-navigate the month calendar display to match, eliminating the need for the user to manually page to find the selected date.
- **Rest day label in planner**: Allow marking a day explicitly as "Rest Day" (distinct from "no workout scheduled") to differentiate intentional rest from unplanned omission in the planner grid.
