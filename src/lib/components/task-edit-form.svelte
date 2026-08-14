<script lang="ts">
  import type { TaskDoc } from '$lib/types';
  import { Temporal } from '@js-temporal/polyfill';
  import Target from 'lucide-svelte/icons/target';
  import Heart from 'lucide-svelte/icons/heart';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import { slide } from 'svelte/transition';
  import { resolve } from '$app/paths';
  import { formatShortWeekday } from '$lib/utils/format-date';
  import type { OriginInfo } from './task-edit-modal.svelte';

  let {
    task,
    origin = null as OriginInfo | null,
    onclose,
    onsave,
    ontransformgoal,
    ontransformcare,
    ondelete,
  }: {
    task: TaskDoc;
    origin?: OriginInfo | null;
    onclose: () => void;
    onsave: (title: string, doAt: string) => void;
    ontransformgoal: () => void;
    ontransformcare: () => void;
    ondelete: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let editTitle = $state(task.title);
  // svelte-ignore state_referenced_locally
  let editDate = $state(task.doAt);
  let showConvert = $state(false);
  let tomorrowOffset = $state(0);

  const tomorrowWeekday = $derived(
    tomorrowOffset > 1 && editDate ? formatShortWeekday(editDate) : '',
  );

  function handleSave() {
    if (!editTitle.trim()) return;
    onsave(editTitle, editDate);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
  }

  function setTomorrow() {
    tomorrowOffset += 1;
    editDate = Temporal.Now.plainDateISO().add({ days: tomorrowOffset }).toString();
  }
</script>

<div class="modal-box">
  <h3 class="font-bold text-lg mb-4">Task details</h3>

  <div class="flex flex-col gap-3">
    {#if origin}
      <a
        href={resolve(origin.type === 'goal' ? `/goals/${origin.id}` : `/cares/${origin.id}`)}
        class="flex items-center gap-1.5 text-sm text-base-content/60 hover:underline w-fit"
      >
        {#if origin.type === 'goal'}
          <Target class="size-4" />
        {:else}
          <Heart class="size-4" />
        {/if}
        {origin.title}
      </a>
    {/if}
    <input
      type="text"
      class="input input-bordered w-full"
      placeholder="Task title"
      bind:value={editTitle}
      onkeydown={handleKeydown}
    />
    <div class="join w-full">
      <input
        type="date"
        class="input input-bordered join-item flex-1"
        bind:value={editDate}
        oninput={() => (tomorrowOffset = 0)}
      />
      <div class="indicator">
        {#if tomorrowOffset > 1}
          <span class="indicator-item indicator-start badge badge-accent"
            >+{tomorrowOffset} days, {tomorrowWeekday}</span
          >
        {/if}
        <button class="btn join-item" class:btn-secondary={!!tomorrowOffset} onclick={setTomorrow}
          >Tomorrow</button
        >
      </div>
    </div>

    <button class="btn btn-ghost btn-sm w-full" onclick={() => (showConvert = !showConvert)}>
      <span class="transition-transform duration-200" class:rotate-180={showConvert}>
        <ChevronDown class="size-4" />
      </span> Convert
    </button>

    {#if showConvert}
      <div class="flex gap-2" transition:slide={{ duration: 200 }}>
        <button
          class="btn btn-outline btn-sm flex-1"
          onclick={ontransformgoal}
          disabled={!editTitle.trim()}
        >
          <Target class="size-4" />
          Convert to goal
        </button>
        <button
          class="btn btn-outline btn-sm flex-1"
          onclick={ontransformcare}
          disabled={!editTitle.trim()}
        >
          <Heart class="size-4" />
          Convert to care
        </button>
      </div>
    {/if}
  </div>

  <div class="modal-action">
    <button class="btn btn-ghost btn-sm text-error" onclick={ondelete}>
      <Trash2 class="size-4" />
      Discard
    </button>
    <div class="flex-1"></div>
    <button class="btn btn-ghost btn-sm" onclick={onclose}>Cancel</button>
    <button class="btn btn-primary btn-sm" onclick={handleSave} disabled={!editTitle.trim()}>
      Save
    </button>
  </div>
</div>
