<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  import '../app.css';
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import { runSchedulerNow } from '$lib/scheduler';
  import { bumpClock, bumpTaskRefresh, startMinuteTicker } from '$lib/scheduler-refresh.svelte';
  import ToastContainer from '$lib/components/toast-container.svelte';
  import ConfirmModal from '$lib/components/confirm-modal.svelte';
  import { initTheme } from '$lib/components/theme-state.svelte';
  import { pwaInfo } from 'virtual:pwa-info';

  let { children }: { children: Snippet } = $props();

  const webManifestHref = pwaInfo?.webManifest.href ?? '';

  async function syncAndRefresh() {
    await runSchedulerNow();
    bumpClock();
    bumpTaskRefresh();
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      syncAndRefresh();
    }
  }

  onMount(() => {
    initTheme();
    syncAndRefresh();
    const interval = setInterval(syncAndRefresh, 5 * 60 * 1000);
    const stopTicker = startMinuteTicker();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (pwaInfo) {
      import('virtual:pwa-register').then(({ registerSW }) => {
        registerSW({ immediate: true });
      });
    }

    if (import.meta.env.DEV) {
      import('$lib/sample-data').then(({ addSampleData }) => {
        window.addSampleData = addSampleData;
        console.info('Dev: window.addSampleData() is available');
      });
    }

    return () => {
      clearInterval(interval);
      stopTicker();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  });
</script>

<svelte:head>
  {#if webManifestHref}
    <link rel="manifest" href={webManifestHref} />
  {/if}
  <link rel="icon" href={favicon} />
  <title>Faz</title>
</svelte:head>

{@render children()}

<ToastContainer />
<ConfirmModal />
