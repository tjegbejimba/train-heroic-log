const CELL = 12;
const GAP = 3;
const LABEL_W = 22;
const MONTH_H = 15;

export default function CalendarHeatmap({ dates, range }) {
  const end = range ? new Date(range.end + 'T12:00:00') : new Date();
  const start = range ? new Date(range.start + 'T12:00:00') : (() => {
    const d = new Date(end);
    d.setDate(d.getDate() - 90);
    return d;
  })();

  const weeks = [];
  const cursor = new Date(start);
  const dayOfWeek = cursor.getDay();
  cursor.setDate(cursor.getDate() - ((dayOfWeek + 6) % 7));

  while (cursor <= end) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const inRange = cursor >= start && cursor <= end;
      week.push({
        date: dateStr,
        active: dates.has(dateStr),
        inRange,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  const width = LABEL_W + weeks.length * (CELL + GAP);
  const height = MONTH_H + 7 * (CELL + GAP) + 2;
  const dayLabels = ['M', '', 'W', '', 'F', '', ''];

  const monthLabels = weeks
    .map((week, col) => {
      const firstInRange = week.find((day) => day.inRange);
      if (!firstInRange) return null;
      const d = new Date(firstInRange.date + 'T12:00:00');
      if (d.getDate() > 7 && col !== 0) return null;
      return {
        col,
        label: d.toLocaleDateString('en-US', { month: 'short' }),
      };
    })
    .filter(Boolean);

  return (
    <svg
      className="stats-chart stats-chart--heatmap"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label="Workout activity calendar"
    >
      <title>Workout activity calendar</title>

      {monthLabels.map(({ col, label }) => (
        <text
          key={`${label}-${col}`}
          x={LABEL_W + col * (CELL + GAP)}
          y={9}
          fill="var(--text-muted)"
          fontSize="9"
          fontFamily="var(--font-sans)"
          fontWeight="600"
        >
          {label}
        </text>
      ))}

      {dayLabels.map((label, row) => label ? (
        <text
          key={row}
          x={LABEL_W - 5}
          y={MONTH_H + row * (CELL + GAP) + CELL / 2 + 3}
          textAnchor="end"
          fill="var(--text-muted)"
          fontSize="9"
          fontFamily="var(--font-sans)"
          fontWeight="600"
        >
          {label}
        </text>
      ) : null)}

      {weeks.map((week, col) =>
        week.map((day, row) => {
          if (!day.inRange) return null;
          const label = `${day.date}: ${day.active ? 'workout completed' : 'no workout'}`;
          return (
            <rect
              key={`${col}-${row}`}
              className={day.active ? 'stats-chart__heat-cell stats-chart__heat-cell--active' : 'stats-chart__heat-cell'}
              x={LABEL_W + col * (CELL + GAP)}
              y={MONTH_H + row * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={3}
              fill={day.active ? 'var(--accent)' : 'var(--surface-high)'}
              stroke={day.active ? 'var(--accent-line)' : 'var(--border-subtle)'}
              strokeWidth="1"
              opacity={day.active ? 1 : 0.42}
            >
              <title>{label}</title>
            </rect>
          );
        })
      )}
    </svg>
  );
}
