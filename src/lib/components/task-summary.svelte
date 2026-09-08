<script lang="ts">
  import Target from 'lucide-svelte/icons/target';
  import Heart from 'lucide-svelte/icons/heart';
  import type { OriginInfo, TaskDoc } from '$lib/types';

  let {
    task,
    origin = null as OriginInfo | null,
  }: {
    task: TaskDoc;
    origin?: OriginInfo | null;
  } = $props();
</script>

<div class="flex flex-col gap-1.5">
  <p class="font-semibold text-[17px] leading-snug text-base-content">{task.title}</p>
  {#if origin}
    <div class="flex items-center gap-1.5 text-xs text-base-content/50 min-w-0">
      {#if origin.type === 'goal'}
        <Target class="size-3 shrink-0" />
      {:else}
        <Heart class="size-3 shrink-0" />
      {/if}
      <span class="truncate">{origin.title}</span>
      {#if origin.type === 'care' && origin.recurrence}
        <span>&middot;</span>
        <span class="truncate">{origin.recurrence}</span>
      {/if}
    </div>
  {/if}
</div>
