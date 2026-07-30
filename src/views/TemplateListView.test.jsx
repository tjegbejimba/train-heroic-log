// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TemplateListView from './TemplateListView.jsx';

const templateList = [
  { id: 'tpl_1', name: 'Push Day', blocks: [{ exercises: [{ title: 'Bench Press', sets: [] }] }] },
];

function renderView(overrides = {}) {
  const props = {
    templateList,
    deleteTemplate: vi.fn(),
    navigate: vi.fn(),
    embedded: true,
    ...overrides,
  };
  return { ...render(<TemplateListView {...props} />), props };
}

describe('TemplateListView — creating a new template', () => {
  it('offers a discoverable New Template action alongside existing templates', () => {
    renderView();
    expect(screen.getByRole('button', { name: /new template/i })).toBeTruthy();
  });

  it('navigates to the template editor in create mode when tapped', () => {
    const { props } = renderView();
    fireEvent.click(screen.getByRole('button', { name: /new template/i }));
    expect(props.navigate).toHaveBeenCalledWith('editTemplate', { isNew: true });
  });

  it('still offers the New Template action from the empty state', () => {
    const { props } = renderView({ templateList: [] });
    expect(screen.getByText('No templates yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /new template/i }));
    expect(props.navigate).toHaveBeenCalledWith('editTemplate', { isNew: true });
  });

  it('keeps the Import Workout action available from the empty state', () => {
    renderView({ templateList: [] });
    expect(screen.getByRole('button', { name: /import workout/i })).toBeTruthy();
  });

  it('does not show the New Template action twice when the list is empty', () => {
    renderView({ templateList: [] });
    expect(screen.getAllByRole('button', { name: /new template/i })).toHaveLength(1);
  });
});
