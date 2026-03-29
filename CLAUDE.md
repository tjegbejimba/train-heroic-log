# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (http://localhost:5173)
npm run build     # Build production bundle to dist/
npm run preview   # Preview production build locally
npm run test      # Run all Vitest unit tests
```

Run a single test file:
```bash
npx vitest run src/csv/parser.test.js
```

Server (backend API):
```bash
cd server && npm start   # Start API server on port 3001
```

Docker (production):
```bash
npm run build && docker compose up -d   # Build + run nginx + API
```

Deploy (push to main triggers GitHub Actions → deploys to NAS via Tailscale SSH):
```bash
git push origin main
```

YouTube link importer:
```bash
node scripts/import-youtube-links.js --list              # List all exercises
node scripts/import-youtube-links.js youtube-links.txt    # Import from file
open scripts/youtube-linker.html                          # GUI importer
```

No linting is configured in this project.

## Architecture

**TrainLog** is an offline-first PWA for workout logging (inspired by TrainHeroic). The app is built with React 18 + Vite and is installable on mobile devices via PWA. Data lives in `localStorage` (offline-first) with background sync to a Node/Express API backend on a Synology NAS.

### Routing

There is no React Router. Navigation is state-based: `App.jsx` holds a `navState` object `{ view, params }` and passes a `navigate(view, params)` callback to child components. Route constants are defined in `src/constants.js`.

### Domain Terminology

| Term | Code name | Description |
|------|-----------|-------------|
| **Workout** | `workout` | A named training session made up of ordered parts. E.g. "Upper A", "Lower B". Stored in `th_workouts`. |
| **Part** | `block` | A section within a workout. Normally holds one exercise. When it holds two or more exercises they are performed as a **superset** (back-to-back with no rest between exercises, rest only after the last one). |
| **Superset** | — | A part with 2+ exercises. The UI should display them grouped and log them in sequence before moving on. |
| **Exercise** | `exercise` | A single movement within a part. Has a title, optional notes, and a list of prescribed sets. E.g. "Bench Press", "Romanian Deadlift". |
| **Set** | `set` | One prescribed round of an exercise: a target rep count and weight. E.g. "3 × 10 @ 135 lb" = 3 sets. |
| **Session / Log** | `log` | A completed instance of a workout on a specific date, recording actual reps and weights. Key format: `YYYY-MM-DD::WorkoutTitle`. Stored in `th_logs`. |
| **Schedule** | `schedule` | Map of `YYYY-MM-DD → workoutTitle`. Determines what is planned for each day. Stored in `th_schedule`. |
| **Template** | `template` | A reusable workout definition not tied to any date. Stored in `th_templates`. |

> **Note:** The codebase uses the word `block` everywhere for what the product calls a *part*. These are the same thing.

### Data Layer

Seven custom hooks in `src/hooks/` manage all persistence via `readLS`/`writeLS` helpers in `src/storage/index.js`. Each hook owns one `localStorage` key (defined in `src/constants.js`). All hooks follow the same pattern: read from localStorage on init, expose state + updater functions that write back. `writeLS` automatically triggers a background push to the NAS API via `src/storage/sync.js`.

| Hook | Key | Data |
|------|-----|------|
| `useWorkouts` | `th_workouts` | Map of title → workout object (from CSV import) |
| `useSchedule` | `th_schedule` | Map of date (YYYY-MM-DD) → workoutTitle |
| `useWorkoutLogs` | `th_logs` | Map of logKey → completed workout session |
| `useActiveWorkout` | `th_active` | Current in-progress session (for crash recovery) |
| `useTemplates` | `th_templates` | Map of id → template |
| `useYouTubeLinks` | `th_yt_links` | Map of exerciseTitle → YouTube URL |

Log keys have the format `YYYY-MM-DD::WorkoutTitle` — use `makeLogKey` / `parseLogKey` from `src/constants.js`.

### Exercise Notes — Two Separate Fields

Exercises have **two distinct note fields** that must not be confused:

| Field | Stored on | Edited in | Shown in |
|-------|-----------|-----------|----------|
| `exercise.notes` | workout/template exercise object | Exercise Library | "Form Notes" collapsible in ActiveWorkoutView and ExerciseRow |
| `exercise.workoutNotes` | template exercise object | TemplateEditorView | Inline under exercise title in ActiveWorkoutView |

- **`notes`** — global coaching tips for the exercise regardless of workout (e.g. "keep elbows tight"). Same exercise in different workouts should share these.
- **`workoutNotes`** — workout-specific instructions that only apply in this template (e.g. "8 reps each side", "rest 90s here"). Not shown in the Library.

When updating `notes` from the Library, `onUpdateExerciseNotes` in App.jsx propagates the change across all workouts AND all templates. Template editor saves to `workoutNotes` only.

### Backend (server/)

`server/index.js` is a Node/Express API that stores data as JSON files in `server/data/`. Endpoints: `GET/PUT /api/data/:key` for individual keys, `GET/PUT /api/data` for bulk sync, `GET /api/health`. The frontend sync layer (`src/storage/sync.js`) handles offline-first: localStorage is always written first, then a debounced background push to the server. On startup, `useSync` hook pulls from server to merge.

### Sync Flow Details

All writes go through `writeLS(key, value)` in `src/storage/index.js`, which:
1. Writes to localStorage immediately
2. Calls `pushToServer(key, value)` — **debounced 500ms** per key

On app startup, `pullFromServer()` is called and merges server data into localStorage:
- **Merge strategy: server wins on same-key conflicts**, local-only keys are preserved
- If `changed=true`, the app flushes pending pushes then reloads (`window.location.reload()`)
- After a successful pull with no changes, any previously-failed push keys are retried

**Critical sync functions in `src/storage/sync.js`:**
- `pushToServer(key, data)` — debounced push for a single key
- `flushPendingPushes()` — immediately fire all debounced pushes (call before any reload)
- `retryFailedPushes()` — re-push keys that previously failed
- `pushAllToServer(keys)` — bulk push all keys (used by manual "Push to Server")
- `pullFromServer()` — pull and merge all keys from server

**Always call `flushPendingPushes()` before `window.location.reload()`** to avoid data loss from writes that haven't left the debounce timer yet. This is done in App.jsx before all sync-triggered reloads.

**Never use `localStorage.setItem` directly** — always use `writeLS` so the sync layer is triggered.

### Backup / Restore

Export backup (`Settings → Export Backup`) includes:
- `th_workouts` — all workout definitions with exercises, sets, and coaching notes
- `th_schedule` — date-to-workout mapping
- `th_yt_links` — YouTube links per exercise
- `th_logs` — full workout history (all completed sessions with actual reps/weights)
- `th_templates` — all templates with exercises, sets, and workout-specific notes

**Not included:** `th_active` (in-progress session scratch pad — intentionally excluded).

A full backup captures everything needed to restore: templates, exercises, notes (both kinds), YouTube links, and all logged history. Restore (`Settings → Restore from Backup`) uses `writeLS` per key, flushes to server, then sets `skipSync` before reloading so the pull doesn't server-wins merge over the restored data.

### App.jsx

Central orchestrator (~254 lines). Imports all 6 hooks, owns all state, and passes data + callbacks down to views as props. It also handles the crash recovery modal (detecting an unfinished active session on startup).

### CSV Parsing

`src/csv/parser.js` parses TrainHeroic CSV exports (columns: WorkoutTitle, ScheduledDate, ExerciseTitle, ExerciseData). `src/csv/exerciseData.js` further parses the ExerciseData string into structured sets `{reps, weight}`. Both files have 16-test suites.

### Views

Seven views in `src/views/`. ActiveWorkoutView is the most complex — it handles live set logging, a running timer, per-exercise notes, and writes to `useActiveWorkout` on every change (for crash safety). The view is hidden from NavBar; the app navigates back to TrainingView on completion.

### Styling

Dark theme (`#111111` background, `#4B7BFF` primary blue). CSS is split into feature-scoped files in `src/styles/` and imported in `src/main.jsx`.

### Service Worker

`public/sw.js` uses network-first for JS/CSS assets and cache-first for images/icons. Registered in `src/main.jsx` on load.

### Infrastructure

**NAS:** Synology NAS running Docker. nginx container on host port **3080** (`0.0.0.0:3080->80/tcp`). Node/Express API on port **3001**.

**Tailscale HTTPS:**
- App is served over HTTPS via `tailscale serve`: `https://tjnas.tail217062.ts.net:8443 → http://localhost:3080`
- DSM occupies port 443, so Tailscale serve uses port **8443**
- App URL: `https://tjnas.tail217062.ts.net:8443`
- API URL: `https://tjnas.tail217062.ts.net:8443/api` (set in `.env.development` as `VITE_API_URL`)
- To reconfigure: `tailscale serve --bg --https=8443 http://localhost:3080`
- To check: `tailscale serve status`

**Web Push Notifications:** Require HTTPS + PWA (Add to Home Screen on iPhone). iOS 16.4+ only. The app detects `window.isSecureContext` to show actionable guidance when push is unavailable.