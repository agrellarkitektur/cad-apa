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
