const ROW_HEIGHT = 32;
const LABEL_WIDTH = 120;
const BAR_MAX = 200;
const PAD_RIGHT = 50;
const WIDTH = LABEL_WIDTH + BAR_MAX + PAD_RIGHT;

function formatVolume(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return String(Math.round(v));
}

function truncateLabel(label, maxLen = 16) {
  return label.length > maxLen ? label.slice(0, maxLen - 1) + '…' : label;
}

export default function ExerciseVolumeChart({ data }) {
  if (!data || data.length === 0) return null;

  const items = data.slice(0, 10);
  const maxVol = items[0]?.volume || 1;
  const height = items.length * ROW_HEIGHT + 8;

  return (
    <svg
      className="stats-chart stats-chart--exercise-volume"
      viewBox={`0 0 ${WIDTH} ${height}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {items.map((item, i) => {
        const y = i * ROW_HEIGHT + 4;
        const barW = (item.volume / maxVol) * BAR_MAX;

        return (
          <g key={item.exercise}>
            <text
              x={LABEL_WIDTH - 8}
              y={y + ROW_HEIGHT / 2 + 4}
              textAnchor="end"
              fill="var(--color-text-secondary)"
              fontSize="11"
            >{truncateLabel(item.exercise)}</text>

            <rect
              x={LABEL_WIDTH}
              y={y + 6}
              width={Math.max(2, barW)}
              height={ROW_HEIGHT - 14}
              rx={3}
              fill="var(--color-accent-blue)"
              opacity={0.8}
            />

            <text
              x={LABEL_WIDTH + Math.max(2, barW) + 6}
              y={y + ROW_HEIGHT / 2 + 4}
              fill="var(--color-text-secondary)"
              fontSize="10"
            >{formatVolume(item.volume)}</text>
          </g>
        );
      })}
    </svg>
  );
}
