/**
 * Epley formula: 1RM = weight × (1 + reps / 30)
 * Most accurate for 1-10 reps
 */
export function epley(weight, reps) {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/**
 * Brzycki formula: 1RM = weight × 36 / (37 - reps)
 * Most accurate for 1-12 reps
 */
export function brzycki(weight, reps) {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  if (reps >= 37) return 0; // formula breaks down
  return weight * 36 / (37 - reps);
}

/**
 * Average of Epley and Brzycki
 */
export function estimated1RM(weight, reps) {
  const e = epley(weight, reps);
  const b = brzycki(weight, reps);
  if (e === 0 && b === 0) return 0;
  if (e === 0) return b;
  if (b === 0) return e;
  return (e + b) / 2;
}
