/**
 * Calculate workout streaks from a set of completed date strings.
 * A streak = consecutive calendar days with at least one workout.
 *
 * @param {Set<string>|Array<string>} completedDates — YYYY-MM-DD strings
 * @returns {{ currentStreak: number, longestStreak: number, isActiveToday: boolean }}
 */
export function calculateStreaks(completedDates) {
  const dates = [...completedDates]
    .map(d => new Date(d + 'T00:00:00'))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a - b);

  if (dates.length === 0) return { currentStreak: 0, longestStreak: 0, isActiveToday: false };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let longestStreak = 1;
  let currentRun = 1;

  // Calculate all streaks
  for (let i = 1; i < dates.length; i++) {
    const diff = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      currentRun++;
    } else if (diff > 1) {
      longestStreak = Math.max(longestStreak, currentRun);
      currentRun = 1;
    }
    // diff === 0 means same day, skip
  }
  longestStreak = Math.max(longestStreak, currentRun);

  // Calculate current streak (must include today or yesterday to be "current")
  const lastDate = dates[dates.length - 1];
  const daysSinceLast = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));

  const isActiveToday = daysSinceLast === 0;

  if (daysSinceLast > 1) {
    return { currentStreak: 0, longestStreak, isActiveToday: false };
  }

  // Count backwards from last date
  let currentStreak = 1;
  for (let i = dates.length - 2; i >= 0; i--) {
    const diff = (dates[i + 1] - dates[i]) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      currentStreak++;
    } else {
      break;
    }
  }

  return { currentStreak, longestStreak, isActiveToday };
}
