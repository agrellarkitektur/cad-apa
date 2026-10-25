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
| `showMenu.ts` | Visa-menyn med kalkeringens utseende, och skärmskalan |
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
  alla tillstånd oavsett `states` (norrpil, fasad- och sektionslinjer).
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
  räknar med den: mått, rumsetiketter, littera, markörer, nivåkoter
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
- **Väggarnas ytor** sparas per vägg (`WallShapeCache` i `wall.ts`): en
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

- **`src/ui/modify/`** är Modifiera, uppdelat: `ops.ts` har valen (`OPS`,
  `opsFor`), vad ett klick träffade (`modifyContextAt`), `ModifyHost` och
  Modifiera-radens knappar (`RAIL`, `railFor`); `tool.ts` har `ModifyTool`
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
  så automatiska fasadlinjer omsluter hela huset.
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
  verkliga höjder (`z0 = 0`) och har en nivåkot per våning; 3D-vyns
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

- **Nivåkoter** i `levelPrims` (`src/repr/sectionLevels.ts` sedan 0.9.3,
  anropas av `buildSection`): FG för varje våning, UK bjl för bjälklag som
  sektionen skär (`ownCuts` med material `slab`), Takfot och Nock. Texterna skjuts uppåt när två nivåer ligger
  närmare än en textrad, och strecket kortas till triangeln där en annan
  nivås text hamnat på det (`levelMark` med `textY` och `long`).
  Släcks med `hide: ['level']`.
- **Höjdmåttet**: `heightChain` ger under- och ovansidan av de skurna
  bjälklagen nerifrån; kedjan ritas med `dimensionPrims` (vinkel 90)
  bredvid byggnaden, origin `part: 'höjdmått'`. Bara i sektioner;
  `hide: ['heightDims']`.
- **Väggar under bjälklag**: `trimUnderSlabs` i `src/repr/storeyShapes.ts`,
  efter att alla våningar byggts i `modelShapes`. En väggkropp vars
  konturmitt ligger i ett bjälklag (inte i ett hål) och vars höjdintervall
  bjälklagets undersida går igenom slutar där; urtag och väggens
  kantlinjer kapas med. Väggar med sned ovansida (under tak) lämnas. Med
  `only` (Bara den här våningen) byggs bjälklagen på våningarna ovanför i
  samma slinga, med bara väggar och bjälklag i sammanhanget (bjälklag ur
  väggarna behöver väggarna), och visas inte.
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
- **Konturen i Modifiera**: `hasEditableOutline` i `src/core/roofEdit.ts`
  (tak, och bjälklag utan `fromWalls`) används av greppen
  (`highlight.ts`) och valen (`ops.ts`); valen heter fortfarande
  `roof*` och `roofId`. `transformed` och `movePatch` flyttar `holes`.
- **Verktyget** `SlabTool` i `src/ui/tools/slabTool.ts` (`mode`
  `slab`/`hole`), *Ur väggarna* i `slabFromWalls` (`tools.ts`),
  verktygsraden i `toolOptions.ts`, smartshell i `prompts.ts` och
  `shellPoints.ts`. Egenskaperna: `case 'Slab'` i `selectionFields.ts`,
  `slab:fromWalls` i `selectionEdits.ts`, `slab-hole-remove` i
  `propertiesPanel.ts`.
- Tester: `tests/v091.test.ts`. Referensritningarna ändrades av plattan i
  exempelvillan.

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
  väggarnas konturer kvar; nivåkoterna och höjdmåttet i `sectionLevels.ts`
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
  `src/elements/wall.ts`): rummens hål (`roomHoles`) och husets
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
