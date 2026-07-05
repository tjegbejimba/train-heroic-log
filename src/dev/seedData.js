/*
 * Dev-only demo data seeder.
 *
 * Builds a realistic multi-week training history so every screen
 * (Training, Planner, History, Stats, Exercise History, Library,
 * Templates) has meaningful content to design against.
 *
 * Usage (dev server only): open the console and run
 *     __seedDemo()            // seed + reload
 *     __seedDemo({ reload: false })
 *     __clearDemo()           // wipe all TrainLog keys + reload
 *
 * It writes localStorage directly and sets sessionStorage.skipSync so
 * the offline pull/merge doesn't clobber the fixture on reload.
 */
import {
  LS_WORKOUTS,
  LS_SCHEDULE,
  LS_WORKOUT_LOGS,
  LS_TEMPLATES,
  LS_YOUTUBE_LINKS,
  LS_ACTIVE_SESSION,
  makeLogKey,
} from '../constants';

/* ---------- date helpers ---------- */
const iso = (d) => {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
};
const addDays = (base, n) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};
const startOfWeekMonday = (base) => {
  const d = new Date(base);
  const day = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  return addDays(d, -day);
};

/* ---------- shape builders ---------- */
const mkSet = (reps, weight, unit = 'lb') => ({
  reps,
  weight: unit === 'bw' ? null : weight,
  unit,
  repsUnit: 'reps',
  rawReps: String(reps),
  rawWeight: unit === 'bw' ? 'bw' : String(weight),
});
const mkExercise = (title, notes, sets) => ({ title, notes, sets });
const mkBlock = (value, units, instructions, exercises, notes = '') => ({
  value,
  units,
  instructions,
  notes,
  exercises,
});

/*
 * Program definition. Each exercise carries a `top` weight (this week's
 * prescription) plus a per-week `step` used to walk weights backwards
 * through history, producing progressive overload + PRs over time.
 * `scheme` is the set/rep prescription applied to every session.
 */
const REP_SCHEMES = {
  strength: [5, 5, 5],
  power: [3, 3, 3],
  hyper: [8, 10, 12],
  pump: [12, 15],
};

const PROGRAM = {
  'Upper A — Push Strength': {
    notes: 'Bench focus. Leave 1–2 reps in the tank on top sets.',
    blocks: [
      {
        value: 'A',
        units: 'PREP',
        instructions: 'Prime shoulders + t-spine',
        exercises: [{ title: 'Band Pull-Apart', notes: 'Slow and controlled', scheme: 'pump', unit: 'bw' }],
      },
      {
        value: 'B',
        units: 'STRENGTH',
        instructions: 'Main barbell strength',
        exercises: [
          { title: 'Bench Press', notes: 'Tuck elbows ~45°', scheme: 'strength', top: 205, step: 5 },
          { title: 'Overhead Press', notes: 'Squeeze glutes, no layback', scheme: 'power', top: 130, step: 5 },
        ],
      },
      {
        value: 'C',
        units: 'HYPERTROPHY',
        instructions: 'Accessory volume',
        exercises: [
          { title: 'Incline Dumbbell Press', notes: 'Per hand', scheme: 'hyper', top: 75, step: 2.5 },
          { title: 'Cable Triceps Pushdown', notes: 'Elbows pinned', scheme: 'pump', top: 65, step: 2.5 },
        ],
      },
    ],
  },
  'Lower A — Squat Strength': {
    notes: 'Squat focus. Brace hard, full depth.',
    blocks: [
      {
        value: 'A',
        units: 'PREP',
        instructions: 'Open hips + ankles',
        exercises: [{ title: 'Goblet Squat', notes: 'Warm-up pattern', scheme: 'hyper', top: 45, step: 0 }],
      },
      {
        value: 'B',
        units: 'STRENGTH',
        instructions: 'Main barbell strength',
        exercises: [
          { title: 'Back Squat', notes: 'Knees track over toes', scheme: 'strength', top: 285, step: 10 },
          { title: 'Romanian Deadlift', notes: 'Push hips back, soft knees', scheme: 'power', top: 245, step: 5 },
        ],
      },
      {
        value: 'C',
        units: 'HYPERTROPHY',
        instructions: 'Single-leg + core',
        exercises: [
          { title: 'Walking Lunge', notes: 'Per leg, controlled', scheme: 'hyper', top: 50, step: 2.5 },
          { title: 'Hanging Leg Raise', notes: 'No swing', scheme: 'pump', unit: 'bw' },
        ],
      },
    ],
  },
  'Upper B — Pull Strength': {
    notes: 'Back thickness + width. Own every rep.',
    blocks: [
      {
        value: 'A',
        units: 'PREP',
        instructions: 'Scap activation',
        exercises: [{ title: 'Scap Pull-Up', notes: 'Feel the lats load', scheme: 'pump', unit: 'bw' }],
      },
      {
        value: 'B',
        units: 'STRENGTH',
        instructions: 'Vertical + horizontal pull',
        exercises: [
          { title: 'Weighted Pull-Up', notes: 'Added lbs on belt', scheme: 'power', top: 55, step: 2.5 },
          { title: 'Barbell Row', notes: 'Torso ~45°, no yank', scheme: 'strength', top: 185, step: 5 },
        ],
      },
      {
        value: 'C',
        units: 'HYPERTROPHY',
        instructions: 'Arms + rear delts',
        exercises: [
          { title: 'Seated Cable Row', notes: 'Full stretch', scheme: 'hyper', top: 160, step: 5 },
          { title: 'Dumbbell Curl', notes: 'Per hand, no swing', scheme: 'pump', top: 40, step: 2.5 },
        ],
      },
    ],
  },
  'Lower B — Deadlift Strength': {
    notes: 'Pull focus. Reset each rep, keep the bar close.',
    blocks: [
      {
        value: 'A',
        units: 'PREP',
        instructions: 'Hinge groove',
        exercises: [{ title: 'Kettlebell Swing', notes: 'Explosive hips', scheme: 'hyper', top: 53, step: 0 }],
      },
      {
        value: 'B',
        units: 'STRENGTH',
        instructions: 'Main pull + squat accessory',
        exercises: [
          { title: 'Deadlift', notes: 'Wedge in, then pull', scheme: 'power', top: 365, step: 10 },
          { title: 'Front Squat', notes: 'Elbows high', scheme: 'strength', top: 205, step: 5 },
        ],
      },
      {
        value: 'C',
        units: 'HYPERTROPHY',
        instructions: 'Posterior chain + calves',
        exercises: [
          { title: 'Leg Curl', notes: 'Squeeze at top', scheme: 'hyper', top: 120, step: 5 },
          { title: 'Standing Calf Raise', notes: 'Full stretch + pause', scheme: 'pump', top: 180, step: 5 },
        ],
      },
    ],
  },
};

const DAY_PLAN = [
  { offset: 0, workout: 'Upper A — Push Strength' }, // Monday
  { offset: 1, workout: 'Lower A — Squat Strength' }, // Tuesday
  { offset: 3, workout: 'Upper B — Pull Strength' }, // Thursday
  { offset: 4, workout: 'Lower B — Deadlift Strength' }, // Friday
];

const WEEKS_BACK = 6; // completed history
const WEEKS_FWD = 1; // scheduled ahead

/* Build the current-week workout objects (top prescription). */
function buildWorkouts() {
  const workouts = {};
  for (const [title, def] of Object.entries(PROGRAM)) {
    workouts[title] = {
      title,
      notes: def.notes,
      blocks: def.blocks.map((b) =>
        mkBlock(
          b.value,
          b.units,
          b.instructions,
          b.exercises.map((e) => {
            const reps = REP_SCHEMES[e.scheme];
            const unit = e.unit || 'lb';
            const sets = reps.map((r) => mkSet(r, unit === 'bw' ? null : e.top, unit));
            return mkExercise(e.title, e.notes, sets);
          })
        )
      ),
    };
  }
  return workouts;
}

/* Weight for an exercise `weeksAgo` weeks back (progressive overload). */
function weightAt(e, weeksAgo) {
  const unit = e.unit || 'lb';
  if (unit === 'bw') return null;
  const step = e.step || 0;
  const w = e.top - step * weeksAgo;
  const floor = step ? e.top - step * (WEEKS_BACK - 1) : e.top;
  return Math.max(floor, Math.round(w / 2.5) * 2.5);
}

/* Build schedule + completed logs across the history window. */
function buildScheduleAndLogs(today) {
  const schedule = {};
  const logs = {};
  const thisMonday = startOfWeekMonday(today);
  const todayStr = iso(today);

  for (let wk = -WEEKS_BACK; wk <= WEEKS_FWD; wk++) {
    const weekMonday = addDays(thisMonday, wk * 7);
    const weeksAgo = -wk; // positive in the past
    for (const plan of DAY_PLAN) {
      const date = addDays(weekMonday, plan.offset);
      const dateStr = iso(date);
      const def = PROGRAM[plan.workout];
      schedule[dateStr] = plan.workout;

      if (dateStr >= todayStr) continue; // today + future = scheduled only

      const exercises = {};
      def.blocks.forEach((b) => {
        b.exercises.forEach((e) => {
          const reps = REP_SCHEMES[e.scheme];
          const unit = e.unit || 'lb';
          const w = weightAt(e, weeksAgo);
          exercises[e.title] = reps.map((r, i) => {
            const missed = unit !== 'bw' && weeksAgo >= 4 && i === reps.length - 1 && date.getDate() % 3 === 0;
            const actualReps = missed ? Math.max(1, r - 1) : r;
            return {
              setIndex: i,
              targetReps: r,
              targetWeight: unit === 'bw' ? null : w,
              unit,
              actualReps,
              actualWeight: unit === 'bw' ? '' : w,
              completed: true,
            };
          });
        });
      });

      const started = new Date(date);
      started.setHours(17, 30, 0, 0);
      const durationMin = 52 + (date.getDate() % 4) * 6;
      const completed = new Date(started.getTime() + durationMin * 60000);
      const logKey = makeLogKey(dateStr, plan.workout);
      logs[logKey] = {
        logKey,
        workoutTitle: plan.workout,
        date: dateStr,
        completedAt: completed.toISOString(),
        startedAt: started.toISOString(),
        exercises,
        exerciseNotes: {},
        workoutNote: weeksAgo === 1 ? 'Felt strong — bar speed was crisp.' : '',
      };
    }
  }
  return { schedule, logs };
}

function buildTemplates(today) {
  const t1 = `tpl_${today.getTime()}_0`;
  const t2 = `tpl_${today.getTime()}_1`;
  return {
    [t1]: {
      id: t1,
      name: 'Full-Body Express (40 min)',
      createdDate: iso(addDays(today, -30)),
      notes: 'Travel / short-on-time day.',
      blocks: [
        mkBlock('A', 'STRENGTH', 'Compound circuit', [
          { ...mkExercise('Back Squat', 'Moderate load', [mkSet(8, 185), mkSet(8, 185), mkSet(8, 185)]), workoutNotes: 'Keep rest ~90s' },
          { ...mkExercise('Bench Press', 'Controlled', [mkSet(8, 155), mkSet(8, 155), mkSet(8, 155)]), workoutNotes: '' },
        ]),
        mkBlock('B', 'CONDITIONING', 'Finisher', [
          { ...mkExercise('Kettlebell Swing', 'Big hips', [mkSet(15, 53), mkSet(15, 53)]), workoutNotes: 'EMOM x 8' },
        ]),
      ],
    },
    [t2]: {
      id: t2,
      name: 'Deload Week',
      createdDate: iso(addDays(today, -14)),
      notes: 'Cut volume + intensity ~40%.',
      blocks: [
        mkBlock('A', 'STRENGTH', 'Light + crisp', [
          { ...mkExercise('Deadlift', 'Speed reps', [mkSet(3, 225), mkSet(3, 225), mkSet(3, 225)]), workoutNotes: 'Bar speed only' },
          { ...mkExercise('Overhead Press', 'Technique', [mkSet(5, 95), mkSet(5, 95)]), workoutNotes: '' },
        ]),
      ],
    },
  };
}

const YT_LINKS = {
  'Bench Press': 'https://www.youtube.com/watch?v=rT7DgCr-3pg',
  'Back Squat': 'https://www.youtube.com/watch?v=ultWZbUMPL8',
  Deadlift: 'https://www.youtube.com/watch?v=op9kVnSso6Q',
  'Overhead Press': 'https://www.youtube.com/watch?v=2yjwXTZQDDI',
  'Romanian Deadlift': 'https://www.youtube.com/watch?v=JCXUYuzwNrM',
  'Barbell Row': 'https://www.youtube.com/watch?v=9efgcAjQe7E',
};

const ALL_KEYS = [
  LS_WORKOUTS,
  LS_SCHEDULE,
  LS_WORKOUT_LOGS,
  LS_TEMPLATES,
  LS_YOUTUBE_LINKS,
  LS_ACTIVE_SESSION,
];

export function buildDemoData(today = new Date()) {
  const workouts = buildWorkouts();
  const { schedule, logs } = buildScheduleAndLogs(today);
  const templates = buildTemplates(today);
  return {
    [LS_WORKOUTS]: workouts,
    [LS_SCHEDULE]: schedule,
    [LS_WORKOUT_LOGS]: logs,
    [LS_TEMPLATES]: templates,
    [LS_YOUTUBE_LINKS]: YT_LINKS,
  };
}

export function seedDemoData({ reload = true } = {}) {
  const data = buildDemoData(new Date());
  for (const [key, value] of Object.entries(data)) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  localStorage.removeItem(LS_ACTIVE_SESSION);
  try {
    sessionStorage.setItem('skipSync', '1');
  } catch {
    /* ignore */
  }
  const counts = {
    workouts: Object.keys(data[LS_WORKOUTS]).length,
    scheduled: Object.keys(data[LS_SCHEDULE]).length,
    logs: Object.keys(data[LS_WORKOUT_LOGS]).length,
    templates: Object.keys(data[LS_TEMPLATES]).length,
  };
  // eslint-disable-next-line no-console
  console.log('[seedDemo] seeded', counts);
  if (reload) window.location.reload();
  return counts;
}

export function clearDemoData({ reload = true } = {}) {
  ALL_KEYS.forEach((k) => localStorage.removeItem(k));
  try {
    sessionStorage.setItem('skipSync', '1');
  } catch {
    /* ignore */
  }
  // eslint-disable-next-line no-console
  console.log('[seedDemo] cleared TrainLog data');
  if (reload) window.location.reload();
}
