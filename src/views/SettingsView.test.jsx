// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsView from './SettingsView';
import { ToastProvider } from '../components/Toast';

// Keep this test focused on the Modal accessibility contract as it flows
// through SettingsView's destructive/custom-body dialogs; heavy peripheral
// concerns (push notifications, quota estimate) are stubbed.
vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true })));
vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));

function renderSettings(overrides = {}) {
  return render(
    <ToastProvider>
      <SettingsView
        onReimport={() => {}}
        templateList={[]}
        deleteTemplate={vi.fn()}
        renameTemplate={vi.fn()}
        duplicateTemplate={vi.fn()}
        onClearAllData={vi.fn()}
        syncStatus="offline"
        lastSynced={null}
        onPullSync={() => {}}
        onPushSync={() => {}}
        {...overrides}
      />
    </ToastProvider>
  );
}

describe('SettingsView — Feedback modal (custom-body Modal consumer)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('opens the Feedback modal as a labelled dialog and focuses its title field', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Send Feedback' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Title'));
  });

  it('restores focus to the "Send Feedback" trigger button on close', () => {
    renderSettings();
    const trigger = screen.getByRole('button', { name: 'Send Feedback' });
    // Real browsers focus a button as part of clicking it; jsdom's
    // fireEvent.click does not, so focus explicitly to model that state.
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.activeElement).not.toBe(trigger);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on Escape', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Send Feedback' }));
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
