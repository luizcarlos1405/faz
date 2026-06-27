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

function effectiveModel(id: ProviderId): string {
  const provider = getProvider(id);
  const stored = getModel(id);
  return stored && provider.models.includes(stored) ? stored : provider.defaultModel;
}

export function getChatPageState() {
  let messages = $state<ChatMessage[]>([]);
  let input = $state('');
  let streaming = $state(false);
  let error = $state<string | null>(null);
  let providerId = $state<ProviderId>(getLastProviderId() ?? 'zai');
  let modelId = $state(effectiveModel(providerId));
  let controller: AbortController | null = null;

  const configuredProviders = $derived(getConfiguredProviders());
  const showSwitch = $derived(configuredProviders.length >= 2);
  const currentModels = $derived(getProvider(providerId).models);
  const showModelSwitch = $derived(currentModels.length >= 2);

  async function send(): Promise<void> {
    const text = input.trim();
    if (!text || streaming) return;
    const key = getApiKey(providerId);
    if (!key) {
      error = `No API key set for ${getProvider(providerId).label}.`;
      return;
    }
    const requestMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    input = '';
    error = null;
    messages = [...requestMessages, { role: 'assistant', content: '' }];
    const assistantIndex = messages.length - 1;
    streaming = true;
    controller = new AbortController();
    try {
      await streamChat({
        providerId,
        apiKey: key,
        model: modelId,
        messages: requestMessages,
        signal: controller.signal,
        onDelta: (delta) => {
          messages[assistantIndex].content += delta;
          messages = [...messages];
        },
      });
    } catch (e) {
      if (!controller?.signal.aborted) {
        error = e instanceof ChatError ? e.message : 'Something went wrong.';
      }
    } finally {
      streaming = false;
      controller = null;
      const last = messages[messages.length - 1];
      if (last && last.role === 'assistant' && last.content === '') {
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
    error = null;
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
    get error() {
      return error;
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
