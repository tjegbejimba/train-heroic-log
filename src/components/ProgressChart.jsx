import { useState } from 'react';

const CHART_WIDTH = 400;
const CHART_HEIGHT = 200;
const SPARKLINE_HEIGHT = 50;
const PADDING = { top: 16, right: 16, bottom: 24, left: 40 };
const TOTAL_HEIGHT = CHART_HEIGHT + SPARKLINE_HEIGHT + 8; // 8px gap between chart and sparkline

export default function ProgressChart({ sessions }) {
  const [activeDot, setActiveDot] = useState(null);

  if (!sessions || sessions.length < 2) return null;

  // --- Compute chart geometry ---
  const n = sessions.length;
  const weights = sessions.map((s) => s.bestWeight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  // Pad the y range a bit so dots aren't clipped at the edges
  const weightRange = maxWeight - minWeight || 1;
  const yPad = weightRange * 0.12;
  const yMin = minWeight - yPad;
  const yMax = maxWeight + yPad;

  const plotW = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const xOf = (i) => PADDING.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yOf = (w) => PADDING.top + plotH - ((w - yMin) / (yMax - yMin)) * plotH;

  // Build SVG polyline points
  const linePoints = sessions.map((s, i) => `${xOf(i)},${yOf(s.bestWeight)}`).join(' ');

  // --- Y axis tick labels (3–4 ticks) ---
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const val = yMin + ((yMax - yMin) * i) / (tickCount - 1);
    return Math.round(val);
  });

  // --- Volume sparkline ---
  const volumes = sessions.map((s) => s.volume);
  const maxVolume = Math.max(...volumes) || 1;
  const sparkTop = CHART_HEIGHT + 8;
  const sparkPlotH = SPARKLINE_HEIGHT - 4;
  const barWidth = Math.max(2, plotW / n - 2);

  // --- Tooltip label for active dot ---
  const buildLabel = (s) => {
    const d = new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `${d} · ${s.bestReps} reps @ ${s.bestWeight}${s.unit}`;
  };

  return (
    <div className="progress-chart">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${TOTAL_HEIGHT}`}
        width="100%"
        style={{ display: 'block', overflow: 'visible' }}
        aria-label="Weight progress chart"
      >
        {/* Y axis ticks + labels */}
        {yTicks.map((tick) => {
          const y = yOf(tick);
          return (
            <g key={tick}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={CHART_WIDTH - PADDING.right}
                y2={y}
                stroke="rgba(51, 65, 85, 0.6)"
                strokeWidth="1"
              />
              <text
                x={PADDING.left - 4}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#64748b"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Unit label on y axis */}
        <text
          x={6}
          y={PADDING.top}
          fontSize="9"
          fill="#64748b"
          textAnchor="start"
        >
          {sessions[0].unit}
        </text>

        {/* X axis labels (first, last, and up to 2 in between for readability) */}
        {sessions
          .filter((_, i) => {
            if (n <= 4) return true;
            return i === 0 || i === n - 1 || i === Math.floor((n - 1) / 3) || i === Math.floor((2 * (n - 1)) / 3);
          })
          .map((s, _, arr) => {
            const origIdx = sessions.indexOf(s);
            const d = new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });
            return (
              <text
                key={s.date + origIdx}
                x={xOf(origIdx)}
                y={CHART_HEIGHT - 2}
                textAnchor="middle"
                fontSize="9"
                fill="#64748b"
              >
                {d}
              </text>
            );
          })}

        {/* Line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="var(--color-accent-blue, #6366f1)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots */}
        {sessions.map((s, i) => {
          const cx = xOf(i);
          const cy = yOf(s.bestWeight);
          const isPR = s.isPR;
          const r = isPR ? 10 : 8;
          const fill = isPR ? 'var(--color-accent-yellow, #fbbf24)' : 'var(--color-accent-blue, #6366f1)';
          const isActive = activeDot === i;
          return (
            <g key={i}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={fill}
                stroke={isActive ? '#fff' : 'transparent'}
                strokeWidth={isActive ? 2 : 0}
                style={{ cursor: 'pointer' }}
                onClick={() => setActiveDot(isActive ? null : i)}
              >
                <title>{buildLabel(s)}{isPR ? ' 🏆 PR' : ''}</title>
              </circle>
              {/* Tap label for active dot */}
              {isActive && (
                <g>
                  {/* Background rect */}
                  <rect
                    x={Math.min(cx - 60, CHART_WIDTH - PADDING.right - 120)}
                    y={cy - r - 30}
                    width="120"
                    height="22"
                    rx="5"
                    fill="var(--color-surface-elevated, #334155)"
                    stroke="rgba(99, 102, 241, 0.3)"
                    strokeWidth="1"
                  />
                  <text
                    x={Math.min(cx, CHART_WIDTH - PADDING.right - 60)}
                    y={cy - r - 14}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#fff"
                  >
                    {buildLabel(s)}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Volume sparkline bars */}
        {sessions.map((s, i) => {
          const bh = Math.max(2, (s.volume / maxVolume) * sparkPlotH);
          const bx = xOf(i) - barWidth / 2;
          const by = sparkTop + sparkPlotH - bh;
          return (
            <rect
              key={i}
              x={bx}
              y={by}
              width={barWidth}
              height={bh}
              fill="rgba(99, 102, 241, 0.3)"
              rx="2"
            />
          );
        })}

        {/* Sparkline label */}
        <text
          x={PADDING.left - 4}
          y={sparkTop + sparkPlotH / 2 + 4}
          textAnchor="end"
          fontSize="8"
          fill="#64748b"
        >
          vol
        </text>
      </svg>
    </div>
  );
}
