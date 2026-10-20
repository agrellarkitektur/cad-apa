# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 20 oktober 2026, efter 0.8.2.

## Läget

- **0.8.2 är klar** på `main`, filformatet är fortfarande **5**. Det som
  gjordes står i PLAN.md under *0.8.2* och i UTVECKLING.md under
  *Bakgrundstråd och markering (0.8.2)* och *Tester*:
  - Fasader och sektioner räknas i en bakgrundstråd
    (`src/ui/app/sectionQueue.ts`, `src/repr/sectionWorker.ts`). Små vyer
    (under 30 ms) räknas direkt som förut. En fasad av 544 väggar: appen
    blockeras högst ca 55 ms första gången, sedan ca 25 ms, mot ca 400 ms
    förut. Bladen och Plot/export räknar fortfarande direkt.
  - Referensritningar: `tests/referens.test.ts` med facit i
    `tests/referens/` (exemplet, `roomGrid(3)` och ett A3-blad). Facit gav
    exakt samma resultat med 0.8.1-koden. Nytt facit: `-u`.
  - Småfel: markering i 3D med *Följ sektionen* (`hitAt` i `view3d.ts`),
    markering i sektion (`ownCuts` i `buildSection`), textverktyget på blad
    (stannar med ett tips), mappräknaren på samma rad.
  - `feedback.php`: letar efter `feedback-config.php` i `cad-apa` och i
    mappen ovanför, säger vilket fel det är, och visar läget om man öppnar
    `feedback.php` i webbläsaren (GET).
- **Planen** (sorterad 20 oktober tillsammans med Carl August): 0.8.3
  snabbare plan (panorering, cache per objekt, snäppning med `BoxIndex`,
  HATCH), 0.8.4 arbetsflöde och ritningshuvud (*nytt format*, sju punkter
  varav tre mellanstora; ritningshuvudet kan bli en egen småversion), sedan
  0.9 flera våningsplan (med felet om golvnivån i 3D), 0.10 tak, 0.11
  trappor, 0.12 export och 0.13 piloten med formatfrys.
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
  lägga in synpunkter via en annan, billigare chatt.

## Nästa session: 0.8.3 Snabbare plan

Börja med att läsa `cad-apa-synpunkter.md` och sortera Inkorgen.

Står i PLAN.md under *0.8.3*:

- Panorering och zoom flyttar bilden (transform på SVG:n eller en grupp) i
  stället för att bygga om hela SVG-bilden. Mätt: 15 ms per bildruta för
  684 väggar, mer med stora DXF-underlag.
- Planen byggs om bara för objekt som ändrats (cache per objekt i
  `buildPlan`); väggskarvar gör att grannar också måste räknas om.
- Snäppningen (`snap` i `src/ui/tools/snap.ts`, sträckorna från
  `src/ui/app/snapping.ts`) prövar bara sträckor nära markören (`BoxIndex`).
- HATCH i DXF-underlag.

Kontrollera med referensritningarna att planerna inte ändras, och mät före
och efter med `roomGrid(18)` / stora DXF-underlag.

## Att fråga Carl August om

- **Synpunktsformuläret** efter 0.8.2: vad säger `feedback.php` när han
  öppnar den i webbläsaren, och går det att skicka? Om `mail()` misslyckas
  med giltig `from` (på den egna domänen, `kontakt@agrellarkitektur.se`)
  behövs SMTP i `feedback.php`.
- **Text direkt på bladet**: punkten ligger under *Efter pilotprojektet*,
  men blir naturlig att göra tillsammans med ritningshuvudet som eget objekt
  i 0.8.4. Fråga om den ska flyttas dit.

### Från 0.8.0

- **Hur bladet och huvudet ser ut** när han provat: fältens ordning och
  storlek i BH90-huvudet är gjorda efter hur huvudet brukar se ut, inte
  efter standardtexten. Vill han ha något annat i huvudet (t.ex. ritad av
  och granskad som initialer, eller fler rader för ändringar)?
- **Vyernas ram** räknas ur det som är ritat i vyn (utan underlag) plus
  4 mm. Ett underlag som en grundkarta klipps mot den. Räcker det för
  situationsplanen, eller behövs beskärning för hand tidigare än efter
  piloten?
- **Typsnittet i PDF:en** är Helvetica, medan skärmen visar appens typsnitt.
  Bredderna skiljer något. Att bädda in ett eget typsnitt ligger efter
  piloten.
- Modellvyer på blad ritas med förslaget jämfört med befintligt. Sparade
  vyer ritas med sina egna inställningar.

## Öppna frågor och kända begränsningar

- **Synpunkter på webbhotellet:** servern svarade 503 före 0.8.2, alltså
  hittades eller godtogs inte `feedback-config.php` (troligen open_basedir).
  Se *Att fråga Carl August om*.
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
- DXF: skraffering (HATCH) läses i 0.8.3; bilder och externa referenser
  efter pilotprojektet. Vektorsnäpp mot PDF avvaktar.
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
  `view`, `selection`, `ui`, `modifyPalette`, `view3d`, `plan`, `sheets`,
  `plot`, `setTool`, `setMode` och `goTo` (t.ex.
  `goTo({kind:'marker', id:'sektion-a'})`, `goTo({kind:'sheet', id})`).
  `bacchus.sheets.pick({kind:'viewport', id})` visar en vy på bladet i
  egenskaperna. Filer läggs in med `page.expect_file_chooser()` runt ett
  klick på *Lägg in underlag…* eller *Välj logga…*. Egenskapspanelen är
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
  (bild) och några rader text (DXF).
- Fasader, sektioner och blad utan webbläsare: ett skript med
  `registerBuiltInTypes()` från `src/elements` först, sedan `buildSection`
  eller `buildSheet` och `writePdf`. Stora projekt att mäta på: `wallGrid`
  och `roomGrid` i `tests/prestanda.test.ts`. Profilera med
  `node --cpu-prof skript.mjs`.
