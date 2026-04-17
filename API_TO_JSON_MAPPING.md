# API-fält och hämtlogik

Det här dokumentet beskriver enbart de fält som hämtas från Film-API:t, exakt vilka API-fält som används, och vilken logik som gäller vid hämtningen.

Parsern finns i:

- `src/lib/filmApi.js`

## Titel

### JSON-fält

- `title`

### API-källa

- `Title`
- `title.type`
- `title_complete`

### Hämtlogik

1. Leta i `Title[]` efter post där `title.type` innehåller exakt `Vod-titel i Sverige`
2. Om ingen träff finns: leta efter post där `title.type` innehåller exakt `Svensk premiärtitel`
3. Ta värdet från `title_complete`

## Originaltitel

### JSON-fält

- `customTags1`

### API-källa

- `Title`
- `title.type`
- `title_complete`

### Hämtlogik

1. Leta i `Title[]` efter post där `title.type` innehåller exakt `Originaltitel`
2. Ta värdet från `title_complete`

## Dialogspråk

### JSON-fält

- `customTags2`

### API-källa

- `Language`
- `language.usage`
- `language`

### Hämtlogik

1. Gå igenom `Language[]`
2. Ta bara poster där `language.usage` innehåller exakt `Dialogspråk`
3. I varje sådan post:
   - försök först hitta språkvariant där `lang = "sv-SE"`
   - om ingen svensk variant finns, använd första språkvarianten
4. Lägg till språkets textvärde i resultatlistan
5. Dubletter filtreras bort

## Skådespelare

### JSON-fält

- `cast`

### API-källa

- `Cast`
- `cast.name`
- `forename`
- `surname`
- `name`

### Hämtlogik

1. Gå igenom `Cast[]` i ordning
2. Bygg namn i följande prioritet:
   - `forename + surname`
   - annars `name`
   - annars de delar som finns
3. Ta endast de tre första unika namnen

## Regissörer

### JSON-fält

- `directors`

### API-källa

- `Credits`
- `credit.type`
- `credit.name`
- `forename`
- `surname`
- `name`

### Hämtlogik

1. Gå igenom `Credits[]`
2. Ta bara poster där `credit.type` innehåller exakt `Regi`
3. Bygg namn i följande prioritet:
   - `forename + surname`
   - annars `name`
   - annars de delar som finns
4. Lägg till unika namn i resultatlistan

## Produktionsland

### JSON-fält

- `countriesOfOrigin`

### API-källa

- `ProdCountry`
- `production_country`

### Hämtlogik

1. Gå igenom `ProdCountry[]`
2. Ta första tillgängliga värdet i `production_country`
3. Exportera det som en array med ett element

## Premiärår

### JSON-fält

- `productionYear`

### API-källa

- `Dating`
- `dating.type`
- `dating.date.start`

### Hämtlogik

1. Gå igenom `Dating[]`
2. Ta bara poster där `dating.type` innehåller exakt `Premiär`
3. Läs `dating.date.start`
4. Extrahera första fyrsiffriga årtalet
5. Exportera det som heltal
