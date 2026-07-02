import { Temporal } from '@js-temporal/polyfill';
import type { Provider, ProviderId } from './providers';

const MODELS_PREFIX = 'faz:ai:models:';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedModels {
  fetchedAt: number;
  models: string[];
}

export function parseModelIds(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const ids = new Set<string>();
  for (const entry of data) {
    if (entry && typeof entry === 'object') {
      const id = (entry as { id?: unknown }).id;
      if (typeof id === 'string' && id.length > 0) ids.add(id);
    }
  }
  return [...ids];
}

export function isCacheFresh(fetchedAt: number, now: number): boolean {
  return now - fetchedAt < CACHE_TTL_MS;
}

export function decodeCache(raw: string | null, now: number): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CachedModels>;
    if (typeof parsed?.fetchedAt !== 'number' || !Array.isArray(parsed?.models)) {
      return null;
    }
    if (!isCacheFresh(parsed.fetchedAt, now)) return null;
    return parsed.models.filter((m): m is string => typeof m === 'string');
  } catch {
    return null;
  }
}

function cacheKey(id: ProviderId): string {
  return MODELS_PREFIX + id;
}

export function readCachedModels(id: ProviderId): string[] | null {
  return decodeCache(localStorage.getItem(cacheKey(id)), nowMs());
}

function writeCachedModels(id: ProviderId, models: string[]): void {
  const payload: CachedModels = { fetchedAt: nowMs(), models };
  localStorage.setItem(cacheKey(id), JSON.stringify(payload));
}

function nowMs(): number {
  return Temporal.Now.instant().epochMilliseconds;
}

export async function loadModels(provider: Provider, apiKey: string): Promise<string[]> {
  if (!provider.supportsModelsEndpoint) return provider.models;
  const cached = readCachedModels(provider.id);
  if (cached) return cached;
  try {
    const response = await fetch(`${provider.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return provider.models;
    const models = parseModelIds(await response.json());
    if (models.length === 0) return provider.models;
    writeCachedModels(provider.id, models);
    return models;
  } catch {
    return provider.models;
  }
}
