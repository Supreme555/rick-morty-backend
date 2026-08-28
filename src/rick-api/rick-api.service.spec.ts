import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadGatewayException,
  GatewayTimeoutException,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MAX_ENTRIES, RickApiService } from './rick-api.service.js';

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('RickApiService', () => {
  let fetchMock: FetchMock;
  let service: RickApiService;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    service = new RickApiService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps upstream 404 on a list to an empty page', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'nothing' }, 404));
    const page = await service.list('character', { name: 'zzz' });
    expect(page.results).toEqual([]);
    expect(page.info.count).toBe(0);
  });

  it('throws NotFound for a missing single resource', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'nothing' }, 404));
    await expect(service.getOne('character', 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('turns a non-JSON 2xx body into 502 instead of a raw SyntaxError', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('<html>maintenance</html>', { status: 200 }),
    );
    await expect(service.getOne('character', 1)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry timeouts', async () => {
    const timeout = new Error('aborted');
    timeout.name = 'TimeoutError';
    fetchMock.mockRejectedValueOnce(timeout);
    await expect(service.getOne('character', 1)).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries network errors and upstream 5xx exactly once', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse({ id: 1, name: 'Rick' }));
    await expect(service.getOne('character', 1)).resolves.toMatchObject({
      name: 'Rick',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock
      .mockResolvedValueOnce(new Response('down', { status: 503 }))
      .mockResolvedValueOnce(new Response('down', { status: 503 }));
    await expect(service.getOne('character', 2)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('serves repeated and concurrent requests from cache / in-flight map', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 1, name: 'Rick' }));
    await Promise.all([
      service.getOne('character', 1),
      service.getOne('character', 1),
    ]);
    await service.getOne('character', 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('wraps a single-id batch response into an array and keeps order', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 7, name: 'solo' }));
    await expect(service.getMany('episode', [7])).resolves.toEqual([
      { id: 7, name: 'solo' },
    ]);
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { id: 2, name: 'b' },
        { id: 1, name: 'a' },
      ]),
    );
    const many = await service.getMany('episode', [1, 2, 1]);
    expect(many.map((x) => x.id)).toEqual([1, 2]);
  });

  it('bounds the cache and evicts the least recently used entry', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(jsonResponse({ id: Number(url.split('/').pop()) })),
    );
    for (let id = 1; id <= CACHE_MAX_ENTRIES + 1; id++) {
      await service.getOne('character', id);
    }
    const cache = (service as unknown as { cache: Map<string, unknown> }).cache;
    const base = 'https://rickandmortyapi.com/api';
    expect(cache.size).toBe(CACHE_MAX_ENTRIES);
    expect([...cache.keys()][0]).toMatch(/\/character\/2$/);

    // Touching id 2 refreshes it; id 1 was evicted, so it is fetched again and
    // pushes out the (now oldest) id 3 - id 2 must survive.
    const before = fetchMock.mock.calls.length;
    await service.getOne('character', 2);
    await service.getOne('character', 1);
    await service.getOne('character', 2);
    expect(fetchMock.mock.calls.length).toBe(before + 1);
    expect(cache.has(`${base}/character/3`)).toBe(false);
  });
});
