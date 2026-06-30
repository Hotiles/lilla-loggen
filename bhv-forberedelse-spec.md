# BHV-förberedelse — funktionsspec för Lilla loggen (rev 2)

Underlag för dev-agent. Bygger vidare på den befintliga appen som den faktiskt ser ut idag:
en `index.html`, ett IndexedDB-`events`-store och ett `meta`-store, ren vanilla-JS, inget byggsteg.
Local-first, ingen ny backend, inga nya runtime-beroenden.

> **Grundregel för den här revisionen:** funktionen ska bygga på data som appen redan loggar.
> Vi inför inga nya loggningsflöden (sömnlängd, vakningar, flaska/ml, längd, huvudomfång) för
> att få den här featuren att fungera. Sådant ligger som **förbättringsidéer** sist i dokumentet.

---

## 0. Hur appen lagrar data idag (utgångsläge)

Allt ligger i **ett** objektlager `events` i IndexedDB, diskriminerat på `type`. Tider är
**millisekunder sedan epoch** (`Date.now()`), aldrig ISO-strängar.

| type | fält som finns idag |
|------|---------------------|
| `feed` | `ts` (start), `end`, `durMs`, `side` (`"Vänster"`/`"Höger"`/`""`), `note` |
| `diaper` | `ts`, `val` (`"Kiss"`/`"Bajs"`/`"Båda"`/`"Torr"`), `note` |
| `nap` | `ts` *(endast tidsstämpel — ingen längd)* |
| `nightsleep` | `ts`, `rating` (1–4, 4 = bäst), `note` *(ingen längd, inga vakningar)* |
| `weight` | `ts`, `val` (gram), `note` |
| `note` | `ts`, `note` |

`meta`-lagret innehåller bl.a. `name`, `birthDate` (`"YYYY-MM-DD"`), `birthWeight` (gram),
`birthLength` (cm), `theme`, `lastBackup`, `activeFeed`.

Återanvänd befintliga hjälpare: `uid()`, `put(STORE, …)`, `del(id)`, `allEvents()`,
`getMeta(k)`, `SLEEP_STATES`/`sleepState()`, `fmtDur`, `fmtHm`, `esc`, `toast`, `openSheet`,
`chipify`, mönstret `show(view)` och bottom-sheets.

---

## 1. Datamodell

Inga nya objektlager. BHV-datan lagras som **nya `type`-poster i samma `events`-store**, så att
export/import, undo-radering och den automatiska localStorage-snapshoten fungerar utan extra
arbete. Schemat och milstolparna är en **statisk konstant** i koden — inte data i lagret.

```
type:'visit'   (en post per BVC-besök som föräldern faktiskt rört)
  id            string   // uid()
  type          'visit'
  age           string   // schema-id, t.ex. "3man" — kopplar posten till bhvSchedule
  ts            number   // ms; bokad tid om satt, annars härledd måldag (för sortering i flödet)
  scheduledAt   number | null   // bokad tid i ms, null om inte bokad
  status        "upcoming" | "done"
  prep          PrepItem[]      // inbäddat, inget eget lager
  checked       string[]        // avbockade milstolpe-id:n
  outcome       Outcome | null
  createdAt     number   // ms

PrepItem (inbäddad fundering/fråga)
  id            string   // uid()
  text          string
  answered      boolean
  createdAt     number   // ms, för "dök upp senast"-sortering

Outcome (efter besöket, inbäddat i visit)
  weight        number | null   // gram (samma enhet som weight-event)
  notes         string
  nextVisitAt   number | null   // ms, bokad tid för nästa besök
```

**Vad som medvetet utelämnas (se förbättringsidéer):**
- Inget `childId` — appen stödjer ett barn. Barnets ålder härleds från `meta.birthDate`.
- Ingen `height`/`headCirc` i `Outcome` — appen loggar inte längd/huvudomfång löpande, så vi
  speglar dem inte här. Föräldern kan skriva mått i `outcome.notes` om hen vill.

**Sparsam persistens (viktig förenkling).**
Kommande besök *härleds* från `meta.birthDate` + det statiska `bhvSchedule` (se §3). Vi skapar
**inte** `visit`-poster i förväg. En post sparas först när föräldern faktiskt gör något med
besöket: lägger till en fundering, bockar av en milstolpe, eller fyller i utfall. Det betyder:
- Inget behov av att auto-skapa nästa `upcoming`-besök — schemat säger redan vad som kommer.
- `outcome.nextVisitAt` används bara för att visa/föreslå bokad tid, inte för att spawna poster.
- `ageLabel` cachas inte — det härleds från schemat (ingen risk för inaktuell cache).

**Funderingar utan att öppna ett besök.**
En fundering (`PrepItem`) ska kunna läggas till var som helst i BHV-vyn. Den hängs på nästa
kommande besök enligt schemat; finns ingen `visit`-post för det besöket ännu skapas en lazyt.

---

## 2. `summarizeForVisit` — funktionsspec

Ren funktion. Muterar inget, rör inte app-state. Exponeras på `window` så den kan enhetstestas
via Playwright `page.evaluate` (ingen ny testrunner, inget byggsteg).

```
summarizeForVisit(events, period, now)
  events: Array  // hela events-listan, samma format som allEvents() ger
  period: { from, to }   // ms-intervall (härlett av anroparen, se nedan)
  now:    number          // injicerat "nu" i ms (inga Date.now()-anrop inuti — testbarhet)
```

**Intervall (`period`) bestäms av anroparen, inte inuti funktionen:** från föregående *avslutade*
besöks `ts` till det aktuella besökets måldag. Finns inget tidigare avslutat besök: senaste 14
dygnen fram till `now`. Funktionen filtrerar bara `events` på `e.ts >= from && e.ts < to`.

**Returvärde — endast fält som går att räkna ur befintlig data:**
```
{
  period:  { from, to },
  feeding: {
    perDay,            // antal amningar / dygn
    avgMinutesPerFeed, // medel av durMs i minuter
    minutesPerDay      // total tid vid bröstet / dygn (durMs)
  } | null,
  diapers: {
    wetPerDay,         // Kiss + Båda  (samma logik som renderDiaperBreakdown)
    dirtyPerDay        // Bajs + Båda
  } | null,
  naps: {
    perDay             // antal tupplurar / dygn (nap har bara tidsstämpel)
  } | null,
  nightSleep: {
    avgRating,         // 1–4, snitt av rating
    label,             // sleepState(avgRating).l, t.ex. "Helt okej"
    nights             // antal loggade nätter i intervallet
  } | null,
  weight: {
    latest,            // senaste vikt (gram) i intervallet, eller null
    latestDate,        // ms
    deltaSincePeriodStart  // latest − tidigaste vikt i intervallet; null om < 2 vikter
  } | null
}
```

**Krav:**
- Tomt/glest intervall får inte krascha. Varje block returnerar `null` när det saknas data, så
  vyn kan visa "ingen data" istället för `0`/`NaN`. Vikt är ofta glest loggad — `deltaSincePeriodStart`
  blir `null` om färre än två vikter finns i intervallet.
- Medelvärden avrundas till en decimal (antal/dygn) respektive hela minuter (tid), i linje med
  hur statistik-vyn redan visar siffror.
- Per-dygn-värden normaliseras mot intervallets längd i dygn (`max(1, (to−from)/864e5)`), samma
  idé som `renderRhythm` redan använder.

**Enhetstesta:** normalfall, tomt intervall (allt `null`), glest viktintervall (en enda vikt →
`deltaSincePeriodStart === null`), samt att `now` styr beräkningen (inga dolda `Date.now()`).

> Medvetet **inte** med (kräver data appen inte loggar): sömntimmar/dygn, antal nattvakningar,
> uppdelning amning/flaska. Se förbättringsidéer.

---

## 3. `bhvSchedule` — besöksschema

Statisk array. Varje objekt:

```
{
  age:        string,    // kort id, "3man"
  ageLabel:   string,    // visningstext, "3 mån"
  ageInDays:  number,    // för matchning mot barnets ålder (från meta.birthDate)
  type:       "hembesök" | "mottagning",
  withDoctor: boolean,
  certainty:  "fixed" | "regional",   // fixed = nationellt bestämt, regional = varierar
  topics:     string[],
  milestones: Milestone[]
}
```

Hjälpfunktioner:
- `childAgeInDays(now)` → härleds ur `meta.birthDate` (returnera `null` om datum saknas → visa
  uppmaning att fylla i födelsedatum i Inställningar).
- `getVisitForAge(ageInDays)` → närmast relevanta kommande besök i schemat.

Sortera alltid på `ageInDays` (inte tabellordningen nedan) när besök listas.

### Vaccinations- och läkarbesök (certainty: "fixed")

Källa: Folkhälsomyndigheten / Rikshandboken (verifierat juni 2026 — behåll verifieringsnoten och
hänvisa alltid till 1177; appen gör inte BVC:s bedömning).

| Ålder | Typ | Läkare | Vaccin / innehåll |
|-------|-----|--------|-------------------|
| 4 veckor | mottagning | **ja** | Teambesök, somatisk undersökning. |
| 6 veckor | mottagning | nej | Rotavirus dos 1. EPDS för födande förälder. Utvecklingsuppföljning. |
| 3 mån | mottagning | nej | Rotavirus dos 2, pneumokock dos 1, hexavalent dos 1 (difteri/stelkramp/kikhosta/polio/Hib/hepB). |
| 5 mån | mottagning | nej | Rotavirus dos 3, pneumokock dos 2, hexavalent dos 2. |
| 6 mån | mottagning | **ja** | Teambesök, somatisk undersökning, utvecklingsuppföljning. |
| 12 mån | mottagning | **ja** | Pneumokock dos 3, hexavalent dos 3. Teambesök. |
| 18 mån | mottagning | nej | MPR dos 1 (mässling/påssjuka/röda hund). |
| 2,5 år | mottagning | **ja** | Teambesök. |
| 3 år | mottagning | **ja** | Teambesök. |
| 5 år | mottagning | nej | Påfyllnad difteri/stelkramp/kikhosta/polio. |

> Rättelse mot tidigare utkast: "4 veckor" var felplacerad efter 18 mån och låg utan att passa in
> i åldersordningen. Den hör till de tidiga läkar-/teambesöken (4 v) och ligger nu först.
> Dubbelkolla raden mot Rikshandboken vid implementation.

### Övriga sköterskebesök (certainty: "regional")

Varierar mellan regioner. Markera tydligt i UI:t.

| Ålder | Typ | Innehåll |
|-------|-----|----------|
| ~1 vecka | hembesök | Första besöket, ofta i hemmet. |
| 2 veckor | mottagning/hembesök | Uppföljning vikt, amning, mående. |
| 8 mån | hembesök | Ofta hembesök med fokus på barnsäkerhet. |
| 10 mån | mottagning | Utvecklingsuppföljning. |
| 4 år | mottagning | Strukturerat syn- och hörseltest. |

**UI-disclaimer (visa nära schemat):**
> "Tidpunkter och innehåll kan variera mellan regioner — din kallelse från BVC gäller. Aktuell
> information finns på 1177."

---

## 4. Milstolpar

```
Milestone {
  id:     string,
  text:   string,        // "Ler tillbaka"
  domain: "motorik" | "språk" | "socialt" | "kommunikation"
}
```

`domain` är frivilligt — för diskret gruppering/färgkodning så listan blir samtalsstöd, inte
provformulär. Avbockning sparas i `visit.checked` (array av milstolpe-id), bara om föräldern
faktiskt bockar.

**Hjälptext per lista (visa i UI:t):**
> "Barn utvecklas i olika takt — det här är samtalsunderlag, inte en checklista att klara av."

### Innehåll per ålder

**1–4 veckor** — Fäster blicken kort, reagerar på ljud, börjar få dygnsrytm, äter och går upp i vikt. (Mest samtalsämnen, inte milstolpar.)

**6 veckor** — Tittar mot ansikten; börjar le i kontakt (socialt leende); lyfter huvudet en stund i magläge; följer föremål med blicken en bit.

**3 månader** — Ler tydligt tillbaka; joller och olika ljud; håller huvudet stadigt; för händerna till mitten/munnen; tittar på sina händer.

**5 månader** — Sträcker sig efter och greppar föremål; rullar åt något håll; gensvarar med ljud i "samtal"; nyfiken på omgivningen.

**6 månader** — Sitter med visst stöd; för saker till munnen; byter föremål mellan händerna; vänder sig mot ljud och röster; skrattar.

**8 månader** — Sitter stadigt utan stöd; börjar förflytta sig (åla/kravla); jollrar med stavelser ("ba-ba", "da-da"); främlingsrädsla (normalt).

**10 månader** — Reser sig mot möbler; pincettgrepp (tumme–pekfinger); förstår enkla återkommande ord; härmar ljud och gester (vinka).

**12 månader** — Tar sig fram längs möbler eller börjar gå; säger kanske enstaka ord med betydelse; pekar på det den vill ha; förstår enkla uppmaningar.

**18 månader** — Går säkert; säger flera ord; pekar på kroppsdelar/bilder vid fråga; dricker ur mugg; delar uppmärksamhet ("titta!").

**2,5–3 år** — Springer; sätter ihop två–tre ord till meningar; leker låtsaslek; äter och klär av sig delvis själv; känner igen sig själv.

**4 år** — Förstås av andra i tal; hoppar och balanserar; ritar enkel figur; klär på sig mestadels själv; leker med andra barn. (Strukturerat syn- och hörseltest ingår.)

**5 år** — Berättar sammanhängande; klipper med sax; tecknar igenkännbara figurer; klär sig själv; samspelar i regellekar.

---

## 5. UI-struktur (vanilla, ingen komponentramverk)

Appen har ingen komponentmodell — vyer är `<section class="view">` som växlas med `show(view)`,
och "komponenter" byggs som bottom-sheets via innerHTML i `openSheet`. BHV ska följa samma idiom:

- **Ny vy `view-bhv`** + ett fjärde nav-objekt (`nav-bhv`). OBS: bottom-nav har idag tre knappar
  (Hem/Statistik/Inställningar) — en fjärde påverkar avstånden, kontrollera layout. Alternativ:
  lägg ingången som ett kort i en befintlig vy om fyra nav-knappar blir trångt.
- **Besökslista** i vyn: kommande (härledda från schema + `birthDate`) + tidigare (`status:"done"`).
  Markera `certainty:"regional"` visuellt och visa disclaimern.
- **Besöksdetalj** (kan vara en egen vy eller ett stort sheet):
  - Funderingar/frågor (lägg till / bocka av) → `visit.prep`
  - Åldersanpassade samtalsämnen (statiskt, `bhvSchedule.topics`)
  - Milstolpelista (mjukt formulerad, avbockning → `visit.checked`)
  - Auto-summering (`summarizeForVisit`) med "ingen data"-fallback per block
  - Utfallsformulär (fylls i efter besöket) → `visit.outcome`
- **Lägg-till-fundering** ska nå nästa kommande besök utan att gå in i det.

Bygg sheets med befintliga klasser (`.sheet`, `.field`, `.chip-row`, `chipify`) och spara via
`put(STORE, …)` precis som övriga loggningsflöden.

---

## 6. Export/import, snapshot och cache (får inte glömmas)

- `visit`-poster ligger i `events`-storet → de följer redan med `collectData()`/`applyData()` och
  den automatiska localStorage-snapshoten. **Verifiera** att export → wipe → import återställer
  besök, funderingar, avbockningar och utfall. Detta är hela backup-skyddet (CLAUDE.md).
- Bumpa `CACHE` i `sw.js` (idag `lillaloggen-v16` → `-v17`) vid release, annars serveras gammal
  cache.

---

## 7. Tester

Lägg `tests/bhv.test.js` (Playwright/Chromium, samma `freshPage`-mönster) och listan i CLAUDE.md.
Täck minst:
- `summarizeForVisit` via `page.evaluate`: normalfall, tomt intervall (`null` per block), glest
  viktintervall, injicerat `now`.
- `getVisitForAge` / `childAgeInDays` mot olika `birthDate`.
- Lägg till fundering → hängs på rätt kommande besök → överlever omladdning.
- Bocka av milstolpe → sparas och överlever omladdning.
- Fyll i utfall → besöket flyttas till "tidigare".
- Export → wipe → import återställer all BHV-data.

Kör `npm test`; föreslå ingen PR om något test är rött.

---

## 8. Förbättringsidéer (utanför scope nu — kräver ny datainsamling)

Dessa är medvetet **borttagna** ur kärnspecen eftersom appen inte loggar underlaget idag. De kan
bli egna features senare och då matas in i `summarizeForVisit`/utfallet:

- **Sömntimmar och nattvakningar.** Idag har `nap` bara en tidsstämpel och `nightsleep` bara ett
  betyg (1–4). För `avgHoursPerDay`/`avgNightWakings` krävs start/slut på sömn och en
  vakningsräknare — ny loggning.
- **Uppdelning amning/flaska + ml.** Flask-/pumpningsloggning finns inte; alla `feed` är bröst.
  Krävs för `feeding.breakdown`.
- **Längd och huvudomfång över tid.** Appen loggar vikt (gram) men inte längd/huvudomfång som
  tidsserie. Kan läggas som egna `type`-poster och då visas i utfall + statistik.
- **Spara uppmätt vikt från utfallet som en `weight`-post**, så BVC-mätningen syns i viktgrafen
  (liten, men kräver en medveten koppling).

---

## 9. Källor & verifiering

- Vaccinationsåldrar och MPR/påfyllnad: Folkhälsomyndigheten, barnvaccinationsprogrammet.
- Rotavirus (RotaTeq, 6 v / 3 mån / 5 mån): Rikshandboken.
- Läkar-/teambesök (4 v, 6 mån, 12 mån, 2,5 + 3 år): Rikshandboken.
- Regional variation i antal läkar- och sköterskebesök är dokumenterad — därav `certainty`-fältet.

> Milstolpsformuleringarna är en rimlig sammanställning, inte ordagrant hämtade från ett officiellt
> instrument. BVC använder strukturerade verktyg (BHV-påsen m.m.) vid de formella bedömningarna.
> Hänvisa till 1177 för aktuell information.
