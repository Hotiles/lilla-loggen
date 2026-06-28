# Lilla loggen

En liten **PWA** för att logga en bebis vardag: amning, blöjor, sömn, anteckningar och vikt.
Designad för hemskärmen – ett enda tryck loggar en amning, även mitt i natten.

## Funktioner

- **Amning** – live-timer med vänster/höger-sida, historik med varaktighet
- **Blöjor** – snabb-logg (Kiss, Bajs, Kiss+Bajs, Torr) med valfri anteckning
- **Sömn** – start/stopp-timer och logg
- **Vikt** – logg i gram med historik
- **Anteckningar** – fria textnoteringar
- **Export / import** – JSON-säkerhetskopia direkt från appen

## Integritet och data

All data sparas **enbart lokalt** i webbläsarens IndexedDB.
Inget konto, ingen server, inga molntjänster – datan lämnar aldrig enheten.

## Kom igång

Öppna appen i en webbläsare och välj "Lägg till på hemskärmen" för att installera den som en PWA.

För att hosta en egen kopia räcker det med vilken statisk webbserver som helst – inget byggsteg, inga npm-beroenden vid drift:

```bash
# Lokal server med Python
python3 -m http.server 8080
```

> HTTPS krävs för full PWA- och IndexedDB-funktionalitet i produktion.

## Teknik

- Ren HTML/CSS/JS utan externa runtime-beroenden – hela appen bor i `index.html`
- Service Worker (`sw.js`) för offline-stöd
- IndexedDB för lokal datalagring
- PWA-manifest för installation på hemskärm

## Tester

```bash
npm install
npm test              # kör Playwright e2e-tester i headless-läge
npm run test:headed   # med synlig webbläsare
```

## Bidra

Buggar och förbättringsförslag är välkomna som GitHub Issues.
Se [`CLAUDE.md`](CLAUDE.md) för kodkonventioner och designprinciper.
