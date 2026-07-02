import { ChatError } from '$lib/ai/client';
import { runAgent, type ToolEvent } from '$lib/ai/agent';
import { buildSystemContext } from '$lib/ai/context';
import { gatherContext } from '$lib/ai/context-gather';
import {
  getApiKey,
  getConfiguredProviders,
  getLastProviderId,
  setLastProviderId,
  getModel,
  setModel,
} from '$lib/ai/keys';
import { getProvider, type ProviderId, type Provider } from '$lib/ai/providers';
import { loadModels, readCachedModels } from '$lib/ai/models';
import type { ChatMessage } from '$lib/ai/protocol';

const IDLE_TIMEOUT_MS = 60000;

type ToolLogEntry = ToolEvent & { undone?: boolean };

interface TurnMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  reasoning?: string;
  error?: boolean;
  tools?: ToolLogEntry[];
}

function effectiveModel(id: ProviderId): string {
  const provider = getProvider(id);
  const stored = getModel(id);
  const known = new Set<string>([...provider.models, ...(readCachedModels(id) ?? [])]);
  return stored && known.has(stored) ? stored : provider.defaultModel;
}

function friendlyError(e: unknown, label: string): string {
  if (e instanceof ChatError) {
    switch (e.kind) {
      case 'auth':
        return `I couldn't sign in to ${label}. Your API key might be wrong or expired — check it in AI Keys.`;
      case 'rate':
        return `${label} is rate-limiting me right now. Wait a moment and try again.`;
      case 'cors':
        return `${label} doesn't allow requests from a web browser. Try Zhipu GLM or Anthropic.`;
      case 'network':
        return `I couldn't reach ${label}. Check your internet connection and try again.`;
      default:
        return `${label} returned an error${e.status ? ` (${e.status})` : ''}. Try again, or switch models.`;
    }
  }
  return 'Something went wrong talking to the AI. Please try again.';
}

export function getChatPageState() {
  let messages = $state<TurnMessage[]>([]);
  let input = $state('');
  let streaming = $state(false);
  let providerId = $state<ProviderId>(getLastProviderId() ?? 'zai');
  let modelId = $state(effectiveModel(providerId));
  let controller: AbortController | null = null;
  let idleTimer: ReturnType<typeof setInterval> | null = null;
  let timedOut = false;

  const configuredProviders = $derived(getConfiguredProviders());
  const showSwitch = $derived(configuredProviders.length >= 2);
  let currentModels = $state<string[]>(getProvider(providerId).models);
  const showModelSwitch = $derived(currentModels.length >= 2);

  async function loadModelsFor(id: ProviderId): Promise<void> {
    const key = getApiKey(id);
    if (!key) return;
    const models = await loadModels(getProvider(id), key);
    if (models.length) currentModels = models;
  }

  loadModelsFor(providerId);

  async function send(): Promise<void> {
    const text = input.trim();
    if (!text || streaming) return;
    const provider = getProvider(providerId);
    const requestBase: TurnMessage[] = messages
      .filter((m) => !m.error)
      .concat([{ role: 'user', content: text }]);
    input = '';

    const key = getApiKey(providerId);
    if (!key) {
      messages = [
        ...requestBase,
        {
          role: 'assistant',
          content: `I don't have an API key for ${provider.label} yet. Add one in AI Keys to start chatting.`,
          error: true,
        },
      ];
      return;
    }

    messages = [...requestBase, { role: 'assistant', content: '', reasoning: '', tools: [] }];
    const aiIndex = messages.length - 1;
    streaming = true;
    timedOut = false;
    controller = new AbortController();

    let lastActivity = Date.now();
    idleTimer = setInterval(() => {
      if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
        timedOut = true;
        controller?.abort();
      }
    }, 5000);

    const requestMessages: ChatMessage[] = requestBase.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const system = buildSystemContext(await gatherContext());
      await runAgent({
        providerId,
        apiKey: key,
        model: modelId,
        system,
        messages: requestMessages,
        signal: controller.signal,
        onReasoning: (r) => {
          lastActivity = Date.now();
          messages[aiIndex].reasoning += r;
          messages = [...messages];
        },
        onTool: (ev) => {
          lastActivity = Date.now();
          messages[aiIndex].tools = [...(messages[aiIndex].tools ?? []), { ...ev }];
          messages = [...messages];
        },
        onText: (t) => {
          lastActivity = Date.now();
          messages[aiIndex].content = t;
          messages = [...messages];
        },
      });
    } catch (e) {
      if (timedOut) {
        messages[aiIndex] = {
          role: 'assistant',
          content: `This is taking too long — ${provider.label} stopped responding. Try again, or pick a different model.`,
          error: true,
        };
        messages = [...messages];
      } else if (!controller?.signal.aborted) {
        messages[aiIndex] = {
          role: 'assistant',
          content: friendlyError(e, provider.label),
          error: true,
        };
        messages = [...messages];
      }
    } finally {
      streaming = false;
      controller = null;
      if (idleTimer) {
        clearInterval(idleTimer);
        idleTimer = null;
      }
      const last = messages[messages.length - 1];
      if (
        last &&
        last.role === 'assistant' &&
        last.content === '' &&
        !last.reasoning &&
        !(last.tools && last.tools.length)
      ) {
        messages = messages.slice(0, -1);
      }
    }
  }

  function stop(): void {
    controller?.abort();
  }

  function undoTool(msgIndex: number, toolIndex: number): void {
    const msg = messages[msgIndex];
    const tool = msg?.tools?.[toolIndex];
    if (!tool?.undo || tool.undone) return;
    tool.undone = true;
    messages = [...messages];
    tool.undo.restore().catch(() => {
      const t = messages[msgIndex]?.tools?.[toolIndex];
      if (t) {
        t.undone = false;
        messages = [...messages];
      }
    });
  }

  function switchProvider(id: ProviderId): void {
    providerId = id;
    setLastProviderId(id);
    modelId = effectiveModel(id);
    currentModels = getProvider(id).models;
    loadModelsFor(id);
  }

  function switchModel(model: string): void {
    modelId = model;
    setModel(providerId, model);
  }

  function clear(): void {
    if (streaming) return;
    messages = [];
  }

  return {
    get messages() {
      return messages;
    },
    get input() {
      return input;
    },
    set input(v: string) {
      input = v;
    },
    get streaming() {
      return streaming;
    },
    get providerId() {
      return providerId;
    },
    get modelId() {
      return modelId;
    },
    get currentProvider(): Provider {
      return getProvider(providerId);
    },
    get configuredProviders() {
      return configuredProviders;
    },
    get currentModels() {
      return currentModels;
    },
    get showSwitch() {
      return showSwitch;
    },
    get showModelSwitch() {
      return showModelSwitch;
    },
    send,
    stop,
    undoTool,
    switchProvider,
    switchModel,
    clear,
  };
}
