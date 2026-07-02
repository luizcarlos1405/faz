import { Temporal } from '@js-temporal/polyfill';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeCache, isCacheFresh, loadModels, parseModelIds, readCachedModels } from '../models';
import type { Provider } from '../providers';

const NOW = 1_700_000_000_000;
const TTL_MS = 24 * 60 * 60 * 1000;

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-v4-flash',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash'],
    browserCompatible: true,
    docsUrl: 'https://example.com',
    supportsModelsEndpoint: true,
    ...overrides,
  };
}

function installLocalStorage(): Record<string, string> {
  const store: Record<string, string> = {};
  const fake = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
  vi.stubGlobal('localStorage', fake);
  return store;
}

describe('parseModelIds', () => {
  it('extracts ids from an OpenAI-style models response', () => {
    const body = {
      object: 'list',
      data: [
        { id: 'deepseek-v4-flash', object: 'model', owned_by: 'deepseek' },
        { id: 'deepseek-v4-pro', object: 'model', owned_by: 'deepseek' },
      ],
    };
    expect(parseModelIds(body)).toEqual(['deepseek-v4-flash', 'deepseek-v4-pro']);
  });

  it('dedupes repeated ids', () => {
    const body = { data: [{ id: 'a' }, { id: 'a' }, { id: 'b' }] };
    expect(parseModelIds(body)).toEqual(['a', 'b']);
  });

  it('ignores malformed entries and non-string ids', () => {
    const body = { data: [{ id: 'ok' }, { id: 7 }, null, { nope: 1 }, { id: '' }] };
    expect(parseModelIds(body)).toEqual(['ok']);
  });

  it('returns empty for non-object bodies or missing data array', () => {
    expect(parseModelIds(null)).toEqual([]);
    expect(parseModelIds({})).toEqual([]);
    expect(parseModelIds({ data: 'nope' })).toEqual([]);
  });
});

describe('isCacheFresh', () => {
  it('is fresh within the TTL window', () => {
    expect(isCacheFresh(NOW - 1000, NOW)).toBe(true);
    expect(isCacheFresh(NOW - TTL_MS + 1, NOW)).toBe(true);
  });

  it('is stale at or beyond the TTL', () => {
    expect(isCacheFresh(NOW - TTL_MS, NOW)).toBe(false);
    expect(isCacheFresh(NOW - TTL_MS - 1, NOW)).toBe(false);
  });
});

describe('decodeCache', () => {
  it('returns the cached models when fresh', () => {
    const raw = JSON.stringify({ fetchedAt: NOW - 1000, models: ['glm-5', 'glm-5.2'] });
    expect(decodeCache(raw, NOW)).toEqual(['glm-5', 'glm-5.2']);
  });

  it('returns null for a stale cache', () => {
    const raw = JSON.stringify({ fetchedAt: NOW - TTL_MS, models: ['glm-5'] });
    expect(decodeCache(raw, NOW)).toBeNull();
  });

  it('returns null for null input', () => {
    expect(decodeCache(null, NOW)).toBeNull();
  });

  it('returns null for unparseable or malformed payloads', () => {
    expect(decodeCache('not json', NOW)).toBeNull();
    expect(decodeCache(JSON.stringify({ models: ['x'] }), NOW)).toBeNull();
    expect(decodeCache(JSON.stringify({ fetchedAt: 'x', models: [] }), NOW)).toBeNull();
    expect(decodeCache(JSON.stringify({ fetchedAt: NOW, models: 'nope' }), NOW)).toBeNull();
  });

  it('filters out non-string entries defensively', () => {
    const raw = JSON.stringify({ fetchedAt: NOW, models: ['a', 3, null, 'b'] });
    expect(decodeCache(raw, NOW)).toEqual(['a', 'b']);
  });
});

describe('readCachedModels', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads and returns fresh cached models from localStorage', () => {
    const now = Temporal.Now.instant().epochMilliseconds;
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ fetchedAt: now, models: ['m1', 'm2'] }),
    });
    expect(readCachedModels('deepseek')).toEqual(['m1', 'm2']);
  });

  it('returns null when nothing is cached', () => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(readCachedModels('deepseek')).toBeNull();
  });
});

describe('loadModels', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the static list without fetching when the endpoint is unsupported', async () => {
    const provider = makeProvider({ supportsModelsEndpoint: false });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await loadModels(provider, 'key')).toEqual(provider.models);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches, caches, and returns live models', async () => {
    const provider = makeProvider();
    const store = installLocalStorage();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ id: 'deepseek-v4-flash' }, { id: 'deepseek-v4-pro' }] }),
      }),
    );
    const result = await loadModels(provider, 'key');
    expect(result).toEqual(['deepseek-v4-flash', 'deepseek-v4-pro']);
    expect(store['faz:ai:models:deepseek']).toBeDefined();
  });

  it('returns cached models without refetching', async () => {
    const now = Temporal.Now.instant().epochMilliseconds;
    const provider = makeProvider();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify({ fetchedAt: now, models: ['cached'] }),
    });
    expect(await loadModels(provider, 'key')).toEqual(['cached']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the static list on a non-2xx response', async () => {
    const provider = makeProvider();
    installLocalStorage();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    expect(await loadModels(provider, 'key')).toEqual(provider.models);
  });

  it('falls back to the static list on a network failure', async () => {
    const provider = makeProvider();
    installLocalStorage();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed to fetch')));
    expect(await loadModels(provider, 'key')).toEqual(provider.models);
  });

  it('falls back to the static list when the response has no model ids', async () => {
    const provider = makeProvider();
    installLocalStorage();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) }),
    );
    expect(await loadModels(provider, 'key')).toEqual(provider.models);
  });
});
