<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { LAST_ROUTE_KEY, tabForPath } from '$lib/utils/nav-tabs';

  onMount(() => {
    const saved = localStorage.getItem(LAST_ROUTE_KEY);
    const target = (saved && tabForPath(saved)) || '/tasks';
    goto(resolve(target));
  });
</script>
