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

### Backend (server/)

`server/index.js` is a Node/Express API that stores data as JSON files in `server/data/`. Endpoints: `GET/PUT /api/data/:key` for individual keys, `GET/PUT /api/data` for bulk sync, `GET /api/health`. The frontend sync layer (`src/storage/sync.js`) handles offline-first: localStorage is always written first, then a debounced background push to the server. On startup, `useSync` hook pulls from server to merge.

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