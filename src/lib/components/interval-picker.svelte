<script lang="ts">
  import IntervalPickerForm from './interval-picker-form.svelte';

  let {
    interval = $bindable<{ years: number; months: number; weeks: number; days: number }>({
      years: 0,
      months: 0,
      weeks: 0,
      days: 0,
    }),
    open = $bindable(false),
  }: {
    interval: { years: number; months: number; weeks: number; days: number };
    open?: boolean;
  } = $props();

  function formatInterval(): string {
    const parts: string[] = [];
    if (interval.years) parts.push(`${interval.years} year${interval.years > 1 ? 's' : ''}`);
    if (interval.months) parts.push(`${interval.months} month${interval.months > 1 ? 's' : ''}`);
    if (interval.weeks) parts.push(`${interval.weeks} week${interval.weeks > 1 ? 's' : ''}`);
    if (interval.days) parts.push(`${interval.days} day${interval.days > 1 ? 's' : ''}`);
    return parts.length ? parts.join(' ') : 'Not set';
  }
</script>

<button class="btn btn-sm btn-outline" onclick={() => (open = true)}>
  {formatInterval()}
</button>

<dialog class="modal" class:modal-open={open}>
  {#key open}
    <IntervalPickerForm bind:interval bind:open />
  {/key}
  <form method="dialog" class="modal-backdrop">
    <button onclick={() => (open = false)}>close</button>
  </form>
</dialog>
