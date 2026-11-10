import type { AppRoute } from '../appState';

export function getAppRouteFromHash(hash: string): AppRoute {
  const path = hash.replace(/^#/, '').trim();
  return path === '/settings' ? '/settings' : '/';
}

export function normalizeInitialAppRoute(
  location: Pick<Location, 'hash' | 'pathname' | 'search'>,
  replaceUrl: (url: string) => void,
): AppRoute {
  const route = getAppRouteFromHash(location.hash);
  if (route === '/settings') {
    replaceUrl(`${location.pathname}${location.search}#/`);
    return '/';
  }
  return route;
}
