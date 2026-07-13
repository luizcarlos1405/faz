export const NAV_TABS = ['/tasks', '/inbox', '/goals', '/cares', '/chat'] as const;

export const LAST_ROUTE_KEY = 'faz:lastRoute';

export type NavTab = (typeof NAV_TABS)[number];

export function tabForPath(path: string): NavTab | null {
  for (const tab of NAV_TABS) {
    if (path === tab || path.startsWith(tab + '/')) return tab;
  }
  return null;
}
