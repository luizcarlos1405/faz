import { streamChat, ChatError, type ChatMessage } from '$lib/ai/client';
import {
  getApiKey,
  getConfiguredProviders,
  getLastProviderId,
  setLastProviderId,
} from '$lib/ai/keys';
import { getProvider, type ProviderId, type Provider } from '$lib/ai/providers';

export function getChatPageState() {
  let messages = $state<ChatMessage[]>([]);
  let input = $state('');
  let streaming = $state(false);
  let error = $state<string | null>(null);
  let providerId = $state<ProviderId>(getLastProviderId() ?? 'zai');
  let controller: AbortController | null = null;

  const configuredProviders = $derived(getConfiguredProviders());
  const showSwitch = $derived(configuredProviders.length >= 2);

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
        model: getProvider(providerId).defaultModel,
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
    get currentProvider(): Provider {
      return getProvider(providerId);
    },
    get configuredProviders() {
      return configuredProviders;
    },
    get showSwitch() {
      return showSwitch;
    },
    send,
    stop,
    switchProvider,
    clear,
  };
}
