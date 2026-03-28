# History & Library Flow — Agent Findings

## Bugs Fixed

### 1. PR badge fires on every set at max weight, not just the first one
- **File:** `src/views/HistoryView.jsx` lines 86–94, 211
- **Problem:** `isSetPR` only checked `logKey` and `weight`, so if a user performed 3 sets at a new PR weight, all 3 sets showed the PR badge. Only the first (chronologically first within the session) set should display it.
- **Fix:** `prMap` now also stores `setIdx` (the index within the exercise's set array where the max weight was first hit). `isSetPR` receives `setIdx` and adds `setIdx === pr.setIdx` to the condition. The call site `sets.map((set, idx) => ...)` passes `idx`.

### 2. ExerciseHistoryView date can show wrong day for negative UTC-offset users
- **File:** `src/views/ExerciseHistoryView.jsx` line 43
- **Problem:** Date was constructed with `T00:00:00` (local midnight). On devices with a negative UTC offset (e.g., UTC-5), `new Date('2025-03-15T00:00:00')` is midnight local, which is correct, but the rest of the app uses `T12:00:00` (noon) as a timezone-safe anchor. Inconsistency meant any timezone-related off-by-one surfaced here first.
- **Fix:** Changed to `T12:00:00` to match `HistoryView.jsx`'s `formatDate` and eliminate any timezone edge case.

### 3. Bulk YouTube import stores link under user-typed case, not canonical exercise case
- **File:** `src/views/LibraryView.jsx` lines 154–165
- **Problem:** When a user used the pipe format (`Exercise Name | URL`), the code checked `exerciseNames.some(n => n.toLowerCase() === manualName.toLowerCase())` to verify the name exists, but then stored `manualName` as the `matchedExercise` key. If the user typed "bench press" but the exercise is stored as "Bench Press", the link was saved under "bench press" — which `youtubeLinks[exercise.title]` (always the canonical case) would never find.
- **Fix:** Changed to `exerciseNames.find(...)` to retrieve the canonical name and use that as `matchedExercise`, so the saved key always matches the app's lookup key.

### 4. Stale docstring in useYouTubeLinks
- **File:** `src/hooks/useYouTubeLinks.js` line 4
- **Problem:** Comment stated `ExerciseKey format: "WorkoutTitle::ExerciseTitle"`, which was the old compound-key format. The actual format in use throughout the app is just the exercise title (a plain string). `constants.js` confirms: `makeExerciseKey = (exerciseTitle) => exerciseTitle`. A stale docstring like this can mislead future developers into using the wrong key format.
- **Fix:** Updated comment to `ExerciseKey format: exercise title (plain string, globally unique per exercise)`.

---

## Bugs Found (not fixed)

### 5. PR detection ignores bodyweight (weight=0 / empty) sets entirely
- **File:** `src/views/HistoryView.jsx` line 27–29
- `if (!set.actualWeight || set.actualWeight === '') return;` and `if (isNaN(w) || w <= 0) return;` mean that bodyweight exercises never have a PR badge, even when a user logs a higher rep count than ever before. A user who does push-ups and hits a new rep max gets no acknowledgment.
- This is a design call: a rep-based PR system would need a separate tracking dimension (best reps at bodyweight). Left unfixed because changing the PR model is a larger feature, not a one-line correction.

### 6. PR model is weight-only (no per-rep-count PR tracking)
- **File:** `src/views/HistoryView.jsx` `prMap` computation
- The PR map tracks only the single all-time heaviest weight per exercise, ignoring rep count. A "10-rep max" vs "1-rep max" distinction is common in strength training. The current model marks any set that matches the all-time heaviest weight as a PR, even if done for fewer reps in a later session. This is a design limitation rather than a crash bug.

### 7. allLogs same-day sort order is non-deterministic
- **File:** `src/hooks/useWorkoutLogs.js` lines 56–60
- When two workouts are logged on the same date, sort falls back to `Object.entries` order (insertion order), which varies. For users who do morning and evening workouts on the same day, display order may shuffle across sessions. A secondary sort on `log.startedAt` or `log.completedAt` would make this stable.

---

## UX Issues

### 8. No PR badge for "first ever" non-weight sets
- Bodyweight exercises logged for the first time are factually PRs but are completely invisible in the PR system. Even a simple message "first logged" for bodyweight sets on the first session would add value.

### 9. Volume stat silently omits bodyweight sets
- `calcVolume` skips sets where `actualWeight` is empty or zero. The meta line shows volume only when `vol > 0`. A workout consisting entirely of bodyweight exercises shows no volume stat at all, which can be confusing — users may think the stat is broken.

### 10. ExerciseHistoryView has no PR indicators
- The exercise history drilldown shows raw set data but provides no indication of which session or set was a PR. Users drilling into an exercise to review progress have no visual highlight.

### 11. Library notes edit does not block navigation
- If a user begins editing notes in the library and taps a different exercise's "History" button, `editingNotes` state is left set. When they return to the library, the previous exercise's notes textarea is still open. Both `editingNotes` and `editingLink` have this trait — tap away resets neither.

---

## Suggested Features (for roadmap)

- **Rep-based PR tracking**: Track best weight *per rep count* per exercise (e.g., 1RM, 5RM, 10RM) so users see PRs relative to rep schemes, not just absolute max weight.
- **Bodyweight/rep PR tracking**: For exercises with no weight, track the best rep count over time and badge new rep maxes.
- **Volume trend chart in ExerciseHistory**: Show a sparkline of total volume (or max weight) over time for each exercise in the drilldown view.
- **Workout note in ExerciseHistory**: Surface the per-session exercise note alongside the set table so users can see their own coaching comments in context.
- **PR summary card on workout completion**: After completing a workout, show a summary of any PRs achieved in that session before returning to Training view.
