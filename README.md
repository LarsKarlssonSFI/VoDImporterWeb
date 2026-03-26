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

Det här arbetsutrymmet saknade `node` och `npm`, så appen kunde inte köras här. När Node.js är installerat:

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
- `src/components/ImageField.tsx`: bilduppladdning och preview-trigger
- `src/components/PreviewDialog.tsx`: crop-preview
- `src/components/OptionEditor.tsx`: admin för dropdown-värden
- `src/lib/utils.ts`: validering, crop-logik och ZIP-export

## Nästa steg

Om du vill följa `shadcn/ui` fullt ut behöver nästa steg göras i en miljö där `npm` finns:

```bash
npx shadcn@latest init -t vite
```

Därefter kan nuvarande UI successivt bytas mot `shadcn/ui`-komponenter som `button`, `dialog`, `input`, `table`, `tabs` och `select`.
