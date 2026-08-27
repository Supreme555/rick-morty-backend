import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { RawPaginated } from './raw.types.js';

export type ResourceKind = 'character' | 'episode' | 'location';
export type QueryParams = Record<string, string | number | undefined>;

interface CacheEntry {
  expires: number;
  value: unknown;
}

const DEFAULT_BASE_URL = 'https://rickandmortyapi.com/api';
const CACHE_TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 8_000;
/** Max ids per batch request — keeps URLs short and responses small. */
const BATCH_SIZE = 50;

/**
 * Thin client over the public Rick and Morty REST API.
 * All upstream calls of the app go through here: in-memory TTL cache,
 * in-flight de-duplication, timeout, one retry, and upstream-error mapping.
 */
@Injectable()
export class RickApiService {
  private readonly logger = new Logger(RickApiService.name);
  private readonly baseUrl = (process.env.RICK_API_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inflight = new Map<string, Promise<unknown>>();

  /** Paginated list; `null` when upstream has nothing for these filters (its 404). */
  list<T>(kind: ResourceKind, params: QueryParams): Promise<RawPaginated<T> | null> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') search.set(key, String(value));
    }
    const qs = search.toString();
    return this.request<RawPaginated<T>>(`/${kind}${qs ? `?${qs}` : ''}`, true);
  }

  async getOne<T>(kind: ResourceKind, id: number): Promise<T> {
    const item = await this.request<T>(`/${kind}/${id}`, true);
    if (!item) {
      throw new NotFoundException(`${capitalize(kind)} ${id} not found`);
    }
    return item;
  }

  /** Fetch many by id, preserving the requested order; missing ids are dropped. */
  async getMany<T extends { id: number }>(kind: ResourceKind, ids: number[]): Promise<T[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];

    const chunks: number[][] = [];
    for (let i = 0; i < unique.length; i += BATCH_SIZE) {
      chunks.push(unique.slice(i, i + BATCH_SIZE));
    }

    const results = await Promise.all(
      chunks.map(async (chunk) => {
        // Upstream returns an object for a single id and an array for several.
        const data = await this.request<T | T[]>(`/${kind}/${chunk.join(',')}`, true);
        if (!data) return [];
        return Array.isArray(data) ? data : [data];
      }),
    );

    const byId = new Map(results.flat().map((item) => [item.id, item]));
    return unique.map((id) => byId.get(id)).filter((x): x is T => x !== undefined);
  }

  private request<T>(path: string, allow404: boolean): Promise<T | null> {
    const url = `${this.baseUrl}${path}`;

    const cached = this.cache.get(url);
    if (cached && cached.expires > Date.now()) {
      return Promise.resolve(cached.value as T | null);
    }

    const pending = this.inflight.get(url);
    if (pending) return pending as Promise<T | null>;

    const task = this.fetchWithRetry<T>(url, allow404)
      .then((value) => {
        this.cache.set(url, { value, expires: Date.now() + CACHE_TTL_MS });
        return value;
      })
      .finally(() => this.inflight.delete(url));

    this.inflight.set(url, task);
    return task;
  }

  private async fetchWithRetry<T>(url: string, allow404: boolean): Promise<T | null> {
    try {
      return await this.fetchOnce<T>(url, allow404);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.warn(`Retrying ${url}: ${(error as Error).message}`);
      return this.fetchOnce<T>(url, allow404);
    }
  }

  private async fetchOnce<T>(url: string, allow404: boolean): Promise<T | null> {
    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: 'application/json' },
      });
    } catch (error) {
      if ((error as Error).name === 'TimeoutError') {
        throw new GatewayTimeoutException('Upstream API timed out');
      }
      throw new BadGatewayException('Upstream API is unreachable');
    }

    if (response.status === 404) {
      if (allow404) return null;
      throw new NotFoundException('Not found');
    }
    if (!response.ok) {
      throw new BadGatewayException(`Upstream API responded with ${response.status}`);
    }
    return (await response.json()) as T;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
