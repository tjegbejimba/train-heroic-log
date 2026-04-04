// Feature-detect navigator.vibrate (not available on iOS Safari)
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

export function hapticLight() {
  if (canVibrate) navigator.vibrate(10);
}

export function hapticMedium() {
  if (canVibrate) navigator.vibrate([30, 20, 30]);
}

export function hapticHeavy() {
  if (canVibrate) navigator.vibrate([50, 30, 50, 30, 50]);
}

export function hapticSuccess() {
  if (canVibrate) navigator.vibrate([30, 50, 80]);
}
