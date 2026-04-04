import { useState, useMemo } from 'react';
import { BarChart2, FileText, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import { calculateStreaks } from '../utils/streaks';

export default function HistoryView({ allLogs, deleteLog, workouts, completedDates }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const streaks = useMemo(
    () => calculateStreaks(completedDates || new Set()),
    [completedDates]
  );

  // Only show completed workouts
  const completedLogs = useMemo(
    () => allLogs.filter((log) => log.completedAt),
    [allLogs]
  );

  // Build PR map: for each exercise, track best weight per rep count
  const prMap = useMemo(() => {
    // bests[exName][repCount] = { weight, logKey, date, setIdx }
    const bests = {};

    // Process logs in chronological order (oldest first)
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

  const formatDuration = (startedAt, completedAt) => {
    if (!startedAt || !completedAt) return '--';
    const ms = new Date(completedAt) - new Date(startedAt);
    const totalMin = Math.floor(ms / 60000);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  // Helper: look up the unit for an exercise from the workout definition or the logged set
  const getExerciseUnit = (exName, sets) => {
    // New logs store unit on each set
    if (sets[0]?.unit) return sets[0].unit;
    // Fall back to workout definition
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

  // Units where volume (reps x weight) is meaningful
  const VOLUME_UNITS = new Set(['lb', 'kg']);

  const calcVolume = (exercises) => {
    const totals = {}; // unit -> total
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
        const label = unit;
        if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k ${label}`;
        return `${Math.round(vol)} ${label}`;
      });
    if (parts.length === 0) return null;
    return parts.join(' \u00b7 ');
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

  // Count PRs for a log entry
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
        <div className="history-view__header">
          <h1>History</h1>
        </div>
        <div className="empty-state">
          <div className="empty-state-icon"><BarChart2 size={48} /></div>
          <h3>No completed workouts yet</h3>
          <p className="text-secondary">
            Complete a workout session to see it here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="view history-view">
      <div className="history-view__header">
        <h1>History</h1>
        <p className="text-secondary text-sm">
          {completedLogs.length} workout{completedLogs.length !== 1 ? 's' : ''}{' '}
          completed
        </p>
      </div>

      {completedDates && completedDates.size > 0 && (
        <div className="streak-bar">
          <div className="streak-bar__stat">
            <span className={`streak-bar__icon ${streaks.isActiveToday ? 'streak-bar__icon--active' : ''}`}>🔥</span>
            <span className="streak-bar__value">{streaks.currentStreak}</span>
            <span className="streak-bar__label">
              {streaks.currentStreak === 0 ? 'No streak' : streaks.currentStreak === 1 ? 'day' : 'days'}
            </span>
          </div>
          <div className="streak-bar__divider" />
          <div className="streak-bar__stat">
            <span className="streak-bar__icon">🏆</span>
            <span className="streak-bar__value">{streaks.longestStreak}</span>
            <span className="streak-bar__label">{streaks.longestStreak === 1 ? 'day best' : 'days best'}</span>
          </div>
          {streaks.currentStreak > 0 && !streaks.isActiveToday && (
            <div className="streak-bar__nudge">Workout today to keep your streak!</div>
          )}
        </div>
      )}

      <div className="history-view__list">
        {completedLogs.map((log) => {
          const isExpanded = expandedKey === log.key;
          const exerciseNames = Object.keys(log.exercises || {});
          const totalSets = Object.values(log.exercises || {}).flat().length;
          const completedSets = Object.values(log.exercises || {})
            .flat()
            .filter((s) => s.completed).length;
          const volume = calcVolume(log.exercises);
          const volumeStr = formatVolume(volume);
          const prCount = countPRs(log);
          const duration = formatDuration(log.startedAt, log.completedAt);

          return (
            <div key={log.key} className="history-entry">
              {/* Left column: date badge */}
              <div className="history-entry__date-col">
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

              {/* Right column: card */}
              <div className="history-card">
                <div
                  role="button"
                  tabIndex={0}
                  className="history-card__toggle"
                  onClick={() => setExpandedKey(isExpanded ? null : log.key)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedKey(isExpanded ? null : log.key); } }}
                >
                  <div className="history-card__summary">
                    <div className="history-card__title-row">
                      <h3 className="history-card__title">{log.workoutTitle}</h3>
                      {prCount > 0 && (
                        <span className="history-card__pr-count-badge">
                          {prCount} PR{prCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="history-card__meta">
                      {duration !== '--' && (
                        <span>{duration}</span>
                      )}
                      {volumeStr && (
                        <>
                          <span className="history-card__dot" />
                          <span>{volumeStr}</span>
                        </>
                      )}
                      <span className="history-card__dot" />
                      <span>{completedSets}/{totalSets} sets</span>
                    </div>
                  </div>

                  <button
                    className="history-card__delete-btn"
                    aria-label="Delete log"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(log.key);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="history-card__details">
                    {/* Overall workout note */}
                    {log.workoutNote && (
                      <div className="history-card__workout-note">
                        <span className="history-card__workout-note-label">
                          Session Note
                        </span>
                        <p>{log.workoutNote}</p>
                      </div>
                    )}

                    {exerciseNames.map((exName) => {
                      const sets = log.exercises[exName];
                      return (
                        <div key={exName} className="history-card__exercise">
                          <h4 className="history-card__exercise-name">
                            {exName}
                          </h4>
                          {(log.exerciseNotes || {})[exName] && (
                            <p className="history-card__exercise-note">
                              <FileText size={13} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                              {log.exerciseNotes[exName]}
                            </p>
                          )}
                          <div className="history-card__sets-table">
                            <div className="history-card__sets-header">
                              <span>Set</span>
                              <span>Target</span>
                              <span>Actual</span>
                              <span></span>
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
                                >
                                  <span className="text-secondary">
                                    {idx + 1}
                                  </span>
                                  <span className="text-secondary">
                                    {set.targetReps != null
                                      ? `${set.targetReps} × ${set.targetWeight || 'BW'}`
                                      : '--'}
                                  </span>
                                  <span>
                                    {set.actualReps !== '' &&
                                    set.actualReps != null
                                      ? `${set.actualReps} × ${set.actualWeight !== '' && set.actualWeight != null ? set.actualWeight : 'BW'}`
                                      : '--'}
                                    {isPR && (
                                      <span className="history-card__pr-badge">
                                        PR @ {prReps} rep{prReps !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                  </span>
                                  <span>
                                    {set.completed
                                      ? <CheckCircle2 size={15} style={{ color: 'var(--color-accent-green)' }} />
                                      : <Circle size={15} style={{ opacity: 0.3 }} />}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
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
