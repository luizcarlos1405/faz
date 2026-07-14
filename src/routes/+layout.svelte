<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  import '../app.css';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import ListChecks from 'lucide-svelte/icons/list-checks';
  import Inbox from 'lucide-svelte/icons/inbox';
  import Target from 'lucide-svelte/icons/target';
  import Heart from 'lucide-svelte/icons/heart';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import { onMount } from 'svelte';
  import { LAST_ROUTE_KEY, tabForPath } from '$lib/utils/nav-tabs';
  import { runSchedulerNow } from '$lib/scheduler';
  import { bumpTaskRefresh } from '$lib/scheduler-refresh.svelte';
  import TopBar from '$lib/components/top-bar.svelte';
  import ToastContainer from '$lib/components/toast-container.svelte';
  import ConfirmModal from '$lib/components/confirm-modal.svelte';
  import type { Snippet } from 'svelte';
  import { pwaInfo } from 'virtual:pwa-info';

  let { children }: { children: Snippet } = $props();

  const navItems = [
    { href: '/tasks', label: 'Tasks', icon: ListChecks, matches: ['/tasks'] },
    { href: '/inbox', label: 'Inbox', icon: Inbox, matches: ['/inbox'] },
    { href: '/goals', label: 'Goals', icon: Target, matches: ['/goals'] },
    { href: '/cares', label: 'Cares', icon: Heart, matches: ['/cares'] },
    { href: '/chat', label: 'AI', icon: Sparkles, matches: ['/chat', '/settings/keys'] },
  ] as const;

  $effect(() => {
    const hash = page.url.hash;
    const path = hash.startsWith('#') ? hash.slice(1) : hash;
    const tab = tabForPath(path);
    if (tab) localStorage.setItem(LAST_ROUTE_KEY, tab);
  });

  const webManifestHref = pwaInfo?.webManifest.href ?? '';

  async function syncAndRefresh() {
    await runSchedulerNow();
    bumpTaskRefresh();
  }

  onMount(() => {
    syncAndRefresh();
    const interval = setInterval(syncAndRefresh, 5 * 60 * 1000);

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

    return () => clearInterval(interval);
  });
</script>

<svelte:head>
  {#if webManifestHref}
    <link rel="manifest" href={webManifestHref} />
  {/if}
  <link rel="icon" href={favicon} />
  <title>Faz</title>
</svelte:head>

<div id="layout" class="flex flex-col h-full max-w-md mx-auto shadow-lg bg-base-100">
  <TopBar />

  <main class="flex-1 overflow-y-auto">
    {@render children()}
  </main>

  <nav class="dock dock-md static z-50">
    {#each navItems as item (item.href)}
      <a
        href={resolve(item.href)}
        class:dock-active={item.matches.some((m) => page.url.hash.startsWith(`#${m}`))}
      >
        <item.icon class="size-5" />
        <span class="dock-label">{item.label}</span>
      </a>
    {/each}
  </nav>

  <ToastContainer />
  <ConfirmModal />
</div>
