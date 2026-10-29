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
  (582 steg sedan granskningen efter 0.10.25, som lade till 43 steg sist
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

## Vyer, mått och littera (0.6)

- `ViewDef` i `src/core/model.ts` sparar en vys inställningar. Appen håller
  en arbetskopia; jämförelsen kan ändras utan att vyn ändras.
- Måttpunkter (`DimPoint`) är fria punkter eller knutna till linjer i modellen
  (`src/elements/features.ts`): väggliv `l`/`r`, referenslinje `c`, ändar
  `e0`/`e1`, hålkanter `h1`/`h2` och möbelkanter.
- Littera byggs av mallar i stilmallen (`labels.templates`), se
  `src/elements/littera.ts`. Dörrnummer räknas i `src/elements/rooms.ts`.
- Väggens insida är höger sida i ritriktningen. `orientExteriorWalls` vänder
  ytterväggar som pekar fel (används vid migrering till format 3).

## Sifferfält, flytt och menyer (0.6.3)

- Sifferfält är `<input type="text" data-expr inputmode="decimal">`, aldrig
  `type="number"`. `installExpressionFields()` i `src/ui/expr.ts` räknar ut
  formler och enheter innan fältets egna lyssnare får `change` och Enter, så
  panelerna ser bara ett färdigt tal i mm. `data-unit="deg"` för vinklar,
  `data-unit=""` för tal utan enhet, `data-step` för piltangenterna.
  `evaluate(text, base, unit)` går att använda direkt och har tester.
- `moveElements(store, ids, d, label, { keepJoins })` flyttar och låter
  anslutna väggar följa med (`followJoins` i `src/core/commands.ts`): hörn
  inom 1 mm av en flyttad ände och T-skarvar mot väggens liv. En ansluten
  vägg får sin ände i skärningen med den flyttade väggens nya linje.
  `keepJoins: false` (Alt) flyttar fritt. Öppningar i väggar vars start
  flyttas kompenseras så att de står still.
- Högerklicksmenyer byggs med `ContextMenu` i `src/ui/contextMenu.ts` av en
  lista `MenuItem`. `onLongPress()` ger samma sak på pekskärm.
- Använd `askText` och `askConfirm` i `src/ui/ask.ts` i stället för
  `prompt()` och `confirm()`, som inte fungerar i alla miljöer.
- Inställningar som gäller användaren och inte projektet (panelernas lägen,
  kalkeringens utseende) ligger i `src/ui/uiSettings.ts` och sparas i
  webbläsaren. Då behöver filformatet inte ändras.

## Fasader, sektioner, tak och Modifiera (0.7, format 4)

- **Format 4.** Väggar kan ha `bulge` (pilhöjd, båge) och `toRoof`. Nya
  elementtyper: `Roof`, `North`, `Elevation` och `Section`. Migreringen 3 → 4
  lägger till norrpil, fyra fasader och en sektion (`drawingMarkers` i
  `src/core/model.ts`). En `ViewDef` kan ha `marker` och visar då en fasad
  eller sektion.
- **Globala typer.** `ElementType.global` betyder att elementet finns i
  alla tillstånd oavsett `states` (norrpil, fasad- och sektionsmarkörer).
  Panelen visar inte Finns i för dem.
- **Väggens ram** ligger i `src/geometry/wallFrame.ts`: `at(s, o)`,
  `tangent(s)`, `normal(s)`, `project(p)`, `trace(s1, s2, o)` och `local(s)`.
  För bågväggar är `u` och `n` kordans riktning; använd `tangent`/`normal`
  eller `local(s)` (en rak ram som sammanfaller med väggen vid s). Dörrar och
  fönster i bågväggar är raka och sitter längs tangenten. Bågmatematiken
  (pilhöjd, båge genom punkt, med tangent) ligger i `src/geometry/arc.ts`.
- **Sneda ovansidor.** `Solid` kan ha `top` och `bottom`, plan `z = a·x + b·y + c`.
  Taket (`src/elements/roof.ts`) delas i takfall med `roofPlanes`, och
  `trimToRoofs` delar väggarna efter taken ovanför.
- **Fasader och sektioner** byggs av `buildSection` i `src/repr/section.ts`
  ur samma former som 3D-vyn. Algoritmen för dolda linjer ligger i
  `src/geometry/hiddenLine.ts`: exakt för plana ytor, i bråkdelar av
  kanterna, med ett rutnät som snabbar upp. Kanter kommer från formernas egna
  `Edges3D` (väggar och tak ritar sina egna, utan skarvar mellan bitarna) och
  från `featureEdges` för andra former; böjda väggar får konturlinjer där
  väggmassan vänder sig bort. Resultatet är vanliga primitiver (x längs
  linjen, y = höjd) och visas i planvyn, som bara går att markera i.
- **Modifiera.** Kommandona ligger i `src/core/wallEdit.ts` (`splitWall`,
  `reshapeWall`, `tangentArc`, `roundCorner`, `mergeAtCorner`, `extendTo`,
  `offsetWalls`, `multiplyElements`, `mirrorAbout`). Valen och verktyget
  som förhandsvisar och utför ligger i `src/ui/modify/` (se *Smartmenyn och
  Modifiera-raden* nedan); Markera anropar `host.modify` vid klick (utan
  drag) på något som redan är markerat.

## Linjer, markörer och verktyg (0.7.1, samma format)

- **Kanternas sort.** `Edges3D` har `part` (`wall`, `hole`, `roof`, `frame`,
  `sash`, `leaf`, `lining`, `handle`, `sill`, `joint`, `glass`, `swing`),
  `dash` och `drawingOnly` (bara på ritningen, inte i 3D). `buildSection`
  ger linjen pennan ur `PART_PEN` i `src/repr/section.ts`; den tabellen blir
  penntabellen i stilmallen i 0.8. Nya delar av dörrar och fönster får en
  egen `part`.
- **Dörrar och fönster i fasad och sektion** byggs av `doorModel` och
  `windowModel` i `src/elements/openingModel.ts`, efter detaljnivå. Skiss
  har en osynlig skiva i hålet så att man inte ser in i huset.
- **Sektionens längd.** Allt klipps till u ∈ [0, linjens längd]
  (`clipSegAxis`, `clipPlane` i `hiddenLine.ts`, `cutSolid(…, uMax)`).
  `View3D.setClip` klipper 3D-vyn med samma ramar.
- **Taklutning** (`roofSlopes` i `section.ts`) sätts bara ut där takfallets
  kant närmast betraktaren har sin rätta lutning, och döljs med
  `view.hide: ['roofSlope']`. Öppningssätt döljs med `'swing'`.
- **Text längs linjer** vrids med `readableAngle` i `src/elements/markers.ts`
  så att den aldrig hamnar upp och ned.
- **Streckning** (`dashed` i `src/view2d/renderPrimitives.ts`) ritas sträcka
  för sträcka med mönstret töjt så att varje sträcka börjar och slutar med
  ett helt streck.
- **Nästan raka vinklar**: `skewOf`/`skewWarnings` i
  `src/elements/angleCheck.ts`. Exakt = högst `EXACT_MM` (0,5 mm) fel i
  änden. Gränsen i grader är en inställning i Gränssnitt (`angleWarn`).
- **Takets kontur**: `insertNode`, `moveNode`, `removeNode` och `offsetEdge`
  i `src/core/roofEdit.ts`; Modifiera känner igen hörn och kanter på
  markerade tak (`ModifyContext.roofId`, `index`).
- **Avrunda och fasa** stoppas av `openingsInCorner` i `src/core/wallEdit.ts`.
- **Urklipp**: `copyPayload`, `parsePayload` och `pasteClip` i
  `src/core/clipboard.ts`. Urklippet är JSON med `kind: 'bacchus-clip'` och
  formatnumret, och tar med typerna. Typer med samma littera och elementtyp
  återanvänds. Ett urklipp från ett nyare format tas inte emot; ändras
  formatet ska `pasteClip` migrera äldre urklipp som filerna.
- **Snäpp**: spårlinjer (`trackLines` i `src/ui/tools/snap.ts`) ger
  `kind: 'track'` med `guides`. Måttbandet och Zooma till område ligger i
  `src/ui/tools/measureTool.ts`, Rikta efter objekt i
  `src/ui/tools/markerTools.ts` (`AlignTool`). Förra zoomen sparas i
  `PlanView` (`previousZoom`).
- **Synpunkter**: `src/ui/feedbackDialog.ts` skickar till
  `public/feedback.php`, som läser mottagaren ur `feedback-config.php` i
  samma mapp eller mappen ovanför (aldrig i koden).

## Ritningsinformation, synlighet och projektträdet (0.8, format 5)

- **Format 5** (`src/core/model.ts`) har allt som 0.8 behöver, även det som
  byggs i senare delar: `folders` och `tree` (mappar i projektträdet; `tree`
  pekar från en vys, markörs, vånings eller blads id till mappen),
  `viewTags`, `worksheets`, `sheets` (blad med `viewports`) och `assets`
  (underlagens filer, en egen samling i `DocStore` så att ångra inte
  kopierar filerna). En `ViewDef` har `tags`, `scale` och `worksheet`.
  `project.angles` är projektvinklarna. Stilmallen har `pens`
  (penntabellen, läses av `buildSection`) och `font`. Migreringen 4 → 5
  lägger bara till tomma fält (`emptyTree()`).
- **Ytor.** `Element.space` säger var ett element är ritat: en fasad eller
  sektion (markörens id) eller ett arbetsblad. Utan `space` hör det till
  våningens plan. Koordinaterna gäller ytan; i fasader och sektioner är x
  längs linjen och y höjden, som i `buildSection`. `homeOf(el)` ger ytan.
- **Visas i.** `Element.show` (`ShowIn`): uppräknade vyer eller vy-taggar
  (`all`/`any`). Reglerna står i `src/core/visibility.ts` (`shownIn`,
  `allViews`, `countViews`) och har tester. Modellvyn av en yta har id
  `modelViewId(yta)`. `ViewStates` har `viewId`, `place`, `viewTags` och
  `showHidden`; `createContext` tar med det som hör hemma på `place` (eller
  våningen) och det som valts att synas i just den vyn, och
  `ctx.hiddenInView` säger vad som bara visas tonat.
- **En fasad eller sektion** ritas av `buildSection` (modellen) och
  `buildPlan` med `place: markörens id` (det som ritats i den), lagt
  ovanpå varandra i `renderAll`. `ToolHost.space()` ger ytan nya mått,
  texter och 2D-element hamnar på, och `canEdit(id)` vad som går att flytta
  i en vy som annars bara går att markera.
- **2D-element**: `Shape2D` (`shape`: polyline eller spline; pilhöjder
  per segment i `bulges`; fyllning i `fill`; ändar i `startCap` och
  `endCap`) i `src/elements/drawing2d.ts`, verktyget i
  `src/ui/tools/draw2dTool.ts`. Före format 13 fanns `shape` line, rect,
  arc och circle (se *2D-form del 2 (0.8.24)*), och före format 12
  `Line2D` och `Fill2D` (se *2D-form (0.8.19)*).
- **Taklutningen** (`src/elements/roofSlope.ts`): `buildSection` ger
  automatiska taklutningar med id `slope:<tak>:<takfall>` och deras värden
  i `slopes`. Markeras en skapar appen ett `RoofSlope`-element med de
  värdena (`materializeSlopes` i `app.ts`), och fasaden hoppar sedan över
  den automatiska. `deleteElements` döljer en taklutning (`hidden`) i
  stället för att ta bort den.
- **Lås**: `Element.locked`. `movePatch` och `deleteElements` rör inte
  låsta objekt; `setLocked` slår av och på.
- **Fasader som följer byggnaden** (`auto`) placeras för hand där de ligger
  när de flyttas: `placement.auto` i `src/core/commands.ts` sätts av
  elementlagret (`markerFrame`), eftersom kärnan inte vet hur läget räknas.
- **Projektträdet**: mappar och sparande i `src/core/treeCommands.ts`,
  formuläret i `src/ui/treeItemPanel.ts`. Egenskapspanelen visar det valda
  i trädet (`panel.treeItem`) när inget är markerat i ritningen; osparade
  ändringar ligger kvar när panelen ritas om.
- **Snittytor i 3D**: `buildSection` ger `cutFaces` (i linjens
  koordinater); `View3D.setClip(c, caps, z0)` fyller dem. Följ sektionen är
  en användarinställning (`followSection` i `uiSettings`), inte en del av
  projektet.
- Egenskaperna för 2D, taklutning, Visas i och Lås ligger i
  `src/ui/drawingPanel.ts`, som sedan 0.8.27 fördelar till
  `shapeFields.ts` (2D-formen), `underlayFields.ts` (underlag) och
  `showFields.ts` (Visas i). Sedan 0.8.1 ligger resten av egenskapspanelens
  fält i `src/ui/selectionFields.ts` (HTML) och det de ändrar i
  `src/ui/selectionEdits.ts` (`applyField` för fält med `data-key`
  "omfång:namn"); `propertiesPanel.ts` har bara panelen, snabbraden och
  knapparna (snabbradens knappar ritas i `quickBar.ts` sedan 0.8.27).

## Underlag (0.8.16, format 11)

- **Snäpp** (`src/ui/tools/snap.ts`): `SnapSegment` kan vara en bit av en
  kurva (`curve`: snäpper på den och i skärningar, men ger inga
  ändpunkter, mittpunkter eller spårlinjer) eller en punkt (`a` = `b` och
  `point`: `endpoint`, `midpoint`, `center`, `quadrant`). `on` är texten
  när man ligger på sträckan (förval *På vägg*). Nya `SnapKind`: `center`,
  `quadrant` och `parallel`. Skärningen mellan två sträckor nära markören
  (`crossingNear`) prövas efter punkterna; bitar av samma kurva och möten i
  en ände räknas inte. **Parallellt/vinkelrätt**: den raka sträcka som
  senast låg inom toleransen sparas i modulen (`inferred`); har man en
  föregående punkt och riktningen ligger inom 3° från den eller dess normal
  låses riktningen dit (`edgeLock`) före 15°-låset, och sträckan visas som
  hjälplinje. `forgetInferred()` anropas när verktyget byts (`tools.ts`)
- **DXF** (`src/formats/dxf.ts`): en `poly` kan ha `corners` (index för
  hörnen när andra punkter bara följer en båge: bultar, bågar, cirklar,
  ellipser, splines) och `curve` (`c`, `mid`, `quadrants`), transformerade
  som punkterna. `underlaySnaps(doc, id, params)` i `src/elements/underlay.ts`
  gör snäppningen av det, i modellens läge, sparad per läge och släckta
  lager; för en bild och PDF bildens kanter. `snapping.ts` använder den för
  underlag i planen och på arbetsblad, fasader och sektioner
- **Bildens grepp** (`src/elements/underlayEdit.ts`): `underlayGrips`,
  `dragUnderlayGrip` (hörn proportionellt eller fritt, sidor), `resizeUnderlay`,
  `stretched` och `restoreProportions`. Sträckning ändrar `size` (bilden
  ritas in i rektangeln), skalning `scale`. Markera ritar greppen för ett
  ensamt, olåst underlag och anropar `updateParams` när de släpps. Filens
  egen storlek läses i `underlays.ts` (`resetProportions`)
- **Fält**: `underlayPlaceFields` i `underlayFields.ts` (X, Y, bredd, höjd,
  Återställ proportioner) visas i egenskaperna och, via
  `PropertiesPanel.smartFields()`, direkt i smartmenyn (`.sm-fields`).
  Snabbknapparna för underlag är `zoom-selection` och `delete`
- **Trädet**: `underlag()` i `navigator.ts` grupperar det som inte ligger i
  mappar per filtyp och fil; `toggleUnderlayGroup` och `data-ul-group`.
  Ikonerna `filePdf`, `fileImage` och `fileDxf`
- `selectionBounds` tar det ritades rektangel när ett objekt saknar ytor
  (DXF-underlag), så att *Zooma till* och smartmenyns läge fungerar

## Grepp, underlag och arbetsblad (0.8 del 2, format 5)

- **Takets grepp i fasader och sektioner**: `roofGripsInView` och
  `dragRoofGrip` i `src/elements/roofGrips.ts`, rena funktioner med tester.
  Greppen ligger i vyns koordinater (x längs linjen, y höjd). Nocken ändrar
  `slope` (lutningen räknas tillbaka ur nockens höjd med `slopeForRidge`),
  takfoten ändrar `eave` och, åt sidan, konturen med `offsetEdge` från
  `src/core/roofEdit.ts`. Sadeltak får samma taksprång på båda sidor så att
  nocken ligger kvar; riktiga tak med takfot per kant kommer i 0.9. Markera
  ritar greppen i `overlay()` och anropar `updateParams` när de släpps.
- **2D-elementens punkter**: `src/elements/shapeEdit.ts` (`shapeNodes`,
  `moveShapeNode`, `rectWithCorner`, `shapeEdgeAt`, `insertShapeNode`,
  `removeShapeNode`, `offsetShapeEdge`). Greppen i Markera (`nodeAt`) och
  valen i Modifiera (`shapeInsert`, `shapeMove`, `shapeRemove`,
  `shapeOffset`, med `ModifyContext.shapeId`) använder samma funktioner.
  Modifiera fungerar i fasader och sektioner när allt markerat går att
  ändra där (`canEdit`).
- **Bilder som primitiver**: `ImagePrim` (`kind: 'image'`) i
  `src/repr/primitives.ts` har hörn, två vektorer och `source` (fil och
  sida), aldrig själva bilden. `renderPrimitives` frågar
  `RenderOptions.imageHref` efter en adress; appen ger blob-adresser
  (`src/ui/app/underlays.ts`) så att det som ritas om vid varje panorering
  är kort. Saknas adressen än ritas en streckad ram, och appen ritar om när
  bilden är klar. `Pen.opacity` tonar linjer och text.
- **Underlag**: elementtypen `Underlay` i `src/elements/underlay.ts`
  (`global`, ritas underst). Filen ligger i `doc.assets` och elementet har
  `asset`, `kind` (`image`, `pdf`, `dxf`), `pos`, `angle`, `scale` (mm per
  enhet i filen), `size`, `ref` (DXF: filens punkt i `pos`), `opacity`
  (0–100), `gray` och `layersOff`. `underlayTransform` och
  `underlayInverse` räknar mellan filen och modellen. `addWithAsset` i
  `src/core/commands.ts` lägger in fil och element i ett steg, och
  `deleteElements` tar bort en fil med den sista placeringen
  (`pruneAssets`). Urklippet tar med filerna (`ClipPayload.assets`).
- **PDF** ritas med pdf.js (`src/ui/pdf.ts`), som laddas först när det
  behövs. Vi använder **legacy-bygget** (`pdfjs-dist/legacy/build`): det
  vanliga bygget kräver `Map.getOrInsertComputed`, som Safari på iPhone
  saknar. Arbetaren byggs in i filen (`?worker&inline`) och delas av alla
  PDF:er (`PDFWorker.create`); den får inte stängas när ett dokument
  stängs. Sidan ritas som PNG med längsta sidan 4096 bildpunkter (2560 på
  telefon).
- **DXF** läses av `parseDxf` i `src/formats/dxf.ts`, som inte beror på
  något annat i programmet. Den ger polylinjer och texter i filens enheter,
  med lager, och packar upp block. Läsningen sparas per fil (`dxfOf`), och
  de färdiga primitiverna per läge och lager.
- **Kalibrera och rikta**: `UnderlayTool` i `src/ui/tools/underlayTools.ts`,
  ett tillfälligt verktyg som startas från egenskaperna, menyerna eller
  trädet (`startUnderlayTool`).
- **Arbetsblad**: `ui.worksheet` är arbetsbladet som visas (bredvid
  `ui.marker`), och `Place` har `kind: 'worksheet'`. Det som ritas på
  arbetsbladet har `space` satt till dess id och ritas med `buildPlan` med
  `place`. `createWorksheet`, `saveWorksheet` och `deleteWorksheet` ligger
  i `src/core/treeCommands.ts`; att ta bort ett arbetsblad tar bort det som
  är ritat på det och vyerna av det. På ett arbetsblad går bara
  `DRAWING_TYPES` (2D, text, mått och underlag) att klistra in.

## Ritningsblad, annoteringsskala och Plot/export (0.8 del 3, format 5)

- **Annoteringsskala.** `ViewStates.scale` (nämnaren, förval 100) blir
  `ctx.scale` i `createContext`, och allt som ritas i papperets storlek
  räknar med den: mått, rumsetiketter, littera, markörer, nivåmarkörer
  (`levelMark` i `section.ts`), taklutningar (`slopeSymbol(…, K)`) och
  texter i DXF-underlag. Texthöjder i primitiverna är alltid mm på papper.
  Skärmen ritar med `PlanView.drawingScale`, som appen sätter till vyns
  skala (`ui.scale`, sparas i `ViewDef.scale`) och till 1 på ett blad;
  `pickAt` och förhandsvisningarna i verktygen tar samma skala. Ritar en
  ny elementtyp något i papperets storlek ska den använda `ctx.scale`, aldrig
  ett fast 100.
- **Bladen i kärnan**: `src/core/sheets.ts` har pappersformaten (`PAPER`,
  `paperSize`), ramens marginaler, fälten i ritningshuvudet
  (`SHEET_FIELDS`, `PROJECT_FIELDS`) och kommandona: `createSheet`,
  `saveSheet`, `deleteSheet`, `duplicateSheet`, `addViewport`,
  `updateViewport`, `removeViewport`, `saveProjectFields` och `setLogo`.
  Loggan är en fil i `doc.assets` med id i `project.fields.logo` och
  proportionerna i `logoRatio`; `pruneAssets` tar aldrig bort den.
- **En vy på ett blad** (`Viewport`) pekar på en sparad vy eller på
  modellvyn av en våning, fasad, sektion eller ett arbetsblad
  (`modelViewId`). `viewSource` i `src/repr/sheet.ts` ger inställningarna
  (modellvyn: förslaget, jämfört med befintligt om det finns). `at` är var
  vyns nollpunkt hamnar på papperet: papper = `at` + modell / skala
  (`toPaper`). Ramen är det som är ritat (utan underlag, `contentBounds`)
  plus `VIEWPORT_PAD`; underlagen klipps mot ramen med `clipPrims` i
  `src/geometry/clipRect.ts`. En bild som sticker ut får `ImagePrim.clip`,
  som skärmen och PDF:en ritar som klippram. `cachedViewPrims` sparar
  vyernas primitiver per projektversion, så att fasader inte räknas om när
  bladet ritas om.
- **Bladet** byggs av `buildSheet`: papperet (`part: 'papper'`, ritas bara på
  skärmen), mallbladet (0.8.8), vyerna med rubrik och texterna. Allt är mm
  på papperet med y uppåt. Smarttext: `expandSmartText(text, smartVars(doc,
  sheet, idag))` i `src/repr/smartText.ts`; ny inbyggd smarttext läggs till
  i `smartVars` och `BUILT_IN` (`src/core/sheetFields.ts`).
- **I appen**: `ui.layout` är bladet som visas och `Place` har
  `kind: 'sheet'`. `src/ui/app/sheets.ts` ritar bladet (`drawing()`), har
  verktyget som markerar och flyttar vyerna (`SheetTool`, fäster mot de
  andra vyernas kanter och mitt), lägger nya vyer på första lediga plats
  (`freeSpot`) och har högerklicksmenyn. På ett blad går bara Markera och
  Panorera; andra verktyg går tillbaka till planen. Formulären för blad och
  vyer på blad ligger i `src/ui/sheetForms.ts` (`TreeItem` har `sheet` och
  `viewport`).
- **PDF** skrivs av `writePdf` i `src/formats/pdf.ts` utan bibliotek: en sida
  per `PdfPage`, mm i primitiverna (en `cm` per sida), osifont med
  WinAnsi sedan 0.8.18 (`src/formats/drawingFont.ts` har bredderna, som också används för
  att korta texter i huvudet), streckning sträcka för sträcka som på
  skärmen, skraffering som klippta linjer, bågar som Bézierkurvor och bilder
  som JPEG (`imageKey`). Bilderna tas fram av appen (`exportImage` i
  `src/ui/app/underlays.ts`). `browserDeflate()` packar innehållet.
- **Zip**: `writeZip` i `src/formats/zip.ts`, opackat med UTF-8-namn;
  `uniqueNames` gör filnamnen giltiga och unika.
- **Plot/export**: `src/ui/app/plot.ts`. Kryssrutorna följer mapparna i
  flikarna Ritningar och Vyer. Varje blad ger `<ritningsnummer>.pdf`, varje
  vy `<namn>.pdf` (`buildViewPage`: ett papper precis så stort som vyn).
  Exporten väntar en bildruta mellan filerna så att förloppet syns och
  Avbryt hinner fram; zipfilen sparas med `saveBlobFile`.

## Granskning (0.8.1)

- **Grannar i stället för alla mot alla.** `BoxIndex` i
  `src/geometry/boxIndex.ts` är ett rutnät över rektanglar: `add(i, box)`,
  sedan `at(punkt)` eller `near(box)`, som ger numren i stigande ordning så
  att den första träffen blir densamma som om alla prövats i tur och
  ordning. Rutnätet sållar bara; det exakta provet görs efteråt. Det
  används för väggskarvar (`computeWallShapes`); för par av former räcker
  ofta `boxOf` och `boxesTouch` i `src/geometry/boolean.ts`.
- **Dolda linjer** (`visibleSegments`): trianglarna sorteras efter
  närmaste djup innan rutnätet byggs, så en ruta kan sluta prövas när en
  triangel ligger bakom kanten, och en kant som blivit helt dold
  (`fullyHidden`, samma regler som `visibleParts`) slutar prövas.
- **Rum**: `holeAt` och rumsnumreringen prövar först rektangeln runt varje
  kontur (`ringsOf`, en gång per lista) och sedan punkt i kontur.
- **Kontrollera att en omskrivning ger samma resultat**: räkna fram planer,
  fasader, 3D, rumsnummer och projektet efter en rad kommandon med den gamla
  och den nya koden och jämför (byt `crypto.getRandomValues` mot en fast
  följd, så att nya id blir desamma; fasadens `ms` är en tid och skiljer
  alltid). Gränssnittet jämförs på samma sätt: samma klick i Playwright mot
  det gamla och det nya bygget, och läget (`bacchus.ui`, projektet,
  panelernas text) efter varje steg.

## Bakgrundstråd och markering (0.8.2)

- **Fasader och sektioner i en tråd.** `src/ui/app/sectionQueue.ts` ger
  `get(doc, markör, vyläge, stilmall, stilnyckel)`, som svarar direkt med
  den färdiga vyn om den finns för just det projektet, annars med den förra
  versionen av samma vy (eller null) medan den nya räknas i tråden
  (`src/repr/sectionWorker.ts`, som kör `handleSectionJob` i
  `src/repr/sectionJob.ts`). När svaret kommer körs `renderAll` igen. Vyer
  som senast tog under 30 ms räknas direkt (första gången gissas en halv ms
  per objekt), så små projekt beter sig som förut. Projektet skickas till
  tråden bara när det ändrats (projektets identitet avgör), utan
  underlagens filer. Medan tråden räknar ersätts köade jobb av det senaste.
  Går tråden inte att starta räknas allt direkt. I demon (en enda fil)
  ligger tråden i filen (`?worker&inline`).
- Bladen (`buildSheet`) och Plot/export räknar fortfarande fasader direkt.
- **3D-markering och klippning**: klippningen i 3D görs när bilden ritas,
  så träffar från `Raycaster` på den bortklippta sidan sorteras bort i
  `hitAt` (`view3d.ts`), som används för klick, högerklick och drag.
- **Markering i sektion**: snitten ritas sammanslagna (väggar och tak i en
  yta), men varje objekt markeras med sin egen snittyta (`ownCuts` i
  `buildSection`).

## Snabbare plan (0.8.3)

- **Planvyns lager** (`src/view2d/planView.ts`): tre SVG-element på varandra,
  rutnätet (`.plan-grid`), ritningen (`.plan-drawing`, med kalkeringen) och
  överst markering, verktyg och skalstock (`svg.plan`, som tar emot
  pekaren). Ritningen ritas om bara när innehållet ändrats (`setPrimitives`
  med en ny lista, `setUnderlay`, `drawingScale` eller `redraw()`, t.ex.
  när en PDF-sida laddats eller temat bytts). Panorering flyttar lagret med
  en CSS-transform (`will-change: transform`, så att webbläsaren inte målar
  om det), och lagret ritar också det som ligger utanför vyn
  (`overflow: visible`; rutan `.pane-2d` klipper). Zoom skalar grupperna i
  lagret (strecken med `vector-effect: non-scaling-stroke`) och ritar om
  140 ms efter sista hjulet. `requestRender()` ritar bara om de översta
  lagren, och bara det som ändrats skrivs in.
- **Planens cache** (`buildPlan` i `src/repr/plan.ts`): sparad per våning
  (eller yta), vyläge och stilmall, och för allt i projektet utom elementen
  (definitioner, tillstånd, filer …) som samma objekt; de tolv senaste
  sparas. Gruppen (typ, åtgärd, dold) återanvänds när dess element och det
  typen läser (`planReads`) är samma objekt. Är elementen oförändrade ges
  samma svar tillbaka, så att `setPrimitives` inte ritar om. Det fungerar
  för att dokumentet aldrig ändras på plats och `resolveParams` ger samma
  parametrar så länge elementet och definitionen är desamma (frysta i
  utveckling och tester, så att den som skriver i dem märks).
- **Väggarnas ytor** sparas per vägg (`WallShapeCache` i `wallBodies.ts`, förut `wall.ts`): en
  vägg räknas om när den själv, väggarna som når dess ändar (rutnätet ger
  dem) eller dess öppningar ändrats. Ytorna utan öppningar (`bareWallShapes`)
  delas av rummen, 3D och väggarnas sidor. Rummens hål sparas så länge
  väggarna är desamma. Sammanslagningen av väggytorna (`union`) görs om när
  en vägg ändrats; den är det dyraste som är kvar.
- `src/repr/reuse.ts` har hjälpen för cacharna: `sameItems` och
  `lastResults` (de senaste svaren för samma indata).
- **Snäppning**: `snapSegments` ger samma lista så länge planen och vyn är
  desamma, och `snap` söker i ett rutnät över listan (`nearSegments`) inom
  spårlinjernas räckvidd. `flushSnap` prövar bara sträckor nära det som
  flyttas. Testet i `tests/v083.test.ts` jämför med att pröva allt.
- **HATCH** (`readHatch` i `src/formats/dxf.ts`): koderna läses i ordning.
  Kanter som bågar och ellipser kan läsas på flera sätt (medurs bågar sparas
  speglade); den läsning väljs vars ändar möter grannkanterna (`chain`).
  Mönstrets linjefamiljer går genom blockens avbildning och ges som riktning
  och avstånd; likadana familjer slås ihop. I underlaget blir solid fyllning
  en ton (35 % av underlagets opacitet) och varje familj en yta med
  skraffering. Likadana mönster delas i SVG:n. `tests/filer/skraffering.dxf`
  är skriven av ezdxf.

## Arbetsflöde (0.8.4, format 5)

- **Skarven i läget Båda** (`installSplitGrip` i `src/ui/app/pane3d.ts`):
  planens andel av ritytan ligger i `uiSettings.split` (0,15–0,85) och i
  CSS-variabeln `--split` på `.app`. Rutorna har redan `ResizeObserver`, så
  planen och 3D följer med.
- **Dubbelklick i trädet**: trädet ritas om vid varje klick, så webbläsaren
  skickar inget `dblclick`. `treeDoubleClick` i `actions.ts` räknar två klick
  på samma rad inom 450 ms och går till 2D om bara 3D visas.
- **Ny vägg härifrån**: ett Modifiera-val (`wallOn` i
  `src/ui/modify/ops.ts`) som inte kör ett `ModifyTool` utan väggverktyget.
  `ModifyHost.startWallFrom` (i `app.ts`) sparar väggverktygets val i
  `wallFrom`, tar den klickade väggens typ, höjd och liv, och byter till
  väggverktyget med `setTool('wall', true)` (`true`: smartmenyn och
  markeringen ligger kvar). `WallTool.startAt` börjar kedjan i änden. Väljs
  något annat, eller avbryts valet, anropas `stopWall`; när första
  väggen är ritad släpps valet med `Modifier.release()` och smartmenyn göms. När kedjan är klar
  (`wallTool.onChange` utan `drawing`) kommer valen tillbaka och det går
  till Markera. `settingTool` hindrar att `setTool` anropas inifrån
  `setTool` när väggverktyget avslutas för att man valt ett annat verktyg.
- **Varningen för sneda vinklar** stängs av med `Element.skewOk` (frivilligt,
  därför samma format) och kommandot `setSkewOk`. `skewOf(…, evenIgnored)`
  räknar ändå, för kryssrutan i egenskaperna.
- **Tab mellan objekt**: `pickAllAt` i `src/view2d/pick.ts` ger allt under
  en punkt i den ordning `pickAt` väljer (`pickAt` är dess första).
  `SelectTool` minns listan vid hover och vilket Tab valt (`stack`); valet
  ligger kvar så länge markören är över objektet, och klicket och draget
  använder det (`pick`).
- **Flytta med måttbandet** (`MeasureTool.beginMove`, `applyMove`): de två
  senast klickade punkterna är sträckan. Kandidaterna är det som ligger vid
  sista punkten, först det som inte också ligger vid första. `moveAlong` ger
  förflyttningen längs sträckan. Fältet `#measure-move` i verktygsraden
  (`toolOptions.ts`) har fokus medan man skriver: Enter flyttar, Tab byter
  objekt, Esc avbryter.

## Smartmenyn och Modifiera-raden (0.8.5, format 5)

- **`src/ui/modify/`** är Modifiera, uppdelat: `ops.ts` har vilka val
  ett klick ger (`opsFor`), vad ett klick träffade (`modifyContextAt`),
  `ModifyHost` och vilka knappar i raden som tänds (`railFor`); valens
  namn och förklaringar (`OPS`) ligger i `opDefs.ts` och radens knappar
  (`RAIL`, `railOf`) i `rail.ts` (sedan granskningen efter 0.10.18; `ops.ts`
  exporterar dem vidare); `tool.ts` har `ModifyTool`
  (förhandsvisning och utförande, sedan 0.8.15 med valen i grupper, se
  *Granskning (0.8.15)*) och `runInstant`; `controller.ts` har
  `Modifier`, läget som smartmenyn, raden och verktygsraden delar.
- **`Modifier`**: `ctx` är vad valen gäller. `setSelection` sätts vid varje
  ny markering med det markerade som helhet (`bodyContext` i
  `src/ui/app/selectionPlace.ts`: klickpunkten om det markerades med ett
  klick, annars mitten; den är baspunkt för Flytta och Vrid). `setPart` är ett klick på det markerade
  (ände, hörn, kant), med `start` som förval (Ny vägg). `choose` kör ett
  val, `chooseRail` en knapp i raden: finns valet där man klickat, eller för
  hela markeringen, börjar det; annars sätts `picking` och nästa `setPart`
  med ett passande val startar det. `cancel` avbryter men behåller
  markeringen; efter ett utfört val går `ctx` tillbaka till helheten.
  Lyssnare (`subscribe`) ritar om menyn, raden och verktygsraden.
  `detailMarkup` och `bindValue` är raden med valets värde och tips, i
  smartmenyn eller i `.tool-options` (klassen `modify-detail` visar den
  med Markera).
- **`SmartMenu`** (`src/ui/smartMenu.ts`) ersätter `PetPalette` och
  `ModifyPalette`. Innehållet: rubriken (`PropertiesPanel.quickTitle`),
  valen, `detailMarkup`, snabbknapparna (`quickMarkup(…, false)`, utan
  rubrik) och vid *Mer* `selectionMarkup`. Placeringen utgår från det
  markerades ruta på skärmen (`selectionBounds` och `screenBox` i
  `selectionPlace.ts`): höger, vänster, under, över, och får den inte plats
  där den täcker minst. Den läggs om vid
  panorering (`onViewChange`). När bara 3D visas finns inget att lägga den
  bredvid, så den hamnar vid klicket, utan valen (`planShown`).
- **Modifiera-raden** (`src/ui/app/modifyRail.ts`) är en egen kolumn i
  appens grid (`modify`, bredd `--modify-w`, klassen `modify-rail-on`).
  Tänds efter `railFor` för det markerade; i fasader och sektioner bara
  när allt markerat går att ändra där, på blad aldrig.
- **Inställningarna** `smartMenu` (hette `petPalette`, läses som fallback)
  och `modifyRail` i `uiSettings`.
- Nya val i `OPS` hamnar i smartmenyn av sig själva via `opsFor`; i raden
  behöver de en plats i `RAIL` (testet i `tests/v085.test.ts` säger till).

## Ritningshuvudet som eget objekt (0.8.6, format 6)

*Huvudet, ramen och loggan togs bort i 0.8.8 (mallblad, se nedan); det
övriga i avsnittet gäller.*

- **Modellen**: `Sheet.items` är det som ligger på bladet utöver vyerna,
  nedifrån och upp (`SheetItem` i `src/core/model.ts`). I dag bara
  `TitleBlockItem` (`kind: 'titleBlock'`, `template: 'bh90'`, `at`). `at`
  är huvudets nedre högra hörn i mm från papperets nedre högra hörn, så att
  huvudet följer hörnet när formatet byts (`itemCorner` i
  `src/core/sheets.ts`). Huvudet lagrar inga fält: de ligger kvar i
  `sheet.fields` och `project.fields`. `Sheet.frame` slår av och på
  ritningsramen; `titleBlock` på `Sheet` finns inte längre. Nya slag
  (texter i 0.8.7, skalstock, orienteringsfigur) läggs till i `SheetItem`
  med ett eget `kind`; flytt och borttagning går genom samma kommandon.
- **Kommandon**: `createSheet(store, { titleBlock })` (blankt utan),
  `addTitleBlock`, `moveOnSheet` (vyer och saker i ett steg, avrundat till
  0,1 mm) och `removeFromSheet`. `duplicateSheet` ger sakerna nya id.
  `TITLE_BLOCK_TEMPLATES` är listan att välja i.
- **Ritningen**: `buildSheet` ger `items: PlacedItem[]` med ytan
  (`itemBounds`) och primitiverna, ritade efter vyerna och ramen.
- **I appen** (`src/ui/app/sheets.ts`): det valda på ett blad är det som
  visas i egenskapspanelen (`TreeItem` med `viewport` eller `titleBlock`),
  inte `selection`. `pickedThing`, `hit` (huvudena över vyerna), `snapMove`
  (fäster mot de andras kanter och mitt och mot ramen), Flytta med två
  klick (`startMove`, `cancelMove`, Esc i `keyboard.ts`) och
  `removePicked` (Delete). `subscribe` säger till Modifiera-raden, som på
  ett blad bara tänder Flytta.
- **Smartmenyn** kan visa annat än markerade objekt:
  `SmartMenu.showCustom` tar en `SmartMenuCustom` med rubrik, knappar,
  `anchor` (ytan på skärmen), `run` och `alive`; menyn stängs vid nästa
  omritning när `alive` säger nej. `show` och `hide` nollställer `custom`.
- **Formulären** i `src/ui/sheetForms.ts`: bladet har ram, vyerna och
  huvudena med *Lägg på ritningshuvud* och kryssrutan för nya blad
  (`uiSettings.newSheetTitleBlock`, sparas direkt, inte med Spara).
  Huvudet har ritningens fält (sparas med `saveSheet`) och projektets
  (`saveProjectFields`).

## Text på bladet och vyernas ram (0.8.7, format 7)

*`SheetTextItem`, `Sheet.items` och textverktyget på bladet
(`sheetText.ts`) togs bort i 0.8.9: text på bladet är en vanlig text (se
nedan). Ramen och greppen gäller.*

- **Modellen**: `SheetTextItem` (`kind: 'text'`, `at`, `text`, `height`,
  `bold?`) i `SheetItem`. `at` är första radens baslinje till vänster, i mm
  från papperets nedre vänstra hörn (inte från höger som huvudet), och
  höjden är i mm på papperet. `Viewport` har fått `hideScale?` och
  `crop?: Bounds`. Ramen ligger i vyns modellkoordinater (eller fasadens och
  sektionens), så att den visar samma del när skalan byts.
- **Kommandon** i `src/core/sheets.ts`: `addSheetText`, `updateSheetText`
  (en tom text tas bort), `setViewportCrop` (null återställer ramen till
  innehållet) och `SHEET_TEXT_HEIGHTS`. `updateViewport` tar bort tomma
  `hideScale` och `crop`. Flytt och borttagning går som förut genom
  `moveOnSheet` och `removeFromSheet`.
- **Ritningen** (`src/repr/sheet.ts`): `itemBounds(doc, sheet, item, today)`
  räknar textens yta med smarttexten ifylld (`expandSmartText`,
  `smartVars`). Raderna har 1,5 × höjden emellan, som fri text i vyerna.
  En vy med `crop` får ramen därifrån och allt klipps mot den
  (`clipPrims`); utan `crop` klipps bara underlagen som förut.
  `PlacedView` har `at`, `scale` och `cropped`; `paperToModel`,
  `modelToPaper` och `contentCrop` räknar mellan papperet och modellen.
  `viewTitle` hoppar över *SKALA 1:n* när `hideScale` är satt.
- **I appen**: textverktyget är tillåtet på blad. `changeTool` och
  `renderAll` i `app.ts` väljer `sheets.textTool` när verktyget är Text
  och annars `sheets.tool` (`sheetTool`). Verktyget och redigeringen på
  plats (`InlineTextEditor` med ritningsskala 1) ligger i
  `src/ui/app/sheetText.ts`. Texten tar sin text, höjd och fetstil från
  `TextTool` (`text`, `height`, `bold`), som verktygsraden ställer in.
  `SheetThing` har fått `sheetText`, och `TreeItem` likaså. Texterna
  träffas före huvudena, så att en text som ligger på ett huvud går att ta.
- **Ramens grepp** (`src/ui/app/sheets.ts`): den valda vyn visar åtta grepp
  (`GRIPS`, `gripHit`); att dra ett ändrar kanterna (`resized`, minst 5 mm)
  och fäster dem mot ritningsramen och de andra sakernas kanter
  (`snapEdge`). Släpps greppet sparas ramen med `setViewportCrop`.
  *Återställ ramen till innehållet* finns i smartmenyn (bara när ramen är
  ändrad) och i vyns formulär. Byts vyn i formuläret följer ramen
  innehållet igen; byts skalan står ramens mitt kvar på papperet.

## Mallblad (0.8.8, format 8)

- **Modellen**: ett mallblad är ett `Worksheet` med `paper` (`size`,
  `orientation`); `isMaster(w)` i `src/core/model.ts`. Det som ritas på det
  har `space` satt till dess id, som på ett arbetsblad, och koordinaterna är
  mm på papperet från nedre vänstra hörnet. `Sheet.master` är mallbladet
  bladet använder och `project.master` det förvalda. `Sheet.frame` och
  `TitleBlockItem` finns inte längre; `SheetItem` är bara texter.
- **Kommandon** i `src/core/sheets.ts`: `createMaster`, `saveMaster`,
  `setDefaultMaster`, `masterOf` och `mastersOf`. `createSheet` tar
  projektets förval och mallens format om inget annat anges (`master:
  undefined` ger ett blad utan mall); `saveSheet` tar bort `master` när det
  är tomt. `deleteWorksheet` tar bort mallbladet ur bladen och förvalet.
- **Exempelmallbladet** byggs av `exampleMaster` i
  `src/core/exampleMaster.ts` (fasta id `mall-a3-1` …) och läggs in av
  `emptyProject` och `sampleProject`.
- **Tillstånd**: `createContext` ger allt på ett mallblad åtgärden `plain`,
  så att det syns oavsett tillstånd och jämförelse.
- **Ritningen** (`src/repr/sheet.ts`): `masterPrims` ritar mallbladet med
  `buildPlan` och `masterViewStates` (skala 1) och byter smarttexten i
  textprimitiverna mot bladets värden (`smartVars`); tomma texter hoppas
  över. `buildSheet` lägger papperet (`paperPrim`), mallen, vyerna och
  texterna i den ordningen. `SheetDrawing.frame` är den vanliga ramens
  marginaler (`FRAME_MARGIN`), som flyttade saker fäster mot och nya vyer
  läggs innanför. Mallbladen går inte att lägga på ett blad som vy
  (`viewSource`, `placeableViews`).
- **Smarttexten** ligger i `src/repr/smartText.ts` (förut `titleBlock.ts`):
  `SMART_TEXT`, `expandSmartText`, `sheetScales` och `smartVars`. Fälten
  (0.8.10) ligger i `src/core/sheetFields.ts`, se nedan.
- **I appen**: ett mallblad öppnas som ett arbetsblad (`goTo({ kind:
  'worksheet', id })`, `ui.worksheet`). `shownMaster()` i `app.ts` ger
  annoteringsskalan 1 i `viewStates`, och `renderAll` sätter
  `drawingScale = 1`, döljer rutnätet och skalstocken och lägger papperet
  underst. `.app[data-place='master']` döljer tillstånden och detaljnivån.
  Nya underlag (PDF, bild) får sin storlek på papper. Projektträdet listar
  mallbladen under Ritningar (inte under Modell); formuläret ligger i
  `src/ui/treeItemPanel.ts`, bladets val av mallblad och fälten i
  `src/ui/sheetForms.ts`. `sheets.newMaster()` gör ett nytt.
- **Text** har `bold` och `align` (`start`, `middle`, `end`), i
  egenskaperna och verktygsraden.
- **DXF till mallblad** (utvecklingsverktyg): `scripts/mallblad-fran-dxf.py`
  läser en ram med ezdxf och skriver linjer och texter som JSON (bredd efter
  färg, justering från TEXT och MTEXT, kända platshållare till smarttext);
  `scripts/mallblad-projekt.mts` bygger ett projekt med dem som förvalt
  mallblad. Att göra om DXF i appen ligger efter pilotprojektet.

## Grafik och textrutor på bladen (0.8.9, format 9)

- **Modellen**: det som är ritat på ett blad är element med `space` satt till
  bladets id, i mm på papperet från nedre vänstra hörnet, som på ett
  mallblad. `Sheet.items` finns inte längre (`parse` hoppar över det).
  `sheetContents(doc, id)` i `src/core/sheets.ts` ger elementen;
  `deleteSheet` tar bort dem (och underlagens filer) och `duplicateSheet`
  kopierar dem.
- **Vyerna i markeringen**: en vys id ligger i `selection` som ett objekts.
  `moveElements` flyttar vyer bland id:na (`moveViewportsTx`) och
  `deleteElements` tar bort dem från bladet (`removeViewportsTx`), i samma
  transaktion som elementen. `isViewportId` känner igen dem. `opsFor` och
  `railFor` ger bara Flytta när en vy är med; snabbraden tar bort Vrid,
  Spegla, Kopiera och Riv. `moveOnSheet(store, ids, d)` flyttar vyer ensamma.
- **Ritningen**: `buildSheet` ritar bladets element med `buildPlan` och
  `sheetViewStates` (skala 1, bladets smarttext i `smart`), underlagen under
  vyerna och resten över. `SheetDrawing.pickables` har vyerna (en sluten
  ram med rubriken, prioritet −100, så att det ritade på vyn träffas först)
  och elementens. `createContext` ger allt på ett blad åtgärden `plain`.
- **Smarttext i planen**: `ViewStates.smart` är smarttextens värden; texten
  fylls i i `textType.plan` före radbrytningen, och ett tomt fält ger ingen
  text. `masterPrims` använder samma väg. `expandSmartText` ligger i
  `src/elements/textLayout.ts` (och exporteras från `smartText.ts`).
- **Textrutor**: `TextParams` har `anchor` (`top`, `middle`, `bottom`;
  utelämnad = första radens baslinje), `maxWidth` och `maxHeight` i mm på
  papperet. `layoutText` i `src/elements/textLayout.ts` bryter raderna
  (`wrapLine`, osifonts `textWidth` sedan 0.8.18) och ger baslinjerna, ytan och rutan i
  textens eget system; `textPoint` lägger dem i modellen med vridning och
  skala. Ryms texten inte i höjden ritas en röd ram med `part: 'skärm'`,
  som PDF:en hoppar över (som `papper`). Redigeringen på plats börjar på
  första raden.
- **I appen** (`src/ui/app/sheets.ts`): `SheetTool` lägger sig utanpå
  `SelectTool`. Den sköter greppen i en ensam markerad vys ram och dragning
  av en vy ensam (med fästning mot de andra vyernas och det ritades kanter);
  allt annat går till markeringsverktyget. `toolFor('select')` i `app.ts`
  ger `SheetTool` på blad. Textverktyget och 2D (`SHEET_TOOLS` i `shell.ts`)
  ritar på bladet (`host.space()` ger bladets id); Mått ger ett tips.
  `PropertiesPanel.selectionItem` visar vyns formulär när en vy är ensam
  markerad, och `SmartMenu.customFor` ger dess smartmeny (byggs om vid
  `refresh`). Inget markerat på bladet visar bladets formulär.
- **Egen skala**: `scaleField` och `readScale` i `src/ui/sheetForms.ts`
  (*Egen skala…* med ett fält för nämnaren).

## Smarta fält (0.8.10, format 10)

- **Modellen**: `project.fields` är fälten som gäller hela projektet och
  `Sheet.fields` bladets; nyckeln är fältets namn med små bokstäver
  (`fieldKey`). Ett fält gäller hela projektet när nyckeln finns i
  `project.fields`, också med tomt värde, och då går projektets värde före
  bladets. Nya projekt får `PROJECT_DEFAULT_FIELDS` (`src/core/model.ts`)
  tomma. Nya blad får `datum` (idag) och `skede` (BYGGLOVSHANDLING).
- **Inbyggt** (`BUILT_IN` i `src/core/sheetFields.ts`) räknas i `smartVars`:
  projekt, ritningsnummer, innehåll, mapp (`folderName`), skala, skala a3
  (nämnaren gånger papperets långsida / 420), format och idag. Skala och
  skala a3 går att skriva över med ett fält på bladet. Allt annat inom
  klamrar är fält; `expandSmartText` ger tomt för namn utan värde.
- **Fälten ett blad använder**: `fieldsOf(doc, sheets)` letar i texterna med
  `space` = bladets eller mallbladets id (`bracedNames`) och tar med fält
  som har ett värde på bladen men inte används (`used: false`).
- **Spara**: `applyFieldChanges(store, ids, { values, shared })` (och
  `applyFieldChangesTx` i en pågående transaktion) skriver bara de fält som
  nämns. `shared: true` flyttar värdet från bladen till projektet,
  `false` tillbaka till alla blad. `saveSheet` tar ändringarna som femte
  argument, så att bladets formulär sparas i ett steg. `renameProject`
  byter projektets namn.
- **I appen**: `fieldTable` och `readFieldChanges` i `src/ui/sheetForms.ts`
  (inputs med `data-field`/`data-orig` och kryssrutor med `data-shared`).
  `TreeItem.also` är fler markerade blad; `pickSheets` i
  `src/ui/app/actions.ts` sköter Ctrl- och Shift-klick, och
  `NavigatorHost.treeItems()` markerar raderna. Formuläret för flera blad
  har `data-tree-kind="sheets"` och `data-ids`.

## Granskning (0.8.11, format 10)

Inga nya filformat. Uppdelningen kontrollerades som i 0.8.1: samma klick i
webbläsaren i bygget före och efter (väggar, markera, flytta, ångra, ruta,
högerklick, kortkommandon, mått, mätning, 3D, fasad, blad, vy på blad,
mallblad) gav samma projekt, markering, ritning, panel och smartmeny.

- **Uppdelning**: verktygen ligger i `src/ui/app/tools.ts` och ritningen
  (`renderAll`, `viewStates`, sektionskön) i `src/ui/app/render.ts`. Båda
  installeras först efter `app`, så `mountApp` läser `tools.x` och
  `render.x` när de används (stängningar), aldrig medan appen byggs.
  `AppContext` fick `toolOpts`, `underlays`, `views`, `toolFor`,
  `update3d` och `syncStatus`. Bladets markeringsverktyg är en egen klass
  (`SheetTool`) med ett `SheetToolHost`; fästningen är rena funktioner i
  `sheetGeometry.ts` (testade i `tests/v0811.test.ts`). Ytorna en dragen vy
  fäster mot räknas en gång när dragningen börjar
- **Vyerna på bladen** (`cachedViewPrims` i `src/repr/sheet.ts`) sparas per
  *modellprojekt*: projektet utan `sheets` och utan element vars `space` är
  ett blad (`modelDoc`). Det blir samma objekt så länge bara bladen ändrats,
  så att en flyttad vy eller en text på bladet inte räknar om fasader och
  sektioner. Ingen vy får därför bero på bladen; gör en vy det (t.ex. en
  markör som visar ritningsnumret) måste `modelDoc` ta med det
- **Mätt men lämnat**: en flyttad vägg räknar fortfarande om
  sammanslagningen av väggytorna (`polygon-clipping` står för det mesta av
  tiden, 0,07–0,16 s för 300–700 väggar); för en villa några ms
- **Visa i kategorier**: `SHOW_GROUPS`, `isShown` och `setShown` i
  `src/ui/app/showMenu.ts`. Nycklarna är desamma som förut i vyns `hide`;
  littera släcks per typ med `littera:Wall`, `littera:Door` och
  `littera:Window` (`showLittera(ctx, typ)`), och en äldre vy med `littera`
  delas upp när en typ tänds. `Underlay` i `hide` släcker underlagen
- **Text i DXF** (`textPlacement` och `mtextLines` i `src/formats/dxf.ts`):
  TEXT har justeringen i 72/73 och punkten i 11/21 (3 och 5: mellan 10 och
  11); MTEXT har fästpunkten 1–9 i 71, radavståndet 5/3 av höjden gånger 44
  och stycken vid `\P`. Raderna blir en text var med baslinjen räknad från
  punkten; nederkanten ligger 0,3 av versalhöjden under baslinjen. Har
  MTEXT en egen styckesjustering (`\pxql;`) fästs blocket efter sin
  bredaste rad (Helveticas bredder). DXF mäter versalhöjden
  (`DXF_CAP_HEIGHT` = 0,72 av teckenstorleken)
- **Markering** (`pickAllAt` i `src/view2d/pick.ts`): en typ med `pickSoft`
  (2D-former) har mjuka ytor: inuti ger 1500 i stället för
  3000, så att en linje inom toleransen (2000) går före, men inuti går
  fortfarande före rum (1000)
- **Linjetjocklek** (`LineWeights` och `penPx` i
  `src/view2d/renderPrimitives.ts`): `screen` är 4 px per mm (som förut),
  `true` pappersmåttet gånger `drawingScale · camera.scale`, `thin` högst
  1 px; alla minst 0,75 px (skraffering 0,6). Läget ligger i
  `UiSettings.lineWeights` och `PlanView.lineWeights`; knappen i
  statusraden växlar (`syncStatus` i `actions.ts` visar Rutnät, Snäpp och
  Linjer)

## Skalstock och stämplar (0.8.12, format 11)

- **Skalstocken** är elementtypen `ScaleBar` (`src/elements/scaleBar.ts`)
  med `space` = bladets id och `params` `{ pos, scale, view? }` (mm på
  papperet; `pos` är linjens vänstra ände). `scaleBarScale` tar skalan från
  vyn på bladet med id `view` om den finns, annars `scale`.
  `scaleBarLayout(skala)` ger strecken och talen: Carl Augusts tolv skalor
  ligger i `BARS` som de står i hans DXF (streck `läge+slag`, M 5 mm/0,7,
  m 4/0,35, s 3/0,18, S 4/0,18), en skala med samma siffror som en av dem
  tar dess indelning (tiopotensen flyttas), övriga får jämna steg och en
  linje som slutar på ett tal. 1:1 och 1:2 räknas i millimeter.
  `planReads: []`: ritas om bara när elementet ändras eller bladen
  (`savedFor`), vilket räcker eftersom den bara läser vyernas skala.
- **Stämplar** är arbetsblad med `stamp: true` (`isStamp`); `onPaper(w)`
  (mallblad eller stämpel) ersätter `w.paper` överallt där det betyder
  "ritas i mm på papper". `isMaster` är nu `paper && !stamp`. Stämplar
  syns inte bland vyerna att lägga på blad (`placeableViews`), har ett eget
  avsnitt under Ritningar och ett eget formulär (`treeItemPanel.ts`).
- **En stämpel på ett blad** är elementtypen `Stamp`
  (`src/elements/stamp.ts`) med `{ pos, stamp }`. Den ritar stämpelns
  element med `buildPlan` (place = stämpeln, skala 1, bladets `smart`) och
  flyttar dem till `pos`. Den har inga `planReads`, så den räknas om när
  något element ändras (stämpelns innehåll kan ha ändrats). En stämpel som
  saknas, är tom eller ligger i en stämpel ritas som en streckad ruta.
  `deleteWorksheet` tar bort stämpelns `Stamp`-element på bladen i samma
  steg. `sheetTexts` tar med texterna i stämplarna på bladet, så att deras
  fält syns i bladets fälttabell.
- `src/core/sheets.ts`: `addScaleBar`, `scaleBarHome`, `createStamp`,
  `stampsOf`, `stampUsers`, `placeStamp`, `moveOnly` (skalstock, stämpel
  och vy: bara Flytta i smartmenyn och Modifiera). `duplicateSheet` ger
  kopians vyer nya id och låter skalstockarna följa dem.
- Stämpelns nollpunkt ritas som ett kryss på skärmen (`stampOrigin` i
  `src/repr/sheet.ts`, del `skärm`, kommer inte med i plot).

## Fler Modifiera-verktyg (0.8.13, format 11)

- **Trimma, Hörnskarv och Dela** ligger i `src/core/trimEdit.ts`, utan
  webbläsare (testas i `tests/v0813.test.ts`). `trimPath` gör jobbet för
  alla öppna linjer: skärningarna med sträckorna i `cutters` längs linjen,
  och biten mellan de två närmast klicket tas bort. Väggar trimmas mot
  andra väggars referenslinjer (`wallCutters`), 2D-linjer mot allt som går
  att snäppa till (`snapSegments`). Bågväggar, slutna polylinjer och andra
  former går inte än (`canTrim`, `canJoin`). Funktionerna svarar med
  `EditResult`; dörrar och fönster i vägen kommer som `blocked`
- **Avrunda alla / Fasa alla** (`roundCorners` i `wallEdit.ts`): alla hörn
  mellan de markerade väggarna (`cornersAmong`) räknas på väggarna som de
  är, och ett hörn görs bara om väggen räcker till båda sina hörn, så att
  ordningen inte spelar roll. `roundCorner` och `roundCorners` delar
  `cornerPlan` och `applyCorner`
- **Baspunkten** (`ModifyTool.base` i `src/ui/modify/tool.ts`) för Flytta,
  Vrid, Spegla och I rad: från ett klick på det markerade bara om
  `snapBase` hittar en ände, ett liv eller en referenslinje (också det
  markerades egna konturer, t.ex. en bilds hörn); annars `null`, och första
  klicket blir baspunkten. `ModifyContext.clicked` säger om `at` kommer från
  ett klick. `ModifyTool.prompt()` ger tipset medan verktyget väntar, och
  verktyget säger till kontrollern (`changed`) när det byter läge
- **Kortkommandon**: varje knapp i `RAIL` har en bokstav (`key`), Shift +
  bokstaven trycker på knappen (`press` i `src/ui/app/modifyRail.ts`, från
  `keyboard.ts`, som jämför `e.code` så att det fungerar oavsett
  tangentbordslayout). Listan i inställningarna och tipsen byggs från `RAIL`
- **Publicering**: `.github/workflows/publicera.yml` bygger, testar och
  laddar upp `dist/` med FTPS vid varje push till `main` (inte för ändringar
  bara i `docs/` eller `.md`). Uppladdningen sparar vad som finns på servern
  i `.ftp-deploy-sync-state.json` och laddar sedan bara upp det som ändrats

## Modifiera-verktyg del 2 (0.8.14, format 11)

- **Utan webbläsare** i `src/core/arrange.ts` (testas i
  `tests/v0814.test.ts`): `moveEach` flyttar varje objekt med sin egen
  förflyttning i en transaktion; anslutna väggar följer med genom
  `followJoins` (exporterad från `commands.ts`, med en `skip`-mängd för de
  andra som flyttas, och räknar nu från läget i transaktionen så att flera
  anrop i rad inte skriver över varandra). `scaleElements` och
  `scaledParams` (`canScale` säger vilka typer), `transferSettings`
  (pipetten: allt i `params` utom det som är form eller läge, `PLACEMENT`,
  plus typen), `extendAllTo` och `trimAllAt` (gränsen är en lista sträckor;
  trimningen använder `trimPath` från `trimEdit.ts`)
- **Verktyget** är `ArrangeTool` i `src/ui/modify/arrangeTool.ts`, med
  samma gränssnitt mot `Modifier` som `ModifyTool` (`prompt`, `setValue`,
  `applyValue`); kontrollern väljer klass med `ArrangeTool.handles(op)`.
  Justera räknar varje objekts kanter ur dess ritade form (`outlinePoints`
  från planens `pickables`), `alignMoves` och `alignToLineMoves` är rena
  funktioner. Knapparna för Justera ritas i `detailMarkup` och fångas i
  `bindValue` (`data-align`)
- **Smartmenyn**: de nya valen kommer som en egen grupp sist för det
  markerade som helhet (`arrangeOps` i `ops.ts`). I Modifiera-raden ligger
  Förläng alla och Trimma mot gräns under Förläng och Trimma (`ops` i
  `RAIL`); med flera markerade väljer Förläng den nya (den gamla behöver ett
  klick på en ände), medan Trimma behåller den gamla
- **Tjocklekstabellen** (`weightPicker` i `src/ui/weightPick.ts`) är
  radioknappar i en `<details>`, så valet går genom samma change-händelse
  som listan förut (`data-key="d2:weight"` i panelen, `name="d2-weight"`
  i verktygsraden). Färgerna står i `PEN_COLORS` i `drawing2d.ts`

## Granskning (0.8.15, format 11)

Inga nya filformat. Kontrollerat som i 0.8.11: 45 förlopp med 250 steg
genom alla val i Modifiera (med Playwright mot det gamla och
det nya bygget och fasta id) gav samma projekt, markering, ritning,
förhandsvisning, panel och smartmeny, och kärnans funktioner gav samma
projekt i 1 982 jämförelser.

- **Registren** (`src/core/elementIndex.ts`): `hostedIn(doc, väggId)` ger
  dörrarna och fönstren i en vägg, `wallEndsIn(doc, våning, rektangel)`
  väggändarna i ett rutnät (rutor på 1 m) och `wallsAt(doc, våning, punkt)`
  väggarna med en ände inom 1 mm. Ett register byggs första gången det
  behövs för en samling (`doc.elements`) och sparas med den som nyckel i en
  `WeakMap`. Ett sparat dokument ändras aldrig, men `TxBuilder` ändrar sin
  egen kopia på plats och säger därför till om varje ändring
  (`noteElementChange` i `record`), så att registret stämmer mitt i en
  transaktion. **Regel:** den som ändrar en samling på plats utanför
  `TxBuilder` får inte ha frågat registren om den förut
  (`orientExteriorWalls` räknar därför alla vändningar mot det gamla
  projektet och fyller samlingen sist)
- Registren används av `cornerPartner` (och därmed `cornersAmong`,
  smartmenyn och Modifiera-raden), `openingSpans`, `rehost`,
  `putWallEnds`, `reversedWall`, `transformed` (Spegla), `offsetGeometry`
  och `offsetWalls`. `followJoins` lägger de flyttade väggarna i ett
  `BoxIndex` (utökade med tjockleken) och hämtar bara väggändarna inom dem;
  rutnätet ger de flyttade väggarna i samma ordning som förut, så den
  första som passar gäller fortfarande. `offsetWalls` flyttar bara ändar på
  väggar på samma våning (förut alla väggar med en ände i hörnet)
- **Modifiera uppdelat** (`src/ui/modify/`): `state.ts` har `ModifyState`
  (det valen läser av verktyget), `wallOf`, `nearestOf` och `reportEdit`;
  `wallOps.ts` väggarnas form, `outlineOps.ts` punkter och kanter på 2D och
  tak, `cutOps.ts` Trimma, Dela, Hörnskarv och Förläng, `transformOps.ts`
  Flytta, Vrid, Spegla och I rad (`BASE_OPS`), och `draw.ts`
  förhandsvisningens `svgLine`, `arcPoints`, `ghostPath` och `ghostOf`.
  Varje grupp har en mängd med sina val, en funktion som utför (svarar true
  när verktyget är klart) och en som ritar förhandsvisningen.
  `ModifyTool` håller läget, baspunkten och den första väggen i Hörnskarv
- `pickableById(pickables)` i `src/repr/plan.ts` ger det ritade objektet för
  ett id, sparat per plan (förut byggdes uppslaget vid varje musrörelse på
  sex ställen). `pathOf` ligger i `trimEdit.ts`, och avståndet till en
  sträcka är `distToSegment` i `geometry/vec.ts` överallt
- `outlinePoints` och Justera räknar största och minsta utan spridning
  (`Math.min(...)` och `push(...)` har ett tak på ungefär 120 000 värden,
  som ett stort DXF-underlag kan nå); gränsen och linjen under markören
  söks med `nearSegments`
- **Prestandatestet** har Modifiera med 1 200 väggar (`roomGrid(24)`): före
  registren tog hörnen ensamma 1,4 s, nu tar varje steg några hundradels sekunder


## Småsaker (0.8.18, format 11)

- **Rutnätet** (`src/view2d/grid.ts`): `buildGrid` ger en lista med nivåer
  (`levels`, finast först), var och en med linjerna som inte redan ritas av
  nästa grövre nivå och en opacitet ur `strength(px)`: nivån tonas in
  mellan 4 och 16 px mellan linjerna och blir starkare när det ryms finare
  linjer emellan (avståndet / 4). Planvyn har en `path.grid-level` per
  nivå. `minorStepFor` (statusraden) är den finaste nivån som är minst
  halvvägs inne. Färgen är `--grid-major`; `--grid-minor` används inte
  längre
- **Segmentpunkter** (`src/ui/app/segmentPoints.ts`): punkterna per vy
  (`plan:<våning>`, `vy:<markör>`, `blad:<arbetsblad>`), i minnet, inte i
  projektet. De ritas av `PlanView.decorator` (i `chrome`-lagret) och läggs
  först i `host.snapSegments()` som sträckor med `point: 'division'`
  (snäpptypen *Segmentpunkt*). Den sammanslagna listan sparas så länge
  listorna är desamma, så att snäppningens rutnät (en `WeakMap` på listan)
  behålls. `dividePath` i `measureTool.ts` räknar punkterna längs hela
  mätningen. Rensa: `app.toolOpts.clearSegmentPoints()`
- **osifont**: `scripts/osifont.py` gör delmängden med WinAnsi-tecknen ur
  osifont.ttf: `src/fonts/osifont.woff2` (skärmen, `--font-drawing`),
  `src/formats/osifontWidths.ts` (bredder och mått) och
  `src/formats/osifontData.ts` (TrueType som base64, laddas med `import()`
  först när en PDF har text). `drawingFont.ts` har `textWidth`,
  `drawingText` (byter tecken som saknas) och `drawingBytes`. PDF:en bäddar
  in typsnittet som `/Subtype /TrueType` med `/FontFile2` och
  `/WinAnsiEncoding`, en gång per fil och bara om någon sida har text. Fet
  text är `2 Tr` (fyll och streck) med strecket 0,045 × texthöjden.
  `helvetica.ts` finns kvar för `winAnsi` och för DXF-importen, som mäter
  texter i filens typsnitt (Arial)
- **Om-rutan**: `src/ui/app/aboutDialog.ts`
- **Autospara till fil**: `autosaveProjectFile` i
  `src/storage/projectFile.ts` skriver till filhandtaget från Spara
  som/Öppna, bara när texten skiljer sig från den som senast skrevs eller
  lästes. `files.ts` väntar 2 s efter senaste ändringen (direkt när fliken
  göms). Inställningen är `autosaveFile` i `UiSettings`. Handtaget sparas
  inte mellan sidladdningar
- **Dra och släpp i trädet** (`src/ui/app/treeDrag.ts`): `Navigator.onRender`
  gör raderna `draggable`; raden ger sitt id ur knappens `data-*-pick` (eller
  `data-view-apply`). Ett släpp på något inuti en `.folder` går till den
  mappen, annars utanför alla. `moveIntoFolder` i `treeCommands.ts` flyttar
  saker och mappar i en transaktion och hoppar över en mapp som skulle
  hamna i sig själv eller en undermapp

## Flera våningsplan (0.9, format 14)

- **Format 14**: väggens `height` kan saknas och följer då våningshöjden.
  Det sköts av `storeyParams` på elementtypen (`registry.ts`): förval
  som läses ur elementets våning i `resolveParams`, efter typens
  `defaults` och före definitionens och elementets egna parametrar.
  Cachen i `resolveParams` jämför också våningen (våningslistan byts ut
  när en våning ändras, så objektet är nytt). Kryssrutan *Våningshöjd* tar
  bort eller sätter `height` (`wall:storeyHeight` i `selectionEdits.ts`).
- **`everyStorey`** på elementtypen (fasad, sektion, norrpil): hör till
  projektet. `createContext` tar med dem i alla planer; deras `storey`
  används inte (sätts till grannvåningen när deras våning tas bort).
  `modelBounds(doc, storey?)` räknar med alla våningar när ingen anges,
  så automatiska fasadmarkörer omsluter hela huset.
- **Våningarna** i `src/core/storeys.ts`: `addStorey` (golvnivån från
  grannen, de ovanför eller under flyttas), `storeyPatch` (en ändrad
  våningshöjd flyttar de ovanför; används av `saveStorey`),
  `deleteStorey` (objekt, vyer, vyer på blad och trädets plats; det som
  hör till projektet eller är ritat i en fasad, sektion eller på ett blad
  flyttas till grannen), `toStorey` (flytta eller kopiera; kopian går
  genom `copyPayload`/`pasteClip` med `keepStates`) och `tracedStorey`
  (`trace` = `våning:under` eller `våning:över`).
- **3D, fasader och sektioner**: `modelShapes` i
  `src/repr/storeyShapes.ts` bygger formerna våning för våning (egen
  `createContext`, så att väggar på olika våningar inte skarvas) och
  lyfter dem med `liftShape`, som flyttar `z0`/`z1`, urtagen (`cuts`)
  och de sneda planen (`top`/`bottom`); förut flyttades bara höjderna,
  vilket var felet med golvnivån. `buildModel3d(doc, view, only?)`
  har inte längre en våning som andra argument. `buildSection` räknar i
  verkliga höjder (`z0 = 0`) och har en nivåmarkör per våning; 3D-vyns
  klippning likaså.
- **Gränssnittet** i `src/ui/app/storeys.ts` (`app.storeys`): `create`,
  `step` (Page Up/Down i `keyboard.ts`), `remove` (med fråga),
  `moveTo`, `menuItems` (högerklick, `menus.ts`) och `chooseTarget`
  (smartshell). Kommandona heter `storey-*` i `commandRegistry.ts`.
  Knappen *Bara den här våningen* i `pane3d.ts` (`storeyOnly3d` i
  gränssnittsinställningarna); knapparna nere till höger i 3D ligger i
  `.pane3d-tools`.
- Tester: `tests/v09.test.ts`.

## Nivåer (0.9.2, format 15)

- **Nivåmarkörer** i `levelPrims` (`src/repr/sectionLevels.ts` sedan 0.9.3,
  anropas av `buildSection`): FG för varje våning, UK bjl för bjälklag som
  sektionen skär (`ownCuts` med material `slab`), Takfot och Nock. Texterna skjuts uppåt när två nivåer ligger
  närmare än en textrad, och strecket kortas till triangeln där en annan
  nivås text hamnat på det (`levelMark` med `textY` och `long`).
  Släcks med `hide: ['level']`.
- **Höjdmåttet**: `heightChain` ger under- och ovansidan av de skurna
  bjälklagen nerifrån; kedjan ritas med `dimensionPrims` (vinkel 90)
  bredvid byggnaden, origin `part: 'höjdmått'`. Bara i sektioner;
  `hide: ['heightDims']`.
- **Väggar under bjälklag**: sedan 0.10.1 kapar bjälklagen väggarna där
  de täcker dem, i väggens 3D (`underSlabs` i `src/elements/wall3d.ts`,
  se *Granskning (0.10.1)*); `trimUnderSlabs` med regeln om väggens mitt
  finns inte längre.
- Valen i Visa: `level` och `heightDims` under Markörer
  (`src/ui/app/showMenu.ts`). Tester i `tests/v092.test.ts`.

## Bjälklag (0.9.1, format 15)

- **Elementtypen** `Slab` i `src/elements/slab.ts`: `thickness` (typens),
  `outline`, `fromWalls` och `holes`. `slabBase(ctx, p)` ger konturen
  utan hål: den ritade, eller `insideWalls(walls)` (husets ytterkontur ur
  `bareWallUnion` minus ytterväggarnas ytor ur `bareWallShapes`; en vägg
  är yttervägg när provpunkter på var sida hamnar inne och ute, som i
  `outsideSide`). `slabRings` drar ifrån hålen, `slabsOn(ctx)` slår ihop
  våningens bjälklag (rummens golvskiva i `space.ts` dras ifrån dem).
  `slabAt(doc, storey, state, pt)` hittar bjälklaget för en håltagning
  utan en ritad vy. `planReads: ['Wall']`.
- **3D**: materialet `slab` (`solids.ts`, färgen i `view3d.ts`, fylls i
  sektionen via `POCHE` i `section.ts` och snittets lock i `pane3d.ts`).
  Formen går från `−thickness` till 0 och lyfts till golvnivån av
  `modelShapes` som allt annat.
- **Konturen i Modifiera**: sedan 0.10.24 som en 2D-form (`shapeOf` och
  `hasOutlineShape` i `shapeEdit.ts`); den gamla vägen
  (`hasEditableOutline`, `roof*`, `roofId`) är borta. `transformed` och
  `movePatch` flyttar `holes`.
- **Verktyget** `SlabTool` i `src/ui/tools/slabTool.ts` (`mode`
  `slab`/`hole`), *Ur väggarna* i `slabFromWalls` (`tools.ts`),
  verktygsraden i `toolOptions.ts`, smartshell i `prompts.ts` och
  `shellPoints.ts`. Egenskaperna: `case 'Slab'` i `selectionFields.ts`,
  `slab:fromWalls` i `selectionEdits.ts`, `slab-hole-remove` i
  `propertiesPanel.ts`.
- Tester: `tests/v091.test.ts`. Referensritningarna ändrades av plattan i
  exempelvillan.

## Texturer och ortofoto (0.10.31, format 24)

- **Ortofotot** är `site.ortho` (`SiteOrtho` i `core/site.ts`): bildens
  fil (`asset`), västra och norra kanten i zonens koordinater (`x0`, `y1`,
  inte pixelns mitt), pixelstorleken `s`, `W` × `H` pixlar, `year` och
  `show` (`base` utan fält, `all`, `off`). Allt om det i
  `core/siteOrtho.ts`: `parseWorldFile`, `orthoFromWorld` (zonens
  koordinater, annars lokala från nollpunkten), `orthoFromPackage`
  (platspaketets `ortofoto`: `bild` som data-URL och pixelns mitt, som en
  världsfil och som Höjdkurvors `senaste.ortofoto`), `putOrtho`,
  `setSiteOrtho` och `orthoUvMatrix`. `putSite` behåller det gamla när
  paketet saknar ortofoto och platsen ligger kvar; `removeSite` tar bort
  bilden.
- **Texturen** är `material.texture` = `{ asset, size }` (bildens sida i
  mm). `setMaterialTexture` byter eller tar bort bilden i en transaktion
  och tar bort den gamla filen om inget material använder den;
  `deleteMaterial` likaså. `pruneAssets` räknar materialens texturer och
  ortofotot som använda.
- **3D-vyn**: `view3d.assetUrl` (satt i `pane3d.ts`) ger en fil som
  data-URL; `image()` laddar varje fil en gång och delar bilden mellan
  materialen (`clone` delar källan). Marknätet får UV = planens x och y i
  mm; en textur har `repeat` 1/size, ortofotot en egen `matrix`
  (`matrixAutoUpdate = false`). `setTerrain` tar ortofotot som fjärde
  argument. Kroppar med `texture` får UV med `boxUv` (`geometry3d.ts`).
  Grupperna i `colorGroups` har `color` (eller null) och `texture`;
  `lookKey` skiljer dem åt.
- Bilderna läses i `ui/app/imageFile.ts` (`imageAsset` skalar ned med en
  canvas; `pickTexture`, `chooseTexture`). Ortofotot väljs i
  `chooseOrtho` i `ui/app/site.ts`.

## Teckenförklaring (0.10.30, format 24)

- **`Legend`** (`src/elements/legend.ts`) ligger på bladet (`space` =
  bladets id) som `ScaleBar`, i mm på papperet, och flyttas med `pos`
  (`moveOnly` i `core/sheets.ts`; kopieras med bladet och följer kopians
  vy). `addLegend` lägger den. Raderna räknas av `legendRows(p, sources,
  style)`; rutan ritas med `fillPrims` i vyns skala (`scale` = vyns
  nämnare, och mönstret förankras i rutans hörn genom att hörnet ges
  gånger skalan).
- **Det som syns** kommer från `legendSources` i `repr/sheet.ts`: id:n
  bakom vyernas ritade primitiver (`origin.objectId`), deras `material`
  eller egna fyllning (`FILL_FIELDS`). `buildSheet` lägger dem i
  `ViewStates.legend` (typen `LegendSource` i `core/states.ts`) bara när
  bladet har en teckenförklaring; nyckeln i planens cache tar med dem.
- **Egenskaperna** i `annotationFields.ts`, ändringarna i
  `applyLegendField` (`selectionEdits.ts`, nycklarna `legend:*`).
- **Kalkera en våning**: `TRACE_STOREY` (`core/storeys.ts`) + id;
  `traceStoreyOptions(trace, onSite, doc, current)` listar varje våning.
  `traceItem` i `storeys.ts` och `newViewOf` och `setTrace` i `views.ts`.
- **Webbläsarens meny** stoppas av en lyssnare på `document` i
  `installMenus`; den går sist, så programmets egna lyssnare öppnar sina
  menyer som förut.

## Ritandet (0.10.29, format 24)

- **Shift-låset** ligger i `snap()` (`src/ui/tools/snap.ts`): `ortho` i
  `SnapInput` betyder nu "lås det man står i". Första anropet med `ortho`
  från en punkt `from` tar riktningen ur en snäppning utan `ortho`
  (`heldDirection`) och sparar den i `held`; den gäller så länge `from` är
  densamma. Ett anrop utan `ortho` och `forgetInferred` glömmer den.
  `along` vänder riktningen när markören är bakom `from`. Verktygen skickar
  `ortho: p.shift` som förut och behöver inget eget.
- **Värdet vid objektet**: `OpDef.atObject` (`opDefs.ts`) tar bort
  värdefältet ur `detailMarkup`. `installKeyboard` skickar tangenterna till
  `Modifier.typeKey` före smartshell; `ModifyTool.typeKey` skriver i
  `typing` (siffror, ett komma, minus först, Backsteg, Esc), `typed` är
  talet. `ModifyState` har `typed` och `typing`, och förhandsvisningarna i
  `wallOps.ts` och `outlineOps.ts` ritar `offsetDimension`
  (`tools/overlay.ts`). Enter utför med `applyValue`; ett klick tar
  `typed` i `commit` när valet har `atObject`.
- **Kanter**: fältet `data-modify-edges` är ett textfält (`parseEdges`).
  `edgeRun(s, i, count, toward)` lägger den extra kanten för ett jämnt
  antal mot `toward`; `shapeOffsetPatch` räknar `toward` ur markören
  (`towardEnd`).
- **Våningslistan**: `storeyLevels(mm, datum?)` i `navigator.ts`.

## Granskning efter 0.10.28.2 (0.10.28.3, format 24)

Inga nya funktioner; det som ändrades i koden:

- **Rampens höjder** (`ui/tools/groundTool.ts`): `groundHeight` läser
  `finishedTerrain` i ett sammanhang för verktygets våning och tillstånd
  (`createContext`), annars `terrainOf`. Gäller ramper, gångvägar,
  brytlinjer, höjdpunkter och markytornas förslag
- **`wallProfile` och `wallCrest`** ligger i `elements/wallProfile.ts`
  (ur `groundGeometry.ts`), eftersom de läser `crispHeight` ur
  `repr/crispGround.ts`, som i sin tur läser `groundGeometry`. Profilen
  räknas mot de skarpa kanterna, så att en punkt inne på en ramp får
  rampens höjd. I `computeProfile` (`groundWall.ts`) krymper
  utjämningens fönster symmetriskt nära ändarna (`win`)
- **Stödmuren som skarp form** (`crispGround.ts`): `crispShapes` ger en
  `Crisp` per stödmur med `ring` = remsan kring mittlinjen
  (`stripRing`), `wall` falskt för alla kanter (inga lodytor; muren själv
  är kroppen), `top` = `groundBeside` och `below` = rutnätet.
  `groundBeside(t, line, x, y)` tolkar rutan som `heightAtZone` men bara
  med noderna på samma sida om linjen som punkten (`along(...).lat`): fyra
  noder bilinjärt, tre som planet genom dem, annars viktat med inversa
  kvadratavståndet; null utan nod på samma sida. Därmed delas 3D-nätet
  längs murens båda kanter och marklinjen i sektionen får ett steg vid
  muren
- **`view3d/navigation.ts`**: `setupNavigation(controls, canvas,
  frameAll)` med mellanslag, Shift mitt i draget och dubbelklick med
  mittenknappen; `View3D.nav.spaceDown()` för `Edit3D`
- Tester: `tests/v010283.test.ts`. Referensritningarna för markprojektet
  (`mark-plan`, `mark-fasad-2`, `mark-3d`, `mark-siffror`): stödmurens
  krön och fot

## Material på bjälklag och tak (0.10.28.2, format 24)

- **Materialet** (`graphics.ts`) har de valfria fälten `cut` och `surface`
  (fyllningar som `plan`) och `pen` (`{ weight, color? }`);
  `normalizeMaterials` läser dem. `DEFAULT_MATERIALS`: Betong och Tegel
  med `cut`, Aluminium grått, nya Takpannor och Plåt med `surface`
  (`lines(vinkel, avstånd, färg)`, skraffering i verkliga mått).
- **`fill2d.ts`**: `materialCutFill(m, action)` (undefined utan `cut` eller
  när objektet rivs), `materialSurfaceFill(m)` och `materialCutPrims(rings,
  cut, origin, style, scale, under)`: en region med papperet och konturen
  0,35 (`ownFill`), och mönstret ovanpå. `fillPrims` tar en egen
  utgångspunkt för mönstret (`anchorAt`).
- **`elements/buildingMaterial.ts`**: `buildingMaterialOf`, `materialPen(m,
  pen)` och `materialSolid(m)` (`color`, `matId`). `SlabParams` och
  `RoofParams` ärver `Partial<FillParams>`; fyllningen och materialet
  ligger i parametrarna som i rummen, så `linkMaterial`, `updateMaterial`
  och panelen fungerar som förut.
- **Planen**: `slabType.plan` fyller `slabRings` under snittet
  (`fillPrims`, `noPick`), snittet med materialets snitt, konturen med
  `materialPen`. `roofPlanPrims` fyller delen helt under snittet
  (`halfPlaneBelow(rp.top, h)`, hela taket på Platsen), snittytan med
  materialets snitt.
- **3D**: `Solid.matId` (stilmallens material) och `color` på bjälklag och tak.
- **Sektionen** (`section.ts`): snitten grupperas per material
  (`m:<id>` i nyckeln) och ritas med `materialCutPrims`; med egna pennor
  utan kontur på papperet.
- **Fasaden** (`repr/sectionSurfaces.ts`): `sectionLines` tar `surfaced(s)`
  och svarar med `occluders` och `faces` (formernas klippta trianglar).
  `visibleFaces(tris, occluders)` grupperar trianglarna per plan, slår ihop
  dem och drar av alla trianglar framför planet (`clipPlane` mot ytans
  djup minus 1,5 mm). Punkterna avrundas till 0,1 mm, och går klippningen
  inte ihop slås bitarna ihop och dras av en i taget (`safeUnion`,
  `without`). `surfacePrims` ritar ytorna först, under linjerna, `noPick`.
  Släckt med `fill` under Visa.
- **Panelen**: `ui/materialBuilding.ts` (`buildingFields`, `buildingChange`,
  `BUILDING_KEYS`: `matCut`, `matCutColor`, `matSurface`,
  `matSurfaceColor`, `matPen`, `matPenColor`). I `fillPanel` under
  materialet när det har *Byggnad*; `fillChange` skickar nycklarna till
  `updateMaterial`. Bjälklagets och takets panel (`buildingFill` i
  `selectionFields.ts`) med `use: 'building'` och nycklarna `d2:…`.
  Materiallistan har samma fält (`data-material="<id>:matCut"` …) och
  `materialFieldChange` tar dem.
- Tester: `tests/v010282.test.ts`. Provat i Playwright mot `dist/`
  (panelen, planen, fasaden, sektionen, Platsen, 3D).

## Materiallistan (0.10.28.1, format 24)

- **Materialet** har `ground` och `building` (booleska, `MaterialUse`,
  `MATERIAL_USES`) i stället för `category`. `normalizeMaterials` läser
  dem (allt annat än `true` är falskt). `DEFAULT_MATERIALS` byggs med
  `mat(id, namn, 'g' | 'b' | 'gb', plan, illFärg, illOpacitet, 3D)`;
  fyllningstyperna `gatsten`, `stenmur`, `trall` och `singel` är nya i
  `FILL_TYPES`.
- **Vilka material som passar** (`materials.ts`): `useOf(el)` ger
  `'ground'` för markobjekten, `'building'` för `Slab` och `Roof` (används
  i 0.10.28.2) och `undefined` för resten (alla passar);
  `materialFits(m, use)`. Panelens `FillPanelContext.use` ersätter
  `category`. `saveMaterial` kryssar i det som passar objektet.
  `addMaterial(store)` och `moveMaterial(store, id, ±1)` för listan.
- **Listan i dialogen**: `src/ui/style/materials.ts` (`materialSection`,
  `materialFieldChange`). Fälten har `data-material="<id>:<fält>"`
  (`name`, `ground`, `building`, `plan`, `ill`, `c3d`), knapparna
  `material-add`, `material-up`, `material-down`, `material-remove` med
  `data-material-id`. `StyleDialog.onChange` skickar materialets fält
  till `updateMaterial`, så att objektens kopior av planens fyllning följer
  med; `material-remove` går till `deleteMaterial`. Stilen i
  `stilmallen.css` (`.material-row`).
- **Stödmuren på Platsen** (`linePlan` i `groundPlan.ts`): utan snitthöjd
  ritas den ovanifrån, `fillPrims(…, under = true)` med materialets
  fyllning och konturen `planCutPen(style, 'Ground', 'below')`.
- **Marken i 3D på Platsen** (`update3d` i `pane3d.ts`): på Platsen tas
  `Terrain` bort ur vyns `hide` för marken, markobjekten och deras linjer
  i 3D (`ground`); höjdkurvorna i 3D släcks ändå när `Terrain` är släckt.
- **Shift mitt i ett drag** (`view3d.ts`): `keydown`/`keyup` för Shift
  anropar OrbitControls interna `_handleMouseDownRotate` eller
  `_handleMouseDownPan` med pekarens senaste läge och sätter `state` (0
  snurra, 2 panorera). Bygger på three 0.170:s interna namn; byts three
  ska det provas.
- Tester: `tests/v010281.test.ts`. Provat i Playwright mot `dist/`
  (listan, Nytt material, Platsens situations- och illustrationsplan,
  illustrationsplanen i 3D, Shift under ett mittendrag).

## Material, mark först (0.10.28, format 23)

- **Materialet** (`Material` i `graphics.ts`): `id`, `name`, `category`
  (`'ground'` eller `'other'`; kryssrutorna `ground` och `building` sedan 0.10.28.1), `plan`
  (fyllningens fält som i `FillParams`), `illustration` (`{ color,
  opacity }`, utelämnad = som planen) och `color3d`. `StyleSheet.materials`
  ersätter `fills` (`SavedFill` borta); `normalizeMaterials` läser dem,
  `DEFAULT_MATERIALS` är ett nytt projekts (och exempelprojektets).
  `withProjectParts(preset, g)` ger en förinställd stilmall med projektets
  texter, linje- och fyllningstyper och material (vyernas stilmall, bladen
  och valet i stilmallens dialog).
- **Objektet** (`FillParams`): `material` ersätter `fillStyle`;
  `materialOpacity` och `materialAngle` överstyr opaciteten och vrider
  mönstret (grader utöver materialets: `fillTypeAngle` för egna typer,
  `fillAngle` för skraffering och kors). Som förut har objektet en kopia
  av planens fyllning, så att `p.fill` är satt där rum och markobjekt
  frågar och det ser likadant ut när materialet tas bort.
- **Vykategorin** (`ViewStates.category`, satt för vyer av Platsen i
  `viewStatesOf`, `viewStates` och `viewStatesFor`) går till
  `effectiveFill(p, style, category)` och `fillPrims(…, category)`:
  `materialFill(m, category)` ger illustrationsplanens färg som en hel
  fyllning, annars planens.
- **`src/core/materials.ts`** (förut `savedFills.ts`): `saveMaterial`
  (samma namn skriver över planens fyllning), `linkMaterial` (eller *Eget*:
  det som syntes i planen blir objektets eget), `updateMaterial(store, id,
  label, fn)` (materialet och kopiorna i alla objekt med det, i en
  transaktion), `deleteMaterial`, `overrideMaterial` och `materialUses`.
  Slänternas material ligger i `slopeFill`, som förut.
- **Panelen** (`fillPanel.ts`): `fillPanel(name, raw, attrs, style,
  title, { category, uses })` tar objektets egna parametrar; med ett
  material visas och ändras materialets plan (`fillChange` i
  `shapeFields.ts` skickar ändringen till `updateMaterial`), och
  `materialParts` har illustrationsplanen (`matIllKind`, `matIllColor`,
  `matIllOpacity`), kulören i 3D (`matColor3d`) och objektets
  `materialOpacity` och `materialAngle`. Knapparna `fill-save`,
  `material-rename` och `fill-unsave` i `drawingPanel.ts`. Förslagen Gräs,
  Grus, Hårdgjort och Vatten är borta ur `FILL_PRESETS` (de är material).
- **3D**: `repr/groundColors.ts` (`colorShapes`, `colorGroups`) sorterar
  marknätets trianglar per kulör efter triangelns mitt (markytor och
  ramper ovanpå sina slänter, i ritordning); `View3D.setTerrain` tar
  grupperna och gör en `THREE`-grupp per kulör. `Solid.color` ger en egen
  kulör (stödmuren), `colorMaterial(color)` i `view3d.ts`.
- **Stödmuren** i planen: med en fyllning (materialets) ritas det snittade
  med `fillPrims` och konturen 0,35, annars svart som förut.
- Tester: `tests/v01028.test.ts`. Provat i Playwright mot `dist/`
  (materialet i panelen, planen, en illustrationsplan, 3D).

## Styrningen i 3D (0.10.27, format 22)

- **Knapparna** (`view3d.ts`): `controls.mouseButtons = { LEFT: null,
  MIDDLE: PAN, RIGHT: null }`; OrbitControls byter själv PAN mot ROTATE
  med Shift, Ctrl eller Meta. Mellanslaget (`spaceDown`) sätter `LEFT`
  till PAN medan det hålls ned (och nollställs vid `blur`), och
  `Edit3D.onDown` lämnar då draget till kamerastyrningen
  (`EditView.panning()`). Dubbelklick med mittenknappen kör `frameAll`.
  Högerdraget panorerar inte, så `menus.ts` öppnar menyn vid varje
  `contextmenu` i 3D
- **Markeringsrutan** (`edit3d.ts`): ett vänsterdrag med mus eller penna
  som inte börjar i ett grepp eller på det markerade blir `box`; efter
  5 px ritas `.sel-box3d` (streckad åt vänster, `vyer.css`), och när
  knappen släpps anropas `EditView.pickBox(rect, 'window' | 'crossing',
  additive)`. Ett klick utan drag går till `pick` som förut. Bara
  vänsterknappen sätter `down`, så ett mitten- eller högerklick markerar
  inget
- **Vad rutan tar** (`View3D.idsInRect`): hörnen i varje kropps geometri
  (`matrixWorld`) räknas till fönstrets pixlar och samlas i en rektangel
  per id; hörn som en sektion klipper bort (`shown`) hoppas över, och ett
  hörn bakom kameran gör att objektet inte ryms helt. Markobjekten med
  sina konturer (`Ground3DHost.ids()` och `outline(id)` i `ground3d.ts`).
  Rummens golv (`floor`) tas inte. Sedan samma jämförelse som
  `pickInRect` i planen. `onBoxPick(ids, additive)` i `pane3d.ts` sätter
  eller lägger till markeringen
- Tester: `tests/v01011.test.ts` (markobjektens `ids`). Resten provat i
  Playwright mot `dist/` (rutor åt båda hållen, Shift-ruta, mitten, Shift
  + mitten, Mellanslag, Mellanslag + Shift, högerdrag, dubbelklick,
  menyn); musen behöver WebGL och provas inte i vitest

## Rampen och stödmuren (0.10.26, format 22)

Inget nytt format: `leftSlope` och `rightSlope` i `GroundParams` och
`RampParams` är frivilliga.

- **Slänt per sida**: `rampRing` ger också `side` per kant ('left',
  'right', 'end'), `sideSlope(p, side, slope)` sidans slänt. `rampShape`
  sätter formens `slope` till den flackaste öppna kanten (den räknar hur
  långt slänten når) och `probe` svarar med kantens egen `slope`;
  `finishedGround` tar `min(sh.slope, p.slope)` i bandet. Slänternas
  markeringar (`slopeReach` i `groundSlopes.ts`) frågar kanten. Fälten
  `leftSlope`/`rightSlope` i `groundFields.ts` (allmänna sifferfält i
  `groundFieldEdits.ts`). Vänd (`reversedRamp`), spegla (`rampSides` i
  `transforms.ts`) och dockningen (`RAMP_KEYS`, `settingsOf`) byter dem
- **Skarpa kanter** (`src/repr/crispGround.ts`): `crispShapes(ctx, f)`
  (ramper och markytor, inte runt huset och under bjälklag, som ändrar
  marken) med `ring`, `wall` per kant, `top(x, y)` (formens `probe`) och
  `below(x, y)`: marken utan objektet, den färdiga med objektets steg
  tillbakalagt (`Step.old` i `core/ground.ts`, höjderna före objektet;
  `belowOf` sparar terrängen per steg). `crispHeight(crisps, t)` ger
  höjden i en punkt: på ytan eller kanten `top`, inom två rutor utanför en
  stödmurskant `below`, annars rutnätet. `crispMesh(mesh, crisps)` skär
  3D-nätet: trianglar som en kontur går genom (kanterna i rutor om 2 m,
  `touches`) delas längs kanternas linjer när konturen går tvärs över
  triangeln (konvexa bitar, solfjäder), annars skärs de mot konturen med
  polygon-clipping (earcut); nya hörn på konturen får `top` innanför och
  `below` utanför en stödmurskant, hörn från rutnätet behåller sin höjd.
  Lodytan längs stödmurskanterna i bitar om 0,5 m, åt båda hållen, med
  egna hörn. Ca 30–60 ms för exemplets sex objekt (bara när marken ändras;
  `savedCrisp` i `terrain.ts`)
- **Var det används**: `terrainMesh3d(doc, view, finished)` i
  `repr/terrain.ts` (3D-vyn, `pane3d.ts`), `heightForView(doc, view)`
  (linjerna på marken i `ground3d.ts`, och `contourSegments3d` med
  `height`, som tar bort kurvbitar mer än 80 mm från den skarpa marken),
  och `groundLines` i sektioner och fasader (`terrainProfile` med `height`
  och `extra`: i sektionen en punkt 2 mm på var sida om varje kant,
  `crossings`). Planens höjdkurvor, slänterna och volymerna läser
  rutnätet som förut
- **Stödmurens hörn**: `wallSolids` lägger lodräta kantlinjer bara i
  ändarna och där mittlinjen viker mer än `CORNER` (20°, `turnAt`)
- Tester: `tests/v01026.test.ts`. Referensritningarna `mark-fasad-2`,
  `mark-fasad-4` och `mark-sektion-a` ändrades (platån med stödmur: språnget
  vid kanten)

## Granskning efter 0.10.25 (0.10.25.1, format 22)

Utan nya funktioner: det Platsen (0.10.25) glömde på några ställen,
dubbletter ihopslagna, och klicksteg för 0.10.23–0.10.25.

- **Platsen räknas inte som våning** i `filterSelect.ts` (*Alla
  våningar* bara med flera husvåningar), `pane3d.ts` (*Bara den här
  våningen* göms med en våning), `selectionEdits.ts` (låsta rums- och
  dörrnummer går igenom husets våningar) och `roomTool.ts` (hålen i
  cachen per våning, så att ett byte av våning med samma dokument inte ger
  förra våningens hål). `storeysUp` i `core/storeys.ts` är borta; använd
  `storeysUpFrom` i `core/model.ts`.
- **`parse`** känner igen Platsen på id:t också: en handskriven fil med
  ett annat id på den sista våningen med `site` får id `platsen`, och
  objekten flyttas dit.
- **Dubbletter**: skosnöresformeln fanns på ett tiotal ställen; nu bara
  `signedArea` i `geometry/chains.ts` (`ringArea` i `slab.ts` är samma
  funktion). `nearestEdge(kedja, punkt)` bor i `chains.ts` (var i
  `trace.ts` och `roofOver.ts`), `ccw(ring, kedja)` i `arcFit.ts` (var i
  `slabFrom.ts`; `roofTool.createFace` vänder konturen med den, så den
  vända behåller sitt första hörn). `areaOutline` i `groundGeometry.ts`
  är borta (= `slabOutline`). `offsetEdge` ligger i `geometry/offsetEdge.ts`;
  `core/roofEdit.ts` är borttagen (resten gick redan i 0.10.24).
  `draw2dTool.fillParams()` bygger fyllningens parametrar på ett ställe.
- **Snabbare**: `houseOnSite` prövar husets kontur bara mot taken vars
  ruta rör den (`boxesTouch`); `dimWall.nearWall` ger `wallChain` bara
  väggens öppningar och de väggar som når fram till den (samma räckvidd
  som kedjans eget test), i stället för alla på våningen.
- **`modelBounds`** räknar med bågarnas buktning (`outlineRing`) för tak
  och bjälklag, så *Zooma till allt* får med en utåtbuktande kant.
- Klickjämförelsen: se *Arbeta i sandlådan*; `norm_doc` jämför dokumenten
  utan Platsen mot äldre byggen, och *Båge* i verktyget Mark sätts (inte
  växlas), eftersom den ligger kvar från rampen i stegen för 0.10.19.

## Platsen som modellflik (0.10.25, format 22)

- **Platsen i våningslistan**: `Storey.site` (`true`), id `SITE_STOREY`
  (`'platsen'`), golvet vid ±0, sist i `doc.storeys`. `siteStorey()`,
  `isSite(id | våning)`, `buildingStoreys(doc)` (husets våningar),
  `storeysUpFrom` (`storeysUp` i `core/storeys.ts` togs bort i granskningen efter 0.10.25), `groundStorey`
  (våningen närmast ±0, utan Platsen) och `withSiteLast` ligger i
  `src/core/model.ts`. `emptyProject` och exemplet har den; `parse` lägger
  till den sist om den saknas (`withSiteLast`), så handskrivna filer får
  den. Kod som räknar med *husets* våningar använder `buildingStoreys` eller
  `storeysUp`; kod som slår upp en vy, en yta eller ett element på en
  våning behöver inget (Platsen är en våning där). `doc.storeys[0]` är
  alltid en av husets våningar, eftersom `addStorey` och `deleteStorey`
  håller Platsen sist och den inte går att ta bort.
- **Våningskommandona** (`core/storeys.ts`): `addStorey` bygger inte från
  Platsen och flyttar den inte; `storeyPatch` ändrar inte Platsen och
  flyttar den inte när en våningshöjd ändras; `deleteStorey` tar inte bort
  den och kräver två av husets våningar. `toStorey` flyttar inte typer med
  `onSite` (Terrain, SiteBuilding, Tree, SiteMap, Ground) till en våning.
  `TRACE_SITE` (`'våning:platsen'`) kalkerar Platsen under en våningsplan
  (`tracedStorey`, `traceStoreyOptions(trace, onSite)`).
- **Ritningen**: `cutHeightOf` är `Infinity` på Platsen, så `planCutHeight`
  ger allt som vy (väggar som sedda, taken ovanifrån utan snittyta);
  stödmuren i `groundPlan.ts` ritas snittad när snitthöjden inte är ändlig.
  `roofShownOn` visar alla tak på Platsen. `houseOnSite` i `roofPlan.ts`
  ritar husets kontur (`buildingFootprint`) med `clipToRings` (utanför
  taken heldragen, under dem streckad, utom när *Husets kontur genom
  taket* är tänd och taket ritar den själv); `buildPlan` lägger till den
  för Platsen när `house` inte är släckt (`HOUSE_KEY`). Konturen har
  `objectId` `husets-kontur` och `objectType` `House`, så snäppet läser
  den. `modelShapes` bygger Platsen som en våning vid ±0 (stödmurarna,
  grannhusen och träden i 3D och sektionerna); `sectionLevels` och
  rumsnumren räknar bara husets våningar.
- **Marken**: `applySitePackage` lägger platsens objekt på `SITE_STOREY`.
  Marken runt huset utgår från `groundStorey` när markobjektet ligger på
  Platsen (`aroundFloor` i `groundGeometry.ts`). `GroundTool` lägger
  markobjekt på Platsen och letar bjälklaget för en urgrävning nerifrån
  bland husets våningar; `changeTool` i `tools.ts` öppnar Platsen när Mark
  väljs på en våning.
- **Vyerna**: `ViewDef.category` (`SiteCategory`: `situation`, `grading`,
  `illustration`, namnen i `SITE_CATEGORIES`). Förinställningarna i
  `src/core/siteViews.ts` (`siteViewPreset`, `addSiteView`); fältet
  *Vykategori* i vyns inställningar (`treeItemPanel.ts`) och
  `currentViewDef` i `views.ts` behåller den öppna vyns kategori.
- **Gränssnittet**: rubriken *Platsen* i projektträdet (`navigator.ts`),
  Platsens meny `openSiteMenu` i `src/ui/app/storeys.ts` (Visa,
  Inställningar…, Egenskaper, Ny vy), Platsens egenskaper `siteMarkup` i
  `treeItemPanel.ts` (knapparna `data-action="site"` och
  `data-action="site-view"` med `data-category`, i `actions.ts`).
  Huvudmenyns *Platsen…* är borta; `window.bacchus.site` har
  `showDialog` (klickjämförelsen använder den).
- **Testerna**: `tests/v01025.test.ts`. `toolHost(store, selected, storey)`
  och `planOf(store, storey)` tar en våning; markens tester ritar och
  klickar på `'platsen'`, och referensritningen `mark-plan` är Platsens
  plan (taken, husets kontur, stödmuren snittad, utan väggarna).

## Bågar i bjälklagets och markytans kontur (0.10.24, format 21)

Inget nytt format: `bulges` på `SlabParams` och på `GroundParams` för
markytan (samma fält som linjens; en markyta har ingen `line`) är
frivilliga. Regeln är 2D-formens: pilhöjd per kant, kant i från punkt i
till i + 1, den sista tillbaka till den första, raka sist utelämnade.

- **Ytorna**: `slabOutline(p)` i `slab.ts` ger den ritade konturen med
  bågarna som korta raka bitar (tom när den inte sluter sig; två punkter
  med bågar räcker, som `holeRing`, som nu också tar cirkelhål av två
  punkter). `slabBase`, `slabAt` och `groundGeometry` (urgrävningen under
  bjälklaget, med `slabP.bulges` i cachens `inputs`) går via den;
  `areaOutline(p)` i `groundGeometry.ts` är samma sak för markytan.
  `outlineEdges(h, pen, origin, under)` ritar en konturs kanter som
  linjer och bågar som polylinjer, för konturen och hålen. Litterans
  fält *area* räknar konturen med bågarna (`label.ts`).
- **Modifiera**: `hasOutlineShape(el)` (takfall; bjälklag utan
  `fromWalls`; markyta med ritad kontur, inte `around` eller `slab`) och
  `outlineShape(el)` (hette `roofShape`) i `shapeEdit.ts`; `shapeOf`
  och `shapePatch` (skriver `outline` och `bulges`) tar dem. Den gamla
  vägen är borttagen: `hasEditableOutline`, `insertNode`, `moveNode`,
  `removeNode`, `setOutline` och `orientation` i `roofEdit.ts` (kvar:
  `offsetEdge`), valen `roofInsert`, `roofMove`, `roofRemove`,
  `roofOffset` och `ModifyContext.roofId`. Greppen i `highlight.ts` ritas
  för `Slab` och `Ground` med `hasOutlineShape`; `shapeNodeAt` tar
  underformerna (hålen) också när elementet har en egen form. `railFor`
  räknar hålen tillsammans med den egna formen. Spegling vänder
  `bulges` för alla element med `outline` (`transforms.ts`).
- **Verktygen**: `SlabTool.create(outline, bulges)` (`tidyBulges` med
  `n + 1`, så att den slutande kanten är med); `setArc` gäller alla
  polygoner. `GroundTool.options.shape` (`rect`/`polygon`), `polygon`,
  `canClose`, `finishArea` och `createArea(outline, bulges)`; `finish`
  sluter polygonen med en rak kant (Enter, Klar, dubbelklick, byte av
  verktyg), `click` sluter den på första hörnet. `data-ground-shape`,
  `ground-arc` och `ground-done` i `toolOptions.ts`; *Polygon* (P) i
  `prompts.ts`. `keyboard.ts` fick `groundTool.finish()` på Enter (som
  `commandLine.ts` hade).
- **Spöet**: `reversedChain(c)` i `arcFit.ts` vänder en kedja med
  bågarna (en sluten behåller sin första punkt); `ccw(ring, chain)` i
  `slabFrom.ts` (också för `groundArea`). *Ur väggarna* urbockat kör
  `fitArcs` på väggarnas kontur (`selectionEdits.ts`).
- Tester: `tests/v01024.test.ts`. `v071` (de borttagna funktionerna),
  `mark` och `v085` (vallistan) justerade.

## Granskning efter 0.10.22 (0.10.22.1, format 21)

Carl Augusts svar C om 0.10.22, tre småsaker som klickjämförelsen och
mätningen visade, och två filer delade. De som använder det flyttade
importerar de nya filerna.

| Fil | Innehåll |
| --- | --- |
| `src/ui/app/commandLine.ts` | Smartshells fält, kommandon, punkter och händelser (623 → 542 rader) |
| `src/ui/app/shellList.ts` | Ny: listan med kommandon — `createShellList` (`clear`, `openAll`, `update`, `render`, `close`, `step`, `fill`; `matches`, `picked`, `showAll`, `open`) |
| `src/ui/app/shellMenus.ts` | Ny: `createShellMenus` — `recentItems`, `promptItems`, `shellMenu`, med `ShellMenuContext` |
| `src/view2d/planView.ts` | Lagren, kameran, ritningen och rutnätet (591 → 403 rader); `events`, `local`, `pointer` och `changed` är nu publika för pekaren |
| `src/view2d/planInput.ts` | Ny: `bindPlanInput(view)` — mus, penna, fingrar, mittenknappen, mellanslag + dra, nypning och hjulet; svarar med `updateCursor` |
| `src/view2d/zoomHistory.ts` | Ny: `ZoomHistory` (`note`, `previous`) — förra zoomen (0.7.1) |

- **Höjdkurvorna i planen (svar C)**: `SnapSegment.wandOnly` (`snap.ts`)
  säger att sträckan bara är för smartspöt. `drawnSegments` sätter den på
  `CURVE_PARTS`; `snap` filtrerar bort dem efter `nearSegments`, och
  `segAt` i `markerTools.ts` och `arrangeTool.ts` hoppar över dem. Spöets
  `trace.ts` och `shapeAround.ts` använder listan som förut, så en
  stödmur längs en höjdkurva går fortfarande.
- **Marklinjen i sektionen och fasaden**: `sectionSnapSegments` lägger
  polylinjerna med `part` i `GROUND_PARTS` (*färdig mark*, *befintlig
  mark*) som kurvbitar med id `mark` och texten *På marken*, och den
  platta linjen utan terräng (*mark*) får samma text.
- **Tab efter ett klick**: `WandTool.cycle` räknar om förslagen med den
  senaste pekaren (`last`) när `hits` tömts av `up`, så att Tab fungerar
  utan att musen flyttats.
- **Litterans grepp**: `tagGripAt` ger knäcken ett tillägg på `tol / 4`
  (texten har `tol / 2`), så att punkten vinner när de ligger på varandra.
- **`faceAround`**: skärningarna söks med en `BoxIndex` vars ruta är
  sträckornas medianlängd (100–5000 mm) i stället för alla mot alla:
  1040 höjdkurvebitar 81 → 17 ms, 3000 korta linjer 67 → 30 ms.
- **Mätt på en stor plats** (600 × 400 m, 0,5 m, 1,2 miljoner noder,
  skript utan webbläsare): `drawnSegments` ger 105 000 kurvbitar på
  10–40 ms och `nearSegments` bygger sitt rutnät på 40 ms första gången
  (sedan under 0,1 ms per fråga); allt sparas per plan.
- Tester: `tests/v010221.test.ts` (höjdkurvorna bara för spöet, marklinjen
  i sektionen). Klickjämförelsen: 43 nya steg sist.

## Smartspöt del 2 (0.10.23, format 21)

- **Bågar ur kedjor**: `fitArcs` i `src/geometry/arcFit.ts` ger punkter
  och en pilhöjd per kant (`ArcChain`), som 2D-formens `bulges`. Bågarna
  hittas efter `simplify` och anropas bara i `apply` (inte vid hovring),
  eftersom de längsta bågarna prövas från början av kedjan. `hasBulges`
  säger om någon kant blev en båge. Verktygens metoder tar bågarna:
  `WallTool.createAlong(points, closed, bulges)` (väggens `bulge`),
  `Draw2DTool.createPolyline(pts, closed, bulges)` (fyllningen bara när
  formen är sluten), `GroundTool.createLine(line, { bulges })`,
  `RoofTool.createFace({ points, bulges }, ref)` och `SlabTool.addHole`.
- **Ytorna**: `ringsAt(ctx, opts)` i `src/ui/wand/rings.ts` (utbrutet ur
  `shapeAround`) ger de slutna ytorna runt markören, medurs och den minsta
  först, med `kind` (`region`, `outline`, `face`), `id`, `what` och `area`;
  `skip` hoppar över objekt. Höjdkurvorna (`wandOnly`) stänger inga ytor.
  `houseAt(ctx)` ger husets kontur (`buildingFootprint`) där markören står,
  sparad per projekt och tillstånd. `offsetRing` i `chains.ts` förskjuter
  en sluten kontur (medurs är vänster utåt).
- **Funktionerna**: `slabFrom` (Bjälklag; `RoomTool.holeAt` är publik),
  `roofOver` (Tak), `groundArea` (Mark med *Markyta*;
  `GroundTool.createArea`), `lineAlong` (2D, före `shapeAround` i
  registret), `labelOn` (Littera; `LabelTool.createFor`) och `dimWall`
  (Mått; `wallChain` räknar kedjan, `DimensionTool.create`). Ordningen i
  `src/ui/wand/index.ts` avgör vilket förslag som kommer först när flera
  funktioner svarar för samma verktyg.
- Tester: `tests/v01023.test.ts` (med en egen `fakeApp` som har alla
  verktygen).

## Snäpp och smartspöt (0.10.22, format 21)

- **Snäppet läser allt som ritas.** `snapSegments` (`src/ui/app/snapping.ts`)
  har som förut väggarnas referenslinjer (nu med `ref: true`), väggarnas och
  möblernas liv, underlagen och 2D-formerna, och dessutom `drawnSegments`:
  linjer, polylinjer, ytornas kanter och bågar ur planens primitiver för
  alla andra typer, med objektets id. En ny objekttyp snäpps alltså mot
  utan att något läggs till. Undantag: texter och bilder, typerna i
  `NO_SNAP_TYPES` (text, littera, stämplar, skalstock, norrpil) och
  delarna i `NO_SNAP_PARTS` (släntstreck, fallpilar, lutningar, littera,
  fyllningar …): en ny beteckning som inte ska snäppas får sin `part` där.
  Höjdkurvorna (`CURVE_PARTS`) är `noPick` men snäpps på som kurvor, utan
  ändpunkter och mittpunkter. `on` ger texten vid markören per typ eller
  del (*På fastighetsgränsen*, *På höjdkurvan* …).
- **Kedjor och ytor** (`src/geometry/chains.ts`): `chainThrough` följer
  sträckor ände mot ände (inom 0,5 mm) så länge vägen är entydig;
  `simplify` tar bort raka mellanpunkter; `sideOf` ger delen mellan två
  hörn som viker mer än 35°; `faceAround` delar linjerna i skärningarna
  och går runt den minsta ytan till vänster från kanten närmast till höger
  om punkten (högst 1500 sträckor, de närmaste).
- **Smartspöt** (`src/ui/wand/`): `wand.ts` har registret (`WandAction`
  med `tools`, `find(ctx)` som ger förslag, `WandHit` med `label`, `what`,
  `preview` och `apply(more)`). `WandTool` ligger i vyn i stället för
  verktyget när spöet är på (`installWand` i `src/ui/app/wand.ts`): hover
  frågar alla funktioner för `ui.tool`, Tab växlar (`cycle`), klick utför,
  Shift samlar (Enter eller klick utan Shift utför). Byte av verktyg slår
  av spöet (`dropped` i `changeTool`). `trace.ts` hittar kanten närmast
  markören bland snäppets sträckor (inte referenslinjer och punkter),
  kedjan genom den (sparad per kant och lista) och sidan, och vänder dem så
  att insidan ligger till höger (medurs) när den är känd: en sluten kedja
  efter arean, en öppen genom att pröva objektets yta (`pickables`) 2 mm åt
  sidorna.
- **En ny funktion**: en fil i `src/ui/wand/` som exporterar en
  `WandAction`, och en rad i `src/ui/wand/index.ts`. `find` ska vara snabb
  (den körs vid varje musrörelse) eller spara sitt svar; `apply` skapar med
  verktygets egna metoder, så att typ, penna och höjder blir verktygets:
  `WallTool.createAlong`, `GroundTool.createLine`, `Draw2DTool.createPolyline`.
  Funktionerna nu: `selectConnected` (Markera: `connected` prövar om en
  punkt i ett objekt ligger på en kant i ett annat, bara grannar i en
  `BoxIndex`), `wallAlong`, `groundAlong` (stödmuren med `refSide: 'right'`
  när insidan är känd, så att den hamnar utanför objektet) och
  `shapeAround` (ytor ur primitiverna, objektens konturer och
  `faceAround`, den minsta först; den slutna ytan sparas medan markören är
  kvar i den).
- **Litterans vridning**: `LabelParams.angle` utelämnad följer stilmallens
  `labels.leaders.Label.angle` (`labelAngle`), annars vågrätt;
  `setLabelAngle` sparar också 0, så att en vågrät littera inte vrids när
  förvalet ändras. Verktyget har `angle` (null = förvalet).

## Generell littera (0.10.20.2, format 21)

Formatet höjdes eftersom `tag.at` bytte betydelse: textens förskjutning
står nu i mm på papperet (`fromFrame(tag.at, frame, ctx.scale)`; greppet
delar med skalan i `tagPatch`). `tag.to` står kvar i modellen.

- **Objekttypen `Label`** (`src/elements/label.ts`): `pos` (textens mitt),
  `text`, `sort`, `height`, `angle`, `frame`, `targets`, `tag` (sida, ände,
  anslutning och stam, samma `TagParams` som de andra litterorna, så att
  `litteraSection` och `resetTags` fungerar), `slant`, `list` och `number`.
  `labelLines` fyller i fälten (`objectField`, sedan `litteraField` ur
  `littera.ts`); `labelNumbers` räknar löpnumren per sort i
  `doc.elements` ordning. `planReads` saknas, eftersom texten och
  punkterna läser andra objekt.
- **Punkterna** (`LabelTarget`): `at` i planen, och när punkten sitter i
  ett objekt `id` och `local`, objektets axlar ur `anchorOf` i
  `src/elements/anchor.ts` (väggar längs väggen, öppningar längs väggen
  från öppningens mitt, annars första punkten och riktningen mot den
  andra). `targetAt` gör en punkt, `targetPoint` läser den (`lost` när
  objektet är borta). En ny objekttyp utan någon av parametrarna
  `start`/`end`, `origin`, `line`, `outline`, `points`, `pos` eller
  `seed` ger fria punkter.
- **Ledaren** (`leaderOf`): `attach: 'underline'` ritar strecket under
  rutan och börjar stammen i dess ände (alltid åt sidan); `LeaderTarget.pen`
  ger en egen penna för den sneda delen och änden; `owner` säger vilken
  punkt varje primitiv hör till. Stilmallens `labels.leaders` har
  `attach` och sorten `Label`.
- **Greppen**: litterans primitiver har en `TagHandles` per punkt
  (`param: 'label'`, `index`); texten och knäcken hör till den första.
  Textens grepp sitter på `stubStart` (ansatsen) och ritas som en romb;
  `tagPatch` räknar förflyttningen från greppets läge. `labelPatch` i
  `tagGrips.ts` flyttar `pos`, sätter om en punkt med `objectAt` (det som
  ligger under punkten, inte litteror) och ändrar stammen.
- **Flytta, vrida, spegla**: `movePatch` flyttar `pos` och de fria
  punkterna; `moveEach` (Justera och Fördela) bara `pos`;
  `transformedParams` vrider `pos` och punkternas `at` men inte texten.
  `outlinePoints` i `arrangeTool.ts` tar bara litterans ruta.
- **Verktyget**: `src/ui/tools/labelTool.ts` (`LabelTool`, `addTo` för
  *Lägg till ledare*), `ToolId` `label`, tangenten K.
- **Panelen**: `src/ui/labelSection.ts` (`labelFields`, `applyLabelField`
  med nycklarna `label:…`, `dropLeader`); knapparna `label-add` och
  `label-drop` i `selectionActions.ts` (`onAddLeader` i panelen).
- **Visa**: `Label` under Littera släcker alla; `showGroupsFor(doc)` i
  `showKeys.ts` lägger till en rad per sort (`labelsort:<sort>` i vyns
  `hide`, med gemener).
- Tester: `tests/v010202.test.ts`. Referensritningen `mark-plan.txt`
  ändrades: stödmurens text är understruken.

## Litteran (0.10.20.1, format 20)

Inga nya format: `tag` (`TagParams` i `src/elements/leader.ts`) är en
frivillig parameter på väggar, dörrar, fönster, rum och stödmurar, och
stilmallen har `labels.leaders` (änden och stammens längd per sort,
`LeaderKind`: `Wall`, `Door`, `Window`, `Space`, `Ground`), kompletterad i
`normalizeLabels`.

- **Ledaren** (`leaderOf`): en `TextBox` (mitt, halv bredd och höjd, textens
  axlar `along` och `up`) och en eller flera `LeaderTarget`. Stammen börjar
  `gap` mm (papper) utanför rutans sida och är minst `stub` mm lång; varje
  punkt får en knäck på stammen och en sned del. Med `angle` räknas
  knäckarna ut så att de sneda delarna blir parallella (`k = a − l/tan`),
  och stammen slutar vid den yttersta. En punkt i stammens linje nås av
  stammen själv. `autoSide` väljer sidan; `leaderEnd` ritar ändarna;
  `snap15` är Shift.
- **Förskjutningarna** `tag.at` (texten) och `tag.to` (punkten) är mm i
  modellen från förvalet. Littera längs en vägg (`litteraTag` i
  `littera.ts`) räknar dem i textens axlar (`toFrame`, `fromFrame`), så att
  de följer väggen; rummets och stödmurens i planens axlar, och
  `transformed` i `transforms.ts` vrider och speglar dem som vektorer.
  Rummets text står kvar i `labelAt`. `tag.stub` är mm på papperet.
- **Greppen** läses ur ritningen: litterans primitiver har `origin.tag`
  (`TagHandles` i `primitives.ts`: textens läge, punkten, stammens början,
  ände och riktning, och vilken parameter texten skrivs till). `tagGrips.ts`
  samlar dem per objekt en gång per plan (en `WeakMap` på `plan.prims`,
  eftersom väggarnas littera ritas i väggarnas `planBatch` och inte hör till
  väggens klickbara form). `gripDragAt` i `selectDrags.ts` har sorten
  `tag`; `tagDragPoint` räknar läget (Shift, knäcken längs stammen),
  `tagPatch` ändringen. Rumsstämpelns gamla drag i `selectTool.ts`
  (`roomLabelAt`) är borta.
- **Panelen**: `src/ui/litteraSection.ts` (fälten `tag:side`, `tag:end`,
  `tag:stub` via `applyField`, knappen `tag-reset`), stilmallens rader i
  `src/ui/style/labels.ts` (`le:` och `ls:`).
- **Ny sort med ledare**: rita texten, räkna en `TextBox` och punkten, kalla
  `leaderOf` med stilmallens `labels.leaders[sort]` och objektets `tag`, och
  ge alla litterans primitiver samma `origin` med `tag`. Lägg sorten i
  `LeaderKind`, `DEFAULT_LABELS.leaders` och `leaderKindOf`.
- Tester: `tests/v010201.test.ts`. Referensritningarna ändrades: väggarnas
  streck går nu från texten till väggen (och 20 mm kortare), stödmurens
  text har strecket mellan raderna och en stam till knäcken.

## Granskning efter 0.10.21 (0.10.21.1, format 20)

Tre småfel ur Inkorgen och `groundRamp.ts` delad. De som använder det
flyttade importerar den nya filen (testerna också); `groundRamp.ts`
behåller typerna (`RampParams`, `RampLevel`, `RampRun`, `EasePoint`),
sidorna, konturen och varningarna.

| Fil | Innehåll |
| --- | --- |
| `src/elements/groundRamp.ts` | Rampens parametrar, sidor, kontur, varningar (618 → 257 rader) |
| `src/elements/rampProfile.ts` | Ny: höjdprofilen — `rampLevels`, `easeRadiusAt`, `rampRuns`, `heightAtS`, `rampProfile`, `EASE_RADIUS` |
| `src/elements/rampEdits.ts` | Ny: ändringar i referenslinjen — `remapLevels`, `remapEases`, `tidyLevels`, `tidyEases`, `extendRamp`, `reversedRamp`, `fusedRamp` |

- **Slänternas fyllning**: `linePlan` i `groundPlan.ts` ritar nu
  `p.slopeFill` över `slopeArea(ctx, g)` bakom vägens egen fyllning, som
  `areaPlan` gjort sedan 0.10.14 (primitivens `part` är *släntens
  fyllning*).
- **Släntstreckens avstånd**: `markSpacing` i `GroundDefaults`
  (`core/site.ts`, förval 5 mm på papperet) med fältet under Platsen
  (`ui/app/site.ts`). `slopeMarks` i `groundSlopes.ts` läser det ur
  `groundDefaults(ctx.doc.site)`; konturen (`slopeOutline`) och ytan
  (`slopeArea`) känner av slänten var `SENSE_SPACING` (1,25 mm) oberoende
  av det. `steepMarks`/`steepSlopePrims` i `terrainSlopes.ts` tar
  avståndet som parameter (med i nyckeln för de sparade strecken).
- **3D-kameran**: `setMode` i `pane3d.ts` kallar `frameAll` bara när
  `View3D` just skapats (`fresh`), inte vid varje växling till Båda eller
  3D.

## Lutande väggar (0.10.21, format 20)

Inga nya format: `WallParams.lean` är frivillig (grader från lodlinjen,
positiv åt vänster sett från start mot slut, samma i båda ändarna, högst
`MAX_LEAN` = 80). Foten ligger kvar på referenslinjen.

- **Lutningen** räknas som en förskjutning i sidled per mm höjd
  (`Shear`, mm/mm): `wallShear(p)` i `wallBodies.ts` ger normalen gånger
  tangens, null för lodräta väggar och bågväggar (de lutar inte;
  lutningen lämnas utan verkan). `shiftedParams(p, dz)` är väggen flyttad
  dit den står på höjden dz över foten.
- **3D-formatet** (`src/repr/solids.ts`): `Solid.shear`. Konturen och
  urtagen gäller vid z0; en punkt på höjden z ligger `shear · (z − z0)`
  förskjuten. De sneda planen (`top`, `bottom`) räknas i den oförskjutna
  punkten. `solidTriangles` (`mesh.ts`) flyttar alla hörn sist; ytorna
  är plana också efteråt. `extrude` i `view3d/geometry3d.ts` går den vägen
  för lutande kroppar. `liftShape` behåller lutningen; `shearShape(s,
  shear, base)` ger en kropp (dörr, fönster) lutningen med konturen
  flyttad till sin egen fot, och flyttar kantlinjer punkt för punkt
  (`leanedShape(s, wall)` i `wallBodies.ts` tar väggens).
- **Snittet** (`cutSheared` i `sectionCut.ts`): punkten (u, z) i
  snittplanet ligger i kroppen när den oförskjutna punkten Q = O + r·u −
  shear·(z − z0) ligger i konturen, en affin avbildning av (u, z). Snittet
  är därför konturen avbildad baklänges (`toUZ`), klippt mellan
  under- och ovansidan; ett snett plan blir ett halvplan i (u, z)
  (`planeClip`), och urtagen avbildas likadant och dras ifrån. Lutar
  kroppen längs linjen (determinanten noll) förskjuts intervallen längs
  linjen med höjden i stället, som en parallellogramremsa. Fasadernas
  linjer och dolda ytor följer trianglarna (`featureEdges`), så de
  behöver inget eget.
- **Väggen i 3D** (`wall3d.ts`): `WallPiece.shear`. Taken och bjälklagen
  räknas i väggens oförskjutna koordinater: `unshearPlane` ger planet där
  en punkt på konturen når det när den lutar ut (z·(1 − k) = a·x + b·y + c
  − k·z0, k = a·sx + b·sy), `roofsFor` flyttar takets yta i plan tillbaka
  så långt som väggen lutar ut vid sin höjd (en förenkling) och `slabsFor`
  bjälklagets yta vid dess undersida. Kropparna får `shear`; öppningarnas
  kanter (`pt`) och `wallEdges` flyttar punkterna med höjden, och lutande
  väggar är egna grupper i `wallEdges` (nyckeln har lutningen). Skarvarna
  mot andra väggar (`own`) räknas vid foten.
- **Dörrar och fönster** i 3D: `leanedShape` efter `liftShape` i
  `door.ts` och `window.ts`.
- **Planen**: `planWallParams(ctx, el)` är väggen flyttad dit den står
  vid snitthöjden när den går genom snittet (sparad per parametrar i
  `shiftedCache`, så att `wallsWithOpenings` kan återanvända ytan);
  `wallShapesFor` räknar skarvar och hål med den, och dörrar, fönster,
  litteran, öppningsmarkeringarna och rummens dörrar använder den
  (`openingZone(ctx, host, p, true)` i planen; 3D anropar utan).
  `leaningOutlines` i `wall.ts` ritar foten (`vy`) och toppen
  (`över`, streckprickad) som väggens egen rektangel minus det snittade
  (och den egna snittytan utan hål) och minus hålen som når foten (dörrar)
  eller toppen. Rummen, bjälklag ur väggarna, väggsidorna, automåtten och
  snäppningen räknar med foten.
- **Panelen**: `wall:lean` (grader, två decimaler) och `wall:topOffset`
  (mm, räknas om till vinkeln ur höjden) i `selectionEdits.ts`; 0 tar bort
  parametern. `reversedWall` byter tecken på lutningen som på pilhöjden;
  Spegla byter riktning och behåller tecknet.
- Tester: `tests/v01021.test.ts`.

## Situationsplanens beteckningar (0.10.20, format 20)

Inget nytt format: sorterna `level` (markhöjd) och `drain` (låglinje) i
`GroundKind`, `minCross` och `name` på stödmuren i `GroundParams`, och
`steepSlope`, `litteraDigits` och `levelDecimals` i `GroundDefaults` är
frivilliga.

- **Beteckningarna** ligger i `src/elements/groundMarks.ts`: `markText`
  (en text, understruken med en linje under baslinjen lika lång som
  texten enligt `textWidth` i `drawingFont.ts`, så att PDF:en och skärmen
  stämmer), `arrow` (flyttad från `groundPlan.ts`), `levelStatus` och
  `levelMark` (markhöjden: den befintliga markens höjd ur `terrainOf`, den
  nya ur `finishedTerrain` i ett förslag eller `height` i objektet; skiljer
  de mindre än `SAME_LEVEL` 50 mm är marken oförändrad), `drainLine`
  (polylinjen och pilspetsar var `DRAIN_ARROW_STEP` 10 mm på papperet),
  `wallLittera` (`name`, annars *M* och numret bland vyns stödmurar i
  `groundObjects`-ordning, `litteraText` i `core/site.ts`), `wallLeader`
  (vinkelrätt ut åt höger från murens mitt, ett vågrätt streck, littera
  över och *MK* under; `crestAtS` i mitten, eller lägsta–högsta) och
  `minCrossText`. `groundLevelText` i `core/site.ts` skriver höjden med
  projektets decimaler; `hText` i `groundPlan.ts` använder den för alla
  markobjektens höjder (nivåmarkörerna har kvar `levelText` med tre)
- **Markhöjden och låglinjen** formar inte marken: `lineGeometry` ger dem
  `shape: null` (en ruta 1 × 1 m att klicka på, eller en remsa 0,4 m), och
  `finishedTerrain` räknar bara med geometrier som har `shape` eller
  `barriers`, så att en flyttad markhöjd inte räknar om marken.
  `isMarkKind` i `groundGeometry.ts`; `groundLines3d` hoppar över dem.
  `GroundTool` har sätten `level` (ett klick) och `drain` (en linje som
  stödmuren), i verktygsraden under *Beteckning* och i smartshell (J, D)
- **Konturen runt slänterna**: `slopeOutline` i `groundSlopes.ts` går
  runt konturen med halva streckavståndet (som `slopeArea`), tar
  strålarnas ytterändar, jämnar dem med medianen av tre grannar och
  fogar dem till polylinjer, brutna där ingen slänt börjar eller kanten
  är stödmur (`walkSlope` fick ett `skipped`-anrop); en kontur där alla
  strålar når sluts. `slopeReach` förfinar slutet med fyra halveringar
  (så att konturen inte blir trappstegad av rutnätet) och bryter där
  den färdiga marken avviker mer än 100 mm + 25 % från släntens egen
  linje från kantens höjd (strålen har gått in i ett annat objekts slänt)
- **Branta slänter i den befintliga marken**: `src/elements/terrainSlopes.ts`:
  `slopeField` (lutningen per nod, central differens), `steepMarks`
  (gränsen mellan brant och flackt som nollnivån i lutning − gräns med
  `contours` och ett enda steg, sedan längs gränsen var 2,5 mm: där
  nedför går in i det branta börjar ett streck som följer fallinjen med
  `groundAt`-gradienten tills lutningen blir flackare eller `MARK_REACH`
  20 m; sparat per `t.z`, gräns och skala) och `steepSlopePrims` (långa
  och korta om vartannat, `muted` 0,13, `skip` för rutor markobjekten
  ändrat via `changedCells`). Ritas av `terrainType.plan` i `site.ts` när
  vyn har `+steepSlopes` (`STEEP_SLOPES_KEY`, släckt från början i
  `OFF_BY_DEFAULT`), med `groundDefaults(site).steepSlope`
- **Visa**: `littera:Ground` (ledaren) i gruppen Littera, `steepSlopes`
  under Platsen. **Platsen**: tre fält till i `groundSettings`
- **Markeringen** (`highlight.ts`): ett objekt med fler än `MANY_PRIMS`
  primitiver markeras med sina `regions` när det har några, annars med
  ramen som förut (underlag)
- Tester: `tests/v01020.test.ts`, `tests/v010191.test.ts` (markeringen)

## Granskning efter 0.10.18 (0.10.18.1, format 20)

Tre småfel ur Inkorgen och stora filer delade. Det som flyttats exporteras
vidare där det är vanligt att importera det (`ops.ts`); annars importerar
de som använder det den nya filen (testerna också).

| Fil | Innehåll |
| --- | --- |
| `src/ui/modify/ops.ts` | Vilka val ett klick ger, vad det träffade och vilka knappar som tänds (514 → 301 rader) |
| `src/ui/modify/opDefs.ts` | Ny: `OpId`, `OpDef` och `OPS` |
| `src/ui/modify/rail.ts` | Ny: `RailId`, `RailDef`, `RAIL`, `RAIL_ITEMS` och `railOf` |
| `src/elements/groundPlan.ts` | Markobjekten i planen (420 → 254 rader) |
| `src/elements/groundSlopes.ts` | Ny: `slopeMarks`, `slopeArea`, `slopeReach`, `walkSlope`, `outward` och `signedArea` |
| `src/ui/groundFields.ts` | Markobjektets fält (322 → 183 rader) |
| `src/ui/groundFieldEdits.ts` | Ny: `applyGroundField`, fälten när de ändras |
| `src/repr/contourPens.ts` | Ny: `CONTOUR_PENS` (`contour`, `contourMinor`, `contourOld`) och `contourPen` |
| `src/styles/stilmallen.css` | Ny: stilmallens fönster (flyttat ur `stilmall.css`) och kolumnerna, direkt efter `stilmall.css` i `app.css` |

- **Mer** (`smart-more`) läggs till i `quickMarkup` bara när
  `PropertiesPanel.hasMore()` säger att det utfällda har något
  (`selectionParts` ger rubriken och avsnitten för sig; inga avsnitt =
  inget mer). Samma för *Alla inställningar här* i högerklicksmenyn
  (`menus.ts`). En utfälld smartmeny fälls ihop när det nya markerade
  saknar mer. Kartobjekten och den befintliga marken har inget mer.
- **Höjdkurvornas pennor** är rader i stilmallens `pens`, som markörernas.
  `defaultedPen(style, nyckel, förval)` i `markerPens.ts` slår ihop
  stilmallens rad med ett förval som har färg eller linjetyp (snittets
  pennor använder den också). `contourLines` i `elements/site.ts` får de
  tre pennorna; nyckeln för de sparade linjerna har pennorna med.
  Förvalet för den ändrade marken är `muted` och `dashed` (förut `[2, 1]`).
  I stilmallen visar färgfältet `muted` som `#8c8c8c` (`toHex`), och
  `applyPenField` behåller ett förval med färg när samma grå väljs; svart
  sparas då som `ink`.
- **`normalizePens`** behåller `linetype: 'solid'`: den sparas bara när
  förvalet är en annan linjetyp (snittet sedan 0.10.16, den ändrade
  marken), och tappades förut när filen lästes.
- **Stilmallens fönster** (`StyleDialog.render`) har tre `.style-col` i
  `.style-cols`; från 1180 px bred skärm rullar de var för sig (raderna
  staplade inuti, pennornas små rubriker dolda men kvar för skärmläsare),
  smalare som förut. Rullningen (`.dialog-body` och kolumnerna) och fältet
  med fokus (`focusSelector`, efter data-attributen) är kvar när fönstret
  ritas om efter en ändring.
- **Klickjämförelsen** har 457 steg (61 nya efter `allra sist`): väggen,
  fönstret och möbeln över snittet, den egna pennans del över snittet,
  stilmallens pennor för snittet och dubbelklick på Visa; rita vidare
  från en omarkerad linje, Förskjut alla kanter, klick mitt på en kant,
  Foga ihop; ett takfall med en båge i konturen (Båge slås av igen före
  sista hörnet: den är kvar tills den slås av); bjälklag som polygon med
  ett cirkelhål som vrids och speglas; rampens nya punkt med höjd, ritade
  sidor, slänt på vänster sida och förlängning. Sist det nya i granskningen
  (höjdkurvornas pennor, smartmenyn för marken och ett träd), så att stegen
  före går att jämföra med 0.10.18. Mot 0.10.18 skiljer bara stilmallens
  fönster, den ändrade markens streckning (från `runt huset`) och de sista
  stegen.
- **Mätt**: planen för exempelvillan på den kuperade platsen 43 ms från
  början och 24 ms efter en ändrad ramp; rutnätet av rum 93 ms (12 × 12)
  och 347 ms (24 × 24), alltså linjärt. Inget nytt som växer med
  kvadraten; rita vidare prövar de öppna linjerna i vyn bara vid klick.

## Markobjektens bågar (0.10.19, format 20)

Inget nytt format: `bulges`, `leftBulges`, `rightBulges`, `ease`,
`easeRadius` och `eases` i `GroundParams` är frivilliga, liksom
`easeRadius` i `GroundDefaults`.

- **Linjer med bågar**: `src/elements/groundLines.ts` har `ArcLine`
  (punkter och pilhöjder), `hasArcs`, `tidyBulges`, `reversedBulges`,
  `flatLine` (bågarna som raka bitar med `at[i]` = var ritad punkt i
  hamnar), `flatPoints` och `offsetArcLine` (`offsetLine` med tangenterna
  i hörnen; koncentriska bågar, pilhöjden följer kordan; utan bågar samma
  som `offsetLine`). All räkning mot marken (`lineGeometry`,
  `wallProfile`, `rampShape`, slänterna, snäppet) görs på de utplattade
  punkterna; `GroundGeometry.center` och `sides` är utplattade. Modifiera
  och greppen ser bågarna: `shapeOf` för Ground ger linjen med `bulges`
  (utan `noArcs`), `rampSideShape` sidorna ur `rampSideLines` (de ritade,
  eller de som följer referenslinjen koncentriskt), och `shapePatch`
  skriver `bulges`/`leftBulges`/`rightBulges` och flyttar höjder och
  övergångar med `remapLevels`/`remapEases` (en punkt som försvann ger sitt
  till den nya punkten närmast). `rampSides` är fortfarande punkter
  (utplattade). `refPoints(p)` är referenslinjen utplattad; `rampLevels`
  räknar `s` längs den. `extendRamp` tar pilhöjder för de nya kanterna
  (`joinedBulges`) och förlänger ritade sidor med `offsetArcLine`.
  Spegling vänder pilhöjderna (`transforms.ts`). `GroundTool` ritar linjen
  med `ChainInput` (som taket), aldrig sluten (`click(pt, -1)`), med
  *Båge* (`ground-arc`, G) och `undoPoint`
- **Mjuka övergångar**: `rampProfile(p, def)` i `groundRamp.ts` ger
  `levels`, `runs` (med `grade`, `la`, `lb`: parablernas längd i
  sträckans ändar), `curves` (kurvans längd i varje punkt däremellan) och
  `hAt(s)`. `rampRuns(levels, p?, def?)` räknar den raka delens lutning
  med ändarnas radier (`easeRadiusAt`: punktens egen i `eases[i]`, annars
  rampens `ease`/`easeRadius`, annars `def.easeRadius`); `rampWarnings`
  och `steepest(runs)` följer den. `heightAtS` finns kvar för det raka
  fallet. `rampShape` tar `def` och använder profilen; `groundRefLine` i
  `pane3d.ts` delar raka bitar i 0,5 m så att kurvan syns. Valen
  `pathEase` (radie, förslaget ur `easeSuggestion`), `pathEaseSharp` och
  `pathEaseClear` i `rampOps.ts` (`setRampEase`), bara på punkter med höjd
  (`hasLevel`). Panelen: *Övergångarna* (`ground:ease`) och
  *Övergångarnas radie*; fältet *Lutning* räknar med radierna i ändarna
- **Dockning**: `reversedRamp` och `fusedRamp` i `groundRamp.ts`;
  `canFuse` godtar ramper, `fuseRampChains` och `fuseLines` i
  `src/core/joinLines.ts` (skriver bara `RAMP_KEYS`, så pennan och det
  andra i elementet lämnas; `settingsOf` gör att den första rampens
  inställningar gäller också när den andra hängs på före)
- Tester: `tests/v01019.test.ts`

## Rampens referenslinje (0.10.18, format 20)

Inget nytt format: de nya parametrarna i `GroundParams` är frivilliga.

- **Modellen**: `src/elements/groundRamp.ts`. `levels` (en per punkt i
  `line`, null = ingen höjd; ändarna är `height` och `endHeight`),
  `rampLevels` och `rampRuns` (sträckorna mellan punkterna med höjd och
  deras 1:N), `heightAtS`. `left`/`right` är ritade sidor; utelämnade
  följer referenslinjen (`derivedSides`, som förut med `width`, `refSide`
  och `refOffset`), och `rampSides` ger båda. `leftEdge`/`rightEdge`
  ('slope' eller 'wall') gäller sidorna, annars `edge`, som också gäller
  ändarna. `rampShape` ger formen för den färdiga marken: ringen är höger
  sida framåt, slutets tvärlinje, vänster sida bakåt och början
  (`rampRing`, med `wall` per kant). Höjden i en punkt är `heightAtS` vid
  `along(ref).s` plus `along(ref).lat / crossFall`, alltså kring
  referenslinjen (förut kring mittlinjen, med `lat` begränsad till halva
  bredden). `pathShape`, `pathRatio` och `pathWarnings` i `groundLines.ts`
  är borta; varningarna är `rampWarnings` per sträcka
- **Stödmur per kant**: `GroundShape.probe` kan svara `wall: true` för en
  punkt utanför; `finishedGround` lämnar då noden orörd. `slope` är null
  bara när alla kanter är mur. `GroundGeometry.edgeWall` (per kant i
  ringen) och `sides`; `walkSlope` i `groundSlopes.ts` hoppar över murens
  kanter och solfjädrarna intill dem. `g.center` är referenslinjen
- **Planen**: sidorna ritas var för sig (0,5 där de är mur), pilen och
  1:N för varje lutande sträcka mitt på rampen (`middleAt`, halvvägs mellan
  sidornas punkter närmast referenslinjen), namnet i mitten (med 1:N bara
  när rampen har en sträcka), ändarnas höjd mitt på tvärlinjen och de
  andra vid punkten
- **Modifiera**: rampens sidor är formerna inne i elementet, som
  bjälklagets håltagningar: `subShapes(el)` i `shapeEdit.ts` (`hole` 0 =
  vänster, 1 = höger; `rampSideShape`), och `editedShape`/`shapePatch`
  känner igen dem (`left`/`right`). Ändras referenslinjen följer `levels`
  med (`remapLevels`: lika många punkter efter nummer, annars efter läge).
  `modifyContextAt` och `shapeNodeAt` går igenom `subShapes`, och
  håltagningens egna val (`holeMove` …) gäller bara bjälklag. Valen
  `pathLevel` (värde, förslaget ur lutningen som `crestPoint`),
  `pathLevelClear` och `pathExtend` i `src/ui/modify/rampOps.ts`;
  `pathExtend` anropar `ModifyHost.startRampFrom`
  (`startRampFrom` i `src/ui/app/tools.ts`), som byter till Mark och
  `GroundTool.continueFrom`
- **Förlänga**: `GroundTool.continueAt` (ett klick på en ände av en synlig,
  olåst ramp i sättet Ramp/väg, de markerade först; Ctrl börjar en ny) och
  `continueFrom`; `finish` lägger till punkterna med `extendRamp`
  (lutningen i sista eller första sträckan fortsätter, avrundad till 10 mm;
  den gamla änden får sin höjd i `levels`; ritade sidor förlängs med
  `offsetLine` av den nya biten, lika långt från referenslinjen)
- **Transformationer**: `movePatch` flyttar `left`/`right`; `rampSides` i
  `transforms.ts` byter dem (och `leftEdge`/`rightEdge`) när det speglas
- **Greppen**: `.grip.level` (orange, punkterna med höjd) och `.grip.side`
  i `highlight.ts` och `ritytan.css`; referenslinjen i 3D följer
  `heightAtS` (`groundRefLine` i `pane3d.ts`)
- Tester: `tests/v01018.test.ts`. Klickjämförelsen mot 0.10.17 kördes:
  samma `doc` i alla 396 steg; ritningen skiljer från steget *tvärfall*
  (en ramp med referenslinjen på vänster kant, förskjuten, med tvärfall,
  vrider nu kring referenslinjen), panelen och greppen för rampen

## Linjerna i 2D-formen (0.10.17, format 20)

Inget nytt format.

- **Rita vidare**: `Draw2DTool.continuable()` tar alla öppna, olåsta
  `polyline`/`spline` bland vyns `pickables` (de markerade sorteras först,
  och `continueAt` slutar leta bland de omarkerade när en markerad redan
  träffat). `extend` gör nu också något när inga nya punkter lagts till
  men formen sluts (`pts.length === base.n && closed`)
- **Flera kanter**: `edgeRun(s, i, count)` och `offsetShapeEdges(s,
  edges, d)` i `src/elements/shapeEdit.ts`. Varje vald kant flyttas d åt
  vänster sett längs den; ett hörn blir skärningen mellan de två kanternas
  förskjutna tangentlinjer (en båges tangent i hörnet, `tangent`), eller
  förskjuts längs normalen i en öppen ände och där tangenterna är
  parallella. Bågarnas pilhöjd skalas med kordan (samma vinkel). Null om en
  kant vänder eller den slutna ytan byter tecken eller blir mindre än
  1 dm². `ModifyState.edges` (0 = alla) sätts av `Modifier.edges`/`setEdges`
  och väljs i `detailMarkup` (`select[data-modify-edges]`, `EDGE_CHOICES`,
  `change` i `bindValue`). `shapeOffsetPatch` och `roofOffsetPreview` i
  `outlineOps.ts` använder den gamla `offsetShapeEdge`/`offsetEdge` för en
  rak kant, annars den nya
- **Foga ihop**: `src/core/joinLines.ts` (`canFuse`, `fuseChains`,
  `fuseLines`, en transaktion). Valet `shapeFuse` (instant) kommer med
  `editOps` i `ops.ts`, knappen `fuse` i raden (Shift+V), kommandot `fuse`
  i `commandRegistry.ts` och ikonen `fuse`
- **Senaste valet på en kant**: `Modifier.lastEdge` (en `RailId`) sätts i
  `choose` för kanter i 2D-former, takfall, håltagningar, markobjekt och
  bjälklagets kontur (`isLineEdge`: `kind === 'edge'` med `shapeId` eller
  `roofId`), inte för val med `instant`. `setPart` väljer samma knapps val
  igen när det finns där man klickade
- **Konturer med bågar**: `ChainInput` i `src/ui/tools/chainInput.ts`
  (punkter, pilhöjder per kant, `arc`, och `arcEnd` medan bågen väntar på
  sin mittpunkt; `result()` ger 2D-formens `points`/`bulges` med den
  slutande kanten sist; `load` öppnar en sluten kontur igen). `RoofTool`
  ritar takfallets kontur med den (`chain`, `setArc`, `takeContour`);
  `createFace` vänder bågarna med konturen (kant k i den vända är kant
  n − 2 − k baklänges). `SlabTool.options.shape` (`SlabShape`: `rect`,
  `polygon`, `circle`; cirkeln bara för håltagningar, bågar bara i
  håltagningens polygon). Enter sluter i `keyboard.ts` och
  `commandLine.ts`; knapparna i `toolOptions.ts`, alternativen i
  `prompts.ts` (G Båge, R/P/C formen, K Klar)
- **Hålet för sig**: valen `holeRotate` och `holeMirror` i
  `outlineOps.ts` (`rotatedHole`, `mirroredHole`; `holeAngle` med
  `ModifyState.ref` som Vrid), med baspunkten där man klickade. Radens
  Flytta, Vrid och Spegla har hålets val först (`RAIL`), så att de gäller
  hålet när man klickat på det
- **Punkterna** på markobjektens linjer i `highlight.ts`
- Tester: `tests/v01017.test.ts`; `v0828.test.ts` prövar att en omarkerad
  linje ritas vidare och sluts

## Snittet i planen (0.10.16, format 20)

Inga nya format: fälten är frivilliga (`OwnPen.above`, nya nycklar i
stilmallens `pens`).

- **Snitthöjden** och zonerna: `cutHeightOf` och `DEFAULT_CUT_HEIGHT`
  ligger nu i `src/elements/planCut.ts` (roofPlan.ts exporterar vidare),
  med `planCutHeight(ctx)` (undefined när ytan inte är en plan) och
  `zoneInPlan(ctx, z0, z1)`. `cutZone(z0, z1, h)` i
  `src/repr/planCutPens.ts` ger `cut`, `above` eller `below` (ett objekt
  som bara rör snittet räknas som snittat, 0,5 mm).
- **Pennorna**: `PLAN_CUT_PENS` (nycklarna `aboveWall`, `belowWall`,
  `aboveOpening`, …, `belowGround`) i stilmallens `pens`, med förval där
  det över är punktstreckat (`linetype: 'dashdot'`). `planCutPen(style,
  type, zone)` slår ihop förvalet och stilmallens rad, så att förvalets
  linjetyp gäller tills stilmallen har en egen; därför sparar
  `applyPenField` (`src/ui/style/pens.ts`) `solid` när förvalet har en
  annan linjetyp. Raderna står under *Snittet i planen* i `penSection`.
- **Delen över snittet**: det som ligger över har `origin.part` =
  `ABOVE_PART` (`'över'`). `applyOwnPen` lägger `OwnPen.above` ovanpå den
  övre delen för dem (utan `above` gäller den övre som förut, så att
  takens egna pennor ser ut som förut). `mergePens` slår ihop `above`
  fält för fält. Fälten heter `pen:above.…` och `defpen:above.…`
  (`ABOVE_TYPES` i `ownPenFields.ts`, rubriken *Över snittet i planen*);
  `Slab` finns nu i `OWN_PEN_TYPES`.
- **Väggar** (`wall.ts`): `wallZone(ctx, p)` (i `wallBodies.ts`) ur foten
  (`level`) och höjden. `planBatch` slår ihop bara de snittade; de andra
  ritas av `uncutWalls`: sammanslagna per läge, minus de snittade
  (`walls-cut`, utan det som döljs i vyn), som konturer delade per vägg
  med `ownedOutlines`. Kanter utan ägare (längs de snittade väggarna)
  ritas inte, eftersom snittets kontur redan ritar dem. Litteran bara på
  de snittade.
- **Öppningar**: `openingSpan(wall, o)` ger hålets höjder från våningens
  golv (bröstningen från golvet eller väggens fot, som `openingLift`), och
  `openingZoneInPlan`. `wallShapesFor` tar bara med öppningar som går
  genom snittet, så att väggen går obruten förbi de andra (cachen
  `wallsWithOpenings` jämför listan, så den räknas om när läget ändras).
  `uncutOpening` i `opening.ts` ritar hålets två kanter och, för fönster,
  glaset; fönstret behåller litteran.
- **Bjälklag** (`slab.ts`): genom snittet en snittyta (`role: 'cut'`,
  delen `snitt`, med håltagningarna som hål), över snittet linjer med
  delen `över` (håltagningarna utan kryss), annars som förut med
  stilmallens penna under snittet.
- **Möbler** (`furniture.ts`): över snittet om den lägsta kroppen
  (`furnitureSolids` plus `level`) ligger över; då alla linjer med
  pennan för möbler över snittet.
- **Tak** (`roofPlan.ts`): pennorna ur stilmallen (`aboveRoof`,
  `belowRoof`); delen ovanför har `över`. Under golvet som förut (streckat).
- **Stödmurar** (`groundPlan.ts`): `wallCutParts(prof, cut)` delar
  profilens bitar där krönet eller foten går genom snittet (absoluta
  höjder: våningens golv plus snitthöjden), slår ihop per läge och tar
  bort det över som täcks av det snittade. Null när allt är snittat; då
  ritas muren ur konturen som förut.
- **Visa** (`showMenu.ts`): dubbelklick på `.show-btn` sätter allt i
  `SHOW_GROUPS` utom `OFF_BY_DEFAULT` (exporterad från `showKeys.ts`) till
  synligt och tar bort `obj:`-nycklarna ur `hide`.
- Tester: `tests/v01016.test.ts`. Referensritningarna ändrades av takets
  del `över` och stödmuren i `mark` (krönet under snitthöjden ritas nu
  som vy).

## Visa och dölja (0.10.15, format 20)

- **Dolda objekt** står i vyns `hide` som `obj:` och id (`hiddenObjectKey`,
  `hiddenObjects` i `src/core/visibility.ts`), bredvid de dolda typerna.
  `hiddenBy` säger om ett objekt är dolt, för sig, genom sin typ eller
  genom väggen det sitter i (dörrar och fönster följer värden).
- **I `createContext`** (`src/repr/context.ts`) ritas det dolda inte (det
  är inte med i `visible` som kommer tillbaka), men `ctx.visible(typ)` har
  det kvar, så att väggarnas skarvar, rummens konturer, bjälklag ur
  väggarna och numreringen blir desamma när något döljs. Det som bara ska
  gälla det synliga frågar `ctx.hiddenByView(el)`: automåtten och taken i
  fasadens taklutningar. Det gäller också typerna som kunde döljas förut
  (bjälklag, tak …).
- **Visa-menyn**: `Wall`, `Door` och `Window` i `SHOW_GROUPS`, och
  `ground3d` och `slopes3d` (släckta från början, `OFF_BY_DEFAULT`).
  Raden om dolda objekt och knappen `[data-unhide-all]` i `showMenu.ts`
  (nycklarna i `showKeys.ts` sedan granskningen efter 0.10.15).
- **Högerklick**: `hideMenuItems` och `unhideMenuItems` i
  `src/ui/app/hideObjects.ts`, inkopplade i `menus.ts` (inte på blad och
  mallblad). *Dölj alla …* finns för typer med en egen kryssruta under
  Visa.
- **Greppen för djup och Tonat från**: `depthGripsShown`, `depthGripAt`,
  `depthGeometry` och `depthDragValue` i `src/ui/tools/selectGrips.ts`,
  dragningen och ritningen i `selectDrags.ts` (förut `selectTool.ts`; klasserna
  `depth-line` och `grip hollow`). Bara i planen, en ensam olåst markör.
  Utan Tonat från står greppet vid djupet eller 4 m från linjen.
- **Linjerna i 3D**: `groundLines3d` i `src/ui/app/ground3d.ts` lägger
  konturerna (`pickShape`) och släntstrecken (planens linjer med `part`
  `slänt`) på den färdiga marken med `drape`; `View3D.setGroundLines`
  ritar dem. `pane3d.ts` räknar om dem bara när projektet, marken eller
  vyn ändras. Vägarnas kontur är planens delar `kant`, `början` och
  `slutet` (`PATH_EDGES`, 0.10.15.1), så att en avslagen tvärlinje inte
  syns i 3D heller.
- Tester: `tests/v01015.test.ts`.

## Fyllningar och opacitet (0.10.14, format 20)

- **Panelen** är `fillPanel` i `src/ui/fillPanel.ts` (`fillFields` i
  `shapeFields.ts` anropar den med fyllningen som den gäller,
  `effectiveFill`). Lägena (`fillKind`) är Ingen, Solid, Mask och Mönster
  (`fillKindOf`); förslagen `FILL_PRESETS` sätter alla fält för läget.
  Ändringar blir parametrar i `fillPatch(name, value, p)` (ren funktion,
  nycklarna i `FILL_KEYS`) och skrivs av `fillChange(store, ids, name,
  input, nested?)` i `shapeFields.ts`. Med `nested` ligger fyllningen i en
  egen parameter: markobjektets `slopeFill` (fälten heter `sf:…` och går
  via `drawingChange` i `drawingPanel.ts`).
- **Opaciteten**: fyllningens är `fillOpacity` (`fillOpacityOf` läser
  `fillOpacity ?? opacity ?? 100`, så äldre filer ser likadana ut);
  `opacityFields` visar linjens, och i smartmenyn (`withFill`) båda. En
  ändrad linjeopacitet ger fyllningen ett eget värde först, så att den
  inte följer med.
- **Nya parametrar** i `FillParams` (`drawing2d.ts`): `fillWeight`
  (mönstrets penna, förval `FILL_WEIGHT` = 0,13 eller typens), `fillModel`
  (mönstrets mått i verkligheten; förval typens `model`, skrafferingen på
  papper) och `fillStyle` (kopplingen till en sparad fyllning; sedan
  0.10.28 `material`).
  `FILL_FIELDS` är fyllningens fält utan kopplingen.
- **Mönstren** i `fillPrims` ritas nu alla som `kind: 'pattern'` (också
  skraffering och kors, med `hatchAsLines`), och `anchorLines(lines, at,
  scale)` flyttar dem så att de utgår från ringens första punkt i stället
  för modellens nollpunkt; läget minskas till inom ett linjeavstånd och en
  streckperiod, så att lika placerade objekt delar SVG-mönster.
  Referensritningarna `former` och `mark` och `blad-former` ändrades bara
  i fyllningarnas rader (`hatch` → `mönster` med fas).
- **Sparade fyllningar** (material sedan 0.10.28, se där): `StyleSheet.fills` (`SavedFill`, läses av
  `normalizeSavedFills` i `graphics.ts`). `src/core/savedFills.ts` har
  `saveFill` (samma namn skriver över och uppdaterar alla kopplade),
  `linkFill` (koppla eller koppla loss) och `deleteSavedFill`. Ett kopplat
  objekt har också en kopia av fälten, så att `p.fill` alltid är satt där
  rum och markobjekt frågar och objektet ser likadant ut om den sparade
  tas bort. `effectiveFill(p, style)` ger fyllningen som den gäller.
  Knapparna `fill-save` och `fill-unsave` hanteras i `drawingClick`.
- **Slänternas yta**: `slopeArea(ctx, g)` i `groundSlopes.ts` går runt
  konturen med `walkSlope` (samma gång som släntstrecken, med ändarna och
  halva avståndet), känner av slänten med `slopeReach` och slår ihop
  fyrhörningarna mellan grannar (`union`). Sparas per `GroundGeometry`
  tills den färdiga marken eller skalan ändras (ca 100 ms första gången på
  den sneda platsen i 1:50, 12 ms i 1:200). Ritas bara när `slopeFill`
  finns, under objektets egen fyllning (delen `släntens fyllning`).
- **Fönstrets bröstning**: `openingLift(wall, op)` i `opening.ts` ger 0
  (våningens golv) för fönster utan `sillFromWall`, annars väggens
  `level`; dörrar (utan `sill`) följer foten. Används i `window.ts` och
  i väggarnas urtag i `wall3d.ts`.
- **Flytta i höjd från kommandoraden**: `moveZValue(text, moving)` i
  `commandLine.ts` tolkar `M Z -500`, `FZ`, `MZ` och `Z` (bara medan
  Flytta pågår); `Modifier.moveZ(v)` i `controller.ts` startar `moveZ` och
  lägger värdet.
- Tester: `tests/v01014.test.ts`.

## Höjder i förhållande till våningen (0.10.13, format 20)

- **Nivån** `level` (mm från våningens golv, plus eller minus) finns i
  `WallParams` (foten), `SlabParams` (ovansidan) och `FurnitureParams`
  (undersidan); `levelOf(p)` i `src/repr/solids.ts` läser den (0 när den
  saknas). `liftShape` ligger nu också i `solids.ts` (exporteras vidare från
  `storeyShapes.ts`), så att elementtyperna kan lyfta sina former.
- **Väggarna i 3D** (`wall3d.ts`): `WallPiece` har `base`; toppen är
  `base + height`, kropparnas `z0` är `base`, öppningarnas höjder räknas
  från foten, `underSlabs` hoppar över bjälklag under foten (`base`), och
  `wallEdges` grupperar också efter foten (nedre kanterna och de lodräta
  från `base`). Dörrar och fönster lyfts med värdväggens `level`
  (`door.ts`, `window.ts`), bjälklaget i `slab.ts` och möbeln i
  `furniture.ts` (`furnitureSolids`). 3D-vyns grepp och referenslinjer
  (`pane3d.ts`) ligger på `level + height`.
- **Ändra nivån**: `src/core/levels.ts` har `setLevel` (egenskaperna; en
  vägg flyttar foten och får `height` omräknad, false om den blir lägre än
  10 mm), `moveVertically` (Flytta i höjd; `level` eller takets `height`,
  inte låsta) och `hasLevel`/`movesVertically`. Fältet är `level:level` i
  `selectionFields.ts` och `selectionEdits.ts`.
- **Flytta i höjd** är `moveZ` i `ops.ts` (värde i mm, ikonen `moveZ`),
  bland valen för det markerade som helhet; `ModifyTool.commitMoveZ` i
  `modify/tool.ts`.
- **Stödmurens höjdpunkt**: `crestPoint` har ett värde i stället för
  `instant`. `crestSuggestion` (i `modify/tool.ts`) ger förslaget och
  enheten (`m` i RH 2000 med plats, annars `mm`; `OpDef.value.unit` kan
  vara `'m'`), och `Modifier.choose` och `detailMarkup` använder det.
  `addCrestPoint(host, ctx, typed)` lägger punkten. Greppen:
  `crestGripsShown`, `crestGripAt` och `crestDragTo` i `selectGrips.ts`
  (på referenslinjen, minst 100 mm från ändarna), dragningen i
  `SelectTool` (`crest`).
- **Höjdmåtten** (`sectionLevels.ts`): delarna heter `höjd-bh`, `höjd-nh`
  och `höjd-th`, och `MarkerParams.heightOffsets` flyttar dem i sidled
  från förvalet. Greppen: `heightGripsShown`/`heightGripAt` i
  `selectGrips.ts` letar upp måttets lodräta streck i den öppna vyns
  primitiver; `SelectTool.measure` sparar flyttningen.
- **Massorna**: `massBalance(vol, rock)` i `groundGeometry.ts` (netto =
  fyll − schakt, berg och jord ur `GroundParams.rock`), visat i
  `groundFields.ts` med fältet `ground:rock` (0–100).
- Tester: `tests/v01013.test.ts`. Referensritningen `mark > fasad
  fasad-1` ändrades bara av de nya namnen på måttens delar.

## Granskning efter 0.10.15 (0.10.15.1, format 20)

Två småfel (markobjektens tvärlinjer i 3D, maskens opacitet i tio steg)
och stora filer delade. `drawing2d.ts` exporterar fyllningen vidare, så
att inget som importerade den behövde ändras; Visa-menyns nycklar
importeras från `showKeys.ts` (också i testerna).

| Fil | Innehåll |
| --- | --- |
| `src/ui/tools/selectTool.ts` | Markera: väggändarna, flytten, rutan, klick, hovring och Tab (682 → 445 rader) |
| `src/ui/tools/selectDrags.ts` | Ny: de andra greppen som `GripDrag` (`roof`, `measure`, `underlay`, `depth`, `crest`, `node`): `gripDragAt` hittar greppet, `dragGrip` följer musen, `finishGrip` skriver ändringen och `gripsOverlay` ritar greppen och spöket; `fmtAngle` |
| `src/ui/app/showMenu.ts` | Visa-menyn (368 → 204 rader) |
| `src/ui/app/showKeys.ts` | Ny: `SHOW_GROUPS`, `OFF_BY_DEFAULT`, `isShown`, `setShown`, `traceStoreyOptions` |
| `src/ui/app/scalePop.ts` | Ny: skärmskalan i statusraden (`installScalePop`; `installShowMenu` lämnar tillbaka den också) |
| `src/elements/drawing2d.ts` | 2D-formen (515 → 354 rader) |
| `src/elements/fill2d.ts` | Ny: `FillParams` (eget gränssnitt, som `Shape2DParams` bygger på), `FillPattern`, `FILL_FIELDS`, `effectiveFill`, `fillPrims`, `anchorLines`, `opacitiesOf`, förvalen och `PATTERN_LABELS` |
| `src/styles/blad.css` | Bladen, bakgrundstråden och egen skala (528 → 324 rader) |
| `src/styles/fyllningar.css` | Ny: mönstren med förhandsvisning och fyllningens panel, direkt efter `blad.css` i `app.css` |

- **Markera** glömde höjdpunkten, djupet och höjdmåttet i `cancel`; nu är
  de ett och samma fält (`active`) som `cancel` tömmer.
- **Klickjämförelsen** har 50 nya steg: höjderna mot våningen, greppen som
  dras (höjdpunkt, 2D-punkt, bildens hörn, Tonat från, BH-måttet) med ett
  steg mitt i varje dragning (musen nedtryckt, `press_drag` med
  `release=False`), fyllningens panel, sparad och kopplad fyllning,
  slänternas fyllning, Dölj i vyn och Visa dolda objekt, och linjerna i
  3D. Smartmenyn döljs med en stilregel i de stegen. Kryssrutorna under
  Visa klickas (`__click`): menyn lyssnar på `click`, så de gamla stegen
  med `__set` ändrade bara rutan. Före och efter granskningen skiljer bara
  maskens panel och rampens tvärlinje i 3D-bilden.
- **Mätt**: `groundLines3d` 4–7 ms för konturerna och 6–10 ms med
  släntstrecken efter en ändring, i exempelvillan på den kuperade platsen
  (planen räknas bara för vägar när bara konturerna är tända). Inget nytt
  som växer med kvadraten.

## Granskning efter 0.10.12 (format 20)

Utan nya funktioner och utan eget versionsnummer (nästa är 0.10.13).
Stora filer delade; allt som förut importerades från de gamla filerna
finns kvar där (exporteras vidare), så att inget annat behövde ändras.

| Fil | Innehåll |
| --- | --- |
| `src/view3d/view3d.ts` | `View3D`: scenen, kropparna, marken, markeringen och hovringen, kameran, klippningen och träffarna (790 → 464 rader) |
| `src/view3d/edit3d.ts` | Ny: `Edit3D`, greppen i väggändarna och dragningen (grepp och flytt) med förhandsvisning och mått; `Handle3D`, `Edit3DHost` och `EditView` (det dragningen behöver av vyn) |
| `src/view3d/geometry3d.ts` | Ny: `extrude`, `clipPlanes` och `capObjects` (sektionens klippning och snittytor), `groundHit` (där strålen går ner i marken), `shown`, `horizontalPlane`, `resolveColor`, `disposeTree`, `clearGroup` |
| `src/ui/selectionFields.ts` | Egna egenskaper, *Påverkar fler objekt*, typtabellen och fälten för väggar, tak, bjälklag, dörrar, fönster, möbler och rum (389 → 266 rader) |
| `src/ui/markerFields.ts` | Ny: `markerViewFields` (norrpilen, *Beräkningsgrundande fasad*, sektionens och fasadens vy med höjderna) och `markerSection` (delen *Markör*) |
| `src/ui/annotationFields.ts` | Ny: fälten för mått, text, skalstock och stämpel |
| `src/ui/fieldMarkup.ts` | Ny: `numberField` och `textField` |
| `src/ui/propertiesPanel.ts` | Panelen: flikarna, snabbraden, det markerade och fälten (614 → 434 rader) |
| `src/ui/selectionActions.ts` | Ny: `selectionAction`, det knapparna i panelen, snabbraden och smartmenyn gör (`data-action`); `ActionPanel` är det panelen förmedlar till appen |
| `src/repr/section.ts` | `buildSection`: snitten, pennorna, marken, taklutningen, nivåerna och klickytorna (431 → 302 rader) |
| `src/repr/sectionLines.ts` | Ny: `sectionLines`, formernas kanter i vyn, det som skymmer dem och vilka som syns, också de dolda; `wallSilhouettes` |
| `src/core/commands.ts` | Kommandona (625 → 310 rader) |
| `src/core/moveCommands.ts` | Ny: flytta och vända (`moveElements`, `followJoins`, `movePatch`, `moveWallEnd`, `reversedWall`, `flipWalls` …), exporteras också från `commands.ts` |

- **Tester** (526 → 524): skarven mellan våningarna befintligt mot nytt
  (0.10.11) är ett fall i testet för 0.10.1; tak på andra våningar
  (0.10.12) i testet för 0.10.10; låsta som inte tas bort bara i
  `v01012` (testet för 0.8 prövar flytten); byggnadshöjden i fasaden bara i
  `v0108b`.
- **Klickjämförelsen** (`scripts/jamfor-klick.py`) har 54 nya steg efter
  `slut`: våningens meny, Visa-menyn, snäpp mot kalkeringen av och på,
  låst mot borttagning, delen *Markör* med pennan, stödmurens *Över
  marken mot*, bjälklag bakom snittet, och 3D-vyn (hovring, klick på en
  vägg och på marken, grepp, flytt och *Följ sektionen*) med en bild av
  3D-vyn efter varje steg (`v3d`, med `--bilder` som `N-3d.png`). Ritytan
  fotograferas bara när den syns. Mot ett äldre bygge jämförs bara stegen
  till och med `slut` (`--till-slut`; de nya stegen väntar 30 s på menyer
  som saknas där).
  Före och efter granskningen: inga skillnader i 347 steg.
- **Mätt men lämnat**: en fasad eller sektion tar 11–25 ms i exempelvillan
  på den kuperade platsen efter en ändring, med eller utan markobjekt;
  formerna byggs om (inga av dem är samma objekt efter en ändring av ett
  markobjekt), så linjernas uträkning kan inte sparas utan att 3D-formerna
  först blir desamma för oförändrade objekt. Ytterväggarnas insida
  (`innerFaceEdges`) tar 36 ms för `roomGrid(12)` och 129 ms för
  `roomGrid(24)`; med de dolda linjerna tända tar fasaden 30–50 % längre
  tid.

## Småjusteringar (0.10.12, format 20)

| Fil | Innehåll |
| --- | --- |
| `src/core/commands.ts` | `deleteElements` svarar `DeleteResult` (`removed`, `locked`); låsta tas aldrig bort, inte heller en värd med något låst i sig. `REMOVABLE_LOCKED` borta |
| `src/ui/app/erase.ts` | Ny: `eraseSelection(app, ids?)`: Delete, Klipp ut, kommandot och snabbknappen (`panel.onErase`); låsta förblir markerade, med meddelande |
| `src/ui/drawingPanel.ts` | `lockField` för alla typer utom `Terrain` och `SiteMap` (`UNLOCKABLE`) |
| `src/ui/selectionFields.ts`, `propertiesPanel.ts` | `markerSection`: delen *Markör* (beteckning, längd, vinkel, Rikta, Vänd, stilmallens penna `sectionLine`/`elevationLine` via `data-pen` och `applyPenField`, Lås) |
| `src/ui/modify/ops.ts` | `chamfer` och `chamferAll` 500 |
| `src/ui/uiSettings.ts`, `settingsDialog.ts`, `app/menus.ts`, `app/snapping.ts` | `snapTrace` (på); i Inställningar och planens högerklicksmeny |
| `src/repr/section.ts`, `sectionHidden.ts`, `app/showMenu.ts` | `HIDDEN_SLABS_SECTION` (`hiddenSlabsSection`, på; släcks utan plus); de snittade (`ownCuts`) hoppas över |
| `src/elements/roofPlan.ts` | `aroundStorey`: våningen närmast ovanför och alla under |
| `src/elements/groundWall.ts`, `groundGeometry.ts`, `ui/groundFields.ts` | `aboveSide: 'low'` (valfri; utan = den högre sidan) |

- Riv och *Finns i* fungerar på låsta objekt: de ändrar status, inte
  läget, och träden importeras låsta och rivs så. En våning som tas bort
  tar med sig sina låsta objekt (frågan ställs först).
- Tester: `tests/v01012.test.ts`; testet för träd i `v01011.test.ts` låser
  upp före borttagningen. Inga referensritningar ändrades.

## Småsaker (0.10.11, format 20)

| Fil | Innehåll |
| --- | --- |
| `src/ui/app/storeys.ts` | `openMenu(id, x, y)`: våningens meny i trädet; `rename` |
| `src/ui/navigator.ts`, `src/ui/app/menus.ts`, `treeClicks.ts` | ⋯ (`data-storey-menu`), högerklick och långt tryck på `data-storey-pick` |
| `src/ui/app/showMenu.ts` | Visa-menyn i `.show-settings` och `.show-groups`; `settingsMarkup`, `fitInPane` (ryms i `.canvas`) |
| `src/view2d/planView.ts`, `src/ui/app/snapping.ts` | `underlayPrimitives`; `tracedSegments` (id `kalkering`) läggs efter planens sträckor |
| `src/view3d/view3d.ts` | `Ground3DHost`, `ground`; `idAt` provar marken (`groundHit`, steg längs strålen och halvering); hovring (`queueHover`, `setHover`, `hoverMaterial`), `paint` och `marksGroup` för markobjektens konturer |
| `src/ui/app/ground3d.ts` | Ny: `ground3dHost(doc, view)`: markens höjd, objektet i en punkt (`pickShape`) och konturen på marken |
| `src/elements/site.ts`, `src/core/commands.ts` | Träd och grannhus `compares: true` utan `global`; `REMOVABLE_LOCKED` (borta i 0.10.12) |
| `src/repr/storeyShapes.ts` | `joinStoreys` utan åtgärd |
| `src/ui/uiSettings.ts` | Snabbknappar för `Tree` och `SiteBuilding` |
| `src/elements/roofPlan.ts`, `src/ui/modify/ops.ts` | `DEFAULT_CUT_HEIGHT` 1100; `shapeChamfer` 500 |

- Markobjekten är inga kroppar i 3D, så de träffas genom marken: strålen
  provas mot den färdiga markens höjd (`groundAt`) i steg som växer med
  avståndet, och punkten letas upp med halvering. Det är billigt nog för
  hovring en gång per bildruta; markens triangelnät provas inte.
- Tester: `tests/v01011.test.ts`. Inga referensritningar ändrades.

## Dolda linjer och vyns djup (0.10.10, format 20)

| Fil | Innehåll |
| --- | --- |
| `src/geometry/hiddenLine.ts` | `visibleSegments(..., hiddenOnly)` ger de skymda delarna i stället (`hiddenParts`) |
| `src/repr/sectionHidden.ts` | Ny: `HIDDEN_SLABS`, `HIDDEN_WALLS`, `innerFaceEdges(doc, shapes)` (ytterväggarnas insida som lodräta kanter, per våning) och `mergeCollinear` (linjer som ligger på varandra blir en) |
| `src/repr/section.ts` | `pushSeg` delar kanterna vid `fr.tone` (`far` i `EdgeKey`, ritas med `FAR_PEN`); de dolda linjerna (`hiddenSegs`, `HIDDEN_PEN`, part `dold`, `noPick`) bara i fasader |
| `src/elements/markers.ts` | `MarkerParams.toneDepth`, `MarkerFrame.tone` |
| `src/elements/roofPlan.ts` | `ROOFS_AROUND_KEY`; `roofShownOn` får vyns `hide`; zonen `under` (under våningens golv, streckad) |
| `src/elements/registry.ts`, `src/repr/context.ts` | `alsoOnStorey(el, doc, storey, hide)` |
| `src/repr/sheet.ts`, `src/ui/app/render.ts` | `splitPlaced`: underlagen och prims med `under` ritas under fasaden eller sektionen |
| `src/ui/app/drawOrderUi.ts` | *Bakom/Framför modellen* för 2D-former i en fasad eller sektion |
| `src/ui/app/showMenu.ts` | `roofsAround`, `hiddenSlabs`, `hiddenWalls` i `OFF_BY_DEFAULT` |

- De dolda linjerna räknas med samma skymmande trianglar som de synliga,
  med `hiddenOnly`. Bjälklagens kanter tas ur deras `featureEdges` (och
  `Edges3D`, om ett bjälklag har egna); ytterväggarna är de vars kontur når
  husets utsida på våningen, och insidan är utsidan minus dem.
- Det tonade djupet ändrar bara pennan (tunn, grå) för kanter bortom
  `tone`; det som skymmer är detsamma. Inget nytt format: `toneDepth` är
  valfri.
- Tester: `tests/v01010.test.ts`. Inga referensritningar ändrades.

## Stödmur del 2 (0.10.9, format 20)

| Fil | Innehåll |
| --- | --- |
| `src/elements/groundWall.ts` | Ny: `computeProfile(ref, th, p, ground)` (punkterna längs mittlinjen med krön och fot, ren räkning), `simplify`, `crestAtS`, `wallCenter`, `wallThickness`, `wallSolids(id, prof, base)` (bitar med `top`/`bottom`-plan och `noEdges`, plus en `Edges3D`) |
| `src/elements/groundGeometry.ts` | `GroundParams` med `endAbove`, `crest` (`CrestPoint[]`) och `straight`; murens ring och spärrar längs mittlinjen (`center`); `wallProfile(ctx, el)` (sparad per vy, mot den färdiga marken) och `wallCrest` (högsta krön, lägsta fot) |
| `src/elements/groundPlan.ts` | ÖK vid ändarna och höjdpunkterna (part `höjd`, `höjdpunkt`), `normalAt` |
| `src/ui/groundFields.ts` | `refRows` (delas med vägen), *Krönet* (`ground:straight`), *Över marken* och *ÖK* i båda ändar, höjdpunkterna (`ground:crest<i>`, tomt tar bort) |
| `src/ui/modify/ops.ts`, `tool.ts` | Valet `crestPoint` (instant) på murens linje; `addCrestPoint` |
| `src/ui/highlight.ts`, `src/ui/app/pane3d.ts` | Referenslinjen med pil för väg och mur; murens på krönet i 3D |
| `src/core/transforms.ts` | `crest` följer med; spegling byter `refSide` (och `refOffset` i mitten) |

- Profilen räknas i punkter var 0,5 m, i hörnen och vid höjdpunkterna.
  Höjdpunkterna sparas som punkter på referenslinjen och projiceras på
  mittlinjen, så de följer med när linjen ändras.
- Bitarna har `noEdges`; i fasader och sektioner ger `featureEdges` då bara
  böjda ytors konturer, så skarvarna mellan bitarna syns inte. Kanterna
  saknar `part`, så de ritas med vy-pennan (0,18) och berörs inte av
  `joinStoreys`.
- Tester: `tests/mark.test.ts` (*Stödmur del 2*). Referensritningarna
  `mark-plan`, `mark-fasad-2`, `mark-fasad-4`, `mark-3d` och
  `mark-siffror` ändrades.

## Höjderna i fasaden (0.10.8b, format 20)

| Fil | Innehåll |
| --- | --- |
| `src/elements/basisFacade.ts` | Objekttypen `BasisFacade` (linjen *Beräkningsgrundande fasad*, `start` och `end`); texten utanför huset (`modelBounds`), därför `planReads: ['Wall', 'Roof', 'Slab']` |
| `src/repr/buildingHeight.ts` | 45°-planet bara över huset (inget språng); `basisFacade` väljer fasaden linjen ligger på; `basis` och `ridge` i svaret |
| `src/repr/sectionLevels.ts` | `markerHeights(marker, view, bh)` (linjens `heights` med förval), `heightMeasure` (måtten BH, NH, TH från MMN, part `höjd`), kotan *MMN bef.*; `levelPrims` får `marker` och `view` |
| `src/elements/markers.ts` | `MarkerParams.heights`, `MarkerHeights` |
| `src/ui/tools/markerTools.ts` | `MarkerTool.basis`: två klick, `commitBasis` tar bort den gamla linjen i samma transaktion |
| `src/ui/app/toolOptions.ts` | Valet Fasadmarkör / Beräkningsgrundande fasad (`data-elev-basis`) |
| `src/ui/selectionFields.ts`, `src/ui/selectionEdits.ts` | Kryssrutorna `marker:heights.<k>`; en ändring sparar alla fyra |
| `src/ui/app/site.ts` | `mmnButtons`: ±0 ur den nya marken, *Befintlig* bredvid |

- Förvalet för BH följer den beräkningsgrundande fasaden tills en ruta
  kryssats; då sparas alla fyra värden på linjen.
- Ändarna dras med samma grepp som fasadmarkörerna (`isManualMarker`).
- Tester: `tests/v0108b.test.ts`; `tests/mark.test.ts` (BH utan språng).
  Referensritningarna för fasader, sektioner och bladet ändrades: BH bara
  i fasaden mot syd, lägre, och med måttet.

## Marken i ritningarna (0.10.8, format 19)

| Fil | Innehåll |
| --- | --- |
| `src/elements/site.ts` | `changedCells(f, base)` (om en punkt ligger i en ruta som markobjekten ändrat), `groundContours(doc, f)` (`solid` och `old`, sparade per `Finished`), `contourSegments3d(doc, f)` (kurvorna för 3D-vyn); `Terrain.plan` ritar `höjdkurva` och `befintlig mark` |
| `src/elements/groundPlan.ts` | `slopeMarks` (släntmarkeringarna, part `slänt`), `aroundArrows` (en pil per fasad runt huset, part `fall`), `outward` och `signedArea` |
| `src/repr/terrain.ts` | `groundLines`: tjock marklinje också i Befintligt; jorden vit med `site.earthWhite` |
| `src/view3d/view3d.ts`, `src/ui/app/pane3d.ts` | `setTerrain(mesh, contours)`; nyckeln `contours3d` i Visa |
| `src/ui/app/site.ts` | *Klicka i planen* (`pickDatum`, ett tillfälligt `ViewTool`), jorden som val, `{licens}` i noten |
| `src/core/sheetFields.ts`, `src/repr/smartText.ts` | `licens` bland den inbyggda smarttexten |

- `Ground` har `planReads: ['Wall', 'Slab', 'Ground']`: släntmarkeringarna
  beror på den färdiga marken, alltså på de andra markobjekten.
- Tester: `tests/v0108.test.ts`. Referensritningarna `mark-plan` och
  `mark-plan-befintligt` ändrades.

## Markobjekt del 3 (0.10.7, format 19)

Sorterna är `area` (markyta: platå och urgrävning), `path` (ramp/väg),
`point`, `breakline` och `wall`. Varianterna `around` och `slab` är
markytor; urgrävningen under bjälklaget är den enda som bara tar ned.

| Fil | Innehåll |
| --- | --- |
| `src/elements/groundLines.ts` | `RefSide`, `centerShift` (vägens mitt från referenslinjen), `offsetLine` (en förskjuten polylinje med gering; `stripRing` byggs av två), `pathWarnings(pts, h0, h1, max, def)` |
| `src/elements/groundGeometry.ts` | `GroundParams` med `name`, `refSide`, `refOffset`, `maxSlope`, `startLine`, `endLine` och fyllningen (`FillParams`); `GroundGeometry.center` (vägens mittlinje) |
| `src/elements/groundPlan.ts` | Vägen som sidor (`kant`) och ändar (`början`, `slutet`); fyllningen med `fillPrims` bakom väggarna |
| `src/ui/groundFields.ts` | Vägens fält (namn, referenslinjen, förskjutning, gräns, tvärlinjer) och fyllningen med 2D-formens fält (`d2:`) |
| `src/ui/highlight.ts`, `src/ui/app/pane3d.ts` | Referenslinjen när vägen är markerad (`ref-line` i planen, `refLines` med `zb` i 3D) |
| `src/elements/shapeEdit.ts` | `noArcs` på markobjektens linjer och `allowsArcs`: Böj och Avrunda finns inte i Modifiera (`ops.ts`) |

- `movePatch` (`commands.ts`) flyttar `line` (rättat 0.10.7).
- `Ground` finns i `LOCKABLE` (`drawingPanel.ts`) och `OWN_PEN_TYPES`
  (`ownPenFields.ts`); pennan läggs på i planen som för de andra (`ownPenOf`).
- Förvalen: `rampMax` är förvalet för vägens `maxSlope`, `walkMax` gränsen
  för vilplan; `crossFall` är borta.
- Tester: `tests/mark.test.ts`. Referensritningarna `mark-plan` och
  `mark-siffror` ändrades (namnen, rampens referenslinje på vänster kant,
  gångvägen utan tvärlinje i slutet och med skraffering).

## Granskning (0.10.6, format 18)

Utan nya funktioner. Marken räknas om bara när den ändras, och
`ground.ts` är delad. Referensritningarna är oförändrade; de nya för
marken (`mark-*`) skrevs med 0.10.5.

| Fil | Innehåll |
| --- | --- |
| `src/elements/groundGeometry.ts` | Parametrarna och sorterna, `groundLabel`, `m3`, `groundGeometry` (formen per objekt), `groundObjects`, `finishedTerrain`, `showsProposal`, `wallCrest` |
| `src/elements/groundPlan.ts` | `groundPlan`: markobjekten i planen (konturen, höjden, pilarna, vägarnas lutning och varning, höjdpunkt, brytlinje, stödmur) |
| `src/elements/ground.ts` | Typen `Ground` (3D för stödmuren, klickytan, planen); exporterar också det som andra delar använder ur `groundGeometry.ts` |

- **Husets kontur till värdet**: `buildingFootprint` sparar svaret med
  konturens koordinater som nyckel (text), så att samma kontur ger samma
  objekt också när `bareWallUnion` räknats om (en innervägg, en väggs
  höjd eller penna). Det som följer konturen (platån runt huset,
  urgrävningen under en platta ur väggarna, takets språng) räknas då
  inte om.
- **`groundGeometry`** sparas per element med förvalen, våningens
  golvnivå (ett tal, inte våningslistan), husets kontur och bjälklagets
  `fromWalls`, `outline`, `thickness` och golvnivå (inte elementet, som
  byts med en penna eller ett namn).
- **`finishedTerrain`** sparar de sex senaste svaren med rutnätets höjder
  (`t.z`) och mått, platsens nollpunkt, vridning och ±0 och objektens
  former som nyckel; `site` och `site.grid` byts när platsen ändras på
  något sätt (kurvavståndet, jorden) och används inte.
- **Från det ändrade objektet**: `finishedGround(t, shapes, barriers,
  prev)` sparar i `steps` vad varje objekt ändrade (nodernas index och
  höjder, schakt och fyll, rutorna och lägsta och högsta höjd efter det)
  och i `base` det det räknades mot (höjderna, rutnätet, platsen och
  murarna). Med `prev` mot samma `base` läggs stegen för objekten i
  början som är samma objekt (`===`) på direkt, och räkningen börjar vid
  det första som skiljer sig. Svaret är detsamma som utan `prev`
  (testat i `tests/mark.test.ts`).
- **Höjdkurvorna i planen**: `contourPrims` i `elements/site.ts` sparar
  linjerna och texterna per kurvlista, element och skala, så att en
  ändrad vägg (som `Terrain` läser) inte bygger dem igen.
- **3D-nätet**: `terrainMesh` sparar punkternas läge i planen och
  trianglarna per rutnät och plats (`meshGrid`) och fyller bara i
  höjderna; den färdiga marken har samma noder utan höjd som den
  befintliga.
- **Klickjämförelsen** har 288 steg (platsen släpps på planen, verktyget
  Mark i alla sätt, egenskaperna för varje sort, dialogen *Platsen*, en
  innerväggs höjd). Den fasta följden i `crypto.getRandomValues` tar nu
  de höga bitarna: med de låga upprepades id efter några hundra, så att
  ett nytt element kunde ersätta ett annat.
- Tester: `tests/mark.test.ts` (0.10.4–0.10.6, förut `v0104` och `v0105`);
  den sneda marken och testprojektet `groundProject` (alla sorter på en
  kuperad, vriden plats, fasta id) i `tests/projekt.ts`.

## Markobjekt del 2 och byggnadshöjd (0.10.5, format 18)

| Fil | Innehåll |
| --- | --- |
| `src/repr/buildingHeight.ts` | `buildingHeight(ctx)`: 45°-planets höjd vid varje fasad i husets kontur (största z − d över takkropparnas ovansidor framför fasaden), den beräkningsgrundande fasaden (den längsta) och byggnadshöjden mot medelmarknivån |
| `src/elements/groundLines.ts` | Markobjekt längs en linje: `along` (avstånd, sträcka och sida mot en polylinje), `stripRing` (remsa med gering), `pathShape` (väg med höjd längs linjen och tvärfall), `lockShape` (brytlinje och höjdpunkt med utjämning), `barriersOf`, `pathRatio`, `pathWarnings` |

- **Byggnadshöjden**: fasaderna är husets kontur med raka fortsättningar
  ihopslagna. Utanför fasaden räknas bara takets del upp till 3 m ut som
  inte står över huset (en annan flygel). Nivåmarkören *BH* i
  `sectionLevels.ts` (Visa: `buildingHeight`), raden i dialogen
  *Platsen* (`compass` ger väderstrecket).
- **Utjämning**: `GroundShape.blend` (radien); `finishedGround` tonar
  marken med vikten 1 − (3f² − 2f³). Noder utanför rektangeln plus radien
  hoppas över.
- **Stödmurar**: `finishedGround(t, shapes, barriers)`. En nod utanför en
  yta lämnas orörd när sträckan till ytans närmaste kantpunkt (`probe`
  ger `at`) korsar eller når en mur. Murens kropp i 3D och sektioner
  (`model3d` i `ground.ts`, material `wall`) går från 300 under den lägre
  sidan till krönet (`wallCrest`, mark 700 mm ut på båda sidor var 500 mm).
- **Linjen** ligger i `params.line`; `outline` är tom. `shapeOf` gör den
  till en öppen 2D-form, så att Modifiera och greppen fungerar som för
  2D-linjer (`shapePatch` skriver `line`, bågar sparas inte);
  `hasEditableOutline` gäller bara platå och urgrävning. `transformed`
  flyttar linjen och byter tecken på tvärfallet vid spegling.
- **Verktyget** samlar punkter för en linje och avslutar med dubbelklick,
  Enter (`enterInTool`), *Klar* eller verktygsbyte (`finish`).
- Tester: `tests/mark.test.ts` (förut `v0105.test.ts`). Referensritningarna
  för fasader och sektioner fick nivåmarkören BH.

## Markobjekt (0.10.4, format 18)

| Fil | Innehåll |
| --- | --- |
| `src/core/ground.ts` | Den färdiga marken: `GroundShape` (ytans `probe`, slänt eller stödmur, schakt och/eller fyll), `finishedGround` (rutnätet kopieras och objekten läggs på i ordning, med schakt och fyll per objekt och rutorna som ändrats), `nearestEdge` och `withHeights` |
| `src/geometry/offset.ts` | `bufferRings`: ytor utvidgade med ett avstånd (rektangel per kant och cirkel per hörn, sammanslagna i hela mm) |
| `src/elements/ground.ts` | Typen `Ground` (Markobjekt); sedan 0.10.6 ligger `groundGeometry` (formen per objekt, sparad per element), `groundObjects` (de som gäller i vyn, urgrävningar under bjälklag först), `finishedTerrain` (den färdiga marken i vyn, eller null) och `showsProposal` i `groundGeometry.ts` och ritningen i `groundPlan.ts` |
| `src/ui/tools/groundTool.ts` | Verktyget Mark |
| `src/ui/groundFields.ts` | Egenskaperna (`ground:` i `data-key`) |

- **Förvalen** ligger i `site.ground` (bara det som skiljer sig från
  `GROUND_DEFAULTS`); `groundDefaults(site)` fyller i. Ett objekt utan eget
  värde följer förvalet. `site.meanOnExisting` och `site.earthHatch` är
  valen i dialogen.
- **Den färdiga marken** räknas per vy (tillståndet avgör vilka objekt
  som gäller) och sparas så länge rutnätet, platsen och objektens former
  är desamma (vad som räknas, se *Granskning (0.10.6)*). Noder som
  slänten inte kan nå hoppas över med avståndet till ytans rektangel och
  dess högsta och lägsta höjd.
- **Planen**: typen `Terrain` läser `Ground`, `Wall` och `Slab`
  (`planReads`) och ritar den färdiga markens höjdkurvor (`finishedContours`
  i `elements/site.ts`, marching squares på rutorna som ändrats).
- **Fasader och sektioner**: `groundLines` i `repr/terrain.ts` (delarna
  `färdig mark`, `befintlig mark` och `jord`); `meanGround(ctx, existing)`.
- **3D-vyn**: `finishedForView` och `terrainMesh(doc, max, heights)`;
  nätet byggs om när den färdiga marken eller platsen byts (sedan 0.10.6
  bara höjderna).
- `hasEditableOutline` gäller markobjekt med ritad kontur, och `Ground`
  har ritordning (`ORDERABLE`).
- Tester: `tests/mark.test.ts` (förut `v0104.test.ts`).

## Markmodell (0.10.3, format 18)

Platsen ur Höjdkurvor. Utbytet står i `docs/UTBYTE-CAD-APA.md` i
hojdkurvor-repot (version 1); en låtsas-Höjdkurvor att prova
handskakningen med finns i `test/cad-apa-mock.html` där.

| Fil | Innehåll |
| --- | --- |
| `src/core/site.ts` | `Site` (projektets `site`), omräkning zon ↔ modell (`zoneToLocal`, `localToZone`), RH 2000 (`toRh`, `fromRh`), rutnätet (`decodeGrid`, `encodeGrid`, `terrainOf` som avkodar en gång per fil, `heightAtZone`, `groundAt`), `meanGroundLevel`, höjdkurvorna (`contours`, marching squares med kanternas nummer för att foga ihop bitarna) och `cropGrid` |
| `src/core/siteImport.ts` | Platspaketet: `parseSitePackage` (kontroll av `format` och `version`), `applySitePackage` (en transaktion: platsen, rutnätets fil, objekten, norrpilen), `updateSite`, `removeSite`, `cropSite` |
| `src/elements/site.ts` | Typerna `Terrain` (höjdkurvorna, `siteContours` med cache), `SiteBuilding`, `Tree` och `SiteMap` (gränser, vägar, punkter, beteckningar, stompunkter) |
| `src/repr/terrain.ts` | `terrainProfile` (marklinjen i fasader och sektioner), `meanGround` (medelmarknivån för husets kontur), `levelText` (nivåmarkören i RH 2000) och `terrainMesh` (nätet för 3D-vyn) |
| `src/ui/app/site.ts` | Ta emot paketet (fil, släpp, meddelande), frågan, dialogen *Platsen* och `HOJDKURVOR_ORIGINS` |

- **Höjderna**: modellen räknar i mm från ±0 som förut. `site.datum` är
  ±0 i RH 2000 (m). Rutnätet, grannhusens och trädens `mark` och
  stompunkternas `z` är i RH 2000 och räknas om när de ritas, så att ett
  nytt ±0 flyttar huset mot marken.
- **Rutnätet** ligger i `assets` (typen `application/x-hojdkurvor-terrang`,
  Float32 little-endian i base64 som i paketet). Fasadernas och
  sektionernas tråd får den filen men inga andra (`docForWorker`).
- **Objekten ur platsen** är `global` (alla tillstånd, åtgärd `plain`),
  låsta och ligger på Platsen (på våningen närmast ±0 före 0.10.25). `applySitePackage` och
  `removeSite` känner igen dem på typen (`SITE_ELEMENT_TYPES` i kärnan,
  samma som `SITE_TYPES` i `elements/site.ts`).
- **`only3dView`** (ny i `ElementType`): grannhus och träd har 3D-former
  men tas inte med i fasader och sektioner (`WITH_DEMOLISHED` hoppar över
  dem). Materialen `site`, `tree` och `ground` är nya.
- **3D-vyn**: `View3D.setTerrain` lägger marken i en egen grupp, som inte
  går att klicka på och inte räknas av `frameAll` (som också hoppar över
  grannhus och träd när det finns annat). Skuggplanet vid ±0 döljs med
  mark. `pane3d.ts` bygger nätet bara när `doc.site` byts.
- **Fasader och sektioner**: med markmodell ritas marklinjen
  (`origin.part = 'befintlig mark'`) i stället för den tjocka linjen vid
  ±0, och nivåmarkörerna får *MMN*. Att släcka *Befintlig mark* under Visa
  släcker också marklinjen, *MMN* och marken i 3D.
- **Handskakningen** (`installSite`): med `#hojdkurvor-import` i adressen
  och en `window.opener` skickas `cad-apa:redo` till de godkända
  ursprungen; `hojdkurvor:plats` kvitteras med `cad-apa:mottaget` direkt
  (innan frågan), och adressen rensas.
- Testerna i `tests/plats.test.ts` bygger ett eget paket med en jämnt
  sluttande mark.

## Tak (0.10, format 17)

- **Elementtypen** `Roof` i `src/elements/roof.ts`: ett takfall med
  `outline` och `bulges` (som en sluten 2D-form), `ref` (två punkter) och
  `refBulge`, `height`, `heightAt` (`'top'`, annars undersidan), `slope`
  och `thickness`. `roofFrame(p)` ger `w(q)` (avståndet från
  referenslinjen åt det håll taket stiger) och `under(q)`/`top(q)`.
  `roofPlanes(p)` ger takfallet i plana bitar (`RoofPlane` med `rings`,
  `under`, `top`): en bit för en rak linje, 64 per varv för en kon
  (planet genom spetsen och konens linjer vid bitens kanter). Svaret
  sparas per parameterobjekt (WeakMap). `roofRange` ger lägsta undersida
  och högsta ovansida (Takfot och Nock i `sectionLevels.ts`).
- **Väggar** (i `src/elements/wall3d.ts` sedan 0.10.1): `roofPlanesAround(ctx)` tar takfall från alla våningar
  (`ctx.storey` är ny i `PlanContext`, satt i plan) och flyttar dem till
  väggens höjder; andra våningars bitar har `foreign`. `trimToRoofs`
  kapar bara där taket ligger ovanför väggens fot (`claimsOf`, ordnat
  nerifrån, med `boxesTouch` före polygonerna) och drar upp väggar med
  Upp till taket bara under egna våningens tak.
- **3D-kanter**: konturen på över- och undersidan (på en kon delad i
  bitar på 300 mm) och lodräta hörn, utom skarvar mot ett annat takfall
  (`seams`).
- **Snabbval och Kapa mot tak** i `src/elements/roofMaker.ts`:
  `quickRoofs(a, b, o)` (pulpet, sadel, valm; valmen klipps med
  `halfPlaneBelow` mot de andra takfallens plan) och `trimRoof(a, b,
  keep, dz)` (b:s yta över ett stort område, delen där a ligger lägre,
  den sida som innehåller `keep` eller den största).
- **Verktyget** `RoofTool` i `src/ui/tools/roofTool.ts` (ur
  `markerTools.ts`): `mode` `face`/`shed`/`gable`/`hip`, steg `contour`,
  `refStart`, `refEnd`, `side`. Verktygsraden i `toolOptions.ts`,
  smartshell i `prompts.ts`, *Över hela huset* i `roofOverHouse`
  (`tools.ts`, med `bareWallUnion`).
- **Modifiera**: konturen går genom 2D-formens väg: `shapeOf(el)` och
  `outlineShape` (hette `roofShape` till 0.10.24) i `shapeEdit.ts`,
  `editedShape` och `shapePatch` (som skriver `outline` och `bulges`).
  Bjälklag och markyta går samma väg sedan 0.10.24. `roofTrim` (Kapa mot tak) i `src/ui/modify/roofOps.ts`.
  Referenslinjens ändar är `EndGrip` med `kind: 'roofRef'`
  (`selectGrips.ts`, `selectTool.ts`); linjen och pilen ritas i
  `highlight.ts`. Flytta, vrid och spegla i `movePatch` och `transformed`
  (spegling byter linjens riktning), pipetten hoppar över `ref` och
  `refBulge`.
- **Fasader och sektioner**: greppen `height` och `slope` i
  `roofGrips.ts` (`slopeThrough` löser lutningen med halvering), en
  taklutning per takfall i `roofSlopes` (`section.ts`).
- **Egenskaperna**: `case 'Roof'` i `selectionFields.ts`, `roof:heightAt`
  och `roof:radius` i `selectionEdits.ts`, `roof-flip` i
  `propertiesPanel.ts`; flera markerade takfall visar fälten för alla.
- `fromMulti` i `boolean.ts` tar bort punkter som bara skiljer sig på
  flyttal (två takfall som möts i nocken gav dubbla punkter i snittet).
- Tester: `tests/v010.test.ts`. Referensritningarna ändrades av
  exempelvillans två takfall; `twoStoreys` flyttar båda till plan 2.

## Takfot och taket i planen (0.10.2, format 17)

- **Kroppen** i `src/elements/roofBody.ts`: `roofBody(p, footprint)` ger
  `BodyPiece`-bitar (`rings`, `under`, `top`, `kind`: `in`, `out` för
  språnget och `cut<kant>` för snittets remsa). Byggs ur `roofPlanes(p)`,
  delas mot husets kontur när `overhangThickness` skiljer sig från
  `thickness`, och sedan kant för kant (`edgeBits`, bågar i korta bitar
  med normalen inåt) med `stripOf`: remsan är biten ∩ en rektangel längs
  kanten ∩ halvplanet där snittets plan (`cutPlane`) ligger över bitens
  undersida. Remsor snittas inte igen (den första kanten vinner i ett
  hörn). En boolesk operation som kastar ger ett lodrätt snitt för den
  biten. Sparas per parameterobjekt och kontur (`WeakMap`).
- **Snitten**: `EdgeCut` är `'perp' | 'plumb' | number` (vinkel mot det
  vågräta). `isEave` (kanten vetter nedåt: lutningen in mot taket mer än
  0,5) avgör förvalet `p.eaveCut ?? 'perp'`, annars lodrätt.
  `p.edgeCuts` är `{ a, b, cut }` med kantens hörn (`ownCut`,
  `withOwnCut`); `movePatch` (`commands.ts`) och `transformed`
  (`transforms.ts`) flyttar hörnen, pipetten tar inte med dem
  (`arrange.ts`).
- **Kantlinjerna** i `bodyEdges(pieces, corners, top)`: varje bits kant
  får en granne genom en provpunkt 0,5 mm utanför. Utan granne är det
  konturen (ritas om undersidan inte ligger i ovansidans kant), med en
  granne ritas ett steg från båda sidor och ett veck en gång mellan bitar
  av olika slag (konens bitar har samma slag och ingen linje). Lodräta
  linjer i konturens punkter: upp till ovansidan i hörnen (utom skarvar
  mot ett annat takfall, `seams`), annars mellan bitarnas undersidor.
  Ovansidans kontur ritas som förut (`outlineEdges`, som nu också ger
  kantens nummer).
- **Husets kontur** i `src/elements/footprint.ts`: `buildingFootprint(ctx)`
  slår ihop `bareWallUnion` per våning (bara ytterringarna), utan det som
  rivs. `roofBodyOf(ctx, p)` i `roof.ts` ger kroppen med konturen;
  `roofPlanesAround` (väggarnas kapning) och `model3d` använder den, och
  nivåmarkören *Takfot* (`lowestUnder` i `sectionLevels.ts`).
- **Planen** i `src/elements/roofPlan.ts`: `roofPlanPrims` delar konturen
  där `under` och `top` går genom snitthöjden (`cutHeightOf(storey)`,
  `Storey.cutHeight`, förval `DEFAULT_CUT_HEIGHT` 1200) och slår ihop
  bitar med samma slag till en linje per kant; snittytan (`under: true`)
  ur `roofPlanes`. Husets kontur med `clipToRing` när vyns `hide` har
  `+footprint` (`FOOTPRINT_KEY`; `OFF_BY_DEFAULT` i `showMenu.ts`).
  `planReads: ['Wall']`.
- **Tak från andra våningar** i planen: `ElementType.alsoOnStorey`
  (`roofShownOn`: takets höjder når in mellan våningens golv och nästa),
  läst av `createContext(..., otherStoreys)` bara från `buildPlan`, så att
  3D och sektioner inte får taket två gånger.
- **Gränssnittet**: `roof:overhang`, `roof:eaveCut` och `roof:eaveAngle`
  i `selectionFields.ts`/`selectionEdits.ts`; snitthöjden i våningens
  formulär (`treeItemPanel.ts`); valen `roofCutPerp`, `roofCutPlumb`,
  `roofCutAngle` och `roofCutAuto` i `ops.ts` (för en kant av ett tak),
  utförda i `runInstant` och `setEdgeCut` (`tool.ts`); ikonerna
  `eavePerp`, `eavePlumb`, `eaveAngle`.
- Tester i `tests/v0102.test.ts`; testet för skarven vid nocken
  (`v010.test.ts`) använder lodrätt snitt.

## Granskning (0.10.1, format 17)

Tre rättelser för flera våningar och en uppdelning. Referensritningarna
ändrades med avsikt: linjerna har väggens id (och delas där väggarna
möts), väggarna på plan 1 i `tva-*` kapas där bjälklaget täcker dem och
linjerna mellan våningarna är borta.

- **Väggen i tre filer**: `wallBodies.ts` (parametrarna, öppningarnas hål,
  `computeWallShapes`, de sparade ytorna, `bareWallShapes`,
  `bareWallUnion`, `wallShapesFor`), `wall3d.ts` (`wallModel3d`, som är
  väggtypens `model3dBatch`, och kantlinjerna) och `wall.ts` (typen,
  planen och littera). `wall.ts` exporterar också det som andra delar
  använder ur `wallBodies.ts`, så importerna är oförändrade
- **Bjälklagen ovanför** i `modelShapes` (`src/repr/storeyShapes.ts`):
  först byggs sammanhanget och bjälklagen för varje våning (också
  våningarna ovanför med `only`), sedan resten, med
  `PlanContext.slabsAbove` (konturen och undersidan i våningens höjder)
  för de bjälklag vars undersida ligger ovanför våningens golv.
  Ordningen på formerna är densamma som förut. `slabCuts` sorterar dem
  nerifrån med kanterna i ett rutnät; `underSlabs(rings, top, height,
  slabs)` delar en väggbit som `trimToRoofs` gör för taken: delen i
  bjälklaget får undersidans höjd (under tak det lägsta av planet och
  höjden, med `halfPlaneBelow`), resten prövas mot nästa. `cover` ser utan
  boolesk operation om biten ligger helt i eller utanför (inget hörn på
  andra sidan och ingen av bjälklagets kanter går in i biten, `enters`);
  flisor tunnare än 0,5 mm (`solidEnough`) räknas inte. Bitarna har egen
  `height`, och urtagen kapas vid den
- **Kantlinjerna per vägg**: `wallEdges` slår ihop bitarna per åtgärd och
  ovansida som förut, men delar konturen efter ägare med `edgeOwners`
  (`src/repr/outlineOwners.ts`, utbruten ur `ownedOutlines`), så att varje
  vägg får en egen `Edges3D`. Förut fick hela gruppen den första väggens id
- **Skarvarna mellan våningar**: `joinStoreys` i `storeyShapes.ts`, efter
  att alla våningar byggts. Vågräta väggkanter på samma höjd från olika
  våningar, med samma riktning (väggen till vänster, eftersom konturerna
  kommer ur `union`: yttre ringar moturs, hål medurs), på samma linje och
  med samma åtgärd tas bort där de går omlott. Urtag som börjar vid
  väggens fot eller går upp till dess ovansida (`cuts` på väggens
  `Solid`) behåller kanten (`inside`, `without`). Bara höjder där kanter
  från två våningar möts prövas, med `BoxIndex`
- **3D-vyn** (`setSolids` i `view3d.ts`) lägger alla kantlinjer i en
  `LineSegments`
- I `wallModel3d` slås bitarna upp per vägg (förut en slinga över alla
  bitar för varje vägg)
- Tester i `tests/v0101.test.ts`; testet för 0.9.2:s kapning i
  `v092.test.ts` är ihopslaget med det

## Bjälklag del 2 (0.9.4, format 16)

- **Format 16**: en håltagning är `SlabHole` (`src/elements/slab.ts`),
  `{ points, bulges? }` som en sluten 2D-form. `holeRing` ger konturen med
  bågarna som korta bitar (för `slabRings`, 3D och sektionerna);
  planen ritar raka kanter som linjer och bågar som polylinjer, och
  `holeCross` går mellan hörnen, eller med bågar längs den omslutande
  rektangelns diagonaler klippta till hålet (`clipToRing`). Flytt, vridning
  och spegling av bjälklaget (`movePatch` i `commands.ts`, `transformed` i
  `transforms.ts`) flyttar punkterna och vänder bågarna vid spegling
- **Hålen i Modifiera**: `ModifyContext.hole` tillsammans med `shapeId`
  (bjälklagets id). `editedShape(doc, id, hole)` i `src/elements/shapeEdit.ts`
  ger 2D-elementet, eller hålet som en 2D-form (`holeShape`), och
  `shapePatch` gör om formens ändring till elementets parametrar (för ett
  hål hela listan `holes`). Allt i `outlineOps.ts`, `runInstant` i
  `tool.ts`, greppen (`highlight.ts`), dragningen (`shapeNodeAt` i
  `selectGrips.ts`, `node.hole` i `selectTool.ts`) och `railFor` går genom
  dem. `modifyContextAt` prövar hålens hörn och kanter efter 2D-formerna
  och före takets och bjälklagets kontur. För ett hål visar `opsFor`
  formens val och `holeMove` och `holeRemove`, inte de allmänna
- **Avrunda och fasa** (`shapeFillet`, `shapeChamfer`): `canRoundCorner`
  och `roundShapeCorner` i `shapeEdit.ts`. Hörnet ersätts av två punkter
  på avståndet `r / tan(φ/2)` (fasen `r`) längs kanterna, och bågen
  mellan dem får pilhöjden ur `bulgeTangent`. Null när det inte ryms
- **Klickbar yta**: `uiSettings.slabArea` går in i vyn som
  `ViewStates.slabArea` (`render.ts`, som `autoDims`), och bjälklagets
  `pickShape` ger då `slabRings` med `pickSoft`
- Pipetten: `holes` och `fromWalls` är form (`PLACEMENT` i `arrange.ts`)
- Tester: `tests/v094.test.ts`

## Granskning (0.9.3, format 15)

Utan nya funktioner. Kontrollerat med samma klick i 0.9.2 och 0.9.3
(`scripts/jamfor-klick.py --bilder`, 223 steg, nu också våningar,
bjälklag och nivåer): samma läge efter varje steg. Referensritningarna
för två våningar (`tva-*`, projektet `twoStoreys` i `tests/projekt.ts`)
skrevs med 0.9.2 innan koden ändrades.

- **3D-formerna sparas** (`modelShapes` i `src/repr/storeyShapes.ts`):
  de senaste fyra svaren för samma projekt, stilmall, urval, våning och vy
  (som JSON, utan `place` och `viewId`, som bara gäller 2D-elementen)
  återanvänds (`lastResults`). Det förutsätter att projektet aldrig ändras
  på plats (se `reuse.ts`) och att ingen ändrar formerna den får. Urvalet
  är `WITH_DEMOLISHED` (fasader och sektioner) eller `WITHOUT_DEMOLISHED`
  (3D-vyn), så att samma funktion är samma objekt. Fyra fasader på ett
  blad bygger modellen en gång
- **En slinga** i `modelShapes`: med `only` byggs våningarna ovanför i
  samma slinga, med bara väggar och bjälklag, och bara bjälklagen tas med
  (för `trimUnderSlabs`)
- **`featureEdges`** (`src/geometry/hiddenLine.ts`) slår upp hörnen med
  heltal (avrundade till 0,01 mm) och en hashkedja i stället för text, och
  kanterna med `a · n + b`; samma hörn och kanter i samma ordning
- **`section.ts`** i tre filer: `buildSection`, taklutningen och
  väggarnas konturer kvar; nivåmarkörerna och höjdmåttet i `sectionLevels.ts`
  (`levelPrims`, `heightChain`); snittet genom en form i `sectionCut.ts`
  (`cutSolid`, utan `z0`). `POCHE_MATERIALS` (materialen som fylls) används
  också av 3D-vyns lock i `pane3d.ts`. `setClip` och `setCaps` i
  `view3d.ts` har inte längre `z0` (snittytorna har verkliga höjder sedan 0.9)
- Klickjämförelsen: tre steg som felade likadant i båda byggena (fält som
  inte finns där skriptet letade) gör nu något som finns. Hålet ritas i en
  rektangel som skriptet själv ritat, eftersom bjälklaget ur väggarna har
  en annan form efter de tidigare stegen
- Mätt men lämnat: resten av en fasad är de dolda linjerna
  (`visibleSegments`) och sammanslagningarna (`polygon-clipping`)

## Granskning (0.8.38, format 13)

Utan nya funktioner. Kontrollerat med samma klick i 0.8.37 och 0.8.38
(`scripts/jamfor-klick.py --bilder`, 188 steg): samma projekt, markering,
panel, snabbrad, smartmeny och dialog efter varje steg, och samma bild av
ritytan (markupen skiljer sig, eftersom skrafferingen ritas med mönstrets
kod). Referensritningarna (projektet `former` med fyllningstyperna, och
`nivaer-*` för detaljnivåerna) skrevs med 0.8.37 innan koden ändrades.

- **Starkt snedställda mönster** (`dashedFamily` i
  `src/view2d/renderPrimitives.ts`): en streckad familj vars förskjutning,
  minskad till högst en halv streckperiod, är mer än `MAX_SHEAR` (2)
  linjeavstånd ritas som streck klippta mot ytan (`clippedDashes`), inte
  som ett SVG-mönster. Chrome målar en nästan 90° sned mönsterruta
  långsamt och fel; grus och mark i .pat är sådana. Styckena är högst
  200 000 per ritning, sedan mönster igen. Antalet beror på ytan på
  papperet, inte på zoomen. `familyFill` minskar förskjutningen på samma
  sätt (en heldragen familj snedställs inte alls)
- **`src/core/hatchStrokes.ts`**: `hatchStrokes` (linjerna över en ruta,
  PDF:en och förhandsvisningarna) och `clippedDashes` (strecken inom en
  yta, platt: fyra tal per streck; jämnt–udda som fyllningen, punkter som
  streck med samma början och slut). Facit från ezdxf i `v0836.test.ts`
  (`tests/filer/grus.dxf`); ezdxf:s `hatch_entity` flyttar mönstret
  slumpvis (`jiggle_origin`), så facit räknas utan
- **`src/core/patFile.ts`**: `parsePat`, `patFamily` (också DXF),
  `patDash`, `formatPat`. `fillTypes.ts` har typerna, de inbyggda,
  `patternLines`, `resolveFill`, `evenDash` och `drawnDash`
- **Skrafferingen** görs om till ett mönster med en familj
  (`hatchAsPattern`) innan den ritas, på skärmen och i PDF:en (där med
  minst 0,3 mm mellan linjerna, som förut); `FillDef` har kvar `hatch`
- `stylePen` i `src/repr/markerPens.ts` läser en rad i stilmallens
  `pens` (markörerna och dörrarnas och fönstrens klasser).
  `DETAIL_LEVELS` och `DETAIL_LABELS` i `src/core/states.ts`. `withPen`
  i `ownPenFields.ts` gäller objekt och typer. Borttagen, oanvänd:
  `typeFill`
- Mätt men lämnat: DXF-underlagen är primitiver i planen och ritas om
  (markup och målning) vid varje ändring, också när underlaget är
  detsamma

## Granskning (0.8.32, format 13)

Utan nya funktioner. Kontrollerat med samma klick i 0.8.31 och 0.8.32
(`scripts/jamfor-klick.py`, 141 steg, nu också linjetyperna i
stilmallen, masken och bakgrunden i 2D-formen och den egna pennan):
samma projekt, markering, ritning, panel, snabbrad, smartmeny och dialog
efter varje steg. Verktygets klassnamn minifieras olika i två byggen, så
skriptet kräver bara att namnen motsvarar varandra. Referensritningarna
(med det nya projektet `former`) skrevs i 0.8.31 innan koden ändrades.

- **DXF-läsaren** i fyra filer: `src/formats/dxfCodes.ts` (filen som par
  av kod och värde, `entities`, `num`/`str`/`all`, `arcPts`, `bulgePts`,
  `bspline`), `dxfHatch.ts` (`readHatch`), `dxfText.ts` (`mtextLines`,
  `textPlacement`, `DXF_CAP_HEIGHT`) och `dxf.ts` (typerna, avbildningen
  för block och `parseDxf`)
- **Väggarnas sammanslagning utan öppningar** (`bareWallUnion` i
  `src/elements/wallBodies.ts`, förut `wall.ts`): rummens hål (`roomHoles`) och husets
  ytterkontur för vilken sida som är ute (`buildingOutlines` i
  `wallSides.ts`) räknades var för sig ur samma väggar. Nu sparas
  sammanslagningen för samma väggar i samma ordning (parametrarna jämförs
  med ===, `lastResults`). När vyn visar alla väggar (som med jämförelse)
  görs den en gång: planen efter en flyttad vägg i `roomGrid(12)` ca 70 →
  57 ms
- Mätt men lämnat: väggarnas sammanslagning med öppningar när planen ritas
  (`union` i väggarnas `planBatch`, ca en fjärdedel av omritningen). Den
  går inte att räkna ur sammanslagningen utan öppningar: en öppning nära
  en T-skarv skulle då skära i grannväggen. Täckningen (`coverLines`),
  streckningen och de egna pennorna kostar lite: 2 400 2D-former gör
  planen från början 0,14 s långsammare och omritningen efter en flyttad
  vägg inte märkbart
- `centeredAt` ger en vanlig punkt (`[number, number]`), som `addViewport`
  tar
- Borttaget, oanvänt: `pathLength` (`dash.ts`), typen `SectionQueue` och
  rensningen av bladens `items` (format 8) i `parse`

## Detaljnivåer och fyllningar (0.8.37, format 13)

Inget nytt format: fälten är frivilliga.

- **Detaljnivåerna**: `ViewStates.labelDetail` och `modelDetail` (och
  `ViewDef`), utelämnade = som `detail` (2D-symbolerna). Läs alltid med
  `detailOf(view, 'label' | 'plan' | 'model')` i `src/core/states.ts`.
  `showLittera` och litteramallen använder `label`; dörrarnas och
  fönstrens `model3d` använder `model` (och därmed fasaderna). I appen
  `ui.labelDetail` och `ui.modelDetail` (`shell.ts`); `currentViewDef`
  sparar dem bara när de skiljer sig, och `saveView` städar bort lika.
  Knapparna: `[data-detail]` med `data-detail-part` (`label`, `plan`,
  `model`) i Visa (`showMenu.ts`), utan del i vyraden (alla tre);
  `syncDetailSwitch` i `views.ts`. Vyns egenskaper: `levelSelect` i
  `treeItemPanel.ts`
- **Fyllningarna**: `FILL_TYPES` (de inbyggda) i `src/core/fillTypes.ts`;
  `fillTypeOf` tar de inbyggda först, `fillTypeList` ger alla med `own`.
  En egen typ med en inbyggds nyckel hoppas över när stilmallen läses.
  `FillTypeDef.weight` går före fyllningens förval i `resolveFill`.
  Stilmallen: de inbyggda med *Kopiera* (`filltype-copy`), *Linjer*
  (`:weight`) och guiden (`GUIDE`, hålls utfälld vid omritning) i
  `src/ui/style/fillTypes.ts`

## Egna fyllningstyper (0.8.36, format 13)

Inget nytt format: fälten är frivilliga.

- **Kärnan**: `src/core/fillTypes.ts`. `FillFamily` (som den skrivs in),
  `FillTypeDef`/`CustomFillType` (`StyleSheet.fillTypes`, `model` =
  måtten i verkligheten), `HatchLine` (som den ritas, på papper:
  `angle`, `spacing`, `shift`, `dash`, `phase` = baspunkten längs och
  tvärs linjerna). `patternLines(typ, vridning, skala, modelPerPaper)`,
  `resolveFill` (gör `kind: 'type'` till `kind: 'pattern'`; en okänd typ
  blir skraffering), `hatchStrokes` (linjerna över en ruta med fasen per
  linje), `drawnDash` (streck under 0,5 mm blir punkter), `parsePat`,
  `patFamily` (också DXF), `formatPat`, `normalizeFillTypes`. Sedan
  0.8.38 ligger `hatchStrokes` i `hatchStrokes.ts` och `.pat` i
  `patFile.ts`
- **FillDef** har fått `pattern` (ritas) och `type` (sparas i
  stilmallens `cutFill`, görs om i `applyStyle`, som har fått `scale`)
- **Ritningen**: skärmen (`familyFill` i `renderPrimitives.ts`) gör ett
  SVG-mönster per familj, en streckperiod brett och ett linjeavstånd
  högt, med `skewX` för förskjutningen; PDF:en (`PageWriter.pattern`)
  ritar `hatchStrokes` med en `d`-operator per linje
- **2D-former och rum**: `fill: 'type'` med `fillType`, `fillTypeAngle`
  och `fillTypeScale` (`fillPrims` tar stilmallen och skalan;
  `hasBackground`). Väljaren: `patternPicker` med `types`, värdet
  `type:<nyckel>` (`patternValue`), bilden `fillTypeSwatch`; fälten
  `typeFields` i `shapeFields.ts`
- **Stilmallen**: `src/ui/style/fillTypes.ts` (fälten `data-filltype=
  "nyckel:fält"` och `"nyckel:familj:fält"`), knapparna i
  `styleDialog.ts`; snittfyllningens lista i `style/actions.ts`
- **DXF**: `readHatch` läser baspunkt och streck; `parseDxf` gör
  familjerna till `FillFamily` (förskjutningen i HATCH är i världens
  riktning, i `.pat` längs och tvärs linjen); `underlayLines` i
  `underlay.ts` räknar om dem till papper. Facit från ezdxf
  (`tests/filer/tegel.dxf`, AR-B816 vriden 30°) i `v0836.test.ts`

## Filtrera och markera (0.8.35, format 13)

Inget nytt i formatet; villkoren sparas inte.

- **Kärnan**: `src/core/filterSelect.ts`. `FilterCriteria` (tomma listor
  gäller allt), `filterScope` (ytan, eller alla våningar i modellen; bara
  det som inte är `absent` i vyn, markörerna alltid), `matches`,
  `filterElements`, `propertyNames` (objektens och typernas egna
  egenskaper) och `combine` (ersätt, lägg till, dra ifrån). Egen penna
  är `effectivePen`; 2D-former räknas som utan
- **Dialogen**: `installFilterSelect` i `src/ui/app/filterSelect.ts`
  (`app.filterSelect`, också `bacchus.filterSelect`). Ytan är
  `ui.layout ?? ui.marker ?? ui.worksheet ?? ui.storey`. Kommandot
  `filter-select` i `commandRegistry.ts` (`shellActions.ts`), knappen i
  huvudmenyn (`actions.ts`) och raderna i högerklicksmenyerna
  (`menus.ts`). Stilarna i `vyer.css`

## Rum: kontur och rumsgränser (0.8.34, format 13)

Inga nya format: fälten är frivilliga.

- **Konturen**: `ROOM_PENS` i `src/repr/markerPens.ts` (nyckeln
  `roomOutline` i stilmallens `pens`, förval 0 = ingen linje), raden i
  `penSection` (`src/ui/style/pens.ts`; tjockleken 0 får sparas för
  pennor vars förval är 0). `spaceType.plan` ritar en sluten polylinje
  med `under: true` och `part: 'kontur'` när pennan, med `effectivePen`
  ovanpå, har en tjocklek. `Space` finns i `OWN_PEN_TYPES`
- **Rumsgränserna**: `Shape2DParams.boundsRooms`. `roomHoles(walls,
  bounds)` i `src/elements/rooms.ts` slår ihop väggmassan
  (`bareWallUnion`, oförändrad för väggarnas utsida) med
  `boundaryStrips` (1 mm breda rektanglar per segment, förlängda 1 mm i
  ändarna) och sparar svaret för samma väggar och gränser.
  `PlanContext.roomBounds()` ger gränserna på ytan i det visade
  tillståndet, oberoende av Visa och Visas i; rumsverktyget tar dem ur
  dokumentet (`isRoomBoundary`). `Space.planReads` har fått `Shape2D`.
  Fältet: `boundsField` i `src/ui/shapeFields.ts` (`d2:boundsRooms`)

## Pennor per typ och symbollinjer (0.8.33, format 13)

Inga nya format: fälten är frivilliga.

- **Klasserna** står i `OPENING_PENS` i `src/repr/openingPens.ts`
  (`openingCut`, `openingView`, `openingSymbol` i stilmallens `pens`).
  `openingPens(style)` ger alla tre; dörren och fönstret (`plan` i
  `door.ts` och `window.ts`) ritar karmar med `cut`, blad, bågar och glas
  med `view` och slagbågen med `symbol`. Fasadernas och sektionernas
  `swing` får `openingPen(style, 'symbol')` ovanpå `PART_PEN` i
  `buildSection`. Stilmallens rader ritas av `penSection` i
  `src/ui/style/pens.ts`, båda listorna med samma kod (`defaultPen`)
- **Den egna pennan i två delar**: `OwnPen.symbol` (en `OwnPenPart`).
  `applyOwnPen` tar symboldelen för delarna i `SYMBOL_PARTS` (`slagbåge`,
  `swing`) och den övre för resten
- **Typens penna**: `Definition.pen`. `effectivePen(doc, el)` i
  `src/repr/ownPen.ts` slår ihop typens och objektets (`mergePens`, fält
  för fält, symboldelen för sig) och sparar resultatet per element; använd
  den, inte `el.pen`, där pennan ritas (`ownPenOf`, väggarnas `planBatch`,
  sektionernas snitt). Fälten: `ownPenSection` (nycklar `pen:…` och
  `pen:symbol.…`) och `typePenFields` (`defpen:…`, i `sharedSection`) i
  `src/ui/ownPenFields.ts`; knappen `type-pen-reset` i `actions.ts`

## Linjetyp och penna per objekt (0.8.31, format 13)

Inga nya format: fältet är frivilligt.

- **`Element.pen`** (`OwnPen`: `weight`, `color`, `linetype`, alla
  frivilliga). `applyOwnPen` i `src/repr/ownPen.ts` lägger den på en
  primitiv efter stilmallen (`applyStyle`): linjer, bågar och konturer,
  inte fyllningar och text; `ownPenOf(doc, p)` hittar pennan via
  `origin.objectId` (2D-former har sin egen och hoppas över). Planen gör
  det i `drawGroup` (`styled`), sektionerna och fasaderna för varje linje
- **Sammanslagna ytor**: har en vägg i gruppen en egen penna ritar
  `wallType.planBatch` ytorna utan kontur (`noOutline`) och konturen som
  linjer med `asOutline`, delade av `ownedOutlines` i
  `src/repr/outlineOwners.ts` efter vilken vägg varje kant kommer ifrån
  (raka kanter genom flera väggar delas där väggarna möts). `applyStyle`
  ger en `asOutline`-linje snittkonturens penna. Sektionernas snitt gör
  samma sak. Utan egna pennor ritas allt som förut
- **Gränssnittet**: `ownPenSection` och `ownPenChange` i
  `src/ui/ownPenFields.ts` (nycklarna `pen:…`, via `drawingChange`), och
  knappen `own-pen-reset` i `actions.ts`. `OWN_PEN_TYPES` säger vilka
  sorter som har avsnittet. Pipetten (`transferSettings`) tar med pennan

## Linjetyper och mask (0.8.30, format 13)

Inga nya format: fälten är frivilliga.

- **Linjetyperna** ligger i `src/core/lineTypes.ts`: `LINE_TYPES` (de
  inbyggda, nycklarna sparas i projekten), stilmallens egna i
  `StyleSheet.lineTypes` (`{ id, name, dash }`, nycklar `egen-n` från
  `newLineTypeId`). `lineTypeDash(style, nyckel)` ger mönstret på papper i
  mm, eller undefined för heldragen och okända nycklar. `Shape2DParams.linetype`
  och `PenDef.linetype` är en nyckel; `shapePrims` tar stilmallen som sista
  parameter och `markerPen` lägger på mönstret. `solidPen` tar bort det
  för pilspetsar och trianglar. Listorna i gränssnittet ritas av
  `lineTypeOptions` i `src/ui/lineTypePick.ts`, stilmallens del av
  `lineTypeSection` i `src/ui/style/lineTypes.ts`. En förinställd
  stilmall i en vy (`styleFor` i `render.ts`, `styleOf` i `sheet.ts`) får
  projektets egna linjetyper
- **Streckningen** räknas av `dashPieces` i `src/repr/dash.ts`, för
  skärmen (`dashedPath` i `renderPrimitives.ts`) och PDF:en (`stroke`).
  Linjen delas i sträckor vid hörn skarpare än `CORNER` (35°); varje
  sträcka blir en bana med en `stroke-dasharray` (PDF: `[…] fas d`), så
  att mönstret löper genom bågar och splines. En kapad bit
  (`coverLines`, med `clipOutsideAt`) har `PolylinePrim.dashFrom`: linjen
  den kommer ifrån och var den börjar (mm i modellen), så att mönstret
  ritas som på den hela linjen (fasen, `stroke-dashoffset`). `toPaper`
  räknar om `dashFrom` till papperet; `clipPrims` tar bort den (ramen på
  bladet börjar om mönstret)
- **Masken**: färgen `paper` på en bakgrund (`FILL_BACKGROUND`, förvalet)
  eller fyllningen `mask` (`fillPrims` ger en hel yta i `paper`). `paper`
  är `var(--paper)` på skärmen och vitt i PDF:en; som en hel fyllning
  döljer den linjerna under (`coverLines`). Med `fillFront` ligger den
  efter väggarna och döljer dem

## Bakgrund i fyllningar och ändformer (0.8.29, format 13)

- **Bakgrunden**: `fillBackground` (#rrggbb) och `fillBackgroundOpacity`
  (procent, utelämnad = 100) i `Shape2DParams` och `SpaceParams`, med i
  `FillParams`. `fillPrims` i `src/elements/drawing2d.ts` lägger en hel
  yta före skrafferingarna; `backgroundOpacity` räknar opaciteten.
  Fälten är `backgroundFields` i `src/ui/shapeFields.ts` (i `fillFields`
  och `shapeSmartFields`), nycklarna `d2:fillBackgroundOn`,
  `d2:fillBackground` och `d2:fillBackgroundOpacity` i `shapeChange`
  (rummen använder samma). Verktyget har `Draw2DOptions.fillBackground`
  (`#d2-background` i `src/ui/app/toolOptions.ts`)
- **Ändformerna**: `coverLines` i `src/repr/cover.ts` kapar också ytor
  med `origin.part === 'ände'` (pilen, punkten) med `difference`, och
  ritar deras kontur som kapade polylinjer. Prövat i `tests/v0829.test.ts`

## Rättelser i 2D-formen (0.8.28, format 13)

- **Fortsätta en linje**: `Draw2DTool.continueAt(pt, tol)` i
  `src/ui/tools/draw2dTool.ts` letar bland `continuable()` (markerade,
  synliga, öppna `polyline`/`spline`) efter en ände inom `tol` och lägger
  formens punkter först i `points` med den klickade änden sist; `base`
  har id, antalet egna punkter, bågarna i den riktningen och om de
  vändes. `finish` kallar då `extend` (en `updateParams`, Ångra-rubrik
  *Fortsätt linjen*) i stället för `create`. Första klicket i `up` och en
  skriven punkt i `takePoint` prövar `continueAt`; `p.mod` (Ctrl) hoppar
  över. Knappen är `continue-line` i `quickBar.ts`, och
  `app/actions.ts` väljer verktyget med `setTool('draw2d', true)` så att
  markeringen ligger kvar
- **Smartmenyn ritas om** efter ändringar också när fokus ligger i menyn,
  utom i skrivfält (`TYPING` i `smartMenu.ts`); fältet med fokus får
  fokus igen efter omritningen (`focusKey`: `data-key` och, för
  radioknappar, värdet). Fyllningens färg är med i `shapeSmartFields`
- **Det överst döljer det under**: `coverLines` i `src/repr/cover.ts`
  kapar linjer (`polyline`, `line`) i element som ligger bakom en hel,
  ogenomskinlig fyllning i ett senare element i samma grupp. Typer med
  `planCovers` (bara `Shape2D`) får det i `drawGroup` i `src/repr/plan.ts`;
  de sparade primitiverna per element är okapade, så det som markeras och
  klickas är hela formen. Ytorna läggs i ett `BoxIndex`, så varje linje
  prövas bara mot ytor i närheten. `clipOutside` delar varje sträcka där
  den korsar en kant och behåller bitar vars mitt ligger utanför
  (jämn–udda, så att hål räknas). Prövat i `tests/v0828.test.ts`

## Granskning (0.8.27, format 13)

Utan nya funktioner. Kontrollerat med samma klick i 0.8.26 och 0.8.27
(Playwright, 114 steg genom stilmallen, snabbraden, 2D-formens fält,
ritordningen, Visas i, ett underlag, fasaderna och sektionen): samma
projekt, markering, ritning, panel, snabbrad, smartmeny och dialog efter
varje steg. Fasaderna och sektionerna i exempelprojektet, `roomGrid(12)`
och `wallGrid(16)` ger exakt samma primitiver före och efter.
`tests/v0827.test.ts` jämför de dolda linjerna med olika rutor och med en
enda ruta (att pröva allt). Klickjämförelsen ligger i
`scripts/jamfor-klick.py` och kan köras igen vid nästa granskning.

- **Appens stilar**: `src/styles/app.css` är bara `@import` av tretton
  filer i samma ordning som när allt låg i en fil (`tema`, `ramverk`,
  `ritytan`, `paneler`, `vyer`, `smartmeny`, `stilmall`, `navigator`,
  `menyer`, `projekttrad`, `blad`, `linjer`, `smartshell`). Vite lägger
  ihop dem till samma CSS som förut, byte för byte. Ordningen är
  kaskadens: en regel längre ned går före en lika specifik regel längre
  upp, så en regel flyttas inte mellan filerna utan att man ser efter vad
  den skriver över. Nya regler läggs i filen där de hör hemma
- **Stilmallen** (`StyleDialog`) har kvar dialogen och knapparna; delarna
  ligger i `src/ui/style/`, en fil per del med dess HTML och det dess
  fält ändrar: `actions.ts` (åtgärderna: `actionRows`,
  `applyActionField`), `labels.ts` (texter och littera: `labelSection`,
  `applyLabelField`), `pens.ts` (pennorna: `penSection`, `applyPenField`,
  `resetPen`) och `colors.ts` (`fromHex`, `toHex`, `clamp01`). Varje
  `apply…Field` ändrar en kopia av stilmallen och ger ångrarubriken, eller
  null om fältet inte hör till delen. En ny del (linjetyper, detaljnivåer)
  blir en ny fil här och en rad i `render` och `onChange`
- **Egenskaperna för det ritade**: `drawingPanel.ts` har kvar
  taklutningen, Lås och fördelningen (`drawingFields`, `drawingChange`,
  `drawingClick`). 2D-formens fält och ändringar ligger i `shapeFields.ts`
  (`shapeFields`, `shapeChange`, `fillFields`, `hatchFields`,
  `opacityFields`, `capFields`, `shapeSmartFields`), underlagets i
  `underlayFields.ts` (`underlayFields`, `underlayPlaceFields`,
  `underlayChange`) och Visas i i `showFields.ts` (`showSection`,
  `showChange`, `showClick`, `resetShowList`, `SHOWABLE`)
- **Snabbraden**: knapparna ritas av `quickButtons` och `quickButton` i
  `src/ui/quickBar.ts`; vad de gör står kvar i `PropertiesPanel.onClick`
- **Kopiera, Vrid och Spegla** (`copyElements`, `rotateElements`,
  `mirrorElements`, `transformed`, `PlanTransform`) ligger i
  `src/core/transforms.ts`
- **Dolda linjer** (`visibleSegments` i `src/geometry/hiddenLine.ts`):
  rutnätets rutor är kvadratiska, högst N × N (N = 64–256 efter antalet
  trianglar) och inte mindre än halva den vanliga triangelns storlek.
  Förut delades bredd och höjd i N var, så att en fasad 48 m bred och 3 m
  hög fick rutor 1 cm höga och varje vägg hamnade i tusentals rutor.
  `cellSide` ger rutorna en egen storlek (för testerna). Fasaden av 312
  väggar med dörrar och fönster: 0,38 → 0,20 s
- **Fasadens trianglar** (`buildSection`): hörnen räknas till
  vykoordinater utan en lista per hörn, och en triangel som ligger helt
  innanför djupet och linjens längd läggs till som den är i stället för att
  klippas tre gånger (klippningen ger då samma hörn)
- `modelBounds` och `northAngle` (`src/elements/markers.ts`), som anropas
  flera gånger för varje fasad och sektion när planen ritas, går igenom
  elementen utan att bygga listor. `modelBounds` sparar inget mellan
  anropen: den kan anropas mitt i en transaktion (via `placement.auto` i
  `movePatch`), där `doc.elements` inte byter identitet
- Borttaget, oanvänt: `commandById`, `canBoundaryEdit` och `isArcWall`
- Mätt men lämnat: väggarnas sammanslagning i fasaden (`union` i
  `model3dBatch`, ca 0,06 s med 312 väggar) och trianguleringen
  (`solidTriangles`, ca 0,05 s)

## 2D-form del 2 (0.8.24, format 13)

- **Kedjan**: `Shape2DParams.shape` är `ShapePath` (`polyline` eller
  `spline`). `bulges` är pilhöjden per segment i mm, som väggarnas
  `bulge` (`arcFromBulge` i `geometry/arc.ts`): segment i går från punkt i
  till i + 1, i en sluten form också från sista punkten till den första.
  Saknas den, eller är en pilhöjd under `STRAIGHT`, är segmentet rakt.
  `shapeEdit.ts` sparar den utan raka segment sist (`bulgesParam`), och
  utelämnar den när allt är rakt. `isClosed` räknar en sluten form med två
  punkter som sluten när ett segment är en båge (cirkeln)
- **Sätten att rita** (`ShapeKind`: polyline, rect, arc, circle, spline)
  finns bara i verktyget: `chainFrom` i `draw2dTool.ts` gör om dem till
  kedjor. Rektangeln: fyra hörn, sluten. Bågen (start, slut, punkt på
  bågen): två punkter och `bulgeThrough`. Cirkeln (centrum, punkt): punkten
  och den motsatta, `bulges: [r, r]`, sluten
- **`shapePoints`** följer bågarna (`segmentArc`, `arcSegments`) och ger
  punkterna som ritas, snäpps mot och markeras
- **Redigering** (`shapeEdit.ts`): `moveShapeNode` ändrar pilhöjden på
  segmenten intill med kordan, så att bågens vinkel är kvar.
  `insertShapeNode` lägger en punkt på en båge på bågen och delar den i två
  (`sigma · korda/2 · tan(vinkel/4)`); `removeShapeNode` gör segmentet
  mellan grannarna rakt; `bendShapeEdge(s, i, bulge)` böjer eller rätar ut
  (0). `offsetShapeEdge` vägrar bågar (`edgeIsArc`). `shapeCan` har `bend`
- **Modifiera**: `shapeBend` (radie, eller klick genom en punkt;
  `bendPatch` i `outlineOps.ts`) och `shapeStraighten` (direkt, i
  `runInstant`) ligger på knapparna Böj och Räta ut i raden
- **Spegla** (`transformed` i `core/transforms.ts`) byter tecken på
  `bulges`; **Skala** (`scaledParams`) skalar dem; pipetten tar inte med
  dem (`PLACEMENT`). `isOpenLine` i `trimEdit.ts` kräver en kedja utan
  bågar, så Trimma, Hörnskarv, Dela och Förläng gäller raka linjer
- **Ändformer**: `startCap`, `endCap` (`CapKind`: arrow, open, triangle,
  dot, circle, tick, bar) och `capSize` (mm på papper, förval `CAP_SIZE`
  2,5). `shapePrims(p, origin, noFill, scale)` ritar dem med `capPrims`
  vid ändarna, riktade längs de yttersta punkterna (`endDir`), i linjens
  penna utan streck, med `origin.part = 'ände'`. Där ändformen täcker
  linjen kapas den (`trimEnds`, `part: 'linje'`), och den hela linjen
  följer med med tjockleken 0 så att markering och snäpp ser hela formen.
  Bara öppna former med linje får ändar. `splitLine` och `trimLine` ger
  den första delen början och den andra slutet
- **Egenskaperna**: `capFields` i `shapeFields.ts` (Början, Slutet,
  Storlek på papper), också i smartmenyn (`shapeSmartFields`) när alla
  markerade är öppna och har linje. *Ritad som* är ersatt av *Form*
  (Linje eller Spline, och antalet bågar)

## Pennor i stilmallen (0.8.26, format 13)

Pilar och markörer får sin linjetjocklek och färg från stilmallens `pens`,
samma tabell som fasadernas och sektionernas linjer (`PART_PEN` i
`src/repr/section.ts`). Nycklarna och förvalen står i `MARKER_PENS` i
`src/repr/markerPens.ts`; `markerPen(style, nyckel)` ger pennan,
`withWeight` samma färg med textens tjocklek och `penFill` en fylld
triangel i pennans färg. En ny sorts markör läggs till som en rad i
`MARKER_PENS` och ritas med `markerPen(ctx.style, …)`; raden syns då i
stilmallen utan mer kod. `dimensionPrims` och `slopeSymbol` tar pennan
eller stilmallen som sista parameter (utan den gäller förvalen).
Stilmallens del ritas av `penSection` i `src/ui/style/pens.ts`; bara det
som skiljer sig från förvalet sparas.

## Ritordning och fyllningar (0.8.25, format 13)

Inga nya format: fälten är frivilliga.

- **Ritordning** (`src/core/drawOrder.ts`): `Element.order` (utelämnad =
  0). `buildPlan` sorterar varje grupp (sort och åtgärd) med `sortByOrder`,
  stabilt, så att lika värden ritas i listans ordning som förut. `arrange`
  gäller sorterna i `ORDERABLE` och grupperar på sort och yta (`space`
  eller våningen). Längst bak och Främst sätter bara de markerade (lägsta
  − n, högsta + 1); Bak och Fram flyttar förbi närmaste omarkerade som
  överlappar (`boxOf`, i appen rutorna från `selectionBounds`) och numrerar
  om sorten på ytan 0, 1, 2 … men skriver bara de som ändras. Allt i en
  transaktion. Gränssnittet i `src/ui/app/drawOrderUi.ts`: avsnittet i
  egenskaperna (`orderSection`), raderna i objektmenyn och
  `arrangeSelection`, som knapparna (`data-action="draw-order"`
  `data-order`, i `actions.ts`) och kommandona `order-*` (i
  `shellActions.ts`) går till
- **Klick**: vid lika poäng vinner nu den senare i `pickables`, alltså det
  som ritas överst (förut den första)
- **Lager mot väggarna**: `Shape2DParams.fillFront` och `lineBehind`.
  `shapePrims` sätter `under` på fyllningen utom med `fillFront`, och på
  linjen och ändarna med `lineBehind`. En fyllning framför väggarna är inte
  mjuk när man klickar (`pickSoft` kan nu vara en funktion per element).
  Gäller planen; i fasader och sektioner ligger det ritade ovanpå som
  förut, och på blad och arbetsblad finns inga väggar (valen visas inte för
  former med `space`)
- **Fyllningen** ritas av `fillPrims(rings, p, origin, under)` i
  `drawing2d.ts`, för 2D-former och rum (`FillParams`). Rummet har `fill`,
  `fillColor`, `fillAngle`, `fillSpacing` och `opacity`, ritas `under`
  och med `noPick`, så att fyllningens kant inte går att klicka på och inte
  markeras (`plan.ts` filtrerar bort `noPick` ur det som klickas).
  Rummets fält är 2D-formens (`fillFields`, `opacityFields`, nycklarna
  `d2:`), bara när ett rum är markerat

## Granskning (0.8.23, format 12)

Utan nya funktioner. Kontrollerat med samma klick i 0.8.22 och 0.8.23
(Playwright, 106 steg genom smartshell, Markera, projektträdet, zoom och
statusraden): samma projekt, markering, ritning, rutnät, smartmeny,
smartshell och träd efter varje steg. `tests/v0823.test.ts` jämför
`pickAllAt` med den gamla versionen på 5 000 punkter.

- **Smartshell uppdelad**: `commandLine.ts` har kvar fältet, kommandona och
  menyerna. `shellPoints.ts` har läget (`pointTaker`, `commandBusy`,
  `valueOp`, `wantsPoint`, `pointFor`), `shellLog.ts` historiken
  (`createShellLog`: `add`, `render`, `toggle`, `recent`), `shellDock.ts`
  var raden ligger (`installShellDock`: `apply`, `set`, `items`, och dragen
  i blixten), `shellHint.ts` frågans text (`promptMarkup`, `optionMarkup`,
  `POINT_HELP`) och `shellActions.ts` kommandona som gör något direkt
  (`runAction`)
- **Markera uppdelad**: greppen under markören ligger i
  `src/ui/tools/selectGrips.ts` (`endGripAt`, `companionsAt`,
  `underlayGripAt`, `shapeNodeAt`, `roofGripAt`, `roomLabelAt`). De gäller
  bara det markerade, och `shapeNodeAt` och `underlayGripsShown` slår upp i
  `pickableById` i stället för att gå igenom alla objekt i planen vid varje
  musrörelse
- Mätt men lämnat: snäppningen långt utzoomat över ett stort DXF-underlag
  prövar alla sträckor inom spårlinjernas räckvidd (`TRACK_REACH` gånger
  toleransen), som då kan vara hela underlaget. Att begränsa räckvidden i
  mm skulle ändra vad som snäpps, och hör till en version med nya val
- **Projektträdets klick** ligger i `src/ui/app/treeClicks.ts`
  (`installTreeClicks`: `click`, `pickTreeItem`); `actions.ts` har kvar
  knapparna
- **Klick och hover i planen** (`pickAllAt` i `src/view2d/pick.ts`): varje
  objekt i planen får en rektangel för hur långt det når (texter som en
  ruta som rymmer dem hur de än vrids), sparad per objekt och
  ritningsskala i en `WeakMap`. Objekt längre bort än toleransen prövas
  inte, och ett objekt med 64 delar eller fler (ett DXF-underlag) får ett
  `BoxIndex` över delarna. Med 3 000 delar: 0,85 ms → 0,05 ms per
  musrörelse; tiden växer inte längre med underlagets storlek
- **Rutnätet** (`planView.ts`) byggs bara om när kameran ändrats
  (`gridKey`), inte vid varje musrörelse
- **`BoxIndex.near`** med en fråga som täcker för många rutor (långt
  utzoomat) går igenom rutorna som har något i sig i stället för att ge
  alla, och sorterar inte `all` när numren lagts in i stigande ordning
- **Snäpplistan**: underlagens sträckor läggs till en och en i stället för
  spridda i ett anrop, som kunde bli för långt med mycket stora DXF:er.
  *Rikta efter objekt* prövar bara sträckorna nära markören
  (`nearSegments`), och underlagen per fil i projektträdet grupperas i ett
  varv
- `app.ts` delades inte: ordningen mellan prenumerationerna på projektet
  och markeringen där är den som ger rätt omritning, och en uppdelning
  skulle flytta den

## Småsaker (0.8.22, format 12)

- **Opacitet** på 2D-formen: `opacity` (linjen) och `fillOpacity`
  (fyllningen), procent, båda valfria. Saknas `fillOpacity` följer
  fyllningen `opacity` (*Samma för linje och fyllning*); kryssrutan
  `d2:opacityLinked` skiljer dem åt eller tar bort `fillOpacity`.
  `opacitiesOf` i `drawing2d.ts` ger värdena 0–1. 0 % ritar linjen med
  tjockleken 0, så att formen går att klicka på. Formatet ändrades inte:
  parametrarna är valfria
- **Smartmenyns fält** för 2D-former: `shapeSmartFields` i
  `shapeFields.ts` (skrafferingens vinkel och avstånd, `hatchFields`, och
  opaciteten, `opacityFields`), visade av `PropertiesPanel.smartFields`
  som underlagens läge. Värden som skiljer sig mellan markerade former står
  tomma med *Olika*
- **Visa → Fyllningar**: nyckeln `fill` i vyns `hide` (under 2D i
  `SHOW_GROUPS`). `shapePrims(p, origin, noFill)` hoppar då över
  fyllningen; `pickShape` är kvar, så mitten går fortfarande att klicka på
- **Linje är polylinjen**: `shape: 'line'` ritas inte längre men finns kvar
  i äldre projekt (och blir en polylinje när en punkt läggs till, som
  förut). `SHAPE_LABELS.polyline` är *Linje*, `commandFor({ shape: 'line' })`
  ger polylinjens kommando och `Draw2DTool.setKind('line')` väljer polylinjen
- **Rumsstämpelns mall** `LabelStyle.room` i stilmallen, med fälten
  `{namn}`, `{nummer}`, `{area}`, `{takhöjd}` och rummets egna egenskaper.
  `fillTemplate` och `ownProp` i `littera.ts` används av både littera och
  rumsstämpeln. Raden med `{namn}` får rumsnamnets höjd och fet stil, en
  rad med bara `{takhöjd}` grå text. En stilmall utan `room` får förvalet,
  som ger samma stämpel som före 0.8.22
- **Sektionspilen**: hullingarna har vinkelns tjocklek, 0,5. Facit i
  `tests/referens/` skrevs om för det (bara pilarnas linjer)

## Kommandoraden del 2 (0.8.21)

- **Frågan** `src/ui/app/prompts.ts`: `currentPrompt` ger `head` (verktyget
  eller valet), `text` och `options` (`PromptOption` med `key`, `label`,
  `run` och `on`) för läget just nu: ett kommando som väntar på en
  markering, Modifiera (`picking`, `runningTool`), Rikta, Zooma och
  verktygen. Ett nytt verktyg med steg ska ha ett fall där. `matchOption`
  väljer ett alternativ ur det skrivna (bokstaven eller början av namnet,
  minst två tecken, entydigt). Alternativen går före kommandon och punkter
  i `submit`
- **Verktygen** har fått det frågan behöver: `WallTool.canClose`, `close`
  och `undoLast` (ångrar väggen med `store.undo`), `Draw2DTool.canClose`
  och `undoPoint`, `DimensionTool.undoPoint`, `MarkerTool.back` och
  `hintText`, `RoofTool.hintText`. `MarkerTool`, `RoofTool` och
  `ModifyTool` är `PointTaker` (`ModifyTool.takesPoints` är falskt för
  Trimma, Hörnskarv, Dela och Förläng; `repickBase` och `hasBase` för
  *Baspunkt*). Klicket och den skrivna punkten går genom samma `click`
- **Smartshell** `src/ui/app/commandLine.ts`: `pending` är ett kommando för
  det markerade som väntar (`waitForSelection`, `runPending`,
  `cancelPending`, som Esc i `keyboard.ts` anropar först). `key('enter' |
  'space')` är Enter och mellanslag utanför fältet. `optionLetter(k)` säger
  om en bokstav ska gå till raden (medan något pågår och ett alternativ
  börjar så), `wantsPoint()` om Modifiera väntar på en punkt och inte på
  värdet. `remember` utifrån räknas inte medan raden själv kör ett kommando
  (`running`), så att historiken inte får dubbletter. Historiken `log`
  (`LogLine`, högst 200) visas i `.ss-log` med F2; `recentItems(forSelection)`
  och `promptItems()` ger rader till högerklicksmenyn (`menus.ts`)
- **Läget** `UiSettings.shellDock` (`bottom`, `top`, `float`) och `shellAt`
  (andel av ritytan). `applyDock` sätter klasserna `ss-top` och `ss-float`
  på `.app` (CSS-griden byter ordning på `cmd` och `canvas`) och `ss-down`
  på raden när listan och historiken ska öppnas nedåt. `.ss-grip` (blixten)
  dras; `.ss-dropzone` i `.canvas` visar var den dockas
- Playwright: alternativen är `.ss-opt` (`data-opt`), historiken `.ss-log`,
  läget `JSON.parse(localStorage['bacchus-ui']).shellDock`. Frågan står i
  `.ss-hint`

## Kommandoraden (0.8.20)

- **Registret** `src/ui/commandRegistry.ts`: `COMMANDS` med `id`,
  `label`, svenska (`sv`) och engelska (`en`) namn i gemener, och vad
  kommandot gör: `tool` (verktyg), `shape` (2D-verktyget med ett sätt att
  rita), `rail` (en knapp i Modifiera-raden) eller `action`. Ett nytt
  verktyg eller en ny Modifiera-knapp ska ha ett kommando; testet i
  `tests/v0820.test.ts` säger till, och att inga namn krockar.
  `findCommand` (exakt), `complete` (rangordnad lista), `commandFor`
  och `aliasText` (förkortningarna i knapparnas tipsrutor)
- **Punkter** `src/ui/pointInput.ts`: `parsePoint` ger `abs`, `rel`,
  `polar`, `dist` eller `angle`; talen går genom `evaluate` i `expr.ts`.
  `resolvePoint` räknar från förra punkten och markören. Verktyg som tar
  emot punkter implementerar `PointTaker` (`lastPoint`, `cursorPoint`,
  `takePoint`, `lockAngle`, `hintText`): `WallTool`, `Draw2DTool` och
  `DimensionTool`. Ett nytt ritverktyg läggs till i `taker()` i
  `commandLine.ts`
- **Smartshell** `src/ui/app/commandLine.ts` i gridområdet `cmd` (under
  ritytan, i `shellMarkup` som `.smartshell`). `busy()` säger om ett
  kommando pågår (då hör Enter och mellanslag till det), `remember` och
  `toolChosen` håller reda på senaste kommandot (`setTool` och Modifiera-
  radens `press` anropar dem genom `app.commandLine`, som är valfri i
  `AppContext` eftersom den installeras efter Modifiera-raden),
  `refresh` anropas av `renderToolOptions`. Tangenterna i `keyboard.ts`:
  Enter öppnar, mellanslag upprepar, siffror och `@ # < .` i ett
  punktverktyg öppnar raden med tecknet. Inställningen `smartshell` i
  `UiSettings`
- Playwright: fältet är `#ss-input`, raden under `.ss-hint`, listan
  `.ss-list`. `bacchus` har inte raden; skriv med `page.keyboard`

## 2D-form (0.8.19, format 12)

- **`Shape2D`** (`src/elements/drawing2d.ts`) ersätter `Line2D` och
  `Fill2D`. Parametrarna: `shape` (hur formen ritades; bestämmer punkternas
  betydelse och greppen i `shapeEdit.ts`), `points`, `closed`, `weight`,
  `linetype`, `color` och fyllningen `fill` (`solid`, `hatch`, `cross`;
  utelämnad = ingen), `fillColor`, `fillAngle` och `fillSpacing`.
  Fyllningens fält heter `fill…` så att pipetten (`isPlacement` i
  `core/arrange.ts`) kan räkna `angle` som läge för alla typer
- **`shapePrims`** ger fyllningen som `region` med `under: true` (en per
  skrafferingsriktning) och linjen som `polyline`, alltid, också med
  `weight: 0`. En öppen form fylls genom sina punkter som om den vore
  sluten; en form med två punkter får ingen fyllning
- **Under modellen**: `buildPlan` lägger primitiver med `under` efter
  grupperna med `drawOrder` under `UNDER_ORDER` (4, underlagen) och före
  resten, så att fyllningarna ligger under väggarna medan formens linje
  ritas med typens `drawOrder` (58). Det ersätter `Fill2D`:s `drawOrder: 4`
- **Tjockleken 0** ritas inte: `renderPrimitives` hoppar över `line`,
  `polyline` och `arc` med `pen.weight === 0`, och `PageWriter.stroke` och
  `arc` i `formats/pdf.ts` likaså. Primitiven finns kvar i `Pickable.prims`,
  så markering, markeringens grafik och snäpp (`primSegments`) fungerar.
  `ghost` ger den 0,13 när den visas tonad. `PEN_WEIGHTS` börjar med 0;
  `weightPicker` visar den som *Ingen linje*
- **Markering**: `pickShape` ger ytan bara när formen har en fyllning. I
  `pickAllAt` gäller nivå 4 (inuti en sluten `polyline`) inte för typer
  med `pickSoft`, så att en form utan fyllning bara träffas på linjen
- **Gränssnittet**: `fillFields` i `shapeFields.ts` (mönster, färg,
  vinkel, avstånd); `patternPicker` har ett val `none` (*Ingen fyllning*).
  I verktygsraden visas mönstren utan namn (CSS `.opt .pattern-pick label
  span`). `Draw2DOptions` har `kind` (`ShapeKind`), `weight`, `linetype`
  och `fill`
