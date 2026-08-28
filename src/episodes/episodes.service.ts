import { Injectable } from '@nestjs/common';
import { RickApiService } from '../rick-api/rick-api.service.js';
import {
  toCharacterSummary,
  toEpisodeSummary,
  toPaginated,
} from '../rick-api/mappers.js';
import type { RawCharacter, RawEpisode } from '../rick-api/raw.types.js';
import type {
  EpisodeDetail,
  EpisodeSummary,
  Paginated,
} from '../common/types.js';
import type { ListEpisodesDto } from './dto/list-episodes.dto.js';

@Injectable()
export class EpisodesService {
  constructor(private readonly api: RickApiService) {}

  async list(query: ListEpisodesDto): Promise<Paginated<EpisodeSummary>> {
    const { page, ...filters } = query;
    const raw = await this.api.list<RawEpisode>('episode', {
      page,
      ...filters,
    });
    return toPaginated(raw, page, toEpisodeSummary);
  }

  async getById(id: number): Promise<EpisodeDetail> {
    const raw = await this.api.getOne<RawEpisode>('episode', id);
    const summary = toEpisodeSummary(raw);
    const characters = await this.api.getMany<RawCharacter>(
      'character',
      summary.characterIds,
    );
    return { ...summary, characters: characters.map(toCharacterSummary) };
  }
}
