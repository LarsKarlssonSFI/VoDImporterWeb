import { fetchFilmApiTitle } from "../../src/lib/filmApi.js";

const API_BASE_URL = process.env.SFI_FILM_API_BASE_URL || "http://cineapi.svenskfilmdatabas.se/filmapi";
const USERNAME = process.env.SFI_FILM_API_USERNAME;
const PASSWORD = process.env.SFI_FILM_API_PASSWORD;

export default async (request) => {
  const url = new URL(request.url);
  const filmId = (url.searchParams.get("filmId") || "").trim();

  if (!filmId) {
    return new Response(JSON.stringify({ error: "FilmID saknas." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  if (!USERNAME || !PASSWORD) {
    return new Response(JSON.stringify({ error: "API-credentials saknas i servermiljön." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const result = await fetchFilmApiTitle(fetch, API_BASE_URL, filmId, USERNAME, PASSWORD);

    if (!result.title) {
      return new Response(JSON.stringify({ filmId, title: null, payload: result.payload, error: result.error }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ filmId, title: result.title, payload: result.payload }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Kunde inte hämta filmdata.",
      }),
      {
        status: 502,
        headers: { "content-type": "application/json" },
      },
    );
  }
};
