import JSZip from "jszip";
import * as XLSX from "xlsx";
import {
  DECADE_OPTIONS,
  EXPORT_BASENAME,
  FILM_TYPE_OPTIONS,
  getDecadeOptionForYear,
  LANDSCAPE_ASPECT_RATIO,
  LANDSCAPE_OPTIONS,
  OPTIONS_STORAGE_KEY,
  PORTRAIT_ASPECT_RATIO,
  ROWS_STORAGE_KEY,
} from "./constants";
import type {
  CropSettings,
  ExportRow,
  FilmRowState,
  FormState,
  ImageKind,
  ImageSelection,
  WorkbookImportRow,
} from "./types";

const imageLoadCache = new WeakMap<File, Promise<HTMLImageElement>>();

type StoredOptions = {
  labels?: string[];
  genres?: string[];
  collections?: string[];
  territories?: string[];
};

type StoredImageSelection = {
  name: string;
  type: string;
  dataUrl: string;
  crop: CropSettings;
};

type StoredRow = Omit<FilmRowState, "landscapeAsset" | "portraitAsset"> & {
  landscapeAsset: StoredImageSelection | null;
  portraitAsset: StoredImageSelection | null;
};

function getLegacyLabels(row: StoredRow) {
  if (Array.isArray((row as StoredRow & { Labels?: unknown }).Labels)) {
    return (row as StoredRow & { Labels?: unknown[] }).Labels?.filter((value): value is string => typeof value === "string") ?? [];
  }

  if (
    typeof (row as StoredRow & { Labels?: unknown }).Labels === "string" &&
    (row as StoredRow & { Labels?: string }).Labels?.trim()
  ) {
    return [(row as StoredRow & { Labels?: string }).Labels!.trim()];
  }

  return [];
}

function normalizeOptionValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function getFilmTypeOption(value: string) {
  const normalized = normalizeOptionValue(value);
  if (!normalized) {
    return "";
  }

  return FILM_TYPE_OPTIONS.find((option) => normalizeOptionValue(option) === normalized) ?? "";
}

function getLandscapeOption(value: string) {
  const normalized = normalizeOptionValue(value);
  if (!normalized) {
    return "";
  }

  return LANDSCAPE_OPTIONS.find((option) => normalizeOptionValue(option) === normalized) ?? "";
}

function getDecadeOption(value: string) {
  const normalized = normalizeOptionValue(value);
  if (!normalized) {
    return "";
  }

  return DECADE_OPTIONS.find((option) => normalizeOptionValue(option) === normalized) ?? "";
}

export const DEFAULT_CROP_SETTINGS: CropSettings = {
  zoom: 1.15,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  paddingLeft: 0,
  paddingRight: 0,
  paddingTop: 0,
  paddingBottom: 0,
};

export function parseSemicolonList(rawValue: string): string[] {
  return rawValue
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseIntList(rawValue: string): number[] {
  return parseSemicolonList(rawValue).map((item) => {
    const value = Number(item);
    if (!Number.isInteger(value)) {
      throw new Error(`Ogiltigt ConnectedFilmID: ${item}`);
    }
    return value;
  });
}

export function cleanOptionList(values: string[], fallback: string[]): string[] {
  const cleaned = values
    .map((value) => value.trim())
    .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
  return cleaned.length > 0 ? cleaned : fallback;
}

export function loadStoredOptions(
  defaultLabels: string[],
  defaultGenres: string[],
  defaultCollections: string[],
  defaultTerritories: string[],
) {
  try {
    const raw = window.localStorage.getItem(OPTIONS_STORAGE_KEY);
    if (!raw) {
      return {
        labels: defaultLabels,
        genres: defaultGenres,
        collections: defaultCollections,
        territories: defaultTerritories,
      };
    }

    const parsed = JSON.parse(raw) as StoredOptions;
    return {
      labels: cleanOptionList(parsed.labels ?? defaultLabels, defaultLabels),
      genres: cleanOptionList(parsed.genres ?? defaultGenres, defaultGenres),
      collections: cleanOptionList(parsed.collections ?? defaultCollections, defaultCollections),
      territories: cleanOptionList(parsed.territories ?? defaultTerritories, defaultTerritories),
    };
  } catch {
    return {
      labels: defaultLabels,
      genres: defaultGenres,
      collections: defaultCollections,
      territories: defaultTerritories,
    };
  }
}

export function saveStoredOptions(
  labels: string[],
  genres: string[],
  collections: string[],
  territories: string[],
) {
  window.localStorage.setItem(
    OPTIONS_STORAGE_KEY,
    JSON.stringify({
      labels,
      genres,
      collections,
      territories,
    }),
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error(`Kunde inte serialisera ${file.name}.`));
    };
    reader.onerror = () => reject(new Error(`Kunde inte läsa ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function dataUrlToFile(dataUrl: string, name: string, type: string) {
  const [header, base64Payload] = dataUrl.split(",", 2);
  if (!header || !base64Payload) {
    throw new Error(`Ogiltig bilddata för ${name}.`);
  }
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] || type || "application/octet-stream";
  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], name, { type: mimeType });
}

async function serializeImageSelection(selection: ImageSelection | null): Promise<StoredImageSelection | null> {
  if (!selection) {
    return null;
  }
  return {
    name: selection.file.name,
    type: selection.file.type,
    dataUrl: await fileToDataUrl(selection.file),
    crop: normalizeCropSettings(selection.crop),
  };
}

function deserializeImageSelection(selection: StoredImageSelection | null): ImageSelection | null {
  if (!selection) {
    return null;
  }
  const file = dataUrlToFile(selection.dataUrl, selection.name, selection.type);
  return {
    file,
    sourceUrl: toObjectUrl(file),
    crop: normalizeCropSettings(selection.crop),
  };
}

export async function saveStoredRows(rows: FilmRowState[]) {
  const serializedRows: StoredRow[] = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      landscapeAsset: await serializeImageSelection(row.landscapeAsset),
      portraitAsset: await serializeImageSelection(row.portraitAsset),
    })),
  );

  window.localStorage.setItem(ROWS_STORAGE_KEY, JSON.stringify(serializedRows));
}

export function loadStoredRows(): FilmRowState[] {
  try {
    const raw = window.localStorage.getItem(ROWS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as StoredRow[];
    return parsed.map((row) => {
      const legacyLabels = getLegacyLabels(row);
      const premiereYear =
        typeof (row as StoredRow & { PremiereYear?: unknown }).PremiereYear === "number" &&
        Number.isInteger((row as StoredRow & { PremiereYear?: number }).PremiereYear)
          ? (row as StoredRow & { PremiereYear?: number }).PremiereYear ?? null
          : null;
      const rawDecade: unknown = (row as Record<string, unknown>).Decade;
      const explicitDecade: string[] = Array.isArray(rawDecade)
        ? rawDecade.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter(Boolean)
        : typeof rawDecade === "string" && rawDecade.trim()
          ? [rawDecade.trim()]
          : [];
      const inferredLegacyDecade: string[] = legacyLabels
        .map((label) => label.trim())
        .filter((label) => DECADE_OPTIONS.includes(label));
      const rawFilmType: unknown = (row as Record<string, unknown>).FilmType;
      const explicitFilmType: string[] = Array.isArray(rawFilmType)
        ? rawFilmType
            .filter((value): value is string => typeof value === "string")
            .map((value) => getFilmTypeOption(value))
            .filter(Boolean)
        : typeof rawFilmType === "string" && getFilmTypeOption(rawFilmType)
          ? [getFilmTypeOption(rawFilmType)]
          : [];
      const inferredLegacyFilmType: string[] = legacyLabels.map(getFilmTypeOption).filter(Boolean);
      const rawLandscape: unknown = (row as Record<string, unknown>).Landscape;
      const explicitLandscape: string[] = Array.isArray(rawLandscape)
        ? rawLandscape
            .filter((value): value is string => typeof value === "string")
            .map((value) => getLandscapeOption(value))
            .filter(Boolean)
        : typeof rawLandscape === "string" && getLandscapeOption(rawLandscape)
          ? [getLandscapeOption(rawLandscape)]
          : [];
      const inferredLegacyLandscape: string[] = legacyLabels.map(getLandscapeOption).filter(Boolean);

      return {
        ...row,
        Title: typeof row.Title === "string" ? row.Title : "",
        OriginalTitle:
          typeof (row as StoredRow & { OriginalTitle?: unknown }).OriginalTitle === "string"
            ? ((row as StoredRow & { OriginalTitle?: string }).OriginalTitle ?? "")
            : "",
        DialogueLanguages: Array.isArray((row as StoredRow & { DialogueLanguages?: unknown }).DialogueLanguages)
          ? (row as StoredRow & { DialogueLanguages?: unknown[] }).DialogueLanguages?.filter(
              (value): value is string => typeof value === "string",
            ) ?? []
          : [],
        Cast: Array.isArray((row as StoredRow & { Cast?: unknown }).Cast)
          ? (row as StoredRow & { Cast?: unknown[] }).Cast?.filter((value): value is string => typeof value === "string") ?? []
          : [],
        Directors: Array.isArray((row as StoredRow & { Directors?: unknown }).Directors)
          ? (row as StoredRow & { Directors?: unknown[] }).Directors?.filter(
              (value): value is string => typeof value === "string",
            ) ?? []
          : [],
        CountryOfOrigin:
          typeof (row as StoredRow & { CountryOfOrigin?: unknown }).CountryOfOrigin === "string"
            ? ((row as StoredRow & { CountryOfOrigin?: string }).CountryOfOrigin ?? "")
            : "",
        PremiereYear: premiereYear,
        FilmType: explicitFilmType.length > 0 ? explicitFilmType : inferredLegacyFilmType,
        Landscape: explicitLandscape.length > 0 ? explicitLandscape : inferredLegacyLandscape,
        Decade: (() => {
          if (explicitDecade.length > 0) return explicitDecade;
          if (inferredLegacyDecade.length > 0) return inferredLegacyDecade;
          const derived = getDecadeOptionForYear(premiereYear);
          return derived ? [derived] : [];
        })(),
        OtherLabels: Array.isArray((row as StoredRow & { OtherLabels?: unknown }).OtherLabels)
          ? (row as StoredRow & { OtherLabels?: unknown[] }).OtherLabels?.filter(
              (value): value is string => typeof value === "string",
            ) ?? []
          : [],
        landscapeAsset: deserializeImageSelection(row.landscapeAsset),
        portraitAsset: deserializeImageSelection(row.portraitAsset),
      };
    });
  } catch {
    return [];
  }
}

export function toObjectUrl(file: File): string {
  return URL.createObjectURL(file);
}

export function createImageSelection(file: File): ImageSelection {
  return {
    file,
    sourceUrl: toObjectUrl(file),
    crop: { ...DEFAULT_CROP_SETTINGS },
  };
}

export function cloneImageSelection(selection: ImageSelection | null): ImageSelection | null {
  if (!selection) {
    return null;
  }
  return {
    file: selection.file,
    sourceUrl: toObjectUrl(selection.file),
    crop: { ...selection.crop },
  };
}

export function revokeImageSelection(selection: ImageSelection | null) {
  if (selection) {
    URL.revokeObjectURL(selection.sourceUrl);
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const cached = imageLoadCache.get(file);
  if (cached) {
    return cached;
  }

  const next = new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Kunde inte läsa bilden ${file.name}.`));
    };
    image.src = url;
  });

  imageLoadCache.set(file, next);
  return next;
}

export function getTargetAspectRatio(imageKind: ImageKind) {
  return imageKind === "landscape" ? LANDSCAPE_ASPECT_RATIO : PORTRAIT_ASPECT_RATIO;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeCropSettings(crop?: CropSettings): CropSettings {
  const paddingLeft = clamp(crop?.paddingLeft ?? DEFAULT_CROP_SETTINGS.paddingLeft, 0, 0.35);
  const paddingRight = clamp(crop?.paddingRight ?? DEFAULT_CROP_SETTINGS.paddingRight, 0, 0.35);
  const paddingTop = clamp(crop?.paddingTop ?? DEFAULT_CROP_SETTINGS.paddingTop, 0, 0.35);
  const paddingBottom = clamp(crop?.paddingBottom ?? DEFAULT_CROP_SETTINGS.paddingBottom, 0, 0.35);

  return {
    zoom: clamp(crop?.zoom ?? DEFAULT_CROP_SETTINGS.zoom, 0.25, 3),
    offsetX: clamp(crop?.offsetX ?? DEFAULT_CROP_SETTINGS.offsetX, -1, 1),
    offsetY: clamp(crop?.offsetY ?? DEFAULT_CROP_SETTINGS.offsetY, -1, 1),
    rotation: clamp(crop?.rotation ?? DEFAULT_CROP_SETTINGS.rotation, -180, 180),
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
  };
}

export function getCenterCropBox(width: number, height: number, targetRatio: number) {
  const currentRatio = width / height;
  let cropWidth = width;
  let cropHeight = height;

  if (currentRatio > targetRatio) {
    cropWidth = Math.round(height * targetRatio);
  } else {
    cropHeight = Math.round(width / targetRatio);
  }

  const left = Math.max(Math.floor((width - cropWidth) / 2), 0);
  const top = Math.max(Math.floor((height - cropHeight) / 2), 0);
  const right = Math.min(left + cropWidth, width);
  const bottom = Math.min(top + cropHeight, height);
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function getAdjustedCropBox(width: number, height: number, imageKind: ImageKind, crop?: CropSettings) {
  const baseCrop = getCenterCropBox(width, height, getTargetAspectRatio(imageKind));
  const normalizedCrop = normalizeCropSettings(crop);
  const cropWidth = Math.max(Math.round(baseCrop.width / normalizedCrop.zoom), 1);
  const cropHeight = Math.max(Math.round(baseCrop.height / normalizedCrop.zoom), 1);
  const maxLeft = Math.max(width - cropWidth, 0);
  const maxTop = Math.max(height - cropHeight, 0);
  const left = Math.round(((-normalizedCrop.offsetX + 1) / 2) * maxLeft);
  const top = Math.round(((normalizedCrop.offsetY + 1) / 2) * maxTop);

  return {
    left,
    top,
    width: cropWidth,
    height: cropHeight,
    right: left + cropWidth,
    bottom: top + cropHeight,
  };
}

export async function renderCroppedImage(file: File, imageKind: ImageKind, crop?: CropSettings) {
  const image = await loadImage(file);
  const normalizedCrop = normalizeCropSettings(crop);
  const targetWidth = imageKind === "landscape" ? 1600 : 900;
  const targetHeight = imageKind === "landscape" ? 900 : 1600;
  const paddingLeft = imageKind === "landscape" ? Math.round(targetWidth * normalizedCrop.paddingLeft) : 0;
  const paddingRight = imageKind === "landscape" ? Math.round(targetWidth * normalizedCrop.paddingRight) : 0;
  const paddingTop = imageKind === "portrait" ? Math.round(targetHeight * normalizedCrop.paddingTop) : 0;
  const paddingBottom = imageKind === "portrait" ? Math.round(targetHeight * normalizedCrop.paddingBottom) : 0;
  const radians = (normalizedCrop.rotation * Math.PI) / 180;
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas kunde inte initieras.");
  }

  const baseScale = Math.max(targetWidth / image.naturalWidth, targetHeight / image.naturalHeight);
  const scale = baseScale * normalizedCrop.zoom;
  const visibleWidthInSource = Math.min(targetWidth / scale, image.naturalWidth);
  const visibleHeightInSource = Math.min(targetHeight / scale, image.naturalHeight);
  const maxCenterShiftX = Math.max((image.naturalWidth - visibleWidthInSource) / 2, 0);
  const maxCenterShiftY = Math.max((image.naturalHeight - visibleHeightInSource) / 2, 0);
  const sourceCenterX = image.naturalWidth / 2 - normalizedCrop.offsetX * maxCenterShiftX;
  const sourceCenterY = image.naturalHeight / 2 + normalizedCrop.offsetY * maxCenterShiftY;

  context.fillStyle = "#000000";
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.save();
  context.beginPath();
  context.rect(0, 0, targetWidth, targetHeight);
  context.clip();
  context.translate(targetWidth / 2, targetHeight / 2);
  context.rotate(radians);
  context.scale(scale, scale);
  context.drawImage(image, -sourceCenterX, -sourceCenterY);
  context.restore();

  if (imageKind === "landscape") {
    context.fillStyle = "#000000";
    if (paddingLeft > 0) {
      context.fillRect(0, 0, paddingLeft, targetHeight);
    }
    if (paddingRight > 0) {
      context.fillRect(targetWidth - paddingRight, 0, paddingRight, targetHeight);
    }
  }

  if (imageKind === "portrait") {
    context.fillStyle = "#000000";
    if (paddingTop > 0) {
      context.fillRect(0, 0, targetWidth, paddingTop);
    }
    if (paddingBottom > 0) {
      context.fillRect(0, targetHeight - paddingBottom, targetWidth, paddingBottom);
    }
  }

  const preferredType = file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp"
    ? file.type
    : "image/png";

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (nextBlob) => {
        if (!nextBlob) {
          reject(new Error("Kunde inte skapa exporterad bild."));
          return;
        }
        resolve(nextBlob);
      },
      preferredType,
      preferredType === "image/jpeg" ? 0.95 : undefined,
    );
  });

  return {
    blob,
    crop: {
      left: 0,
      top: 0,
      width: targetWidth,
      height: targetHeight,
      right: targetWidth,
      bottom: targetHeight,
    },
    dataUrl: canvas.toDataURL(preferredType, preferredType === "image/jpeg" ? 0.95 : undefined),
  };
}

export function fileNameToAssetName(filmId: number, imageKind: ImageKind, file: File) {
  const sourceName = file.name;
  const extensionIndex = sourceName.lastIndexOf(".");
  const rawExtension = extensionIndex >= 0 ? sourceName.slice(extensionIndex).toLowerCase() : ".png";
  const extension = [".png", ".jpg", ".jpeg", ".webp"].includes(rawExtension) ? rawExtension : ".png";
  return `${filmId}_${imageKind}${extension}`;
}

export function buildRowFromForm(form: FormState): FilmRowState {
  const filmId = Number(form.filmId.trim());
  if (!form.filmId.trim()) {
    throw new Error("FilmID måste anges.");
  }
  if (!Number.isInteger(filmId)) {
    throw new Error("FilmID måste vara ett heltal.");
  }
  if (!form.publicationStart) {
    throw new Error("PublicationStart måste anges.");
  }
  const trimmedPremiereYear = form.premiereYear.trim();
  if (trimmedPremiereYear && !/^\d{4}$/.test(trimmedPremiereYear)) {
    throw new Error("Premiärår måste anges som ett fyrsiffrigt årtal.");
  }
  for (const value of form.filmType) {
    if (!FILM_TYPE_OPTIONS.includes(value)) {
      throw new Error(`Filmtyp måste vara ett giltigt val: ${value}`);
    }
  }
  for (const value of form.landscape) {
    if (!LANDSCAPE_OPTIONS.includes(value)) {
      throw new Error(`Landskap måste vara ett giltigt val: ${value}`);
    }
  }
  for (const value of form.decade) {
    if (!DECADE_OPTIONS.includes(value)) {
      throw new Error(`Årtionde måste vara ett giltigt val: ${value}`);
    }
  }
  for (const rawDate of [form.publicationStart, form.publicationEnd]) {
    if (!rawDate) {
      continue;
    }
    if (Number.isNaN(Date.parse(rawDate))) {
      throw new Error(`Ogiltigt datumformat: ${rawDate}. Använd YYYY-MM-DD.`);
    }
  }

  return {
    id: crypto.randomUUID(),
    FilmID: filmId,
    Title: form.title.trim(),
    OriginalTitle: form.originalTitle.trim(),
    DialogueLanguages: [...form.dialogueLanguages],
    Cast: [...form.cast],
    Directors: [...form.directors],
    CountryOfOrigin: form.countryOfOrigin.trim(),
    PremiereYear: trimmedPremiereYear ? Number(trimmedPremiereYear) : null,
    PublicationStart: form.publicationStart,
    PublicationEnd: form.publicationEnd,
    IsFree: form.isFree,
    Territory: form.territory,
    FilmType: [...form.filmType],
    Landscape: [...form.landscape],
    Decade: [...form.decade],
    OtherLabels: [...form.otherLabels],
    Genres: [...form.genres],
    Description: form.description.trim(),
    Collections: [...form.collections],
    ConnectedFilmIDs: parseIntList(form.connectedFilmIds),
    ConnectedCollections: parseSemicolonList(form.connectedCollections),
    LandscapeImage:
      form.landscapeAsset ? fileNameToAssetName(filmId, "landscape", form.landscapeAsset.file) : "",
    PortraitImage: form.portraitAsset ? fileNameToAssetName(filmId, "portrait", form.portraitAsset.file) : "",
    landscapeAsset: form.landscapeAsset,
    portraitAsset: form.portraitAsset,
  };
}

export function rowToForm(row: FilmRowState): FormState {
  return {
    filmId: String(row.FilmID),
    title: row.Title,
    originalTitle: row.OriginalTitle,
    dialogueLanguages: [...row.DialogueLanguages],
    cast: [...row.Cast],
    directors: [...row.Directors],
    countryOfOrigin: row.CountryOfOrigin,
    premiereYear: row.PremiereYear ? String(row.PremiereYear) : "",
    publicationStart: row.PublicationStart,
    publicationEnd: row.PublicationEnd,
    isFree: row.IsFree,
    territory: row.Territory,
    filmType: [...row.FilmType],
    landscape: [...row.Landscape],
    decade:
      row.Decade.length > 0
        ? [...row.Decade]
        : (() => {
            const derived = getDecadeOptionForYear(row.PremiereYear);
            return derived ? [derived] : [];
          })(),
    otherLabels: [...(row.OtherLabels ?? [])],
    genres: [...row.Genres],
    description: row.Description,
    collections: [...row.Collections],
    connectedFilmIds: row.ConnectedFilmIDs.join(";"),
    connectedCollections: row.ConnectedCollections.join(";"),
    landscapeAsset: cloneImageSelection(row.landscapeAsset),
    portraitAsset: cloneImageSelection(row.portraitAsset),
  };
}

function toUnixTimestamp(rawDate: string, hours: number, minutes: number) {
  const trimmed = rawDate.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Ogiltigt datumformat för export: ${rawDate}`);
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  return Math.floor(new Date(year, monthIndex, day, hours, minutes, 0, 0).getTime() / 1000);
}

function formatDashedDate(rawDate: string) {
  const trimmed = rawDate.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Ogiltigt datumformat för export: ${rawDate}`);
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function exportRowForJson(row: FilmRowState): ExportRow {
  const labels = [
    ...row.FilmType,
    ...row.Landscape,
    ...row.Decade,
    ...(row.OtherLabels ?? []),
  ].filter(Boolean);
  if (row.IsFree) {
    labels.push("Gratis");
  }
  labels.push(
    row.IsFree ? "packid_9KTLMVEGFMM1XDIK0TTFV1U38PCK" : "packid_1WCJC6Y2AWABO2FE88D9RENECPCK",
  );
  for (const collection of row.Collections) {
    const normalizedCollection = collection.trim();
    if (!normalizedCollection) {
      continue;
    }
    labels.push(`collection_${normalizedCollection}`);
  }

  const images: ExportRow["images"] = [];
  if (row.PortraitImage) {
    images.push({
      type: "poster",
      filename: `${EXPORT_BASENAME}_assets/${row.PortraitImage}`,
    });
  }
  if (row.LandscapeImage) {
    images.push({
      type: "sixteen-nine",
      filename: `${EXPORT_BASENAME}_assets/${row.LandscapeImage}`,
    });
  }

  const exportRow: ExportRow = {
    labels,
    kind: "movie",
    title: row.Title,
    customId: `id${row.FilmID}`,
    customTags1: row.OriginalTitle ? [row.OriginalTitle] : [],
    customTags2: [...row.DialogueLanguages],
    customTags3: row.PublicationEnd.trim() ? [formatDashedDate(row.PublicationEnd)] : [],
    cast: [...row.Cast],
    directors: [...row.Directors],
    genres: [...row.Genres],
    images,
    synopsis: row.Description,
    externalReportingId: String(row.FilmID),
    viewableWindowStart: toUnixTimestamp(row.PublicationStart, 0, 1),
  };

  if (row.PremiereYear) {
    exportRow.productionYear = row.PremiereYear;
  }

  if (row.CountryOfOrigin) {
    exportRow.countriesOfOrigin = [row.CountryOfOrigin];
  }

  if (row.Territory === "Sverige") {
    exportRow.countryWhitelist = ["SE"];
  }

  if (row.PublicationEnd) {
    exportRow.viewableWindowEnd = toUnixTimestamp(row.PublicationEnd, 23, 59);
  }

  return exportRow;
}

function renderScreeningDatEntry(row: FilmRowState) {
  const tjValue = row.IsFree ? "Cinemateket play (FVOD)" : "Cinemateket play (SVOD)";
  const lines = [
    "Et VOD-release",
    "ET Visning",
    `TJ ${tjValue}`,
    `T1 ${row.PublicationStart}`,
    "RE Sverige",
    `BI ${row.FilmID}`,
  ];

  if (row.PublicationEnd.trim()) {
    lines.push(`T2 ${row.PublicationEnd}`);
  }

  lines.push("", "**");
  return lines.join("\n");
}

function createScreeningDat(rows: FilmRowState[]) {
  return rows.map((row) => renderScreeningDatEntry(row)).join("\n");
}

function sanitizeExportFilePart(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "untitled";
}

export async function createExportZip(rows: FilmRowState[], separateJsonFiles = false) {
  const zip = new JSZip();
  const assetFolder = zip.folder(`${EXPORT_BASENAME}_assets`);
  if (!assetFolder) {
    throw new Error("Kunde inte skapa exportmapp.");
  }

  const payload: ExportRow[] = [];
  for (const row of rows) {
    payload.push(exportRowForJson(row));

    if (row.landscapeAsset) {
      const rendered = await renderCroppedImage(row.landscapeAsset.file, "landscape", row.landscapeAsset.crop);
      assetFolder.file(row.LandscapeImage, rendered.blob);
    }

    if (row.portraitAsset) {
      const rendered = await renderCroppedImage(row.portraitAsset.file, "portrait", row.portraitAsset.crop);
      assetFolder.file(row.PortraitImage, rendered.blob);
    }
  }

  if (separateJsonFiles) {
    for (const row of rows) {
      const exportRow = exportRowForJson(row);
      const fileName = `${row.FilmID}_${sanitizeExportFilePart(row.Title)}.json`;
      zip.file(fileName, JSON.stringify(exportRow, null, 2));
    }
  } else {
    zip.file(`${EXPORT_BASENAME}.json`, JSON.stringify(payload, null, 2));
  }

  zip.file("visningar.dat", createScreeningDat(rows));
  return zip.generateAsync({ type: "blob" });
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizeHeaderName(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function splitImportedList(value: unknown) {
  return String(value ?? "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseImportedBoolean(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (["1", "true", "ja", "yes", "y", "x"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "nej", "no", "n"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function formatDateParts(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseImportedDate(value: unknown) {
  if (!value) {
    return "";
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  if (typeof value === "number") {
    if (value <= 0) {
      return "";
    }
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return formatDateParts(parsed.y, parsed.m, parsed.d);
    }
  }

  const raw = String(value).trim();
  if (!raw) {
    return "";
  }
  const isoPrefixMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefixMatch) {
    return `${isoPrefixMatch[1]}-${isoPrefixMatch[2]}-${isoPrefixMatch[3]}`;
  }
  const slashMatch = raw.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2]}-${slashMatch[3]}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  }
  return "";
}

const LABEL_HEADER_ALIASES = [
  "label1",
  "labels1",
  "label2",
  "labels2",
  "label3",
  "labels3",
  "label4",
  "labels4",
];

const WORKBOOK_HEADER_ALIASES = {
  filmId: ["filmid"],
  title: ["titel"],
  publicationStart: ["publiceringsdatum", "startpublicering"],
  publicationEnd: ["slutavtalsdatum", "avpublicering"],
  publicationStatus: ["publiceringsstatus", "status"],
  collections: ["collection", "collections"],
  isFree: ["gratis"],
  genres: ["genres"],
  genres1: ["genre1", "genres1"],
  genres2: ["genre2", "genres2"],
  description: ["text"],
} satisfies Record<string, string[]>;

type WorkbookColumnKey = keyof typeof WORKBOOK_HEADER_ALIASES;

type WorkbookHeaderInfo = {
  rowIndex: number;
  mapping: Map<WorkbookColumnKey, number>;
  labelColumnIndexes: number[];
};

function findWorkbookHeaderRow(rows: unknown[][]): WorkbookHeaderInfo | null {
  const relevantKeys: WorkbookColumnKey[] = [
    "publicationStart",
    "publicationEnd",
    "collections",
    "isFree",
    "genres",
    "genres1",
    "genres2",
    "description",
  ];

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 12); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const mapping = new Map<WorkbookColumnKey, number>();
    const labelColumnIndexes: number[] = [];

    row.forEach((cell, columnIndex) => {
      const normalized = normalizeHeaderName(cell);
      if (!normalized) {
        return;
      }
      if (LABEL_HEADER_ALIASES.includes(normalized)) {
        labelColumnIndexes.push(columnIndex);
      }
      (Object.entries(WORKBOOK_HEADER_ALIASES) as [WorkbookColumnKey, string[]][]).forEach(([key, aliases]) => {
        if (!mapping.has(key) && aliases.includes(normalized)) {
          mapping.set(key, columnIndex);
        }
      });
    });

    const hasFilmId = mapping.has("filmId");
    const relevantCount = relevantKeys.filter((key) => mapping.has(key)).length;
    if (hasFilmId && (relevantCount > 0 || labelColumnIndexes.length > 0)) {
      return { rowIndex, mapping, labelColumnIndexes };
    }
  }

  return null;
}

function classifyImportedLabels(values: string[]) {
  const filmType: string[] = [];
  const landscape: string[] = [];
  const decade: string[] = [];
  const otherLabels: string[] = [];
  const seen = new Set<string>();

  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);

    const filmTypeMatch = getFilmTypeOption(trimmed);
    if (filmTypeMatch) {
      if (!filmType.includes(filmTypeMatch)) {
        filmType.push(filmTypeMatch);
      }
      continue;
    }
    const landscapeMatch = getLandscapeOption(trimmed);
    if (landscapeMatch) {
      if (!landscape.includes(landscapeMatch)) {
        landscape.push(landscapeMatch);
      }
      continue;
    }
    const decadeMatch = getDecadeOption(trimmed);
    if (decadeMatch) {
      if (!decade.includes(decadeMatch)) {
        decade.push(decadeMatch);
      }
      continue;
    }
    otherLabels.push(trimmed);
  }

  return { filmType, landscape, decade, otherLabels };
}

function getCell(row: unknown[], index: number | undefined) {
  if (index === undefined) {
    return "";
  }
  return row[index];
}

function getImportedGenres(row: unknown[], mapping: Map<WorkbookColumnKey, number>) {
  const genres = [
    ...splitImportedList(getCell(row, mapping.get("genres"))),
    ...splitImportedList(getCell(row, mapping.get("genres1"))),
    ...splitImportedList(getCell(row, mapping.get("genres2"))),
  ];

  return [...new Set(genres)];
}

export async function importRowsFromWorkbook(file: File): Promise<WorkbookImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const importedRows = new Map<number, WorkbookImportRow>();

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" }) as unknown[][];
    const headerInfo = findWorkbookHeaderRow(rows);
    if (!headerInfo) {
      return;
    }

    const { rowIndex, mapping, labelColumnIndexes } = headerInfo;
    for (let index = rowIndex + 1; index < rows.length; index += 1) {
      const row = rows[index] ?? [];
      const filmIdValue = String(getCell(row, mapping.get("filmId")) ?? "").trim();
      if (!filmIdValue) {
        continue;
      }

      const filmId = Number(filmIdValue);
      if (!Number.isInteger(filmId)) {
        continue;
      }

      const publicationStatus = String(getCell(row, mapping.get("publicationStatus")) ?? "").trim();
      if (normalizeHeaderName(publicationStatus) !== "redo") {
        continue;
      }

      const publicationStart = parseImportedDate(getCell(row, mapping.get("publicationStart")));
      const publicationEnd = parseImportedDate(getCell(row, mapping.get("publicationEnd")));
      const labelValues = labelColumnIndexes.flatMap((columnIndex) => splitImportedList(row[columnIndex]));
      const { filmType, landscape, decade, otherLabels } = classifyImportedLabels(labelValues);
      const collections = splitImportedList(getCell(row, mapping.get("collections")));
      const genres = getImportedGenres(row, mapping);
      const description = String(getCell(row, mapping.get("description")) ?? "").trim();
      const isFree = parseImportedBoolean(getCell(row, mapping.get("isFree")));

      importedRows.set(filmId, {
        filmId,
        publicationStart: publicationStart || undefined,
        publicationEnd: publicationEnd || undefined,
        isFree,
        territory: "Sverige",
        filmType: filmType || undefined,
        landscape: landscape || undefined,
        decade: decade || undefined,
        otherLabels: otherLabels.length > 0 ? otherLabels : undefined,
        genres: genres.length > 0 ? genres : undefined,
        description: description || undefined,
        collections: collections.length > 0 ? collections : undefined,
      });
    }
  });

  return [...importedRows.values()];
}
