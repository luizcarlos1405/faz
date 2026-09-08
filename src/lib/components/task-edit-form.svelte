<script lang="ts">
  import type { TaskDoc } from '$lib/types';
  import { Temporal } from '@js-temporal/polyfill';
  import Target from 'lucide-svelte/icons/target';
  import Heart from 'lucide-svelte/icons/heart';
  import Repeat from 'lucide-svelte/icons/repeat';
  import ChevronDown from 'lucide-svelte/icons/chevron-down';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import Clock from 'lucide-svelte/icons/clock';
  import X from 'lucide-svelte/icons/x';
  import { slide } from 'svelte/transition';
  import { resolve } from '$app/paths';
  import { formatShortWeekday, formatTime } from '$lib/utils/format-date';
  import { doAfterFromTime, timeOfDay } from '$lib/engines/defer-engine';
  import TimePickerModal from './time-picker-modal.svelte';
  import type { OriginInfo } from '$lib/types';

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
    onsave: (title: string, doAt: string, doAfter: string | null) => void;
    ontransformgoal: () => void;
    ontransformcare: () => void;
    ondelete: () => void;
  } = $props();

  const timeZone = Temporal.Now.timeZoneId();

  // svelte-ignore state_referenced_locally
  let editTitle = $state(task.title);
  // svelte-ignore state_referenced_locally
  let editDate = $state(task.doAt);
  // svelte-ignore state_referenced_locally
  let editDoAfter = $state<string | null>(task.doAfter ?? null);
  let showConvert = $state(false);
  let showTimePicker = $state(false);
  let tomorrowOffset = $state(0);

  const tomorrowWeekday = $derived(
    tomorrowOffset > 1 && editDate ? formatShortWeekday(editDate) : '',
  );
  const timeAnchor = $derived.by(() => {
    const today = Temporal.Now.plainDateISO().toString();
    return editDate > today ? editDate : today;
  });
  const timeInitial = $derived(editDoAfter ? timeOfDay(editDoAfter, timeZone) : null);

  function handleSave() {
    if (!editTitle.trim()) return;
    onsave(editTitle, editDate, editDoAfter);
  }

  function handleTimeConfirm(hour: number, minute: number) {
    showTimePicker = false;
    editDoAfter = doAfterFromTime(Temporal.PlainDate.from(timeAnchor), hour, minute, timeZone);
  }

  function changeDate(date: string) {
    if (date !== editDate) editDoAfter = null;
    editDate = date;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
  }

  function setTomorrow() {
    tomorrowOffset += 1;
    changeDate(Temporal.Now.plainDateISO().add({ days: tomorrowOffset }).toString());
  }
</script>

<div class="modal-box">
  <h3 class="font-bold text-lg mb-4">Task details</h3>

  <div class="flex flex-col gap-3">
    {#if origin}
      <div class="flex flex-col gap-0.5 w-fit">
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
        {#if origin.type === 'care' && origin.recurrence}
          <div class="flex items-center gap-1.5 text-xs text-base-content/50 ml-5.5">
            <Repeat class="size-3" />
            {origin.recurrence}
          </div>
        {/if}
      </div>
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
        bind:value={() => editDate, changeDate}
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

    <div class="join w-full">
      <button
        class="btn join-item flex-1 justify-start font-normal"
        onclick={() => (showTimePicker = true)}
        data-testid="edit-time-button"
      >
        <Clock class="size-4" />
        {#if editDoAfter}
          After {formatTime(editDoAfter, timeZone)}
        {:else}
          <span class="text-base-content/60">Hide until a time</span>
        {/if}
      </button>
      {#if editDoAfter}
        <button
          class="btn join-item"
          onclick={() => (editDoAfter = null)}
          aria-label="Clear time"
          transition:slide={{ axis: 'x', duration: 150 }}
        >
          <X class="size-4" />
        </button>
      {/if}
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

<TimePickerModal
  open={showTimePicker}
  {task}
  {origin}
  initial={timeInitial}
  date={timeAnchor}
  onconfirm={handleTimeConfirm}
  onclose={() => (showTimePicker = false)}
/>
