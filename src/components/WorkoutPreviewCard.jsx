import { useState } from 'react';
import { Check, Dumbbell, MessageSquare, Play, Save } from 'lucide-react';

function getExerciseCount(workout) {
  return (workout.blocks || []).reduce(
    (total, block) => total + (block.exercises?.length || 0),
    0
  );
}

function getSetCount(workout) {
  return (workout.blocks || []).reduce(
    (total, block) => total + (block.exercises || []).reduce(
      (blockTotal, exercise) => blockTotal + (exercise.sets?.length || 0),
      0
    ),
    0
  );
}

export default function WorkoutPreviewCard({ workout, onStartWorkout, onSaveAsTemplate }) {
  const [saved, setSaved] = useState(false);
  const exerciseCount = getExerciseCount(workout);
  const setCount = getSetCount(workout);

  const handleSaveTemplate = () => {
    if (onSaveAsTemplate) {
      const ok = onSaveAsTemplate(workout);
      if (ok !== false) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    }
  };

  return (
    <section className="workout-preview-card card" aria-labelledby="today-workout-title">
      <div className="workout-preview-card__topline">
        <div className="workout-preview-card__badge">
          <Dumbbell size={16} aria-hidden="true" />
          Today&apos;s session
        </div>
        {onSaveAsTemplate && (
          <button
            className="workout-preview-card__save"
            onClick={handleSaveTemplate}
            disabled={saved}
          >
            {saved
              ? <><Check size={14} />Saved</>
              : <><Save size={14} />Save</>}
          </button>
        )}
      </div>

      <h2 id="today-workout-title" className="workout-preview-card__title">
        {workout.title}
      </h2>

      <div className="workout-preview-card__metrics" aria-label="Workout summary">
        <div className="workout-preview-card__metric">
          <span className="workout-preview-card__metric-value">{exerciseCount}</span>
          <span className="workout-preview-card__metric-label">Exercises</span>
        </div>
        <div className="workout-preview-card__metric">
          <span className="workout-preview-card__metric-value">{setCount}</span>
          <span className="workout-preview-card__metric-label">Sets</span>
        </div>
        <div className="workout-preview-card__metric">
          <span className="workout-preview-card__metric-value">{workout.blocks?.length || 0}</span>
          <span className="workout-preview-card__metric-label">Parts</span>
        </div>
      </div>

      <button
        className="workout-preview-card__start"
        onClick={onStartWorkout}
      >
        <Play size={18} fill="currentColor" aria-hidden="true" />
        Start Workout
      </button>

      {workout.notes && (
        <div className="workout-preview-card__notes">
          <div className="workout-preview-card__notes-label">
            <MessageSquare size={14} aria-hidden="true" />
            Workout notes
          </div>
          <p>{workout.notes}</p>
        </div>
      )}

      <div className="workout-preview-card__exercises">
        {(workout.blocks || []).map((block, blockIdx) => {
          const isSuperset = (block.exercises || []).length > 1;
          return (
            <div
              key={blockIdx}
              className={`workout-preview-card__block ${
                isSuperset ? 'workout-preview-card__block--superset' : ''
              }`}
            >
              <div className="workout-preview-card__block-label">
                <span>{block.value || String.fromCharCode(65 + blockIdx)}</span>
                {isSuperset && <strong>Superset</strong>}
              </div>
              <div className="workout-preview-card__block-exercises">
                {(block.exercises || []).map((exercise, exIdx) => (
                  <div key={exIdx} className="workout-preview-card__exercise-row">
                    <span className="workout-preview-card__exercise-name">{exercise.title}</span>
                    <span className="workout-preview-card__exercise-sets">
                      {exercise.sets?.length || 0} set{(exercise.sets?.length || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
