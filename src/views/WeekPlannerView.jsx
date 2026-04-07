import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Modal from '../components/Modal';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Parse YYYY-MM-DD in local time without timezone shifts
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekDates(startDate) {
  const d = parseLocalDate(startDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    dates.push(formatLocalDate(date));
  }
  return dates;
}

export default function WeekPlannerView({
  schedule,
  onApplyPlan,
  templateList,
  templates,
  workouts,
  showToast,
  onNavigateToDate,
}) {
  const _now = new Date();
  const today = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const [weekStart, setWeekStart] = useState(today);
  const [showPicker, setShowPicker] = useState(null); // dateStr or null
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const goToPrevWeek = () => {
    const d = parseLocalDate(weekDates[0]);
    d.setDate(d.getDate() - 7);
    setWeekStart(formatLocalDate(d));
  };

  const goToNextWeek = () => {
    const d = parseLocalDate(weekDates[0]);
    d.setDate(d.getDate() + 7);
    setWeekStart(formatLocalDate(d));
  };

  const goToThisWeek = () => {
    setWeekStart(today);
  };

  const getWorkoutForDate = (dateStr) => schedule[dateStr] || null;

  const assignTemplate = (dateStr, templateId) => {
    const tpl = templates[templateId];
    if (tpl) onApplyPlan({ [dateStr]: tpl.name });
    setShowPicker(null);
    setTemplateSearch('');
  };

  const clearDay = (dateStr) => {
    onApplyPlan({ [dateStr]: null });
  };

  // Close template picker on Escape
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e) => {
      if (e.key === 'Escape') { setShowPicker(null); setTemplateSearch(''); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showPicker]);

  const clearWeek = () => {
    const cleared = {};
    weekDates.forEach((dateStr) => {
      cleared[dateStr] = null;
    });
    onApplyPlan(cleared);
    setShowClearConfirm(false);
  };

  const repeatNextWeek = () => {
    const nextMonday = parseLocalDate(weekDates[0]);
    nextMonday.setDate(nextMonday.getDate() + 7);
    const nextWeekDates = getWeekDates(formatLocalDate(nextMonday));

    const dateMap = {};
    let skipped = 0;
    weekDates.forEach((dateStr, idx) => {
      const workoutName = getWorkoutForDate(dateStr);
      const nextDate = nextWeekDates[idx];

      if (workoutName) {
        const tpl = templateList.find((t) => t.name === workoutName);
        if (tpl) {
          dateMap[nextDate] = tpl.name;
        } else {
          // No matching template — clear the destination day so the copy is
          // consistent (don't silently leave whatever was previously scheduled)
          dateMap[nextDate] = null;
          skipped++;
        }
      } else {
        dateMap[nextDate] = null;
      }
    });

    onApplyPlan(dateMap);
    setWeekStart(nextWeekDates[0]);
    if (skipped > 0) {
      showToast(`${skipped} day${skipped > 1 ? 's' : ''} skipped — no matching template found`, 'error');
    }
  };

  const formatWeekRange = () => {
    const start = parseLocalDate(weekDates[0]);
    const end = parseLocalDate(weekDates[6]);
    const opts = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
  };

  return (
    <div className="view planner-view">
      <div className="planner-view__header">
        <h1>Week Planner</h1>
        <p className="text-secondary text-sm">{formatWeekRange()}</p>
      </div>

      <div className="planner-view__nav">
        <button className="btn btn-secondary btn-small" onClick={goToPrevWeek}>
          <ChevronLeft size={16} />
        </button>
        <button className="btn btn-secondary btn-small" onClick={goToThisWeek}>
          This Week
        </button>
        <button className="btn btn-secondary btn-small" onClick={goToNextWeek}>
          <ChevronRight size={16} />
        </button>
      </div>

      {templateList.length === 0 && (
        <div className="empty-state" style={{ marginBottom: 'var(--space-md)' }}>
          <p className="text-secondary text-sm">
            No templates yet — save a workout as a template from the Training view to start planning.
          </p>
        </div>
      )}

      <div className="planner-view__grid">
        {weekDates.map((dateStr, idx) => {
          const workoutName = getWorkoutForDate(dateStr);
          const isToday = dateStr === today;

          return (
            <div
              key={dateStr}
              className={`planner-day card ${isToday ? 'planner-day--today' : ''}`}
            >
              <div className="planner-day__header">
                <span className="planner-day__name">{DAY_NAMES[idx]}</span>
                <span className="planner-day__date">
                  {parseLocalDate(dateStr).getDate()}
                </span>
              </div>

              {workoutName ? (
                <div className="planner-day__workout">
                  <button
                    className="planner-day__workout-name"
                    onClick={() => onNavigateToDate(dateStr)}
                    title="Go to workout"
                  >
                    {workoutName}
                  </button>
                  <button
                    className="planner-day__clear"
                    onClick={() => clearDay(dateStr)}
                    title="Remove workout"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="planner-day__empty">
                  <span className="text-secondary text-sm">Rest day</span>
                </div>
              )}

              <button
                className="btn btn-secondary btn-small planner-day__assign"
                onClick={() => setShowPicker(dateStr)}
              >
                {workoutName ? 'Change' : '+ Add'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="planner-view__actions">
        <div className="planner-view__secondary-actions">
          <button
            className="btn btn-secondary btn-small"
            onClick={repeatNextWeek}
          >
            Copy to Next Week
          </button>
          <button
            className="btn btn-secondary btn-small"
            onClick={() => setShowClearConfirm(true)}
          >
            Clear Week
          </button>
        </div>
      </div>

      {/* Template Picker Modal */}
      {showPicker && (
        <div className="modal-overlay" onClick={() => { setShowPicker(null); setTemplateSearch(''); }}>
          <div className="modal template-picker" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal__title">Pick a Template</h2>
            <p className="modal__message">
              {DAY_NAMES[weekDates.indexOf(showPicker)]},{' '}
              {parseLocalDate(showPicker).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </p>

            {templateList.length === 0 ? (
              <div className="empty-state">
                <p className="text-secondary">
                  No templates yet. Save a workout as a template from the Training view.
                </p>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="input"
                  placeholder="Search templates..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  style={{ marginBottom: 'var(--space-sm)' }}
                />
                <div className="template-picker__list">
                  {templateList
                    .filter((tpl) =>
                      tpl.name.toLowerCase().includes(templateSearch.toLowerCase())
                    )
                    .map((tpl) => (
                      <button
                        key={tpl.id}
                        className="template-picker__item"
                        onClick={() => assignTemplate(showPicker, tpl.id)}
                      >
                        <span className="template-picker__name">{tpl.name}</span>
                        <span className="template-picker__meta text-secondary text-sm">
                          {tpl.blocks.reduce(
                            (sum, b) => sum + b.exercises.length,
                            0
                          )}{' '}
                          exercises
                        </span>
                      </button>
                    ))}
                </div>
              </>
            )}

            <button
              className="btn btn-secondary w-full mt-lg"
              onClick={() => { setShowPicker(null); setTemplateSearch(''); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <Modal
          title="Clear Week?"
          message="This will remove all workouts from this week."
          onConfirm={clearWeek}
          onCancel={() => setShowClearConfirm(false)}
          confirmText="Clear"
          cancelText="Keep"
          isDestructive
        />
      )}
    </div>
  );
}
