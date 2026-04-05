import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Youtube, CheckCircle, ChevronDown, Pencil } from 'lucide-react';
import SessionHeader from '../components/SessionHeader';
import { LogSetRow, EditSetRow } from '../components/log-set';
import Modal from '../components/Modal';
import RestTimer from '../components/RestTimer';
import { useSettings } from '../hooks/useSettings';
import { parseLogKey } from '../constants';
import { extractVideoId } from '../utils/youtube';
import { hapticSuccess } from '../utils/haptics';
import { findPreviousSets, formatLastHint } from '../utils/exerciseHistory';
import { getSetMeta } from '../utils/setMeta';
import { buildSummary, findPRs } from '../utils/workoutSummary';

export default function ActiveWorkoutView({
  logKey,
  workouts,
  logs,
  allLogs,
  saveLog,
  getYouTubeLink,
  onComplete,
  onCancel,
  onUpdateWorkout,
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
  const wakeLockRef = useRef(null);
  const [editMode, setEditMode] = useState(false);
  const [editBlocks, setEditBlocks] = useState(null);

  // Pre-compute previous sets for all exercises (once per workout, memoized)
  const prevSetsMap = useMemo(() => {
    if (!workout?.blocks || !allLogs) return {};
    const map = {};
    for (const block of workout.blocks) {
      for (const ex of block.exercises) {
        if (!map[ex.title]) {
          map[ex.title] = findPreviousSets(allLogs, workoutTitle, ex.title, { before: date });
        }
      }
    }
    return map;
  }, [allLogs, workoutTitle, workout?.blocks, date]);

  const toggleEditMode = () => {
    if (editMode) {
      if (editBlocks && onUpdateWorkout) onUpdateWorkout(editBlocks);
      setEditMode(false);
      setEditBlocks(null);
    } else {
      setEditBlocks(JSON.parse(JSON.stringify(workout.blocks)));
      setEditMode(true);
    }
  };

  const handleTargetChange = (blockIdx, exIdx, setIdx, field, value) => {
    setEditBlocks((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[blockIdx].exercises[exIdx].sets[setIdx][field] = value;
      return next;
    });
  };

  const handleRemoveSet = (blockIdx, exIdx, setIdx) => {
    setEditBlocks((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next[blockIdx].exercises[exIdx].sets.splice(setIdx, 1);
      return next;
    });
  };

  const handleAddSet = (blockIdx, exIdx) => {
    setEditBlocks((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const sets = next[blockIdx].exercises[exIdx].sets;
      const base = sets[sets.length - 1] || { reps: null, weight: null, unit: 'lb' };
      sets.push({ ...base });
      return next;
    });
  };

  // Keep screen awake during active workout
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let released = false;
    navigator.wakeLock.request('screen').then((lock) => {
      if (released) { lock.release(); return; }
      wakeLockRef.current = lock;
    }).catch(() => {});
    // Re-acquire if page visibility changes (iOS releases lock on hide)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        navigator.wakeLock.request('screen').then((lock) => {
          wakeLockRef.current = lock;
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
    };
  }, []);

  // Clean up rest timer on unmount to prevent stale callbacks
  useEffect(() => {
    return () => { setRestTimerActive(false); };
  }, []);

  // Initialize exercise logs
  useEffect(() => {
    if (!workout) return;
    // Skip if exercises already have actual logged data (crash recovery)
    if (currentLog.exercises && Object.keys(currentLog.exercises).length > 0) {
      const hasLoggedData = Object.values(currentLog.exercises).some((sets) =>
        Array.isArray(sets) && sets.some((s) =>
          s.completed || (s.actualReps !== undefined && s.actualReps !== '') || (s.actualWeight !== undefined && s.actualWeight !== '')
        )
      );
      if (hasLoggedData) return;
    }

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
    // Cancel any pending workout-note debounce so it can't overwrite the completed log
    if (workoutNoteTimerRef.current) clearTimeout(workoutNoteTimerRef.current);
    const completed = {
      ...currentLog,
      completedAt: new Date().toISOString(),
    };
    saveLog(logKey, completed);
    hapticSuccess();
    setCompletedLog(completed);
    setShowSummaryModal(true);
  };

  // Build summary data for the completion modal
  const computeSummary = (log) => {
    if (!log) return null;
    const today = new Date().toISOString().slice(0, 10);
    const summary = buildSummary(log);
    const prs = findPRs(log, allLogs, today);
    return { ...summary, prs };
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
        isEditMode={editMode}
        onToggleEdit={onUpdateWorkout ? toggleEditMode : null}
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
        {/* Edit mode banner */}
        {editMode && (
          <div className="aw-edit-banner">
            <Pencil size={13} />
            <span>Editing targets — tap the pencil again to save</span>
          </div>
        )}

        {/* Exercise blocks */}
        {(() => {
          const activeBlocks = editMode ? editBlocks : workout.blocks;
          let globalIdx = 0;
          return activeBlocks.map((block, blockIdx) => {
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
                  className={`aw-exercise-card${allExDone && !editMode ? ' aw-exercise-card--done' : ''}`}
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
                      {allExDone && !editMode && (
                        <span className="aw-exercise-card__done-badge">
                          <CheckCircle size={16} />
                        </span>
                      )}
                      {getYouTubeLink(exercise.title) && !editMode && (
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
                    {editMode ? (
                      <>
                        <span className="aw-sets-header__target">REPS</span>
                        <span className="aw-sets-header__inputs">WEIGHT</span>
                        <span className="aw-sets-header__done" aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        <span className="aw-sets-header__target">TARGET</span>
                        <span className="aw-sets-header__inputs">ACTUAL</span>
                        <span className="aw-sets-header__done" aria-hidden="true" />
                      </>
                    )}
                  </div>

                  {/* Set rows */}
                  <div className="aw-exercise-card__sets">
                    {exercise.sets.map((set, setIdx) => {
                      if (editMode) {
                        return (
                          <EditSetRow
                            key={setIdx}
                            setIndex={setIdx}
                            set={set}
                            onTargetChange={(si, field, val) =>
                              handleTargetChange(blockIdx, exIdx, si, field, val)
                            }
                            onRemoveSet={() => handleRemoveSet(blockIdx, exIdx, setIdx)}
                          />
                        );
                      }
                      const firstIncomplete = exerciseLogs.findIndex((s) => !s?.completed);
                      const prevSets = prevSetsMap[exercise.title];
                      const meta = getSetMeta(set);
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
                          lastHint={formatLastHint(prevSets?.[setIdx] ?? null, meta)}
                        />
                      );
                    })}
                    {editMode && (
                      <button
                        type="button"
                        className="aw-edit-add-set"
                        onClick={() => handleAddSet(blockIdx, exIdx)}
                      >
                        + Add Set
                      </button>
                    )}
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
                                )}?mute=1`}
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
            : `Finish (${completedSets}/${totalSets} sets)`}
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
        const summary = computeSummary(completedLog);
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
                <div className="aw-summary__stats-grid">
                  {summary.durationMin != null && (
                    <div className="aw-summary__stat-card">
                      <span className="aw-summary__stat-value">{summary.durationMin}</span>
                      <span className="aw-summary__stat-label">min</span>
                    </div>
                  )}
                  <div className="aw-summary__stat-card">
                    <span className="aw-summary__stat-value">{summary.totalCompleted}</span>
                    <span className="aw-summary__stat-label">
                      {summary.totalCompleted === summary.totalSets ? 'sets' : `/ ${summary.totalSets} sets`}
                    </span>
                  </div>
                  {Object.entries(summary.volumeByUnit).map(([unit, vol]) => (
                    <div key={unit} className="aw-summary__stat-card aw-summary__stat-card--wide">
                      <span className="aw-summary__stat-value">{vol.toLocaleString()}</span>
                      <span className="aw-summary__stat-label">{unit} volume</span>
                    </div>
                  ))}
                </div>

                {summary.prs.length > 0 && (
                  <div className="aw-summary__prs">
                    <p className="aw-summary__pr-heading">New PRs</p>
                    {summary.prs.map((pr, i) => (
                      <div key={i} className="aw-summary__pr-item">
                        <span className="aw-summary__pr-trophy">🏆</span>
                        <span className="aw-summary__pr-text">
                          <strong>{pr.exTitle}</strong>
                          <span className="aw-summary__pr-weight"> {pr.reps} × {pr.weight} {pr.unit}</span>
                        </span>
                      </div>
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

