const UNIT_LABELS = {
  lb: 'lb', kg: 'kg', '%': '%', yd: 'yd', m: 'm',
  RPE: 'RPE', in: 'in', ft: 'ft', sec: 'Time', time: 'Time',
};

export function getSetMeta(set) {
  const isBodyweight = set.unit === 'bw' || set.unit === 'reps';
  const isTimeWeight = set.unit === 'sec' || set.unit === 'time';
  const isTimeReps = set.repsUnit === 'sec' || set.repsUnit === 'time';

  const weightLabel = isTimeWeight
    ? 'Time'
    : (UNIT_LABELS[set.unit] || 'Weight');

  const repsLabel = isTimeReps
    ? 'Time'
    : (set.repsUnit && set.repsUnit !== 'reps'
        ? (UNIT_LABELS[set.repsUnit] || set.repsUnit)
        : 'Reps');

  return { isBodyweight, isTimeWeight, isTimeReps, weightLabel, repsLabel };
}

export function getUnitLabel(unit) {
  return UNIT_LABELS[unit] || unit || '';
}
