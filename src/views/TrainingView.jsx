import { useState } from 'react';
import DateStrip from '../components/DateStrip';
import WorkoutPreviewCard from '../components/WorkoutPreviewCard';
import BlockSection from '../components/BlockSection';
import ExerciseRow from '../components/ExerciseRow';

export default function TrainingView({
  currentDate,
  onDateChange,
  workouts,
  schedule,
  completedDates,
  getWorkoutForDate,
  getYouTubeLink,
  setYouTubeLink,
  onStartWorkout,
  navigate,
}) {
  const workoutTitle = getWorkoutForDate(currentDate);
  const workout = workoutTitle ? workouts[workoutTitle] : null;
  const [expandedExercise, setExpandedExercise] = useState(null);

  const handleStartWorkout = () => {
    if (workoutTitle) {
      const logKey = `${currentDate}::${workoutTitle}`;
      onStartWorkout(logKey);
    }
  };

  return (
    <div className="view training-view">
      <DateStrip
        currentDate={currentDate}
        onDateChange={onDateChange}
        schedule={schedule}
        completedDates={completedDates}
      />

      <div className="training-view__content">
        {workout ? (
          <>
            <WorkoutPreviewCard
              workout={workout}
              onStartWorkout={handleStartWorkout}
            />

            <div className="training-view__exercises">
              {workout.blocks.map((block, blockIdx) => (
                <div key={blockIdx}>
                  {block.exercises.length > 0 && (
                    <BlockSection block={block} />
                  )}
                  {block.exercises.map((exercise, exIdx) => (
                    <ExerciseRow
                      key={exIdx}
                      blockLetter={String.fromCharCode(65 + exIdx)} // A, B, C...
                      exercise={exercise}
                      youtubeLink={getYouTubeLink(`${workoutTitle}::${exercise.title}`)}
                      onYoutubeLinkChange={(url) =>
                        setYouTubeLink(`${workoutTitle}::${exercise.title}`, url)
                      }
                      isExpanded={expandedExercise === `${blockIdx}-${exIdx}`}
                      onToggleExpand={() =>
                        setExpandedExercise(
                          expandedExercise === `${blockIdx}-${exIdx}`
                            ? null
                            : `${blockIdx}-${exIdx}`
                        )
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <h3>No workout scheduled</h3>
            <p className="text-secondary">Select a day with a workout to begin</p>
          </div>
        )}
      </div>
    </div>
  );
}
