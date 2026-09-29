import { describe, it, expect } from 'vitest';
import { buildTrainingHistory } from './trainingHistory';

const set = (actualReps, actualWeight, extra = {}) => ({
  completed: true,
  actualReps: String(actualReps),
  actualWeight: String(actualWeight),
  unit: 'lb',
  ...extra,
});

const session = (date, exercises, extra = {}) => ({
  date,
  workoutTitle: 'Upper A',
  startedAt: `${date}T10:00:00.000Z`,
  completedAt: `${date}T11:00:00.000Z`,
  exercises,
  ...extra,
});

const keyOf = (date, title = 'Upper A') => `${date}::${title}`;

describe('sessionRecap', () => {
  it('reports a first-ever Session as one Baseline per Exercise and rep count, on its heaviest Set', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-01-05')]: session('2026-01-05', {
        'Bench Press': [set(8, 100), set(8, 105), set(5, 120)],
      }),
    });

    const recap = history.sessionRecap(keyOf('2026-01-05'));

    expect(recap.prs).toEqual([]);
    expect(recap.baselines).toEqual([
      { exercise: 'Bench Press', setIndex: 1, reps: 8, weight: 105, unit: 'lb', kind: 'baseline' },
      { exercise: 'Bench Press', setIndex: 2, reps: 5, weight: 120, unit: 'lb', kind: 'baseline' },
    ]);
    expect(recap.totalCompleted).toBe(3);
    expect(recap.totalSets).toBe(3);
    expect(recap.durationMin).toBe(60);
    expect(recap.volumeByUnit).toEqual({ lb: 2240 });
  });

  it('marks a Set that beats every earlier Session as a PR, and a tie as neither', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-01-05')]: session('2026-01-05', { Squat: [set(5, 200)] }),
      [keyOf('2026-01-12')]: session('2026-01-12', { Squat: [set(5, 200)] }),
      [keyOf('2026-01-19')]: session('2026-01-19', { Squat: [set(5, 210)] }),
    });

    expect(history.sessionRecap(keyOf('2026-01-12')).records).toEqual([]);
    expect(history.sessionRecap(keyOf('2026-01-19')).prs).toEqual([
      { exercise: 'Squat', setIndex: 0, reps: 5, weight: 210, unit: 'lb', kind: 'pr' },
    ]);
  });

  it('keeps a PR as a PR after a later Session beats it', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-01-05')]: session('2026-01-05', { Squat: [set(5, 200)] }),
      [keyOf('2026-01-12')]: session('2026-01-12', { Squat: [set(5, 210)] }),
      [keyOf('2026-01-19')]: session('2026-01-19', { Squat: [set(5, 220)] }),
    });

    expect(history.sessionRecap(keyOf('2026-01-12')).prs).toHaveLength(1);
  });

  it('never compares weights across units', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-01-05')]: session('2026-01-05', { Deadlift: [set(3, 300)] }),
      [keyOf('2026-01-12')]: session('2026-01-12', { Deadlift: [set(3, 140, { unit: 'kg' })] }),
    });

    expect(history.sessionRecap(keyOf('2026-01-12')).baselines).toEqual([
      { exercise: 'Deadlift', setIndex: 0, reps: 3, weight: 140, unit: 'kg', kind: 'baseline' },
    ]);
  });

  it('lets a later Session on the same day set a PR over the earlier one', () => {
    const morning = session('2026-02-01', { 'Bench Press': [set(8, 100)] }, {
      workoutTitle: 'AM', completedAt: '2026-02-01T08:00:00.000Z',
    });
    const evening = session('2026-02-01', { 'Bench Press': [set(8, 110)] }, {
      workoutTitle: 'PM', completedAt: '2026-02-01T19:00:00.000Z',
    });
    const history = buildTrainingHistory({
      [keyOf('2026-02-01', 'PM')]: evening,
      [keyOf('2026-02-01', 'AM')]: morning,
    });

    expect(history.sessionRecap(keyOf('2026-02-01', 'AM')).baselines).toHaveLength(1);
    expect(history.sessionRecap(keyOf('2026-02-01', 'PM')).prs).toEqual([
      { exercise: 'Bench Press', setIndex: 0, reps: 8, weight: 110, unit: 'lb', kind: 'pr' },
    ]);
  });

  it('treats numeric and raw-string reps and weights as the same record', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-03-02')]: session('2026-03-02', { Squat: [{ completed: true, actualReps: 5, actualWeight: 200, unit: 'lb' }] }),
      [keyOf('2026-03-04')]: session('2026-03-04', { Squat: [set(' 5 ', '210')] }),
    });

    expect(history.sessionRecap(keyOf('2026-03-04')).records).toEqual([
      { exercise: 'Squat', setIndex: 0, reps: 5, weight: 210, unit: 'lb', kind: 'pr' },
    ]);
  });

  it('ignores unfinished Logs: they are not history and set no reference', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-01-05')]: session('2026-01-05', { Squat: [set(5, 250)] }, { completedAt: null }),
      [keyOf('2026-01-12')]: session('2026-01-12', { Squat: [set(5, 200)] }),
    });

    expect(history.sessionRecap(keyOf('2026-01-05'))).toBeNull();
    expect(history.sessionRecap(keyOf('2026-01-12')).baselines).toHaveLength(1);
  });

  it('skips incomplete, zero-weight, and zero-rep Sets when finding records', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-01-05')]: session('2026-01-05', {
        Squat: [set(5, 300, { completed: false }), set(5, 0), set(0, 200), set(5, 100)],
      }),
    });

    expect(history.sessionRecap(keyOf('2026-01-05')).baselines).toEqual([
      { exercise: 'Squat', setIndex: 3, reps: 5, weight: 100, unit: 'lb', kind: 'baseline' },
    ]);
  });

  it('counts only lb and kg Sets as volume, kept per unit', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-01-05')]: session('2026-01-05', {
        Row: [set(10, 50), set(10, 20, { unit: 'kg' })],
        Plank: [set(1, 60, { unit: 'sec' })],
        'Push-up': [set(15, 1, { unit: 'bw' })],
        Curl: [set(10, 30, { completed: false })],
      }),
    });

    expect(history.sessionRecap(keyOf('2026-01-05')).volumeByUnit).toEqual({ lb: 500, kg: 200 });
  });

  it('has no duration when the Session was not timed', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-01-05')]: session('2026-01-05', { Squat: [set(5, 200)] }, { startedAt: null }),
    });

    expect(history.sessionRecap(keyOf('2026-01-05')).durationMin).toBeNull();
  });

  it('accepts the allLogs array, whose items carry their key', () => {
    const history = buildTrainingHistory([
      { key: keyOf('2026-01-12'), ...session('2026-01-12', { Squat: [set(5, 210)] }) },
      { key: keyOf('2026-01-05'), ...session('2026-01-05', { Squat: [set(5, 200)] }) },
    ]);

    expect(history.sessionRecap(keyOf('2026-01-12')).prs).toHaveLength(1);
  });
});

describe('rangeSummary', () => {
  const logs = {
    [keyOf('2026-03-02')]: session('2026-03-02', { Squat: [set(5, 200)], Row: [set(10, 20, { unit: 'kg' })] }),
    [keyOf('2026-03-04')]: session('2026-03-04', { Squat: [set(5, 210)], Curl: [set(10, 30)] }),
    [keyOf('2026-03-10')]: session('2026-03-10', { Squat: [set(5, 220)], Plank: [set(1, 60, { unit: 'sec' })] }),
    [keyOf('2026-03-11')]: session('2026-03-11', { Squat: [set(5, 300)] }, { completedAt: null }),
  };

  it('summarizes every completed Session for ALL, in the dominant unit', () => {
    const summary = buildTrainingHistory(logs).rangeSummary('ALL', { today: '2026-03-12' });

    expect(summary.unit).toBe('lb');
    expect(summary.volumeByWeek).toEqual([
      { weekStart: '2026-03-02', volume: 1000 + 1050 + 300, unit: 'lb' },
      { weekStart: '2026-03-09', volume: 1100, unit: 'lb' },
    ]);
    expect(summary.sessionsByWeek).toEqual([
      { weekStart: '2026-03-02', count: 2 },
      { weekStart: '2026-03-09', count: 1 },
    ]);
    expect(summary.prCount).toBe(2);
    expect(summary.volumeByExercise).toEqual([
      { exercise: 'Squat', volume: 3150, unit: 'lb' },
      { exercise: 'Curl', volume: 300, unit: 'lb' },
    ]);
    expect(summary.workoutDates).toEqual(new Set(['2026-03-02', '2026-03-04', '2026-03-10']));
  });

  it('limits a preset to the trailing window but judges PRs against all earlier Sessions', () => {
    const summary = buildTrainingHistory(logs).rangeSummary('1W', { today: '2026-03-12' });

    expect(summary.sessionsByWeek).toEqual([{ weekStart: '2026-03-09', count: 1 }]);
    expect(summary.prCount).toBe(1);
    expect(summary.workoutDates).toEqual(new Set(['2026-03-10']));
    expect(summary.dateRange).toEqual({ start: '2026-03-05', end: '2026-03-12' });
    expect(buildTrainingHistory(logs).rangeSummary('ALL').dateRange).toBeNull();
  });

  it('counts PRs only in the dominant unit, like its volume', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-03-02')]: session('2026-03-02', { Squat: [set(5, 200)], Row: [set(10, 20, { unit: 'kg' })] }),
      [keyOf('2026-03-04')]: session('2026-03-04', { Squat: [set(5, 210)], Row: [set(10, 25, { unit: 'kg' })] }),
      [keyOf('2026-03-06')]: session('2026-03-06', { Squat: [set(5, 220)], Plank: [set(1, 60, { unit: 'sec' })] }),
      [keyOf('2026-03-08')]: session('2026-03-08', { Plank: [set(1, 90, { unit: 'sec' })] }),
    });

    const summary = history.rangeSummary('ALL');

    expect(summary.unit).toBe('lb');
    expect(summary.prCount).toBe(2);
  });

  it('spans 28 days for 4W and 90 days for 3M', () => {
    const history = buildTrainingHistory(logs);

    expect(history.rangeSummary('4W', { today: '2026-03-12' }).dateRange).toEqual({ start: '2026-02-12', end: '2026-03-12' });
    expect(history.rangeSummary('3M', { today: '2026-03-12' }).dateRange).toEqual({ start: '2025-12-12', end: '2026-03-12' });
  });

  it('picks kg as the unit when most completed Sets are kg, defaulting to lb on a tie', () => {
    const kgHeavy = buildTrainingHistory({
      [keyOf('2026-03-02')]: session('2026-03-02', {
        Row: [set(10, 20, { unit: 'kg' }), set(10, 20, { unit: 'kg' })],
        Curl: [set(10, 30)],
      }),
    });
    const tie = buildTrainingHistory({
      [keyOf('2026-03-02')]: session('2026-03-02', { Row: [set(10, 20, { unit: 'kg' })], Curl: [set(10, 30)] }),
    });

    expect(kgHeavy.rangeSummary('ALL').unit).toBe('kg');
    expect(tie.rangeSummary('ALL').unit).toBe('lb');
  });
});

describe('isEmpty', () => {
  it('is true until at least one Session is completed', () => {
    expect(buildTrainingHistory({}).isEmpty).toBe(true);
    expect(buildTrainingHistory({
      [keyOf('2026-03-11')]: session('2026-03-11', { Squat: [set(5, 300)] }, { completedAt: null }),
    }).isEmpty).toBe(true);
    expect(buildTrainingHistory({
      [keyOf('2026-03-12')]: session('2026-03-12', { Squat: [set(5, 300)] }),
    }).isEmpty).toBe(false);
  });
});

describe('exerciseTimeline', () => {
  it('lists completed Sessions containing the Exercise, newest first, with their notes', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-01-05')]: session('2026-01-05', { Squat: [set(5, 200), set(5, 200, { completed: false })] }),
      [keyOf('2026-01-06', 'Lower B')]: session('2026-01-06', { Row: [set(10, 50)] }, { workoutTitle: 'Lower B' }),
      [keyOf('2026-01-12')]: session('2026-01-12', { Squat: [set(5, 210)] }, { exerciseNotes: { Squat: 'belt on' } }),
      [keyOf('2026-01-19')]: session('2026-01-19', { Squat: [set(5, 230)] }, { completedAt: null }),
    });

    const timeline = history.exerciseTimeline('Squat');

    expect(timeline.sessions.map((s) => [s.date, s.workoutTitle, s.exerciseNote])).toEqual([
      ['2026-01-12', 'Upper A', 'belt on'],
      ['2026-01-05', 'Upper A', null],
    ]);
    expect(timeline.sessions[1].sets).toHaveLength(2);
    expect(timeline.completedSetCount).toBe(2);
  });

  it('charts each Session oldest first and marks Top-set records at any rep count', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-01-05')]: session('2026-01-05', { Squat: [set(5, 200), set(3, 190)] }),
      [keyOf('2026-01-12')]: session('2026-01-12', { Squat: [set(3, 215)] }),
      [keyOf('2026-01-19')]: session('2026-01-19', { Squat: [set(8, 215)] }),
      [keyOf('2026-01-26')]: session('2026-01-26', { Squat: [set(8, 180)] }),
    });

    expect(history.exerciseTimeline('Squat').progress).toEqual([
      { date: '2026-01-05', bestWeight: 200, bestReps: 5, volume: 1570, unit: 'lb', kind: 'baseline' },
      { date: '2026-01-12', bestWeight: 215, bestReps: 3, volume: 645, unit: 'lb', kind: 'top-set' },
      { date: '2026-01-19', bestWeight: 215, bestReps: 8, volume: 1720, unit: 'lb', kind: null },
      { date: '2026-01-26', bestWeight: 180, bestReps: 8, volume: 1440, unit: 'lb', kind: null },
    ]);
  });

  it('reports the best estimated 1RM', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-01-05')]: session('2026-01-05', { Squat: [set(1, 225)] }),
      [keyOf('2026-01-12')]: session('2026-01-12', { Squat: [set(5, 200)] }),
    });

    const { best1RM } = history.exerciseTimeline('Squat');

    expect(best1RM).toMatchObject({ weight: 200, reps: 5, unit: 'lb' });
    expect(best1RM.est).toBeCloseTo(229.17, 2);
    expect(best1RM.epley).toBeCloseTo(233.33, 2);
    expect(best1RM.brzycki).toBeCloseTo(225, 2);
  });

  it('charts and estimates only in the unit of the most recent Session', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-01-05')]: session('2026-01-05', { Deadlift: [set(3, 300)] }),
      [keyOf('2026-01-12')]: session('2026-01-12', { Deadlift: [set(3, 140, { unit: 'kg' })] }),
      [keyOf('2026-01-19')]: session('2026-01-19', { Deadlift: [set(3, 145, { unit: 'kg' })] }),
    });

    const timeline = history.exerciseTimeline('Deadlift');

    expect(timeline.unit).toBe('kg');
    expect(timeline.progress.map((p) => [p.bestWeight, p.kind])).toEqual([
      [140, 'baseline'],
      [145, 'top-set'],
    ]);
    expect(timeline.best1RM).toMatchObject({ weight: 145, unit: 'kg' });
    expect(timeline.sessions).toHaveLength(3);
  });

  it('has no chart or 1RM when the Exercise has no weighted Sets', () => {
    const history = buildTrainingHistory({
      [keyOf('2026-01-05')]: session('2026-01-05', { Plank: [set(1, 0, { unit: 'bw' })] }),
    });

    const timeline = history.exerciseTimeline('Plank');

    expect(timeline.unit).toBeNull();
    expect(timeline.progress).toEqual([]);
    expect(timeline.best1RM).toBeNull();
  });
});
