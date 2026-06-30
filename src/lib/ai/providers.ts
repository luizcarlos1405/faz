export type Protocol = 'openai' | 'anthropic';

export type ProviderId = 'zai' | 'openai' | 'anthropic' | 'groq' | 'openrouter' | 'deepseek';

export interface Provider {
  id: ProviderId;
  label: string;
  protocol: Protocol;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  browserCompatible: boolean;
  docsUrl: string;
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  zai: {
    id: 'zai',
    label: 'Zhipu GLM',
    protocol: 'openai',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    defaultModel: 'glm-4.7-flash',
    models: ['glm-4.7-flash', 'glm-4-flash-250414', 'glm-4.6', 'glm-4.7'],
    browserCompatible: true,
    docsUrl: 'https://z.ai/manage-apikey/apikey-list',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    browserCompatible: true,
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-latest',
    models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'],
    browserCompatible: true,
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    browserCompatible: true,
    docsUrl: 'https://console.groq.com/keys',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    models: [
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-haiku',
      'google/gemini-flash-1.5',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    browserCompatible: true,
    docsUrl: 'https://openrouter.ai/keys',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'],
    browserCompatible: false,
    docsUrl: 'https://platform.openai.com/api-keys',
  },
};

export const PROVIDER_LIST: Provider[] = Object.values(PROVIDERS);

export function getProvider(id: ProviderId): Provider {
  return PROVIDERS[id];
}
