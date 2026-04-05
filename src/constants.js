// localStorage keys
export const LS_WORKOUTS = 'th_workouts';
export const LS_SCHEDULE = 'th_schedule';
export const LS_YOUTUBE_LINKS = 'th_yt_links';
export const LS_WORKOUT_LOGS = 'th_logs';
export const LS_ACTIVE_SESSION = 'th_active';
export const LS_TEMPLATES = 'th_templates';

// Route/View names
export const ROUTE_IMPORT = 'import';
export const ROUTE_TRAINING = 'training';
export const ROUTE_ACTIVE_WORKOUT = 'activeWorkout';
export const ROUTE_HISTORY = 'history';
export const ROUTE_LIBRARY = 'library';
export const ROUTE_PLANNER = 'planner';
export const ROUTE_SETTINGS = 'settings';
export const ROUTE_EDIT_TEMPLATE = 'editTemplate';
export const ROUTE_EXERCISE_HISTORY = 'exerciseHistory';
export const ROUTE_STATS = 'stats';
export const ROUTE_TEMPLATES = 'templates';

// Tab IDs for bottom nav
export const TAB_TRAINING = 'training';
export const TAB_HISTORY = 'history';
export const TAB_LIBRARY = 'library';
export const TAB_IMPORT = 'import';
export const TAB_SETTINGS = 'settings';

// Date formats
export const DATE_ISO = 'YYYY-MM-DD'; // used as reference; actual JS uses toISOString().split('T')[0]

// Exercise key format: just exercise title (YouTube links are global per exercise)
export const makeExerciseKey = (exerciseTitle) => exerciseTitle;

// Log key format: "${YYYY-MM-DD}::${workoutTitle}"
export const makeLogKey = (date, workoutTitle) =>
  `${date}::${workoutTitle}`;

export const parseLogKey = (logKey) => {
  const [date, ...rest] = logKey.split('::');
  return { date, workoutTitle: rest.join('::') };
};
