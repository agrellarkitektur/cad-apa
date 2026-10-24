# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 24 oktober 2026, efter 0.8.14.

## Läget

- **0.8.14 är klar** på `main` (samma format, 11): Justera och fördela,
  Hämta och överför (pipetten), Skala, Förläng alla till, Trimma mot gräns
  och tjocklekstabellen med "gammel-cad"-färger. Står i PLAN.md (med
  Claudes val), README och UTVECKLING.md under *Modifiera-verktyg del 2*.
  Kontrollerat i Chrome med Playwright mot `dist/`.
- **Publicering:** varje push till `main` laddas upp med
  `.github/workflows/publicera.yml` (FTPS; secrets `FTP_SERVER`,
  `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_DIR`). Carl August såg 24 oktober att
  webbhotellet fortfarande visade 0.8.11: `FTP_DIR` var fel och är nu
  `/agrellarkitektur.se/public_html/cad-apa/`. Se efter med `gh run list`
  att körningen går igenom, och fråga om 0.8.14 syns.
- **0.8.12, 0.8.13 och 0.8.14 är inte provade** av Carl August (han har bara
  haft 0.8.11 på webbhotellet). Frågorna nedan gäller.
- **Versionsnumret står vid alfa-knappen** sedan 24 oktober (fortfarande
  0.8.14, ingen ny version), så att det syns vad webbhotellet har.
- **Inkorgen är tom** (sorterad 24 oktober). Kommandoraden blev
  **0.8.19 och 0.8.20** (Carl Augusts svar: både engelska och svenska
  förkortningar; nere som i AutoCAD, flyttbar och dockningsbar i del 2;
  Enter utan aktivt kommando öppnar raden, mellanslag kör senaste
  kommandot igen). Högerklickshistoriken flyttades dit från 0.8.17. Övriga
  punkter står i synpunktsfilen och PLAN.md: 0.8.15 fick parallellt/vinkelrätt som i
  SketchUp, nya **0.8.17 Småsaker** och **0.8.18 2D-form** (nytt format),
  **0.11.1 Profilverktyget** (före piloten, Carl Augusts beslut) och
  **0.11.2 Dörrar och fönster**; kulör och material efter piloten.
  Polylinjen som inte ska markeras inuti löses i 0.8.18.
- **Färdplan** (Carl August 22 oktober): 0.13 är hans egen provning (han
  ritar ett hus), sedan en inbjuden **alfa** för arkitektvänner, sedan en
  **öppen beta**. **Formatfrysen kommer med den öppna betan.** Inget av
  stegen är 1.0. Håll färdplanen nedan aktuell vid varje överlämning
  (CLAUDE.md).
- **Ord:** *palett* och *snabbmeny* betyder samma sak för honom. Säg bara
  **smartmeny**.
- **Bakåtkompatibilitet:** inga migreringar före formatfrysen (den öppna
  betan). Höj `FORMAT_VERSION` när formatet ändras; äldre filer får ett
  meddelande om att de kommer från en äldre alfaversion (`parse` i
  `src/storage/format.ts`).
- **Telefonen är inget mål.** Testa på dator (Chrome).
- Arbetssätt: Carl August testar varje version på webbhotellet. Ingen demo
  och ingen zip om han inte ber om det. Säg alltid hur stora föreslagna
  ändringar är och om de riskerar att behöva mer än en session (CLAUDE.md).
- **Synpunkter:** Carl August samlar dem i `cad-apa-synpunkter.md`
  (projektets kunskapsbas), med rubrikerna Inkorg, Planerat per version,
  Parkerat och Avfärdat. Läs den vid sessionsstart (Projects-verktyget,
  `project_read`). Sortera Inkorgen tillsammans med honom: föreslå version
  för varje punkt och säg om något är för stort för en session. Ta bort
  hanterade punkter när de görs; behåll Avfärdat med anledning. Punkterna
  under 0.8.14 togs bort ur filen när 0.8.14 var klar.

## Färdplan

Kort; detaljerna står i PLAN.md. Uppdateras vid varje överlämning.

- ~~0.8.8 Mallblad~~ … ~~0.8.13 Fler Modifiera-verktyg~~,
  ~~0.8.14 Modifiera-verktyg del 2~~ (klara)
- **Granskning** (bestämd 24 oktober, före 0.8.15): `src/ui/modify/tool.ts`
  har drygt 830 rader och kan delas per val; förra granskningen var 0.8.11
- **0.8.15 Underlag**: snäpp i DXF, parallellt/vinkelrätt som i SketchUp,
  X/Y, papperskorg, grupper i trädet, bildens grepp och mått
- **0.8.16 Rumsstämpeln** flyttbar, med pil utanför rummet
- **0.8.17 Småsaker**: dra och släpp till mappar, mätning i segment,
  osifont och Om-rutan, autospara, rutnätet
- **0.8.18 2D-form** (nytt format): linje/rektangel/cirkel som sätt att rita,
  fyllning på formen
- **0.8.19 Kommandoraden del 1**: register med engelska och svenska
  förkortningar, raden nere, Enter öppnar, mellanslag upprepar, avstånd
  och koordinater
- **0.8.20 Kommandoraden del 2**: alternativ i hakparentes, historik (F2)
  och högerklick, flyttbar och dockningsbar panel
- **0.9 Flera våningsplan och bjälklag** (nytt format; felet med golvnivån
  i 3D)
- **0.10 Tak** (nytt format; volymer ovanför snittet punktstreckade)
- **0.11 Trappor** (nytt format)
- **0.11.1 Profilverktyget** (nytt format, stor) och **0.11.2 Dörrar och
  fönster** (stor)
- **0.12 Export**: IFC4, DXF, areor för bygglov
- **Koordinater, SWEREF och sol** (stor; före eller efter piloten, bestäms
  efter 0.12)
- **0.13 Pilotprojektet**: Carl August ritar själv ett hus
- **Inbjuden alfa** för arkitektvänner; deras synpunkter i småversioner
- **Öppen beta och formatfrys**; etiketten blir *Beta*
- Efter piloten: se *Efter pilotprojektet* i PLAN.md (bl.a. kulör och
  material, explodera DXF-underlag, mallblad mellan projekt). **1.0**
  bygglovshandling.

## Nästa session

Fråga först om 0.8.14 syns på webbhotellet (numret vid alfa-knappen) och
hur 0.8.12–0.8.14 fungerar. Läs synpunktsfilen och sortera Inkorgen. Är
granskningen inte gjord är den nästa; annars **0.8.15 Underlag** (läs
*0.8.15* i PLAN.md).

## Att fråga Carl August om

- **0.8.14 efter provning** (Claudes val, se PLAN.md): Justeras knappar och
  att ett klick på en vägg lägger objekten mot livet som vetter mot dem;
  vad pipetten tar med (allt utom form och läge, möblernas mått räknas som
  form, bara samma slag); att Skala inte gäller väggar, tak och rum och inte
  ändrar texthöjden; att Shift+X väljer Förläng alla med flera markerade
  men Shift+T behåller den gamla Trimma; bokstäverna Shift+N, H och Y.
  Smartmenyn för flera markerade har nu en fjärde grupp och bryts på fler
  rader. Ska tjocklekstabellen också finnas för linjer i stilmallen?

- **0.8.13 efter provning** (Claudes val, se PLAN.md): bokstäverna för
  kortkommandona (Shift+Q Ta bort punkt och Shift+K Flytta punkt är
  godtyckliga); att Trimma, Hörnskarv och Dela avslutas efter ett klick (i
  AutoCAD fortsätter Trimma tills Esc); att Dela finns fast Lägg till punkt
  också delar en vägg; att baspunkten gäller också Spegla och I rad. Ska
  Avrunda alla och Fasa alla också gälla 2D-polylinjer?

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
- **Hans ram** (gjord om i format 10, 21 oktober): platshållarna som blev smarttext är Claudes gissning
  (#PROJEKTNAMN, #DATUM, #RITNINGSNR, #RAD 3, #FÖRHANDSKOPIA,
  #FASTIGHETSBETECKNING, #PROJEKTNR, #REV, #ARKITEKTKONTOR, #INITIALER MV,
  #SIGN ANSVARIG, #SKALA A1). Övriga (#KOMMUN, #MAPPNAMN, #RAD 1, 2 och 4,
  #INITIALER HL, #SKALA A3) blev fält, `{mapp}` och `{skala a3}`. Skriptet
  kördes med `--utan 605,22,716,50 --behall HÖJD --behall SWEREF` (utan
  skalstocken) och projektet med fälten `kommun,projektbeskrivning,handläggare`.
- **0.8.12 efter provning** (Claudes val): skalstocken alltid 100 mm (ingen
  inställning för längd och indelning); andra skalor än hans tolv delas in
  som den med samma siffror (1:200 som 1:2000) eller efter jämna tal;
  skalan från bladets första vy när den läggs på; läget 230 mm från
  papperets högerkant och 40 mm upp på alla format (x 611 på A1); texthöjd
  3 mm, linjerna 0,7/0,35/0,18 och texten 0,25; skalstockar och stämplar
  går bara att flytta; en stämpel läggs nere till vänster innanför ramen
  (eller där man högerklickar) och ritas över vyerna; en stämpel i en
  stämpel blir en streckad ruta. I 1:50 är strecket vid 10 mm 4 mm långt
  och tunt, som i DXF:en (de andra skalorna har ett mellanstreck där);
  avsiktligt?
- **Vyns ram efter provning** (0.8.7, Claudes val): att ramen följer med
  när skalan byts. Vill han kunna dölja hela vyrubriken, inte bara skalan?
- **Synpunktsformuläret**: kommer breven fram till Gmail nu, efter `-f`?
  Annars: prova att sätta Gmail-adressen direkt som `to` i
  `feedback-config.php`. Kommer de fram då är det vidarebefordran från
  Loopia som stoppar dem.
- **Smartmenyn efter provning**: placeringen (höger, vänster, under, över
  det markerade), att den syns vid markering med ruta, och om rubriken
  *Ändra* i Modifiera-raden ska heta något annat.
- **0.8.11 efter provning** (Claudes val): kategorierna i Visa (Modell,
  Littera, Rum, mått och text, 2D, Markörer), littera per typ och underlag
  i Visa; att MTEXT fästs efter sin bredaste rad; namnen Skärm, Verklig och
  Tunna på *Linjer*; snett streck på avslagna knappar och accentfärg på
  påslagna (också verktygen och panelknapparna fick en tydligare ram); att
  en sluten 2D-form inuti ett rum går före rummet men en linje nära klicket
  går före båda. Synpunkten om polylinjer som bara markeras vid kanten gick
  inte att återskapa (slutna polylinjer gick att klicka inuti); nu räknas
  också en polylinje vars ändar möts som sluten. Hände det på ett annat
  sätt behövs ett exempel.

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
- På ett blad och ett mallblad visar statusraden fortfarande skärmskalan
  (Rutnät är grått sedan 0.8.11). Underlagens formulär säger *Bredd i
  modellen* också på papper, och tipset om att kalibrera skalan kommer
  också där.
- Markeringen på ett blad markerar inte mallens grafik (bara bladets egen),
  som väntat; men det ritade på bladet och mallen ligger på samma papper,
  så det kan vara svårt att se vad som är vad.
- Taksprånget ändras lika på båda sidor av ett sadeltak; riktiga tak med
  takfot per kant kommer i 0.10.
- Spegla vänder inte bilden i ett underlag, bara läget.
- DXF: skraffering ritar streckade mönsterlinjer heldragna och solid
  fyllning som en ton (färgerna i DXF läses inte). Bilder och externa
  referenser efter pilotprojektet. Vektorsnäpp mot PDF avvaktar.
- **En flyttad vägg** räknar fortfarande om sammanslagningen av alla
  väggytor på våningen (`union` i väggarnas `planBatch` och i rummens hål;
  `polygon-clipping` står för det mesta), 0,07–0,16 s för 300–700 väggar. Ett nytt rumsnamn räknar om rum och dörrar (0,08 s).
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
  `git push origin HEAD:main`. Pushen publicerar på webbhotellet; följ
  körningen med `gh run list` (loggarna går inte att läsa härifrån, men
  status syns). Releaser (zip) gör Carl August själv om han vill.
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
- Playwright: verktygsraden (`.tool-options`) ligger över nedre delen av
  ritytan; klicka högre upp. 2D-verktyget behöver en `mouse.move` före
  klicket. Verktyget som är aktivt är `bacchus.view.currentTool` (t.ex.
  dess `points` och `current`).
- Jämföra före och efter en uppdelning: bygg båda, kör samma klick och
  spara `store.doc`, markeringen, `.plan-drawing .content`, panelens text
  och smartmenyn som hashar per steg (så gjordes 0.8.1 och 0.8.11).
- Playwright: dra med flera `mouse.move` i steg (två steg räcker inte för
  att vyn ska räkna det som en dragning). Modifiera Flytta utgår från
  punkten där man klickade på det markerade, så ett klick efter valet är
  målet. Filvalet för underlag öppnas pålitligast med ett riktigt klick på
  menyn (inte `element.click()` i JavaScript).
- Playwright och Modifiera (0.8.14): smartmenyn ligger ofta över det man
  vill klicka på i ritningen; dölj den med en stilregel
  (`.smart-menu{display:none!important}`) eller klicka utanför den.
  `bacchus.modifier` har `choose(op)`, `chooseRail(id)`, `applyValue(v)`,
  `setValue(v)`, `active` och `detailMarkup()`; Shift + bokstav fungerar
  efter en `mouse.move` över ritytan.
