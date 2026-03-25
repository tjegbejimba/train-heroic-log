import { useState } from 'react';
import { CalendarDays, CalendarRange } from 'lucide-react';
import DateStrip from '../components/DateStrip';
import MonthCalendar from '../components/MonthCalendar';
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
  onUpdateExerciseNotes,
  onStartWorkout,
  onSaveAsTemplate,
  navigate,
}) {
  const workoutTitle = getWorkoutForDate(currentDate);
  const workout = workoutTitle ? workouts[workoutTitle] : null;
  const [expandedExercise, setExpandedExercise] = useState(null);
  const [viewMode, setViewMode] = useState('week');

  const handleStartWorkout = () => {
    if (workoutTitle) {
      const logKey = `${currentDate}::${workoutTitle}`;
      onStartWorkout(logKey);
    }
  };

  return (
    <div className="view training-view">
      {viewMode === 'week' ? (
        <DateStrip
          currentDate={currentDate}
          onDateChange={onDateChange}
          schedule={schedule}
          completedDates={completedDates}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      ) : (
        <div className="training-view__month-header">
          <MonthCalendar
            currentDate={currentDate}
            onDateChange={onDateChange}
            schedule={schedule}
            completedDates={completedDates}
          />
          <div className="training-view__month-controls flex gap-md p-lg">
            <button
              className="btn btn-secondary btn-small"
              onClick={() => setViewMode('week')}
            >
              <CalendarRange size={14} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
              Week View
            </button>
          </div>
        </div>
      )}

      <div className="training-view__content">
        {workout ? (
          <>
            <WorkoutPreviewCard
              workout={workout}
              onStartWorkout={handleStartWorkout}
              onSaveAsTemplate={onSaveAsTemplate}
            />

            <div className="training-view__exercises">
              {(() => {
                let globalIdx = 0;
                return workout.blocks.map((block, blockIdx) => {
                  const isSuperset = block.exercises.length > 1;
                  const exercises = block.exercises.map((exercise, exIdx) => {
                    const letter = String.fromCharCode(65 + globalIdx);
                    globalIdx++;
                    return (
                      <ExerciseRow
                        key={exIdx}
                        blockLetter={letter}
                        exercise={exercise}
                        youtubeLink={getYouTubeLink(exercise.title)}
                        onYoutubeLinkChange={(url) =>
                          setYouTubeLink(exercise.title, url)
                        }
                        onExerciseNotesChange={(notes) =>
                          onUpdateExerciseNotes(workoutTitle, exercise.title, notes)
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
                    );
                  });

                  if (isSuperset) {
                    return (
                      <div key={blockIdx} className="superset-group">
                        <div className="superset-group__label">Superset</div>
                        <div className="superset-group__exercises">{exercises}</div>
                      </div>
                    );
                  }
                  return <div key={blockIdx}>{exercises}</div>;
                });
              })()}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon"><CalendarDays size={48} /></div>
            <h3>No workout scheduled</h3>
            <p className="text-secondary">Select a day with a workout to begin</p>
          </div>
        )}
      </div>
    </div>
  );
}
