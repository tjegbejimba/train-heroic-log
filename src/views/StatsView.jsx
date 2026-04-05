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
import { TrendingUp, Flame, Trophy, Target } from 'lucide-react';

const RANGES = ['1W', '4W', '3M', 'ALL'];

function formatVolume(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return String(Math.round(v));
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

  if (isEmpty) {
    return (
      <div className="stats-view">
        <div className="stats-view__empty">
          <TrendingUp size={48} strokeWidth={1.5} />
          <h3>No stats yet</h3>
          <p>Complete your first workout to see your stats here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-view">
      <div className="stats-view__range-pills">
        {RANGES.map(p => (
          <button
            key={p}
            className={`stats-view__pill ${range === p ? 'stats-view__pill--active' : ''}`}
            onClick={() => setRange(p)}
          >
            {p === 'ALL' ? 'All' : p}
          </button>
        ))}
      </div>

      {/* Getting Stronger */}
      <section className="stats-view__section">
        <h3 className="stats-view__section-title">
          <Trophy size={18} /> Getting Stronger
        </h3>
        <div className="stats-view__badges">
          <div className="stats-badge">
            <span className="stats-badge__value stats-badge__value--accent">{prCount}</span>
            <span className="stats-badge__label">PRs</span>
          </div>
          <div className="stats-badge">
            <span className="stats-badge__value">{formatVolume(totalVolume)}</span>
            <span className="stats-badge__label">Total Volume ({unit})</span>
          </div>
        </div>
        <VolumeChart data={volumeData} />
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
      </section>

      {/* Consistency */}
      <section className="stats-view__section">
        <h3 className="stats-view__section-title">
          <Flame size={18} /> Consistency
        </h3>
        <div className="stats-view__badges">
          <div className="stats-badge">
            <span className="stats-badge__value stats-badge__value--green">
              {streaks.currentStreak}
            </span>
            <span className="stats-badge__label">
              Current Streak {streaks.isActiveToday ? '🔥' : ''}
            </span>
          </div>
          <div className="stats-badge">
            <span className="stats-badge__value">{streaks.longestStreak}</span>
            <span className="stats-badge__label">Best Streak</span>
          </div>
          <div className="stats-badge">
            <span className="stats-badge__value">{totalSessions}</span>
            <span className="stats-badge__label">Sessions</span>
          </div>
        </div>
        <SessionsChart data={sessionsData} />
        <CalendarHeatmap dates={workoutDatesSet} range={dateRange} />
      </section>

      {/* Balance */}
      <section className="stats-view__section">
        <h3 className="stats-view__section-title">
          <Target size={18} /> Balance
        </h3>
        <ExerciseVolumeChart data={exerciseVolume} />
      </section>
    </div>
  );
}
