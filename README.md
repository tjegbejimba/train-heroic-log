# TrainLog PWA

A mobile-friendly Progressive Web App for tracking workouts offline, inspired by TrainHeroic. Import your CSV workout data, schedule sessions, and log sets in real-time.

## Features

- ✅ **CSV Import** — Import TrainHeroic workout exports
- 📅 **Workout Calendar** — Horizontal date strip for easy navigation
- 🏋️ **Workout Logging** — Log actual reps and weight per set during workouts
- 🎥 **YouTube Links** — Add YouTube exercise form videos per exercise
- 📊 **Workout History** — Track completed workouts and view past logs
- 📱 **PWA** — Install as app on phone, works offline
- 🌙 **Dark Theme** — Easy on the eyes during early morning sessions

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Dev Server

```bash
npm run dev
```

Then open http://localhost:5173 in your browser.

### 3. Import Your Data

Click the **Import** tab, select your TrainHeroic CSV export, review the summary, and confirm.

## Build for Production

```bash
npm run build
npm run preview
```

Deploy the `dist/` folder to any static host (GitHub Pages, Netlify, Vercel, etc.).

## CSV Format

The app expects a TrainHeroic CSV export with these columns:

```
WorkoutTitle, ScheduledDate, RescheduledDate, WorkoutNotes,
BlockValue, BlockUnits, BlockInstructions, BlockNotes,
ExerciseTitle, ExerciseData, ExerciseNotes
```

**ExerciseData** examples:
- `6, 6, 6 rep x 40, 40, 40 pound`
- `5 rep x Bodyweight`
- `8 reps x 135 lbs`
- `AMRAP`
- `3 rep x 60%`

## Architecture

- **React + Vite** — Fast dev experience, minimal bundle
- **localStorage** — All data persists locally (no backend needed)
- **Service Worker** — Offline support and PWA caching
- **State-based Routing** — No React Router; simple navigation state

### Key Files

- `src/csv/parser.js` — CSV parsing logic
- `src/csv/exerciseData.js` — ExerciseData string parsing
- `src/hooks/` — Custom hooks for data persistence
- `src/views/` — View components (Training, History, etc.)
- `src/components/` — Reusable UI components
- `public/sw.js` — Service worker (offline caching)

## Workflow

1. **Import** → Select CSV file → Data saved to localStorage
2. **Training** → Tap a scheduled date → See workout detail → "Start Session"
3. **Active Workout** → Log sets (actual reps + weight) → Complete → History updated
4. **History** → Review past workouts and logs
5. **Library** → Browse all exercises and manage YouTube links

## Crash Recovery

If the app crashes during a workout, you'll see a "Resume Workout?" modal when you reopen it. This ensures you don't lose progress.

## Offline Support

After first load, the app works completely offline thanks to the service worker. Data syncs locally via localStorage.

## Development

### Run Tests

```bash
npm run test
```

Tests are located in `src/**/*.test.js`.

### Format Code

```bash
npx prettier --write src/
```

## Notes

- **YouTube Links** must be standard youtube.com or youtu.be URLs
- **Storage Limit** — Browser localStorage is usually 5-10MB; for very large CSV files, consider splitting
- **Mobile** — Works best on iOS Safari (16.4+) and Android Chrome 90+
- **Responsiveness** — Optimized for portrait mobile, but works on desktop too

## License

MIT
