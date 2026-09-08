<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { Temporal } from '@js-temporal/polyfill';
  import Check from 'lucide-svelte/icons/check';
  import SkipForward from 'lucide-svelte/icons/skip-forward';
  import X from 'lucide-svelte/icons/x';
  import Sunrise from 'lucide-svelte/icons/sunrise';
  import Calendar from 'lucide-svelte/icons/calendar';
  import CalendarDays from 'lucide-svelte/icons/calendar-days';
  import Clock from 'lucide-svelte/icons/clock';
  import Target from 'lucide-svelte/icons/target';
  import Heart from 'lucide-svelte/icons/heart';
  import DatePickerModal from './date-picker-modal.svelte';
  import TimePickerModal from './time-picker-modal.svelte';
  import { getNow } from '$lib/scheduler-refresh.svelte';
  import { formatWeekdayDate } from '$lib/utils/format-date';
  import type { OriginInfo, TaskDoc } from '$lib/types';

  let {
    task = null as TaskDoc | null,
    remaining = 0,
    origin = null as OriginInfo | null,
    oncomplete,
    onskip,
    onpostpone,
    ondefer,
    onclose,
  }: {
    task?: TaskDoc | null;
    remaining?: number;
    origin?: OriginInfo | null;
    oncomplete: () => Promise<void>;
    onskip: () => Promise<void>;
    onpostpone: (date: string) => Promise<void>;
    ondefer: (hour: number, minute: number) => Promise<void>;
    onclose: () => void;
  } = $props();

  const timeZone = Temporal.Now.timeZoneId();

  let busy = $state(false);
  let errorMsg = $state<string | null>(null);
  let showDatePicker = $state(false);
  let showTimePicker = $state(false);

  let plusOffset = $derived.by(() => {
    void task?._id;
    return 0;
  });

  const today = $derived(getNow().toZonedDateTimeISO(timeZone).toPlainDate());
  const targetDate = $derived(today.add({ days: 1 + plusOffset }).toString());
  const targetLabel = $derived(
    plusOffset === 0 ? 'Tomorrow' : formatWeekdayDate(targetDate, today),
  );

  function flashError(msg: string) {
    errorMsg = msg;
    setTimeout(() => (errorMsg = null), 3000);
  }

  const allDone = $derived(!task);

  $effect(() => {
    if (allDone) {
      const timer = setTimeout(onclose, 1500);
      return () => clearTimeout(timer);
    }
  });

  async function run(action: () => Promise<void>, failure: string, label: string) {
    if (busy) return;
    busy = true;
    errorMsg = null;
    try {
      await action();
    } catch (e) {
      console.error(`Focus mode ${label} failed`, e);
      flashError(failure);
    } finally {
      busy = false;
    }
  }

  const handleDone = () => run(oncomplete, 'Could not complete task', 'done');
  const handleSkip = () => run(onskip, 'Could not postpone task', 'skip');
  const handlePostpone = () =>
    run(() => onpostpone(targetDate), 'Could not postpone task', 'postpone');

  function handleDateConfirm(date: string) {
    showDatePicker = false;
    run(() => onpostpone(date), 'Could not move task', 'move');
  }

  function handleTimeConfirm(hour: number, minute: number) {
    showTimePicker = false;
    run(() => ondefer(hour, minute), 'Could not set time', 'defer');
  }
</script>

<div
  class="fixed inset-0 z-[100] bg-base-100 flex justify-center"
  transition:fade={{ duration: 200 }}
>
  <div class="w-full max-w-md flex flex-col h-full">
    <div class="flex justify-between items-center px-5 pt-4 pb-4">
      {#if task && !allDone}
        <div class="join rounded-full bg-base-200" data-testid="schedule-join">
          <button
            class="join-item flex items-center py-2 px-2.5 text-base-content/40 disabled:opacity-50"
            onclick={() => (showDatePicker = true)}
            disabled={busy}
            aria-label="Pick a date"
          >
            <Calendar class="size-4" />
          </button>
          <div class="w-px self-stretch bg-base-content/10"></div>
          <button
            class="join-item flex items-center gap-1.5 py-2 px-3 text-[13px] font-medium disabled:opacity-50 {plusOffset >
            0
              ? 'text-base-content'
              : 'text-base-content/40'}"
            onclick={handlePostpone}
            disabled={busy}
            data-testid="postpone-button"
          >
            {#if plusOffset === 0}
              <Sunrise class="size-4" />
            {:else}
              <CalendarDays class="size-4" />
            {/if}
            {targetLabel}
          </button>
          <div class="w-px self-stretch bg-base-content/10"></div>
          <button
            class="join-item flex items-center py-2 px-2.5 text-[13px] font-semibold text-base-content/40 disabled:opacity-50"
            onclick={() => (plusOffset += 1)}
            disabled={busy}
            aria-label="One more day"
          >
            +1
          </button>
          {#if plusOffset > 0}
            <div class="w-px self-stretch bg-base-content/10"></div>
            <button
              class="join-item flex items-center py-2 px-2.5 text-base-content/40 disabled:opacity-50"
              onclick={() => (plusOffset = 0)}
              disabled={busy}
              aria-label="Back to tomorrow"
            >
              <X class="size-3.5" />
            </button>
          {/if}
        </div>
      {:else}
        <div></div>
      {/if}
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
            <p
              class="text-[28px] font-semibold leading-[1.3] text-base-content"
              data-testid="focus-title"
            >
              {task.title}
            </p>
            {#if origin}
              <div class="flex flex-col items-center gap-1 mt-4">
                <div class="flex items-center gap-1.5">
                  {#if origin.type === 'goal'}
                    <Target class="size-3 text-base-content/40" />
                  {:else}
                    <Heart class="size-3 text-base-content/40" />
                  {/if}
                  <span class="text-xs text-base-content/40">{origin.title}</span>
                </div>
                {#if origin.type === 'care' && origin.recurrence}
                  <span class="text-xs text-base-content/40">{origin.recurrence}</span>
                {/if}
              </div>
            {/if}
          </div>
        {/key}
      {/if}
    </div>

    <div class="h-[60px]"></div>

    {#if errorMsg}
      <p class="text-center text-sm text-error px-8 pb-2" transition:fade={{ duration: 150 }}>
        {errorMsg}
      </p>
    {/if}

    {#if task && !allDone}
      <div class="px-10 pb-12">
        <div class="flex justify-center gap-3">
          <div class="join rounded-full bg-base-200">
            <button
              class="join-item flex items-center rounded-full py-3.5 pl-5 pr-4 text-base-content disabled:opacity-50"
              onclick={() => (showTimePicker = true)}
              disabled={busy}
              aria-label="Pick a time"
            >
              <Clock class="size-5" />
            </button>
            <div class="w-px self-stretch bg-base-content/10"></div>
            <button
              class="join-item flex items-center gap-2 rounded-full py-3.5 pl-4 pr-6 text-base-content font-medium disabled:opacity-50"
              onclick={handleSkip}
              disabled={busy}
            >
              <SkipForward class="size-5" />
              Later
            </button>
          </div>
          <button
            class="flex items-center gap-2 rounded-full py-3.5 px-6 bg-success text-success-content font-semibold disabled:opacity-50"
            onclick={handleDone}
            disabled={busy}
          >
            <Check class="size-5" />
            Done
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<DatePickerModal
  open={showDatePicker}
  {task}
  {origin}
  onconfirm={handleDateConfirm}
  onclose={() => (showDatePicker = false)}
/>

<TimePickerModal
  open={showTimePicker}
  {task}
  {origin}
  onconfirm={handleTimeConfirm}
  onclose={() => (showTimePicker = false)}
/>
