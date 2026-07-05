const WIDTH = 360;
const HEIGHT = 154;
const PAD = { top: 14, right: 12, bottom: 30, left: 32 };

export default function SessionsChart({ data }) {
  if (!data || data.length === 0) return null;

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const barGap = data.length > 1
    ? Math.min(10, Math.max(2, (plotW * 0.12) / data.length))
    : 0;
  const barW = (plotW - barGap * (data.length - 1)) / data.length;
  const radius = Math.min(5, barW / 2);

  const formatWeek = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const yTicks = [1, Math.ceil(maxCount / 2), maxCount]
    .filter((v, i, a) => a.indexOf(v) === i);

  return (
    <svg
      className="stats-chart stats-chart--sessions"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Sessions completed by week"
    >
      <title>Sessions completed by week</title>

      {yTicks.map(val => {
        const y = PAD.top + plotH - (val / maxCount) * plotH;
        return (
          <g key={val}>
            <line
              x1={PAD.left}
              y1={y}
              x2={WIDTH - PAD.right}
              y2={y}
              stroke="var(--border-subtle)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 7}
              y={y + 4}
              textAnchor="end"
              fill="var(--text-muted)"
              fontSize="10"
              fontFamily="var(--font-mono)"
            >
              {val}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const barH = (d.count / maxCount) * plotH;
        const x = PAD.left + i * (barW + barGap);
        const y = PAD.top + plotH - barH;

        return (
          <g key={d.weekStart}>
            <rect
              x={x}
              y={PAD.top}
              width={barW}
              height={plotH}
              rx={radius}
              ry={radius}
              fill="var(--surface-high)"
              opacity="0.32"
            />
            {d.count > 0 && (
              <rect
                className="stats-chart__bar"
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={radius}
                ry={radius}
                fill="var(--accent)"
              />
            )}
            {d.count > 0 && (
              <text
                x={x + barW / 2}
                y={Math.max(PAD.top + 10, y - 5)}
                textAnchor="middle"
                fill="var(--text-secondary)"
                fontSize="9"
                fontFamily="var(--font-mono)"
                fontWeight="650"
              >
                {d.count}
              </text>
            )}
          </g>
        );
      })}

      {data.map((d, i) => {
        const x = PAD.left + i * (barW + barGap) + barW / 2;
        const showLabel = data.length <= 8 || i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2);
        if (!showLabel) return null;
        return (
          <text
            key={`label-${i}`}
            x={x}
            y={HEIGHT - 6}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="9"
            fontFamily="var(--font-mono)"
          >
            {formatWeek(d.weekStart)}
          </text>
        );
      })}
    </svg>
  );
}
