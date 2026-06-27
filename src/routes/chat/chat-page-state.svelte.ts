import { streamChat, ChatError, type ChatMessage } from '$lib/ai/client';
import {
  getApiKey,
  getConfiguredProviders,
  getLastProviderId,
  setLastProviderId,
  getModel,
  setModel,
} from '$lib/ai/keys';
import { getProvider, type ProviderId, type Provider } from '$lib/ai/providers';

const IDLE_TIMEOUT_MS = 60000;

function effectiveModel(id: ProviderId): string {
  const provider = getProvider(id);
  const stored = getModel(id);
  return stored && provider.models.includes(stored) ? stored : provider.defaultModel;
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
  let messages = $state<ChatMessage[]>([]);
  let input = $state('');
  let streaming = $state(false);
  let providerId = $state<ProviderId>(getLastProviderId() ?? 'zai');
  let modelId = $state(effectiveModel(providerId));
  let controller: AbortController | null = null;
  let idleTimer: ReturnType<typeof setInterval> | null = null;
  let timedOut = false;

  const configuredProviders = $derived(getConfiguredProviders());
  const showSwitch = $derived(configuredProviders.length >= 2);
  const currentModels = $derived(getProvider(providerId).models);
  const showModelSwitch = $derived(currentModels.length >= 2);

  async function send(): Promise<void> {
    const text = input.trim();
    if (!text || streaming) return;
    const provider = getProvider(providerId);
    const requestMessages: ChatMessage[] = messages
      .filter((m) => !m.error)
      .concat([{ role: 'user', content: text }]);
    input = '';

    const key = getApiKey(providerId);
    if (!key) {
      messages = [
        ...requestMessages,
        {
          role: 'assistant',
          content: `I don't have an API key for ${provider.label} yet. Add one in AI Keys to start chatting.`,
          error: true,
        },
      ];
      return;
    }

    messages = [...requestMessages, { role: 'assistant', content: '', reasoning: '' }];
    const assistantIndex = messages.length - 1;
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

    try {
      await streamChat({
        providerId,
        apiKey: key,
        model: modelId,
        messages: requestMessages,
        signal: controller.signal,
        onDelta: ({ content, reasoning }) => {
          lastActivity = Date.now();
          messages[assistantIndex].content += content;
          messages[assistantIndex].reasoning += reasoning;
          messages = [...messages];
        },
      });
    } catch (e) {
      if (timedOut) {
        messages[assistantIndex] = {
          role: 'assistant',
          content: `This is taking too long — ${provider.label} stopped responding. Try again, or pick a different model.`,
          error: true,
        };
        messages = [...messages];
      } else if (!controller?.signal.aborted) {
        messages[assistantIndex] = {
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
      if (last && last.role === 'assistant' && last.content === '' && !last.reasoning) {
        messages = messages.slice(0, -1);
      }
    }
  }

  function stop(): void {
    controller?.abort();
  }

  function switchProvider(id: ProviderId): void {
    providerId = id;
    setLastProviderId(id);
    modelId = effectiveModel(id);
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
    switchProvider,
    switchModel,
    clear,
  };
}
