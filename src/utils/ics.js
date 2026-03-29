/**
 * Generate an ICS (iCalendar) file from the workout schedule.
 * Produces all-day events, one per scheduled date, with exercise list in description.
 */

function escapeICS(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

function dateToICS(dateStr) {
  // dateStr is YYYY-MM-DD → YYYYMMDD
  return dateStr.replace(/-/g, '');
}

function nextDay(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function buildDescription(workout) {
  if (!workout?.blocks) return '';
  const lines = [];
  workout.blocks.forEach((block) => {
    block.exercises.forEach((ex) => {
      if (!ex.title) return;
      const setCount = ex.sets?.length ?? 0;
      const firstSet = ex.sets?.[0];
      const setSummary =
        setCount > 0 && firstSet?.reps
          ? `${setCount}×${firstSet.reps}`
          : setCount > 0
          ? `${setCount} sets`
          : '';
      lines.push(setSummary ? `${ex.title} (${setSummary})` : ex.title);
    });
  });
  return lines.join('\\n');
}

/**
 * @param {Object} schedule  — th_schedule: { 'YYYY-MM-DD': 'WorkoutTitle' }
 * @param {Object} workouts  — th_workouts: { 'WorkoutTitle': workoutObj }
 * @param {string} [from]    — YYYY-MM-DD start date (inclusive), defaults to today
 * @param {string} [to]      — YYYY-MM-DD end date (inclusive), defaults to no limit
 * @returns {string} ICS file content
 */
export function generateICS(schedule, workouts, from, to) {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = from || today;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TrainLog//TrainLog//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:TrainLog Schedule',
  ];

  const entries = Object.entries(schedule || {})
    .filter(([date, title]) => title && date >= startDate && (!to || date <= to))
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [date, workoutTitle] of entries) {
    const workout = workouts?.[workoutTitle];
    const dtstart = dateToICS(date);
    const dtend = nextDay(date);
    const uid = `${dtstart}-${encodeURIComponent(workoutTitle)}@trainlog`;
    const description = buildDescription(workout);

    lines.push('BEGIN:VEVENT');
    lines.push(`DTSTART;VALUE=DATE:${dtstart}`);
    lines.push(`DTEND;VALUE=DATE:${dtend}`);
    lines.push(`SUMMARY:${escapeICS(workoutTitle)}`);
    if (description) lines.push(`DESCRIPTION:${description}`);
    lines.push(`UID:${uid}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Trigger a browser download of the ICS file.
 */
export function downloadICS(schedule, workouts, from, to, filename = 'trainlog-schedule.ics') {
  const content = generateICS(schedule, workouts, from, to);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
