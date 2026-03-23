import { useState, useMemo } from 'react';
import { BarChart2, FileText, ChevronDown, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import Modal from '../components/Modal';

export default function HistoryView({ allLogs, deleteLog, workouts }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Only show completed workouts
  const completedLogs = useMemo(
    () => allLogs.filter((log) => log.completedAt),
    [allLogs]
  );

  // Build PR map: for each exercise, track best weight per rep count
  const prMap = useMemo(() => {
    // { exerciseName: { "reps:weight" => { logKey, date } } }
    // Track the best weight for each exercise (highest weight with at least 1 completed set)
    const bests = {}; // exerciseName -> { weight, reps, logKey, date }

    // Process logs in chronological order (oldest first)
    const chronological = [...completedLogs].reverse();

    chronological.forEach((log) => {
      Object.entries(log.exercises || {}).forEach(([exName, sets]) => {
        sets.forEach((set) => {
          if (!set.completed || !set.actualWeight || set.actualWeight === '') return;
          const w = parseFloat(set.actualWeight);
          if (isNaN(w) || w <= 0) return;

          if (!bests[exName] || w > bests[exName].weight) {
            bests[exName] = {
              weight: w,
              reps: set.actualReps,
              logKey: log.key,
              date: log.date,
            };
          }
        });
      });
    });

    return bests;
  }, [completedLogs]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
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

  const calcVolume = (exercises) => {
    let total = 0;
    Object.values(exercises || {}).forEach((sets) => {
      sets.forEach((set) => {
        if (set.completed && set.actualReps && set.actualWeight) {
          const reps = parseFloat(set.actualReps);
          const weight = parseFloat(set.actualWeight);
          if (!isNaN(reps) && !isNaN(weight)) {
            total += reps * weight;
          }
        }
      });
    });
    return total;
  };

  const formatVolume = (vol) => {
    if (vol === 0) return null;
    if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k lbs`;
    return `${Math.round(vol)} lbs`;
  };

  const isSetPR = (exName, set, logKey) => {
    if (!set.completed || !set.actualWeight) return false;
    const pr = prMap[exName];
    return (
      pr &&
      pr.logKey === logKey &&
      parseFloat(set.actualWeight) === pr.weight
    );
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

          return (
            <div key={log.key} className="history-card card">
              <button
                className="history-card__toggle"
                onClick={() => setExpandedKey(isExpanded ? null : log.key)}
              >
                <div className="history-card__summary">
                  <div className="history-card__date">
                    {formatDate(log.date)}
                  </div>
                  <h3 className="history-card__title">{log.workoutTitle}</h3>
                  <div className="history-card__meta">
                    <span>
                      {formatDuration(log.startedAt, log.completedAt)}
                    </span>
                    <span className="history-card__dot"></span>
                    <span>{exerciseNames.length} exercises</span>
                    <span className="history-card__dot"></span>
                    <span>
                      {completedSets}/{totalSets} sets
                    </span>
                    {volumeStr && (
                      <>
                        <span className="history-card__dot"></span>
                        <span>{volumeStr}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="history-card__chevron">
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </span>
              </button>

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
                            const isPR = isSetPR(exName, set, log.key);
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
                                      PR
                                    </span>
                                  )}
                                </span>
                                <span>
                                  {set.completed
                                    ? <CheckCircle2 size={15} style={{ color: 'var(--color-accent-blue)' }} />
                                    : <Circle size={15} style={{ opacity: 0.3 }} />}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  <button
                    className="btn btn-secondary btn-small history-card__delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(log.key);
                    }}
                  >
                    Delete Log
                  </button>
                </div>
              )}
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
        />
      )}
    </div>
  );
}
