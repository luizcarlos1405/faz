<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { getChatPageState } from './chat-page-state.svelte';
  import ChatDisplayModal from './chat-display-modal.svelte';
  import { hasAnyKey } from '$lib/ai/keys';
  import { sanitizeHtml } from '$lib/ai/html';
  import { usePageMenu } from '$lib/components/page-menu-state.svelte';
  import type { ProviderId } from '$lib/ai/providers';
  import { toolKind, isMutatingTool, type ToolKind } from '$lib/ai/tools/specs';
  import Bot from 'lucide-svelte/icons/bot';
  import ArrowUp from 'lucide-svelte/icons/arrow-up';
  import Square from 'lucide-svelte/icons/square';
  import KeyRound from 'lucide-svelte/icons/key-round';
  import AlertTriangle from 'lucide-svelte/icons/alert-triangle';
  import LoaderCircle from 'lucide-svelte/icons/loader-circle';
  import Search from 'lucide-svelte/icons/search';
  import Plus from 'lucide-svelte/icons/plus';
  import Check from 'lucide-svelte/icons/check';
  import Pencil from 'lucide-svelte/icons/pencil';
  import Trash2 from 'lucide-svelte/icons/trash-2';
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw';
  import ArrowRightLeft from 'lucide-svelte/icons/arrow-right-left';

  const TOOL_ICON_BY_KIND: Record<ToolKind, typeof Search> = {
    read: Search,
    create: Plus,
    update: Pencil,
    delete: Trash2,
    complete: Check,
    uncomplete: RotateCcw,
    convert: ArrowRightLeft,
    move: ArrowRightLeft,
  };

  function iconForKind(kind: ToolKind | undefined): typeof Search {
    return kind ? TOOL_ICON_BY_KIND[kind] : Check;
  }

  function toneForKind(kind: ToolKind | undefined, ok: boolean): string {
    if (!ok) return 'text-error';
    if (kind === 'delete') return 'text-error';
    if (kind === 'create' || kind === 'complete' || kind === 'uncomplete') return 'text-success';
    return 'text-base-content/50';
  }

  const hasKey = hasAnyKey();
  const ctrl = getChatPageState();
  const suggestions = ['Plan my week', 'Summarize my inbox', 'Draft a goal'];

  usePageMenu(() =>
    ctrl.streaming
      ? []
      : [
          {
            id: 'clear-chat',
            label: 'Clear chat history',
            icon: Trash2,
            onclick: ctrl.clear,
          },
        ],
  );

  let scrollEl: HTMLDivElement | undefined = $state();
  let inputEl: HTMLInputElement | undefined = $state();
  let displayModalOpen = $state(false);

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
            <Bot class="size-8 text-primary" />
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
              <div class="chat chat-end">
                <div class="chat-bubble chat-bubble-primary text-sm whitespace-pre-wrap">
                  {msg.content}
                </div>
              </div>
            {:else}
              {@const isLast = i === ctrl.messages.length - 1}
              {@const isActive = ctrl.streaming && isLast}
              {@const showingReasoning = ctrl.showThinking && !!msg.reasoning}
              {@const showingTools =
                !!msg.tools && msg.tools.some((t) => ctrl.showAllTools || isMutatingTool(t.name))}
              {@const anyVisibleDetail = showingReasoning || showingTools}
              <div class="chat chat-start">
                <div class="chat-image">
                  <button
                    type="button"
                    class="size-7 rounded-full bg-base-200 flex items-center justify-center cursor-pointer"
                    aria-label="Message display"
                    onclick={() => (displayModalOpen = true)}
                  >
                    <Bot class="size-4 text-primary" />
                  </button>
                </div>
                <div class="chat-bubble text-sm {msg.error ? 'chat-bubble-warning' : ''}">
                  {#if msg.error}
                    <div class="flex items-start gap-1.5">
                      <AlertTriangle class="size-4 shrink-0 mt-0.5" />
                      <span class="whitespace-pre-wrap">{msg.content}</span>
                    </div>
                  {:else}
                    {#if showingReasoning}
                      <details open={isActive && !msg.content && !showingTools}>
                        <summary class="text-xs text-base-content/50 cursor-pointer">
                          {isActive && !msg.content && !showingTools
                            ? 'Thinking…'
                            : 'Thought process'}
                        </summary>
                        <div
                          class="mt-1 text-xs text-base-content/40 italic whitespace-pre-wrap border-l-2 border-base-300 pl-2"
                        >
                          {msg.reasoning}
                        </div>
                      </details>
                    {/if}
                    {#if showingTools}
                      <div class="flex flex-col gap-1.5 {showingReasoning ? 'mt-2' : ''}">
                        {#each msg.tools as tool, ti (ti)}
                          {#if ctrl.showAllTools || isMutatingTool(tool.name)}
                            {@const kind = toolKind(tool.name)}
                            {@const ToolIcon = iconForKind(kind)}
                            <div
                              class="flex items-center justify-between gap-2 rounded-lg border border-base-300 bg-base-100 px-2.5 py-1.5"
                            >
                              <span class="flex items-center gap-1.5 min-w-0">
                                <ToolIcon class="size-3.5 shrink-0 {toneForKind(kind, tool.ok)}" />
                                <span class="text-xs truncate {tool.ok ? '' : 'text-error'}"
                                  >{tool.label}</span
                                >
                              </span>
                              {#if tool.undo && !tool.undone}
                                <button
                                  class="btn btn-ghost btn-xs gap-1 text-primary shrink-0"
                                  onclick={() => ctrl.undoTool(i, ti)}>Undo</button
                                >
                              {:else if tool.undone}
                                <span class="text-xs text-base-content/40 shrink-0">Undone</span>
                              {/if}
                            </div>
                          {/if}
                        {/each}
                      </div>
                    {/if}
                    {#if msg.content}
                      <div class="chat-html {showingTools || showingReasoning ? 'mt-2' : ''}">
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized via sanitizeHtml (DOMPurify) in $lib/ai/html.ts -->
                        {@html sanitizeHtml(msg.content)}
                        {#if isActive}<LoaderCircle
                            class="size-3 animate-spin inline ml-1 align-middle"
                          />{/if}
                      </div>
                    {:else if isActive && !anyVisibleDetail}
                      <div class="flex items-center gap-2 text-base-content/50">
                        <LoaderCircle class="size-3 animate-spin" /> Thinking…
                      </div>
                    {/if}
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

  <ChatDisplayModal
    open={displayModalOpen}
    showThinking={ctrl.showThinking}
    showAllTools={ctrl.showAllTools}
    onToggleThinking={ctrl.setShowThinking}
    onToggleAllTools={ctrl.setShowAllTools}
    onclose={() => (displayModalOpen = false)}
  />
{/if}

<style>
  .chat-html :global(p) {
    margin: 0;
  }
  .chat-html :global(p + p) {
    margin-top: 0.4em;
  }
  .chat-html :global(ul) {
    list-style: disc;
    margin: 0.25em 0;
    padding-left: 1.25em;
  }
  .chat-html :global(ol) {
    list-style: decimal;
    margin: 0.25em 0;
    padding-left: 1.25em;
  }
  .chat-html :global(li) {
    margin: 0.1em 0;
  }
</style>
