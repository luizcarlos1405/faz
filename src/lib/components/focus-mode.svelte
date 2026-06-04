<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import Check from 'lucide-svelte/icons/check';
  import SkipForward from 'lucide-svelte/icons/skip-forward';
  import X from 'lucide-svelte/icons/x';
  import Target from 'lucide-svelte/icons/target';
  import type { TaskDoc } from '$lib/types';

  interface OriginInfo {
    type: 'goal' | 'care';
    id: string;
    title: string;
  }

  let {
    open = false,
    task = null as TaskDoc | null,
    remaining = 0,
    origin = null as OriginInfo | null,
    oncomplete,
    onskip,
    onclose,
  }: {
    open?: boolean;
    task?: TaskDoc | null;
    remaining?: number;
    origin?: OriginInfo | null;
    oncomplete: () => Promise<void>;
    onskip: () => Promise<void>;
    onclose: () => void;
  } = $props();

  let busy = $state(false);
  let allDone = $state(false);

  $effect(() => {
    if (open && !task && !allDone) {
      allDone = true;
      const timer = setTimeout(onclose, 1500);
      return () => clearTimeout(timer);
    }
    if (task) {
      allDone = false;
    }
  });

  async function handleDone() {
    if (busy) return;
    busy = true;
    try {
      await oncomplete();
    } finally {
      busy = false;
    }
  }

  async function handleSkip() {
    if (busy) return;
    busy = true;
    try {
      await onskip();
    } finally {
      busy = false;
    }
  }
</script>

{#if open}
  <div
    class="fixed inset-0 z-[100] bg-base-100 flex justify-center"
    transition:fade={{ duration: 200 }}
  >
    <div class="w-full max-w-md flex flex-col h-full">
      <div class="flex justify-end items-center px-5 pt-4 pb-4">
        <button
          class="flex items-center gap-1.5 bg-base-200 rounded-full py-2 px-3"
          onclick={onclose}
          disabled={busy}
        >
          <X class="size-4 text-base-content/40" />
          <span class="text-[13px] font-medium text-base-content/40">Exit</span>
        </button>
      </div>

      <div class="h-[120px]"></div>

      {#if task && remaining > 0}
        <div class="flex justify-center px-5">
          <div class="bg-base-200 rounded-xl py-1 px-3">
            <span class="text-xs font-medium text-base-content/40">1 of {remaining}</span>
          </div>
        </div>
      {/if}

      <div class="flex-1 flex flex-col items-center justify-center px-8">
        {#if allDone}
          <div class="text-center" in:fly={{ y: 20, duration: 300 }}>
            <p class="text-3xl font-semibold text-base-content">All done!</p>
            <p class="text-sm text-base-content/40 mt-2">Nothing left to focus on.</p>
          </div>
        {:else if task}
          {#key task._id}
            <div
              class="text-center w-full"
              in:fly={{ y: 30, duration: 300 }}
              out:fly={{ y: -30, duration: 200 }}
            >
              <p class="text-[28px] font-semibold leading-[1.3] text-base-content">
                {task.title}
              </p>
              {#if origin}
                <div class="flex items-center justify-center gap-1.5 mt-4">
                  <Target class="size-3 text-base-content/40" />
                  <span class="text-xs text-base-content/40">{origin.title}</span>
                </div>
              {/if}
            </div>
          {/key}
        {/if}
      </div>

      <div class="h-[60px]"></div>

      {#if task && !allDone}
        <div class="px-10 pb-12">
          <div class="flex justify-center gap-3">
            <button
              class="flex items-center gap-2 rounded-full py-3.5 px-6 bg-success text-success-content font-semibold disabled:opacity-50"
              onclick={handleDone}
              disabled={busy}
            >
              <Check class="size-5" />
              Done
            </button>
            <button
              class="flex items-center gap-2 rounded-full py-3.5 px-6 bg-base-200 text-base-content font-medium disabled:opacity-50"
              onclick={handleSkip}
              disabled={busy}
            >
              <SkipForward class="size-5" />
              Skip
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
