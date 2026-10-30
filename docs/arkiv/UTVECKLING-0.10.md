# Så byggs programmet ut, arkiv: 0.10–0.10.40.1

Avsnitt om koden, flyttade hit ur [UTVECKLING.md](../UTVECKLING.md) 30 oktober
2026 (efter 0.10.40.1). Innehållet är oförändrat; det som har ändrats senare
står i nyare avsnitt (här eller i UTVECKLING.md).


## Granskning efter 0.10.40 (0.10.40.1, format 25)

Inga nya funktioner.

- **`ui/styleDialog.ts`** (1 083 → 516 rader) ritar ramen (vänsterkanten,
  rubrikraden med sök och *Vanliga/Alla*), markerar avvikelser
  (`markRows`), filtrerar (`applyFilter`), håller `place`, `chosen`,
  `viewId` och `pp`, och skickar klick och fält vidare. Den exponerar
  `store`, `book`, `chosen`, `pp`, `scope`, `commit`, `set`, `render`,
  `placeKind`, `goToPens` och `goToPlace` för delarna (som
  `CategoryHost`, `ResourceHost` och `PlacesHost`). Nya filer i
  `ui/style/`: **`categoryTab.ts`** (`categoryTabMarkup`: flikarna,
  verktygen, visningen, innehållet, underlagen, åtgärderna och pennorna;
  `StyleScope`), **`categoryEdits.ts`** (`viewAction`, `categoryAction`,
  `underlayClick`, `categoryChange`), **`placesPanel.ts`** (`placesClick`,
  `placesChange`), **`resourceEdits.ts`** (`resourceClick`,
  `resourceChange`, `pickFile`, `lineTypeUses`, `materialUsesMap`,
  `fillTypeUses`) och **`bookFile.ts`** (`askPaper`, `exportBookFile`,
  `templateDialog`, `importBookFile`).
- **`core/materials.ts`**: `materialObjectsByMaterial(doc)` går igenom
  elementen en gång och ger `Map<material, objekt[]>`; `materialObjects`
  och `materialUses` läser ur den. `placeRows` (materialen) och
  `materialUsesMap` använder den direkt. `extraFieldsOf(now, nested)` för
  släntens egna fält.
- **`core/ids.ts`**: `slugId(name, taken, fallback)`, nyckeln ur ett namn;
  `freshId` (kategorier) och `newId` (material) bygger på den.
- **`repr/penPlaces.ts`**: `frozenPens(doc, places?)` tar ställena om de
  redan är räknade; `applyEdit` i `placeEdits.ts` får `all` (projektets
  ställen) och `setPlaces`/`editPen` räknar dem en gång. `plainPen`,
  `objectTypeName` (registrets `label`), `COLOR_RANK` exporterad (places.ts
  sorterar med `penOrder`). `viewKeys` jämför med `sameValue`.
- **`repr/penRows.ts`**: `putPen(style, key, fn)` ändrar en rad i
  penntabellen utan att spara förvalet; `applyPenField` (stilboken) och
  `editPlaces` (ställena) använder den.
- **`ui/style/deviations.ts`**: `changedRows` tar stilens rader ur
  `styleDiff` (utom `openingMark`, som inte har någon rad).
- Borttaget: `placeRowExists`, `penRowShown`, `MATERIAL_USES`, `PRESETS`,
  `updateCategory`. `tests/v01032.test.ts` använder `putCategory`.

## Stilboken ut och in (0.10.40, format 25)

- **`core/styleBookFile.ts`**: `StyleBookFile` = `StyleBook` + `assets`
  (bilderna, `bookAssetIds`: logotypen och texturerna, plus bilderna på
  papperet) + `paper` (`PaperPart`: `worksheets`, `elements` med `space`
  i dem, `master` = projektets förvalda om det är med). `exportBook(doc,
  { masters, stamps })`; stämplar som ligger på det som tas med följer
  med. `readBookFile(data, base?, styleTo?)` ger `ReadBook` (`book` via
  `normalizeBook`, `assets`, `paper`); `paperInFile` räknar.
  `importBook(store, read, choice, label, replaceMaster?)` i en
  transaktion: `putAssets` (samma innehåll återanvänds, upptaget id får
  nytt), `remap` byter id:n djupt (bilder, arbetsblad, element), elementen
  får `storey = doc.storeys[0]`, `relinkLogos` och `pruneAssets` på
  stilbokens gamla bilder. `applyTemplate` = import med allt och
  `replaceMaster` (exemplets mallblad tas bort om inget blad använder det).
- **`core/office.ts`**: `relinkLogos(tx, logo)` (ur `setOfficeLogo`).
  `pruneAssets` räknar kontorets logotyp som använd.
- **Mallen**: `saveTemplate`, `loadTemplate`, `clearTemplate` i
  `storage/localStore.ts` (nyckeln `stilboksmall` i samma IndexedDB som
  autosparet; `TemplateRecord` = `text`, `name`, `savedAt`).
- **UI**: stilbokens rubrikrad (`.sb-file`: `save-style`, `open-style`,
  `template-style`), `askPaper` och `template` i `StyleDialog`, `askChecks`
  i `ui/ask.ts` (kryssrutor och en extra knapp). `NewProjectDialog.open`
  är asynkron (läser mallen); gruppen `book` (`template`, `standard`,
  `file`). Höjdkurvors *Nytt projekt* (`ui/app/site.ts`) tar mallen.
- Tester: `tests/v01040.test.ts`.

## Projektet › Allmänt (0.10.39, format 25)

- **`core/general.ts`**: `OfficeInfo` (`StyleResources.office`: fälten i
  `OFFICE_TAGS` med taggarna, `logo` = `{ asset, width, height }`, egna
  `tags`) och `GeneralSettings` (`StyleResources.general`: `textSize`,
  `heightSystem`, `levelDecimals`, `groundDecimals`, `litteraDigits`,
  `lengthUnit`, `areaDecimals`, `weights`). `generalOf(book, site)` ger
  det som gäller: stilbokens, annars Platsens gamla `ground.levelDecimals`,
  `ground.litteraDigits` och `crs.height`, annars `GENERAL_DEFAULTS`;
  `docGeneral(doc)` är samma för ett dokument. `normalizeOffice` och
  `normalizeGeneral` i `normalizeStyle`. Talen: `lengthText`, `areaText`,
  `signedLevel`.
- **Läsarna**: `dimensionPrims` (`style.general.lengthUnit`),
  `formatArea(m2, decimals)` i rummen och litterat, `levelText` i
  `repr/terrain.ts` (nivåmarkörerna), `groundLevelText(doc, z)` och
  `litteraText(doc, …)` i `core/site.ts` (tar nu dokumentet, inte
  platsen), `TextTool.height` (null = stilbokens), `weightPicker` och
  listorna via `setWeightSource` / `currentWeights` i `ui/weightPick.ts`
  (sätts i `app.ts`).
- **Smarttexten**: `smartVars` lägger `officeVars(doc.graphics.office)`
  under bladets och projektets fält; ett kontorsfält som de lämnat tomt
  tar kontorets värde. Nya inbyggda: `projektnummer` (fältet
  `uppdragsnummer`) och `höjdsystem`. `fieldsOf` hoppar över kontorets
  taggar (`officeTagKeys`) som projektet inte har som fält.
- **`core/office.ts`**: `setOfficeLogo` (bilden som fil; logotyperna på
  papperet får den nya bilden lika bred, den gamla filen tas bort om inget
  använder den), `setProjectField`, `removeProjectField`,
  `setProjectPhase` (via `applyFieldChanges` med `shared`) och
  `placeLogo` (ett `Underlay` med `logo: true`).
- **Dialogen**: `ui/style/general.ts` (`generalMarkup`, `generalChange`,
  `generalClick`; fälten `data-gen`, knapparna `data-gen-action`).
  Stilbokens ändringar går genom dialogens `set` (med `withFrozenPens`).
  Menyraden *Lägg in logotypen här* i `ui/app/logo.ts` (bladets meny i
  `sheets.ts`, mallbladens och stämplarnas i `menus.ts`).
- Tester: `tests/v01039.test.ts`.

## Snitt- och konturlinjer i fasader och sektioner (0.10.38, format 25)

- **Raderna** (`repr/facadePens.ts`): `FACADE_PENS` har nycklar per
  objekt (`wallElev`, `wallHoleElev`, `doorFrameElev` …, `slabElev`,
  `otherElev`) med `group` (planens grupper) och `part` (delen i 3D).
  `facadeRowOf(part, objectType)` ger raden: dörrens delar dörrens rader,
  andra öppningars fönstrets, linjer utan del bjälklagets eller Övrigt.
  `facadePen(style, key)` läser raden.
- **Rader per vytyp** (`repr/penRows.ts`): `PenRow.types` (valfri);
  `penGroupsFor(type)` filtrerar raderna och tar bort tomma grupper, och
  `penRowShown(key, type)` ersätter gruppkollen i `placeRowExists`.
  `objectRows(group)` ger planens rader (snittlinjerna `storey` och
  `section`, resten `storey`) och fasadens (`facade`, `section`).
- **Snittet i sektionen** (`section.ts`): grupperna har nyckeln
  `åtgärd|p|material|snittlinje` (`cutRowPen` som JSON), och
  `objectType` på `origin` för regionerna och `asOutline`-linjerna, så att
  `applyStyle` hittar raden. `materialCutPrims(…, false, true)` och
  `asOutline`-linjerna genom `applyStyle`; med egna pennor tas de bort och
  ritas per objekt som förut.
- **`applyStyle(p, s, action, sheet, scale)`** har ingen `plan`-flagga:
  snittlinjen och jämförelsens färg gäller i alla vyer. Åtgärdens
  `cutOutline.weight` läses inte längre (kvar i formatet).
- **Ställena**: `outline.<åtgärd>` har ingen `pen` (bara `linetype`), och
  `setPenEdit` har ingen gren för dem.
- Tester: `tests/v01038.test.ts`. Referensritningarna ändrades inte.

## Snitt- och konturlinjer i planen (0.10.37, format 25)

- **Raderna** (`repr/objectPens.ts`): `OBJECT_PENS` (nyckel, grupp,
  förval, taggar) ersätter `OPENING_PENS` (`openingPens.ts` är borta);
  `objectPen(style, key)` läser raden med förvalets färg
  (`defaultedPen`), `cutRowOf(objectType)` och `cutRowPen(style, type)`
  ger snittlinjen, och `SYMBOL_PARTS` ligger här. Grupperna `walls`,
  `doors`, `windows` och `objects` i `PEN_GROUPS` (rummens rad,
  `roomOutline`, står i `objects`). Dörrar och fönster läser sina rader i
  `door.ts` och `window.ts`; möblerna `furniture`/`furnitureFixed`.
- **Snittlinjen**: `applyStyle(p, s, action, sheet, scale, plan)`; planen
  skickar `plan = true` (sektionerna inte, tills 0.10.38). Med `plan` ger
  `cutPen` en region eller en `asOutline`-linje radens tjocklek, och färg
  och streckning efter jämförelsen; åtgärdens färg går före en färgad
  rad på övriga linjer när jämförelsen är på (`compared`).
  `materialCutPrims(…, plan)` ritar i planen konturen som `asOutline`
  efter mönstret.
- **Under fönstret**: linjerna har `origin` = värdväggen (`objectType`
  `Wall`, delen `under`), så att `ownPenOf` ger väggens penna.
- **Den egna pennans symbol**: `applyOwnPen` tar `{ ...pen, ...pen.symbol }`
  för `SYMBOL_PARTS`; fälten säger *Snittets* när den övre har fältet.
- **Egna pennor som ställen** (`penPlaces.ts`): `PlaceWhere` har `def` och
  `object`; nycklarna `own.<main|symbol|above>` och `mpen` (materialets
  kontur). `stylePlaces` tar `PlacesDoc` (med `definitions` och `storeys`
  om de finns). `editPlaces` svarar också med `definitions` och
  `elements`, som `applyEdit` lägger i transaktionen; `PlaceEdit.own`
  ändrar en del (`setPenEdit`, `setLineTypeEdit`). *Gå dit*
  (`goToObject(ids)`) tar ett id eller flera.
- Tester: `tests/v01037.test.ts`. Referensritningarna ändrades av linjerna
  under fönstren (väggens id) och en dörr med egen färg (slagbågen följer).

## Pennor och ställen (0.10.36, format 25)

- **Pennraderna** (`repr/penRows.ts`): `PEN_GROUPS` samlar penntabellens
  rader i grupper med `types` (vytyperna där gruppen visas), `rare`
  (*Vanliga*) och `tags` per rad; `penGroupsFor(type)`, `penRowOf(key)`
  och `penDefault(key)` (förut `defaultPen` i `ui/style/pens.ts`). En ny
  rad i penntabellen läggs i sin lista (`MARKER_PENS`, `FACADE_PENS` …)
  och får taggar här. `penSection(style, type, info)` ritar gruppen för
  vytypen; `info` ger pennans nummer framför raden.
- **Fasadernas linjer** (`repr/facadePens.ts`): `FACADE_PENS` (förut
  `PART_PEN` i `section.ts`); per objekt sedan 0.10.38 (se där).
- **Pennlistan** är `StyleResources.penList` (`NumberedPen`: `no`,
  `weight`, `color`; svart utan färg), läst med `normalizePenList`.
  Ställena har kvar sina värden; ett ställe hör till pennan med samma
  `penKey` (tjocklek och färg).
- **Ställena** (`repr/penPlaces.ts`): `stylePlaces(doc)` ger
  `StylePlace` (`id` = `var|nyckel`, `where` = kategori, vy eller
  material, `key` = `pens.<k>`, `outline.<åtgärd>`, `fill.<åtgärd>` eller
  `mfill.<plan|cut|surface>`, `viewTags`, `tags`, `pen`, `linetype`,
  `fillType`). En vy ger bara de nycklar den verkligen avviker på
  (`viewKeys`). `penTable(book, places)` ger pennorna med sina ställen:
  de sparade först, sedan de som saknas, numrerade efter `penOrder`.
  `withFrozenPens(doc)` sparar listan; `StyleDialog.set` och `commit` gör
  det vid varje ändring. `editPlaces(doc, places, edit)` ändrar varje
  kategori och vy en gång (vyns avvikelser räknas om med
  `overridesFrom`) och materialen; `setPenEdit`, `setLineTypeEdit` och
  `setFillTypeEdit` är ändringarna. Penntabellens förval sparas inte
  (`putPenRow`, som `applyPenField`).
- **Gränssnittet**: `ui/style/places.ts` (`penListMarkup`,
  `placesMarkup`, `placesSection`, `placeRows`, `rowMatches`; materialens
  rader är objekten, `materialObjects` i `core/materials.ts`) och
  `ui/style/placeEdits.ts` (`setPlaces`, `editPen`, `addPen`,
  `removePens`; objekten med ett ändrat material får fyllningen med
  `relinked`). I `StyleDialog`: resursen `pens`, `placesClick`,
  `placesChange`, `goToPlace` (sätter `flash`, raden som rullas fram och
  blinkar efter omritningen) och `goToObject` (sätts i `installViews`).
  Listornas egna listor har `rc-native` (ingen radkontroll).
- **Sorteringen** (`ui/tableSort.ts`, `installTableSort` i `main.ts`):
  ett klick på en `thead th` med text sorterar tabellen efter cellernas
  `data-sort` eller text (`compareCells`); sorteringen sparas per
  `data-table` (annars klassen) och läggs på igen av en
  `MutationObserver` när tabellen ritas om. En ny tabell behöver inget
  mer; ge den `data-table` om flera tabeller har samma klass.
- Stilarna i `styles/pennor.css`. Tester: `tests/v01036.test.ts`.

## Underlag i vyn (0.10.35, format 25)

- **Modellen** (`core/viewUnderlays.ts`): `ViewUnderlay` = `source`,
  `above`, `look` (`tinted` utelämnat, `gray`, `outline`, `color`),
  `color`, `opacity` (procent, utelämnad = 40). `CategoryShow.underlays`
  (valfritt); vyns avvikelse `underlays` är hela listan (`resolveShow`,
  `showOverrides`, jämförd med `sameValue`). `normalizeUnderlays` läser
  från fil; `toggleUnderlay` lägger till eller tar bort en källa
  (Kalkera). Vyns gamla `trace` läses som `overrides.underlays` i
  `storage/format.ts` (`traceAsUnderlay`); `ViewDef.trace` finns inte längre.
- **Källorna** (`core/underlaySources.ts`): `source` är en vys id,
  `arbetsblad:<id>`, `ortofoto` eller kalkeringens våningsvärden
  (`våning:under`, `våning:över`, `våning:platsen`, `våning:id:<id>`).
  `resolveSource(doc, host, source)` med `UnderlayHost` (`storey`, `plan`,
  `viewId`) ger vad det är, eller null (finns inte, eller inte här: inga
  våningar och inget ortofoto i fasader, sektioner och arbetsblad, och
  vyn själv aldrig). `sourceName` ger namnet.
- **Ritningen** (`repr/viewUnderlays.ts`): `viewUnderlayPrims(doc, list,
  base)` ger `{ under, over }`; `sourcePrims` ritar källan (en våning med
  `buildPlan` och vyns inställningar utan markörer och norrpil, ett
  arbetsblad med `place`, en vy med `base.viewPrims` utan dess egna
  underlag, ortofotot som en `ImagePrim` från `orthoPrim`). `lookPrims`
  ger utseendet: täckningen multipliceras in i pennor, fyllningar,
  bakgrunder och bilder, `grayOf` för gråskala, `outline` tar bort
  fyllningarna, `above` tar bort vita fyllningar och bakgrunder. Ursprunget
  blir `{ objectType: 'ViewUnderlay', part: 'under' | 'över' }`, utan
  objektets id (de är inte bland det som går att markera, men snäppningen läser dem).
- **Bladet** (`repr/sheet.ts`): `buildViewPrims(doc, v, opt, bare)` lägger
  vyns underlag runt det ritade (inte när `bare`); `cachedViewPrims` har
  `bare` i nyckeln. `isBackdrop` (filunderlag och underlag i vyn) räknas
  inte i `contentBounds`, och `layered` i `placeView` och `buildViewPage`
  klipper dem mot ramen: underlagen under, det ritade, och de som ligger
  över. `legendSources` ser dem inte (inget objektets id).
- **Appen**: `ui.underlays` är listan under Visa (`applyShow` och
  `currentShow` i `render.ts`, så att *Spara i vyn*, ändrad vy och
  stilbokens följning går som för den andra visningen). `renderAll`
  ritar dem med `viewUnderlayPrims` (vyer med `cachedViewPrims(..., true)`)
  och lämnar dem till `PlanView.setUnderlay(under, over)`, som ritar två
  egna grupper (`.underlay` och `.underlay.above`) och ger dem till
  snäppningen (`underlayPrimitives`). `setUnderlayLook` och
  `uiSettings.trace` finns inte längre.
- **Raderna** (`ui/underlayRows.ts`): `underlayRowsMarkup` (fälten har
  `data-ul` och `data-ul-field`), `editUnderlays(list, el)`,
  `underlaySourceItems` (menyns rader) och `underlayAddSelect` (samma som
  en lista, i stilboken). Visa-menyn (`showMenu.ts`) öppnar menyn vid
  `[data-ul-add]` och ritar om Visa efter klicket (`setTimeout`, eftersom
  ett klick utanför `.show-wrap` stänger den). Klicket på en kryssruta
  under Visa gäller bara `[data-show]` och `[data-show-group]`.
  Stilboken (`underlayMarkup` i `styleDialog.ts`) har raden
  `underlays` i `changedRows`/`resetRow` (`[data-cat-underlays]`).
- **Kalkera** (`views.toggleUnderlaySource`): vyns meny i projektträdet
  och våningens och Platsens *Kalkera …* (`traceItem` i `storeys.ts`).
  Projektträdet visar *underlag* vid en vy som ligger som underlag
  (`host.traced`).
- **Marken i 3D**: Innehållets nyckel `terrain3d` (Platsens grupp);
  `pane3d.ts` ritar ingen mark när den är dold.
- Tester: `tests/v01035.test.ts`.

## Radkontrollerna (0.10.34, format 25)

- **`ui/style/rowControls.ts`**: `enhanceRowControls(root, opts)` körs i
  `StyleDialog.render` efter `markRows`. Den döljer fälten (`.rc-src`,
  `hidden`) och lägger en knapp `.rc-val` efter dem: `select` → textval
  (`.rc-text`), eller linjetyp (`.rc-line`) när något val har `data-dash`
  (`lineTypeOptions` sätter det); `input[type=color]` → `.rc-color`;
  `details.weight-pick` → `.rc-weight`. En lista med klassen `rc-native`
  får ingen knapp. Knappen skriver i fältet och skickar `change`
  (`commit`), så `onChange` och `apply…Field` är som förut. Ett eget
  värde i tjockleken blir en radioknapp till med samma attribut.
- **Opacitet** i färgpanelen: ett `input.rc-alpha` (dolt) i samma förälder
  som färgfältet; panelen skickar `change` på det för sig. Åtgärdernas
  fyllning och bakgrund har det (`opacity`, `bgOpacity`).
- **Panelen** (`Popover`, en åt gången, skapas först när den behövs)
  ligger i `body` och hittar sitt fält med en nyckel ur fältets
  data-attribut (`keyOf`), så att färgpanelen kan vara kvar när dialogen
  ritas om efter en ändring (`reattach`); de andra stängs. Ett drag i
  färgfältet förhandsvisar och sätter färgen när knappen släpps.
  `hexToHsv` och `hsvToHex` i `ui/style/colors.ts`.
- **Favoritseten** är `StyleResources.colorSets` (`ColorSet`: `name`,
  `colors` som `#rrggbb`), läst med `normalizeColorSets` i
  `normalizeStyle`. Dialogen ger panelen `colorSets`, `setColorSets` och
  `addLineType` (`RowControlOptions`).
- **Innehåll**: `label.check.sb-tog` med kryssrutan dold och symbolen ur
  `contentIcon(key, group)` (`ui/style/contentIcons.ts`).
- **Sök och Vanliga/Alla**: `StyleDialog.applyFilter` sätter `.sb-miss` på
  raderna (`FILTER_ROWS`) och delarna som inte träffar, och `.sb-common` på
  `.sb-main`; under den döljer CSS `.sb-rare` som inte har `.sb-changed`.
  Sällan ändrat: `RARE_CONTENT` och delen *Snittet i planen* i `pens.ts`.
- Stilarna i `styles/radkontroller.css` (sist i `app.css`).
- Tester: `tests/v01034.test.ts`.

## Avvikelser och kategorier i vyn (0.10.33, format 25)

- **En vys stil** är `effectiveCategory(cat, v.overrides)`: kategorin med
  vyns visning och stil. Det som ändras räknas om till avvikelser med
  `overridesFrom(cat, cur)` (`showOverrides` och `styleDiff`, som jämför
  åtgärderna och pennorna med `sameValue`, JSON med nycklarna sorterade).
  `deviationCount(doc, v)` räknar de rader vyn verkligen avviker på (en
  sparad avvikelse som kategorin hunnit få räknas inte); den ger punkten i
  projektträdet och listan i stilboken.
- `viewToCategoryDefault(doc, id)` och `viewToNewCategory(doc, id, name)`
  svarar med stilboken och vyerna; `resetViewOverrides(views, id)` tar bort
  en vys avvikelser. `categoryDefault(c)` är kategorins förval (samma som
  `resetCategory`). `editStyle(book, style, fn)` ändrar en stil och
  resurserna med en stilmallsfunktion (`editCategory` använder den);
  `putCategory` byter en kategori efter nyckel och vytyp.
- **Raderna** (`ui/style/deviations.ts`): `changedRows(ref, cur, extra,
  withCategoryRows)` ger radnycklarna `show:<k>`, `item:<k>` (kryssen
  under Innehåll, jämförda med `isShown`), `actions.<k>`, `pens.<k>`,
  `scale`, `kind`; `resetRow` lägger tillbaka en rad, `rowSelector` hittar
  fältet. Dialogen (`StyleDialog.markRows`) sätter `.sb-changed` och
  `.sb-mark` på raden efter varje omritning; `.only-changed` på `.sb-main`
  döljer resten med CSS (`:has`).
- **Dialogen** har `viewId` (vyläge, `open({ view })`) och `scope(type)`:
  `{ cat, ref, cur, view? }`. Alla fält går genom `commit(type, cur,
  label, book?)`, som skriver kategorin (`putCategory`) eller vyns
  avvikelser i samma transaktion som resurserna. `goToView` sätts i
  `installViews`.
- **Appen**: `syncOpenView` i `render.ts` följer den öppna vyn när den
  ändras utan att man går dit: ny kategori ger dess visning, och ändrade
  rader i visningens avvikelser läggs i Visa (de andra raderna, ändrade
  under Visa men inte sparade, är kvar). `newViewItems(place)` i
  `views.ts` ger *Ny vy*-raderna i våningens, fasadens och sektionens meny;
  `newViewOf(place, category?)`.
- **Ortofoto** bland markobjektens material: `ORTHO_CHOICE`
  (`'@ortofoto'`) i `fillPanel.ts` (`ctx.ortho`), `linkOrtho` i
  `core/materials.ts` sätter `ortho3d: true` (i `LINK_FIELDS`, så att ett
  material eller *Eget* tar bort det); `colorShapes` ger ytan markens
  utseende (`color: ''`), som blir ortofotot.
- Tester: `tests/v01033.test.ts`.

## Stilboken: tre nivåer med arv (0.10.32, format 25)

- **`ProjectDoc.graphics` är en `StyleBook`** (`format: 'bacchus-stylebook'`):
  resurserna (`StyleResources`: `name`, `labels`, `font`, `lineTypes`,
  `fillTypes`, `materials`) och `categories` (`ViewCategory[]` i
  `core/viewCategories.ts`). `StyleSheet` finns kvar som det en vy ritas
  med (resurserna plus `CategoryStyle`: `actions`, `openingMark`, `pens`),
  så renderarna (`ctx.style`) är som förut. Funktioner som bara läser
  resurserna tar `StyleResources` (material, fyllningar, linjetyper,
  panelernas listor), så att `doc.graphics` går att skicka direkt.
- **En kategori** har `id` (unik inom vytypen), `name`, `type` (`site`,
  `storey`, `facade`, `section`, `worksheet`), `kind` (Platsens: hur
  materialen ritas, det som förut var vyns `category`), `scale` (för nya
  vyer), `show` (`CategoryShow`: `compare`, de tre detaljnivåerna, `hide`,
  `hideDemolished`) och `style`. `defaultCategories()` är ett nytt
  projekts; exempelvillan har också *Skiss* (Poché).
- **Vyn** har `category` (nyckeln; saknas eller fel vytyp = vytypens
  första, `categoryOf`) och `overrides` (`ViewOverrides`), en platt
  tabell med en rad per avvikelse: `compare`, `detail`, `labelDetail`,
  `modelDetail`, `hideDemolished`, `hide:<nyckel>` (sant/falskt),
  `actions.<åtgärd>`, `openingMark`, `pens.<nyckel>` (null = förvalet).
  `compare`, `detail`, `hide` …, `style` på vyn finns inte längre.
  `viewSettings(doc, v)` ger `cat`, `show` (`resolveShow`), `kind`,
  `style` (`sheetFor`) och `type` (`viewTypeOf`: arbetsblad, fasad eller
  sektion efter markören, Platsen, annars våning).
- **`sheetFor(book, cat, overrides)`** är cachad per stilbok, kategori och
  stilens avvikelser, så att planens cache träffar. `defaultSheet(book,
  type)` är vytypens första kategoris, för det som ritas utan vy
  (panelernas förhandsvisningar, 3D-marken, `buildPlan` utan stil).
- **I appen** ersätter `ui.category` (null = vytypens första) och
  `ui.viewType` stilmallsnamnet. `render.ts` har `currentCategory`,
  `currentStyle`, `currentShow`, `applyShow`, `openView` och `viewType`
  (i `app.place`). `syncCategory` i `renderAll`: byts vytypen utan att en
  vy öppnas får Visa kategorins visning; ändras kategorin i stilboken
  följer visningen med och det som ändrats under Visa är kvar
  (`showOverrides` mot den gamla, `resolveShow` mot den nya). *Spara i
  vyn* sparar kategorin och det som avviker (`withShow`, stilens rader
  kvar). Visa-menyns *Vykategori* byter kategori och visning.
- **Dialogen** (`ui/styleDialog.ts`): vänsterkanten (`VIEW_TYPES`, tonade
  vytyper utan `type`), flikarna och verktygen (`newCategory`,
  `duplicateCategory`, `renameCategory`, `copyCategoryFrom`,
  `resetCategory`, `moveCategory`, `deleteCategory` som också tar
  kategorin från vyerna). Stilens fält går genom `editCategory(book, cat,
  fn)`, som ger `fn` kategorins stilmall och skriver tillbaka stilen och
  resurserna; delarna i `ui/style/` är oförändrade. Markörernas penna i
  egenskaperna ändras i alla kategorier (`editAllCategories`).
  `bookWithSheet` lägger en stilmall i alla kategorier (proven).
- **Fil**: `normalizeBook` läser en stilbok, och en stilmall från före
  0.10.32 (resurserna, och stilen till den valda kategorin).
- Tester: `tests/v01032.test.ts`.

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
  (`fillPrims`), snittet med materialets snitt, konturen med
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
  `without`). `surfacePrims` ritar ytorna först, under linjerna.
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
  (`withProjectParts` togs bort i 0.10.32: stilboken, se *Stilboken*.)
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
| `src/repr/section.ts` | `pushSeg` delar kanterna vid `fr.tone` (`far` i `EdgeKey`, ritas med `FAR_PEN`); de dolda linjerna (`hiddenSegs`, `HIDDEN_PEN`, part `dold`) bara i fasader |
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
