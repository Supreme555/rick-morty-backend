import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { envOr } from '../common/env.js';
import type { RawPaginated } from './raw.types.js';

export type ResourceKind = 'character' | 'episode' | 'location';
export type QueryParams = Record<string, string | number | undefined>;

interface CacheEntry {
  expires: number;
  value: unknown;
}

const DEFAULT_BASE_URL = 'https://rickandmortyapi.com/api';
export const CACHE_TTL_MS = 10 * 60 * 1000;
/** Upper bound on cached URLs; keys include user-typed filters, so this must be finite. */
export const CACHE_MAX_ENTRIES = 500;
export const TIMEOUT_MS = 8_000;
/** Max ids per batch request — keeps URLs short and responses small. */
const BATCH_SIZE = 50;

const EMPTY_PAGE: RawPaginated<never> = {
  info: { count: 0, pages: 0, next: null, prev: null },
  results: [],
};

/** Upstream failure that is worth one more attempt (network blip, 5xx). */
class RetryableUpstreamError extends BadGatewayException {}

/**
 * Thin client over the public Rick and Morty REST API.
 * All upstream calls of the app go through here: bounded in-memory TTL cache
 * (LRU by insertion order), in-flight de-duplication, timeout, one retry for
 * transient failures, and mapping of upstream errors to 502/504.
 */
@Injectable()
export class RickApiService {
  private readonly logger = new Logger(RickApiService.name);
  private readonly baseUrl = envOr('RICK_API_URL', DEFAULT_BASE_URL).replace(
    /\/$/,
    '',
  );
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  /** Paginated list; upstream's 404 for "no matches" becomes an empty page. */
  async list<T>(
    kind: ResourceKind,
    params: QueryParams,
  ): Promise<RawPaginated<T>> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
    const qs = search.toString();
    const page = await this.request<RawPaginated<T>>(
      `/${kind}${qs ? `?${qs}` : ''}`,
    );
    return page ?? EMPTY_PAGE;
  }

  async getOne<T>(kind: ResourceKind, id: number): Promise<T> {
    const item = await this.request<T>(`/${kind}/${id}`);
    if (item === null) {
      throw new NotFoundException(`${capitalize(kind)} ${id} not found`);
    }
    return item;
  }

  /** Fetch many by id, preserving the requested order; missing ids are dropped. */
  async getMany<T extends { id: number }>(
    kind: ResourceKind,
    ids: number[],
  ): Promise<T[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];

    const chunks: number[][] = [];
    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      chunks.push(unique.slice(i, i + BATCH_SIZE));
    }

    const results = await Promise.all(
      chunks.map(async (chunk) => {
        // Upstream returns an object for a single id and an array for several.
        const data = await this.request<T | T[]>(`/${kind}/${chunk.join(',')}`);
        if (data === null) return [];
        return Array.isArray(data) ? data : [data];
      }),
    );

    const byId = new Map(results.flat().map((item) => [item.id, item]));
    return unique
      .map((id) => byId.get(id))
      .filter((x): x is T => x !== undefined);
  }

  /** Cached + de-duplicated GET. Resolves to `null` when upstream answers 404. */
  private request<T>(path: string): Promise<T | null> {
    const url = `${this.baseUrl}${path}`;

    const cached = this.cache.get(url);
    if (cached) {
      if (cached.expires > Date.now()) {
        // Refresh LRU position.
        this.cache.delete(url);
        this.cache.set(url, cached);
        return Promise.resolve(cached.value as T | null);
      }
      this.cache.delete(url);
    }

    const pending = this.inflight.get(url);
    if (pending) return pending as Promise<T | null>;

    const task = this.fetchWithRetry<T>(url)
      .then((value) => {
        this.store(url, value);
        return value;
      })
      .finally(() => this.inflight.delete(url));

    this.inflight.set(url, task);
    return task;
  }

  private store(url: string, value: unknown): void {
    this.cache.set(url, { value, expires: Date.now() + CACHE_TTL_MS });
    if (this.cache.size <= CACHE_MAX_ENTRIES) return;

    // Over capacity: drop expired entries first, then the least recently used.
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expires <= now) this.cache.delete(key);
    }
    while (this.cache.size > CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
  }

  private async fetchWithRetry<T>(url: string): Promise<T | null> {
    try {
      return await this.fetchOnce<T>(url);
    } catch (error) {
      // Only transient failures are retried: timeouts would just double the wait.
      if (!(error instanceof RetryableUpstreamError)) throw error;
      this.logger.warn(`Retrying ${url}: ${error.message}`);
      return this.fetchOnce<T>(url);
    }
  }

  private async fetchOnce<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: 'application/json' },
      });

      if (response.status === 404) return null;
      if (response.status >= 500) {
        throw new RetryableUpstreamError(
          `Upstream API responded with ${response.status}`,
        );
      }
      if (!response.ok) {
        throw new BadGatewayException(
          `Upstream API responded with ${response.status}`,
        );
      }
      // Body is read inside the try: a timeout can fire mid-stream and the body
      // may not be JSON at all (e.g. an HTML error page from a proxy).
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      if ((error as Error).name === 'TimeoutError') {
        throw new GatewayTimeoutException('Upstream API timed out');
      }
      if (error instanceof SyntaxError) {
        throw new BadGatewayException('Upstream API returned malformed JSON');
      }
      throw new RetryableUpstreamError('Upstream API is unreachable');
    }
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
