import { ChevronDown, ChevronRight, Download, Film, LayoutPanelTop, Plus, Rows3, Settings2, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ImageField } from "./components/ImageField";
import { MultiSelect } from "./components/MultiSelect";
import { OptionEditor } from "./components/OptionEditor";
import { PreviewDialog } from "./components/PreviewDialog";
import {
  createEmptyForm,
  DECADE_OPTIONS,
  DEFAULT_COLLECTION_OPTIONS,
  DEFAULT_GENRE_OPTIONS,
  DEFAULT_TERRITORY_OPTIONS,
  EXPORT_BASENAME,
  FILM_TYPE_OPTIONS,
  getDecadeOptionForYear,
  LANDSCAPE_OPTIONS,
  TABLE_COLUMNS,
} from "./lib/constants";
import type { CropPreviewState, FilmRowState, FormState } from "./lib/types";
import {
  buildRowFromForm,
  cleanOptionList,
  createExportZip,
  loadStoredRows,
  parseSemicolonList,
  revokeImageSelection,
  rowToForm,
  importRowsFromWorkbook,
  saveStoredRows,
  triggerDownload,
} from "./lib/utils";

type TabKey = "importer" | "settings";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("importer");
  const [genreOptions, setGenreOptions] = useState<string[]>(() => [...DEFAULT_GENRE_OPTIONS]);
  const [collectionOptions, setCollectionOptions] = useState<string[]>(() => [...DEFAULT_COLLECTION_OPTIONS]);
  const [territoryOptions, setTerritoryOptions] = useState<string[]>(() => [...DEFAULT_TERRITORY_OPTIONS]);
  const [rows, setRows] = useState<FilmRowState[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(createEmptyForm());
  const [preview, setPreview] = useState<CropPreviewState>(null);
  const [status, setStatus] = useState<string>("Redo att lägga till första raden.");
  const [error, setError] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportSeparateFiles, setExportSeparateFiles] = useState(true);
  const [hasLoadedRows, setHasLoadedRows] = useState(false);
  const [isLoadingTitle, setIsLoadingTitle] = useState(false);
  const [isImageSectionOpen, setIsImageSectionOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (territoryOptions.includes(form.territory)) {
      return;
    }

    setForm((current) => ({
      ...current,
      territory: territoryOptions[0] ?? "",
    }));
  }, [form.territory, territoryOptions]);

  useEffect(() => {
    if (form.decade.length > 0) {
      return;
    }
    const trimmedPremiereYear = form.premiereYear.trim();
    const derivedDecade = /^\d{4}$/.test(trimmedPremiereYear)
      ? getDecadeOptionForYear(Number(trimmedPremiereYear))
      : "";
    if (!derivedDecade) {
      return;
    }
    setForm((current) => (current.decade.length > 0 ? current : { ...current, decade: [derivedDecade] }));
  }, [form.decade, form.premiereYear]);

  useEffect(() => {
    const storedRows = loadStoredRows();
    setRows(storedRows);
    setHasLoadedRows(true);
    if (storedRows.length > 0) {
      setStatus(`${storedRows.length} sparade rader laddades.`);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRows) {
      return;
    }

    let cancelled = false;

    void saveStoredRows(rows).catch(() => {
      if (!cancelled) {
        setError("Kunde inte spara tabellrader lokalt.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [hasLoadedRows, rows]);

  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
  }, []);

  useEffect(() => {
    const filmId = form.filmId.trim();
    if (filmId.length === 0) {
      setIsLoadingTitle(false);
      setForm((current) =>
        current.title === "" &&
        current.originalTitle === "" &&
        current.dialogueLanguages.length === 0 &&
        current.cast.length === 0 &&
        current.directors.length === 0 &&
        current.countryOfOrigin === "" &&
        current.premiereYear === "" &&
        current.decade.length === 0
          ? current
          : {
              ...current,
              title: "",
              originalTitle: "",
              dialogueLanguages: [],
              cast: [],
              directors: [],
              countryOfOrigin: "",
              premiereYear: "",
              decade: [],
            },
      );
      return;
    }

    if (!/^\d{1,6}$/.test(filmId)) {
      setIsLoadingTitle(false);
      setForm((current) =>
        current.title === "" &&
        current.originalTitle === "" &&
        current.dialogueLanguages.length === 0 &&
        current.cast.length === 0 &&
        current.directors.length === 0 &&
        current.countryOfOrigin === "" &&
        current.premiereYear === "" &&
        current.decade.length === 0
          ? current
          : {
              ...current,
              title: "",
              originalTitle: "",
              dialogueLanguages: [],
              cast: [],
              directors: [],
              countryOfOrigin: "",
              premiereYear: "",
              decade: [],
            },
      );
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoadingTitle(true);
        const response = await fetch(`/api/film-title?filmId=${encodeURIComponent(filmId)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          error?: string;
          title?: string | null;
          originalTitle?: string | null;
          dialogueLanguages?: string[];
          cast?: string[];
          directors?: string[];
          countryOfOrigin?: string | null;
          premiereYear?: number | null;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Kunde inte hämta filmtitel.");
        }

        setForm((current) => {
          if (current.filmId.trim() !== filmId) {
            return current;
          }
          return {
            ...current,
            title: payload.title?.trim() || "",
            originalTitle: payload.originalTitle?.trim() || "",
            dialogueLanguages: Array.isArray(payload.dialogueLanguages)
              ? payload.dialogueLanguages.filter((value) => typeof value === "string")
              : [],
            cast: Array.isArray(payload.cast) ? payload.cast.filter((value) => typeof value === "string") : [],
            directors: Array.isArray(payload.directors) ? payload.directors.filter((value) => typeof value === "string") : [],
            countryOfOrigin: payload.countryOfOrigin?.trim() || "",
            premiereYear:
              typeof payload.premiereYear === "number" && Number.isInteger(payload.premiereYear)
                ? String(payload.premiereYear)
                : "",
            decade:
              typeof payload.premiereYear === "number" && Number.isInteger(payload.premiereYear)
                ? (() => {
                    const derived = getDecadeOptionForYear(payload.premiereYear);
                    return derived ? [derived] : [];
                  })()
                : [],
          };
        });
        setError("");
      } catch (nextError) {
        if (controller.signal.aborted) {
          return;
        }
        setForm((current) =>
          current.filmId.trim() === filmId
            ? {
                ...current,
                title: "",
                originalTitle: "",
                dialogueLanguages: [],
                cast: [],
                directors: [],
                countryOfOrigin: "",
                premiereYear: "",
                decade: [],
              }
            : current,
        );
        setError(nextError instanceof Error ? nextError.message : "Kunde inte hämta filmtitel.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingTitle(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
      setIsLoadingTitle(false);
    };
  }, [form.filmId]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function replaceImage(key: "landscapeAsset" | "portraitAsset", nextValue: FormState[typeof key]) {
    setForm((current) => {
      revokeImageSelection(current[key]);
      return { ...current, [key]: nextValue };
    });
  }

  function resetForm() {
    setSelectedRowId(null);
    setError("");
    setStatus("Formuläret återställdes.");
    setForm((current) => {
      revokeImageSelection(current.landscapeAsset);
      revokeImageSelection(current.portraitAsset);
      return createEmptyForm();
    });
  }

  function clearAllRows() {
    setRows((current) => {
      current.forEach((row) => {
        revokeImageSelection(row.landscapeAsset);
        revokeImageSelection(row.portraitAsset);
      });
      return [];
    });
    setSelectedRowId(null);
    setForm(createEmptyForm());
    setError("");
    setStatus("Alla rader rensades.");
  }

  function saveRow() {
    try {
      const built = buildRowFromForm(form);
      const rowWithStableId = selectedRowId ? { ...built, id: selectedRowId } : built;

      setRows((current) => {
        if (!selectedRowId) {
          return [...current, rowWithStableId];
        }
        return current.map((row) => {
          if (row.id !== selectedRowId) {
            return row;
          }
          revokeImageSelection(row.landscapeAsset);
          revokeImageSelection(row.portraitAsset);
          return rowWithStableId;
        });
      });

      setStatus(selectedRowId ? "Raden uppdaterades." : "Ny rad lades till.");
      setError("");
      setSelectedRowId(null);
      setForm(createEmptyForm());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Kunde inte spara raden.");
    }
  }

  function editRow(rowId: string) {
    const row = rows.find((candidate) => candidate.id === rowId);
    if (!row) {
      return;
    }
    setSelectedRowId(row.id);
    setForm(rowToForm(row));
    setStatus(`Redigerar FilmID ${row.FilmID}.`);
    setError("");
  }

  function deleteRow(rowId: string) {
    setRows((current) => {
      const row = current.find((candidate) => candidate.id === rowId);
      if (row) {
        revokeImageSelection(row.landscapeAsset);
        revokeImageSelection(row.portraitAsset);
      }
      return current.filter((candidate) => candidate.id !== rowId);
    });
    if (selectedRowId === rowId) {
      setSelectedRowId(null);
      setForm(createEmptyForm());
    }
    setStatus("Raden togs bort.");
    setError("");
  }

  async function exportPackage() {
    if (rows.length === 0) {
      setError("Tabellen är tom.");
      return;
    }

    try {
      setIsExporting(true);
      const blob = await createExportZip(rows, exportSeparateFiles);
      triggerDownload(blob, `${EXPORT_BASENAME}.zip`);
      setStatus(
        exportSeparateFiles
          ? "Export klar. ZIP-filen laddades ner med en JSON-fil per film."
          : "Export klar. ZIP-filen laddades ner.",
      );
      setError("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Export misslyckades.");
    } finally {
      setIsExporting(false);
    }
  }

  async function fetchTitleForFilmId(filmId: number) {
    try {
      const response = await fetch(`/api/film-title?filmId=${encodeURIComponent(String(filmId))}`);
      const payload = (await response.json()) as {
        error?: string;
        title?: string | null;
        originalTitle?: string | null;
        dialogueLanguages?: string[];
        cast?: string[];
        directors?: string[];
        countryOfOrigin?: string | null;
        premiereYear?: number | null;
      };
      if (!response.ok) {
        return {
          filmId,
          title: null,
          originalTitle: null,
          dialogueLanguages: [],
          cast: [],
          directors: [],
          countryOfOrigin: null,
          premiereYear: null,
          error: payload.error || "Kunde inte hämta filmtitel.",
          status: response.status,
        };
      }
      return {
        filmId,
        title: payload.title?.trim() || null,
        originalTitle: payload.originalTitle?.trim() || null,
        dialogueLanguages: Array.isArray(payload.dialogueLanguages)
          ? payload.dialogueLanguages.filter((value) => typeof value === "string")
          : [],
        cast: Array.isArray(payload.cast) ? payload.cast.filter((value) => typeof value === "string") : [],
        directors: Array.isArray(payload.directors) ? payload.directors.filter((value) => typeof value === "string") : [],
        countryOfOrigin: payload.countryOfOrigin?.trim() || null,
        premiereYear:
          typeof payload.premiereYear === "number" && Number.isInteger(payload.premiereYear) ? payload.premiereYear : null,
        error: undefined,
        status: response.status,
      };
    } catch (error) {
      return {
        filmId,
        title: null,
        originalTitle: null,
        dialogueLanguages: [],
        cast: [],
        directors: [],
        countryOfOrigin: null,
        premiereYear: null,
        error: error instanceof Error ? error.message : "Kunde inte hämta filmtitel.",
        status: 0,
      };
    }
  }

  async function fetchTitleWithRetry(filmId: number, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const result = await fetchTitleForFilmId(filmId);
      if (
        result.title ||
        result.originalTitle ||
        result.dialogueLanguages.length > 0 ||
        result.cast.length > 0 ||
        result.directors.length > 0 ||
        result.countryOfOrigin !== null ||
        result.premiereYear !== null
      ) {
        return result;
      }

      const shouldRetry = result.status === 0 || result.status >= 500;
      if (!shouldRetry || attempt === maxAttempts) {
        return result;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 250 * attempt));
    }

    return {
      filmId,
      title: null,
      originalTitle: null,
      dialogueLanguages: [],
      cast: [],
      directors: [],
      countryOfOrigin: null,
      premiereYear: null,
      error: "Kunde inte hämta filmtitel.",
      status: 0,
    };
  }

  async function fetchImportedTitles(filmIds: number[]) {
    const results: Awaited<ReturnType<typeof fetchTitleWithRetry>>[] = [];
    for (const filmId of filmIds) {
      results.push(await fetchTitleWithRetry(filmId));
    }
    return results;
  }

  async function importWorkbook(file: File) {
    try {
      const importedRows = await importRowsFromWorkbook(file);
      if (importedRows.length === 0) {
        setError("Hittade inga importerbara rader i Excel-filen.");
        return;
      }

      let createdCount = 0;
      let updatedCount = 0;
      const importedFilmIds = importedRows.map((row) => row.filmId);

      setRows((current) => {
        const nextRows = [...current];

        importedRows.forEach((imported) => {
          const existingIndex = nextRows.findIndex((row) => row.FilmID === imported.filmId);

          if (existingIndex >= 0) {
            const existing = nextRows[existingIndex];
            nextRows[existingIndex] = {
              ...existing,
              PublicationStart: imported.publicationStart ?? existing.PublicationStart,
              PublicationEnd: imported.publicationEnd ?? "",
              IsFree: imported.isFree ?? existing.IsFree,
              Territory: "Sverige",
              FilmType: imported.filmType ?? existing.FilmType,
              Landscape: imported.landscape ?? existing.Landscape,
              Decade: imported.decade ?? existing.Decade,
              OtherLabels: imported.otherLabels ?? existing.OtherLabels,
              Genres: imported.genres ?? existing.Genres,
              Description: imported.description ?? existing.Description,
              Collections: imported.collections ?? existing.Collections,
            };
            updatedCount += 1;
            return;
          }

          nextRows.push({
            id: crypto.randomUUID(),
            FilmID: imported.filmId,
            Title: "",
            OriginalTitle: "",
            DialogueLanguages: [],
            Cast: [],
            Directors: [],
            CountryOfOrigin: "",
            PremiereYear: null,
            FilmType: imported.filmType ?? [],
            Landscape: imported.landscape ?? [],
            Decade: imported.decade ?? [],
            OtherLabels: imported.otherLabels ?? [],
            PublicationStart: imported.publicationStart ?? "",
            PublicationEnd: imported.publicationEnd ?? "",
            IsFree: imported.isFree ?? false,
            Territory: "Sverige",
            Genres: imported.genres ?? [],
            Description: imported.description ?? "",
            Collections: imported.collections ?? [],
            ConnectedFilmIDs: [],
            ConnectedCollections: [],
            LandscapeImage: "",
            PortraitImage: "",
            landscapeAsset: null,
            portraitAsset: null,
          });
          createdCount += 1;
        });

        return nextRows;
      });

      setSelectedRowId(null);
      setError("");
      setStatus(
        `Excel importerad: ${importedRows.length} rader lästa, ${createdCount} nya och ${updatedCount} uppdaterade. Hämtar titlar från API...`,
      );

      const titleResults = await fetchImportedTitles(importedFilmIds);
      const titlesByFilmId = new Map(
        titleResults
          .filter(
            (result) =>
              result.title ||
              result.originalTitle ||
              result.cast.length > 0 ||
              result.directors.length > 0 ||
              result.premiereYear !== null,
          )
          .map((result) => [
            result.filmId,
            {
              title: result.title,
              originalTitle: result.originalTitle,
              dialogueLanguages: result.dialogueLanguages,
              cast: result.cast,
              directors: result.directors,
              countryOfOrigin: result.countryOfOrigin,
              premiereYear: result.premiereYear,
            },
          ]),
      );
      const failedTitleCount = titleResults.filter(
        (result) =>
          !result.title &&
          !result.originalTitle &&
          result.dialogueLanguages.length === 0 &&
          result.cast.length === 0 &&
          result.directors.length === 0 &&
          result.countryOfOrigin === null &&
          result.premiereYear === null,
      ).length;

      if (titlesByFilmId.size > 0) {
        setRows((current) =>
          current.map((row) =>
            titlesByFilmId.has(row.FilmID)
              ? {
                  ...row,
                  Title: titlesByFilmId.get(row.FilmID)?.title || row.Title,
                  OriginalTitle: titlesByFilmId.get(row.FilmID)?.originalTitle || row.OriginalTitle,
                  DialogueLanguages: titlesByFilmId.get(row.FilmID)?.dialogueLanguages || row.DialogueLanguages,
                  Cast: titlesByFilmId.get(row.FilmID)?.cast || row.Cast,
                  Directors: titlesByFilmId.get(row.FilmID)?.directors || row.Directors,
                  CountryOfOrigin: titlesByFilmId.get(row.FilmID)?.countryOfOrigin || row.CountryOfOrigin,
                  PremiereYear: titlesByFilmId.get(row.FilmID)?.premiereYear ?? row.PremiereYear,
                  Decade: (() => {
                    if (row.Decade.length > 0) return row.Decade;
                    const derived = getDecadeOptionForYear(
                      titlesByFilmId.get(row.FilmID)?.premiereYear ?? row.PremiereYear,
                    );
                    return derived ? [derived] : [];
                  })(),
                }
              : row,
          ),
        );
      }

      setStatus(
        `Excel importerad: ${importedRows.length} rader lästa, ${createdCount} nya och ${updatedCount} uppdaterade. ${
          importedFilmIds.length - failedTitleCount
        } titlar hämtades från API${failedTitleCount > 0 ? `, ${failedTitleCount} misslyckades.` : "."}`,
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Kunde inte importera Excel-filen.");
    }
  }

  async function handleWorkbookSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    await importWorkbook(file);
  }

  function updateGenres(nextGenres: string[]) {
    const cleaned = cleanOptionList(nextGenres, DEFAULT_GENRE_OPTIONS);
    setGenreOptions(cleaned);
    setForm((current) => ({
      ...current,
      genres: current.genres.filter((value) => cleaned.includes(value)),
    }));
  }

  function updateCollections(nextCollections: string[]) {
    const cleaned = cleanOptionList(nextCollections, DEFAULT_COLLECTION_OPTIONS);
    setCollectionOptions(cleaned);
    setForm((current) => ({
      ...current,
      collections: current.collections.filter((value) => cleaned.includes(value)),
    }));
  }

  function updateTerritories(nextTerritories: string[]) {
    const cleaned = cleanOptionList(nextTerritories, DEFAULT_TERRITORY_OPTIONS);
    setTerritoryOptions(cleaned);
    setForm((current) => ({
      ...current,
      territory: cleaned.includes(current.territory) ? current.territory : cleaned[0],
    }));
  }

  return (
    <>
      <div className="app-shell">
        <header className="hero">
          <div className="hero__copy">
            <div className="hero__topline">
              <img className="hero__logo" src="/favicon-32.svg" alt="VoD Importer" width="32" height="32" />
              <div className="hero__heading">
                <h1>VoD Importer</h1>
              </div>
            </div>
            <p className="hero__subtitle">Importera metadata och exportera ett färdigt paket.</p>
            <p className="hero__text">
              Lägg till eller redigera rader, kontrollera hur bilderna kommer att beskäras och exportera sedan JSON och bilder i ett enda ZIP-paket.
            </p>
          </div>

          <div className="hero__stats">
            <div className="stat-card">
              <span>Rader</span>
              <strong>{rows.length}</strong>
            </div>
            <div className="stat-card">
              <span>Genres</span>
              <strong>{genreOptions.length}</strong>
            </div>
            <div className="stat-card">
              <span>Filmtyper</span>
              <strong>{FILM_TYPE_OPTIONS.length}</strong>
            </div>
          </div>
        </header>

        <nav className="tabs">
          <button
            type="button"
            className={activeTab === "importer" ? "tab tab--active" : "tab"}
            onClick={() => setActiveTab("importer")}
          >
            <LayoutPanelTop size={16} />
            Importer
          </button>
          <button
            type="button"
            className={activeTab === "settings" ? "tab tab--active" : "tab"}
            onClick={() => setActiveTab("settings")}
          >
            <Settings2 size={16} />
            Inställningar
          </button>
        </nav>

        {error ? <div className="status status--error">{error}</div> : null}
        {!error ? <div className="status">{status}</div> : null}

        {activeTab === "importer" ? (
          <main className="layout-grid">
            <section className="panel panel--form">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">{selectedRowId ? "Redigera rad" : "Ny rad"}</p>
                  <h2>Lägg till eller uppdatera metadata</h2>
                </div>
                <Film size={20} />
              </div>

              <div className="form-grid form-grid--primary">
                <label className="field field--id">
                  <span>FilmID</span>
                  <input
                    maxLength={6}
                    value={form.filmId}
                    onChange={(event) => updateForm("filmId", event.target.value.slice(0, 6))}
                  />
                </label>

                <label className="field field--title">
                  <span>Titel</span>
                  <input
                    value={form.title}
                    placeholder={isLoadingTitle ? "Hämtar titel..." : "Filmens titel"}
                    onChange={(event) => updateForm("title", event.target.value)}
                  />
                </label>

                <label className="field field--title">
                  <span>Originaltitel</span>
                  <input
                    value={form.originalTitle}
                    placeholder={isLoadingTitle ? "Hämtar originaltitel..." : ""}
                    onChange={(event) => updateForm("originalTitle", event.target.value)}
                  />
                </label>

                <label className="field field--title">
                  <span>Dialogspråk</span>
                  <input
                    value={form.dialogueLanguages.join("; ")}
                    placeholder={isLoadingTitle ? "Hämtar dialogspråk..." : ""}
                    onChange={(event) => updateForm("dialogueLanguages", parseSemicolonList(event.target.value))}
                  />
                </label>

                <label className="field field--title">
                  <span>Skådespelare</span>
                  <input
                    value={form.cast.join("; ")}
                    placeholder={isLoadingTitle ? "Hämtar skådespelare..." : ""}
                    onChange={(event) => updateForm("cast", parseSemicolonList(event.target.value))}
                  />
                </label>

                <label className="field field--title">
                  <span>Regissörer</span>
                  <input
                    value={form.directors.join("; ")}
                    placeholder={isLoadingTitle ? "Hämtar regissörer..." : ""}
                    onChange={(event) => updateForm("directors", parseSemicolonList(event.target.value))}
                  />
                </label>

                <label className="field field--compact">
                  <span>Produktionsland</span>
                  <input
                    value={form.countryOfOrigin}
                    placeholder={isLoadingTitle ? "Hämtar produktionsland..." : ""}
                    onChange={(event) => updateForm("countryOfOrigin", event.target.value)}
                  />
                </label>

                <label className="field field--compact">
                  <span>Premiärår</span>
                  <input
                    value={form.premiereYear}
                    placeholder={isLoadingTitle ? "Hämtar premiärår..." : ""}
                    onChange={(event) => updateForm("premiereYear", event.target.value)}
                  />
                </label>

                <label className="field field--compact">
                  <span>Publiceringsstart</span>
                  <input
                    type="date"
                    name="publication-start"
                    autoComplete="off"
                    value={form.publicationStart}
                    onChange={(event) => updateForm("publicationStart", event.target.value)}
                  />
                </label>

                <label className="field field--compact">
                  <span>Avpublicering</span>
                  <input
                    type="date"
                    name="publication-end"
                    autoComplete="off"
                    value={form.publicationEnd}
                    onChange={(event) => updateForm("publicationEnd", event.target.value)}
                  />
                </label>

                <label className="field field--compact">
                  <span>Territorium</span>
                  <select value={form.territory} onChange={(event) => updateForm("territory", event.target.value)}>
                    {territoryOptions.map((territory) => (
                      <option key={territory} value={territory}>
                        {territory}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="checkbox-field checkbox-field--inline">
                  <input
                    type="checkbox"
                    checked={form.isFree}
                    onChange={(event) => updateForm("isFree", event.target.checked)}
                  />
                  <span>Gratis</span>
                </label>
              </div>

              <div className="form-grid form-grid--secondary">
                <div className="form-column form-column--genres">
                  <fieldset className="field fieldset">
                    <legend>Genres</legend>
                    <div className="chip-grid">
                      {genreOptions.map((genre) => {
                        const selected = form.genres.includes(genre);
                        return (
                          <button
                            key={genre}
                            type="button"
                            className={selected ? "chip chip--selected" : "chip"}
                            onClick={() =>
                              updateForm(
                                "genres",
                                selected
                                  ? form.genres.filter((value) => value !== genre)
                                  : [...form.genres, genre],
                              )
                            }
                          >
                            {genre}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <label className="field field--compact">
                    <span>Filmtyp</span>
                    <MultiSelect
                      placeholder="Välj filmtyp"
                      options={FILM_TYPE_OPTIONS}
                      values={form.filmType}
                      onChange={(next) => updateForm("filmType", next)}
                    />
                  </label>

                  <label className="field field--compact">
                    <span>Plats</span>
                    <MultiSelect
                      placeholder="Välj plats"
                      options={LANDSCAPE_OPTIONS}
                      values={form.landscape}
                      onChange={(next) => updateForm("landscape", next)}
                    />
                  </label>

                  <label className="field field--compact">
                    <span>Årtionde</span>
                    <MultiSelect
                      placeholder="Välj årtionde"
                      options={DECADE_OPTIONS}
                      values={form.decade}
                      onChange={(next) => updateForm("decade", next)}
                    />
                  </label>
                </div>

                <div className="form-column form-column--collections">
                  <fieldset className="field fieldset">
                    <legend>Collections</legend>
                    <div className="chip-grid">
                      {collectionOptions.map((collection) => {
                        const selected = form.collections.includes(collection);
                        return (
                          <button
                            key={collection}
                            type="button"
                            className={selected ? "chip chip--selected" : "chip"}
                            onClick={() =>
                              updateForm(
                                "collections",
                                selected
                                  ? form.collections.filter((value) => value !== collection)
                                  : [...form.collections, collection],
                              )
                            }
                          >
                            {collection}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <fieldset className="field fieldset">
                    <legend>Övriga labels</legend>
                    {form.otherLabels.length === 0 ? (
                      <span className="field-hint">Inga övriga labels från Excel.</span>
                    ) : (
                      <div className="chip-grid">
                        {form.otherLabels.map((label) => (
                          <button
                            key={label}
                            type="button"
                            className="chip chip--selected chip--extra"
                            title="Klicka för att ta bort"
                            onClick={() =>
                              updateForm(
                                "otherLabels",
                                form.otherLabels.filter((value) => value !== label),
                              )
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </fieldset>
                </div>

                <label className="field field--description">
                  <span>Textbeskrivning</span>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={(event) => updateForm("description", event.target.value)}
                  />
                </label>
              </div>

              <section className="image-section">
                <button
                  className="section-toggle"
                  type="button"
                  onClick={() => setIsImageSectionOpen((current) => !current)}
                  aria-expanded={isImageSectionOpen}
                >
                  <span className="section-toggle__label">
                    {isImageSectionOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    Bildhantering
                  </span>
                  <span className="section-toggle__meta">
                    {form.landscapeAsset || form.portraitAsset ? "Bilder valda" : "Minimerad"}
                  </span>
                </button>

                {isImageSectionOpen ? (
                  <div className="image-grid">
                    <ImageField
                      title="Landskapsformat"
                      imageKind="landscape"
                      value={form.landscapeAsset}
                      onChange={(value) => replaceImage("landscapeAsset", value)}
                      onPreview={(selection, imageKind, title) => setPreview({ selection, imageKind, title })}
                    />
                    <ImageField
                      title="Porträttformat"
                      imageKind="portrait"
                      value={form.portraitAsset}
                      onChange={(value) => replaceImage("portraitAsset", value)}
                      onPreview={(selection, imageKind, title) => setPreview({ selection, imageKind, title })}
                    />
                  </div>
                ) : null}
              </section>

              <div className="button-row">
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  style={{ display: "none" }}
                  onChange={handleWorkbookSelected}
                />
                <button className="ghost-button" type="button" onClick={clearAllRows}>
                  Rensa
                </button>
                <button className="ghost-button" type="button" onClick={resetForm}>
                  Ny rad
                </button>
                <button className="primary-button" type="button" onClick={saveRow}>
                  <Plus size={16} />
                  Lägg till / Uppdatera
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload size={16} />
                  Importera Excel
                </button>
                <label className="checkbox-field checkbox-field--compact">
                  <input
                    type="checkbox"
                    checked={exportSeparateFiles}
                    onChange={(event) => setExportSeparateFiles(event.target.checked)}
                  />
                  <span>Separata filer</span>
                </label>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={exportPackage}
                  disabled={rows.length === 0 || isExporting}
                >
                  <Download size={16} />
                  {isExporting ? "Exporterar..." : "Exportera ZIP"}
                </button>
              </div>
            </section>

            <section className="panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Rader</p>
                  <h2>Tabell med exportunderlag</h2>
                </div>
                <Rows3 size={20} />
              </div>

              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      {TABLE_COLUMNS.map((column) => (
                        <th key={column.key}>{column.label}</th>
                      ))}
                      <th>Åtgärd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={TABLE_COLUMNS.length + 1} className="empty-state">
                          Tabellen är tom.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id}>
                          {TABLE_COLUMNS.map((column) => (
                            <td key={column.key}>{column.value(row)}</td>
                          ))}
                          <td>
                            <div className="table-actions">
                              <button className="secondary-button" type="button" onClick={() => editRow(row.id)}>
                                Redigera
                              </button>
                              <button className="ghost-button" type="button" onClick={() => deleteRow(row.id)}>
                                <Trash2 size={16} />
                                Ta bort
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        ) : (
          <main className="settings-grid">
            <OptionEditor title="Genres" values={genreOptions} onChange={updateGenres} />
            <OptionEditor title="Collections" values={collectionOptions} onChange={updateCollections} />
            <OptionEditor title="Territorier" values={territoryOptions} onChange={updateTerritories} />
          </main>
        )}
      </div>

      <PreviewDialog preview={preview} onClose={() => setPreview(null)} />
    </>
  );
}
