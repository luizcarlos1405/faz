<script lang="ts">
  import 'cally';
  import { Temporal } from '@js-temporal/polyfill';
  import ChevronLeft from 'lucide-svelte/icons/chevron-left';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import ArrowRight from 'lucide-svelte/icons/arrow-right';
  import TaskSummary from './task-summary.svelte';
  import { formatWeekdayDate } from '$lib/utils/format-date';
  import { getNow } from '$lib/scheduler-refresh.svelte';
  import type { OriginInfo, TaskDoc } from '$lib/types';

  let {
    open,
    task = null as TaskDoc | null,
    origin = null as OriginInfo | null,
    onconfirm,
    onclose,
  }: {
    open: boolean;
    task?: TaskDoc | null;
    origin?: OriginInfo | null;
    onconfirm: (date: string) => void;
    onclose: () => void;
  } = $props();

  const timeZone = Temporal.Now.timeZoneId();
  const today = $derived(getNow().toZonedDateTimeISO(timeZone).toPlainDate());
  const tomorrow = $derived(today.add({ days: 1 }).toString());

  let selected = $derived.by(() => {
    void open;
    return '';
  });
  const valid = $derived(!!selected && selected >= tomorrow);

  function handleChange(e: Event) {
    selected = (e.currentTarget as HTMLElement & { value: string }).value;
  }

  function confirm() {
    if (valid) onconfirm(selected);
  }
</script>

<dialog class="modal" class:modal-open={open}>
  <div class="modal-box max-w-sm p-5 flex flex-col gap-4">
    {#if task}
      <TaskSummary {task} {origin} />
    {/if}
    <div class="divider my-0"></div>
    <div class="flex justify-center">
      <calendar-date
        class="cally"
        value={selected}
        min={tomorrow}
        today={today.toString()}
        onchange={handleChange}
      >
        <span slot="previous" aria-label="Previous month"><ChevronLeft class="size-5" /></span>
        <span slot="next" aria-label="Next month"><ChevronRight class="size-5" /></span>
        <calendar-month></calendar-month>
      </calendar-date>
    </div>
    <div class="modal-action mt-0">
      <button class="btn btn-ghost btn-sm" onclick={onclose}>Cancel</button>
      <button class="btn btn-success btn-sm" onclick={confirm} disabled={!valid}>
        <ArrowRight class="size-4" />
        {valid ? `Move to ${formatWeekdayDate(selected, today)}` : 'Pick a day'}
      </button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button onclick={onclose}>close</button>
  </form>
</dialog>
