import { useState, useRef, useEffect, useMemo } from 'react';
import { calculatePlates, formatPlates } from '../utils/plateCalculator';

export default function PlateDisplay({ weight, barWeight, unit }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const numWeight = Number(weight);
  const result = useMemo(
    () => (weight && numWeight > 0 ? calculatePlates(numWeight, barWeight, unit) : null),
    [weight, numWeight, barWeight, unit]
  );
  const text = result ? formatPlates(result) : null;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!result) return null;

  return (
    <span className="plate-display" ref={ref}>
      <button
        type="button"
        className="plate-display__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Plate breakdown"
      >
        🏋️
      </button>
      {open && (
        <span className="plate-display__popover">{text}</span>
      )}
    </span>
  );
}
