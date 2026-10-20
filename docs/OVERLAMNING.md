# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 20 oktober 2026, efter 0.8.8.

## Läget

- **0.8.8 är klar** på `main`, filformatet är **8**. Det som gjordes står i
  PLAN.md under *0.8.8*, i README och i UTVECKLING.md under *Mallblad
  (0.8.8, format 8)*:
  - Mallblad = `Worksheet` med `paper`, ritat i mm på papperet i 1:1 och
    utan tillstånd. Listas under Ritningar i projektträdet, eget formulär
    (namn, format, orientering, mapp, *Nya blad får det här mallbladet*).
  - `Sheet.master` och `project.master`. Mallen ritas under vyerna i
    `buildSheet` med smarttexten ifylld från bladet (`masterPrims`).
  - Ramen, BH90-huvudet, loggan i projektet och kryssrutan för nya blad är
    borta. Bladets formulär har mallbladet och fälten för smarttexten.
  - Exempelmallbladet *A3 med ritningshuvud* (`src/core/exampleMaster.ts`)
    i nya projekt och exemplet.
  - Text har fet stil och justering; skalorna 1:25, 1:2500, 1:4000 och
    1:5000 är nya (de fanns i Carl Augusts ram).
  - Carl Augusts DWG-ram (A1, BH90 enligt SIS) blev ett mallblad med
    `scripts/mallblad-fran-dxf.py` och `scripts/mallblad-projekt.mts`, i
    projektfilen *Ritningsmall A1.cadapa* som han fick i chatten. DXF:en
    ligger inte i repot (den har hans telefonnummer). Hans DXF räckte, så
    LibreDWG behövdes inte.
  - Kontrollerat i Chrome med Playwright mot `dist/` (nytt blad med mallen,
    rita text på mallbladet, mallbladets formulär, byta mall på bladet,
    Plot/export) och PDF:en av ett A1-blad med hans mall. Inga nya kända fel.
- **Planen**: 0.8.9 grafik och textrutor på bladen, 0.8.10 smarta fält,
  0.8.11 granskning, 0.8.12 skalstock och stämplar, 0.8.13 fler
  Modifiera-verktyg, sedan 0.9 flera våningsplan (med felet om golvnivån i
  3D), 0.10 tak, 0.11 trappor, 0.12 export och 0.13 piloten med formatfrys.
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
  lägga in synpunkter via en annan, billigare chatt. Punkterna under 0.8.8
  togs bort ur filen när 0.8.8 var klar.
- **Inkorgen (20 oktober) är inte sorterad än.** Claudes förslag i 0.8.8:
  egen skala 1:___ och kortare *Återställ ram* i smartmenyn → 0.8.9;
  Visa-menyn i kategorier → 0.8.11; tabell för linjetjocklekar
  (gammal-cad-färger) och dra och släpp till mappar → 0.8.13 eller egen
  småversion; lokal nollpunkt, SWEREF, norrpil mot true north, export i
  SWEREF och sol och skugga per vy → en egen version efter 0.12 (stor).
  Fråga om han godkänner, och för in det i filen.

## Nästa session: 0.8.9 Grafik och textrutor på bladen

Läs synpunktsfilen och sortera Inkorgen först (se ovan). Läs sedan *0.8.9*
i PLAN.md.

- Linjer, ytor, text och bilder direkt på vanliga blad, med samma verktyg
  som på mallbladet. Enklast är troligen att bladet får en egen yta som
  mallbladet (elementen har `space` satt till bladets id och ritas i mm),
  så att ritverktygen, markeringen och Modifiera fungerar; det svåra är att
  vyerna och texterna på bladet (`SheetTool`) och de ritade objekten
  (`SelectTool`) ska gå att markera och flytta tillsammans.
- `SheetTextItem` blir vanlig text (`Text` med `space` på bladet).
- Textrutor för text överallt: största bredd och höjd, justering (finns nu,
  `align`) och förankring i över-/mitt-/underkant. Radbrytning med
  Helveticas bredder (`textWidth` i `src/formats/helvetica.ts`), röd
  markering på skärmen när texten inte ryms.
- Mellanstor. Nytt format (9).

## Att fråga Carl August om

- **Mallbladen efter provning** (0.8.8, Claudes val): att mallen ritas från
  papperets nedre vänstra hörn på blad i andra format (med ett tips), att
  ett valt mallblad föreslår sitt format, att fälten ligger i bladets
  formulär tills 0.8.10, att loggan nu är ett underlag på mallbladet och att
  mallbladet inte följer tillstånden.
- **Hans ram**: platshållarna som blev smarttext är Claudes gissning
  (#PROJEKTNAMN, #DATUM, #RITNINGSNR, #RAD 3, #FÖRHANDSKOPIA,
  #FASTIGHETSBETECKNING, #PROJEKTNR, #REV, #ARKITEKTKONTOR, #INITIALER MV,
  #SIGN ANSVARIG, #SKALA A1). Övriga (#KOMMUN, #MAPPNAMN, #RAD 1, 2 och 4,
  #INITIALER HL, #SKALA A3) står kvar som text tills 0.8.10 gör egna fält.
  *Skala A3* vill nog ha en smarttext för halva skalan (1:50 → 1:100 på
  A3); föreslå den i 0.8.10.
- **Skalstocken** (0.8.12) måste gå att flytta när som helst (Carl August,
  20 oktober). Hans standardläge på A1: innanför ramen nere till vänster om
  huvudet, x 611–711 mm, y 27–46 mm; hans skalstockar för 1:1–1:5000 finns
  i DXF:en (be om den igen i 0.8.12, den ligger inte i repot).
- **Text på bladet och vyns ram efter provning** (0.8.7, Claudes val):
  höjderna 1,8–10 mm och fet stil, att texten skrivs i verktygsraden och
  redigeras med dubbelklick, och att ramen följer med när skalan byts. Vill
  han kunna dölja hela vyrubriken, inte bara skalan?
- **Synpunktsformuläret**: kommer breven fram till Gmail nu, efter `-f`?
  Annars: prova att sätta Gmail-adressen direkt som `to` i
  `feedback-config.php`. Kommer de fram då är det vidarebefordran från
  Loopia som stoppar dem.
- **Fler Modifiera-verktyg (nu 0.8.13)**: förslagen i PLAN.md (Trimma,
  Hörnskarv, Dela, Justera och Fördela, Hämta och överför inställningar,
  Skala) är Claudes egna, efter motsvarande program. Stäm av vilka han vill
  ha, och listan med kortkommandon, innan den versionen börjar.
- **Smartmenyn efter provning**: placeringen (höger, vänster, under, över
  det markerade), att den syns vid markering med ruta, och om rubriken
  *Ändra* i Modifiera-raden ska heta något annat.
- **Granskningen** ligger som 0.8.11. Han kan byta plats på den och
  Modifiera-verktygen om han vill komma fram till 0.9 snabbare.

### Från 0.8.0

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
- **2D på arbetsblad följer tillstånden** som 2D i planen (mallblad gör det
  inte, sedan 0.8.8). Fråga om arbetsblad ska vara oberoende av tillstånd.
- På ett mallblad finns Visa-menyns skala för texter och mått kvar, fast
  allt ritas i 1:1; den gör ingenting där.
- På ett blad och ett mallblad visar statusraden fortfarande Skärm och Rutnät, fast
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
  `pick({kind:'sheetText', id})` väljer en vy eller en text på bladet; `bacchus.sheets.drawing()` har `views` och
  `items` med ytorna på papperet, `pickedThing()`, `startMove()`,
  `newSheet()`, `newMaster()`, `editText(id)` och `resetCrop(id)` finns
  också. Ett mallblad öppnas med `goTo({kind:'worksheet', id:'mall-a3'})`. Ramens
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
