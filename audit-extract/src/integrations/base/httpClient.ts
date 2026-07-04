export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  backoffMs?: number;
}

export class IntegrationHttpClient {
  static async request<T = unknown>(
    url: string,
    options: HttpRequestOptions = {}
  ): Promise<{ ok: boolean; data: T | null; status: number; latencyMs: number; error?: string }> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeoutMs = 8000,
      retries = 2,
      backoffMs = 300,
    } = options;

    const startTime = performance.now();
    let attempt = 0;

    while (attempt <= retries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        // Validate URL structure
        new URL(url);

        const fetchOptions: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          signal: controller.signal,
        };

        if (body && method !== 'GET' && method !== 'HEAD') {
          fetchOptions.body = JSON.stringify(body);
        }

        const response = await fetch(url, fetchOptions);
        clearTimeout(timer);
        const latencyMs = Math.round(performance.now() - startTime);

        if (!response.ok) {
          if (attempt <= retries && (response.status === 429 || response.status >= 500)) {
            await new Promise((res) => setTimeout(res, backoffMs * attempt));
            continue;
          }
          return {
            ok: false,
            data: null,
            status: response.status,
            latencyMs,
            error: `HTTP ${response.status}: ${response.statusText}`,
          };
        }

        const text = await response.text();
        let data: T | null = null;
        if (text) {
          try {
            data = JSON.parse(text) as T;
          } catch {
            data = text as unknown as T;
          }
        }

        return {
          ok: true,
          data,
          status: response.status,
          latencyMs,
        };
      } catch (err: unknown) {
        clearTimeout(timer);
        const latencyMs = Math.round(performance.now() - startTime);
        const isAbort = err instanceof Error && err.name === 'AbortError';

        if (attempt <= retries) {
          await new Promise((res) => setTimeout(res, backoffMs * attempt));
          continue;
        }

        return {
          ok: false,
          data: null,
          status: isAbort ? 408 : 500,
          latencyMs,
          error: isAbort ? `Timeout (${timeoutMs}ms) excedido` : (err instanceof Error ? err.message : 'Erro na requisição HTTP'),
        };
      }
    }

    return {
      ok: false,
      data: null,
      status: 500,
      latencyMs: Math.round(performance.now() - startTime),
      error: 'Máximo de tentativas excedido',
    };
  }
}
