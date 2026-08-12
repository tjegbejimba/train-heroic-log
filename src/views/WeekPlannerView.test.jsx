// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WeekPlannerView from './WeekPlannerView';

function renderPlanner(overrides = {}) {
  const onApplyPlan = vi.fn();
  const onNavigateToDate = vi.fn();
  const utils = render(
    <WeekPlannerView
      schedule={{}}
      onApplyPlan={onApplyPlan}
      templateList={[]}
      templates={{}}
      workouts={{}}
      showToast={vi.fn()}
      onNavigateToDate={onNavigateToDate}
      {...overrides}
    />
  );
  return { ...utils, onApplyPlan, onNavigateToDate };
}

describe('WeekPlannerView — Clear Week (destructive Modal consumer)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('opens a labelled destructive dialog and restores focus to the trigger on cancel', () => {
    renderPlanner();
    const clearBtn = screen.getByRole('button', { name: 'Clear Week' });
    clearBtn.focus();
    fireEvent.click(clearBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).not.toBe(clearBtn);

    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(clearBtn);
  });

  it('clearing the week surfaces the unsaved-changes guard on next navigation', () => {
    const { container } = renderPlanner();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('Unsaved changes')).toBeTruthy();

    // Advance to next week while unsaved changes are pending.
    const [, , nextWeekBtn] = container.querySelectorAll('.planner-view__nav button');
    fireEvent.click(nextWeekBtn);

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Unsaved Changes' })).toBeTruthy();

    // "Stay" cancels the navigation — still on the same week.
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });

  it('Escape on the unsaved-changes guard also cancels navigation (parity with Stay)', () => {
    const { container } = renderPlanner();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    const [, , nextWeekBtn] = container.querySelectorAll('.planner-view__nav button');
    fireEvent.click(nextWeekBtn);
    expect(screen.getByRole('dialog')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });
});
