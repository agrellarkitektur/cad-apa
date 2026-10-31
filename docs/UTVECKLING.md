# Så byggs programmet ut

Programmet ska kunna växa i många små steg utan att det som redan finns går
sönder. Det här är reglerna som gör det möjligt.

## Lagren och vem som får prata med vem

```
ui/        knappar, paneler, verktyg     → får läsa allt, ändrar bara via kommandon
view2d/    skärmen                       → ritar primitiver, vet inget om väggar
repr/      planen och (senare) 3D        → frågar elementtyperna, lägger på grafik per vy
elements/  en fil per objekttyp          → regler för just den typen
core/      datamodell, tillstånd, ångra  → vet ingenting om ritning eller gränssnitt
storage/   filformat, autospar           → läser och skriver core-dokumentet
```

Pilen går bara nedåt. `core/` importerar aldrig från något annat lager, utom
ren matematik i `geometry/` (väggens ram och bågar). Då går kärnan att testa
ensam och att återanvända, till exempel i en objektredigerare.

## Lägga till en ny objekttyp

Exempel: trappa.

1. Skapa `src/elements/stair.ts` med en `ElementType`: namn, förval,
   ritordning och en `plan()`-regel som returnerar primitiver.
2. Lägg till en rad i `src/elements/index.ts`.
3. Klart. Ångra, autospar, filformat, egenskapspanelen och jämförelsegrafiken
   (befintligt, rivs, nytt) fungerar automatiskt, eftersom de bara arbetar med
   generiska element.

Typer som ska ritas tillsammans (som väggar som flyter ihop i skarvarna)
använder `planBatch()` i stället för `plan()`. `pickShape()` anger ytan som
gäller när man klickar. `typeParams` anger vilka mått som hör till typen
(littera) och delas av alla element av den.

`planReads` (0.8.3) anger vilka andra typers element planen läser: `[]` för
en typ som bara ritar sig själv (möbler, text, 2D, underlag), en lista som
`['Wall', 'hosted']` för väggar (skarvar och öppningar). Planen sparar varje
typs ritning och räknar om den bara när dess egna element eller det den
läser ändrats. Saknas `planReads` räknas typen om vid varje ändring, vilket
alltid är rätt men långsammare. Läser `plan()` något annat i projektet än
elementen (definitioner, filer, tillstånd) behövs inget: då börjar cachen om.

Elementtyperna ritar bara former. Färger, fyllningar, streckning och
dörrvinklar för befintligt, rivs och nytt kommer från stilmallen
(`src/core/graphics.ts`) och läggs på i `src/repr/plan.ts`.

3D ritas med `model3d()` eller `model3dBatch()`, som returnerar lodräta
extruderingar (`src/repr/solids.ts`). 3D-vyn vet ingenting om elementtyperna.
En form kan ha genomgående urtag (`cuts`); den byggs då av `solidTriangles()`
i `src/repr/mesh.ts` som en hel kropp med hål, vilket väggar använder för
dörrar och fönster. Kantlinjer kan levereras separat som `Edges3D`.

Redigering i 3D går genom samma kommandon som planen (`moveWallEnd`,
`moveElements`). 3D-vyn får ett `Edit3DHost` från appen med grepp, snäppning
och vad som ska hända när ett drag släpps.

Senare får `ElementType` fler valfria regler: `elevation()` för
förhandsbilder i förteckningar, `ifc()` för export. En typ som saknar en regel
visas helt enkelt inte i den vyn.

## Ändra filformatet

Före formatfrysen (den öppna betan, se PLAN.md) räcker det att höja
`FORMAT_VERSION` i `src/core/model.ts`. Inga nya migreringar skrivs: en fil
i ett äldre format ger meddelandet att den kommer från en äldre alfaversion
(`parse` i `src/storage/format.ts`), och ett autospar som inte går att läsa
läggs åt sidan, inte bort. Migreringarna till och med format 5 togs bort med
format 6 (0.8.6), eftersom ingen fil når nuvarande format genom dem; de finns
i git.

Efter formatfrysen gäller detta igen:

1. Höj `FORMAT_VERSION` i `src/core/model.ts`.
2. Lägg till en migrering i `src/storage/format.ts` som gör om en fil från
   förra versionen till den nya.
3. Lägg till ett test som öppnar en fil i den gamla versionen.

Gamla projekt öppnas då alltid. Element av typer som programmet inte känner
till ligger kvar orörda i filen, så att en fil från en nyare version inte
förstörs om den öppnas i en äldre.

Autosparet (`src/storage/localStore.ts`) sparar formatnumret bredvid texten.
Sedan 0.6.2 vägrar en version att skriva över ett autospar i ett nyare format
än det den kan läsa; kontrollen görs i samma transaktion som skrivningen.
Versioner till och med 0.6.1 saknar skyddet. När `FORMAT_VERSION` höjs till 4
bör den nya versionen därför också lägga en kopia av sitt autospar under en
egen nyckel (t.ex. `format-4`) och läsa den om `current` har skrivits över av
en gammal version.

## Lägga till ett kommando

Alla ändringar av projektet görs i `src/core/commands.ts` med
`store.transact(namn, tx => …)`. Namnet syns vid ångra. Inom en transaktion
läser man `tx.doc` och skriver med `tx.putElement`, `tx.removeElement` med
flera. Allt blir ett enda ångra-steg.

Gränssnittet anropar aldrig `tx` direkt och ändrar aldrig dokumentet på annat
sätt.

Sedan 0.8.1 kopierar en transaktion `elements`, `definitions` och `assets`
en gång och ändrar dem sedan på plats, så att stora ändringar inte växer med
kvadraten. `tx.doc.elements` är därför samma objekt genom hela
transaktionen: använd inte cachar som minns ett resultat per
`doc.elements` (som `outsideSide` i `src/elements/wallSides.ts`) inne i en
transaktion. Dokumentet som sparas byggs om när transaktionen är klar.

## Lägga till ett verktyg eller en panel

Verktyg ligger i `src/ui/tools/` och implementerar `ViewTool` från
`src/view2d/planView.ts`: de får tryck, drag och släpp i modellkoordinater och
ritar hjälpgrafik i `overlay()`. Panorering och zoom sköter planvyn själv, så
inget verktyg behöver bry sig om det. Snäpp finns i `src/ui/tools/snap.ts`.

Paneler läser `store.doc`, lyssnar med `store.subscribe` och ändrar via
kommandon. Verktyg som inte är byggda än står i verktygsfältet med den
version de kommer i (se [PLAN.md](PLAN.md)).

### Appen: `src/ui/app.ts` och `src/ui/app/`

`mountApp` i `src/ui/app.ts` bygger appen: skapar planvyn, panelerna och
dialogerna, och har det som binder ihop dem (verktygens `host`, Modifiera
och smartmenyn, markeringen). Resten ligger i `src/ui/app/`, en fil per del
(sedan 0.8.11 också verktygen och ritningen):

| Fil | Innehåll |
| --- | --- |
| `shell.ts` | Stommen (HTML för topprad, verktygsrad, rityta och statusrad), verktygslistan `TOOLS`, `ToolId`, `ViewMode` och `createUiState` (det som visas just nu) |
| `tools.ts` | Verktygsraden och ett objekt per verktyg, `setTool`, `toolFor`, Avbryt, Zooma till område, Rikta efter objekt och Ny vägg härifrån (0.8.11) |
| `render.ts` | `renderAll`: planen, fasaden, sektionen, arbetsbladet eller bladet som visas, `viewStates`, stilmallen, utropstecknen vid sneda vinklar och måttrutan (0.8.11) |
| `helpers.ts` | Små hjälpare: talformat, förvalda typer och tillstånd, vybeskrivning, skala |
| `context.ts` | `AppContext`: det delarna behöver av varandra, och `lazyContext` som bygger det |
| `actions.ts` | Knapparna: klick på `data-action`, Visa-menyn och huvudmenyn; tillståndsflikarna och Jämför med |
| `treeClicks.ts` | Klick i projektträdet: flikarna, våningar, vyer, markörer, arbetsblad, blad (Ctrl- och Shift-klick), underlag och mappar (0.8.23, ur `actions.ts`) |
| `panes.ts` | Dockan med projektträdet och egenskaperna: bredd, öppen, minimerad till band eller stängd (och bladet på telefonen) |
| `pane3d.ts` | 3D-vyn: läget (`setMode`), redigering i 3D, Följ sektionen |
| `files.ts` | Autospar och dess status, Spara, Öppna, Nytt projekt, Börja om med exemplet |
| `textEdit.ts` | Dubbelklick i ritningen: text, rumsnamn, öppna en fasad eller sektion |
| `snapping.ts` | Det verktygen snäpper mot, i planen och i fasader, sektioner och arbetsblad |
| `toolOptions.ts` | Verktygsraden under ritytan och måttbandets värden |
| `views.ts` | Vyhistorik, `goTo`, sparade vyer med deras inställningar (`applyView`, `viewModified`) och menyerna för vyer och markörer |
| `showMenu.ts` | Visa-menyn med kalkeringens utseende |
| `showKeys.ts` | Det som kan tändas och släckas under Visa: `SHOW_GROUPS`, `isShown`, `setShown`, `traceStoreyOptions` (granskningen efter 0.10.15, ur `showMenu.ts`) |
| `scalePop.ts` | Skärmskalan i statusraden (granskningen efter 0.10.15, ur `showMenu.ts`) |
| `menus.ts` | Högerklick och långt tryck i plan, 3D och projektträdet |
| `keyboard.ts` | Kortkommandona |
| `clipboard.ts` | Kopiera, klipp ut och klistra in |
| `underlays.ts`, `sheets.ts`, `plot.ts` | Underlag, ritningsblad och Plot/export (0.8) |
| `sheetTool.ts`, `sheetGeometry.ts` | Markera, flytta och dra i ramen på ett blad; fästning och var en ny vy får plats (0.8.11, ur `sheets.ts`) |
| `commandLine.ts` | Smartshell: fältet, kommandona, listan och menyerna (0.8.20–0.8.21) |
| `prompts.ts` | Frågan med alternativ för det som pågår (0.8.21) |
| `shellPoints.ts`, `shellLog.ts`, `shellDock.ts`, `shellHint.ts`, `shellActions.ts` | Smartshells läge och skrivna punkter, historiken, var raden ligger, frågans text och kommandona som gör något direkt (0.8.23, ur `commandLine.ts`) |

Varje del är en funktion `installX(app)` som anropas en gång i `mountApp`
och lämnar tillbaka det som andra delar använder. `app` byggs med
`lazyContext`, en rad per fält, och varje fält läses när det används, så
delarna ser alltid det som gäller just då (planen och 3D-vyn byts ut).
Hämta därför med `app.x` där det används, inte en gång i början av
`installX` (det som aldrig byts ut, som `app.ui` och `app.panel`, går bra).
Behöver en del något nytt: lägg till det i `AppContext` och i
`lazyContext`-raden i `mountApp`. En del som behöver en annan del direkt
får den som argument (`installActions(app, { views, sheets, … })`).

En ny del av gränssnittet läggs som en egen fil här i stället för i
`app.ts`, så att filerna hålls små.

## Tester

`npm test` kör testerna i `tests/`. Varje regel som rör data ska ha ett test:
hur åtgärder räknas ut, att ångra återställer exakt, att filer läses utan
förlust. Ritregler kontrolleras genom att titta på dem, och med
referensritningarna (0.8.2).

**Test som mäter tid** ligger i `tests/prestanda.test.ts`. Den filen körs
ensam efter alla andra (två projekt i `test.projects` i `vite.config.ts`,
med `sequence.groupOrder`), eftersom GitHub kör flera testfiler samtidigt
och en klocka som delar processorn med dem mäter fel; så föll releaserna
v0.8.2 och v0.8.3. Test som tar mer än någon sekund får en egen tidsgräns
(vitests förval är 5 s). Prova under trängsel med
`npx vitest run --maxWorkers=4`.

**Referensritningar** (`tests/referens.test.ts`): planer, fasader,
sektioner, 3D och ett blad för exemplet, ett rutnät av rum och (0.8.32)
exemplet med 2D-former och egna pennor (`shapesProject`, sedan 0.8.38
också fyllningstyperna, tegel som snittfyllning och en borttagen typ),
och (0.8.38) exemplet med olika detaljnivåer för littera, 2D och 3D
(`nivaer-*`) och (0.9.3) exemplet med två våningar (`tva-*`) skrivs som text,
en rad per primitiv (koordinater avrundade till 0,1 mm), och jämförs mot
facit i `tests/referens/`. Raden visar också fyllningens mönster (med
fasen, 0.8.38), opacitet och bakgrund, om primitiven ligger under modellen (`under`) och
var streckningen börjar (`dashFrom.at`). Ändras en ritning med avsikt
skrivs nytt facit med `npx vitest run tests/referens.test.ts -u`; titta
på skillnaden i git innan den läggs in.

**Testprojekt och hjälpfunktioner** ligger i `tests/projekt.ts` (0.8.32):
`wallGrid`, `roomGrid`, `shapesProject` och `twoStoreys` (0.9.3); `storeWithShapes` (exemplet
med 2D-former, med `order`), `planOf`, `square` och `SHAPE`;
`wallsProject` och `wallEnds` (tomt projekt med väggar och linjer, för
Modifiera); `toolHost` (det ritverktygen behöver utan webbläsare); `dxf`
(en liten DXF-fil). Använd dem i stället för att skriva en egen kopia.

**Typkontroll**: `tsconfig.json` tar med `tests` sedan 0.8.32, så `npx tsc
--noEmit` kontrollerar också testerna (en 2D-form med `shape: 'rect'` från
före format 13 syntes så). Node-typerna finns inte; `tests/node.d.ts`
deklarerar det testerna använder av `node:fs`. En fil läses hellre med
`?raw` (`import text from './filer/skraffering.dxf?raw'`); CSS ger vitest
tom, så stilarnas test läser från disken.

**Körningen**: de vanliga testerna delar process (`isolate: false` i
`vite.config.ts`, 0.8.32), så att koden inte läses in igen för varje
fil; det halverar tiden. Ett test får därför inte lämna något ändrat för
de andra (som `snapIndex.from` eller `forgetInferred`), och testerna ska
gå igenom i vilken ordning som helst: prova med `npx vitest run
--sequence.shuffle --sequence.seed=N`. Sparat, spara-och-läs, prövas i
`core.test.ts` på ett rikt projekt (elementen sparas som de är), och
att äldre format får meddelandet också där; skriv inget eget test för ett
nytt fält eller formatnummer. En jämförelse med en fryst kopia av gammal
kod (klick och snäpp i `v0823` och `v083`) behöver några hundra punkter,
inte tusentals.

## Arbeta i sandlådan

Hur Claude bygger, provar och jämför i sessionernas sandlåda (flyttat hit
ur överlämningen i 0.10.23).

- Repot är `agrellarkitektur/cad-apa`. Bygga och testa: se CLAUDE.md.
  Commit avslutas med raderna som sessionen anger (Co-Authored-By och, om
  sessionen har en, Claude-Session), sedan `git fetch origin main` och
  `git push origin HEAD:main`. Pushen publicerar på webbhotellet; följ
  körningen med `gh run list` (loggarna går inte att läsa härifrån, men
  status syns). Releaser (zip) gör Carl August själv om han vill.
- En egen gren i den grunda klonen: `git push -u origin <gren>`, och
  sedan `git config --add remote.origin.fetch
  +refs/heads/<gren>:refs/remotes/origin/<gren>` och `git fetch origin
  <gren>`, så att grenen spåras.
- Titta på resultatet: `npm run build`, servera `dist/` med
  `python3 -m http.server 8765` och styr med Playwright (Python). Det är
  samma bygge som hamnar på webbhotellet. `window.bacchus` har `store`,
  `view`, `selection`, `ui`, `modifier`, `smartMenu`, `view3d`, `plan`, `sheets`,
  `plot`, `setTool`, `setMode` och `goTo` (t.ex.
  `goTo({kind:'marker', id:'sektion-a'})`, `goTo({kind:'sheet', id})`).
  `bacchus.sheets.pick({kind:'viewport', id})` markerar en vy på bladet
  (`selection`), `pick({kind:'sheet', id})` visar bladet i panelen;
  `bacchus.sheets.drawing()` har `views` med ytorna på papperet och
  `pickables`; `pickedViewport()`, `place(bladId, vy, skala)`,
  `newSheet()`, `newMaster()` och `resetCrop(id)` finns också. Det ritade
  på bladet är vanliga element med `space` = bladets id. Ett mallblad öppnas med `goTo({kind:'worksheet', id:'mall-a3'})`. Ramens
  grepp dras med musen på den valda vyns kanter (`views[i].frame`). Filer läggs in med `page.expect_file_chooser()` runt ett
  klick på *Lägg in underlag…*; ett projekt öppnas med
  `[data-action="open-file"]:visible` och `showOpenFilePicker = undefined`. Ritningen ligger i
  `.plan-drawing .content` (0.8.3), markeringen i `svg.plan .highlight`.
  `bacchus.view.redraw()` ritar om ritningen. Egenskapspanelen är
  `aside.panel[aria-label="Egenskaper"]` (projektträdet har också en
  `.panel-body`).
- Plot/export i Playwright: sätt `window.showSaveFilePicker = undefined` med
  `add_init_script`, så sparas zipfilen som en nedladdning
  (`page.expect_download()`). Kontrollera PDF:erna med `qpdf --check` och
  `pdftoppm -png`; `pdffonts` ska visa Osifont inbäddad (0.8.18). Ett
  blad blir snabbast PDF i ett tillfälligt vitest-test med `buildSheet` och
  `writePdf(..., { deflate: browserDeflate() })`.
- osifont görs om med `scripts/osifont.py` (kräver fonttools och brotli).
- **Jämföra Modifiera före och efter** (0.8.15): servera det gamla och det
  nya bygget på var sin port, ladda samma projekt i båda med
  `store.load`, och kör förlopp som `selection.set`, klick på ett
  modellläge (`view.camera.toScreen` plus `svg.plan`:s läge),
  `modifier.choose(op)`, `hover`, klick och `modifier.applyValue(v)`; spara
  efter varje steg hashar av `store.doc`, markeringen, `svg.plan .overlay`,
  `.highlight`, `.plan-drawing .content`, panelen och smartmenyns text.
  Kärnan jämförs snabbast utan webbläsare: samma skript buntat mot båda
  arbetskopiorna, med fasta id.
- **Klickjämförelsen från 0.8.27** ligger i `scripts/jamfor-klick.py`
  (633 steg sedan granskningen efter 0.11.5, som lade till 51 steg sist
  för 0.11–0.11.5: en rak trappa och en L-trappa med vilplan, sättsteg,
  stegdjup, plansteg, byggd uppbyggnad, kontrast och hålet, räcken på båda
  sidor med läget, kilstegen, övergången och Lösgör, ett ritat räcke med
  *Gör till grind* (klick på kanten, sedan `chooseRail('railGate')`), en
  spiraltrappa 450° medurs ändrad i panelen, Detalj via vyradens
  `.detail-switch`, och 3D efter varje grupp. Mot 0.10.40.1 (16e2902)
  skiljer bara `panel` och `dialog` i de gamla stegen: *Syns också på* i
  panelerna och stilbokens nya grupper; dokument, ritning, smartmeny och
  3D är lika i alla 582. Stilmallsstegen från 0.8.27–0.8.38 ger
  `saknas`-fel i båda byggena sedan stilboken (0.10.32) och är kvar som
  jämförbara fel. 582 steg sedan granskningen efter 0.10.25, som lade till 43 steg sist
  för 0.10.23–0.10.25: spöet i Takfall, Mått (Tab: andra sidan) och
  Littera, ett bjälklag med Båge i polygonen och Böj på en kant, Mark som
  öppnar Platsen med en markyta som polygon med båge, Platsen i 3D,
  kalkeringen av Platsen i planen, Platsens meny med *Ny vy →
  Situationsplan* och *Egenskaper*. Sedan 0.10.25 ligger markobjekten
  på Platsen: stegen som markerar dem går dit med `ON_SITE` och tillbaka
  med `ON_PLAN`, varje byte av våning zoomar till samma utsnitt (`FIT`,
  eftersom *Zooma till allt* ger olika i planen med och utan platsen),
  snäppet slås av i de steg där platsens objekt förut snäppte i planen,
  och mot ett äldre bygge jämförs dokumenten utan Platsen (`norm_doc`:
  markobjekten räknas som på första våningen). Bilderna skiljer mot
  byggen före 0.10.25 från *släpp platsen* och framåt, eftersom
  markobjekten inte längre ritas på Plan 1; då är dokumentet det som
  jämförs. *Båge* i Mark sätts med `ground_arc(on)`, inte växlas: den
  ligger kvar från rampen i stegen för 0.10.19. Klicket på det vridna
  hålet (0.10.17-stegen) ligger mitt i hålet, så att det inte snäpper
  till bjälklagets kant (då speglades hela bjälklaget). Husets verktyg
  spärras inte på Platsen, så stegen går till Plan 1 före takfallet.
  539 steg efter
  granskningen efter 0.10.22, som lade till 43 steg sist
  för litteran, det generella littrat och smartspöt: greppen dras med
  `grip_center('circle.grip')`, `path.grip` och `rect.side-grip`, Shift
  hålls under dragningen men inte vid nedtryckningen (`shift_drag`), spöet
  slås på med knappen eller `q` efter en `mouse.move` över ritytan, och
  hovringen görs med `mouse.move` före Tab och klick; Visa-menyn stängs
  med ett klick på knappen, inte Esc; 496 steg efter granskningen efter 0.10.21, som lade till 39 steg
  för 0.10.19–0.10.21: Böj på rampens referenslinje, mjuka övergångar och
  en skarp punkt, en ramp till med Båge i verktyget Mark och Foga ihop,
  markhöjd, låglinje, murens littera, minsta sidolutning, decimalerna och
  siffrorna under Platsen, branta slänter under Visa, och en lutande vägg
  i planen och 3D; 457 efter granskningen efter 0.10.18, kör den med
  `--bilder`, eftersom 3D-bildernas hashar
  kan skilja utan att en pixel gör det, som lade till 0.10.16–0.10.18
  efter `allra sist`: snittet i planen, rita vidare, Förskjut alla kanter,
  Foga ihop, ett takfall med båge (Båge slås av före sista hörnet; den är
  kvar tills den slås av), bjälklag med cirkelhål som vrids och speglas,
  rampens punkt med höjd, sidor och förlängning; och sist det nya i
  0.10.18.1. Stegen före de sista går att jämföra med 0.10.18. Koordinater
  längst ned i ritytan hamnar under verktygsraden; ta dem högre upp.
  396 steg efter granskningen efter 0.10.15, som lade till 0.10.13–0.10.15
  sist: höjderna mot våningen, greppen som dras med ett steg mitt i varje
  dragning (`press_drag(..., release=False)` och sedan `release`),
  fyllningens panel, Dölj i vyn och linjerna i 3D; smartmenyn döljs med en
  stilregel där. Kryssrutorna under Visa klickas med `__click`, eftersom
  menyn lyssnar på `click`; `__set` ändrar bara rutan. 347 steg efter
  granskningen efter 0.10.12: stilmallen med linjetyper,
  pennor och fyllningstyper, snabbraden, den egna pennan, rummets
  fyllning, 2D-formens fält med mask, bakgrund och fyllningstyp,
  ritordning, Visas i, underlag, detaljnivåerna, Filtrera och markera,
  våningar, bjälklag, kalkering, platsen och markobjekten, fasader,
  sektion och nivåer till och med `slut`; efter den våningens meny,
  Visa-menyn, snäpp mot kalkeringen, låst mot borttagning, delen
  *Markör*, *Över marken mot*, bjälklag bakom snittet och 3D-vyn med en
  bild per steg, `v3d`). Mot ett bygge äldre än 0.10.12 jämförs bara
  stegen till och med `slut`. 3D-stegen räknar ut skärmpunkten med
  `bacchus.view3d.project` och vyns läge (`at3d`), greppen med
  `bacchus.view3d.editor.handles()`, och höjden i marken med
  `bacchus.view3d.ground.height`.
  Platsen släpps på planen som en fil (`PLATS`, samma mark som
  `groundProject`), och dialogen väljs med `pg.click` (flera `.dialog`
  finns i sidan; dialogen *Platsen* har klassen `site-dialog`). Väggarna
  är vridna när marken prövas, så plattan ur väggarna har ingen kontur:
  urgrävningen läggs under ett ritat bjälklag. Den fasta följden i
  `crypto.getRandomValues` tar de höga bitarna sedan 0.10.6 (med de låga
  upprepades id efter några hundra). Kommandon skrivs i smartshell
  (`#ss-input`, Enter), och en meny (som *Kopiera till våning*) väljs i
  `.ctx-menu`. Kör den mot två byggen på var sin port och sedan med
  `--jamfor`; lägg till steg för det som granskas. Med `--bilder` sparas
  en bild av ritytan efter varje steg, och när markupen skiljer sig
  jämförs bilderna (så gjordes 0.8.38, där skrafferingen ritas med ny
  kod). Inget steg felar sedan 0.9.3; kör den gamla versionen två gånger
  mot sig själv om något skiljer, så syns det som inte är bestämt. En
  rad om att en bild är inlagd kan skilja i steget efter att Visa
  öppnats (meddelandet tonas ut olika fort).
  Verktygets klassnamn minifieras olika i två byggen; jämförelsen kräver
  bara att namnen motsvarar varandra. Vänta på
  `!bacchus.sections.pending` och tryck *Zooma till allt* innan en fasad
  jämförs (annars beror kameran på hur fort den räknats), och räkna inte
  `blob:`-adresser. En klick i modellen måste hamna inne i objektet, inte
  på takets streckade kontur.
- **Jämföra före och efter** (så gjordes granskningen): bygg den gamla
  versionen i en egen arbetskopia (`git worktree add <mapp> <commit>`, länka
  in `node_modules`, `npx vite build --outDir <mapp>`), kör samma klick i
  båda byggena och jämför läget efter varje steg. Byt
  `crypto.getRandomValues` mot en fast följd i `add_init_script`, så att nya
  id blir desamma. Skript utan webbläsare buntas snabbast med
  `npx rolldown skript.mts --dir ut --format esm --platform node` (med
  `--file` vägrar den när koden delas i flera delar) och körs med `node
  ut/skript.js` (tsx lägger till `__name` som syns i profiler). Skriptet kan
  importera `tests/projekt.ts` (`roomGrid`, `shapesProject` …).
- **Testerna** (0.8.32): de vanliga delar process (`isolate: false`), så
  ett test får inte lämna något ändrat för de andra; prova en ny fil med
  `npx vitest run --sequence.shuffle --sequence.seed=1` (och 2, 3).
  `npx tsc --noEmit` kontrollerar också `tests/`. Hjälpfunktionerna och
  testprojekten ligger i `tests/projekt.ts`; spara-och-läs prövas en gång,
  i `core.test.ts`. Ett hus med två våningar och fasta id är
  `twoStoreys` (0.9.3). Se *Tester* i UTVECKLING.md.
- Demon bara på begäran: `npm run preview:artifact`, läs artefakten
  (https://claude.ai/artifact/2m7gq5gkkgSP2wFZ7fLGNJ, Artifact `read`) och
  publicera `artifact/cad-apa.html` till samma URL.
- Stoppa servern med `ps -eo pid,args | grep "[p]ython3 -m http.server"`
  och `kill <pid>`, inte `pkill -f` eller `pgrep -f` i samma kommando (de
  träffar också skalet, som stängs).
- Testfiler att lägga in går snabbt att göra med reportlab (PDF), PIL
  (bild) och några rader text (DXF). Riktiga DXF med skraffering, block och
  bågar gör ezdxf (`pip install --break-system-packages ezdxf`), som också
  ger facit för konturerna (`ezdxf.path.from_hatch_boundary_path`) och
  mönstrens streck (`ezdxf.render.hatching.hatch_entity(h,
  jiggle_origin=False)`; utan det flyttas mönstret slumpvis några mm).
- Mäta hur fort Chrome målar en SVG (0.8.38): lägg markupen i en tom
  sida med `set_content`, sätt `innerHTML` och vänta två
  `requestAnimationFrame`; jämför varianter (utan fyllning, ett mönster,
  …). Bilderna jämförs med PIL (`ImageChops.difference`, pixlar som
  skiljer mer än 64).
- Mäta i webbläsaren: hela bildrutan, från `page.mouse.move` till två
  `requestAnimationFrame`, jämfört med ett tomt varv; att bara mäta
  JavaScript missar webbläsarens målning, som var det dyra vid panorering.
- En profil (`node --cpu-prof`) sammanfattas snabbast med några rader
  Python som summerar `timeDeltas` per `callFrame` i `.cpuprofile`, och
  inklusive tid genom att gå upp till föräldrarna (så mättes 0.10.1).
  Polygon-clippings egna funktioner heter `split`, `compare` och `run`.
- **Marken utan webbläsare** (0.10.6): ett skript som importerar
  `tests/projekt.ts` (`groundProject`, `slopeSite`, `planCtx`) och byter
  platsen mot ett större rutnät med `applySitePackage` (t.ex. 200 × 150 m
  med 0,5 m och en brant sluttning), buntat med rolldown; mät
  `finishedTerrain(planCtx(store))` och `buildPlan` efter `updateParams`.
  Jämför med en färsk `finishedGround` utan `prev` för att se att svaret
  är detsamma.
- Fasader, sektioner och blad utan webbläsare: ett skript med
  `registerBuiltInTypes()` från `src/elements` först, sedan `buildSection`
  eller `buildSheet` och `writePdf`. Stora projekt att mäta på: `wallGrid`
  och `roomGrid` i `tests/prestanda.test.ts`. Profilera med
  `node --cpu-prof skript.mjs`.
- Playwright: verktygsraden (`.tool-options`) ligger över nedre delen av
  ritytan; klicka högre upp. 2D-verktyget behöver en `mouse.move` före
  klicket. Verktyget som är aktivt är `bacchus.view.currentTool` (t.ex.
  dess `points` och `current`).
- Jämföra före och efter en uppdelning: bygg båda, kör samma klick och
  spara `store.doc`, markeringen, `.plan-drawing .content`, panelens text
  och smartmenyn som hashar per steg (så gjordes 0.8.1 och 0.8.11).
- Playwright: dra med flera `mouse.move` i steg (två steg räcker inte för
  att vyn ska räkna det som en dragning). Modifiera Flytta utgår från
  punkten där man klickade på det markerade, så ett klick efter valet är
  målet. Filvalet för underlag öppnas pålitligast med ett riktigt klick på
  menyn (inte `element.click()` i JavaScript).
- Underlag i Playwright (0.8.16): en fil läggs snabbast in genom att
  skicka `dragover` och `drop` med en `DataTransfer` till `.pane-2d`; det
  nya underlaget är markerat. Snäppningen i ett ritverktyg syns i
  `bacchus.view.currentTool.current` (`kind`, `label`, `point`). Exempelprojektet
  har huset kring origo, så flytta underlaget bort (X i egenskaperna) innan
  snäpp prövas.
- Playwright och Modifiera (0.8.14): smartmenyn ligger ofta över det man
  vill klicka på i ritningen; dölj den med en stilregel
  (`.smart-menu{display:none!important}`) eller klicka utanför den.
  `bacchus.modifier` har `choose(op)`, `chooseRail(id)`, `applyValue(v)`,
  `setValue(v)`, `active` och `detailMarkup()`; Shift + bokstav fungerar
  efter en `mouse.move` över ritytan.

## Kända begränsningar

Det som är känt men lämnat, per version (flyttat hit ur överlämningen i
0.10.23). Ta bort en rad när den är åtgärdad.

- **Trappan (0.11):** kilstegens undersida i 3D är ett plan per steg i
  stegets egen riktning, så den blir lite trappstegsformad i svängen; de
  första stegen står på golvet (plan undersida). Gånglinjen i en sväng är
  den förskjutna linjens hörn, inte en båge. En sväng där sträckorna på
  sidorna är kortare än bredden ger överlappande revben (prövas inte).
  *Gör till eget hål* är en kopia: hålet följer inte trappan när den
  flyttas. *Syns också på* ritar markobjekten med deras egen planregel
  (mätt bara i testprojektet). Trappan har ingen littera i planen och ingen
  egen penna.

- **Material (0.10.28):** kulörerna i 3D följer trianglarnas mitt, så
  slänternas yttre kant (och markytor som inte skär marken) blir taggiga
  per ruta. Snittet och ytan (0.10.28.2) gäller bjälklag och tak; marken
  och väggarna i sektionerna ritas som förut, och ytan syns bara i
  fasader, inte i sektionernas vy. Mönstrets mått för snittet och ytan går
  inte att ändra i listan. En markering med olika material ändras efter
  det första objektets material. Ytan i fasaden räknas med polygonklippning;
  går den inte ihop för en bit blir ytan lite för stor där.

- **Smartspöt del 2 (0.10.23):** `fitArcs` körs bara när ett förslag
  utförs (prövar de längsta bågarna från början, O(n²) för en lång jämn
  kurva). Bågväggar måttsätts inte; en båge av två bitar är ett hörn.
  Takfallet runt en kontur med inåtgående hörn får geringen ur
  `offsetRing` (högst fyra gånger språnget i spetsiga hörn). Snabbvalen
  ignorerar konturens form (omslutande rektangel). Måttkedjan i hörnen
  tar med väggtjockleken.

- **Stora filer efter 0.10.22.1:** `app.ts` (570), `commandLine.ts`
  (542, en sluten helhet med eget läge; listan och menyerna är utdelade)
  och `arrangeTool.ts` (529) är störst; `planView.ts` är 403 efter
  delningen (pekaren i `planInput.ts`, förra zoomen i `zoomHistory.ts`). Stilmallens fönster har tre kolumner från 1180 px; under
  det ligger delarna under varandra som förut.

- **Smartspöt (0.10.22, mätt i 0.10.22.1):** `find` körs vid varje
  musrörelse; kedjan, den slutna ytan och Markeras svar sparas.
  `faceAround` med 1040 höjdkurvebitar tar 17 ms (skärningarna ur en
  `BoxIndex`; de 1500 närmaste av 3000 korta linjer 30 ms). `snapSegments`
  räknas om när planen ändras: 105 000 kurvbitar på 10–40 ms med 1,2
  miljoner noder, och `nearSegments` bygger sitt rutnät på 40 ms första
  gången. Höjdkurvorna i planen är bara för spöet (`wandOnly`).
  Bågar följs som raka bitar. 2D-formen runt en yta med hål får bara
  ytterkonturen. Spöet fungerar inte i 3D eller på ritningsbladen.
- **Generell littera (0.10.20.2):** ritas utan `planReads`, så alla
  litteror räknas om vid varje ändring (få i ett projekt; inte mätt med
  hundratals). Spegling flyttar en punkt på en vägg till samma avstånd från
  väggens nya början. Bara i planen (inte fasader och sektioner); ingen
  dubbelklicksredigering av texten; verktygsraden har ett enradigt fält.
  En punkt bakom stammens början blir inte parallell med de andra.
- **Litteran (0.10.20.1):** markhöjdens och markbeteckningarnas text och
  nivåmarkörernas har ingen ledare och går inte att flytta. Textens ruta
  räknas ur antalet tecken (0,62 × höjden per tecken för väggar, dörrar,
  fönster och rum, som förut), så stammen kan börja en bit från en smal
  text. Väggarnas förskjutningar står i textens axlar; en speglad vägg
  vänder textens riktning, så en flyttad littera kan hamna på andra sidan
  (inte prövat). Litterans grepp söks i hela ritningen en gång per plan
  (`WeakMap` på `plan.prims`); inte mätt på ett stort projekt.
- **Lutande väggar (0.10.21):** samma lutning i båda ändarna; bågväggar
  lutar inte; skarvarna i 3D vid foten (glipa eller överlapp mot lodräta
  grannar högre upp, inte prövat); takets yta i plan flyttas tillbaka med
  väggens hela höjd när taket kapar en lutande vägg (fel där takkanten går
  diagonalt över väggen); ytterväggarnas insida som dold linje i fasaden
  ritas lodrät (`innerFaceEdges`); bågväggars konturlinjer
  (`wallSilhouettes`) räknas vid foten. `cutSheared` klipper med
  polygon-clipping mot stora halvplan (1e7 mm), inte mätt på ett stort
  projekt (exempelvillan med två lutande väggar: fasader 30–145 ms,
  sektionen 60 ms, som förut).
- **Beteckningarna (0.10.20):** markhöjden har ingen egen textvridning
  eller förskjutning, och ledarens läge går inte att dra. Konturen runt
  slänterna räknas ur strecken ytterändar var 1,25 mm på papperet, så den
  blir lite kantig i tvära hörn; de branta slänterna räknas för hela
  rutnätet en gång per gräns och skala (på 1,2 miljoner noder inte mätt;
  lutningens fält och en höjdkurva på en nivå, bör gå på under en sekund).
  Släntstrecken kortas nu av släntens egen lutning (100 mm + 25 %), så en
  slänt som tonas av en höjdpunkt i närheten får kortare streck än förut.
- **Bågarna (0.10.19):** all räkning mot marken görs på linjen med
  bågarna som korta raka bitar (högst 4° per bit), så en liten båge kan
  ge många punkter i rampens kontur; inte mätt på en stor plats. Avrunda
  och Fasa kräver som förut två raka kanter i hörnet. Markytans kontur
  har inga bågar. Stödmurens sidor i 3D följer bågen som bitar på 0,5 m.
  En övergång i en ände kortas om radien inte ryms (S² < 2·R·Δh) utan
  att säga till; panelen visar bara den raka delens lutning. Dockningen
  tar inte hänsyn till att sidorna kan korsa varandra i skarven när
  ramperna möts i vinkel (självskärande kontur, prövas inte).
- **Rampen (0.10.18):** en sida som är stödmur har ingen kropp i 3D och
  ingen höjd (som `edge: 'wall'` förut). Där referenslinjen ligger på en kant träffar ett klick på
  den sidan referenslinjen (den går först); sidan följer då med så länge
  den inte är ritad. För att ändra den sidan för sig: gör sidorna ritade
  och flytta referenslinjen, eller lägg den i mitten. Sidor som korsar varandra eller referenslinjen ger en
  självskärande kontur; det prövas inte.

- **Linjerna (0.10.17):** Foga ihop fogar inte linjer med splines, och
  inte linjer på olika ytor. Förskjut med flera kanter räknar hörn mellan
  en båge och en rak kant med bågens tangent, vilket är exakt bara där de
  möts tangentiellt (annars hamnar hörnet lite fel). Ett klick inne i ett
  hål markerar inte hålet; man klickar på hålets kant eller hörn.

- **Snittet i planen (0.10.16):** en vägg räknas efter sin fot och höjd;
  en vägg som kapas av ett tak under snitthöjden (en knävägg utan egen låg
  höjd) räknas ändå som snittad. Ett bjälklag på våningen ovanför syns
  inte (bara våningens egna). Fasader och sektioner påverkas inte.
  Klickjämförelsen har inga egna steg för 0.10.16 än (läggs till i
  granskningen).
- **Dolt (0.10.15):** det dolda gäller vyn, så 3D-vyn följer planen. *Markera
  alla …* tar inte med det dolda; Filtrera och markera är inte prövat med
  dolda objekt. Linjerna i 3D räknas om vid
  varje ändring i projektet när de är tända (släntstrecken ur planen).
- **Fyllningar (0.10.14):** slänternas yta räknas om när den färdiga
  marken ändras (ca 100 ms första gången i 1:50 på den sneda platsen,
  sedan sparad). Materialen (0.10.28) finns inte i stilmallens dialog,
  bara i panelen.
  2D-verktygets fyllningsval i verktygsraden är det gamla (bara
  mönstret).

- **Låst (0.10.12):** låset hindrar flytt, grepp och borttagning, men inte
  Riv, *Finns i* eller ändrade värden i egenskaperna. En våning som tas
  bort tar med sina låsta objekt.
- **Dolda linjer (0.10.10):** ytterväggarnas insida syns inte genom ett
  fönster (bara de skymda delarna ritas). De dolda linjerna tonas inte
  bortom *Tonat från* (de är redan tunna). Ett bjälklag under
  marken ritas streckat där marken skymmer det.
- **Stödmuren (0.10.9):** bitarna (högst 0,5 m) syns svagt som strimmor i
  3D-vyn; där en fasads djup slutar mitt i muren ritas ingen kant vid
  gränsen (`mark-fasad-2`); murens ändar möter inte marken med slänt.
- **Marken efter 0.10.6** (mätt men lämnat, mätt igen i granskningen
  efter 0.10.12): fasader och sektioner byggs om helt vid varje ändring i
  projektet, också av ett markobjekt (11–25 ms per vy i exempelvillan på
  den kuperade platsen när koden är varm, lika med och utan mark; nyckeln
  är hela projektet i `modelShapes`, och efter ett ändrat markobjekt är
  ingen av 3D-formerna samma objekt, så linjerna i `sectionLines` kan inte
  sparas förrän formerna för oförändrade objekt blir desamma). På en brant plats ändrar ett objekt stora
  ytor (40 000 noder för urgrävningen under plattan på 0,5 m) och varje
  ändrad nod kostar 1–3 µs i `probe` (närmaste kant); den färdiga markens
  höjdkurvor räknas för hela området som alla markobjekt ändrat (ca
  70–100 ms på en brant plats). 3D-vyn i Chromium utan grafikkort ritar
  en stor mark på ca 1 s; inte mätt på en riktig dator.
- **Marken (0.10.3):** höjdkurvorna för ett stort, brusigt rutnät (1,2
  miljoner noder, 0,5 m) tar ca 2 s första gången (sedan sparade);
  `contours` har en `Map` per nivå som går att byta mot typade listor om
  det behövs. Platsens objekt läggs på våningen närmast ±0 och syns inte i
  de andra planerna. Beskärningen tar bort kartobjekt utan någon punkt i
  rutan (en gräns som bara korsar den försvinner). Licenstexten kommer
  med på bladen bara där `{licens}` står i en text (0.10.8).
- **Synpunkter på webbhotellet:** formuläret skickar (sedan 0.8.2) och
  breven kommer fram till webbposten hos Loopia, men nådde inte Gmail.
  0.8.6 sätter kuvertavsändaren; se *Att fråga Carl August om*.
- **Följ sektionen** klipper 3D, men caps (snittytorna) saknas medan en stor
  sektion räknas i tråden.
- **2D på arbetsblad följer tillstånden** som 2D i planen (mallblad gör det
  inte, sedan 0.8.8). Fråga om arbetsblad ska vara oberoende av tillstånd.
- På ett mallblad finns Visa-menyns skala för texter och mått kvar, fast
  allt ritas i 1:1; den gör ingenting där.
- På ett blad och ett mallblad visar statusraden fortfarande skärmskalan
  (Rutnät är grått sedan 0.8.11). Underlagens formulär säger *Bredd i
  modellen* också på papper, och tipset om att kalibrera skalan kommer
  också där.
- Markeringen på ett blad markerar inte mallens grafik (bara bladets egen),
  som väntat; men det ritade på bladet och mallen ligger på samma papper,
  så det kan vara svårt att se vad som är vad.
- Konens bitar syns svagt i 3D-vyns skuggning (64 bitar per varv, plan
  skuggning).
- Två takfall som möts ritar samma linje två gånger i fasaden (nocken och
  takfoten bakom), utan att det syns.
- Takfotens snitt (0.10.2): där två snittade kanter möts i ett konvext
  hörn av samma takfall tar den första kantens snitt hörnet (ingen
  gering). En kon snittas bit för bit; en boolesk operation som inte går
  att räkna ger lodrätt snitt för den biten.
- Spegla vänder inte bilden i ett underlag, bara läget.
- DXF: skraffering med solid fyllning ritas som en ton (färgerna i DXF läses inte). Bilder och externa
  referenser efter pilotprojektet. Vektorsnäpp mot PDF avvaktar.
- **Att markera många väggar** (840) tar ca 0,15 s, nästan allt i
  webbläsarens ritning av markeringen (mätt i 0.8.15, lämnat).
- **En flyttad vägg** räknar fortfarande om sammanslagningen av alla
  väggytor på våningen, två gånger: med öppningar för ritningen (`union` i
  väggarnas `planBatch`) och utan för rummen och utsidan (`bareWallUnion`,
  en gång sedan 0.8.32 när vyn visar alla väggar); `polygon-clipping`
  står för det mesta, ca 0,06 s för 312 väggar. Ett nytt rumsnamn räknar
  om rum och dörrar (0,08 s).
- Under en zoom med hjulet syns ritningen skalad i 140 ms innan den ritas
  om; texter som var för små att ritas dyker upp först då.
- **Visas i** räknar vyer utan att bry sig om tillstånd.
- Modellvyerna har inga vy-taggar, så ett element med taggar syns inte där
  (inte heller på ett blad via modellvyn); *Visa dolda 2D-element* visar
  dem tonade.
- En borttagen taklutning är dold för gott i den fasaden; bara ångra tar
  tillbaka den automatiska.
- Spårlinjerna kan kännas för klistriga (`TRACK_REACH` i
  `src/ui/tools/snap.ts`).

## Rum och anteckningar

Rum som skapats med rumsverktyget sparar punkten man klickade i (`seed`).
En flyttad rumsstämpel har sin mittpunkt i `labelAt` (0.8.17); den flyttas
och vrids med rummet i `movePatch` (`src/core/commands.ts`) och `transformed` (`src/core/transforms.ts`),
och utanför rummet ritar `space.ts` en pil in i rummet. Stämpelns primitiver
har `part: 'rumstext'`, som Markera känner igen när stämpeln dras.
Konturen räknas ut vid varje ritning ur hålen i de sammanslagna väggarna
(`src/elements/rooms.ts`), så rummen följer väggarna. Rumsnumren räknas i
samma fil: dörrarna kopplar ihop rummen, och man går i vänstervarv från den
bredaste ytterdörren. Låst numrering sparar numren i rummen.

Mått och text är egna elementtyper (`src/elements/annotation.ts`) och följer
tillstånden som andra element. Littera ritas av väggar, dörrar och fönster
själva via `src/elements/littera.ts` och kan döljas per vy (`hide`).

Vyinställningar som detaljnivå, dolda kategorier och om rivet visas ligger i
`ViewStates` (`src/core/states.ts`). När bladen kommer i 0.8 får varje vy
på bladet sina egna.

## Äldre versioner

Avsnitten om koden i 0.6–0.10.40.1 ligger i
[arkiv/UTVECKLING-0.6-0.9.md](arkiv/UTVECKLING-0.6-0.9.md) och
[arkiv/UTVECKLING-0.10.md](arkiv/UTVECKLING-0.10.md) (flyttade 30 oktober
2026, efter 0.10.40.1; oförändrade). De beskriver fortfarande hur koden
fungerar; sök i hela `docs/` (`grep -rn … docs/`) efter en funktion eller
en fil. Här står de allmänna reglerna och avsnitten från det nuvarande
formatet (26) och framåt. Nya avsnitt läggs överst bland versionerna, som
förut; vid nästa huvudversion flyttas de klara till arkivet.

## Spiraltrappan (0.11.5, format 26)

- **Parametrarna**: `spiral: { inner, outer, sweep, dir? }` i `StairParams`
  (diametrar i mm, grader, `dir` `'cw'` eller utelämnad = moturs). `line`
  är då `[mitten, en punkt i startriktningen]`; avståndet till punkten
  betyder inget. `width` skrivs med (halva skillnaden mellan diametrarna)
  men läses inte. `spiralDims` gör måtten rimliga (ytter minst 600, inner
  högst ytter − 300, 30–1 080°).
- **Geometrin**: `stairGeometry` börjar med `spiralLine(p)`, som byter
  `line`/`bulges` mot en båge i bitar om högst 90° med radien (inner +
  ytter)/4, `refSide` mitten och inga vilplan. Allt efter det (zonerna,
  revbenen, räckenas `sideBetween`, 3D) är som för en trappa med bågar.
  `StairGeometry` får `turn` (gånglinjens längd för 360°), `centre` och
  `outerRadius`.
- **Planen** (`stairPlan`): `hid` är sträckan dit allt är dolt, `uCut −
  turn` på våningen och `L − turn` i våningen ovanför; `shown(u)` tar bort
  revben, stegnos, kontrast och nummer där (det över snittet ritas alltid).
  Mittpelaren är delen `pelare` (`poleOf`, en båge med stället
  *konturlinje*), i 3D `poleSolid`. `pickShape` delar konturen i halva varv.
  Stegnumren ett varv upp står på andra sidan gånglinjen; `stegtext`
  utanför ytterkanten och vänd så att den går att läsa (`upright`).
- **Hålet** (`stairHoleIn`): en cirkel med 64 punkter när det som går
  genom bjälklaget är minst 97 % av ett varv.
- **Verktyget**: `StairTool.options.form` (`line`/`spiral`) och
  `options.spiral`; två klick (`centre`, sedan riktningen), `createSpiral`.
  Verktygsraden i `ui/app/toolOptions.ts` (`data-stair-form`,
  `data-stair-dir`, fälten `stair-inner`, `stair-outer`, `stair-sweep`).
- **Panelen**: nycklarna `stair:inner`, `stair:outer`, `stair:sweep`,
  `stair:dir` (`spiralPatch`); `goingPatch` ändrar `sweep`. Modifiera
  (`ui/modify/ops.ts`) ger spiralens linje bara *Flytta punkt*.
  `transforms.ts` byter `dir` vid spegling.
- **Tester**: `tests/v0115.test.ts`.

## Byggd trappa (0.11.4, format 26)

- **Parametrarna** i `StairParams`: `build: 'built'`, `built.stringer`
  (`sides`, `width`, `height`, `material`), `built.tread` (`thickness`,
  `nosing`, `material`), `built.riser` (`thickness`, `material`; 0 = öppen),
  `contrast` (`none`/`ends`/`all`) och `contrastWidth`. Förvalen står i
  `BUILT` i `elements/stairBuilt.ts`, och `builtDims(p)` fyller i dem.
  Panelen (`builtFields` i `ui/stairFields.ts`, nycklarna
  `stair:stringerSides` … `stair:contrastWidth`) skriver bara det som
  avviker från förvalet (`builtPatch` tar bort tomma delar).
- **3D** (`builtSolids`): bandet klipps mot remsorna (`strips`: sidorna
  förskjutna med `offsetLine` och förlängda förbi ändarna) med
  `intersection`. Plansteget `[u0, nästa u0 + nos + sättsteg]` (`bandExt`
  förlänger bandet rakt före trappans början, för stegnosen över det
  första sättsteget); sättsteget `[u0 + nos, + tjocklek]` från steget under;
  vangstycket en bit per steg med `top` och `bottom` som sneda plan genom
  sidans punkter (`planeThrough`) och höjden ur `nosingZ`; under golvet
  plan undersida på 0. `contrastSolids` gäller båda uppbyggnaderna.
  `model3d` lyfter allt med `liftShape`.
- **Planen** (`stairPlan` i `stair.ts`): `insetRib` kortar revbenen till
  vangstyckenas insida, `stringerLine` ritar insidan (`sideBetween`
  förskjuten); delarna `vangstycke`, `stegnos`, `kontrast`, `stegnummer`
  och `stegtext`. Ställena `stairStringer`, `stairContrast` och `stairText`
  i `repr/stairPens.ts`.
- **Tester**: `tests/v0114.test.ts`.

## Staket och grindar (0.11.3, format 26)

- **Marken**: `railingGround(ctx)` i `elements/railing.ts` ger den färdiga
  markens höjd (`crispHeight` som stödmurens profil, annars `groundAt`),
  och `railingPath(doc, el, ground)` och `railingBodyOf(doc, el, ground)`
  tar den när räcket är på Platsen; planen och 3D skickar den, andra
  anrop (varningar, panelen, klick) inte. `freePath(p, ground)` lägger då
  en punkt var `GROUND_STEP` (250) och sätter `RailPath.base` (marken i
  varje punkt); `z` är marken plus punkternas höjd. `heightFrom: 'fixed'`
  hoppar över marken.
- **Delarna** (`railingBody(path, model, vals, { gates, gateModel })`):
  med `path.base` gäller `slope: 'stepped'` (facken vågräta på
  `maxZ`, `straightened` tar bort de täta punkterna) och `below` för
  punktdelar (`PostPiece.ground`, `RailingBody.footings`). `AlongPiece` har
  `z` (referenslinjens höjd, för planens snitt) och `ends` (vilka ändar
  som förlängs). `withExtension` ger också `z`.
- **Grindarna**: `RailGate` i `RailingParams.gates` (`at`, `width`,
  `type`, `own`, `height`, `hang`, `swing`, `angle`, `post`, `lock`,
  `littera`). I `railingBody` blir hålen (`gateHole`) grindstolpar
  (`gatePostPart`, id `grindstolpe`) och `breaks`-delarna avbryts
  (`openRuns`, `bayIsGate`); `gatePiece` ger `GatePiece` med bladen
  (`railingBody` på en rak `freePath`) och normalen `out`. Planen:
  `gatePlan` och `openPieces` i `railing.ts`, pennorna `railGate` och
  `railGateSwing` i `repr/railingPens.ts`. `gateSpanAt` (facket vid en
  punkt), `gateModelOf`, `gateLittera`. Panelen: `gatesMarkup`,
  `addGate`, `nextGateLittera` i `ui/railingFields.ts` (fälten
  `rail:gate:<i>:<fält>`, knapparna `rail-gate-…`); smartmenyn `railGate`
  (`opDefs.ts`, `ops.ts`, `tool.ts`).
- **Typerna**: `defaultGroundRailingTypes()` i `core/railingTypes.ts`,
  `ensureRailingTypes(tx, ground)`, `addDefaultRailingTypes`,
  `defaultRailingDef(doc, wanted, ground)` och `railingTypesFor(doc,
  ground)` i `core/railings.ts`; `RailingTypeModel.gateType`.
- **Verktyget**: `RailingTool` ritar på Platsen (`defFor` väljer en typ som
  passar där), och *Längs kant* tar andra kanter med `otherAt` (kedjan ur
  `snapSegments`, som spöets `traceAt`); `createLine(line, bulges, z,
  from)` ger stödmurens krön (`crest`, ur `wallProfile`). Panelen: *Hör
  till* (`rail-home`) och *Höjden från* (`rail-height-from`). `Railing` är
  med i `SEEN_ON_TYPES` sedan 0.11.
- **Editorn** (`ui/style/railingTypes.ts`) i fyra kolumner (`.rt-list`,
  `.rt-typecol`, `.rt-center`, `.rt-side`); sökningen `data-rt-search`
  (`railEditorSearch`, utan omritning), `partSummary`, parametertabellen
  (`param:<i>:formula` i `applyTypeField`), typens `slope` och `gateType`.
- **Tester**: `tests/v0113.test.ts`.

## Räckestypeditorn (0.11.2, format 26)

- **Kommandona** i `core/railings.ts`: `railingGroups(doc)` (stilbokens
  `railingGroups`, eller förvalen `RAILING_GROUPS`, och sist grupper som
  bara en typ har), `railingTypesIn`, `railingTypeUses`, `railingPrefix`
  (RÄ, ST, SP, G), `newRailingModel(group)`, `addRailingType`,
  `removeRailingType` (bara oanvända), `addRailingGroup`,
  `renameRailingGroup` (typerna följer med i samma transaktion),
  `moveRailingGroup`, `removeRailingGroup` (bara tomma),
  `setRailingTypeGroup` och `moveRailingPart`. Gruppernas ordning är ett
  valfritt fält i stilboken (`StyleResources.railingGroups`, normaliseras i
  `normalizeStyle`); inget nytt format.
- **Editorn** `ui/style/railingTypes.ts` (resursen `railings` i
  `styleDialog.ts`): läget i `RailEditorState` (`def`, `part`, `mode`) på
  dialogen (`rt`). Fälten har samma nycklar som typen i räckets panel
  (`rail:type:<def>:…`) och går genom `applyRailingField` (nya fält:
  `corners`, `stair`, `slope`, `gate`, `finish`, `detail`, `pen`, `depth`,
  `footing`); delarnas knappar är `railtype-…` (`railingAction`), editorns
  egna `data-rt-act`. Typerna dras med HTML5-drag (`railEditorDrag`, typen
  `application/x-rt-type`). `StyleDialog.open({ railingType })` öppnar en
  typ; panelens knapp är `style-railing-type` i `app/actions.ts`.
- **Förhandsvisningen** `ui/style/railingPreview.ts`: `previewMarkup(model,
  mode, vald)` bygger påhittade linjer med `freePath` och lägger delarna
  med `railingBody`, samma som ritningen. Från sidan för *Rak*, *I
  trappa* (åtta steg 300 × 168,75), *På sluttning* (600 på 3 600) och
  *Grind* (öppning 1 000; delar med `gate: 'continue'` ritas hela);
  ovanifrån för *Planen* (L-form, Detalj) och isometriskt för *3D*
  (längst bort först). Varje del har `data-rt-part`.
- **Shift före snäppet** (`ui/tools/snap.ts`, `lockedSnap`): med Shift tas
  låset först, sedan snäppet utan lås (`held` sparas runt anropet), och
  en punkt läggs på låsets linje (`track`, *i linje med*); en vägg ger
  skärningen med låset.
- **Tester**: `tests/v0112.test.ts`.

## Räcket (0.11.1, format 26)

- **Typmodellen** (`core/railingTypes.ts`): en räckestyp bor i en
  definition (`Definition.railing`, valfritt fält, inget nytt format) med
  `group`, kryssen `ground`, `building`, `childSafe`, parametrarna `params`
  (`name`, `value` som tal eller formel, `perRailing`) och delarna `parts`
  av slagen `point`, `along`, `repeat` och `surface`. Delarnas mått är tal
  eller formler (`RailNum`); `railValues(model, own)` räknar parametrarna
  (med räckets egna värden för dem som får ändras per räcke) och
  `railNum` ett mått. Formlerna räknas med en egen liten räknare
  (`evalFormula`, aldrig som kod). Fält för 0.11.3 finns redan (`slope`,
  `gate`, `below`). De förvalda typerna (`defaultRailingTypes`, id
  `t-ra01`–`t-ra03`) läggs i projektet av `ensureRailingTypes` i
  `core/railings.ts` första gången ett räcke läggs (`addRailings`);
  `updateRailingType` ändrar en typ.
- **Elementet** `Railing` (`elements/railing.ts`, parametrarna i
  `RailingParams` i `elements/railingGeometry.ts`): ritat med `line`,
  `bulges` och `z` (höjden per punkt mot våningens golv), eller på en
  trappa med elementets `host` (trappans id, så att räcket tas bort,
  kopieras och flyttas med trappan som dörrarna med väggen) och
  `params.host` (`side`, och `from`/`to` längs gånglinjen, utan
  gränssnitt än). `place` och `inset` (läget mot kanten, 50 mm), `values`
  (egna värden), `winder: 'stepped'`, `transition: 'knee'`. Ett räcke på en
  trappa flyttas inte för sig (`movePatch` ger null); speglas trappan byter
  räcket sida (`transforms.ts`).
- **Geometrin** (`railingGeometry.ts`, ren räkning): `nosingLine(g)` är
  stegnoslinjen längs gånglinjen (stegens framkanter, vilplanen plana till
  där nästa lopps lutning möter dem, golvet ovanför sist). Längs en kant
  blir den en profil i kantens sträcka (`ribAt(u).lp`/`rp`); *Utjämnad*
  tar bort loppens inre stegnosar, så att lutningen blir rak genom loppet,
  och `winderDeviation` är den största avvikelsen. Krökarna (R 150) är
  korta raka bitar (`bendProfile`). `hostedPath` och `freePath` ger
  `RailPath` (punkterna, höjden, sträckan och vilket håll som är inåt).
  `railingBody` (i `railingBody.ts` sedan granskningen efter 0.11.5)
  lägger delarna: stolparna jämnt med högst delningen i varje rak bit
  (hörn över 15°), spjälorna med lika öppningar mellan stolparna, ytorna i
  varje mellanrum och de längsgående delarna med sin förlängning
  (`withExtension`).
- **Planen** (`railingPlan` i `railingPlan.ts`, med grindarnas `gatePlan`;
  `railing.ts` ger den kroppen och grindens littera, så att filerna inte
  importerar varandra): linjen i Skiss och Normal (förlängningen i
  Normal), de längsgående delarna som dubbla linjer och stolparna i
  Detalj (`detail` per del, förval Detalj). Det som ligger över planens
  snitt (höjden längs linjen, delad där den går genom snittet) ritas med
  `railAbove`. Ställena i `repr/railingPens.ts`, gruppen *Räcken* i
  `penRows.ts`; sektionernas snitt är `railCut` (`cutRowOf`) och
  fasadernas linjer `railElev` (`facadeRowOf`). `alsoOnStorey` ritar ett
  räcke på en trappa också i våningen ovanför; `planReads: ['Stair']`.
- **3D** (`railingSolids`): liggarna som sneda kroppar per bit (`top` och
  `bottom` som plan genom ändarnas höjder), stolpar och spjälor lodräta,
  ytorna sneda mellan stolparna (`glass` utan material).
- **Varningarna** (`railingWarnings.ts`): `railingWarnings` (BFS 2024:9, 2 kap. 11 och 13 §, och
  *avviker från praxis*) och `stairHandrailWarning` (12 §, på trappan, kan
  kvitteras med `ack: ['handrails']`). Trappans egna texter i
  `stairWarnings` säger *avviker från praxis*.
- **Gränssnittet**: verktyget `ui/tools/railingTool.ts` (*Längs kant* med
  `stairEdgesAt`, *Ritat* med `ChainInput` och höjden ur trappkanten man
  klickar på), verktygsraden i `toolOptions.ts`, frågan i `prompts.ts`,
  smartspöt i `ui/wand/railingAlong.ts`, trappans smartmeny
  (`stairRailing`, `stairRailings` i `opDefs.ts`, `ops.ts`, `tool.ts`).
  Fälten i `ui/railingFields.ts` (nyckeln `rail:…`, knapparna `rail-…`)
  och typen i `ui/railingTypeFields.ts` (`rail:type:<def>:…`,
  `railtype-…`, `duplicateRailingType`); båda nås från
  `selectionActions.ts` och räckestypeditorn. Trappans panel har *Räcken* och kvitteringen
  (`stairFields.ts`).
- **Tester**: `tests/v0111.test.ts`.

## Trappan (0.11, format 26)

- **Elementet** `Stair` (`elements/stair.ts`, `StairParams` i
  `elements/stairGeometry.ts`): referenslinjen `line` med `bulges` som
  rampens, `width`, `refSide`, `walkSide` (utelämnad = utsidan av
  svängarna, mitten i en rak trappa), `walkLine` (300), `rise` (utelämnad =
  våningshöjden genom `storeyParams`; `stairParams` drar av fotens nivå),
  `risers` (utelämnad = stigningen genom 180), `level`, `start`/`end`
  (`riser` eller `tread`) med `startTread`/`endTread`, `landings` (punkter
  där sträckan efter är vilplan) och `turnLandings` (punkter där svängen
  är det), `thickness`, `hole` (`auto`/`none`), `headroom` (2100),
  `material`. `build`/`built` läses sedan 0.11.4 (se *Byggd trappa*), `spiral` sedan
  0.11.5 (se *Spiraltrappan*). Elementets `seenOn` (*Syns också på*) gäller också ramper,
  markytor, stödmurar och bjälklag (`SEEN_ON_TYPES` i `core/model.ts`).
- **Geometrin** (`stairGeometry`, ren räkning): referenslinjen görs platt
  (`flatLine`, bågarna som korta raka bitar), och bandet byggs i *zoner*:
  en rak zon per kant (revbenen vinkelrätt, kanterna parallella) och en
  sväng per hörn (revbenen strålar från det inre hörnet `pivot` till den
  yttre kanten `[Ao, Po, Bo]`; i en båge blir de radiella). `u` är
  sträckan längs gånglinjen; `ribAt(u)` ger revbenet med punkterna på
  kanterna och deras sträckor (`lp`, `rp`), så att `bandBetween(g, u0, u1)`
  ger ytan mellan två revben med kanternas punkter emellan. Vilplanen
  (sträckor och svängar) slås ihop till plana intervall; resten är lopp,
  och stegen (`n − 1 − vilplan`) fördelas efter loppens längd (minst ett
  per lopp) med lika djup i varje lopp. `items` är stegen, vilplanen och
  planstegen med höjden `z` (från foten), `risers` sättstegens läge.
  `stairWarnings` ger varningarna (BBR 8:232 och stegformeln, uppslagna 30
  oktober 2026); de spärrar aldrig.
- **Planen** (`stairPlan`): på den egna våningen delas trappan vid
  `cutAlong` (det första steg vars ovansida ligger över snitthöjden):
  sidorna och stegen före med `stairContour`/`stairBelow`, efter med
  `stairAbove`, snittlinjen `stairCut` snett över, plansteget i golvet med
  `stairFloorTread`, stegnosen `stairNosing` i Detalj (30 mm innanför
  framkanten), gånglinjen `stairWalk` med ring och pil. I våningen ovanför
  (`alsoOnStorey`) ritas den hel och det sista plansteget med
  `stairFloorTread`. Ställena står i `repr/stairPens.ts`, gruppen *Trappor*
  i `penRows.ts`; `stairCut` är också trappans snitt i sektionerna
  (`cutRowOf`).
- **3D** (`stairSolids`): ett block per steg med `bottom` som ett snett plan
  (rotlinjen minus `thickness` vinkelrätt, i stegets gångriktning); där
  planet skulle gå under foten blir undersidan plan på golvet. Vilplanen
  och det sista plansteget är plattor. Materialet är `slab` (eller
  stilbokens). Sektionerna och fasaderna får kroppen därifrån.
- **Hålet**: `stairHoles(ctx, slab, top, thickness)` läses av
  `slabRings` (3D, sektioner, rummens golvskiva) och ritas som kant i
  planen (`slab.plan`, utan kryss); bjälklaget har `planReads: ['Wall',
  'Stair']`. `stairHoleIn` räknar ett hål; *Gör till eget hål*
  (`stairFields.ts`) lägger det i bjälklagets `holes` och sätter `hole:
  'none'`.
- **Syns också på**: `seenFrom(el, place)`; `createContext` tar med sådana
  element i planen (som `alsoOnStorey`), och `buildPlan` ritar dem i en
  egen grupp (`…|syns`, `drawSeen`): linjer och snittens konturer med
  stället `seenContour` (gruppen *Från annan våning*), utan text och
  fyllning, och utan att gå att klicka på.
- **Verktyget** `ui/tools/stairTool.ts` (en `ChainInput` som Marks linjer,
  förhandsvisning med stegen), verktygsraden i `toolOptions.ts`, frågan i
  `prompts.ts`, smartspöt i `ui/wand/stairAlong.ts`. Referenslinjens
  punkter ändras som en öppen 2D-form (`shapeOf` och `shapePatch` i
  `elements/shapeEdit.ts`; vilplanen följer punkterna med
  `remapPerPoint`). Smartmenyn har *Vilplan härifrån*/*Steg härifrån* och
  *Vilplan i svängen*/*Kilsteg i svängen* (`opDefs.ts`, `tool.ts`).
  Egenskaperna i `ui/stairFields.ts` (nyckeln `stair:…`; en ändring tar
  bort nycklar som blir förval, så att våningens stigning gäller).
  Flytta, vrida och spegla i `moveCommands.ts` och `transforms.ts`
  (speglad byter `refSide` och `walkSide`).
- **Tester**: `tests/v011.test.ts`.

