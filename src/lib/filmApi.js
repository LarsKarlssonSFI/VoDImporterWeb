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

export function extractFilmTitle(payload) {
  const parsedPayload = unwrapFilmApiPayload(payload);
  const recordList = parsedPayload?.adlibJSON?.recordList?.record;
  const firstRecord = Array.isArray(recordList) ? recordList[0] : null;
  const titles = Array.isArray(firstRecord?.Title) ? firstRecord.Title : [];

  for (const titleType of ["Svensk premiärtitel", "Vod-titel i Sverige", "Alternativtitel"]) {
    const title = extractTitleByType(titles, titleType);
    if (title) {
      return title;
    }
  }

  return null;
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
      const title = extractFilmTitle(rawPayload);
      lastPayload = payload;

      if (title) {
        return { title, payload, url: candidateUrl };
      }

      return {
        title: null,
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
    payload: lastPayload,
    url: candidateUrls[candidateUrls.length - 1],
    error: lastError || "Ingen titel hittades i API-svaret.",
  };
}
