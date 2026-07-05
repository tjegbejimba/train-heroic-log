import { useState } from 'react';
import { CalendarRange, CheckCircle2, Flame, Moon, Play, Sparkles } from 'lucide-react';
import { ROUTE_PLANNER } from '../constants';
import DateStrip from '../components/DateStrip';
import MonthCalendar from '../components/MonthCalendar';
import TemplatePreviewSheet from '../components/TemplatePreviewSheet';
import WorkoutPreviewCard from '../components/WorkoutPreviewCard';
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

function formatSelectedDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function getTemplateExercises(template) {
  return (template.blocks || []).flatMap((block) => block.exercises || []);
}

function getTemplateSetCount(template) {
  return getTemplateExercises(template).reduce(
    (sum, exercise) => sum + (exercise.sets?.length || 0),
    0
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
  onStartWorkout,
  onScheduleTemplate,
  templateList,
  navigate,
}) {
  const workoutTitle = getWorkoutForDate(currentDate);
  const workout = workoutTitle ? workouts[workoutTitle] : null;
  const [viewMode, setViewMode] = useState('week');
  const [previewTemplate, setPreviewTemplate] = useState(null);

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
      <div className="training-greeting">
        <div className="training-greeting__copy">
          <h1 className="training-greeting__text">{getGreeting()}</h1>
          <p className="training-greeting__subtext">
            {formatSelectedDate(currentDate)}
          </p>
        </div>
        {streakDisplay > 0 && (
          <span className="training-greeting__streak">
            <Flame size={16} />
            <span className="training-greeting__streak-count">{streakDisplay}</span>
            <span>day{streakDisplay !== 1 ? 's' : ''}</span>
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
              <CalendarRange size={14} />
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
              <WorkoutPreviewCard
                workout={workout}
                onStartWorkout={handleStartWorkout}
              />
            )}
          </>
        ) : (
          <>
            <div className="training-rest-card">
              <div className="training-rest-card__icon">
                <Moon size={36} strokeWidth={1.5} />
              </div>
              <h3 className="training-rest-card__heading">Rest Day</h3>
              <p className="training-rest-card__message">
                Recovery is part of the plan. Rest up and come back strong.
              </p>
              <button
                className="btn btn-secondary btn-small training-rest-card__plan-btn"
                onClick={() => navigate(ROUTE_PLANNER)}
              >
                Plan today
              </button>
              {nextWorkout && (
                <div className="training-rest-card__next">
                  <span className="training-rest-card__next-label">Up next</span>
                  <div className="training-rest-card__next-main">
                    <span className="training-rest-card__next-title">
                      {nextWorkout.title}
                    </span>
                    <span className="training-rest-card__next-day">
                      {formatDayLabel(nextWorkout.daysAway)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {templateList && templateList.length > 0 && (
          <section className="training-templates" aria-labelledby="training-quick-start">
            <div className="training-templates__header">
              <div>
                <h2 id="training-quick-start" className="training-templates__title">
                  Quick Start
                </h2>
                <p className="training-templates__subtext">
                  Preview a saved template and train on demand.
                </p>
              </div>
              <Sparkles size={18} aria-hidden="true" />
            </div>
            <div className="training-templates__scroll">
              {templateList.map((tpl) => {
                const exercises = getTemplateExercises(tpl);
                const setCount = getTemplateSetCount(tpl);
                return (
                  <button
                    key={tpl.id}
                    className="training-templates__card"
                    onClick={() => setPreviewTemplate(tpl)}
                    aria-label={`Preview ${tpl.name}`}
                  >
                    <span className="training-templates__card-kicker">
                      <Play size={12} aria-hidden="true" />
                      Template
                    </span>
                    <span className="training-templates__card-name">{tpl.name}</span>
                    <span className="training-templates__card-meta">
                      {exercises.length} exercise{exercises.length !== 1 ? 's' : ''} · {setCount} set{setCount !== 1 ? 's' : ''}
                    </span>
                    <span className="training-templates__card-exercises">
                      {exercises.slice(0, 3).map((ex) => ex.title).join(' / ')}
                      {exercises.length > 3 ? ` / +${exercises.length - 3} more` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Template preview sheet */}
      {previewTemplate && (
        <TemplatePreviewSheet
          template={previewTemplate}
          onStartNow={() => {
            if (onScheduleTemplate) {
              onScheduleTemplate(currentDate, previewTemplate.name);
              onStartWorkout(`${currentDate}::${previewTemplate.name}`);
            }
            setPreviewTemplate(null);
          }}
          onSchedule={() => {
            setPreviewTemplate(null);
            navigate(ROUTE_PLANNER);
          }}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </div>
  );
}
