<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<div class="flex flex-col h-full max-w-md mx-auto shadow-lg bg-base-100">
  {@render children()}
</div>
