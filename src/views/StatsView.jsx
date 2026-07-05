import { useState, useMemo } from 'react';
import {
  volumeByWeek,
  sessionsByWeek,
  prCountInRange,
  topExercisesByVolume,
  volumeByExercise,
  workoutDates,
  dateRangeFromPreset,
  dominantUnit,
} from '../utils/statsHelpers';
import { calculateStreaks } from '../utils/streaks';
import VolumeChart from '../components/charts/VolumeChart';
import SessionsChart from '../components/charts/SessionsChart';
import CalendarHeatmap from '../components/charts/CalendarHeatmap';
import ExerciseVolumeChart from '../components/charts/ExerciseVolumeChart';
import { CalendarDays, Dumbbell, Flame, Target, TrendingUp, Trophy } from 'lucide-react';

const RANGES = ['1W', '4W', '3M', 'ALL'];

function formatVolume(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return String(Math.round(v));
}

function rangeCopy(range) {
  switch (range) {
    case '1W':
      return 'Last 7 days';
    case '4W':
      return 'Last 4 weeks';
    case '3M':
      return 'Last 3 months';
    default:
      return 'All logged training';
  }
}

export default function StatsView({ logs, completedDates }) {
  const [range, setRange] = useState('4W');

  const completedLogs = useMemo(() => {
    const filtered = {};
    for (const [key, log] of Object.entries(logs)) {
      if (log.completedAt) filtered[key] = log;
    }
    return filtered;
  }, [logs]);

  const dateRange = useMemo(() => dateRangeFromPreset(range), [range]);
  const unit = useMemo(() => dominantUnit(completedLogs, dateRange), [completedLogs, dateRange]);

  const volumeData = useMemo(() => volumeByWeek(completedLogs, dateRange, unit), [completedLogs, dateRange, unit]);
  const sessionsData = useMemo(() => sessionsByWeek(completedLogs, dateRange), [completedLogs, dateRange]);
  const prCount = useMemo(() => prCountInRange(completedLogs, dateRange, unit), [completedLogs, dateRange, unit]);
  const topExercises = useMemo(() => topExercisesByVolume(completedLogs, dateRange, 3, unit), [completedLogs, dateRange, unit]);
  const exerciseVolume = useMemo(() => volumeByExercise(completedLogs, dateRange, unit), [completedLogs, dateRange, unit]);
  const workoutDatesSet = useMemo(() => workoutDates(completedLogs, dateRange), [completedLogs, dateRange]);
  const streaks = useMemo(() => calculateStreaks(completedDates), [completedDates]);
  const totalVolume = useMemo(
    () => volumeData.reduce((sum, w) => sum + w.volume, 0),
    [volumeData]
  );
  const totalSessions = useMemo(
    () => sessionsData.reduce((sum, w) => sum + w.count, 0),
    [sessionsData]
  );

  const isEmpty = Object.keys(completedLogs).length === 0;
  const hasVolume = volumeData.some((week) => week.volume > 0);
  const hasSessions = sessionsData.some((week) => week.count > 0);

  if (isEmpty) {
    return (
      <div className="view stats-view">
        <section className="stats-view__empty" aria-labelledby="stats-empty-title">
          <div className="stats-view__empty-icon">
            <TrendingUp size={32} strokeWidth={1.8} />
          </div>
          <h3 id="stats-empty-title">No stats yet</h3>
          <p>Complete your first workout to see your stats here.</p>
          <div className="stats-view__empty-cue">
            <Dumbbell size={16} />
            Volume, PRs, and consistency unlock after one finish.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="view stats-view">
      <header className="stats-view__header">
        <div>
          <h1>Stats</h1>
          <p>{rangeCopy(range)} · {unit} volume</p>
        </div>
      </header>

      <div className="stats-view__range-pills" role="group" aria-label="Stats date range">
        {RANGES.map(p => (
          <button
            type="button"
            key={p}
            className={`stats-view__pill ${range === p ? 'stats-view__pill--active' : ''}`}
            aria-pressed={range === p}
            onClick={() => setRange(p)}
          >
            {p === 'ALL' ? 'All' : p}
          </button>
        ))}
      </div>

      <section className="stats-view__section stats-view__section--strength">
        <div className="stats-view__section-heading">
          <h3 className="stats-view__section-title">
            <span className="stats-view__section-icon">
              <Trophy size={18} />
            </span>
            Getting Stronger
          </h3>
          <p>Load trends, new bests, and the lifts driving the work.</p>
        </div>

        <div className="stats-view__strength-layout">
          <div className="stats-view__chart-panel stats-view__chart-panel--primary">
            <div className="stats-view__metric-row">
              <span className="stats-view__metric-label">Total Volume ({unit})</span>
              <span className="stats-view__metric-value">{formatVolume(totalVolume)}</span>
            </div>
            {hasVolume ? (
              <VolumeChart data={volumeData} />
            ) : (
              <p className="stats-view__no-data">No weight-based volume in this range.</p>
            )}
          </div>

          <aside className="stats-view__side-panel">
            <div className="stats-pr-callout">
              <span className="stats-pr-callout__icon">
                <Trophy size={18} />
              </span>
              <span className="stats-badge__value stats-badge__value--accent">{prCount}</span>
              <span className="stats-badge__label">PRs</span>
            </div>

            {topExercises.length > 0 && (
              <div className="stats-view__top-exercises">
                <h4 className="stats-view__sub-title">Top Exercises</h4>
                {topExercises.map((ex, i) => (
                  <div key={ex.exercise} className="stats-view__top-exercise">
                    <span className="stats-view__top-rank">{i + 1}</span>
                    <span className="stats-view__top-name">{ex.exercise}</span>
                    <span className="stats-view__top-vol">{formatVolume(ex.volume)} {ex.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="stats-view__section stats-view__section--consistency">
        <div className="stats-view__section-heading">
          <h3 className="stats-view__section-title">
            <span className="stats-view__section-icon">
              <Flame size={18} />
            </span>
            Consistency
          </h3>
          <p>How often training actually happened.</p>
        </div>

        <div className="stats-view__consistency-band">
          <div className="stats-view__streak-focus">
            <span className="stats-view__streak-icon">
              <Flame size={18} />
            </span>
            <span className="stats-badge__value stats-badge__value--green">
              {streaks.currentStreak}
            </span>
            <span className="stats-badge__label">
              Current Streak
              {streaks.isActiveToday && <span className="stats-view__active-dot" aria-label="Active today"></span>}
            </span>
          </div>

          <div className="stats-view__consistency-list">
            <div className="stats-view__mini-stat">
              <CalendarDays size={15} />
              <span className="stats-badge__label">Best Streak</span>
              <span className="stats-badge__value">{streaks.longestStreak}</span>
            </div>
            <div className="stats-view__mini-stat">
              <Dumbbell size={15} />
              <span className="stats-badge__label">Sessions</span>
              <span className="stats-badge__value">{totalSessions}</span>
            </div>
          </div>
        </div>

        <div className="stats-view__chart-panel">
          {hasSessions ? (
            <SessionsChart data={sessionsData} />
          ) : (
            <p className="stats-view__no-data">No sessions in this range.</p>
          )}
        </div>

        <div className="stats-view__chart-panel stats-view__chart-panel--heatmap">
          <CalendarHeatmap dates={workoutDatesSet} range={dateRange} />
        </div>
      </section>

      <section className="stats-view__section stats-view__section--balance">
        <div className="stats-view__section-heading">
          <h3 className="stats-view__section-title">
            <span className="stats-view__section-icon">
              <Target size={18} />
            </span>
            Balance
          </h3>
          <p>Volume distribution by exercise.</p>
        </div>

        <div className="stats-view__chart-panel stats-view__chart-panel--balance">
          {exerciseVolume.length > 0 ? (
            <ExerciseVolumeChart data={exerciseVolume} />
          ) : (
            <p className="stats-view__no-data">No exercise volume in this range.</p>
          )}
        </div>
      </section>
    </div>
  );
}
