# Quick Setup Guide

## Prerequisites

- Node.js 16+ (or bun as an alternative)
- Your TrainHeroic CSV export file

## Installation & Running

1. **Install dependencies:**
   ```bash
   cd /Users/tjegbejimba/train-heroic-log
   npm install
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   ```

   Open your browser to the URL shown (usually http://localhost:5173)

3. **First time use:**
   - Click the "Import" tab at the bottom
   - Select your TrainHeroic CSV file
   - Review the import summary (workouts, exercises, date range)
   - Click "Import Data"
   - You should now be on the "Training" tab with a calendar view

4. **Use the app:**
   - **Training** — View and start workouts for a specific date
   - **History** — Review completed workouts
   - **Library** — Browse all exercises and manage YouTube links
   - **Import** — Re-import a new CSV (replaces old data)
   - **Settings** — App options

## Testing the Flow

1. Import your CSV
2. Navigate to a date with a scheduled workout (they'll have a dot)
3. Tap on that workout to expand and see exercises
4. Click "Edit" on an exercise to add a YouTube link (optional)
5. Click "Start Session" to begin logging
6. Log actual reps and weight for each set
7. Check off each set as you complete it
8. Click "Complete Workout" when done
9. Go to "History" to see your completed workout

## Building for Production

```bash
npm run build
```

This creates a `dist/` folder ready to deploy to:
- GitHub Pages
- Netlify (drag & drop)
- Vercel
- Any static host

## Troubleshooting

**"Cannot find module" errors:**
- Make sure you ran `npm install`
- Try deleting `node_modules` and running `npm install` again

**CSV not importing:**
- Check that your CSV has the required columns (WorkoutTitle, ExerciseTitle, ExerciseData)
- Make sure the ExerciseData format is recognized (e.g., "6 reps x 40 lb")

**YouTube links not saving:**
- Make sure you use a full URL like `https://www.youtube.com/watch?v=...`
- The URL must contain "youtube.com" or "youtu.be"

**Data disappeared:**
- localStorage is per-browser/device — data doesn't sync between devices
- Check browser DevTools (F12) → Application → Local Storage to verify data is there

**App not working offline:**
- Service Worker registration can take a moment
- Try visiting the page again after first load
- Check DevTools → Application → Service Workers to see if it's registered

## Notes

- All data is stored locally in your browser (localStorage)
- No backend or internet connection needed after first load
- Each browser/device has its own separate data
- Maximum ~5-10MB of data per browser (localStorage limit)

For more details, see README.md
