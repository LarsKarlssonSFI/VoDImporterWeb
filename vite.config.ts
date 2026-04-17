import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fetchFilmApiTitle } from "./src/lib/filmApi.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBaseUrl = env.SFI_FILM_API_BASE_URL;
  const username = env.SFI_FILM_API_USERNAME;
  const password = env.SFI_FILM_API_PASSWORD;

  return {
    plugins: [
      react(),
      {
        name: "local-film-title-api",
        configureServer(server) {
          server.middlewares.use("/api/film-title", async (req, res) => {
            const requestUrl = new URL((req as { url?: string }).url || "/", "http://127.0.0.1:5173");
            const filmId = (requestUrl.searchParams.get("filmId") || "").trim();

            res.setHeader("content-type", "application/json");

            if (!filmId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "FilmID saknas." }));
              return;
            }

            if (!apiBaseUrl || !username || !password) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "Film-API saknar konfiguration i .env.local." }));
              return;
            }

            try {
              const result = await fetchFilmApiTitle(fetch, apiBaseUrl, filmId, username, password);
              const originalTitle = "originalTitle" in result ? result.originalTitle : null;
              const dialogueLanguages =
                "dialogueLanguages" in result && Array.isArray(result.dialogueLanguages) ? result.dialogueLanguages : [];
              const cast = "cast" in result && Array.isArray(result.cast) ? result.cast : [];
              const directors = "directors" in result && Array.isArray(result.directors) ? result.directors : [];
              const countryOfOrigin =
                "countryOfOrigin" in result && typeof result.countryOfOrigin === "string" ? result.countryOfOrigin : null;
              const premiereYear =
                "premiereYear" in result && typeof result.premiereYear === "number" ? result.premiereYear : null;
              res.statusCode =
                result.title ||
                originalTitle ||
                dialogueLanguages.length > 0 ||
                cast.length > 0 ||
                directors.length > 0 ||
                countryOfOrigin !== null ||
                premiereYear !== null
                  ? 200
                  : 404;
              res.end(
                JSON.stringify({
                  filmId,
                  title: result.title,
                  originalTitle,
                  dialogueLanguages,
                  cast,
                  directors,
                  countryOfOrigin,
                  premiereYear,
                  payload: result.payload,
                  error: result.error,
                }),
              );
            } catch (error) {
              res.statusCode = 502;
              res.end(
                JSON.stringify({
                  error: error instanceof Error ? error.message : "Kunde inte hämta filmdata.",
                }),
              );
            }
          });
        },
      },
    ],
    server: {
      port: 5173,
    },
  };
});
