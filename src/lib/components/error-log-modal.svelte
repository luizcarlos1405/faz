<script lang="ts">
  import { Temporal } from '@js-temporal/polyfill';
  import { getErrors, clearErrors } from '$lib/db/error-repo';
  import { getToastState } from '$lib/components/toast-state.svelte';
  import type { ErrorDoc } from '$lib/types';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import Copy from 'lucide-svelte/icons/copy';
  import Check from 'lucide-svelte/icons/check';

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();

  const toast = getToastState();

  let errors = $state<ErrorDoc[]>([]);
  let loading = $state(false);
  let copiedId = $state<string | null>(null);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  function formatInstant(iso: string): string {
    const dt = Temporal.Instant.from(iso)
      .toZonedDateTimeISO(Temporal.Now.timeZoneId())
      .toPlainDateTime();
    return dt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function errorToText(err: ErrorDoc): string {
    const lines = [`[${err.code}] ${formatInstant(err.createdAt)}`, err.message];
    if (err.details) lines.push('', err.details);
    return lines.join('\n');
  }

  function flashCopied(id: string) {
    copiedId = id;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => (copiedId = null), 1500);
  }

  async function copyText(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      flashCopied(id);
    } catch {
      toast.notify("Couldn't copy to clipboard");
    }
  }

  function handleCopy(err: ErrorDoc) {
    return copyText(errorToText(err), err._id);
  }

  function handleCopyAll() {
    return copyText(errors.map(errorToText).join('\n\n----\n\n'), 'all');
  }

  async function load() {
    loading = true;
    try {
      errors = await getErrors();
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (open) load();
  });

  async function handleClear() {
    await clearErrors();
    await load();
  }
</script>

<dialog class="modal modal-bottom" class:modal-open={open}>
  <div class="modal-box h-10/12 flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-1">
        <h3 class="font-bold text-lg">Error log</h3>
        {#if errors.length > 0}
          <button
            class="btn btn-ghost btn-sm btn-square"
            onclick={handleCopyAll}
            aria-label="Copy all errors"
            title="Copy all"
          >
            {#if copiedId === 'all'}
              <Check class="size-4 text-success" />
            {:else}
              <Copy class="size-4" />
            {/if}
          </button>
        {/if}
      </div>
      {#if errors.length > 0}
        <button class="btn btn-sm btn-ghost text-error" onclick={handleClear}>
          <Trash2 class="size-4" /> Clear
        </button>
      {/if}
    </div>

    {#if loading}
      <p class="text-sm opacity-70">Loading…</p>
    {:else if errors.length === 0}
      <p class="text-sm opacity-70">No errors recorded.</p>
    {:else}
      <ul class="flex flex-col gap-2 overflow-y-auto">
        {#each errors as err (err._id)}
          <li class="rounded-box border border-base-300 p-3 flex flex-col gap-1">
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono text-xs badge badge-ghost">{err.code}</span>
              <div class="flex items-center gap-1">
                <span class="text-xs opacity-60">{formatInstant(err.createdAt)}</span>
                <button
                  class="btn btn-ghost btn-xs btn-square"
                  onclick={() => handleCopy(err)}
                  aria-label="Copy error"
                  title="Copy"
                >
                  {#if copiedId === err._id}
                    <Check class="size-3.5 text-success" />
                  {:else}
                    <Copy class="size-3.5" />
                  {/if}
                </button>
              </div>
            </div>
            <p class="text-sm">{err.message}</p>
            {#if err.details}
              <pre
                class="text-xs opacity-70 whitespace-pre-wrap break-words bg-base-200 rounded p-2">{err.details}</pre>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <div class="modal-action mt-auto">
      <button class="btn btn-sm" onclick={onclose}>Close</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button onclick={onclose}>close</button>
  </form>
</dialog>
