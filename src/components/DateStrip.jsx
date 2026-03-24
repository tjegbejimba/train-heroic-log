import { useEffect, useRef } from 'react';

export default function DateStrip({
  currentDate,
  onDateChange,
  schedule,
  completedDates,
  viewMode = 'week',
  onViewModeChange,
}) {
  const scrollContainerRef = useRef(null);

  const parseLocalDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const formatLocalDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Generate a week of dates around the current date
  const generateWeek = (centerDate) => {
    const center = parseLocalDate(centerDate);
    const week = [];
    for (let i = -3; i <= 3; i++) {
      const date = new Date(center);
      date.setDate(date.getDate() + i);
      week.push(formatLocalDate(date));
    }
    return week;
  };

  const week = generateWeek(currentDate);

  // Scroll to current date when it changes
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const midButton = container.querySelector(
      `[data-date="${currentDate}"]`
    );
    if (midButton) {
      midButton.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentDate]);

  const goToToday = () => {
    const today = new Date().toISOString().split('T')[0];
    onDateChange(today);
  };

  const formatDateDisplay = (dateStr) => {
    return parseLocalDate(dateStr).getDate();
  };

  const formatMonthYear = (dateStr) => {
    const date = parseLocalDate(dateStr);
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    return `${month.toUpperCase()} '${String(year).slice(-2)}`;
  };

  return (
    <div className="date-strip">
      <div className="date-strip__header flex-between">
        <h2 className="date-strip__month-year">
          {formatMonthYear(currentDate)} ▾
        </h2>
        <div className="date-strip__controls flex gap-sm">
          {onViewModeChange && (
            <button
              className={`btn btn-secondary btn-small ${
                viewMode === 'month' ? 'btn--active' : ''
              }`}
              onClick={() => onViewModeChange(viewMode === 'week' ? 'month' : 'week')}
            >
              {viewMode === 'week' ? '📅 Month' : '📍 Week'}
            </button>
          )}
          <button className="btn btn-secondary btn-small" onClick={goToToday}>
            TODAY
          </button>
        </div>
      </div>

      <div className="date-strip__scroll" ref={scrollContainerRef}>
        <div className="date-strip__days">
          {week.map((dateStr) => {
            const isSelected = dateStr === currentDate;
            const hasWorkout = schedule[dateStr] !== undefined;
            const isCompleted = completedDates.has(dateStr);
            const today = new Date().toISOString().split('T')[0];
            const isToday = dateStr === today;

            return (
              <button
                key={dateStr}
                data-date={dateStr}
                className={`date-strip__day ${
                  isSelected ? 'date-strip__day--selected' : ''
                } ${hasWorkout ? 'date-strip__day--scheduled' : ''} ${
                  isCompleted ? 'date-strip__day--completed' : ''
                } ${isToday ? 'date-strip__day--today' : ''}`}
                onClick={() => onDateChange(dateStr)}
              >
                <div className="date-strip__day-number">
                  {formatDateDisplay(dateStr)}
                </div>
                {hasWorkout && (
                  <div className="date-strip__day-indicator">
                    {isCompleted ? '✓' : '•'}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
