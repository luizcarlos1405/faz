<script lang="ts">
  import type { OriginInfo, TaskDoc } from '$lib/types';
  import TaskEditForm from './task-edit-form.svelte';

  let {
    open,
    task,
    origin = null as OriginInfo | null,
    onclose,
    onsave,
    ontransformgoal,
    ontransformcare,
    ondelete,
  }: {
    open: boolean;
    task?: TaskDoc | null;
    origin?: OriginInfo | null;
    onclose: () => void;
    onsave: (title: string, doAt: string, doAfter: string | null) => void;
    ontransformgoal: () => void;
    ontransformcare: () => void;
    ondelete: () => void;
  } = $props();
</script>

<dialog class="modal modal-bottom" class:modal-open={open}>
  {#if task}
    {#key task._id}
      <TaskEditForm
        {task}
        {origin}
        {onclose}
        {onsave}
        {ontransformgoal}
        {ontransformcare}
        {ondelete}
      />
    {/key}
  {/if}
  <form method="dialog" class="modal-backdrop">
    <button onclick={onclose}>close</button>
  </form>
</dialog>
