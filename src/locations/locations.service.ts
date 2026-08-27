import { Injectable } from '@nestjs/common';
import { RickApiService } from '../rick-api/rick-api.service.js';
import { toCharacterSummary, toLocationSummary, toPaginated } from '../rick-api/mappers.js';
import type { RawCharacter, RawLocation } from '../rick-api/raw.types.js';
import type { LocationDetail, LocationSummary, Paginated } from '../common/types.js';
import type { ListLocationsDto } from './dto/list-locations.dto.js';

@Injectable()
export class LocationsService {
  constructor(private readonly api: RickApiService) {}

  async list(query: ListLocationsDto): Promise<Paginated<LocationSummary>> {
    const { page, ...filters } = query;
    const raw = await this.api.list<RawLocation>('location', { page, ...filters });
    return toPaginated(raw, page, toLocationSummary);
  }

  async getById(id: number): Promise<LocationDetail> {
    const raw = await this.api.getOne<RawLocation>('location', id);
    const summary = toLocationSummary(raw);
    const residents = await this.api.getMany<RawCharacter>('character', summary.residentIds);
    return { ...summary, residents: residents.map(toCharacterSummary) };
  }
}
