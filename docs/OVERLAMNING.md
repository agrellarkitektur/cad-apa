# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 20 oktober 2026, efter 0.8.6.

## Läget

- **0.8.6 är klar** på `main`, filformatet är **6**. Det som gjordes står i
  PLAN.md under *0.8.6*, i README och i UTVECKLING.md under
  *Ritningshuvudet som eget objekt (0.8.6, format 6)*:
  - Nya blad är blanka med ram (`Sheet.frame`, kryssruta). Huvudet är en sak
    på bladet (`Sheet.items`, `TitleBlockItem`), läggs på från en lista,
    markeras, flyttas (dra, eller Flytta med två klick från smartmenyn och
    Modifiera-raden), tas bort med Delete. Flera huvuden per blad.
  - Huvudets egenskaper har fälten; ritningens sparas på bladet, projektets
    för alla blad. Kryssrutan *Nya blad får ritningshuvud*
    (`uiSettings.newSheetTitleBlock`).
  - Smartmenyn kan visa egna knappar (`SmartMenu.showCustom`), som bladets
    vyer och huvuden använder.
  - `feedback.php` sätter kuvertavsändaren (`-f`).
  - Migreringarna till format 5 är borttagna (döda med format 6).
  - Kontrollerat i Chrome med Playwright mot `dist/`; inga nya kända fel.
    `tests/prestanda.test.ts` fallerar i sandlådan (312 väggar, ca 1,7–1,9 s
    mot gränsen 1,6 s), men lika mycket på 0.8.5: maskinen har två kärnor.
    Kör det på en snabbare dator om det behövs.
- **Planen** (20 oktober): 0.8.7 text på bladet och vyernas ram (beskärning
  och återställ till innehållet, *nytt format*), 0.8.8 fler Modifiera-verktyg
  med kortkommandona och Avrunda/Fasa för hela markeringen, 0.8.9
  granskning, sedan 0.9 flera våningsplan (med felet om golvnivån i 3D),
  0.10 tak (med tak ovanför snittet punktstreckade), 0.11 trappor, 0.12
  export och 0.13 piloten med formatfrys.
- **Ord:** *palett* och *snabbmeny* betyder samma sak för honom. Säg bara
  **smartmeny**.
- **Bakåtkompatibilitet:** inga migreringar före formatfrysen (0.13). Höj
  `FORMAT_VERSION` när formatet ändras; äldre filer får ett meddelande om
  att de kommer från en äldre betaversion (`parse` i `src/storage/format.ts`).
- **Telefonen är inget mål.** Testa på dator (Chrome).
- Arbetssätt: Carl August testar varje version på webbhotellet via en
  release på GitHub, som han gör själv. Ingen demo och ingen zip om han inte
  ber om det. Säg alltid hur stora föreslagna ändringar är och om de
  riskerar att behöva mer än en session (CLAUDE.md).
- **Synpunkter:** Carl August samlar dem i `cad-apa-synpunkter.md`
  (projektets kunskapsbas), med rubrikerna Inkorg, Planerat per version,
  Parkerat och Avfärdat. Läs den vid sessionsstart (med Projects-verktyget,
  `project_read`). Sortera Inkorgen tillsammans med honom: föreslå version
  för varje punkt och säg om något är för stort för en session. Ta bort
  hanterade punkter när de görs; behåll Avfärdat med anledning. Han kan
  också klistra in synpunkter i chatten; för in dem i filen när sorteringen
  är godkänd. Han hittar inte hur man öppnar filen i kunskapsbasen och kan
  lägga in synpunkter via en annan, billigare chatt. Punkterna under 0.8.6 i
  filen är gjorda och tas bort vid nästa sortering.

## Nästa session: 0.8.7 Text på bladet och vyernas ram

Börja med att läsa `cad-apa-synpunkter.md` och sortera Inkorgen.

PLAN.md under *0.8.7* (*nytt format*: höj `FORMAT_VERSION` till 7).

- **Text på bladet**: ett nytt slag i `SheetItem` (`kind: 'text'`), med läge
  i mm på papperet. Flytt, borttagning och smartmenyn finns redan för saker
  på bladet (`moveOnSheet`, `removeFromSheet`, `menuFor` i
  `src/ui/app/sheets.ts`; `itemBounds` i `src/repr/sheet.ts` behöver räkna
  textens yta). Textverktyget (`TextTool`) arbetar i modellen och
  `ui.layout` stänger av andra verktyg än Markera och Panorera på blad
  (`setTool` i `app.ts`), så det måste tillåtas på blad och skriva till
  bladet. Smarttext (`expandSmartText`) bör fungera i texterna.
  Bestäm med Carl August: textstilar/höjder och om texten ska kunna
  redigeras direkt på bladet som i planen (`textEdit`).
- **Vyernas ram**: `Viewport.crop?: Bounds` (mm på papperet eller i
  modellen; i modellen följer ramen med när skalan byts, föreslå det).
  Grepp i ramens kanter och hörn i `SheetTool`, klippning med `clipPrims`
  (görs redan för underlag mot ramen i `placeView`), och *Återställ ramen
  till innehållet* i smartmenyn och vyns egenskaper.
- Storlek: mellanstor till stor. Texten först; blir det trångt flyttas ramen
  till en egen småversion.

## Att fråga Carl August om

- **Synpunktsformuläret**: kommer breven fram till Gmail nu, efter `-f`?
  Annars: prova att sätta Gmail-adressen direkt som `to` i
  `feedback-config.php`. Kommer de fram då är det vidarebefordran från
  Loopia som stoppar dem.
- **Ritningshuvudet efter provning**: att det fäster mot ramen och vyerna,
  Flytta med två klick, och om fälten känns rätt fördelade mellan *Den här
  ritningen* och *Alla ritningar i projektet*. BH90 är den enda mallen;
  BEAst ligger efter piloten.
- **Fler Modifiera-verktyg (0.8.8)**: förslagen i PLAN.md (Trimma,
  Hörnskarv, Dela, Justera och Fördela, Hämta och överför inställningar,
  Skala) är Claudes egna, efter motsvarande program. Stäm av vilka han vill
  ha, och listan med kortkommandon, innan 0.8.8 börjar.
- **Smartmenyn efter provning**: placeringen (höger, vänster, under, över
  det markerade), att den syns vid markering med ruta, och om rubriken
  *Ändra* i Modifiera-raden ska heta något annat.
- **Granskningen** ligger som 0.8.9. Förra var 0.8.1, så den kan läggas
  efter 0.8.7 om han vill.

### Från 0.8.0

- **Hur bladet och huvudet ser ut** när han provat: fältens ordning och
  storlek i BH90-huvudet är gjorda efter hur huvudet brukar se ut, inte
  efter standardtexten. Vill han ha något annat i huvudet (t.ex. ritad av
  och granskad som initialer, eller fler rader för ändringar)?
- **Typsnittet i PDF:en** är Helvetica, medan skärmen visar appens typsnitt.
  Bredderna skiljer något. Att bädda in ett eget typsnitt ligger efter
  piloten.
- Modellvyer på blad ritas med förslaget jämfört med befintligt. Sparade
  vyer ritas med sina egna inställningar.

## Öppna frågor och kända begränsningar

- **Synpunkter på webbhotellet:** formuläret skickar (sedan 0.8.2) och
  breven kommer fram till webbposten hos Loopia, men nådde inte Gmail.
  0.8.6 sätter kuvertavsändaren; se *Att fråga Carl August om*.
- **Följ sektionen** klipper 3D, men caps (snittytorna) saknas medan en stor
  sektion räknas i tråden.
- **2D på arbetsblad följer tillstånden** som 2D i planen. Fråga om
  arbetsblad ska vara oberoende av tillstånd.
- På ett blad visar statusraden fortfarande Skärm och Rutnät, fast
  rutnätet är dolt. Mappars kryssrutor i Plot/export visar inte läget
  "delvis ikryssat" tydligt med appens kryssrutestil.
- Taksprånget ändras lika på båda sidor av ett sadeltak; riktiga tak med
  takfot per kant kommer i 0.10.
- Spegla vänder inte bilden i ett underlag, bara läget.
- DXF: skraffering ritar streckade mönsterlinjer heldragna och solid
  fyllning som en ton (färgerna i DXF läses inte). Bilder och externa
  referenser efter pilotprojektet. Vektorsnäpp mot PDF avvaktar.
- **En flyttad vägg** räknar fortfarande om sammanslagningen av alla
  väggytor på våningen (`union` i väggarnas `planBatch` och i rummens hål),
  0,2 s för 684 väggar. Ett nytt rumsnamn räknar om rum och dörrar (0,08 s).
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

## Arbeta i miljön

- Repot är `agrellarkitektur/cad-apa`. Bygga och testa: se CLAUDE.md.
  Commit avslutas med raderna som sessionen anger (Co-Authored-By och, om
  sessionen har en, Claude-Session), sedan `git fetch origin main` och
  `git push origin HEAD:main`. Releaser på GitHub gör Carl August själv.
- Titta på resultatet: `npm run build`, servera `dist/` med
  `python3 -m http.server 8765` och styr med Playwright (Python). Det är
  samma bygge som hamnar på webbhotellet. `window.bacchus` har `store`,
  `view`, `selection`, `ui`, `modifier`, `smartMenu`, `view3d`, `plan`, `sheets`,
  `plot`, `setTool`, `setMode` och `goTo` (t.ex.
  `goTo({kind:'marker', id:'sektion-a'})`, `goTo({kind:'sheet', id})`).
  `bacchus.sheets.pick({kind:'viewport', id})` eller
  `pick({kind:'titleBlock', id})` väljer en vy eller ett huvud på bladet;
  `bacchus.sheets.drawing()` har `views` och `items` med ytorna på
  papperet, `pickedThing()`, `startMove()` och `newSheet()` finns också. Filer läggs in med `page.expect_file_chooser()` runt ett
  klick på *Lägg in underlag…* eller *Välj logga…*. Ritningen ligger i
  `.plan-drawing .content` (0.8.3), markeringen i `svg.plan .highlight`.
  `bacchus.view.redraw()` ritar om ritningen. Egenskapspanelen är
  `aside.panel[aria-label="Egenskaper"]` (projektträdet har också en
  `.panel-body`).
- Plot/export i Playwright: sätt `window.showSaveFilePicker = undefined` med
  `add_init_script`, så sparas zipfilen som en nedladdning
  (`page.expect_download()`). Kontrollera PDF:erna med `qpdf --check` och
  `pdftoppm -png`. Sandlådans ersättning för Helvetica saknar ² (m² ser ut
  som m i bilderna), men texten i filen är rätt (`pdftotext`).
- **Jämföra före och efter** (så gjordes granskningen): bygg den gamla
  versionen i en egen arbetskopia (`git worktree add <mapp> <commit>`, länka
  in `node_modules`, `npx vite build --outDir <mapp>`), kör samma klick i
  båda byggena och jämför läget efter varje steg. Byt
  `crypto.getRandomValues` mot en fast följd i `add_init_script`, så att nya
  id blir desamma. Skript utan webbläsare buntas snabbast med
  `npx rolldown skript.mts --file skript.mjs --format esm --platform node`
  och körs med `node` (tsx lägger till `__name` som syns i profiler).
- Demon bara på begäran: `npm run preview:artifact`, läs artefakten
  (https://claude.ai/artifact/2m7gq5gkkgSP2wFZ7fLGNJ, Artifact `read`) och
  publicera `artifact/cad-apa.html` till samma URL.
- Stoppa servern med `pgrep -af "http.server 8765"` och `kill`, inte
  `pkill -f` (det stänger skalet).
- Testfiler att lägga in går snabbt att göra med reportlab (PDF), PIL
  (bild) och några rader text (DXF). Riktiga DXF med skraffering, block och
  bågar gör ezdxf (`pip install --break-system-packages ezdxf`), som också
  ger facit för konturerna (`ezdxf.path.from_hatch_boundary_path`).
- Mäta i webbläsaren: hela bildrutan, från `page.mouse.move` till två
  `requestAnimationFrame`, jämfört med ett tomt varv; att bara mäta
  JavaScript missar webbläsarens målning, som var det dyra vid panorering.
- Fasader, sektioner och blad utan webbläsare: ett skript med
  `registerBuiltInTypes()` från `src/elements` först, sedan `buildSection`
  eller `buildSheet` och `writePdf`. Stora projekt att mäta på: `wallGrid`
  och `roomGrid` i `tests/prestanda.test.ts`. Profilera med
  `node --cpu-prof skript.mjs`.
