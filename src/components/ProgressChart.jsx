import { useState } from 'react';

const CHART_WIDTH = 400;
const CHART_HEIGHT = 200;
const SPARKLINE_HEIGHT = 50;
const PADDING = { top: 16, right: 16, bottom: 24, left: 40 };
const TOTAL_HEIGHT = CHART_HEIGHT + SPARKLINE_HEIGHT + 8; // 8px gap between chart and sparkline

export default function ProgressChart({ sessions }) {
  const [activeDot, setActiveDot] = useState(null);

  if (!sessions || sessions.length < 2) return null;

  const n = sessions.length;
  const weights = sessions.map((s) => s.bestWeight);
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const weightRange = maxWeight - minWeight || 1;
  const yPad = weightRange * 0.12;
  const yMin = minWeight - yPad;
  const yMax = maxWeight + yPad;

  const plotW = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotH = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  const xOf = (i) => PADDING.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yOf = (w) => PADDING.top + plotH - ((w - yMin) / (yMax - yMin)) * plotH;

  const linePoints = sessions.map((s, i) => `${xOf(i)},${yOf(s.bestWeight)}`).join(' ');

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount }, (_, i) => {
    const val = yMin + ((yMax - yMin) * i) / (tickCount - 1);
    return Math.round(val);
  });

  const volumes = sessions.map((s) => s.volume);
  const maxVolume = Math.max(...volumes) || 1;
  const sparkTop = CHART_HEIGHT + 8;
  const sparkPlotH = SPARKLINE_HEIGHT - 4;
  const barWidth = Math.max(2, plotW / n - 2);

  const buildLabel = (s) => {
    const d = new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `${d} / ${s.bestReps} reps @ ${s.bestWeight}${s.unit}`;
  };

  return (
    <div className="progress-chart">
      <div className="progress-chart__header">
        <div>
          <h2 className="progress-chart__title">Load trend</h2>
          <p className="progress-chart__subtitle">Best working weight by session</p>
        </div>
        <span className="progress-chart__unit">{sessions[0].unit}</span>
      </div>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${TOTAL_HEIGHT}`}
        width="100%"
        className="progress-chart__svg"
        role="img"
        aria-label="Weight progress chart"
      >
        {yTicks.map((tick) => {
          const y = yOf(tick);
          return (
            <g key={tick}>
              <line
                className="progress-chart__grid-line"
                x1={PADDING.left}
                y1={y}
                x2={CHART_WIDTH - PADDING.right}
                y2={y}
              />
              <text
                className="progress-chart__axis-label"
                x={PADDING.left - 4}
                y={y + 4}
                textAnchor="end"
              >
                {tick}
              </text>
            </g>
          );
        })}

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
                className="progress-chart__axis-label"
                key={s.date + origIdx}
                x={xOf(origIdx)}
                y={CHART_HEIGHT - 2}
                textAnchor="middle"
              >
                {d}
              </text>
            );
          })}

        <polyline
          className="progress-chart__line"
          points={linePoints}
          fill="none"
        />

        {sessions.map((s, i) => {
          const cx = xOf(i);
          const cy = yOf(s.bestWeight);
          const isPR = s.isPR;
          const isActive = activeDot === i;
          const tooltipX = Math.min(Math.max(cx, PADDING.left + 62), CHART_WIDTH - PADDING.right - 62);
          return (
            <g key={i}>
              <g
                className={`progress-chart__point${isActive ? ' progress-chart__point--active' : ''}`}
                onClick={() => setActiveDot(isActive ? null : i)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveDot(isActive ? null : i);
                  }
                }}
                role="button"
                tabIndex="0"
                aria-label={`${buildLabel(s)}${isPR ? ', personal record' : ''}`}
              >
                {isPR ? (
                  <rect
                    className="progress-chart__marker progress-chart__marker--pr"
                    x={cx - 6}
                    y={cy - 6}
                    width="12"
                    height="12"
                    rx="2"
                    transform={`rotate(45 ${cx} ${cy})`}
                  />
                ) : (
                  <circle className="progress-chart__marker" cx={cx} cy={cy} r="5.5" />
                )}
                <title>{buildLabel(s)}{isPR ? ' PR' : ''}</title>
              </g>
              {isActive && (
                <g className="progress-chart__tooltip">
                  <rect
                    x={tooltipX - 62}
                    y={cy - 38}
                    width="124"
                    height="26"
                    rx="8"
                  />
                  <text
                    x={tooltipX}
                    y={cy - 21}
                    textAnchor="middle"
                  >
                    {buildLabel(s)}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {sessions.map((s, i) => {
          const bh = Math.max(2, (s.volume / maxVolume) * sparkPlotH);
          const bx = xOf(i) - barWidth / 2;
          const by = sparkTop + sparkPlotH - bh;
          return (
            <rect
              className="progress-chart__volume-bar"
              key={i}
              x={bx}
              y={by}
              width={barWidth}
              height={bh}
              rx="2"
            />
          );
        })}

        <text
          className="progress-chart__axis-label progress-chart__volume-label"
          x={PADDING.left - 4}
          y={sparkTop + sparkPlotH / 2 + 4}
          textAnchor="end"
        >
          volume
        </text>
      </svg>
      <div className="progress-chart__legend" aria-hidden="true">
        <span><i className="progress-chart__legend-dot" /> session best</span>
        <span><i className="progress-chart__legend-diamond" /> PR</span>
      </div>
    </div>
  );
}
