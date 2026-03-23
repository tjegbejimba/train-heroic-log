import { useState } from 'react';

export default function WorkoutPreviewCard({ workout, onStartWorkout, onSaveAsTemplate }) {
  const [saved, setSaved] = useState(false);

  const handleSaveTemplate = () => {
    if (onSaveAsTemplate) {
      onSaveAsTemplate(workout);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="workout-preview-card card">
      <div className="flex-between mb-md">
        <div className="workout-preview-card__coach">
          <div className="workout-preview-card__coach-avatar">
            {workout.title
              .split(' ')
              .slice(0, 2)
              .map((w) => w[0])
              .join('')
              .toUpperCase()}
          </div>
        </div>
        {onSaveAsTemplate && (
          <button
            className="btn btn-secondary btn-small"
            onClick={handleSaveTemplate}
            disabled={saved}
          >
            {saved ? '✓ Saved' : '💾 Save Template'}
          </button>
        )}
      </div>

      <h2 className="workout-preview-card__title">{workout.title}</h2>

      <button
        className="btn btn-primary btn--large w-full mt-lg"
        onClick={onStartWorkout}
      >
        Start Session
      </button>

      {workout.notes && (
        <div className="mt-lg">
          <div className="text-blue mt-md mb-md">💬 Workout Notes</div>
          <p className="text-secondary">{workout.notes}</p>
        </div>
      )}
    </div>
  );
}
