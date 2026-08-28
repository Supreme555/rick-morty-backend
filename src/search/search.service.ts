import { Injectable } from '@nestjs/common';
import { RickApiService } from '../rick-api/rick-api.service.js';
import {
  toCharacterSummary,
  toEpisodeSummary,
  toLocationSummary,
} from '../rick-api/mappers.js';
import type {
  RawCharacter,
  RawEpisode,
  RawLocation,
  RawPaginated,
} from '../rick-api/raw.types.js';
import type { SearchResult } from '../common/types.js';

const LIMIT_PER_TYPE = 8;

@Injectable()
export class SearchService {
  constructor(private readonly api: RickApiService) {}

  async search(rawQuery: string | undefined): Promise<SearchResult> {
    const query = (rawQuery ?? '').trim();
    if (!query) {
      return {
        query,
        characters: { items: [], total: 0 },
        episodes: { items: [], total: 0 },
        locations: { items: [], total: 0 },
      };
    }

    const [characters, episodes, locations] = await Promise.all([
      this.api.list<RawCharacter>('character', { name: query }),
      this.api.list<RawEpisode>('episode', { name: query }),
      this.api.list<RawLocation>('location', { name: query }),
    ]);

    return {
      query,
      characters: pick(characters, toCharacterSummary),
      episodes: pick(episodes, toEpisodeSummary),
      locations: pick(locations, toLocationSummary),
    };
  }
}

function pick<R, T>(
  raw: RawPaginated<R>,
  map: (r: R) => T,
): { items: T[]; total: number } {
  return {
    items: raw.results.slice(0, LIMIT_PER_TYPE).map(map),
    total: raw.info.count,
  };
}
