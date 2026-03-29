import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ROUTE_LIBRARY } from '../constants';
import ProgressChart from '../components/ProgressChart';

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

  return (
    <div className="view exercise-history-view">
      <div className="exercise-history-view__header">
        <button
          className="btn btn-secondary btn-small exercise-history-view__back"
          onClick={() => navigate(ROUTE_LIBRARY)}
        >
          <ArrowLeft size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
          Library
        </button>
        <h1 className="exercise-history-view__title">{exerciseTitle}</h1>
        <p className="text-secondary text-sm">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} logged
        </p>
      </div>

      {chartSessions.length >= 2 && (
        <div className="exercise-history-view__chart-wrapper">
          <ProgressChart sessions={chartSessions} />
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="empty-state">
          <p className="text-secondary">No completed sessions for this exercise yet.</p>
        </div>
      ) : (
        <div className="exercise-history-view__list">
          {sessions.map((session, idx) => (
            <div key={idx} className="card exercise-history-session">
              <div className="exercise-history-session__meta">
                <span className="exercise-history-session__date">
                  {new Date(session.date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="text-secondary text-sm">{session.workoutTitle}</span>
              </div>

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
                    const targetReps = set.targetReps ?? '—';
                    const targetWeight = set.targetWeight != null ? `${set.targetWeight}` : null;
                    const target = targetWeight ? `${targetReps} × ${targetWeight}` : `${targetReps} reps`;
                    const actualReps = set.actualReps !== '' && set.actualReps != null ? set.actualReps : '—';
                    const actualWeight = set.actualWeight !== '' && set.actualWeight != null ? `${set.actualWeight}` : null;
                    const actual = actualWeight ? `${actualReps} × ${actualWeight}` : `${actualReps}`;
                    return (
                      <tr key={sIdx} className={set.completed ? '' : 'exercise-history-session__row--skipped'}>
                        <td>{sIdx + 1}</td>
                        <td className="text-secondary">{target}</td>
                        <td className={set.completed ? 'exercise-history-session__actual--done' : 'text-secondary'}>
                          {actual}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {session.exerciseNote && (
                <p className="exercise-history-session__note text-secondary text-sm">
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
