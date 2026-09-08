<script lang="ts">
  import { Temporal } from '@js-temporal/polyfill';
  import Clock from 'lucide-svelte/icons/clock';
  import WheelSelect from './wheel-select.svelte';
  import TaskSummary from './task-summary.svelte';
  import { getNow } from '$lib/scheduler-refresh.svelte';
  import { doAfterFromTime, isFutureTime, nextRoundedTime } from '$lib/engines/defer-engine';
  import { formatClock } from '$lib/utils/format-date';
  import type { OriginInfo, TaskDoc } from '$lib/types';

  let {
    open,
    task = null as TaskDoc | null,
    origin = null as OriginInfo | null,
    initial = null as { hour: number; minute: number } | null,
    onconfirm,
    onclose,
  }: {
    open: boolean;
    task?: TaskDoc | null;
    origin?: OriginInfo | null;
    initial?: { hour: number; minute: number } | null;
    onconfirm: (hour: number, minute: number) => void;
    onclose: () => void;
  } = $props();

  const timeZone = Temporal.Now.timeZoneId();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const seed = $derived.by(() => {
    void open;
    return initial ?? nextRoundedTime(Temporal.Now.instant(), timeZone);
  });
  let hour = $derived<string | number>(seed.hour);
  let minute = $derived<string | number>(seed.minute);

  const candidate = $derived(
    doAfterFromTime(
      getNow().toZonedDateTimeISO(timeZone).toPlainDate(),
      Number(hour),
      Number(minute),
      timeZone,
    ),
  );
  const valid = $derived(isFutureTime(candidate, getNow()));

  function twoDigits(v: string | number): string {
    return String(v).padStart(2, '0');
  }

  function confirm() {
    if (valid) onconfirm(Number(hour), Number(minute));
  }
</script>

<dialog class="modal" class:modal-open={open}>
  <div class="modal-box max-w-sm p-5 flex flex-col gap-4">
    {#if task}
      <TaskSummary {task} {origin} />
    {/if}
    <div class="divider my-0"></div>
    <div class="flex items-center justify-center gap-2">
      <div class="w-24">
        <WheelSelect items={hours} bind:value={hour} label="Hour" cycle={true} format={twoDigits} />
      </div>
      <span class="text-2xl font-semibold text-base-content mt-6">:</span>
      <div class="w-24">
        <WheelSelect
          items={minutes}
          bind:value={minute}
          label="Minute"
          cycle={true}
          format={twoDigits}
        />
      </div>
    </div>
    <p class="text-center text-xs text-base-content/50 h-4" aria-live="polite">
      {valid ? '' : 'Pick a time later than now'}
    </p>
    <div class="modal-action mt-0">
      <button class="btn btn-ghost btn-sm" onclick={onclose}>Cancel</button>
      <button class="btn btn-success btn-sm" onclick={confirm} disabled={!valid}>
        <Clock class="size-4" />
        Set {formatClock(Number(hour), Number(minute))}
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button onclick={onclose}>close</button>
  </form>
</dialog>
