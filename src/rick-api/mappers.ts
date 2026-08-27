import type {
  CharacterGender,
  CharacterStatus,
  CharacterSummary,
  EpisodeSummary,
  LocationSummary,
  Paginated,
  ResourceRef,
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

const STATUSES: CharacterStatus[] = ['Alive', 'Dead', 'unknown'];
const GENDERS: CharacterGender[] = ['Female', 'Male', 'Genderless', 'unknown'];

export function toCharacterSummary(raw: RawCharacter): CharacterSummary {
  return {
    id: raw.id,
    name: raw.name,
    status: STATUSES.includes(raw.status as CharacterStatus)
      ? (raw.status as CharacterStatus)
      : 'unknown',
    species: raw.species,
    type: raw.type,
    gender: GENDERS.includes(raw.gender as CharacterGender)
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
  raw: RawPaginated<R> | null,
  page: number,
  map: (item: R) => T,
): Paginated<T> {
  if (!raw) {
    return { items: [], page, pages: 0, total: 0, hasNext: false, hasPrev: false };
  }
  return {
    items: raw.results.map(map),
    page,
    pages: raw.info.pages,
    total: raw.info.count,
    hasNext: raw.info.next !== null,
    hasPrev: raw.info.prev !== null,
  };
}
