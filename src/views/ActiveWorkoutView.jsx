import { useState, useEffect } from 'react';
import { Youtube, CheckCircle, ChevronDown, Pencil } from 'lucide-react';
import SessionHeader from '../components/SessionHeader';
import LogSetRow from '../components/LogSetRow';
import Modal from '../components/Modal';
import RestTimer from '../components/RestTimer';
import { useSettings } from '../hooks/useSettings';
import { parseLogKey } from '../constants';

export default function ActiveWorkoutView({
  logKey,
  workouts,
  logs,
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
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState({});
  const [editingNote, setEditingNote] = useState(null);
  const { settings } = useSettings();

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

  const updateWorkoutNote = (note) => {
    const updated = { ...currentLog, workoutNote: note };
    setCurrentLog(updated);
    saveLog(logKey, updated);
  };

  const handleCompleteWorkout = () => {
    const completed = {
      ...currentLog,
      completedAt: new Date().toISOString(),
    };
    saveLog(logKey, completed);
    onComplete();
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
                        onBlur={() => setEditingNote(null)}
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
    </div>
  );
}

function extractVideoId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return '';
}
