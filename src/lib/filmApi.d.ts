export type FilmApiValue = string | number | boolean | null | FilmApiObject | FilmApiValue[];

export interface FilmApiObject {
  [key: string]: FilmApiValue;
}

export interface FilmApiResult {
  title: string | null;
  payload: FilmApiObject | null;
  url: string;
  error?: string;
}

export interface FilmApiResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type FilmApiFetch = (
  input: string,
  init?: {
    headers?: Record<string, string>;
  },
) => Promise<FilmApiResponse>;

export function parseFilmApiPayload(payload: unknown): FilmApiObject | null;

export function extractFilmTitle(payload: unknown): string | null;

export function buildFilmApiUrl(
  baseUrl: string,
  filmId: string,
  username: string,
  password: string,
): string;

export function buildFilmApiCandidateUrls(
  baseUrl: string,
  filmId: string,
  username: string,
  password: string,
): string[];

export function fetchFilmApiTitle(
  fetchImpl: FilmApiFetch,
  baseUrl: string,
  filmId: string,
  username: string,
  password: string,
): Promise<FilmApiResult>;
