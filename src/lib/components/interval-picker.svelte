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
    if (interval.years) parts.push(`${interval.years} years`);
    if (interval.months) parts.push(`${interval.months} months`);
    if (interval.weeks) parts.push(`${interval.weeks} weeks`);
    if (interval.days) parts.push(`${interval.days} days`);
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
