import { useState, useEffect, useRef, useCallback } from 'react';
import { Youtube, CheckCircle, ChevronDown, Pencil } from 'lucide-react';
import SessionHeader from '../components/SessionHeader';
import LogSetRow from '../components/LogSetRow';
import Modal from '../components/Modal';
import RestTimer from '../components/RestTimer';
import { useSettings } from '../hooks/useSettings';
import { parseLogKey } from '../constants';
import { extractVideoId } from '../utils/youtube';

export default function ActiveWorkoutView({
  logKey,
  workouts,
  logs,
  allLogs,
  saveLog,
  getYouTubeLink,
  onComplete,
  onCancel,
}) {
  const { date, workoutTitle } = parseLogKey(logKey);
  const workout = workouts[workoutTitle];
  const log = logs[logKey];

  const [currentLog, setCurrentLog] = useState(() => {
    if (log) return log;

    // Create new log skeleton
    return {
      logKey,
      workoutTitle,
      date,
      completedAt: null,
      startedAt: new Date().toISOString(),
      exercises: {},
      exerciseNotes: {},
      workoutNote: '',
    };
  });

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [completedLog, setCompletedLog] = useState(null);
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState({});
  const [editingNote, setEditingNote] = useState(null);
  const { settings } = useSettings();
  const workoutNoteTimerRef = useRef(null);

  // Initialize exercise logs
  useEffect(() => {
    if (!workout || currentLog.exercises && Object.keys(currentLog.exercises).length > 0) return;

    const newExercises = {};
    workout.blocks.forEach((block) => {
      block.exercises.forEach((exercise) => {
        newExercises[exercise.title] = exercise.sets.map((_, setIdx) => ({
          setIndex: setIdx,
          targetReps: exercise.sets[setIdx].reps,
          targetWeight: exercise.sets[setIdx].weight,
          unit: exercise.sets[setIdx].unit || exercise.unit || 'lb',
          actualReps: '',
          actualWeight: '',
          completed: false,
        }));
      });
    });

    const updated = { ...currentLog, exercises: newExercises };
    setCurrentLog(updated);
    saveLog(logKey, updated);
  }, []);

  // Save log on every change (crash recovery)
  const updateExerciseSet = (exerciseTitle, setIndex, newSetData) => {
    const wasCompleted = currentLog.exercises[exerciseTitle]?.[setIndex]?.completed;

    const updated = {
      ...currentLog,
      exercises: {
        ...currentLog.exercises,
        [exerciseTitle]: [
          ...currentLog.exercises[exerciseTitle].slice(0, setIndex),
          newSetData,
          ...currentLog.exercises[exerciseTitle].slice(setIndex + 1),
        ],
      },
    };
    setCurrentLog(updated);
    saveLog(logKey, updated);

    // Auto-start rest timer when a set transitions to completed
    if (!wasCompleted && newSetData.completed) {
      setRestTimerActive(true);
    }
  };

  const updateExerciseNote = (exerciseTitle, note) => {
    const updated = {
      ...currentLog,
      exerciseNotes: {
        ...(currentLog.exerciseNotes || {}),
        [exerciseTitle]: note,
      },
    };
    setCurrentLog(updated);
    saveLog(logKey, updated);
  };

  const updateWorkoutNote = useCallback((note) => {
    setCurrentLog((prev) => {
      const updated = { ...prev, workoutNote: note };
      if (workoutNoteTimerRef.current) clearTimeout(workoutNoteTimerRef.current);
      workoutNoteTimerRef.current = setTimeout(() => saveLog(logKey, updated), 500);
      return updated;
    });
  }, [logKey, saveLog]);

  useEffect(() => {
    return () => { if (workoutNoteTimerRef.current) clearTimeout(workoutNoteTimerRef.current); };
  }, []);

  const handleCompleteWorkout = () => {
    const completed = {
      ...currentLog,
      completedAt: new Date().toISOString(),
    };
    saveLog(logKey, completed);
    setCompletedLog(completed);
    setShowSummaryModal(true);
  };

  // Build summary data for the completion modal
  const buildSummary = (log) => {
    if (!log) return null;
    const allSetsFlat = Object.values(log.exercises).flat();
    const doneSets = allSetsFlat.filter((s) => s.completed);
    const totalCompleted = doneSets.length;

    // Volume grouped by unit
    const volumeByUnit = {};
    doneSets.forEach((s) => {
      if (s.actualReps && s.actualWeight) {
        const unit = s.unit || 'lb';
        volumeByUnit[unit] = (volumeByUnit[unit] || 0) + (s.actualReps * s.actualWeight);
      }
    });

    // PR detection: compare each completed set against previous best (max weight for same reps)
    const prs = [];
    if (Array.isArray(allLogs) && allLogs.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      // Build previous best: { exerciseTitle: { reps: maxWeight } }
      const prevBest = {};
      allLogs.forEach((prevLog) => {
        if (!prevLog || !prevLog.date || !prevLog.exercises) return;
        if (prevLog.date >= today) return;
        Object.entries(prevLog.exercises).forEach(([exTitle, sets]) => {
          sets.forEach((s) => {
            if (!s.completed || s.actualReps === '' || s.actualWeight === '') return;
            if (!prevBest[exTitle]) prevBest[exTitle] = {};
            const reps = s.actualReps;
            if (prevBest[exTitle][reps] === undefined || s.actualWeight > prevBest[exTitle][reps]) {
              prevBest[exTitle][reps] = s.actualWeight;
            }
          });
        });
      });

      // Check current session sets against previous bests
      const prSeen = new Set();
      Object.entries(log.exercises).forEach(([exTitle, sets]) => {
        sets.forEach((s) => {
          if (!s.completed || s.actualReps === '' || s.actualWeight === '') return;
          const best = prevBest[exTitle]?.[s.actualReps];
          const key = `${exTitle}:${s.actualReps}:${s.actualWeight}`;
          if ((best === undefined || s.actualWeight > best) && !prSeen.has(key)) {
            prSeen.add(key);
            prs.push({ exTitle, reps: s.actualReps, weight: s.actualWeight, unit: s.unit || 'lb' });
          }
        });
      });
    }

    return { totalCompleted, volumeByUnit, prs };
  };

  const handleCancelWorkout = () => {
    setShowCancelModal(false);
    onCancel();
  };

  const toggleFormNotes = (exerciseTitle) => {
    setExpandedNotes((prev) => ({ ...prev, [exerciseTitle]: !prev[exerciseTitle] }));
  };

  if (!workout) {
    return (
      <div className="view active-workout-view">
        <div className="empty-state">
          <p>Workout not found</p>
        </div>
      </div>
    );
  }

  // Count total and completed sets
  const allSets = Object.values(currentLog.exercises).flat();
  const completedSets = allSets.filter((s) => s.completed).length;
  const totalSets = allSets.length;
  const allDone = totalSets > 0 && completedSets === totalSets;
  const progressPct = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;

  return (
    <div className="view active-workout-view">
      <SessionHeader
        workoutTitle={workoutTitle}
        startedAt={currentLog.startedAt}
        onCancel={() => setShowCancelModal(true)}
        onTimerOpen={() => setRestTimerActive(true)}
      />

      {/* Sticky progress bar directly under header */}
      <div className="aw-progress">
        <div className="aw-progress__bar">
          <div className="aw-progress__fill" style={{ width: `${progressPct}%` }} />
        </div>
        <span className="aw-progress__label">
          {completedSets}/{totalSets} sets
        </span>
      </div>

      <div className={`active-workout-view__content${restTimerActive ? ' active-workout-view__content--timer' : ''}`}>
        {/* Exercise blocks */}
        {(() => {
          let globalIdx = 0;
          return workout.blocks.map((block, blockIdx) => {
            const isSuperset = block.exercises.length > 1;

            const exerciseCards = block.exercises.map((exercise, exIdx) => {
              const exerciseLogs = currentLog.exercises[exercise.title] || [];
              const letter = String.fromCharCode(65 + globalIdx);
              globalIdx++;

              const exerciseSets = exerciseLogs.length;
              const completedExSets = exerciseLogs.filter((s) => s?.completed).length;
              const allExDone = exerciseSets > 0 && completedExSets === exerciseSets;
              const hasFormNotes = !!(exercise.notes || getYouTubeLink(exercise.title));
              const notesExpanded = expandedNotes[exercise.title];
              const sessionNote = (currentLog.exerciseNotes || {})[exercise.title] || '';

              return (
                <div
                  key={exIdx}
                  className={`aw-exercise-card${allExDone ? ' aw-exercise-card--done' : ''}`}
                >
                  {/* Card header */}
                  <div className="aw-exercise-card__header">
                    <div className="aw-exercise-card__badge">{letter}</div>
                    <div className="aw-exercise-card__title-wrap">
                      <h3 className="aw-exercise-card__title">{exercise.title}</h3>
                      {exercise.workoutNotes && (
                        <p className="aw-exercise-card__workout-notes">{exercise.workoutNotes}</p>
                      )}
                    </div>
                    <div className="aw-exercise-card__header-actions">
                      {allExDone && (
                        <span className="aw-exercise-card__done-badge">
                          <CheckCircle size={16} />
                        </span>
                      )}
                      {getYouTubeLink(exercise.title) && (
                        <a
                          href={getYouTubeLink(exercise.title)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aw-exercise-card__yt-btn"
                          aria-label={`Watch ${exercise.title} video`}
                        >
                          <Youtube size={16} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Column labels */}
                  <div className="aw-sets-header">
                    <span className="aw-sets-header__set">SET</span>
                    <span className="aw-sets-header__target">TARGET</span>
                    <span className="aw-sets-header__inputs">ACTUAL</span>
                    <span className="aw-sets-header__done" aria-hidden="true" />
                  </div>

                  {/* Set rows */}
                  <div className="aw-exercise-card__sets">
                    {exercise.sets.map((set, setIdx) => {
                      const firstIncomplete = exerciseLogs.findIndex((s) => !s?.completed);
                      return (
                        <LogSetRow
                          key={setIdx}
                          setIndex={setIdx}
                          set={set}
                          loggedSet={exerciseLogs[setIdx]}
                          isNext={setIdx === firstIncomplete}
                          onUpdate={(newSetData) =>
                            updateExerciseSet(exercise.title, setIdx, newSetData)
                          }
                          allLogs={allLogs}
                          workoutTitle={workoutTitle}
                          exerciseTitle={exercise.title}
                        />
                      );
                    })}
                  </div>

                  {/* Form notes collapsible */}
                  {hasFormNotes && (
                    <div className="aw-form-notes">
                      <button
                        className="aw-form-notes__toggle"
                        onClick={() => toggleFormNotes(exercise.title)}
                        aria-expanded={notesExpanded}
                      >
                        <span>Form Notes</span>
                        <ChevronDown
                          size={16}
                          className={`aw-form-notes__chevron${notesExpanded ? ' aw-form-notes__chevron--open' : ''}`}
                        />
                      </button>
                      {notesExpanded && (
                        <div className="aw-form-notes__body">
                          {exercise.notes && (
                            <p className="aw-form-notes__text">{exercise.notes}</p>
                          )}
                          {getYouTubeLink(exercise.title) && (
                            <div className="aw-form-notes__video">
                              <iframe
                                width="100%"
                                height="200"
                                src={`https://www.youtube.com/embed/${extractVideoId(
                                  getYouTubeLink(exercise.title)
                                )}`}
                                title={exercise.title}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Session note for this exercise */}
                  <div className="aw-exercise-note">
                    {editingNote === exercise.title ? (
                      <input
                        type="text"
                        className="aw-exercise-note__input"
                        placeholder="Note (e.g. felt weak, RPE 8, elbow pain)"
                        value={sessionNote}
                        onChange={(e) => updateExerciseNote(exercise.title, e.target.value)}
                        onBlur={(e) => {
                          const noteContainer = e.currentTarget.closest('.aw-exercise-note');
                          setTimeout(() => {
                            // If focus moved to another element inside the same note area, don't dismiss
                            if (noteContainer && noteContainer.contains(document.activeElement)) return;
                            setEditingNote(null);
                          }, 150);
                        }}
                        autoFocus
                      />
                    ) : (
                      <button
                        className={`aw-exercise-note__trigger${sessionNote ? ' aw-exercise-note__trigger--has-note' : ''}`}
                        onClick={() => setEditingNote(exercise.title)}
                      >
                        <Pencil size={13} />
                        <span>{sessionNote || 'Add a note…'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            });
            if (isSuperset) {
              return (
                <div key={blockIdx} className="aw-superset">
                  <div className="aw-superset__label">
                    <span className="aw-superset__pill">Superset</span>
                  </div>
                  <div className="aw-superset__exercises">{exerciseCards}</div>
                </div>
              );
            }
            return <div key={blockIdx}>{exerciseCards}</div>;
          });
        })()}

        {/* Overall session notes */}
        <div className="aw-session-note">
          <h3 className="aw-session-note__label">Session Notes</h3>
          <textarea
            className="aw-session-note__input"
            placeholder="How did the session feel? (e.g. tired today, great pump, low energy)"
            value={currentLog.workoutNote || ''}
            onChange={(e) => updateWorkoutNote(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* Rest timer — floating */}
      {restTimerActive && (
        <RestTimer
          initialSeconds={settings.restDuration}
          onDone={() => setRestTimerActive(false)}
          onSkip={() => setRestTimerActive(false)}
        />
      )}

      {/* Complete button */}
      <div className="aw-footer">
        <button
          className={`aw-footer__complete-btn${allDone ? ' aw-footer__complete-btn--ready' : ''}`}
          onClick={allDone ? handleCompleteWorkout : () => setShowCompleteModal(true)}
        >
          <CheckCircle size={20} />
          {allDone
            ? 'Complete Workout'
            : `Finish  (${completedSets}/${totalSets} sets)`}
        </button>
      </div>

      {/* Cancel modal */}
      {showCancelModal && (
        <Modal
          title="Cancel Workout?"
          message="Are you sure? All progress will be saved but not marked as completed."
          onConfirm={handleCancelWorkout}
          onCancel={() => setShowCancelModal(false)}
          confirmText="Cancel Workout"
          cancelText="Keep Going"
        />
      )}

      {/* Incomplete sets confirmation */}
      {showCompleteModal && (
        <Modal
          title="Finish Early?"
          message={`${totalSets - completedSets} set${totalSets - completedSets !== 1 ? 's' : ''} not yet completed. Mark workout as finished anyway?`}
          onConfirm={() => { setShowCompleteModal(false); handleCompleteWorkout(); }}
          onCancel={() => setShowCompleteModal(false)}
          confirmText="Finish Anyway"
          cancelText="Keep Going"
        />
      )}

      {/* Workout completion summary modal */}
      {showSummaryModal && (() => {
        const summary = buildSummary(completedLog);
        return (
          <Modal
            title="Workout complete! 🎉"
            onConfirm={() => { setShowSummaryModal(false); onComplete(); }}
            confirmText="Done"
            onCancel={null}
            cancelText={null}
          >
            {summary && (
              <div className="aw-summary">
                <p className="aw-summary__stat">
                  <strong>{summary.totalCompleted}</strong> sets completed
                </p>
                {Object.entries(summary.volumeByUnit).map(([unit, vol]) => (
                  <p key={unit} className="aw-summary__stat">
                    Total volume: <strong>{vol.toLocaleString()} {unit}</strong>
                  </p>
                ))}
                {summary.prs.length > 0 && (
                  <div className="aw-summary__prs">
                    <p className="aw-summary__pr-heading">Personal Records:</p>
                    {summary.prs.map((pr, i) => (
                      <p key={i} className="aw-summary__pr-item">
                        🏆 {pr.exTitle}: {pr.reps} reps × {pr.weight} {pr.unit}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Modal>
        );
      })()}
    </div>
  );
}

