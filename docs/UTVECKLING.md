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
sektioner, 3D och ett blad för exemplet och ett rutnät av rum skrivs som
text, en rad per primitiv (koordinater avrundade till 0,1 mm), och jämförs
mot facit i `tests/referens/`. Ändras en ritning med avsikt skrivs nytt
facit med `npx vitest run tests/referens.test.ts -u`; titta på skillnaden i
git innan den läggs in. Testprojekten (`wallGrid`, `roomGrid`) ligger i
`tests/projekt.ts`.

## Rum och anteckningar

Rum som skapats med rumsverktyget sparar punkten man klickade i (`seed`).
En flyttad rumsstämpel har sin mittpunkt i `labelAt` (0.8.17); den flyttas
och vrids med rummet i `movePatch` och `transformed` (`src/core/commands.ts`),
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
- **2D-element**: `Shape2D` (`shape`: line, polyline, rect, arc, circle,
  spline; fyllning i `fill`) i `src/elements/drawing2d.ts`, verktyget i
  `src/ui/tools/draw2dTool.ts`. Bågar sparas start, punkt på bågen, slut.
  Före format 12 fanns `Line2D` och `Fill2D` (se *2D-form (0.8.19)*).
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
  `src/ui/drawingPanel.ts`. Sedan 0.8.1 ligger resten av egenskapspanelens
  fält i `src/ui/selectionFields.ts` (HTML) och det de ändrar i
  `src/ui/selectionEdits.ts` (`applyField` för fält med `data-key`
  "omfång:namn"); `propertiesPanel.ts` har bara panelen, snabbraden och
  knapparna.

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
- **Fält**: `underlayPlaceFields` i `drawingPanel.ts` (X, Y, bredd, höjd,
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
  `drawingPanel.ts` (skrafferingens vinkel och avstånd, `hatchFields`, och
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
- **Gränssnittet**: `fillFields` i `drawingPanel.ts` (mönster, färg,
  vinkel, avstånd); `patternPicker` har ett val `none` (*Ingen fyllning*).
  I verktygsraden visas mönstren utan namn (CSS `.opt .pattern-pick label
  span`). `Draw2DOptions` har `kind` (`ShapeKind`), `weight`, `linetype`
  och `fill`
