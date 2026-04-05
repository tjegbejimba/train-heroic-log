const WIDTH = 360;
const HEIGHT = 150;
const PAD = { top: 12, right: 12, bottom: 28, left: 32 };

export default function SessionsChart({ data }) {
  if (!data || data.length === 0) return null;

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const barGap = Math.max(2, plotW * 0.1 / data.length);
  const barW = Math.max(6, (plotW - barGap * (data.length - 1)) / data.length);
  const radius = Math.min(3, barW / 2);

  const formatWeek = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <svg
      className="stats-chart stats-chart--sessions"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {[1, Math.ceil(maxCount / 2), maxCount].filter((v, i, a) => a.indexOf(v) === i).map(val => {
        const y = PAD.top + plotH - (val / maxCount) * plotH;
        return (
          <g key={val}>
            <line
              x1={PAD.left} y1={y}
              x2={WIDTH - PAD.right} y2={y}
              stroke="var(--color-border)" strokeWidth="0.5"
            />
            <text
              x={PAD.left - 6} y={y + 4}
              textAnchor="end" fill="var(--color-text-secondary)"
              fontSize="10"
            >{val}</text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const barH = (d.count / maxCount) * plotH;
        const x = PAD.left + i * (barW + barGap);
        const y = PAD.top + plotH - barH;

        return (
          <g key={i}>
            <rect
              x={x} y={y}
              width={barW} height={barH}
              rx={radius} ry={radius}
              fill="var(--color-accent-blue)" opacity="0.85"
            />
            {d.count > 0 && (
              <text
                x={x + barW / 2} y={y - 4}
                textAnchor="middle" fill="var(--color-text-secondary)"
                fontSize="9"
              >{d.count}</text>
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
            x={x} y={HEIGHT - 4}
            textAnchor="middle" fill="var(--color-text-secondary)"
            fontSize="9"
          >{formatWeek(d.weekStart)}</text>
        );
      })}
    </svg>
  );
}
