import { useMemo } from 'react';
import { ArrowLeft, CheckCircle2, MinusCircle, TrendingUp } from 'lucide-react';
import { ROUTE_LIBRARY } from '../constants';
import ProgressChart from '../components/ProgressChart';
import { estimated1RM, epley, brzycki } from '../utils/oneRepMax';

export default function ExerciseHistoryView({ exerciseTitle, allLogs, navigate }) {
  const sessions = useMemo(() => {
    return allLogs
      .filter((log) => log.completedAt && log.exercises?.[exerciseTitle])
      .map((log) => ({
        date: log.date,
        workoutTitle: log.workoutTitle,
        sets: log.exercises[exerciseTitle],
        exerciseNote: (log.exerciseNotes || {})[exerciseTitle] || null,
      }));
  }, [allLogs, exerciseTitle]);

  const best1RM = useMemo(() => {
    let best = null;
    for (const session of sessions) {
      for (const set of session.sets || []) {
        if (!set.completed) continue;
        const w = Number(set.actualWeight);
        const r = Number(set.actualReps);
        if (!w || !r || w <= 0 || r <= 0) continue;
        const est = estimated1RM(w, r);
        if (est > 0 && (!best || est > best.est)) {
          best = { est, weight: w, reps: r, unit: set.unit || 'lb', epley: epley(w, r), brzycki: brzycki(w, r) };
        }
      }
    }
    return best;
  }, [sessions]);

  const chartSessions = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let runningMax = -Infinity;
    return sorted.reduce((acc, session) => {
      const completedSets = (session.sets || []).filter(
        (s) => s.completed === true && s.actualWeight != null && s.actualWeight !== '' && Number(s.actualWeight) > 0
      );
      if (completedSets.length === 0) return acc;

      const bestSet = completedSets.reduce((best, s) =>
        Number(s.actualWeight) > Number(best.actualWeight) ? s : best
      );
      const bestWeight = Number(bestSet.actualWeight);
      const bestReps = Number(bestSet.actualReps) || 0;
      const volume = completedSets.reduce(
        (sum, s) => sum + (Number(s.actualReps) || 0) * Number(s.actualWeight),
        0
      );
      const unit = (completedSets[0].unit) || 'lb';
      const isPR = bestWeight > runningMax;
      if (isPR) runningMax = bestWeight;

      acc.push({ date: session.date, bestWeight, bestReps, volume, unit, isPR });
      return acc;
    }, []);
  }, [sessions]);

  const completedSetCount = useMemo(() => {
    return sessions.reduce(
      (total, session) => total + (session.sets || []).filter((set) => set.completed).length,
      0
    );
  }, [sessions]);

  return (
    <div className="view exercise-history-view">
      <div className="exercise-history-view__header">
        <button
          className="btn btn-secondary btn-small exercise-history-view__back"
          onClick={() => navigate(ROUTE_LIBRARY)}
        >
          <ArrowLeft size={14} />
          Library
        </button>
        <div className="exercise-history-view__title-row">
          <div>
            <h1 className="exercise-history-view__title">{exerciseTitle}</h1>
            <p className="exercise-history-view__subtitle">
              {sessions.length} session{sessions.length !== 1 ? 's' : ''} logged / {completedSetCount} completed set{completedSetCount !== 1 ? 's' : ''}
            </p>
          </div>
          <span className="exercise-history-view__icon" aria-hidden="true">
            <TrendingUp size={20} />
          </span>
        </div>
      </div>

      {best1RM && (
        <div className="exercise-history-view__1rm-card">
          <div>
            <p className="exercise-history-view__1rm-label">Estimated 1RM</p>
            <div className="exercise-history-view__1rm-value">
              <span>{Math.round(best1RM.est)}</span>
              <small>{best1RM.unit}</small>
            </div>
          </div>
          <div className="exercise-history-view__1rm-meta">
            <div className="exercise-history-view__1rm-basis">
              Based on {best1RM.weight} {best1RM.unit} x {best1RM.reps} rep{best1RM.reps !== 1 ? 's' : ''}
            </div>
            <div className="exercise-history-view__1rm-formulas">
              Epley {Math.round(best1RM.epley)} / Brzycki {Math.round(best1RM.brzycki)}
            </div>
          </div>
        </div>
      )}

      {chartSessions.length >= 2 && (
        <div className="exercise-history-view__chart-wrapper">
          <ProgressChart sessions={chartSessions} />
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><TrendingUp size={34} /></div>
          <h3>No history yet</h3>
          <p className="text-secondary">Complete this exercise in a workout and its load trend will appear here.</p>
        </div>
      ) : (
        <div className="exercise-history-view__list">
          {sessions.map((session, idx) => (
            <div key={idx} className="card exercise-history-session">
              <div className="exercise-history-session__meta">
                <div>
                  <span className="exercise-history-session__date">
                    {new Date(session.date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="exercise-history-session__workout">{session.workoutTitle}</span>
                </div>
                <span className="exercise-history-session__set-count">
                  {(session.sets || []).filter((set) => set.completed).length}/{session.sets?.length || 0} done
                </span>
              </div>

              <div className="exercise-history-session__table-wrap">
                <table className="exercise-history-session__table">
                  <thead>
                    <tr>
                      <th>Set</th>
                      <th>Target</th>
                      <th>Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.sets.map((set, sIdx) => {
                      const targetReps = set.targetReps ?? '-';
                      const targetWeight = set.targetWeight != null ? `${set.targetWeight}` : null;
                      const target = targetWeight ? `${targetReps} x ${targetWeight}` : `${targetReps} reps`;
                      const actualReps = set.actualReps !== '' && set.actualReps != null ? set.actualReps : '-';
                      const actualWeight = set.actualWeight !== '' && set.actualWeight != null ? `${set.actualWeight}` : null;
                      const actual = actualWeight ? `${actualReps} x ${actualWeight}` : `${actualReps}`;
                      return (
                        <tr key={sIdx} className={set.completed ? '' : 'exercise-history-session__row--skipped'}>
                          <td>{sIdx + 1}</td>
                          <td>{target}</td>
                          <td>
                            <span className={set.completed ? 'exercise-history-session__actual--done' : 'exercise-history-session__actual--skipped'}>
                              {set.completed ? <CheckCircle2 size={14} /> : <MinusCircle size={14} />}
                              {actual}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {session.exerciseNote && (
                <p className="exercise-history-session__note">
                  {session.exerciseNote}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
