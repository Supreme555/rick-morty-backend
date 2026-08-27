/** Shapes returned by https://rickandmortyapi.com/api */
export interface RawInfo {
  count: number;
  pages: number;
  next: string | null;
  prev: string | null;
}

export interface RawPaginated<T> {
  info: RawInfo;
  results: T[];
}

export interface RawRef {
  name: string;
  url: string;
}

export interface RawCharacter {
  id: number;
  name: string;
  status: string;
  species: string;
  type: string;
  gender: string;
  origin: RawRef;
  location: RawRef;
  image: string;
  episode: string[];
  url: string;
  created: string;
}

export interface RawEpisode {
  id: number;
  name: string;
  air_date: string;
  episode: string;
  characters: string[];
  url: string;
  created: string;
}

export interface RawLocation {
  id: number;
  name: string;
  type: string;
  dimension: string;
  residents: string[];
  url: string;
  created: string;
}
