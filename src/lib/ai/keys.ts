import { PROVIDER_LIST, type ProviderId, type Provider } from './providers';

const KEY_PREFIX = 'faz:ai:key:';
const MODEL_PREFIX = 'faz:ai:model:';
const LAST_PROVIDER_KEY = 'faz:ai:lastProvider';
const AGENT_MODE_KEY = 'faz:ai:agentMode';

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

export function getModel(id: ProviderId): string | null {
  return localStorage.getItem(MODEL_PREFIX + id);
}

export function setModel(id: ProviderId, model: string): void {
  localStorage.setItem(MODEL_PREFIX + id, model);
}

export function getAgentMode(): boolean {
  return localStorage.getItem(AGENT_MODE_KEY) === '1';
}

export function setAgentMode(on: boolean): void {
  if (on) localStorage.setItem(AGENT_MODE_KEY, '1');
  else localStorage.removeItem(AGENT_MODE_KEY);
}
