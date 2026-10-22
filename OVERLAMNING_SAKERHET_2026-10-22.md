# Överlämning: säkerhetsuppdatering av beroenden (2026-10-22)

Bakgrund: Node.js släppte säkerhetsfixar 2026-10-21 (22.23.4 / 24.22.1 / 26.12.1).
De påverkar **inte** den här appen i drift. VoDImporterWeb är en statisk Vite/React-sajt
på Netlify; Node används bara vid bygge. Men `npm audit` den 2026-10-22 visade ett antal
gamla advisories i byggkedjan som är fixbara, plus xlsx som saknar fix på npm.

## Läge vid överlämning

- Branch `main`, i synk med `origin/main`, rent arbetsträd. Senaste commit: `a55d6ba labels som customtags3`.
- Lokal Node: 24.14.1 (ska uppgraderas till 24.22.1 separat, utanför detta repo).
- Låsta versioner: vite 7.3.1, xlsx 0.18.5, jszip 3.10.1.

## npm audit (2026-10-22)

| Paket | Allvar | Fix via `npm audit fix`? |
|---|---|---|
| vite 7.0.0–7.3.6 | high | ja (dev-server-buggar: path traversal, fs.deny-bypass, launch-editor) |
| postcss ≤8.5.22 | high | ja |
| browserslist ≤4.28.6 | high | ja |
| nanoid ≤3.3.17 | high | ja |
| source-map-js 1.0.0–1.2.1 | high | ja |
| baseline-browser-mapping <2.11.0 | moderate | ja |
| @babel/core ≤7.29.0 | low | ja |
| esbuild 0.27.3–0.28.0 | low | ja |
| xlsx 0.18.5 | high | **nej** (prototype pollution + ReDoS) |

Alla utom xlsx är devDependencies och rör bara dev-servern/bygget, inte den
publicerade sajten. Risken i drift är därför låg. Det är ändå städning som bör göras.

## Uppgift

1. Kör `npm audit fix` (utan `--force`). Kontrollera att vite landar på ≥7.3.7
   och att `npm run build` fortfarande går igenom.
2. Testa appen i riktig headless-webbläsare (Playwright, inte curl) efter
   uppdateringen: ladda upp en xlsx-fil och verifiera att mappningen i
   `src/lib/utils.ts` fungerar som förut.
3. Ta ställning till xlsx:
   - Används i `src/lib/utils.ts` (`XLSX.read`, `sheet_to_json`, `SSF.parse_date_code`)
     för att läsa användarens egen uppladdade Excel-fil **i webbläsaren**.
     Prototype pollution/ReDoS kan alltså bara drabba användaren själv med en fil
     hen själv valt. Låg praktisk risk.
   - SheetJS publicerar inte fixade versioner på npm längre, bara via egen CDN:
     `npm install https://cdn.sheetjs.com/xlsx-<version>/xlsx-<version>.tgz`
     (kontrollera aktuell version på docs.sheetjs.com innan). Alternativ är att
     byta till ett annat bibliotek, t.ex. `exceljs`, men det är en större ändring
     och inget krav.
   - Rekommendation: byt till CDN-tgz om Lars vill bli av med audit-varningen,
     annars lämna och dokumentera beslutet här.
4. Commit och push till `main`. Netlify bygger automatiskt från `main`
   (se `netlify.toml`).

## Att inte göra

- Ändra inte funktionalitet eller labels-mappningen i samma commit som
  beroendeuppdateringen.
- Kör inte `npm audit fix --force`; det kan hoppa major-versioner på vite/react.

Samma xlsx-fråga finns i `Dev/MagineComparator`, som dessutom har en Node-server
i drift och hanteras i separat chat.

## Utfört 2026-10-22

1. `npm audit fix` kört. vite 7.3.1 → 7.3.7, postcss 8.5.31, esbuild 0.28.2 m.fl.
   `npm run build` går igenom. Commit `c630437`.
2. Playwright-test (Chromium, `vite preview` av dist): xlsx med rubrikrad på rad 2,
   datum som Date-cell, Excel-serienummer och strängar (ISO och `åååå/mm/dd`),
   rader med status "Ej redo" och ogiltigt FilmID. Resultat: 2 rader importerade,
   datum, labels (Filmtyp/Plats/Övriga), genres, collections och Gratis mappade
   som förut. Inga konsolfel. Samma utfall före och efter xlsx-bytet.
3. xlsx bytt från npm-registry 0.18.5 till SheetJS CDN 0.20.3
   (`"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` i package.json).
   Fixar båda advisories (prototype pollution fixad i 0.19.3, ReDoS i 0.20.2).
   API:t som används (`read`, `sheet_to_json`, `SSF.parse_date_code`) är oförändrat.
   `npm audit`: 0 sårbarheter. Framtida uppgraderingar: byt versionsnumret i
   URL:en, ingen `npm update` hittar nya versioner.

Observerat men inte ändrat (ej beroenderelaterat): statusraden efter import
säger "0 nya och 0 uppdaterade" trots att rader skapas, eftersom räknarna
ökas inne i `setRows`-callbacken i `src/App.tsx` och läses innan den körts.
