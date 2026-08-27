import { describe, expect, it } from 'vitest';
import { idFromUrl, toCharacterSummary, toPaginated, toEpisodeSummary } from './mappers.js';
import type { RawCharacter, RawEpisode } from './raw.types.js';

const rick: RawCharacter = {
  id: 1,
  name: 'Rick Sanchez',
  status: 'Alive',
  species: 'Human',
  type: '',
  gender: 'Male',
  origin: { name: 'Earth (C-137)', url: 'https://rickandmortyapi.com/api/location/1' },
  location: { name: 'unknown', url: '' },
  image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg',
  episode: [
    'https://rickandmortyapi.com/api/episode/1',
    'https://rickandmortyapi.com/api/episode/2',
  ],
  url: 'https://rickandmortyapi.com/api/character/1',
  created: '2017-11-04T18:48:46.250Z',
};

describe('idFromUrl', () => {
  it('extracts trailing numeric id', () => {
    expect(idFromUrl('https://rickandmortyapi.com/api/location/12')).toBe(12);
  });
  it('returns null for empty/unknown links', () => {
    expect(idFromUrl('')).toBeNull();
    expect(idFromUrl('https://rickandmortyapi.com/api/location/')).toBeNull();
  });
});

describe('toCharacterSummary', () => {
  it('maps refs and episode ids', () => {
    const c = toCharacterSummary(rick);
    expect(c.origin).toEqual({ id: 1, name: 'Earth (C-137)' });
    expect(c.location).toEqual({ id: null, name: 'unknown' });
    expect(c.episodeIds).toEqual([1, 2]);
    expect(c.status).toBe('Alive');
  });
  it('normalises unexpected status/gender to "unknown"', () => {
    const c = toCharacterSummary({ ...rick, status: 'Weird', gender: 'Other' });
    expect(c.status).toBe('unknown');
    expect(c.gender).toBe('unknown');
  });
});

describe('toEpisodeSummary', () => {
  it('renames air_date and maps character ids', () => {
    const raw: RawEpisode = {
      id: 1,
      name: 'Pilot',
      air_date: 'December 2, 2013',
      episode: 'S01E01',
      characters: ['https://rickandmortyapi.com/api/character/1'],
      url: '',
      created: '',
    };
    expect(toEpisodeSummary(raw)).toMatchObject({ airDate: 'December 2, 2013', characterIds: [1] });
  });
});

describe('toPaginated', () => {
  it('returns an empty page for upstream 404 (null)', () => {
    expect(toPaginated(null, 3, (x) => x)).toEqual({
      items: [],
      page: 3,
      pages: 0,
      total: 0,
      hasNext: false,
      hasPrev: false,
    });
  });
  it('derives hasNext/hasPrev from info links', () => {
    const page = toPaginated(
      { info: { count: 826, pages: 42, next: 'x', prev: null }, results: [rick] },
      1,
      toCharacterSummary,
    );
    expect(page).toMatchObject({ pages: 42, total: 826, hasNext: true, hasPrev: false });
    expect(page.items[0].name).toBe('Rick Sanchez');
  });
});
