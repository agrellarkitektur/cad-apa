# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 20 oktober 2026, efter 0.8.5.

## Läget

- **0.8.5 är klar** på `main`, filformatet är fortfarande **5**. Det som
  gjordes står i PLAN.md under *0.8.5*, i README och i UTVECKLING.md under
  *Smartmenyn och Modifiera-raden (0.8.5)*:
  - Snabbmenyn och Modifiera-paletten är en meny, **smartmenyn**
    (`src/ui/smartMenu.ts`), bredvid det markerade, med Modifiera-valen
    överst, värde och tips, snabbknapparna och *Mer*.
  - **Modifiera-raden** (`src/ui/app/modifyRail.ts`) innanför ritverktygen;
    kan döljas (`uiSettings.modifyRail`).
  - `modify.ts` är uppdelad i `src/ui/modify/` (`ops.ts`, `tool.ts`,
    `controller.ts` med `Modifier`, läget som menyn, raden och
    verktygsraden delar).
  - Inställningen heter `smartMenu` (läser gamla `petPalette`).
  - Kontrollerat i Chrome med Playwright mot `dist/`; inga nya kända fel.
- **Planen** (20 oktober): 0.8.6 ritningshuvudet som eget objekt och blanka
  blad (*nytt format*), 0.8.7 text direkt på bladet, 0.8.8 fler
  Modifiera-verktyg med kortkommandona och Avrunda/Fasa för hela
  markeringen (flyttade från 0.8.5), 0.8.9 granskning, sedan 0.9 flera våningsplan (med
  felet om golvnivån i 3D), 0.10 tak, 0.11 trappor, 0.12 export och 0.13
  piloten med formatfrys. Carl August tidigarelade smartmenyn; han vill
  fortfarande ha blanka blad och text på bladen snart efter.
- **Ord:** *palett* och *snabbmeny* betyder samma sak för honom. Säg bara
  **smartmeny** från och med nu.
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

## Nästa session: 0.8.6 Ritningshuvud

Börja med att läsa `cad-apa-synpunkter.md` och sortera Inkorgen.

PLAN.md under *0.8.6* (*nytt format*: höj `FORMAT_VERSION` till 6). I dag
har varje blad `titleBlock: 'bh90'` (`src/core/sheets.ts`), huvudet ritas i
`src/repr/titleBlock.ts` och fälten ligger i `sheet.fields` och
`project.fields`. Bladets vyer (`viewports`) är det enda som går att markera
och flytta på bladet (`src/ui/app/sheets.ts`), så huvudet behöver bli en
sorts sak på bladet med markering (smartmenyn), flytt, egenskaper och plot,
och modellen bör rymma texterna i 0.8.7. Nya blad blanka; huvudet läggs på
från en lista. Föreslå modellen för Carl August innan något byggs.

Smartmenyn på bladet: i dag finns ingen markering i `plan.pickables` på ett
blad (`sheets.tool` sköter vyerna), så `selectionBox` i `app.ts` ger null
och menyn hamnar vid klicket. Modifiera-raden är släckt på blad (`lit` i
`modifyRail.ts`); Flytta för huvud och vyer kan tändas där i 0.8.6.

## Att fråga Carl August om

- **Synpunktsformuläret** går att skicka (20 oktober): breven kommer fram
  till webbposten hos Loopia men vidarebefordras inte därifrån till Gmail,
  som andra brev gör. `feedback.php` sätter `From` (från configen) och
  `Reply-To`, men inte kuvertavsändaren, så `mail()` skickar med serverns
  egen adress som Return-Path; vid vidarebefordran faller då SPF/DMARC och
  Gmail kan slänga brevet. Förslag (liten ändring, fråga först): femte
  argumentet `'-f' . $from` till `mail()`. Be honom också titta i Gmails
  skräppost, och prova att sätta Gmail-adressen direkt som `to`.
- **Fler Modifiera-verktyg (0.8.8)**: förslagen i PLAN.md (Trimma,
  Hörnskarv, Dela, Justera och Fördela, Hämta och överför inställningar,
  Skala) är Claudes egna, efter motsvarande program. Stäm av vilka han vill
  ha, och listan med kortkommandon, innan 0.8.8 börjar.
- **Smartmenyn efter provning**: placeringen (höger, vänster, under, över
  det markerade), att den syns vid markering med ruta, och om rubriken
  *Ändra* i Modifiera-raden ska heta något annat.
- **Granskningen** ligger som 0.8.9. Förra var 0.8.1, så den kan läggas
  efter 0.8.6 om han vill.

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
  `bacchus.sheets.pick({kind:'viewport', id})` visar en vy på bladet i
  egenskaperna. Filer läggs in med `page.expect_file_chooser()` runt ett
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
