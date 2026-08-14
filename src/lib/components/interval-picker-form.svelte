<script lang="ts">
  import WheelSelect from '$lib/components/wheel-select.svelte';

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

  const rangeItems = Array.from({ length: 100 }, (_, i) => i);

  const fields = [
    { key: 'days' as const, label: 'Days' },
    { key: 'weeks' as const, label: 'Weaks' },
    { key: 'months' as const, label: 'Months' },
    { key: 'years' as const, label: 'Years' },
  ];

  let draft = $state({ ...interval });

  function confirm() {
    interval = { ...draft };
    open = false;
  }
</script>

<div class="modal-box">
  <div class="flex gap-2">
    {#each fields as field (field.key)}
      <div class="flex-1">
        <WheelSelect items={rangeItems} bind:value={draft[field.key]} label={field.label} />
      </div>
    {/each}
  </div>
  <div class="flex mt-4 justify-end gap-4">
    <button class="btn btn-ghost btn-sm" onclick={() => (open = false)}>Cancel</button>
    <button class="btn btn-primary btn-sm" onclick={confirm}>Select</button>
  </div>
</div>
