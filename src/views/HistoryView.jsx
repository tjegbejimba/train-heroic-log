import { useState, useMemo } from 'react';
import {
  BarChart2,
  CheckCircle2,
  ChevronDown,
  Circle,
  Dumbbell,
  FileText,
  Flame,
  Timer,
  Trash2,
  Trophy,
  Weight,
} from 'lucide-react';
import Modal from '../components/Modal';
import { calculateStreaks } from '../utils/streaks';

const VOLUME_UNITS = new Set(['lb', 'kg']);

export default function HistoryView({ allLogs, deleteLog, workouts, completedDates }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const streaks = useMemo(
    () => calculateStreaks(completedDates || new Set()),
    [completedDates]
  );

  const completedLogs = useMemo(
    () => allLogs.filter((log) => log.completedAt),
    [allLogs]
  );

  const prMap = useMemo(() => {
    const bests = {};
    const chronological = [...completedLogs].reverse();

    chronological.forEach((log) => {
      Object.entries(log.exercises || {}).forEach(([exName, sets]) => {
        sets.forEach((set, setIdx) => {
          if (!set.completed || !set.actualWeight || set.actualWeight === '') return;
          const w = parseFloat(set.actualWeight);
          const reps = parseInt(set.actualReps, 10);
          if (isNaN(w) || w <= 0 || isNaN(reps) || reps <= 0) return;

          if (!bests[exName]) bests[exName] = {};
          const prev = bests[exName][reps];
          if (!prev || w > prev.weight) {
            bests[exName][reps] = {
              weight: w,
              logKey: log.key,
              date: log.date,
              setIdx,
            };
          }
        });
      });
    });

    return bests;
  }, [completedLogs]);

  const formatDayNumber = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.getDate();
  };

  const formatMonthAbbr = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short' });
  };

  const formatDayAbbr = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const formatFullDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDuration = (startedAt, completedAt) => {
    if (!startedAt || !completedAt) return '--';
    const ms = new Date(completedAt) - new Date(startedAt);
    const totalMin = Math.floor(ms / 60000);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const getExerciseUnit = (exName, sets) => {
    if (sets[0]?.unit) return sets[0].unit;
    if (workouts) {
      for (const w of Object.values(workouts)) {
        for (const block of w.blocks || []) {
          for (const ex of block.exercises || []) {
            if (ex.title === exName && ex.sets?.[0]?.unit) {
              return ex.sets[0].unit;
            }
          }
        }
      }
    }
    return 'lb';
  };

  const calcVolume = (exercises) => {
    const totals = {};
    Object.entries(exercises || {}).forEach(([exName, sets]) => {
      const unit = getExerciseUnit(exName, sets);
      if (!VOLUME_UNITS.has(unit)) return;
      sets.forEach((set) => {
        if (set.completed && set.actualReps && set.actualWeight) {
          const reps = parseFloat(set.actualReps);
          const weight = parseFloat(set.actualWeight);
          if (!isNaN(reps) && !isNaN(weight)) {
            totals[unit] = (totals[unit] || 0) + reps * weight;
          }
        }
      });
    });
    return totals;
  };

  const formatVolume = (totals) => {
    const parts = Object.entries(totals)
      .filter(([, vol]) => vol > 0)
      .map(([unit, vol]) => {
        if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k ${unit}`;
        return `${Math.round(vol)} ${unit}`;
      });
    if (parts.length === 0) return null;
    return parts.join(' · ');
  };

  const formatSetLoad = (reps, weight) => {
    if (reps == null || reps === '') return '--';
    const load = weight !== '' && weight != null ? weight : 'BW';
    return `${reps} × ${load}`;
  };

  const getSetPR = (exName, set, logKey, setIdx) => {
    if (!set.completed || !set.actualWeight) return null;
    const reps = parseInt(set.actualReps, 10);
    if (isNaN(reps) || reps <= 0) return null;
    const exPRs = prMap[exName];
    if (!exPRs) return null;
    const pr = exPRs[reps];
    if (
      pr &&
      pr.logKey === logKey &&
      parseFloat(set.actualWeight) === pr.weight &&
      setIdx === pr.setIdx
    ) {
      return reps;
    }
    return null;
  };

  const countPRs = (log) => {
    let count = 0;
    Object.entries(log.exercises || {}).forEach(([exName, sets]) => {
      sets.forEach((set, setIdx) => {
        if (getSetPR(exName, set, log.key, setIdx) !== null) count++;
      });
    });
    return count;
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteLog(deleteTarget);
      setDeleteTarget(null);
      if (expandedKey === deleteTarget) setExpandedKey(null);
    }
  };

  if (completedLogs.length === 0) {
    return (
      <div className="view history-view">
        <header className="history-view__header">
          <h1>History</h1>
          <p className="history-view__lede">
            Completed sessions will become your training timeline.
          </p>
        </header>

        <section className="history-empty" aria-labelledby="history-empty-title">
          <div className="history-empty__icon">
            <BarChart2 size={32} strokeWidth={1.8} />
          </div>
          <h2 id="history-empty-title">No completed workouts yet</h2>
          <p>
            Finish a workout and this screen will stack your volume, PRs,
            streaks, and session notes in one calm timeline.
          </p>
          <div className="history-empty__cue">
            <Dumbbell size={16} />
            Start from the Training tab, then come back here.
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="view history-view">
      <header className="history-view__header">
        <h1>History</h1>
        <p className="history-view__lede">
          <span className="history-view__count">{completedLogs.length}</span>{' '}
          workout{completedLogs.length !== 1 ? 's' : ''} completed, latest first.
        </p>
      </header>

      {completedDates && completedDates.size > 0 && (
        <section className="streak-bar" aria-label="Workout streak summary">
          <div className="streak-bar__primary">
            <span className={`streak-bar__icon ${streaks.isActiveToday ? 'streak-bar__icon--active' : ''}`}>
              <Flame size={22} strokeWidth={2.2} />
            </span>
            <span className="streak-bar__value">{streaks.currentStreak}</span>
            <span className="streak-bar__label">Current streak</span>
          </div>

          <div className="streak-bar__secondary">
            <Trophy size={16} strokeWidth={2} />
            <span className="streak-bar__secondary-value">{streaks.longestStreak}</span>
            <span>Best streak</span>
          </div>

          {streaks.currentStreak > 0 && !streaks.isActiveToday && (
            <p className="streak-bar__nudge">
              <Flame size={14} />
              Workout today to keep the streak alive.
            </p>
          )}
        </section>
      )}

      <div className="history-view__list" aria-label="Completed workouts">
        {completedLogs.map((log) => {
          const isExpanded = expandedKey === log.key;
          const exerciseNames = Object.keys(log.exercises || {});
          const allSets = Object.values(log.exercises || {}).flat();
          const totalSets = allSets.length;
          const completedSets = allSets.filter((s) => s.completed).length;
          const volumeStr = formatVolume(calcVolume(log.exercises));
          const prCount = countPRs(log);
          const duration = formatDuration(log.startedAt, log.completedAt);
          const fullDate = formatFullDate(log.date);

          return (
            <article
              key={log.key}
              className={`history-entry ${isExpanded ? 'history-entry--open' : ''}`}
            >
              <div className="history-entry__date-col" aria-label={fullDate}>
                <span className="history-entry__day-num">
                  {formatDayNumber(log.date)}
                </span>
                <span className="history-entry__month">
                  {formatMonthAbbr(log.date)}
                </span>
                <span className="history-entry__weekday">
                  {formatDayAbbr(log.date)}
                </span>
              </div>

              <div className="history-card">
                <div className="history-card__top">
                  <button
                    type="button"
                    className="history-card__toggle"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedKey(isExpanded ? null : log.key)}
                  >
                    <span className="history-card__summary">
                      <span className="history-card__title-row">
                        <span className="history-card__title">{log.workoutTitle}</span>
                        {prCount > 0 && (
                          <span className="history-card__pr-count-badge">
                            <Trophy size={12} strokeWidth={2.4} />
                            {prCount} PR{prCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </span>

                      <span className="history-card__meta">
                        {duration !== '--' && (
                          <span className="history-card__meta-item">
                            <Timer size={13} />
                            <span className="history-card__metric-value">{duration}</span>
                          </span>
                        )}
                        {volumeStr && (
                          <span className="history-card__meta-item history-card__meta-item--volume">
                            <Weight size={13} />
                            <span className="history-card__metric-value">{volumeStr}</span>
                          </span>
                        )}
                        <span className="history-card__meta-item">
                          <Dumbbell size={13} />
                          <span className="history-card__metric-value">
                            {completedSets}/{totalSets}
                          </span>
                          sets
                        </span>
                      </span>
                    </span>

                    <ChevronDown
                      className="history-card__chevron"
                      size={18}
                      aria-hidden="true"
                    />
                  </button>

                  <button
                    type="button"
                    className="history-card__delete-btn"
                    aria-label={`Delete ${log.workoutTitle} from ${fullDate}`}
                    onClick={() => setDeleteTarget(log.key)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="history-card__details">
                    {log.workoutNote && (
                      <div className="history-card__workout-note">
                        <span className="history-card__workout-note-label">
                          Session note
                        </span>
                        <p>{log.workoutNote}</p>
                      </div>
                    )}

                    {exerciseNames.map((exName) => {
                      const sets = log.exercises[exName];
                      return (
                        <section key={exName} className="history-card__exercise">
                          <div className="history-card__exercise-header">
                            <h4 className="history-card__exercise-name">
                              {exName}
                            </h4>
                            <span className="history-card__exercise-count">
                              {sets.filter((set) => set.completed).length}/{sets.length} sets
                            </span>
                          </div>

                          {(log.exerciseNotes || {})[exName] && (
                            <p className="history-card__exercise-note">
                              <FileText size={13} />
                              {log.exerciseNotes[exName]}
                            </p>
                          )}

                          <div className="history-card__sets-table" role="table" aria-label={`${exName} logged sets`}>
                            <div className="history-card__sets-header" role="row">
                              <span role="columnheader">Set</span>
                              <span role="columnheader">Target</span>
                              <span role="columnheader">Actual</span>
                              <span role="columnheader" aria-label="Status"></span>
                            </div>

                            {sets.map((set, idx) => {
                              const prReps = getSetPR(exName, set, log.key, idx);
                              const isPR = prReps !== null;
                              return (
                                <div
                                  key={idx}
                                  className={`history-card__set-row ${
                                    set.completed
                                      ? 'history-card__set-row--completed'
                                      : ''
                                  } ${isPR ? 'history-card__set-row--pr' : ''}`}
                                  role="row"
                                >
                                  <span className="history-card__set-index" role="cell">
                                    {idx + 1}
                                  </span>
                                  <span className="history-card__set-value" role="cell">
                                    {formatSetLoad(set.targetReps, set.targetWeight)}
                                  </span>
                                  <span className="history-card__set-value history-card__set-value--actual" role="cell">
                                    {formatSetLoad(set.actualReps, set.actualWeight)}
                                    {isPR && (
                                      <span className="history-card__pr-badge">
                                        <Trophy size={11} strokeWidth={2.4} />
                                        PR @ {prReps} rep{prReps !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </span>
                                  <span className="history-card__set-status" role="cell">
                                    {set.completed
                                      ? (
                                        <CheckCircle2
                                          size={16}
                                          className="history-card__status-icon history-card__status-icon--complete"
                                          aria-label="Completed"
                                        />
                                      )
                                      : (
                                        <Circle
                                          size={16}
                                          className="history-card__status-icon history-card__status-icon--open"
                                          aria-label="Not completed"
                                        />
                                      )}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {deleteTarget && (
        <Modal
          title="Delete Workout Log?"
          message="This will permanently remove this workout from your history."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirmText="Delete"
          cancelText="Keep"
          isDestructive
        />
      )}
    </div>
  );
}
