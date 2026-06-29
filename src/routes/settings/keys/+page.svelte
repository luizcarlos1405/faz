<script lang="ts">
  import { PROVIDER_LIST, getProvider, type ProviderId } from '$lib/ai/providers';
  import { getApiKey, setApiKey, clearApiKey } from '$lib/ai/keys';
  import { getToastState } from '$lib/components/toast-state.svelte';
  import Check from 'lucide-svelte/icons/check';
  import Eye from 'lucide-svelte/icons/eye';
  import EyeOff from 'lucide-svelte/icons/eye-off';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import ExternalLink from 'lucide-svelte/icons/external-link';

  const toast = getToastState();

  const colors: Record<ProviderId, string> = {
    zai: '#3B5BFE',
    anthropic: '#D97757',
    groq: '#F55036',
    openrouter: '#6366F1',
    openai: '#10A37F',
  };

  const badges: Record<ProviderId, string> = {
    zai: 'Z',
    anthropic: 'A',
    groq: 'G',
    openrouter: 'OR',
    openai: 'AI',
  };

  let keyInputs = $state<Record<string, string>>({});
  let revealed = $state<Record<string, boolean>>({});
  let configuredVersion = $state(0);

  for (const p of PROVIDER_LIST) {
    keyInputs[p.id] = getApiKey(p.id);
    revealed[p.id] = false;
  }

  const configuredIds = $derived.by(() => {
    configuredVersion;
    return new Set(PROVIDER_LIST.filter((p) => getApiKey(p.id)).map((p) => p.id));
  });

  function isConfigured(id: ProviderId): boolean {
    return configuredIds.has(id);
  }

  function save(id: ProviderId): void {
    setApiKey(id, keyInputs[id]);
    configuredVersion++;
    toast.notify(`${getProvider(id).label} key saved`);
  }

  function remove(id: ProviderId): void {
    clearApiKey(id);
    keyInputs[id] = '';
    configuredVersion++;
    toast.notify(`${getProvider(id).label} key removed`);
  }
</script>

<div class="p-4">
  <h1 class="text-2xl font-bold">AI Keys</h1>
  <p class="text-sm text-base-content/60 mt-1">
    Connect a provider to chat. Keys are stored only on this device and never leave your browser.
  </p>

  <div class="flex flex-col gap-3 mt-5">
    {#each PROVIDER_LIST as p (p.id)}
      <div class="border border-base-300 rounded-xl p-4 flex flex-col gap-3 bg-base-100">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div
              class="size-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
              style="background-color: {colors[p.id]}"
            >
              {badges[p.id]}
            </div>
            <div class="flex flex-col">
              <span class="font-semibold leading-tight">{p.label}</span>
              <span class="text-xs text-base-content/50">{p.defaultModel}</span>
            </div>
          </div>
          {#if p.browserCompatible && isConfigured(p.id)}
            <span class="badge badge-success badge-sm gap-1">
              <Check class="size-3" />
              Connected
            </span>
          {:else if p.browserCompatible}
            <span class="text-xs text-base-content/40">Not connected</span>
          {/if}
        </div>

        {#if !p.browserCompatible}
          <div class="alert alert-warning py-2 px-3 text-xs gap-2">
            <AlertTriangle class="size-4 shrink-0" />
            <span>
              This provider blocks browser requests. Use a compatible provider like Zhipu GLM or
              Anthropic.
            </span>
          </div>
        {:else}
          <div class="join w-full">
            <input
              type={revealed[p.id] ? 'text' : 'password'}
              class="input join-item flex-1 font-mono text-sm"
              placeholder="Paste API key"
              autocomplete="off"
              bind:value={keyInputs[p.id]}
            />
            <button
              class="btn btn-ghost join-item border border-l-0 border-base-300"
              onclick={() => (revealed[p.id] = !revealed[p.id])}
              aria-label={revealed[p.id] ? 'Hide key' : 'Show key'}
            >
              {#if revealed[p.id]}
                <EyeOff class="size-4" />
              {:else}
                <Eye class="size-4" />
              {/if}
            </button>
          </div>

          <div class="flex items-center justify-between gap-2">
            <button
              class="btn btn-ghost btn-sm gap-1 text-base-content/60"
              onclick={() => window.open(p.docsUrl, '_blank', 'noopener')}
            >
              <ExternalLink class="size-3.5" />
              Get key
            </button>
            <div class="flex gap-2">
              {#if isConfigured(p.id)}
                <button class="btn btn-outline btn-sm" onclick={() => remove(p.id)}>Clear</button>
              {/if}
              <button class="btn btn-primary btn-sm" onclick={() => save(p.id)}>Save</button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>
