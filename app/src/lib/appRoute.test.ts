import { describe, expect, it, vi } from 'vitest';
import { getAppRouteFromHash, normalizeInitialAppRoute } from './appRoute';

describe('app route startup', () => {
  it('opens settings from an in-app route change', () => {
    expect(getAppRouteFromHash('#/settings')).toBe('/settings');
  });

  it('returns to the main screen instead of restoring settings after restart', () => {
    const replaceUrl = vi.fn();

    expect(normalizeInitialAppRoute({
      hash: '#/settings',
      pathname: '/app/index.html',
      search: '?source=desktop',
    }, replaceUrl)).toBe('/');
    expect(replaceUrl).toHaveBeenCalledWith('/app/index.html?source=desktop#/');
  });

  it('leaves the main screen URL unchanged on startup', () => {
    const replaceUrl = vi.fn();

    expect(normalizeInitialAppRoute({
      hash: '#/',
      pathname: '/app/index.html',
      search: '',
    }, replaceUrl)).toBe('/');
    expect(replaceUrl).not.toHaveBeenCalled();
  });
});
