export type ImageKind = "landscape" | "portrait";

export type CropSettings = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
};

export type ExportImage = {
  type: "poster" | "sixteen-nine";
  filename: string;
};

export type ExportRow = {
  labels: string[];
  kind: "movie";
  title: string;
  customId: string;
  customTags1: string[];
  customTags2: string[];
  cast: string[];
  directors: string[];
  countryWhitelist?: string[];
  countriesOfOrigin?: string[];
  productionYear?: number;
  genres: string[];
  images: ExportImage[];
  synopsis: string;
  externalReportingId: string;
  viewableWindowStart: number;
  viewableWindowEnd?: number;
};

export type ImageSelection = {
  file: File;
  sourceUrl: string;
  crop: CropSettings;
};

export type FilmRowState = {
  FilmID: number;
  PublicationStart: string;
  PublicationEnd: string;
  IsFree: boolean;
  Territory: string;
  Labels: string[];
  Genres: string[];
  Description: string;
  Collections: string[];
  ConnectedFilmIDs: number[];
  ConnectedCollections: string[];
  LandscapeImage: string;
  PortraitImage: string;
  Title: string;
  OriginalTitle: string;
  DialogueLanguages: string[];
  Cast: string[];
  Directors: string[];
  CountryOfOrigin: string;
  PremiereYear: number | null;
  id: string;
  landscapeAsset: ImageSelection | null;
  portraitAsset: ImageSelection | null;
};

export type FormState = {
  filmId: string;
  title: string;
  originalTitle: string;
  dialogueLanguages: string[];
  cast: string[];
  directors: string[];
  countryOfOrigin: string;
  premiereYear: string;
  publicationStart: string;
  publicationEnd: string;
  isFree: boolean;
  territory: string;
  labels: string[];
  genres: string[];
  description: string;
  collections: string[];
  connectedFilmIds: string;
  connectedCollections: string;
  landscapeAsset: ImageSelection | null;
  portraitAsset: ImageSelection | null;
};

export type CropPreviewState = {
  selection: ImageSelection;
  imageKind: ImageKind;
  title: string;
} | null;

export type WorkbookImportRow = {
  filmId: number;
  publicationStart?: string;
  publicationEnd?: string;
  isFree?: boolean;
  territory: string;
  labels?: string[];
  genres?: string[];
  description?: string;
  collections?: string[];
};
