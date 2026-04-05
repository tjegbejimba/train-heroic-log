import { useState } from 'react';
import { CalendarRange, Moon, CheckCircle2, Flame } from 'lucide-react';
import { ROUTE_PLANNER } from '../constants';
import DateStrip from '../components/DateStrip';
import MonthCalendar from '../components/MonthCalendar';
import { calculateStreaks } from '../utils/streaks';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function findNextWorkout(schedule, fromDate) {
  const start = new Date(fromDate + 'T00:00:00');
  for (let i = 1; i <= 14; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toLocaleDateString('en-CA');
    if (schedule[key]) {
      return { date: key, title: schedule[key], daysAway: i };
    }
  }
  return null;
}

function formatDayLabel(daysAway) {
  if (daysAway === 1) return 'Tomorrow';
  if (daysAway === 2) return 'In 2 days';
  return `In ${daysAway} days`;
}

export default function TrainingView({
  currentDate,
  onDateChange,
  workouts,
  schedule,
  completedDates,
  getWorkoutForDate,
  getLog,
  onStartWorkout,
  navigate,
}) {
  const workoutTitle = getWorkoutForDate(currentDate);
  const workout = workoutTitle ? workouts[workoutTitle] : null;
  const [viewMode, setViewMode] = useState('week');

  const logKey = workoutTitle ? `${currentDate}::${workoutTitle}` : null;
  const existingLog = logKey ? getLog(logKey) : null;
  const isCompleted = !!(existingLog && existingLog.completedAt);

  const { currentStreak, isActiveToday } = calculateStreaks(completedDates);
  const streakDisplay = isActiveToday ? currentStreak : (currentStreak > 0 ? currentStreak : 0);

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

  const nextWorkout = !workout ? findNextWorkout(schedule, currentDate) : null;

  const handleStartWorkout = () => {
    if (workoutTitle) {
      onStartWorkout(`${currentDate}::${workoutTitle}`);
    }
  };

  return (
    <div className="view training-view">
      {/* Greeting header */}
      <div className="training-greeting">
        <h2 className="training-greeting__text">{getGreeting()}</h2>
        {streakDisplay > 0 && (
          <span className="training-greeting__streak">
            <Flame size={16} />
            {streakDisplay} day{streakDisplay !== 1 ? 's' : ''}
          </span>
        )}
      </div>

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
              <CalendarRange size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />
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
                <div className="training-card__celebration">
                  <CheckCircle2 size={48} strokeWidth={1.5} />
                  <h2 className="training-card__celebration-title">Workout Complete</h2>
                  <p className="training-card__celebration-sub">{workout.title}</p>
                </div>
                {completedStats && (
                  <div className="training-card__stats-grid">
                    {completedStats.durationMin != null && (
                      <div className="training-card__stat-item">
                        <span className="training-card__stat-value">{completedStats.durationMin}</span>
                        <span className="training-card__stat-label">minutes</span>
                      </div>
                    )}
                    <div className="training-card__stat-item">
                      <span className="training-card__stat-value">{completedStats.doneSets}</span>
                      <span className="training-card__stat-label">sets</span>
                    </div>
                    {Object.entries(completedStats.volumeByUnit).map(([unit, vol]) => (
                      <div key={unit} className="training-card__stat-item">
                        <span className="training-card__stat-value">{vol.toLocaleString()}</span>
                        <span className="training-card__stat-label">{unit}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="training-card__motivation">Crushed it 💪</p>
              </div>
            ) : (
              <div className="training-card">
                <div className="training-card__header">
                  <h2 className="training-card__title">{workout.title}</h2>
                  <span className="training-card__exercise-count">
                    {workout.blocks.reduce((n, b) => n + b.exercises.length, 0)} exercises
                  </span>
                </div>
                <div className="training-card__exercises">
                  {workout.blocks.map((block, blockIdx) => {
                    const isSuperset = block.exercises.length > 1;
                    return (
                      <div key={blockIdx} className={isSuperset ? 'training-card__superset' : undefined}>
                        {isSuperset && (
                          <div className="training-card__superset-label">Superset</div>
                        )}
                        {block.exercises.map((exercise, exIdx) => (
                          <div key={exIdx} className="training-card__exercise-row">
                            <span className="training-card__exercise-name">{exercise.title}</span>
                            <span className="training-card__exercise-sets">
                              {exercise.sets.length} set{exercise.sets.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="training-rest-card">
            <div className="training-rest-card__icon">
              <Moon size={36} strokeWidth={1.5} />
            </div>
            <h3 className="training-rest-card__heading">Rest Day</h3>
            <p className="training-rest-card__message">
              Recovery is part of the plan. Rest up and come back strong.
            </p>
            {nextWorkout && (
              <div className="training-rest-card__next">
                <span className="training-rest-card__next-label">Up next</span>
                <span className="training-rest-card__next-title">
                  {nextWorkout.title}
                </span>
                <span className="training-rest-card__next-day">
                  {formatDayLabel(nextWorkout.daysAway)}
                </span>
              </div>
            )}
            <button
              className="btn btn-secondary btn-small training-rest-card__plan-btn"
              onClick={() => navigate(ROUTE_PLANNER)}
            >
              Plan this day
            </button>
          </div>
        )}
      </div>

      {/* Sticky CTA — only when workout exists and not completed */}
      {workout && !isCompleted && (
        <div className="training-sticky-cta">
          <button
            className="training-sticky-cta__btn"
            onClick={handleStartWorkout}
          >
            Start Workout
          </button>
        </div>
      )}
    </div>
  );
}
