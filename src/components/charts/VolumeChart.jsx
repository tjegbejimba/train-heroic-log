import { useState } from 'react';

const WIDTH = 360;
const HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 28, left: 48 };

function formatVolume(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return String(Math.round(v));
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

  return (
    <svg
      className="stats-chart stats-chart--volume"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {yTicks.map(val => (
        <g key={val}>
          <line
            x1={PAD.left} y1={yOf(val)}
            x2={WIDTH - PAD.right} y2={yOf(val)}
            stroke="var(--color-border)" strokeWidth="0.5"
          />
          <text
            x={PAD.left - 6} y={yOf(val) + 4}
            textAnchor="end" fill="var(--color-text-secondary)"
            fontSize="10"
          >{formatVolume(val)}</text>
        </g>
      ))}

      <polygon points={areaPoints} fill="var(--color-accent-blue)" opacity="0.15" />
      <polyline
        points={linePoints}
        fill="none" stroke="var(--color-accent-blue)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
      />

      {data.map((d, i) => (
        <circle
          key={i}
          cx={xOf(i)} cy={yOf(d.volume)} r={activeIdx === i ? 5 : 3}
          fill="var(--color-accent-blue)"
          onPointerEnter={() => setActiveIdx(i)}
          onPointerLeave={() => setActiveIdx(null)}
          style={{ cursor: 'pointer' }}
        />
      ))}

      {activeIdx !== null && (
        <text
          x={xOf(activeIdx)}
          y={yOf(data[activeIdx].volume) - 10}
          textAnchor="middle" fill="var(--color-text-primary)"
          fontSize="11" fontWeight="600"
        >{formatVolume(data[activeIdx].volume)} {data[activeIdx].unit}</text>
      )}

      {xLabels.map(({ i, label }) => (
        <text
          key={i}
          x={xOf(i)} y={HEIGHT - 4}
          textAnchor="middle" fill="var(--color-text-secondary)"
          fontSize="10"
        >{label}</text>
      ))}
    </svg>
  );
}
