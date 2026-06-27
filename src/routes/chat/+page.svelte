<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { getChatPageState } from './chat-page-state.svelte';
  import { hasAnyKey } from '$lib/ai/keys';
  import type { ProviderId } from '$lib/ai/providers';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import ArrowUp from 'lucide-svelte/icons/arrow-up';
  import Square from 'lucide-svelte/icons/square';
  import KeyRound from 'lucide-svelte/icons/key-round';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import LoaderCircle from 'lucide-svelte/icons/loader-circle';

  const hasKey = hasAnyKey();
  const ctrl = getChatPageState();
  const suggestions = ['Plan my week', 'Summarize my inbox', 'Draft a goal'];

  let scrollEl: HTMLDivElement | undefined = $state();
  let inputEl: HTMLInputElement | undefined = $state();

  onMount(() => {
    if (!hasKey) goto(resolve('/settings/keys'));
  });

  $effect(() => {
    ctrl.messages;
    ctrl.streaming;
    tick().then(() => scrollEl?.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' }));
  });

  function handleSend(): void {
    ctrl.send();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }

  function useSuggestion(text: string): void {
    ctrl.input = text;
    inputEl?.focus();
  }
</script>

{#if !hasKey}
  <div class="flex justify-center items-center h-full py-12">
    <LoaderCircle class="size-6 animate-spin text-base-content/40" />
  </div>
{:else}
  <div class="flex flex-col h-full">
    {#if ctrl.showSwitch || ctrl.showModelSwitch}
      <div
        class="flex items-center justify-between gap-2 px-4 py-2 border-b border-base-300 bg-base-100"
      >
        <div class="flex items-center gap-2">
          {#if ctrl.showSwitch}
            <select
              class="select select-bordered select-sm w-auto"
              value={ctrl.providerId}
              onchange={(e) => ctrl.switchProvider(e.currentTarget.value as ProviderId)}
              aria-label="Provider"
            >
              {#each ctrl.configuredProviders as p (p.id)}
                <option value={p.id}>{p.label}</option>
              {/each}
            </select>
          {/if}
          {#if ctrl.showModelSwitch}
            <select
              class="select select-bordered select-sm w-auto"
              value={ctrl.modelId}
              onchange={(e) => ctrl.switchModel(e.currentTarget.value)}
              aria-label="Model"
            >
              {#each ctrl.currentModels as m (m)}
                <option value={m}>{m}</option>
              {/each}
            </select>
          {/if}
        </div>
        <a
          class="btn btn-ghost btn-sm btn-circle"
          href={resolve('/settings/keys')}
          aria-label="Manage API keys"
        >
          <KeyRound class="size-4" />
        </a>
      </div>
    {/if}

    <div class="flex-1 overflow-y-auto px-4 py-4" bind:this={scrollEl}>
      {#if ctrl.messages.length === 0}
        <div class="flex flex-col items-center justify-center h-full text-center gap-4 px-6">
          <div class="size-16 rounded-full bg-base-200 flex items-center justify-center">
            <Sparkles class="size-8 text-primary" />
          </div>
          <div class="flex flex-col gap-1">
            <h2 class="text-xl font-bold">Chat with your AI</h2>
            <p class="text-sm text-base-content/60">
              Ask anything. Your API key stays on this device.
            </p>
          </div>
          <div class="flex flex-wrap justify-center gap-2">
            {#each suggestions as s (s)}
              <button class="btn btn-sm bg-base-200" onclick={() => useSuggestion(s)}>{s}</button>
            {/each}
          </div>
        </div>
      {:else}
        <div class="flex flex-col gap-3.5">
          {#each ctrl.messages as msg, i (i)}
            {#if msg.role === 'user'}
              <div class="flex justify-end">
                <div
                  class="max-w-[80%] bg-primary text-primary-content rounded-2xl px-3.5 py-2.5 whitespace-pre-wrap text-sm"
                >
                  {msg.content}
                </div>
              </div>
            {:else}
              {@const isLast = i === ctrl.messages.length - 1}
              {@const isActive = ctrl.streaming && isLast}
              <div class="flex gap-2.5 items-end">
                <div
                  class="size-7 rounded-full bg-base-200 flex items-center justify-center shrink-0"
                >
                  <Sparkles class="size-4 text-primary" />
                </div>
                <div
                  class="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm {msg.error
                    ? 'bg-warning/15'
                    : 'bg-base-200'}"
                >
                  {#if msg.error}
                    <div class="flex items-start gap-1.5">
                      <AlertTriangle class="size-4 shrink-0 text-warning mt-0.5" />
                      <span class="whitespace-pre-wrap">{msg.content}</span>
                    </div>
                  {:else if msg.reasoning}
                    <details open={isActive && !msg.content}>
                      <summary class="text-xs text-base-content/50 cursor-pointer">
                        {isActive && !msg.content ? 'Thinking…' : 'Thought process'}
                      </summary>
                      <div
                        class="mt-1 text-xs text-base-content/40 italic whitespace-pre-wrap border-l-2 border-base-300 pl-2"
                      >
                        {msg.reasoning}
                      </div>
                    </details>
                    {#if msg.content}
                      <div class="whitespace-pre-wrap mt-1">
                        {msg.content}
                        {#if isActive}<LoaderCircle
                            class="size-3 animate-spin inline ml-1 align-middle"
                          />{/if}
                      </div>
                    {/if}
                  {:else if msg.content}
                    <div class="whitespace-pre-wrap">
                      {msg.content}
                      {#if isActive}<LoaderCircle
                          class="size-3 animate-spin inline ml-1 align-middle"
                        />{/if}
                    </div>
                  {:else if isActive}
                    <div class="flex items-center gap-2 text-base-content/50">
                      <LoaderCircle class="size-3 animate-spin" /> Thinking…
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>

    <div class="flex items-center gap-2 p-3 border-t border-base-300 bg-base-100">
      <input
        type="text"
        class="input flex-1 rounded-full"
        placeholder="Message Faz AI…"
        bind:value={ctrl.input}
        bind:this={inputEl}
        onkeydown={handleKeydown}
      />
      {#if ctrl.streaming}
        <button class="btn btn-circle btn-sm" onclick={ctrl.stop} aria-label="Stop">
          <Square class="size-4" />
        </button>
      {:else}
        <button
          class="btn btn-primary btn-circle btn-sm"
          onclick={handleSend}
          disabled={!ctrl.input.trim()}
          aria-label="Send"
        >
          <ArrowUp class="size-5" />
        </button>
      {/if}
    </div>
  </div>
{/if}
