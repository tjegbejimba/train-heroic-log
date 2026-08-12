// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  pushModal,
  popModal,
  isTopModal,
  activeModalCount,
  getFocusableElements,
  lockBackground,
  unlockBackground,
  registerProtectedNode,
  unregisterProtectedNode,
  getProtectedNodes,
  getActiveProtectedNodes,
} from './modalStack';

describe('modalStack registry', () => {
  it('tracks the topmost modal id in mount order', () => {
    pushModal('a');
    pushModal('b');
    expect(isTopModal('a')).toBe(false);
    expect(isTopModal('b')).toBe(true);
    expect(activeModalCount()).toBe(2);

    popModal('b');
    expect(isTopModal('a')).toBe(true);
    expect(activeModalCount()).toBe(1);

    popModal('a');
    expect(activeModalCount()).toBe(0);
  });

  it('is a no-op popping an id that was never pushed', () => {
    expect(() => popModal('never-pushed')).not.toThrow();
    expect(activeModalCount()).toBe(0);
  });

  it('does not duplicate an id pushed twice (rapid re-render safety)', () => {
    pushModal('dup');
    pushModal('dup');
    expect(activeModalCount()).toBe(1);
    popModal('dup');
    expect(activeModalCount()).toBe(0);
  });
});

describe('getFocusableElements', () => {
  it('returns interactive descendants in document order', () => {
    document.body.innerHTML = `
      <div id="container">
        <button id="btn1">One</button>
        <a id="link1" href="#">Link</a>
        <input id="input1" />
        <button id="btn2" disabled>Disabled</button>
        <div tabindex="-1" id="notfocusable"></div>
        <div tabindex="0" id="focusabledivsdiv">Focusable div</div>
      </div>
    `;
    const container = document.getElementById('container');
    const focusable = getFocusableElements(container);
    const ids = focusable.map((el) => el.id);
    expect(ids).toEqual(['btn1', 'link1', 'input1', 'focusabledivsdiv']);
  });

  it('returns an empty array when there is no focusable content', () => {
    document.body.innerHTML = `<div id="empty"><p>Just text</p></div>`;
    const container = document.getElementById('empty');
    expect(getFocusableElements(container)).toEqual([]);
  });
});

describe('lockBackground / unlockBackground', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    unlockBackground();
  });

  it('marks non-protected body children inert and aria-hidden', () => {
    const nav = document.createElement('div');
    nav.id = 'nav';
    const modalRoot = document.createElement('div');
    modalRoot.id = 'modal-root';
    document.body.append(nav, modalRoot);

    lockBackground([modalRoot]);

    expect(nav.hasAttribute('inert')).toBe(true);
    expect(nav.getAttribute('aria-hidden')).toBe('true');
    expect(modalRoot.hasAttribute('inert')).toBe(false);
    expect(modalRoot.hasAttribute('aria-hidden')).toBe(false);
  });

  it('restores original attributes on unlockBackground', () => {
    const nav = document.createElement('div');
    nav.id = 'nav';
    nav.setAttribute('aria-hidden', 'false'); // pre-existing value we must restore
    const modalRoot = document.createElement('div');
    document.body.append(nav, modalRoot);

    lockBackground([modalRoot]);
    expect(nav.hasAttribute('inert')).toBe(true);

    unlockBackground();
    expect(nav.hasAttribute('inert')).toBe(false);
    expect(nav.getAttribute('aria-hidden')).toBe('false');
  });

  it('lockBackground protects exactly the explicit set it is given (a generic primitive capability)', () => {
    const nav = document.createElement('div');
    const modalRootA = document.createElement('div');
    const modalRootB = document.createElement('div');
    document.body.append(nav, modalRootA, modalRootB);

    lockBackground([modalRootA]);
    expect(modalRootB.hasAttribute('inert')).toBe(true);

    // Calling the primitive with a wider explicit set protects both — this
    // is a capability of lockBackground itself; real nested-modal callers
    // must NOT do this (see getActiveProtectedNodes below), since a covered
    // overlay must go inert like any other background content.
    lockBackground([modalRootA, modalRootB]);
    expect(modalRootA.hasAttribute('inert')).toBe(false);
    expect(modalRootB.hasAttribute('inert')).toBe(false);
    expect(nav.hasAttribute('inert')).toBe(true);

    unlockBackground();
    expect(nav.hasAttribute('inert')).toBe(false);
  });
});

describe('registerProtectedNode / unregisterProtectedNode / getProtectedNodes', () => {
  beforeEach(() => {
    unregisterProtectedNode('x');
    unregisterProtectedNode('y');
  });

  it('accumulates protected nodes keyed by modal id', () => {
    const nodeX = document.createElement('div');
    const nodeY = document.createElement('div');
    registerProtectedNode('x', nodeX);
    registerProtectedNode('y', nodeY);
    expect(getProtectedNodes()).toEqual([nodeX, nodeY]);

    unregisterProtectedNode('x');
    expect(getProtectedNodes()).toEqual([nodeY]);

    unregisterProtectedNode('y');
    expect(getProtectedNodes()).toEqual([]);
  });
});

describe('getActiveProtectedNodes', () => {
  beforeEach(() => {
    // Reset any stack/registry state left by other describe blocks.
    while (activeModalCount() > 0) popModal(`leftover-${activeModalCount()}`);
    unregisterProtectedNode('a');
    unregisterProtectedNode('b');
  });

  it('returns only the topmost registered modal\'s node, not every open modal', () => {
    const nodeA = document.createElement('div');
    const nodeB = document.createElement('div');

    pushModal('a');
    registerProtectedNode('a', nodeA);
    expect(getActiveProtectedNodes()).toEqual([nodeA]);

    // A second (nested) modal opens on top — only its node is now "active";
    // the first modal's node must NOT be protected anymore, so
    // background-isolation will correctly mark it inert like any other
    // covered content.
    pushModal('b');
    registerProtectedNode('b', nodeB);
    expect(getActiveProtectedNodes()).toEqual([nodeB]);

    // Closing the top modal restores the bottom one as the active/protected node.
    popModal('b');
    unregisterProtectedNode('b');
    expect(getActiveProtectedNodes()).toEqual([nodeA]);

    popModal('a');
    unregisterProtectedNode('a');
    expect(getActiveProtectedNodes()).toEqual([]);
  });

  it('returns an empty array when nothing is registered for the topmost id', () => {
    pushModal('a');
    expect(getActiveProtectedNodes()).toEqual([]);
    popModal('a');
  });
});
