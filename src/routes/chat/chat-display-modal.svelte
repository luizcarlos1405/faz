<script lang="ts">
  import Eye from 'lucide-svelte/icons/eye';
  import Wrench from 'lucide-svelte/icons/wrench';

  let {
    open,
    showThinking,
    showTools,
    onToggleThinking,
    onToggleTools,
    onclose,
  }: {
    open: boolean;
    showThinking: boolean;
    showTools: boolean;
    onToggleThinking: (value: boolean) => void;
    onToggleTools: (value: boolean) => void;
    onclose: () => void;
  } = $props();
</script>

<dialog class="modal modal-bottom" class:modal-open={open}>
  <div class="modal-box max-w-sm">
    <h3 class="font-bold text-lg mb-1">Message display</h3>
    <p class="text-sm text-base-content/60 mb-4">Choose what appears inside AI messages.</p>

    <div class="flex flex-col gap-1">
      <label class="label justify-between cursor-pointer">
        <span class="label-text flex items-center gap-2">
          <Eye class="size-4" />
          Show thinking
        </span>
        <input
          type="checkbox"
          class="toggle toggle-primary"
          checked={showThinking}
          onchange={(e) => onToggleThinking(e.currentTarget.checked)}
        />
      </label>
      <label class="label justify-between cursor-pointer">
        <span class="label-text flex items-center gap-2">
          <Wrench class="size-4" />
          Show tool calls
        </span>
        <input
          type="checkbox"
          class="toggle toggle-primary"
          checked={showTools}
          onchange={(e) => onToggleTools(e.currentTarget.checked)}
        />
      </label>
    </div>

    <div class="modal-action">
      <button class="btn btn-sm" onclick={onclose}>Done</button>
    </div>
  </div>
  <form method="dialog" class="modal-backdrop">
    <button onclick={onclose}>close</button>
  </form>
</dialog>
