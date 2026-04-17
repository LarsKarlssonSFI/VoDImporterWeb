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
  "Skräck",
  "Spänning",
  "Thriller",
  "Ungdomsfilm",
];

export const DEFAULT_COLLECTION_OPTIONS = [
  "Jan Troell", 
  "30 dagar", 
  "Svenska bilder",
  "Merchant-Ivory-Jhabvala",
  "Konrad Wolf",
  "Roberto Rossellini",
  "Sverige 80"
];

export const DEFAULT_LABEL_OPTIONS = [
  "Spelfilm",
  "Beställningsfilm",
  "80-tal"
];

export const DEFAULT_TERRITORY_OPTIONS = ["Sverige", "Danmark", "Finland", "Norge", "Norden"];

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
    key: "title",
    label: "Titel",
    value: (row) => row.Title,
  },
  {
    key: "originalTitle",
    label: "Originaltitel",
    value: (row) => row.OriginalTitle,
  },
  {
    key: "dialogueLanguages",
    label: "Dialogspråk",
    value: (row) => row.DialogueLanguages.join("; "),
  },
  {
    key: "cast",
    label: "Skådespelare",
    value: (row) => row.Cast.join("; "),
  },
  {
    key: "directors",
    label: "Regissörer",
    value: (row) => row.Directors.join("; "),
  },
  {
    key: "countryOfOrigin",
    label: "Produktionsland",
    value: (row) => row.CountryOfOrigin,
  },
  {
    key: "premiereYear",
    label: "Premiärår",
    value: (row) => (row.PremiereYear ? String(row.PremiereYear) : ""),
  },
  {
    key: "publicationStart",
    label: "Start",
    value: (row) => row.PublicationStart,
  },
  {
    key: "publicationEnd",
    label: "Slut",
    value: (row) => row.PublicationEnd,
  },
  {
    key: "labels",
    label: "Labels",
    value: (row) => row.Labels.join(";"),
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
    key: "isFree",
    label: "Gratis",
    value: (row) => (row.IsFree ? "✔" : ""),
  },
  {
    key: "landscapeImage",
    label: "H-bild",
    value: (row) => (row.LandscapeImage ? "✔" : ""),
  },
  {
    key: "portraitImage",
    label: "V-bild",
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
  title: "",
  originalTitle: "",
  dialogueLanguages: [],
  cast: [],
  directors: [],
  countryOfOrigin: "",
  premiereYear: "",
  publicationStart: "2026-05-04",
  publicationEnd: "",
  isFree: true,
  labels: [],
  genres: [],
  description: "",
  collections: [],
  territory: DEFAULT_TERRITORY_OPTIONS[0],
  connectedFilmIds: "",
  connectedCollections: "",
  landscapeAsset: null,
  portraitAsset: null,
});
