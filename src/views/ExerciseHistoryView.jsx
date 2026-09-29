import { useMemo } from 'react';
import { ArrowLeft, CheckCircle2, MinusCircle, TrendingUp } from 'lucide-react';
import { ROUTE_LIBRARY } from '../constants';
import ProgressChart from '../components/ProgressChart';
import { buildTrainingHistory } from '../history/trainingHistory';

export default function ExerciseHistoryView({ exerciseTitle, allLogs, navigate }) {
  const history = useMemo(() => buildTrainingHistory(allLogs), [allLogs]);
  const { sessions, completedSetCount, best1RM, progress } = useMemo(
    () => history.exerciseTimeline(exerciseTitle),
    [history, exerciseTitle]
  );
  // The first Session is a Baseline (nothing to beat yet); only a genuine
  // Top-set record earns the chart's PR marker.
  const chartSessions = useMemo(
    () => progress.map((point) => ({ ...point, isPR: point.kind === 'pr' })),
    [progress]
  );

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
          {sessions.map((session) => (
            <div key={session.logKey} className="card exercise-history-session">
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
