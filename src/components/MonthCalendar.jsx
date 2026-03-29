import { useState, useRef, useEffect } from 'react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function MonthCalendar({
  currentDate,
  onDateChange,
  schedule,
  completedDates,
}) {
  const [displayMonth, setDisplayMonth] = useState(() => {
    const date = new Date(currentDate + 'T00:00:00');
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const formatDateString = (year, month, day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const generateCalendarDays = () => {
    const { year, month } = displayMonth;
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return days;
  };

  const getMonthYearDisplay = () => {
    const date = new Date(displayMonth.year, displayMonth.month, 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const goToPreviousMonth = () => {
    setDisplayMonth((prev) => {
      const newMonth = prev.month === 0 ? 11 : prev.month - 1;
      const newYear = prev.month === 0 ? prev.year - 1 : prev.year;
      return { year: newYear, month: newMonth };
    });
  };

  const goToNextMonth = () => {
    setDisplayMonth((prev) => {
      const newMonth = prev.month === 11 ? 0 : prev.month + 1;
      const newYear = prev.month === 11 ? prev.year + 1 : prev.year;
      return { year: newYear, month: newMonth };
    });
  };

  const goToToday = () => {
    const today = new Date();
    setDisplayMonth({
      year: today.getFullYear(),
      month: today.getMonth(),
    });
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    onDateChange(`${y}-${m}-${d}`);
  };

  const jumpToMonth = (month) => {
    setDisplayMonth((prev) => ({ ...prev, month }));
    setShowPicker(false);
  };

  const jumpToYear = (delta) => {
    setDisplayMonth((prev) => ({ ...prev, year: prev.year + delta }));
  };

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPicker]);

  const _todayObj = new Date();
  const today = `${_todayObj.getFullYear()}-${String(_todayObj.getMonth() + 1).padStart(2, '0')}-${String(_todayObj.getDate()).padStart(2, '0')}`;
  const days = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="month-calendar">
      <div className="month-calendar__header flex-between">
        <button className="btn btn-secondary btn-small" onClick={goToPreviousMonth}>
          ←
        </button>
        <div className="month-calendar__title-wrapper">
          <button
            className="month-calendar__title-btn"
            onClick={() => setShowPicker(!showPicker)}
          >
            <h2 className="month-calendar__title">{getMonthYearDisplay()}</h2>
            <span className="month-calendar__title-caret">{showPicker ? '▴' : '▾'}</span>
          </button>

          {showPicker && (
            <div className="month-picker" ref={pickerRef}>
              <div className="month-picker__year-row">
                <button className="btn btn-secondary btn-small" onClick={() => jumpToYear(-1)}>
                  ←
                </button>
                <span className="month-picker__year">{displayMonth.year}</span>
                <button className="btn btn-secondary btn-small" onClick={() => jumpToYear(1)}>
                  →
                </button>
              </div>
              <div className="month-picker__months">
                {MONTH_NAMES.map((name, idx) => (
                  <button
                    key={name}
                    className={`month-picker__month ${
                      idx === displayMonth.month ? 'month-picker__month--active' : ''
                    }`}
                    onClick={() => jumpToMonth(idx)}
                  >
                    {name.substring(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button className="btn btn-secondary btn-small" onClick={goToNextMonth}>
          →
        </button>
        <button className="btn btn-secondary btn-small" onClick={goToToday}>
          Today
        </button>
      </div>

      <div className="month-calendar__grid">
        {/* Week day headers */}
        {weekDays.map((day) => (
          <div key={day} className="month-calendar__weekday">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map((day, idx) => {
          if (!day) {
            return (
              <div key={`empty-${idx}`} className="month-calendar__day month-calendar__day--empty" />
            );
          }

          const dateStr = formatDateString(displayMonth.year, displayMonth.month, day);
          const hasWorkout = schedule[dateStr] !== undefined;
          const isCompleted = completedDates.has(dateStr);
          const isSelected = dateStr === currentDate;
          const isToday = dateStr === today;
          const isPast = dateStr < today;

          const dayStatus = isCompleted
            ? 'completed'
            : hasWorkout && isPast
              ? 'missed'
              : hasWorkout
                ? 'scheduled'
                : 'none';

          return (
            <button
              key={dateStr}
              className={`month-calendar__day month-calendar__day--${dayStatus} ${
                isSelected ? 'month-calendar__day--selected' : ''
              } ${isToday ? 'month-calendar__day--today' : ''}`}
              onClick={() => onDateChange(dateStr)}
              title={schedule[dateStr] || 'No workout'}
            >
              <div className="month-calendar__day-number">{day}</div>
              {hasWorkout && (
                <div className="month-calendar__day-label">
                  {isCompleted ? '✓' : isPast ? '✗' : '•'}
                </div>
              )}
              {schedule[dateStr] && (
                <div className="month-calendar__day-workout">
                  {schedule[dateStr].substring(0, 12)}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
