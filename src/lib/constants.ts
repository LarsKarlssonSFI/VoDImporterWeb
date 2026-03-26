import type { FilmRowState, FormState } from "./types";

export const DEFAULT_GENRE_OPTIONS = [
  "Action",
  "Barnfilm",
  "Dokumentar",
  "Drama",
  "Familj",
  "Komedi",
  "Kortfilm",
  "Romantik",
  "Skrack",
  "Spanning",
  "Thriller",
  "Ungdomsfilm",
];

export const DEFAULT_COLLECTION_OPTIONS = [
  "Arkiv",
  "Free",
  "Klassiker",
  "Nypremiar",
  "Restaurerad",
  "Temasamling",
];

export const TERRITORY_OPTIONS = ["Sweden", "Denmark", "Finland", "Norway", "Nordics"];

export type TableColumn = {
  key: string;
  label: string;
  value: (row: FilmRowState) => string;
};

export const TABLE_COLUMNS: TableColumn[] = [
  {
    key: "filmId",
    label: "FilmID",
    value: (row) => String(row.FilmID),
  },
  {
    key: "publicationStart",
    label: "PublicationStart",
    value: (row) => row.PublicationStart,
  },
  {
    key: "publicationEnd",
    label: "PublicationEnd",
    value: (row) => row.PublicationEnd,
  },
  {
    key: "isFree",
    label: "IsFree",
    value: (row) => (row.IsFree ? "✔" : ""),
  },
  {
    key: "genres",
    label: "Genres",
    value: (row) => row.Genres.join(";"),
  },
  {
    key: "collections",
    label: "Collections",
    value: (row) => row.Collections.join(";"),
  },
  {
    key: "landscapeImage",
    label: "H-Image",
    value: (row) => (row.LandscapeImage ? "✔" : ""),
  },
  {
    key: "portraitImage",
    label: "V-Image",
    value: (row) => (row.PortraitImage ? "✔" : ""),
  },
//  {
//    key: "territory",
//    label: "Territory",
//    value: (row) => row.Territory,
//  },
//  {
//    key: "description",
//    label: "Description",
//    value: (row) => row.Description,
//  },
] as const;

export const LANDSCAPE_ASPECT_RATIO = 16 / 9;
export const PORTRAIT_ASPECT_RATIO = 9 / 16;
export const OPTIONS_STORAGE_KEY = "cineplay-importer-options";
export const ROWS_STORAGE_KEY = "cineplay-importer-rows";
export const EXPORT_BASENAME = "cineplay_export";

export const createEmptyForm = (): FormState => ({
  filmId: "",
  publicationStart: "2026-05-04",
  publicationEnd: "",
  isFree: true,
  genres: [],
  description: "",
  collections: [],
  territory: TERRITORY_OPTIONS[0],
  connectedFilmIds: "",
  connectedCollections: "",
  landscapeAsset: null,
  portraitAsset: null,
});
