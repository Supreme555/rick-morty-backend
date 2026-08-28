import {
  CHARACTER_GENDERS,
  CHARACTER_STATUSES,
  type CharacterGender,
  type CharacterStatus,
  type CharacterSummary,
  type EpisodeSummary,
  type LocationSummary,
  type Paginated,
  type ResourceRef,
} from '../common/types.js';
import type {
  RawCharacter,
  RawEpisode,
  RawLocation,
  RawPaginated,
  RawRef,
} from './raw.types.js';

/** "https://rickandmortyapi.com/api/character/12" -> 12, "" -> null */
export function idFromUrl(url: string): number | null {
  const match = /\/(\d+)\/?$/.exec(url ?? '');
  return match ? Number(match[1]) : null;
}

export function idsFromUrls(urls: string[]): number[] {
  return urls.map(idFromUrl).filter((id): id is number => id !== null);
}

function toRef(ref: RawRef): ResourceRef {
  return { id: idFromUrl(ref.url), name: ref.name };
}

const STATUSES: readonly string[] = CHARACTER_STATUSES;
const GENDERS: readonly string[] = CHARACTER_GENDERS;

export function toCharacterSummary(raw: RawCharacter): CharacterSummary {
  return {
    id: raw.id,
    name: raw.name,
    status: STATUSES.includes(raw.status)
      ? (raw.status as CharacterStatus)
      : 'unknown',
    species: raw.species,
    type: raw.type,
    gender: GENDERS.includes(raw.gender)
      ? (raw.gender as CharacterGender)
      : 'unknown',
    image: raw.image,
    origin: toRef(raw.origin),
    location: toRef(raw.location),
    episodeIds: idsFromUrls(raw.episode),
    created: raw.created,
  };
}

export function toEpisodeSummary(raw: RawEpisode): EpisodeSummary {
  return {
    id: raw.id,
    name: raw.name,
    airDate: raw.air_date,
    episode: raw.episode,
    characterIds: idsFromUrls(raw.characters),
    created: raw.created,
  };
}

export function toLocationSummary(raw: RawLocation): LocationSummary {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    dimension: raw.dimension,
    residentIds: idsFromUrls(raw.residents),
    created: raw.created,
  };
}

export function toPaginated<R, T>(
  raw: RawPaginated<R>,
  page: number,
  map: (item: R) => T,
): Paginated<T> {
  return {
    items: raw.results.map(map),
    page,
    pages: raw.info.pages,
    total: raw.info.count,
    hasNext: raw.info.next !== null,
    hasPrev: raw.info.prev !== null,
  };
}
