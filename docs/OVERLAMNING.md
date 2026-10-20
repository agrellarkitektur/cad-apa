# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 21 oktober 2026, efter 0.8.10.

## Läget

- **0.8.10 är klar** på `main`, filformatet är **10**. Det som gjordes står i
  PLAN.md under *0.8.10*, i README och i UTVECKLING.md under *Smarta fält
  (0.8.10, format 10)*:
  - Allt inom klamrar som inte är inbyggt är ett fält (`src/core/sheetFields.ts`).
    Inbyggt: projekt, ritningsnummer, innehåll, `{mapp}`, skala,
    `{skala a3}`, format, idag. Fält utan värde blir tomma.
  - Bladets egenskaper har en tabell med fälten och kryssrutan *Projekt*
    (fältet gäller hela projektet, `project.fields`). Ctrl-/Shift-klick på
    blad i Ritningar ger formuläret för flera blad med *(olika)*.
  - `scripts/mallblad-fran-dxf.py` gör #MAPPNAMN till `{mapp}`, #SKALA A3
    till `{skala a3}` och övriga platshållare till fält.
  - Kontrollerat i Chrome med Playwright mot `dist/` (tabellen, spara fält,
    nytt fält `{Konstruktör}` på bladet med *Projekt*, flera blad med
    Ctrl-klick och *(olika)*, ångra). Inga nya kända fel. Referensbilden
    för bladet hade dagens datum; testet sätter nu datumet.
- **Inkorgen (21 oktober) är inte sorterad.** Claudes förslag, skickat i
  chatten och inte godkänt än: DXF-text (MText `\pxql`, insättningspunkt),
  mönsterförhandsvisning, markering av sluten polylinje och linje bakom
  fyllning, statusradens fält som knappar, Snäpp-knappen och avstängda
  växlar → 0.8.11; ny **0.8.14 Underlag** (snäpp i DXF, X/Y, papperskorg,
  grupper per filtyp och instans, bildens grepp och mått); Flytta/Rotera
  från snäppunkt och mätning i segment → 0.8.13 (mätningen egen
  småversion om 0.8.13 blir stor); rumsstämpeln → egen småversion efter
  0.8.14 eller 0.9; *explodera vektorunderlag* står under Parkerat, fråga
  om den ska flyttas fram. Avstängda växlar: Claude föreslog snett streck i
  ikonens färg (inte rött) på synlighetsväxlar och tydligare påslaget läge.
  Sortera klart med honom och för in i `cad-apa-synpunkter.md`.
- **A1-ramen**: Inkorgen säger att ramen inte hittas. Den finns bara i
  projektfilen *Ritningsmall A1.cadapa* (format 8, öppnas inte längre).
  Be om DXF:en och kör skripten igen (format 10); se *Arbeta i miljön*.
- **Planen**: 0.8.11 granskning, 0.8.12 skalstock och stämplar, 0.8.13
  fler Modifiera-verktyg, sedan 0.9 flera våningsplan (med felet om
  golvnivån i 3D), 0.10 tak, 0.11 trappor, 0.12 export, SWEREF-versionen
  (före eller efter piloten) och 0.13 piloten med formatfrys.
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
  är godkänd. Punkterna under 0.8.10 togs bort ur filen när 0.8.10 var klar.

## Nästa session: 0.8.11 Granskning

Sortera Inkorgen först (se ovan), läs sedan *0.8.11* i PLAN.md.

- Städa, dela upp stora filer (`src/ui/app/sheets.ts`, `src/ui/app.ts`) och
  leta efter långsam kod. Visa-menyn i kategorier. Plus de småsaker ur
  Inkorgen som Carl August godkänner för 0.8.11.
- Gör om A1-mallen om han laddat upp DXF:en.

## Att fråga Carl August om

- **Bladen efter provning** (0.8.9, Claudes val): att bilder på bladet
  ligger under vyerna och linjer och text över; att mått inte går att rita
  på bladet; att en vy i en större markering bara går att flytta (inte
  vrida, spegla eller kopiera); att bladet inte följer tillstånden.
- **Textrutorna**: förankringen är punkten i rutans över-, mitt- eller
  underkant och justeringen rutans vänster-, mitt- eller högerkant; utan
  förankring står första radens baslinje på punkten som förut. Rutan ställs
  in i egenskaperna (0 = ingen gräns). Vill han kunna dra upp rutan med
  textverktyget, och se rutans kant när texten är markerad? Skärmen visar
  texten med appens typsnitt (Archivo), så raderna kan se något längre
  eller kortare ut än rutan; vill han att ritningens text visas i Arial på
  skärmen (samma bredder som Helvetica i PDF:en)?
- **Fälten efter provning** (0.8.10, Claudes val): vad som är inbyggt och
  vilka fält som gäller hela projektet från början, `{skala a3}` (nämnaren
  gånger långsidan / 420), att fält utan värde blir tomma på papperet, att
  ett fält med *(olika)* inte går att tömma på flera blad samtidigt, och
  att rubrikerna i tabellen är namnet som det först skrivs, med stor
  bokstav.
- **Mallbladen efter provning** (0.8.8, Claudes val): att mallen ritas från
  papperets nedre vänstra hörn på blad i andra format (med ett tips), att
  ett valt mallblad föreslår sitt format, att loggan nu är ett underlag på
  mallbladet och att mallbladet inte följer tillstånden.
- **Hans ram**: platshållarna som blev smarttext är Claudes gissning
  (#PROJEKTNAMN, #DATUM, #RITNINGSNR, #RAD 3, #FÖRHANDSKOPIA,
  #FASTIGHETSBETECKNING, #PROJEKTNR, #REV, #ARKITEKTKONTOR, #INITIALER MV,
  #SIGN ANSVARIG, #SKALA A1). Övriga (#KOMMUN, #MAPPNAMN, #RAD 1, 2 och 4,
  #INITIALER HL, #SKALA A3) blir fält, `{mapp}` och `{skala a3}` när
  skriptet körs igen (0.8.10); hans fil i format 8 öppnas inte längre.
- **Skalstocken** (0.8.12) måste gå att flytta när som helst (Carl August,
  20 oktober). Hans standardläge på A1: innanför ramen nere till vänster om
  huvudet, x 611–711 mm, y 27–46 mm; hans skalstockar för 1:1–1:5000 finns
  i DXF:en (be om den igen i 0.8.12, den ligger inte i repot).
- **Vyns ram efter provning** (0.8.7, Claudes val): att ramen följer med
  när skalan byts. Vill han kunna dölja hela vyrubriken, inte bara skalan?
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
  rutnätet är dolt. Underlagens formulär säger *Bredd i modellen* också på
  papper, och tipset om att kalibrera skalan kommer också där.
- Markeringen på ett blad markerar inte mallens grafik (bara bladets egen),
  som väntat; men det ritade på bladet och mallen ligger på samma papper,
  så det kan vara svårt att se vad som är vad. Mappars kryssrutor i Plot/export visar inte läget
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
  `bacchus.sheets.pick({kind:'viewport', id})` markerar en vy på bladet
  (`selection`), `pick({kind:'sheet', id})` visar bladet i panelen;
  `bacchus.sheets.drawing()` har `views` med ytorna på papperet och
  `pickables`; `pickedViewport()`, `place(bladId, vy, skala)`,
  `newSheet()`, `newMaster()` och `resetCrop(id)` finns också. Det ritade
  på bladet är vanliga element med `space` = bladets id. Ett mallblad öppnas med `goTo({kind:'worksheet', id:'mall-a3'})`. Ramens
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
- Playwright: dra med flera `mouse.move` i steg (två steg räcker inte för
  att vyn ska räkna det som en dragning). Modifiera Flytta utgår från
  punkten där man klickade på det markerade, så ett klick efter valet är
  målet. Filvalet för underlag öppnas pålitligast med ett riktigt klick på
  menyn (inte `element.click()` i JavaScript).
