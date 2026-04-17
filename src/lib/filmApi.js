function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getTextFromSpans(value) {
  if (!isRecord(value)) {
    return null;
  }

  const spans = value.spans;
  if (!Array.isArray(spans)) {
    return null;
  }

  const text = spans
    .map((item) => (isRecord(item) && typeof item.text === "string" ? item.text.trim() : ""))
    .filter(Boolean)
    .join(" ");

  return text || null;
}

function unwrapFilmApiPayload(payload) {
  if (isRecord(payload) && isRecord(payload.adlibJSON)) {
    return payload;
  }

  if (typeof payload !== "string") {
    return null;
  }

  const trimmed = payload.trim();
  const xmlWrappedMatch = trimmed.match(/^<string\b[^>]*>([\s\S]*)<\/string>$/i);
  const jsonSource = (xmlWrappedMatch?.[1] || trimmed).trim();

  try {
    const parsed = JSON.parse(jsonSource);
    if (typeof parsed === "string") {
      return unwrapFilmApiPayload(parsed);
    }
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseFilmApiPayload(payload) {
  return unwrapFilmApiPayload(payload);
}

function extractTitleByType(titles, expectedType) {
  for (const titleEntry of titles) {
    if (!isRecord(titleEntry)) {
      continue;
    }

    const titleTypes = Array.isArray(titleEntry["title.type"]) ? titleEntry["title.type"] : [];
    const hasExpectedType = titleTypes.some((titleType) => {
      if (!isRecord(titleType)) {
        return false;
      }
      return getTextFromSpans(titleType.value) === expectedType;
    });

    if (!hasExpectedType) {
      continue;
    }

    const title = getTextFromSpans(titleEntry.title_complete);
    if (title) {
      return title;
    }
  }

  return null;
}

function getPersonName(nameValue) {
  if (!isRecord(nameValue)) {
    return null;
  }

  const forename = getTextFromSpans(Array.isArray(nameValue.forename) ? nameValue.forename[0] : null);
  const surname = getTextFromSpans(Array.isArray(nameValue.surname) ? nameValue.surname[0] : null);
  if (forename && surname) {
    return `${forename} ${surname}`;
  }

  const fullName = getTextFromSpans(Array.isArray(nameValue.name) ? nameValue.name[0] : null);
  if (fullName) {
    return fullName;
  }

  return [forename, surname].filter(Boolean).join(" ") || null;
}

function extractDirectors(payload) {
  const parsedPayload = unwrapFilmApiPayload(payload);
  const recordList = parsedPayload?.adlibJSON?.recordList?.record;
  const firstRecord = Array.isArray(recordList) ? recordList[0] : null;
  const credits = Array.isArray(firstRecord?.Credits) ? firstRecord.Credits : [];
  const directors = [];

  for (const credit of credits) {
    if (!isRecord(credit)) {
      continue;
    }

    const creditTypes = Array.isArray(credit["credit.type"]) ? credit["credit.type"] : [];
    const isDirector = creditTypes.some((creditType) => {
      if (!isRecord(creditType)) {
        return false;
      }
      return getTextFromSpans(creditType.value) === "Regi";
    });

    if (!isDirector) {
      continue;
    }

    const name = getPersonName(credit["credit.name"]);
    if (name && !directors.includes(name)) {
      directors.push(name);
    }
  }

  return directors;
}

function extractCast(payload) {
  const parsedPayload = unwrapFilmApiPayload(payload);
  const recordList = parsedPayload?.adlibJSON?.recordList?.record;
  const firstRecord = Array.isArray(recordList) ? recordList[0] : null;
  const castEntries = Array.isArray(firstRecord?.Cast) ? firstRecord.Cast : [];
  const cast = [];

  for (const castEntry of castEntries) {
    if (!isRecord(castEntry)) {
      continue;
    }

    const name = getPersonName(castEntry["cast.name"]);
    if (name && !cast.includes(name)) {
      cast.push(name);
    }

    if (cast.length === 3) {
      break;
    }
  }

  return cast;
}

function extractPremiereYear(payload) {
  const parsedPayload = unwrapFilmApiPayload(payload);
  const recordList = parsedPayload?.adlibJSON?.recordList?.record;
  const firstRecord = Array.isArray(recordList) ? recordList[0] : null;
  const datings = Array.isArray(firstRecord?.Dating) ? firstRecord.Dating : [];

  for (const dating of datings) {
    if (!isRecord(dating)) {
      continue;
    }

    const datingTypes = Array.isArray(dating["dating.type"]) ? dating["dating.type"] : [];
    const isPremiere = datingTypes.some((datingType) => {
      if (!isRecord(datingType)) {
        return false;
      }
      return getTextFromSpans(datingType.value) === "Premiär";
    });

    if (!isPremiere) {
      continue;
    }

    const startDate = getTextFromSpans(dating["dating.date.start"]);
    if (!startDate) {
      continue;
    }

    const yearMatch = startDate.match(/\b(\d{4})\b/);
    if (yearMatch) {
      return Number(yearMatch[1]);
    }
  }

  return null;
}

function extractCountryOfOrigin(payload) {
  const parsedPayload = unwrapFilmApiPayload(payload);
  const recordList = parsedPayload?.adlibJSON?.recordList?.record;
  const firstRecord = Array.isArray(recordList) ? recordList[0] : null;
  const productionCountries = Array.isArray(firstRecord?.ProdCountry) ? firstRecord.ProdCountry : [];

  for (const productionCountry of productionCountries) {
    if (!isRecord(productionCountry)) {
      continue;
    }

    const countryEntries = Array.isArray(productionCountry.production_country)
      ? productionCountry.production_country
      : [];

    for (const countryEntry of countryEntries) {
      const country = getTextFromSpans(isRecord(countryEntry) ? countryEntry.value : countryEntry);
      if (country) {
        return country;
      }
    }
  }

  return null;
}

function extractDialogueLanguages(payload) {
  const parsedPayload = unwrapFilmApiPayload(payload);
  const recordList = parsedPayload?.adlibJSON?.recordList?.record;
  const firstRecord = Array.isArray(recordList) ? recordList[0] : null;
  const languages = Array.isArray(firstRecord?.Language) ? firstRecord.Language : [];
  const dialogueLanguages = [];

  for (const languageEntry of languages) {
    if (!isRecord(languageEntry)) {
      continue;
    }

    const usages = Array.isArray(languageEntry["language.usage"]) ? languageEntry["language.usage"] : [];
    const isDialogueLanguage = usages.some((usage) => getTextFromSpans(isRecord(usage) ? usage.value : usage) === "Dialogspråk");
    if (!isDialogueLanguage) {
      continue;
    }

    const languageValues = Array.isArray(languageEntry.language) ? languageEntry.language : [];
    const preferredLanguageValue =
      languageValues.find((languageValue) => isRecord(languageValue) && languageValue.lang === "sv-SE") ||
      languageValues[0];
    const language = getTextFromSpans(isRecord(preferredLanguageValue) ? preferredLanguageValue.value : preferredLanguageValue);
    if (language && !dialogueLanguages.includes(language)) {
      dialogueLanguages.push(language);
    }
  }

  return dialogueLanguages;
}

function extractTitles(payload) {
  const parsedPayload = unwrapFilmApiPayload(payload);
  const recordList = parsedPayload?.adlibJSON?.recordList?.record;
  const firstRecord = Array.isArray(recordList) ? recordList[0] : null;
  const titles = Array.isArray(firstRecord?.Title) ? firstRecord.Title : [];

  let selectedTitle = null;
  for (const titleType of ["Vod-titel i Sverige", "Svensk premiärtitel"]) {
    const candidateTitle = extractTitleByType(titles, titleType);
    if (candidateTitle) {
      selectedTitle = candidateTitle;
      break;
    }
  }

  return {
    title: selectedTitle,
    originalTitle: extractTitleByType(titles, "Originaltitel"),
    dialogueLanguages: extractDialogueLanguages(payload),
    cast: extractCast(payload),
    directors: extractDirectors(payload),
    countryOfOrigin: extractCountryOfOrigin(payload),
    premiereYear: extractPremiereYear(payload),
  };
}

export function extractFilmTitle(payload) {
  return extractTitles(payload).title;
}

export function extractFilmTitles(payload) {
  return extractTitles(payload);
}

export function buildFilmApiUrl(baseUrl, filmId, username, password) {
  const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");
  return `${trimmedBaseUrl}/Film/GetFilmByFilmIdJSON/${encodeURIComponent(filmId)}/${encodeURIComponent(username)}/${encodeURIComponent(password)}`;
}

export function buildFilmApiCandidateUrls(baseUrl, filmId, username, password) {
  const trimmedBaseUrl = baseUrl.replace(/\/+$/, "");
  const encodedFilmId = encodeURIComponent(filmId);
  const encodedUsername = encodeURIComponent(username);
  const encodedPassword = encodeURIComponent(password);

  return [
    `${trimmedBaseUrl}/Film/GetFilmByFilmIdJSON/${encodedFilmId}/${encodedUsername}/${encodedPassword}`,
    `${trimmedBaseUrl}/Film/GetFilmByFilmIdJSON/FilmID/${encodedFilmId}/${encodedUsername}/${encodedPassword}`,
  ];
}

export async function fetchFilmApiTitle(fetchImpl, baseUrl, filmId, username, password) {
  const candidateUrls = buildFilmApiCandidateUrls(baseUrl, filmId, username, password);
  let lastPayload = null;
  let lastError = null;

  for (const candidateUrl of candidateUrls) {
    try {
      const upstreamResponse = await fetchImpl(candidateUrl, {
        headers: { accept: "application/json" },
      });

      if (!upstreamResponse.ok) {
        lastError = `Film-API svarade med ${upstreamResponse.status}.`;
        continue;
      }

      const rawPayload = await upstreamResponse.text();
      const payload = parseFilmApiPayload(rawPayload);
      const titles = extractFilmTitles(rawPayload);
      lastPayload = payload;

      if (
        titles.title ||
        titles.originalTitle ||
        titles.dialogueLanguages.length > 0 ||
        titles.cast.length > 0 ||
        titles.directors.length > 0 ||
        titles.countryOfOrigin !== null ||
        titles.premiereYear !== null
      ) {
        return { ...titles, payload, url: candidateUrl };
      }

      return {
        title: null,
        originalTitle: null,
        dialogueLanguages: [],
        cast: [],
        directors: [],
        countryOfOrigin: null,
        premiereYear: null,
        payload,
        url: candidateUrl,
        error: "Ingen titel hittades i API-svaret.",
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Kunde inte hämta filmdata.";
    }
  }

  return {
    title: null,
    originalTitle: null,
    dialogueLanguages: [],
    cast: [],
    directors: [],
    countryOfOrigin: null,
    premiereYear: null,
    payload: lastPayload,
    url: candidateUrls[candidateUrls.length - 1],
    error: lastError || "Ingen titel hittades i API-svaret.",
  };
}
