// Shared registry + background-isolation utility backing the app's modal-like
// overlays (Modal, FeedbackModal, RestTimer). A single source of truth lets
// multiple overlay components cooperate instead of building competing focus
// traps: only the topmost registered surface should react to Escape, and the
// "protected" (interactive) DOM only ever grows/shrinks from one place.

const stack = [];

// Tracks the inert/aria-hidden state we changed on body children, so we can
// restore exactly what was there before (and never clobber a value some other
// part of the app was already relying on).
const originalState = new Map();

export function pushModal(id) {
  if (!stack.includes(id)) stack.push(id);
}

export function popModal(id) {
  const idx = stack.indexOf(id);
  if (idx !== -1) stack.splice(idx, 1);
}

export function isTopModal(id) {
  return stack.length > 0 && stack[stack.length - 1] === id;
}

export function activeModalCount() {
  return stack.length;
}

// Which DOM node each open overlay wants to keep interactive. Consumers call
// this alongside pushModal/popModal. getProtectedNodes() returns every
// currently-registered node (a generic registry query); getActiveProtectedNodes()
// returns only the topmost overlay's node, which is what background-isolation
// must actually protect — every overlay underneath the topmost one is exactly
// as "background" as true page content and must go inert too while covered.
const protectedNodes = new Map();

export function registerProtectedNode(id, node) {
  if (node) protectedNodes.set(id, node);
}

export function unregisterProtectedNode(id) {
  protectedNodes.delete(id);
}

export function getProtectedNodes() {
  return Array.from(protectedNodes.values());
}

export function getActiveProtectedNodes() {
  const topId = stack[stack.length - 1];
  const node = topId !== undefined ? protectedNodes.get(topId) : undefined;
  return node ? [node] : [];
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
}

// Marks every direct child of <body> that is NOT in `protectedElements` as
// inert + aria-hidden, so background content is unreachable by pointer,
// keyboard, and assistive-tech "browse mode" navigation alike. Safe to call
// repeatedly as the set of open overlays changes (nested/rapidly replaced
// modals) — it only records original state for elements it hasn't already
// touched, and only restores elements it actually changed.
export function lockBackground(protectedElements) {
  if (typeof document === 'undefined' || !document.body) return;
  const protectedSet = new Set((protectedElements || []).filter(Boolean));
  const children = Array.from(document.body.children);

  for (const child of children) {
    const shouldProtect = protectedSet.has(child);
    const wasLocked = originalState.has(child);

    if (shouldProtect) {
      if (wasLocked) {
        const prev = originalState.get(child);
        if (prev.inert) child.setAttribute('inert', ''); else child.removeAttribute('inert');
        if (prev.ariaHidden === null) child.removeAttribute('aria-hidden'); else child.setAttribute('aria-hidden', prev.ariaHidden);
        originalState.delete(child);
      }
    } else if (!wasLocked) {
      originalState.set(child, {
        inert: child.hasAttribute('inert'),
        ariaHidden: child.getAttribute('aria-hidden'),
      });
      child.setAttribute('inert', '');
      child.setAttribute('aria-hidden', 'true');
    }
  }
}

// Restores every element lockBackground has touched. Call once the last
// overlay in the stack has closed.
export function unlockBackground() {
  if (typeof document === 'undefined') return;
  for (const [el, prev] of originalState.entries()) {
    if (prev.inert) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    if (prev.ariaHidden === null) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', prev.ariaHidden);
  }
  originalState.clear();
}
