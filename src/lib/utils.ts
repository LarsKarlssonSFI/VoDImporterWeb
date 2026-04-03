import JSZip from "jszip";
import * as XLSX from "xlsx";
import {
  EXPORT_BASENAME,
  LANDSCAPE_ASPECT_RATIO,
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
    return parsed.map((row) => ({
      ...row,
      Title: typeof row.Title === "string" ? row.Title : "",
      Labels: Array.isArray((row as StoredRow & { Labels?: unknown }).Labels)
        ? (row as StoredRow & { Labels?: unknown[] }).Labels?.filter((value): value is string => typeof value === "string") ?? []
        : typeof (row as StoredRow & { Labels?: unknown }).Labels === "string" &&
            (row as StoredRow & { Labels?: string }).Labels?.trim()
          ? [(row as StoredRow & { Labels?: string }).Labels!.trim()]
          : [],
      landscapeAsset: deserializeImageSelection(row.landscapeAsset),
      portraitAsset: deserializeImageSelection(row.portraitAsset),
    }));
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
  for (const rawDate of [form.publicationStart, form.publicationEnd]) {
    if (!rawDate) {
      continue;
    }
    if (Number.isNaN(Date.parse(rawDate))) {
      throw new Error(`Ogiltigt datumformat: ${rawDate}. Använd YYYY-MM-DD.`);
    }
  }
  if (form.collections.length === 0) {
    throw new Error("Minst en collection måste väljas.");
  }

  return {
    id: crypto.randomUUID(),
    FilmID: filmId,
    Title: form.title.trim(),
    PublicationStart: form.publicationStart,
    PublicationEnd: form.publicationEnd,
    IsFree: form.isFree,
    Territory: form.territory,
    Labels: [...form.labels],
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
    publicationStart: row.PublicationStart,
    publicationEnd: row.PublicationEnd,
    isFree: row.IsFree,
    territory: row.Territory,
    labels: [...row.Labels],
    genres: [...row.Genres],
    description: row.Description,
    collections: [...row.Collections],
    connectedFilmIds: row.ConnectedFilmIDs.join(";"),
    connectedCollections: row.ConnectedCollections.join(";"),
    landscapeAsset: cloneImageSelection(row.landscapeAsset),
    portraitAsset: cloneImageSelection(row.portraitAsset),
  };
}

export function exportRowForJson(row: FilmRowState): ExportRow {
  return {
    FilmID: row.FilmID,
    PublicationStart: row.PublicationStart,
    PublicationEnd: row.PublicationEnd,
    IsFree: row.IsFree,
    Territory: row.Territory,
    Labels: [...row.Labels],
    Genres: row.Genres,
    Description: row.Description,
    Collections: row.Collections,
    ConnectedFilmIDs: row.ConnectedFilmIDs,
    ConnectedCollections: row.ConnectedCollections,
    LandscapeImage: row.LandscapeImage ? `${EXPORT_BASENAME}_assets/${row.LandscapeImage}` : "",
    PortraitImage: row.PortraitImage ? `${EXPORT_BASENAME}_assets/${row.PortraitImage}` : "",
  };
}

export async function createExportZip(rows: FilmRowState[]) {
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

  zip.file(`${EXPORT_BASENAME}.json`, JSON.stringify(payload, null, 2));
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

const WORKBOOK_HEADER_ALIASES = {
  filmId: ["filmid"],
  title: ["titel"],
  publicationStart: ["publiceringsdatum", "startpublicering"],
  publicationEnd: ["slutavtalsdatum", "avpublicering"],
  publicationStatus: ["publiceringsstatus", "status"],
  labels: ["labels"],
  collections: ["collection", "collections"],
  isFree: ["gratis"],
  genres: ["genres"],
  description: ["text"],
} satisfies Record<string, string[]>;

type WorkbookColumnKey = keyof typeof WORKBOOK_HEADER_ALIASES;

function findWorkbookHeaderRow(rows: unknown[][]) {
  const relevantKeys: WorkbookColumnKey[] = [
    "publicationStart",
    "publicationEnd",
    "collections",
    "isFree",
    "genres",
    "description",
  ];

  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 12); rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const mapping = new Map<WorkbookColumnKey, number>();

    row.forEach((cell, columnIndex) => {
      const normalized = normalizeHeaderName(cell);
      if (!normalized) {
        return;
      }
      (Object.entries(WORKBOOK_HEADER_ALIASES) as [WorkbookColumnKey, string[]][]).forEach(([key, aliases]) => {
        if (!mapping.has(key) && aliases.includes(normalized)) {
          mapping.set(key, columnIndex);
        }
      });
    });

    const hasFilmId = mapping.has("filmId");
    const relevantCount = relevantKeys.filter((key) => mapping.has(key)).length;
    if (hasFilmId && relevantCount > 0) {
      return { rowIndex, mapping };
    }
  }

  return null;
}

function getCell(row: unknown[], index: number | undefined) {
  if (index === undefined) {
    return "";
  }
  return row[index];
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

    const { rowIndex, mapping } = headerInfo;
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
      const labels = splitImportedList(getCell(row, mapping.get("labels")));
      const collections = splitImportedList(getCell(row, mapping.get("collections")));
      const genres = splitImportedList(getCell(row, mapping.get("genres")));
      const description = String(getCell(row, mapping.get("description")) ?? "").trim();
      const isFree = parseImportedBoolean(getCell(row, mapping.get("isFree")));

      importedRows.set(filmId, {
        filmId,
        publicationStart: publicationStart || undefined,
        publicationEnd: publicationEnd || undefined,
        isFree,
        territory: "Sverige",
        labels: labels.length > 0 ? labels : undefined,
        genres: genres.length > 0 ? genres : undefined,
        description: description || undefined,
        collections: collections.length > 0 ? collections : undefined,
      });
    }
  });

  return [...importedRows.values()];
}
