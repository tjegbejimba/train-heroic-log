import { describe, it, expect } from 'vitest';
import { buildIssueTitle, buildGithubIssueBody } from './feedback.js';

const META = {
  appVersion: 'v0.1.0',
  platform: 'iPhone',
  viewport: '390x844',
  standalone: true,
  userAgent: 'Mozilla/5.0 (iPhone)',
};
const TIMESTAMP = '2026-03-29T00:00:00.000Z';

describe('buildIssueTitle', () => {
  it('wraps category in brackets before the title', () => {
    expect(buildIssueTitle('Bug', 'scroll crash on iOS')).toBe('[Bug] scroll crash on iOS');
  });

  it('works for Feature category', () => {
    expect(buildIssueTitle('Feature', 'dark mode toggle')).toBe('[Feature] dark mode toggle');
  });

  it('works for Other category', () => {
    expect(buildIssueTitle('Other', 'general question')).toBe('[Other] general question');
  });
});

describe('buildGithubIssueBody', () => {
  it('starts with the description', () => {
    const body = buildGithubIssueBody('The app crashes on scroll', META, undefined, TIMESTAMP);
    expect(body.startsWith('The app crashes on scroll')).toBe(true);
  });

  it('includes snapshot in a collapsible details block when provided', () => {
    const snapshot = { th_workouts: { 'Bench Day': {} } };
    const body = buildGithubIssueBody('desc', META, snapshot, TIMESTAMP);
    expect(body).toContain('<details>');
    expect(body).toContain('<summary>App data snapshot</summary>');
    expect(body).toContain('"Bench Day"');
    expect(body).toContain('</details>');
  });

  it('does not include a details block when snapshot is absent', () => {
    const body = buildGithubIssueBody('desc', META, undefined, TIMESTAMP);
    expect(body).not.toContain('<details>');
  });

  it('includes all meta fields in the body', () => {
    const body = buildGithubIssueBody('desc', META, undefined, TIMESTAMP);
    expect(body).toContain('v0.1.0');
    expect(body).toContain('iPhone');
    expect(body).toContain('390x844');
    expect(body).toContain('true');
    expect(body).toContain('Mozilla/5.0 (iPhone)');
    expect(body).toContain(TIMESTAMP);
  });
});
