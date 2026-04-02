import { useState } from 'react';
import { CalendarRange, Moon, CheckCircle2 } from 'lucide-react';
import { ROUTE_PLANNER } from '../constants';
import DateStrip from '../components/DateStrip';
import MonthCalendar from '../components/MonthCalendar';
import ExerciseRow from '../components/ExerciseRow';

const MAX_CHIPS = 6;

function ExerciseChips({ workout }) {
  const exercises = [];
  workout.blocks.forEach((block) => {
    block.exercises.forEach((ex) => exercises.push(ex.title));
  });

  const visible = exercises.slice(0, MAX_CHIPS);
  const overflow = exercises.length - MAX_CHIPS;

  return (
    <div className="training-card__chips">
      {visible.map((title) => (
        <span key={title} className="training-card__chip">
          {title}
        </span>
      ))}
      {overflow > 0 && (
        <span className="training-card__chip training-card__chip--overflow">
          +{overflow} more
        </span>
      )}
    </div>
  );
}

export default function TrainingView({
  currentDate,
  onDateChange,
  workouts,
  schedule,
  completedDates,
  getWorkoutForDate,
  getLog,
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

  const logKey = workoutTitle ? `${currentDate}::${workoutTitle}` : null;
  const existingLog = logKey ? getLog(logKey) : null;
  const isCompleted = !!(existingLog && existingLog.completedAt);

  // Compute quick stats from the log for the completed card
  const completedStats = isCompleted ? (() => {
    const allSets = Object.values(existingLog.exercises || {}).flat();
    const doneSets = allSets.filter((s) => s.completed);
    let durationMin = null;
    if (existingLog.startedAt && existingLog.completedAt) {
      const ms = new Date(existingLog.completedAt) - new Date(existingLog.startedAt);
      if (ms > 0) durationMin = Math.round(ms / 60000);
    }
    const volumeByUnit = {};
    doneSets.forEach((s) => {
      if (s.actualReps && s.actualWeight) {
        const unit = s.unit || 'lb';
        volumeByUnit[unit] = (volumeByUnit[unit] || 0) + (s.actualReps * s.actualWeight);
      }
    });
    return { doneSets: doneSets.length, totalSets: allSets.length, durationMin, volumeByUnit };
  })() : null;

  const handleStartWorkout = () => {
    if (workoutTitle) {
      onStartWorkout(`${currentDate}::${workoutTitle}`);
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
            {isCompleted ? (
              <div className="training-card training-card--completed">
                <div className="training-card__header">
                  <h2 className="training-card__title">{workout.title}</h2>
                  <span className="training-card__done-badge">
                    <CheckCircle2 size={16} />
                    Done
                  </span>
                </div>
                {completedStats && (
                  <div className="training-card__stats">
                    {completedStats.durationMin != null && (
                      <span className="training-card__stat">{completedStats.durationMin} min</span>
                    )}
                    <span className="training-card__stat">
                      {completedStats.doneSets}{completedStats.doneSets !== completedStats.totalSets ? `/${completedStats.totalSets}` : ''} sets
                    </span>
                    {Object.entries(completedStats.volumeByUnit).map(([unit, vol]) => (
                      <span key={unit} className="training-card__stat">{vol.toLocaleString()} {unit}</span>
                    ))}
                  </div>
                )}
                <ExerciseChips workout={workout} />
              </div>
            ) : (
              <div className="training-card">
                <div className="training-card__header">
                  <h2 className="training-card__title">{workout.title}</h2>
                </div>
                <div className="training-card__actions">
                  <button
                    className="btn btn-primary training-card__start-btn"
                    onClick={handleStartWorkout}
                  >
                    Start Workout
                  </button>
                </div>
                <ExerciseChips workout={workout} />
              </div>
            )}

            {/* Exercise list below the card */}
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
          /* Rest day card */
          <div className="training-rest-card">
            <div className="training-rest-card__icon">
              <Moon size={36} strokeWidth={1.5} />
            </div>
            <h3 className="training-rest-card__heading">Rest Day</h3>
            <p className="training-rest-card__message">
              Recovery is part of the plan. Rest up and come back strong.
            </p>
            <button
              className="btn btn-secondary btn-small"
              onClick={() => navigate(ROUTE_PLANNER)}
              style={{ marginTop: '16px' }}
            >
              Plan this day
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
