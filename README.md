# CinePlay Importer Web

Webbversion av `CinePlayImporter`, byggd för `Vite + React + TypeScript`.

## Ingår

- formulär för filmmetadata
- redigering av rader i tabell
- lokala inställningar för `Genres` och `Collections`
- drag-and-drop eller filval för bilder
- `Preview` som visar samma center-crop som exporten använder
- export till en ZIP-fil med:
  - `cineplay_export.json`
  - `cineplay_export_assets/` med beskurna bilder

## Starta projektet

För lokal testning av titelhämtning behöver du skapa en `.env.local` med:

```bash
SFI_FILM_API_BASE_URL=http://cineapi.svenskfilmdatabas.se/filmapi
SFI_FILM_API_USERNAME=...
SFI_FILM_API_PASSWORD=...
```

När Node.js är installerat:

```bash
cd CinePlayImporterWeb
npm install
npm run dev
```

Bygg produktion:

```bash
npm run build
npm run preview
```

## Struktur

- `src/App.tsx`: huvudgränssnittet
- `src/lib/filmApi.js`: hjälpfunktioner för filmtitel-API:t
- `src/components/ImageField.tsx`: bilduppladdning och preview-trigger
- `src/components/PreviewDialog.tsx`: crop-preview
- `src/components/OptionEditor.tsx`: admin för dropdown-värden
- `src/lib/utils.ts`: validering, crop-logik och ZIP-export
- `netlify/functions/film-title.mjs`: server-side proxy för filmtitel-API:t

## Nästa steg

Om du vill följa `shadcn/ui` fullt ut behöver nästa steg göras i en miljö där `npm` finns:

```bash
npx shadcn@latest init -t vite
```

Därefter kan nuvarande UI successivt bytas mot `shadcn/ui`-komponenter som `button`, `dialog`, `input`, `table`, `tabs` och `select`.
