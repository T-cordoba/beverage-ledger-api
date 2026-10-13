import type { Ability, Actor } from './core';

export interface ApiResponse<T = any> {
  status: number;
  headers: Headers;
  body: T;
  raw: Buffer;
}

export interface ApiRequest {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** False sends no Authorization header, which is how a stranger calls. */
  authenticated?: boolean;
}

const MAX_THROTTLED_ATTEMPTS = 4;

/**
 * Talks HTTP to a running API, the way the frontend does: bearer token in the
 * header, JSON in, JSON or bytes out. Keeps the last response for the questions.
 */
export class CallAnApi implements Ability {
  private token: string | undefined;
  private last: ApiResponse | undefined;

  private constructor(private readonly baseUrl: string) {}

  static at(baseUrl: string) {
    return new CallAnApi(baseUrl.replace(/\/$/, ''));
  }

  static as(actor: Actor) {
    return actor.abilityTo(CallAnApi);
  }

  useToken(token: string) {
    this.token = token;
  }

  get lastResponse(): ApiResponse {
    if (!this.last) throw new Error('No request has been sent yet');
    return this.last;
  }

  /** An action the scenario then asserts on: it becomes the last response. */
  async send<T = any>(request: ApiRequest) {
    this.last = await this.request<T>(request);
    return this.last as ApiResponse<T>;
  }

  /**
   * A lookup a question makes on the side. It must succeed, and it leaves the
   * last response alone, as Serenity's LastResponse only follows what was sent.
   */
  async read<T = any>(path: string, query?: ApiRequest['query']): Promise<T> {
    const response = await this.request<T>({ method: 'GET', path, query });
    if (response.status !== 200) {
      throw new Error(
        `GET ${path} answered ${response.status}: ${response.raw.toString('utf8').slice(0, 300)}`,
      );
    }
    return response.body;
  }

  /**
   * The API throttles every IP: 120 requests a minute overall and 10 sign-ins
   * (AUTH_THROTTLE). Six files share one IP, so a 429 is the throttle speaking,
   * not the behaviour under test: wait as Retry-After says and send again.
   */
  private async request<T>(request: ApiRequest): Promise<ApiResponse<T>> {
    for (let attempt = 1; ; attempt += 1) {
      const response = await this.requestOnce<T>(request);
      if (response.status !== 429 || attempt === MAX_THROTTLED_ATTEMPTS) return response;
      const seconds = Number(response.headers.get('retry-after')) || 5;
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    }
  }

  private async requestOnce<T>({ method, path, body, query, authenticated = true }: ApiRequest) {
    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {};
    if (authenticated && this.token) headers.authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';

    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = Buffer.from(await response.arrayBuffer());
    const isJson = response.headers.get('content-type')?.includes('application/json');

    return {
      status: response.status,
      headers: response.headers,
      body: (isJson ? JSON.parse(raw.toString('utf8')) : undefined) as T,
      raw,
    } satisfies ApiResponse<T>;
  }
}

/** Lets an actor remember what one step learned for a later one, like Serenity's TakeNotes. */
export class TakeNotes implements Ability {
  private readonly notes = new Map<string, unknown>();

  static usingAnEmptyNotepad() {
    return new TakeNotes();
  }

  static as(actor: Actor) {
    return actor.abilityTo(TakeNotes);
  }

  set(key: string, value: unknown) {
    this.notes.set(key, value);
  }

  get<T>(key: string): T {
    if (!this.notes.has(key)) throw new Error(`Nothing was noted as "${key}"`);
    return this.notes.get(key) as T;
  }

  has(key: string) {
    return this.notes.has(key);
  }
}
