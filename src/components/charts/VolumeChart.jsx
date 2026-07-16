import { useState } from 'react';

const WIDTH = 360;
const HEIGHT = 182;
const PAD = { top: 16, right: 14, bottom: 30, left: 48 };

function formatVolume(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return String(Math.round(v));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function VolumeChart({ data }) {
  const [activeIdx, setActiveIdx] = useState(null);

  if (!data || data.length === 0) return null;

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const volumes = data.map(d => d.volume);
  const maxV = Math.max(...volumes) || 1;
  const minV = Math.min(...volumes);
  const range = maxV - minV || 1;
  const yPad = range * 0.1;
  const yMin = Math.max(0, minV - yPad);
  const yMax = maxV + yPad;

  const xOf = i => PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const yOf = v => PAD.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const linePoints = data.map((d, i) => `${xOf(i)},${yOf(d.volume)}`).join(' ');
  const areaPoints = `${xOf(0)},${PAD.top + plotH} ${linePoints} ${xOf(data.length - 1)},${PAD.top + plotH}`;

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const val = yMin + ((yMax - yMin) * i) / (tickCount - 1);
    return Math.round(val);
  });

  const formatWeek = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const xLabels = [];
  if (data.length <= 6) {
    data.forEach((d, i) => xLabels.push({ i, label: formatWeek(d.weekStart) }));
  } else {
    xLabels.push({ i: 0, label: formatWeek(data[0].weekStart) });
    const mid = Math.floor(data.length / 2);
    xLabels.push({ i: mid, label: formatWeek(data[mid].weekStart) });
    xLabels.push({ i: data.length - 1, label: formatWeek(data[data.length - 1].weekStart) });
  }

  const activePoint = activeIdx !== null ? data[activeIdx] : null;
  const tooltipText = activePoint ? `${formatVolume(activePoint.volume)} ${activePoint.unit}` : '';
  const tooltipW = tooltipText.length * 7 + 14;
  const tooltipX = activeIdx !== null
    ? clamp(xOf(activeIdx), PAD.left + tooltipW / 2, WIDTH - PAD.right - tooltipW / 2)
    : 0;
  const tooltipY = activeIdx !== null
    ? Math.max(12, yOf(activePoint.volume) - 28)
    : 0;

  return (
    <svg
      className="stats-chart stats-chart--volume"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Volume trend by week"
    >
      <title>Volume trend by week</title>

      {yTicks.map((val, i) => (
        <g key={`${i}-${val}`}>
          <line
            x1={PAD.left}
            y1={yOf(val)}
            x2={WIDTH - PAD.right}
            y2={yOf(val)}
            stroke="var(--border-subtle)"
            strokeWidth="1"
          />
          <text
            x={PAD.left - 7}
            y={yOf(val) + 4}
            textAnchor="end"
            fill="var(--text-muted)"
            fontSize="10"
            fontFamily="var(--font-mono)"
          >
            {formatVolume(val)}
          </text>
        </g>
      ))}

      <polygon className="stats-chart__area" points={areaPoints} fill="var(--accent-subtle)" />
      <polyline
        className="stats-chart__line"
        points={linePoints}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {data.map((d, i) => (
        <circle
          key={d.weekStart}
          className="stats-chart__point"
          cx={xOf(i)}
          cy={yOf(d.volume)}
          r={activeIdx === i ? 5 : 3.5}
          fill={activeIdx === i ? 'var(--accent-hover)' : 'var(--accent)'}
          stroke="var(--surface-elevated)"
          strokeWidth="2"
          tabIndex={0}
          role="img"
          aria-label={`${formatWeek(d.weekStart)} volume ${formatVolume(d.volume)} ${d.unit}`}
          onPointerEnter={() => setActiveIdx(i)}
          onPointerLeave={() => setActiveIdx(null)}
          onFocus={() => setActiveIdx(i)}
          onBlur={() => setActiveIdx(null)}
        />
      ))}

      {activePoint && (
        <g transform={`translate(${tooltipX}, ${tooltipY})`} pointerEvents="none">
          <rect
            x={-tooltipW / 2}
            y="-14"
            width={tooltipW}
            height="20"
            rx="7"
            fill="var(--surface-elevated)"
            stroke="var(--accent-line)"
          />
          <text
            y="0"
            textAnchor="middle"
            fill="var(--text)"
            fontSize="11"
            fontFamily="var(--font-mono)"
            fontWeight="650"
          >
            {tooltipText}
          </text>
        </g>
      )}

      {xLabels.map(({ i, label }) => {
        // Anchor edge labels inward to prevent overflow at narrow widths
        // Interior labels remain centered under their data points
        let anchor = 'middle';
        if (xLabels.length > 1) {
          if (i === xLabels[0].i) anchor = 'start';
          else if (i === xLabels[xLabels.length - 1].i) anchor = 'end';
        }
        
        return (
          <text
            key={i}
            x={xOf(i)}
            y={HEIGHT - 6}
            textAnchor={anchor}
            fill="var(--text-muted)"
            fontSize="10"
            fontFamily="var(--font-mono)"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
