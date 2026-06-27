import { PROVIDER_LIST, type ProviderId, type Provider } from './providers';

const KEY_PREFIX = 'faz:ai:key:';
const LAST_PROVIDER_KEY = 'faz:ai:lastProvider';

export function getApiKey(id: ProviderId): string {
  return localStorage.getItem(KEY_PREFIX + id) ?? '';
}

export function setApiKey(id: ProviderId, key: string): void {
  const trimmed = key.trim();
  if (trimmed) localStorage.setItem(KEY_PREFIX + id, trimmed);
  else localStorage.removeItem(KEY_PREFIX + id);
}

export function clearApiKey(id: ProviderId): void {
  localStorage.removeItem(KEY_PREFIX + id);
}

export function hasApiKey(id: ProviderId): boolean {
  return getApiKey(id).length > 0;
}

export function getConfiguredProviders(): Provider[] {
  return PROVIDER_LIST.filter((p) => hasApiKey(p.id));
}

export function hasAnyKey(): boolean {
  return getConfiguredProviders().length > 0;
}

export function getLastProviderId(): ProviderId | null {
  const stored = localStorage.getItem(LAST_PROVIDER_KEY) as ProviderId | null;
  if (stored && hasApiKey(stored)) return stored;
  const first = getConfiguredProviders()[0];
  return first ? first.id : null;
}

export function setLastProviderId(id: ProviderId): void {
  localStorage.setItem(LAST_PROVIDER_KEY, id);
}
