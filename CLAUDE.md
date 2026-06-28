# CLAUDE.md – Lilla loggen

## Vad det här är
En liten **PWA** för att logga en bebis vardag: amning, blöjor, sömn, anteckningar och vikt.
Byggd åt min fru att ha på hemskärmen. Hålls medvetet enkel och snabb att använda —
det viktigaste är att kunna logga en amning med ett enda tryck, även mitt i natten.

## Grundprinciper (bryt inte mot dessa)
- **Lokal-först.** All data sparas i webbläsarens IndexedDB på användarens telefon.
  Inget konto, ingen backend, inget moln. Ingenting får läcka till nätverk eller tredje part.
- **Offline ska alltid funka.** Service workern (`sw.js`) cachar appen. Lägg inte till
  externa beroenden, CDN-länkar eller fonter som kräver nätverk.
- **Inga externa runtime-beroenden.** Ren HTML/CSS/JS i en fil. Inget byggsteg, ingen npm
  vid drift. Detta gör den lätt att hosta som statiska filer och lätt att lita på.
- **Backup via export/import.** Eftersom datan bara lever lokalt är JSON-export
  (Inställningar → Exportera) det enda backup-skyddet. Bevara det flödet.

## Filstruktur
- `index.html` – hela appen (UI + logik + IndexedDB) i en fil
- `manifest.json` – PWA-manifest (installerbar på hemskärm)
- `sw.js` – service worker för offline-cache. Höj `CACHE`-versionen vid ändringar
  så klienter hämtar ny version.
- `icon-192.png`, `icon-512.png`, `icon-180.png` – appikoner
- Relativa sökvägar (`./...`) används överallt så appen funkar i en GitHub Pages-undermapp.

## Design
- Språk: **svenska** genomgående (UI, copy, commits gärna).
- Ton: lugn, varm "gryningspalett" (krämvit, dov rosa, plommon). Stora touch-vänliga knappar.
- Signaturelement: den levande amningstimern på startsidan.
- Behåll tabular-nums på timers/tider. Respektera safe-area-insets (iPhone-notch).

## Hosting
- Driftas som **publik GitHub Pages** (gratis). HTTPS krävs för att PWA + IndexedDB ska funka.
- Koden är publik, men **datan är det inte** – den lämnar aldrig telefonen.

## Bra att veta vid ändringar
- När `sw.js` cachelista eller någon asset ändras: **bumpa `CACHE`-namnet** (t.ex. `-v2`),
  annars serveras gammal cache.
- Testa alltid: starta amning → byt sida → avsluta → syns i flödet → överlever omladdning.
- Håll allt i en `index.html` om det går; dela inte upp i moduler utan god anledning.

## Idéer på kö (be mig om dessa vid behov)
- Graf över vikt och amningar över tid
- D-vitamin-/medicinpåminnelse
- Flask-/pumpningsloggning (ml)
- Sammanfattning att visa för BVC
