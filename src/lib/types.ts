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
  genres: string[];
  images: ExportImage[];
  synopsis: string;
  externalReportingId: string;
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
  id: string;
  landscapeAsset: ImageSelection | null;
  portraitAsset: ImageSelection | null;
};

export type FormState = {
  filmId: string;
  title: string;
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
