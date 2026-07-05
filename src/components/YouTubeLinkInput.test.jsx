// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import YouTubeLinkInput from './YouTubeLinkInput';

describe('YouTubeLinkInput', () => {
  it('renders unsafe stored URLs as non-clickable text', () => {
    render(
      <YouTubeLinkInput
        url="javascript:alert(document.domain)//https://youtu.be/abcDEF123_4"
        onSave={vi.fn()}
      />
    );

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText(/javascript:alert/)).toBeTruthy();
  });

  it('normalizes valid YouTube links before making them clickable', () => {
    render(
      <YouTubeLinkInput
        url="https://youtu.be/abcDEF123_4"
        onSave={vi.fn()}
      />
    );

    expect(screen.getByRole('link').getAttribute('href')).toBe(
      'https://www.youtube.com/watch?v=abcDEF123_4'
    );
  });
});
