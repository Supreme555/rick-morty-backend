export const CHARACTER_STATUSES = ['Alive', 'Dead', 'unknown'] as const;
export const CHARACTER_GENDERS = [
  'Female',
  'Male',
  'Genderless',
  'unknown',
] as const;

export type CharacterStatus = (typeof CHARACTER_STATUSES)[number];
export type CharacterGender = (typeof CHARACTER_GENDERS)[number];

export interface Paginated<T> {
  items: T[];
  page: number;
  pages: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ResourceRef {
  id: number | null;
  name: string;
}

export interface CharacterSummary {
  id: number;
  name: string;
  status: CharacterStatus;
  species: string;
  type: string;
  gender: CharacterGender;
  image: string;
  origin: ResourceRef;
  location: ResourceRef;
  episodeIds: number[];
  created: string;
}

export interface EpisodeSummary {
  id: number;
  name: string;
  airDate: string;
  episode: string;
  characterIds: number[];
  created: string;
}

export interface LocationSummary {
  id: number;
  name: string;
  type: string;
  dimension: string;
  residentIds: number[];
  created: string;
}

export interface CharacterDetail extends CharacterSummary {
  episodes: EpisodeSummary[];
}

export interface EpisodeDetail extends EpisodeSummary {
  characters: CharacterSummary[];
}

export interface LocationDetail extends LocationSummary {
  residents: CharacterSummary[];
}

export interface SearchResult {
  query: string;
  characters: { items: CharacterSummary[]; total: number };
  episodes: { items: EpisodeSummary[]; total: number };
  locations: { items: LocationSummary[]; total: number };
}

export interface AiDescription {
  characterId: number;
  description: string;
  cached: boolean;
  model: string;
  generatedAt: string;
}
