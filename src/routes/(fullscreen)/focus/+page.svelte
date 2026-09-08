<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import FocusMode from '$lib/components/focus-mode.svelte';
  import { getTasksPageState } from '../../(app)/tasks/tasks-page-state.svelte';

  const ctrl = getTasksPageState();

  function exit() {
    goto(resolve('/tasks'), { replaceState: true });
  }
</script>

{#if !ctrl.loading}
  <FocusMode
    task={ctrl.tasks[0] ?? null}
    remaining={ctrl.tasks.length}
    origin={ctrl.tasks[0] ? ctrl.getOriginInfo(ctrl.tasks[0]) : null}
    oncomplete={async () => {
      if (ctrl.tasks[0]) await ctrl.toggleComplete(ctrl.tasks[0]._id);
    }}
    onskip={async () => {
      await ctrl.moveToEnd();
    }}
    onpostpone={async (date) => {
      if (ctrl.tasks[0]) await ctrl.postponeTask(ctrl.tasks[0]._id, date);
    }}
    ondefer={async (hour, minute) => {
      if (ctrl.tasks[0]) await ctrl.deferUntil(ctrl.tasks[0]._id, hour, minute);
    }}
    onclose={exit}
  />
{/if}
