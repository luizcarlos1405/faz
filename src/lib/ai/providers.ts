export type Protocol = 'openai' | 'anthropic';

export type ProviderId = 'zai' | 'openai' | 'anthropic' | 'groq' | 'openrouter';

export interface Provider {
  id: ProviderId;
  label: string;
  protocol: Protocol;
  baseUrl: string;
  defaultModel: string;
  browserCompatible: boolean;
  docsUrl: string;
}

export const PROVIDERS: Record<ProviderId, Provider> = {
  zai: {
    id: 'zai',
    label: 'Zhipu GLM',
    protocol: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4.7-flash',
    browserCompatible: true,
    docsUrl: 'https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys',
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-latest',
    browserCompatible: true,
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    protocol: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    browserCompatible: true,
    docsUrl: 'https://console.groq.com/keys',
  },
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    protocol: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o-mini',
    browserCompatible: true,
    docsUrl: 'https://openrouter.ai/keys',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    browserCompatible: false,
    docsUrl: 'https://platform.openai.com/api-keys',
  },
};

export const PROVIDER_LIST: Provider[] = Object.values(PROVIDERS);

export function getProvider(id: ProviderId): Provider {
  return PROVIDERS[id];
}
