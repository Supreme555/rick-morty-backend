import { Injectable } from '@nestjs/common';
import { RickApiService } from '../rick-api/rick-api.service.js';
import {
  toCharacterSummary,
  toEpisodeSummary,
  toPaginated,
} from '../rick-api/mappers.js';
import type { RawCharacter, RawEpisode } from '../rick-api/raw.types.js';
import type {
  CharacterDetail,
  CharacterSummary,
  Paginated,
} from '../common/types.js';
import type { ListCharactersDto } from './dto/list-characters.dto.js';

@Injectable()
export class CharactersService {
  constructor(private readonly api: RickApiService) {}

  async list(query: ListCharactersDto): Promise<Paginated<CharacterSummary>> {
    const { page, ...filters } = query;
    const raw = await this.api.list<RawCharacter>('character', {
      page,
      ...filters,
    });
    return toPaginated(raw, page, toCharacterSummary);
  }

  async getById(id: number): Promise<CharacterDetail> {
    const raw = await this.api.getOne<RawCharacter>('character', id);
    const summary = toCharacterSummary(raw);
    const episodes = await this.api.getMany<RawEpisode>(
      'episode',
      summary.episodeIds,
    );
    return { ...summary, episodes: episodes.map(toEpisodeSummary) };
  }
}
