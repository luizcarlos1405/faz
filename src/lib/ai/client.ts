import type { Provider } from './providers';

export type ChatErrorKind = 'auth' | 'rate' | 'cors' | 'network' | 'http';

export class ChatError extends Error {
  kind: ChatErrorKind;
  status?: number;
  constructor(kind: ChatErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'ChatError';
    this.kind = kind;
    this.status = status;
  }
}

export function assertOk(response: Response, provider: Provider): void {
  if (response.ok) return;
  if (response.status === 401) {
    throw new ChatError('auth', `Invalid API key for ${provider.label}.`);
  }
  if (response.status === 429) {
    throw new ChatError('rate', `${provider.label} is rate limiting. Try again shortly.`);
  }
  throw new ChatError(
    'http',
    `${provider.label} returned an error (${response.status}).`,
    response.status,
  );
}
