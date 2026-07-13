import { describe, it, expect } from 'vitest';
import { NAV_TABS, tabForPath } from '../nav-tabs';

describe('tabForPath', () => {
  it('maps each tab root to itself', () => {
    for (const tab of NAV_TABS) {
      expect(tabForPath(tab)).toBe(tab);
    }
  });

  it('maps a detail page to its parent tab', () => {
    expect(tabForPath('/goals/abc123')).toBe('/goals');
    expect(tabForPath('/cares/xyz/plans/plan-1')).toBe('/cares');
    expect(tabForPath('/tasks/anything')).toBe('/tasks');
  });

  it('returns null for the root path', () => {
    expect(tabForPath('/')).toBeNull();
  });

  it('returns null for settings and unknown paths', () => {
    expect(tabForPath('/settings/keys')).toBeNull();
    expect(tabForPath('/old-feature')).toBeNull();
    expect(tabForPath('')).toBeNull();
  });

  it('does not match a path that merely starts with a tab name prefix', () => {
    expect(tabForPath('/tasksarchive')).toBeNull();
    expect(tabForPath('/chatroom')).toBeNull();
  });
});
