/**
 * Determine whether a rest timer should fire for a set completion.
 * Prevents re-firing when a set is unchecked then re-checked.
 *
 * @param {string} exerciseTitle
 * @param {number} setIndex
 * @param {boolean} wasCompleted - previous completed state
 * @param {boolean} isNowCompleted - new completed state
 * @param {Set<string>} firedSets - mutable Set tracking already-fired keys
 * @returns {boolean}
 */
export function shouldStartRestTimer(exerciseTitle, setIndex, wasCompleted, isNowCompleted, firedSets) {
  if (!wasCompleted && isNowCompleted) {
    const key = `${exerciseTitle}::${setIndex}`;
    if (!firedSets.has(key)) {
      firedSets.add(key);
      return true;
    }
  }
  return false;
}
