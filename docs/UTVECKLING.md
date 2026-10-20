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

Före formatfrysen (pilotprojektet, 0.13, se PLAN.md) räcker det att höja
`FORMAT_VERSION` i `src/core/model.ts`. Inga nya migreringar skrivs: en fil
i ett äldre format ger meddelandet att den kommer från en äldre betaversion
(`parse` i `src/storage/format.ts`), och ett autospar som inte går att läsa
läggs åt sidan, inte bort. Migreringarna till och med format 5 ligger kvar.

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

`mountApp` i `src/ui/app.ts` bygger appen: skapar planvyn, verktygen,
panelerna och dialogerna, och har det som binder ihop dem (`setTool`,
`renderAll`, vad som visas just nu, markeringen). Resten ligger i
`src/ui/app/`, en fil per del:

| Fil | Innehåll |
| --- | --- |
| `shell.ts` | Stommen (HTML för topprad, verktygsrad, rityta och statusrad), verktygslistan `TOOLS`, `ToolId`, `ViewMode` och `createUiState` (det som visas just nu) |
| `helpers.ts` | Små hjälpare: talformat, förvalda typer och tillstånd, vybeskrivning, skala |
| `context.ts` | `AppContext`: det delarna behöver av varandra, och `lazyContext` som bygger det |
| `actions.ts` | Knapparna: klick på `data-action` och val i projektträdet, Visa-menyn och huvudmenyn; tillståndsflikarna och Jämför med |
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
  `src/ui/drawingPanel.ts`. Sedan 0.8.1 ligger resten av egenskapspanelens
  fält i `src/ui/selectionFields.ts` (HTML) och det de ändrar i
  `src/ui/selectionEdits.ts` (`applyField` för fält med `data-key`
  "omfång:namn"); `propertiesPanel.ts` har bara panelen, snabbraden och
  knapparna.

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
  skärmen), vyerna med rubrik, ramen och ritningshuvudet
  (`titleBlockPrims` i `src/repr/titleBlock.ts`). Allt är mm på papperet
  med y uppåt. Smarttext: `expandSmartText(text, smartVars(doc, sheet,
  idag))`; nya namn läggs till i `smartVars` och `SMART_TEXT`.
- **I appen**: `ui.layout` är bladet som visas och `Place` har
  `kind: 'sheet'`. `src/ui/app/sheets.ts` ritar bladet (`drawing()`), har
  verktyget som markerar och flyttar vyerna (`SheetTool`, fäster mot de
  andra vyernas kanter och mitt), lägger nya vyer på första lediga plats
  (`freeSpot`) och har högerklicksmenyn. På ett blad går bara Markera och
  Panorera; andra verktyg går tillbaka till planen. Formulären för blad och
  vyer på blad ligger i `src/ui/sheetForms.ts` (`TreeItem` har `sheet` och
  `viewport`).
- **PDF** skrivs av `writePdf` i `src/formats/pdf.ts` utan bibliotek: en sida
  per `PdfPage`, mm i primitiverna (en `cm` per sida), Helvetica med
  WinAnsi (`src/formats/helvetica.ts` har bredderna, som också används för
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
- **Ny vägg härifrån**: ett val i Modifiera-paletten (`wallOn` i
  `src/ui/modify.ts`) som inte kör ett `ModifyTool` utan väggverktyget.
  `ModifyHost.startWallFrom` (i `app.ts`) sparar väggverktygets val i
  `wallFrom`, tar den klickade väggens typ, höjd och liv, och byter till
  väggverktyget med `setTool('wall', true)` (`true`: paletten och
  markeringen ligger kvar). `WallTool.startAt` börjar kedjan i änden. Väljs
  något annat i paletten, eller stängs den, anropas `stopWall`; när första
  väggen är ritad göms paletten med `release()`. När kedjan är klar
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
