const CELL = 14;
const GAP = 2;
const LABEL_W = 20;

export default function CalendarHeatmap({ dates, range }) {
  const end = range ? new Date(range.end + 'T12:00:00') : new Date();
  const start = range ? new Date(range.start + 'T12:00:00') : (() => {
    const d = new Date(end);
    d.setDate(d.getDate() - 90);
    return d;
  })();

  // Build weeks grid
  const weeks = [];
  const cursor = new Date(start);
  // Align to Monday
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
  const height = 7 * (CELL + GAP) + 4;

  const dayLabels = ['M', '', 'W', '', 'F', '', ''];

  return (
    <svg
      className="stats-chart stats-chart--heatmap"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {dayLabels.map((label, row) => label ? (
        <text
          key={row}
          x={LABEL_W - 4}
          y={row * (CELL + GAP) + CELL / 2 + 4}
          textAnchor="end"
          fill="var(--color-text-secondary)"
          fontSize="9"
        >{label}</text>
      ) : null)}

      {weeks.map((week, col) =>
        week.map((day, row) => {
          if (!day.inRange) return null;
          return (
            <rect
              key={`${col}-${row}`}
              x={LABEL_W + col * (CELL + GAP)}
              y={row * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={2}
              fill={day.active ? 'var(--color-accent-green)' : 'var(--color-surface)'}
              opacity={day.active ? 0.9 : 0.5}
            />
          );
        })
      )}
    </svg>
  );
}
