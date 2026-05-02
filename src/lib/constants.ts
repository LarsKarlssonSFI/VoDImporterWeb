import type { FilmRowState, FormState } from "./types";

export const DEFAULT_GENRE_OPTIONS = [
  "Action",
  "Biografisk",
  "Dokumentär",
  "Drama",
  "Experiment",
  "Fantasy",
  "Historisk",
  "Komedi",
  "Krig",
  "Kriminal",
  "Musik/Dans",
  "Musikal",
  "Natur",
  "Romantik",
  "Science Fiction",
  "Skräck",
  "Sport",
  "Thriller",
  "Västern",
  "Äventyr",
];

export const DEFAULT_COLLECTION_OPTIONS = [
  "Dagens film",
  "Månadens filmer",
  "Svenska klassiker",
  "Svenska bilder",
  "Redaktionen rekommenderar",
  "Populärt",
  "Kommande",
  "Pärlor ur arkivet",
  "HBTQAI+",
  "Kvinnliga regissörer",
  "Stumfilmer",
  "Journalfilmer",
  "Kortfilmsklassiker",
  "Jan Troell",
  "Konrad Wolf",
  "Věra Chytilová",
  "Jean-Pierre Melville",
  "World Cinema Project",
  "Roland Klick",
  "Peter Weiss",
];

export const DECADE_OPTIONS = [
  "1890 - 1899",
  "1900 - 1909",
  "1910 - 1919",
  "1920 - 1929",
  "1930 - 1939",
  "1940 - 1949",
  "1950 - 1959",
  "1960 - 1969",
  "1970 - 1979",
  "1980 - 1989",
  "1990 - 1999",
  "2000 - 2009",
  "2010 - 2019",
  "2020 - 2029",
];

export const FILM_TYPE_OPTIONS = [
  "Spelfilm",
  "Dokumentär",
  "Barnfilm",
  "Fragment",
  "Konst- & experimentfilm",
  "Stumfilm",
  "Journalfilm",
  "Beställningsfilm",
  "Ungdomsfilm",
  "Amatörfilm",
  "Kortfilm",
  "Långfilm",
  "Reklamfilm",
];

export const LANDSCAPE_OPTIONS = [
  "Blekinge",
  "Bohuslän",
  "Dalarna",
  "Dalsland",
  "Gästrikland",
  "Gotland",
  "Halland",
  "Hälsingland",
  "Härjedalen",
  "Jämtland",
  "Lappland",
  "Medelpad",
  "Norrbotten",
  "Närke",
  "Skåne",
  "Småland",
  "Södermanland",
  "Uppland",
  "Värmland",
  "Västerbotten",
  "Västergötland",
  "Västmanland",
  "Ångermanland",
  "Öland",
  "Östergötland",
  "Stockholm",
];

export function getDecadeOptionForYear(year: number | null) {
  if (typeof year !== "number" || !Number.isInteger(year)) {
    return "";
  }

  const decadeStart = Math.floor(year / 10) * 10;
  const decadeLabel = `${decadeStart} - ${decadeStart + 9}`;
  return DECADE_OPTIONS.includes(decadeLabel) ? decadeLabel : "";
}

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
    key: "filmType",
    label: "Filmtyp",
    value: (row) => row.FilmType.join(";"),
  },
  {
    key: "landscape",
    label: "Plats",
    value: (row) => row.Landscape.join(";"),
  },
  {
    key: "decade",
    label: "Årtionde",
    value: (row) => row.Decade.join(";"),
  },
  {
    key: "otherLabels",
    label: "Övriga labels",
    value: (row) => row.OtherLabels.join(";"),
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
  filmType: [],
  landscape: [],
  decade: [],
  otherLabels: [],
  genres: [],
  description: "",
  collections: [],
  territory: DEFAULT_TERRITORY_OPTIONS[0],
  connectedFilmIds: "",
  connectedCollections: "",
  landscapeAsset: null,
  portraitAsset: null,
});
