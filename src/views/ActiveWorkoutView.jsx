import { useState, useEffect } from 'react';
import { Video, CheckCircle } from 'lucide-react';
import SessionHeader from '../components/SessionHeader';
import LogSetRow from '../components/LogSetRow';
import BlockSection from '../components/BlockSection';
import Modal from '../components/Modal';
import { parseLogKey } from '../constants';

export default function ActiveWorkoutView({
  logKey,
  workouts,
  logs,
  saveLog,
  getYouTubeLink,
  updateSession,
  clearSession,
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
    updateSession({ logKey }); // Update active session timestamp
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
    clearSession();
    onComplete();
  };

  const handleCancelWorkout = () => {
    setShowCancelModal(false);
    clearSession();
    onCancel();
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

  return (
    <div className="view active-workout-view">
      <SessionHeader
        workoutTitle={workoutTitle}
        startedAt={currentLog.startedAt}
        onCancel={() => setShowCancelModal(true)}
      />

      <div className="active-workout-view__content">
        {/* Progress bar */}
        <div className="active-workout-view__progress">
          <div className="progress-bar">
            <div
              className="progress-bar__fill"
              style={{ width: `${(completedSets / totalSets) * 100}%` }}
            />
          </div>
          <p className="progress-text">
            {completedSets} of {totalSets} sets completed
          </p>
        </div>

        {/* Exercises */}
        {(() => {
          let globalIdx = 0;
          return workout.blocks.map((block, blockIdx) => (
          <div key={blockIdx}>
            {block.exercises.length > 1 && <BlockSection block={block} />}

            {block.exercises.map((exercise, exIdx) => {
              const exerciseLogs = currentLog.exercises[exercise.title] || [];
              const letter = String.fromCharCode(65 + globalIdx);
              globalIdx++;

              return (
                <div key={exIdx} className="active-workout-view__exercise">
                  <div className="active-workout-view__exercise-header">
                    <h3 className="active-workout-view__exercise-title">
                      {letter}. {exercise.title}
                    </h3>
                    {exercise.notes && (
                      <p className="text-secondary text-sm">{exercise.notes}</p>
                    )}
                  </div>

                  <div className="active-workout-view__sets">
                    {exercise.sets.map((set, setIdx) => (
                      <LogSetRow
                        key={setIdx}
                        setIndex={setIdx}
                        set={set}
                        loggedSet={exerciseLogs[setIdx]}
                        onUpdate={(newSetData) =>
                          updateExerciseSet(exercise.title, setIdx, newSetData)
                        }
                      />
                    ))}
                  </div>

                  {/* Exercise notes */}
                  <div className="active-workout-view__notes">
                    <input
                      type="text"
                      className="input active-workout-view__notes-input"
                      placeholder="Notes (e.g. felt weak, RPE 8, elbow pain)"
                      value={(currentLog.exerciseNotes || {})[exercise.title] || ''}
                      onChange={(e) =>
                        updateExerciseNote(exercise.title, e.target.value)
                      }
                    />
                  </div>

                  {/* YouTube link */}
                  {getYouTubeLink(exercise.title) && (
                    <details className="active-workout-view__video-details">
                      <summary className="active-workout-view__video-summary">
                        <Video size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                        View Form Video
                      </summary>
                      <div className="active-workout-view__video-embed">
                        <iframe
                          width="100%"
                          height="220"
                          src={`https://www.youtube.com/embed/${extractVideoId(
                            getYouTubeLink(exercise.title)
                          )}`}
                          title={exercise.title}
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        ));
        })()}

        {/* Overall workout note */}
        <div className="active-workout-view__workout-note">
          <h3 className="active-workout-view__workout-note-label">Session Notes</h3>
          <textarea
            className="input active-workout-view__workout-note-input"
            placeholder="How did the session feel? (e.g. tired today, great pump, low energy)"
            value={currentLog.workoutNote || ''}
            onChange={(e) => updateWorkoutNote(e.target.value)}
            rows={3}
          />
        </div>
      </div>

      {/* Complete button */}
      <div className="active-workout-view__footer">
        <button
          className="btn btn-primary btn--large w-full"
          onClick={handleCompleteWorkout}
        >
          <CheckCircle size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
          {allDone
            ? 'Complete Workout'
            : `Complete Workout (${completedSets}/${totalSets})`}
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
