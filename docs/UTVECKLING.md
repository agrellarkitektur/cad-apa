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

Pilen går bara nedåt. `core/` importerar aldrig från något annat lager. Då går
kärnan att testa ensam och att återanvända, till exempel i en objektredigerare.

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

## Lägga till ett verktyg eller en panel

Verktyg ligger i `src/ui/tools/` och implementerar `ViewTool` från
`src/view2d/planView.ts`: de får tryck, drag och släpp i modellkoordinater och
ritar hjälpgrafik i `overlay()`. Panorering och zoom sköter planvyn själv, så
inget verktyg behöver bry sig om det. Snäpp finns i `src/ui/tools/snap.ts`.

Paneler läser `store.doc`, lyssnar med `store.subscribe` och ändrar via
kommandon. Verktyg som inte är byggda än står i verktygsfältet med den
version de kommer i (se [PLAN.md](PLAN.md)).

### Appen: `src/ui/app.ts` och `src/ui/app/`

`mountApp` i `src/ui/app.ts` bygger appen: skapar planvyn, verktygen,
panelerna och 3D-vyn, och har det som binder ihop dem (`setTool`,
`setMode`, `renderAll`, panelerna, huvudklicket). Resten ligger i
`src/ui/app/`, en fil per del:

| Fil | Innehåll |
| --- | --- |
| `shell.ts` | Stommen (HTML för topprad, verktygsrad, rityta och statusrad), verktygslistan `TOOLS`, `ToolId`, `ViewMode` och `createUiState` (det som visas just nu) |
| `helpers.ts` | Små hjälpare: talformat, förvalda typer och tillstånd, vybeskrivning, skala |
| `context.ts` | `AppContext`: det delarna behöver av varandra |
| `toolOptions.ts` | Verktygsraden under ritytan och måttbandets värden |
| `views.ts` | Vyhistorik, `goTo`, sparade vyer och menyerna för vyer och markörer |
| `showMenu.ts` | Kalkeringens utseende under Visa, och skärmskalan |
| `menus.ts` | Högerklick och långt tryck i plan, 3D och projektträdet |
| `keyboard.ts` | Kortkommandona |
| `clipboard.ts` | Kopiera, klipp ut och klistra in |

Varje del är en funktion `installX(app)` som anropas en gång i `mountApp`
och lämnar tillbaka det som andra delar använder. `app` är ett objekt med
getters, så delarna läser alltid det som gäller just då (planen och
3D-vyn byts ut). Hämta därför med `app.x` där det används, inte en gång i
början av `installX`. Behöver en del något nytt: lägg till det i
`AppContext` och som getter i `app` i `mountApp`.

En ny del av gränssnittet läggs som en egen fil här i stället för i
`app.ts`, så att filerna hålls små.

## Tester

`npm test` kör testerna i `tests/`. Varje regel som rör data ska ha ett test:
hur åtgärder räknas ut, att ångra återställer exakt, att filer läses utan
förlust. Ritregler kontrolleras genom att titta på dem.

## Rum och anteckningar

Rum som skapats med rumsverktyget sparar punkten man klickade i (`seed`).
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
  `offsetWalls`, `multiplyElements`, `mirrorAbout`). Paletten och verktyget
  som förhandsvisar och utför ligger i `src/ui/modify.ts`; Markera anropar
  `host.modify` vid klick (utan drag) på något som redan är markerat.

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
- **2D-element**: `Line2D` (`shape`: line, polyline, rect, arc, circle,
  spline) och `Fill2D` i `src/elements/drawing2d.ts`, verktyget i
  `src/ui/tools/draw2dTool.ts`. Bågar sparas start, punkt på bågen, slut.
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
  `src/ui/drawingPanel.ts`.

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
