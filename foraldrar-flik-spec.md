# Föräldrar-fliken — koncept och byggspecifikation (rev 2)

Underlag för dev-agent. En funktion som hjälper föräldrar planera ledigheten så att
**SGI:n** (sjukpenninggrundande inkomst) hålls skyddad hos Försäkringskassan.

Den här revisionen är **grundad i appen som den faktiskt ser ut idag**: en `index.html`,
ett IndexedDB-`events`-store och ett `meta`-store, ren vanilla-JS, inget byggsteg,
local-first, inga nya runtime-beroenden. Ursprungskonceptet (`foraldrarkoncept.md`)
beskrev en datamodell appen inte har — den här specen rättar det.

> **Grundregel för den här revisionen:** funktionen ska vägleda, inte ge besked, och bygga
> på den datamodell appen redan har. Vi inför inga nya objektlager. Reglerna mot
> Försäkringskassan behandlas som **daterade, tydligt märkta konstanter** — aldrig som
> uträknade kronbelopp.

---

## 0. Hur appen lagrar data idag (utgångsläge)

- **Ett** objektlager `events` (loggade händelser, diskriminerat på `type`, tider i ms).
- **Ett** lager `meta` (singletons): `name`, `birthDate` (`"YYYY-MM-DD"`), `birthWeight`,
  `birthLength`, `theme`, `lastBackup`, `activeFeed`.
- Det finns **inget "barnprofil-objekt"** — barnets data är flata `meta`-nycklar.
- Bottom-nav har **4 flikar** (`index.html` ~377): Hem, Statistik, BVC, Inställningar.
  Mönstret är `show(view)` + `<section id="...">`.

Återanvänd befintliga hjälpare: `getMeta(k)`, `put(META,{k,v})`, `put(STORE,…)`,
`allEvents()`, `show(view)`, `toast`, `esc`, `fmtHm`, samt bottom-sheet-mönstret.

### ⚠️ Viktigt om backup (grundprincip #4)

`collectData()` och `applyData()` (`index.html` ~1164–1178) **räknar upp varje `meta`-nyckel
för hand** — de sveper inte hela `meta`. Nya nycklar hamnar därför **utanför export/import
och localStorage-snapshoten** om de inte läggs till explicit. All ny `meta`-data i den här
featuren **måste** därför wiras in i båda funktionerna. Detta är en del av definitionen av
"klar", inte en efterhandsdetalj.

---

## 1. Datamodell — `meta`-nycklar, inte nya objektlager

Föräldradatan är **konfiguration (singletons)**, inte tidsstämplade loggposter, så den hör
hemma i `meta`. Lagras som ett fåtal nycklar:

| nyckel | innehåll | lager |
|--------|----------|-------|
| `hushall` | `{ foraldrar:[{id, etikett}], ... }` — gemensamt, oberoende av barn | 1 |
| `sgiProfil` | `{ arbetstidsgrad, ... }` per förälder | 1 |
| `sgiLon` | `{ manadslon, kollektivavtal }` — **frivilligt**, bara för takflaggning | 2 (senare) |
| `sgiPlan` | veckoplan `[{ vecka, fpDagar, arbetstid }]` | 3 (senare) |
| `sgiSaldo` | `{ perForalder:[{id, dagar}], uppdaterad }` — manuellt inmatat | 4 (senare) |

Designval att hålla fast vid:

- **Återanvänd `birthDate`** ur `meta` — duplicera aldrig barnets födelsedatum.
- **Singleton, men framåtkompatibelt.** Appen har idag *ett* barn. Bygg inte
  syskon-/hushållshierarki nu, men håll nycklarna så att en framtida barn-id-prefix
  (`sgiPlan:<childId>`) går att införa utan migration av lager 1-data.
- **Arbetstid lagras per vecka** (i `sgiPlan`), inte per förälder — den ändras över tid.
- **Dagsaldo matas in manuellt** (FK saknar öppet API). Spara `uppdaterad`-datum och
  påminn mjukt. Räkna **aldrig** ner saldot automatiskt från planen — falsk precision.
- **Export/import:** lägg till varje ny nyckel i `collectData()` och `applyData()`.

---

## 2. Grundprincip: vägledning, inte besked

- **Inga** kronbelopp. **Inte** tolka alla undantag (röda dagar, semester på deltid).
  **Inte** ersätta FK:s bedömning.
- Alltid en **synlig disclaimer** som länkar till `forsakringskassan.se`.
- Reglerna lever som **daterade konstanter** med årtal i UI ("Regler enligt FK, kontrollerade
  ÅÅÅÅ-MM"), så att felaktiga eller föråldrade siffror är synliga och lätta att uppdatera.

---

## 3. v1 — det vi bygger nu (minsta värdefulla skiva)

Placering: **egen 5:e flik "Föräldrar"** i bottom-nav.

### 3.1 Navigering (5 flikar)
- Lägg `<button id="nav-foraldrar" onclick="show('foraldrar')">` med kort etikett +
  ikon (t.ex. 👪) och en `<section id="foraldrar">`.
- 5 flikar tränger ihop touch-ytorna. Korta etiketter, behåll vertikal ikon+text,
  kontrollera mot safe-area och små iPhone-bredder. Detta är en medveten avvägning mot
  appens stora-knappar-ethos — håll knapparna så stora som layouten tillåter.

### 3.2 Föräldraprofil — Lager 1 (enda obligatoriska lagret)
Liten, utfällbar panel högst upp i fliken:
- antal föräldrar + etikett (t.ex. "Förälder 1 / Förälder 2", redigerbart),
- arbetstidsgrad per förälder,
- barnets födelsedatum **ärvs** från `birthDate` (visas, redigeras i Inställningar som idag).
- Trygghetssignal i UI: **"Sparas bara på den här enheten."**

### 3.3 SGI-status (en enda signal)
En lugn statusruta driven av barnets ålder + Lager 1, **inte** en redigerbar tidslinje:
- före ettårsdagen → "Auto-skyddad fram till ettårsdagen (ÅÅÅÅ-MM-DD)".
- efter ettårsdagen → soft varning om reglerna kring helt ledig / deltidsgapet, med
  konkret åtgärdstext men **utan** kronor.
- Tydlig "kontrollera mot FK"-länk i samma ruta.

### 3.4 Checklista + FK-länkar
Statisk checklista (konstant i koden) med djuplänkar till rätt FK-sidor: anmäl
föräldrapenning, undvik anställningsglapp, "skyddsdagar runt ettårsdagen". Lågrisk, hög nytta.

---

## 4. Senare faser (inte v1)

5. SGI-planeraren: veckorutnät (grön = skyddad, gul = åtgärd, streckad = före ettårsdag)
   med redigerbar fp-dagar/arbetstid per vecka. **Förutsätter att reglerna i §6 är verifierade.**
6. Lager 2: lön/kollektivavtal → flagga SGI-tak (aldrig ersättningsbelopp).
7. Lager 3: dagsaldo (480 dagar, 90 öronmärkta var), manuell inmatning + mjuk påminnelse.
8. Påminnelser kring ettårsdagen.

---

## 5. Datakänslighet

Lön och föräldrarelationer är personligt. Local-first är säljargumentet: gör
"Sparas bara på den här enheten" till en **synlig** signal, precis som FK:s egna
kalkylatorer. Lager 2- och 3-data är **alltid frivilligt**. Notera att exportfilen är
ren JSON i klartext — lön hamnar där om den fylls i; nämn det vid exportflödet om Lager 2 byggs.

---

## 6. ⚠️ Verifiera mot Försäkringskassan innan skarp drift (pre-ship gate)

Måste bekräftas mot forsakringskassan.se. Gäller särskilt innan planeraren (fas 5) byggs.
v1:s statussignal ska formuleras mjukt nog att tåla osäkerhet här.

- [ ] Deltidströskeln — hur mycket uttag som krävs för att fylla arbetstidsgapet.
- [ ] 5-dagarsregeln vid helt ledig efter ettårsdagen, inkl. om röda dagar räknas.
- [ ] Hur veckan kring ettårsdagen behandlas.
- [ ] Att lägstanivådagar skyddar SGI lika bra som sjukpenningdagar.
- [ ] Anställningsglapp-regeln (nämns i checklistan).
- [ ] Årsberoende siffror (SGI-tak, dagantal) — uppdateras varje år, lagras daterade.
- [ ] Röda dagar / semester på deltid — medvetet ej automatiserat, hänvisa i infotext.

---

## 7. Övrigt vid bygge

- **`sw.js`:** ny `index.html` betyder bumpa `CACHE` (nu `lillaloggen-v19` → `-v20`).
  Inga nya assets/filer behövs — allt ryms i `index.html`.
- **Tester:** lägg `tests/foraldrar.test.js` enligt befintligt Playwright-mönster:
  Lager 1 sparas och överlever omladdning, status växlar korrekt runt en simulerad
  ettårsdag (sätt `birthDate`), och **att profil-datan följer med export/import**.
- **Språk:** svenska genomgående. Ton: lugn gryningspalett, stora knappar.

---

## 8. Byggordning (v1)

1. 5:e flik + tom `Föräldrar`-vy, `show('foraldrar')`.
2. Lager 1-profil i `meta` (`hushall`, `sgiProfil`) + wira in i `collectData`/`applyData`.
3. SGI-statussignal mot `birthDate` + Lager 1.
4. Checklista + FK-länkar + disclaimer.
5. `tests/foraldrar.test.js`, bumpa `sw.js`-cache, kör `npm test` grönt.
