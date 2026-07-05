const ROW_HEIGHT = 34;
const RANK_WIDTH = 24;
const LABEL_WIDTH = 118;
const BAR_MAX = 164;
const PAD_RIGHT = 54;
const WIDTH = RANK_WIDTH + LABEL_WIDTH + BAR_MAX + PAD_RIGHT;

function formatVolume(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return String(Math.round(v));
}

function truncateLabel(label, maxLen = 17) {
  return label.length > maxLen ? label.slice(0, maxLen - 1) + '…' : label;
}

export default function ExerciseVolumeChart({ data }) {
  if (!data || data.length === 0) return null;

  const items = data.slice(0, 10);
  const maxVol = items[0]?.volume || 1;
  const height = items.length * ROW_HEIGHT + 10;
  const barX = RANK_WIDTH + LABEL_WIDTH;

  return (
    <svg
      className="stats-chart stats-chart--exercise-volume"
      viewBox={`0 0 ${WIDTH} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Exercise volume distribution"
    >
      <title>Exercise volume distribution</title>

      {items.map((item, i) => {
        const y = i * ROW_HEIGHT + 5;
        const barW = (item.volume / maxVol) * BAR_MAX;
        const displayedVolume = formatVolume(item.volume);

        return (
          <g key={item.exercise}>
            <text
              x={RANK_WIDTH - 6}
              y={y + ROW_HEIGHT / 2 + 4}
              textAnchor="end"
              fill={i === 0 ? 'var(--accent-text)' : 'var(--text-muted)'}
              fontSize="10"
              fontFamily="var(--font-mono)"
              fontWeight="700"
            >
              {i + 1}
            </text>

            <text
              x={barX - 10}
              y={y + ROW_HEIGHT / 2 + 4}
              textAnchor="end"
              fill="var(--text-secondary)"
              fontSize="11"
              fontFamily="var(--font-sans)"
              fontWeight="600"
            >
              {truncateLabel(item.exercise)}
              <title>{item.exercise}</title>
            </text>

            <rect
              x={barX}
              y={y + 7}
              width={BAR_MAX}
              height={ROW_HEIGHT - 16}
              rx={5}
              fill="var(--surface-high)"
              opacity="0.42"
            />

            <rect
              className="stats-chart__bar"
              x={barX}
              y={y + 7}
              width={Math.max(3, barW)}
              height={ROW_HEIGHT - 16}
              rx={5}
              fill={i === 0 ? 'var(--accent)' : 'var(--accent-text)'}
              opacity={i === 0 ? 0.95 : 0.64}
            >
              <title>{item.exercise}: {displayedVolume} {item.unit}</title>
            </rect>

            <text
              x={barX + BAR_MAX + 8}
              y={y + ROW_HEIGHT / 2 + 4}
              fill="var(--text-muted)"
              fontSize="10"
              fontFamily="var(--font-mono)"
              fontWeight="650"
            >
              {displayedVolume}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
