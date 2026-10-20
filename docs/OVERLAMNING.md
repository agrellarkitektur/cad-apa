# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 20 oktober 2026, efter 0.8.7.

## Läget

- **0.8.7 är klar** på `main`, filformatet är **7**. Det som gjordes står i
  PLAN.md under *0.8.7*, i README och i UTVECKLING.md under *Text på bladet
  och vyernas ram (0.8.7, format 7)*:
  - Text på bladet (`SheetTextItem`, `kind: 'text'`) med textverktyget (T),
    höjd 1,8–10 mm och fet stil i verktygsraden, flera rader och
    smarttext. Markeras, flyttas och tas bort som huvudet; dubbelklick
    eller Redigera i smartmenyn skriver på plats.
  - Vyns ram (`Viewport.crop`, modellens koordinater) med åtta grepp på den
    valda vyn; allt klipps mot ramen. *Återställ ramen till innehållet* i
    smartmenyn och vyns egenskaper.
  - Skalan i vyns rubrik går att dölja (`Viewport.hideScale`, kryssrutan
    *Skalan i rubriken*). Det var Carl Augusts önskemål i samma session.
  - Kontrollerat i Chrome med Playwright mot `dist/`; inga nya kända fel.
    `tests/prestanda.test.ts` gick igenom den här gången.
- **Planen** (ändrad 20 oktober kväll, se *Bladen om* i PLAN.md): 0.8.8
  mallblad, 0.8.9 grafik och textrutor på bladen, 0.8.10 smarta fält,
  0.8.11 granskning, 0.8.12 skalstock och stämplar, 0.8.13 fler
  Modifiera-verktyg, sedan 0.9 flera våningsplan (med felet om golvnivån i 3D),
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
  lägga in synpunkter via en annan, billigare chatt. Punkterna under 0.8.6
  och 0.8.7 togs bort ur filen när 0.8.7 var klar.

## Nästa session: 0.8.8 Mallblad

Börja med att läsa `cad-apa-synpunkter.md` och sortera Inkorgen. Läs sedan
*Bladen om* och *0.8.8* i PLAN.md: Carl August tycker att ramen och det
inbyggda BH90-huvudet är för låsta och vill rita egna utseenden, som
Archicads master layouts.

- **Mallblad** i Ritningar-fliken, med pappersformat. Bygg dem som
  arbetsblad (`Worksheet`, `space` på elementen, se UTVECKLING.md under
  format 5) ritade i skala 1:1 med papperet som yta, så att Text, 2D,
  underlag, markering och Modifiera fungerar som de är. Det som skiljer:
  `view.drawingScale = 1`, papperet ritas under (som `buildSheet`), och
  texter i mallen fyller i smarttext från bladet som använder den
  (`expandSmartText`, `smartVars` i `src/repr/titleBlock.ts`). Text i
  vyerna har ingen smarttext i dag, så den måste in i `annotation.ts` via
  ett värde i ritkontexten.
- **Bladen**: `Sheet.master?: Id`, projektets förvalda mall, och mallens
  primitiver ritade under vyerna i `buildSheet` (och därmed i PDF:en).
- **Ta bort** `Sheet.frame`, `TitleBlockItem`, `addTitleBlock`,
  kryssrutan *Nya blad får ritningshuvud* (`uiSettings.newSheetTitleBlock`)
  och huvudets formulär. Bladets fält (`SHEET_FIELDS`) flyttas till bladets
  formulär; projektets fält (`PROJECT_FIELDS`) får ett eget ställe tills
  0.8.10 gör tabellen. `titleBlockPrims` kan användas en gång för att bygga
  exempelmallen av vanliga linjer och texter, och sedan tas bort.
  Texten på bladet (0.8.7) ligger kvar tills 0.8.9.
- **DWG-ramen**: Carl August bifogar sin tomma ram med huvud. Gör om DWG
  till DXF med LibreDWG (`dwg2dxf`; installera med pip eller bygg om det
  behövs, eller be om DXF) och linjerna och texterna till 2D-objekt i ett
  mallblad, med ezdxf. Den blir testfallet.
- Nytt format (8). Storlek: stor. Blir det trångt väntar exempelmallen
  eller DWG-ramen.

## Att fråga Carl August om

- **Text på bladet och vyns ram efter provning** (0.8.7, Claudes val):
  höjderna 1,8–10 mm och fet stil, att texten skrivs i verktygsraden och
  redigeras med dubbelklick, att läget räknas från papperets nedre vänstra
  hörn (texten står kvar när formatet byts, huvudet följer höger hörn), och
  att ramen följer med när skalan byts. Vill han kunna dölja hela
  vyrubriken, inte bara skalan? Texten blir vanlig text i 0.8.9.
- **Skalstocken** (0.8.12) måste gå att flytta när som helst (Carl August,
  20 oktober).
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
  `pick({kind:'titleBlock' | 'sheetText', id})` väljer en vy, ett huvud
  eller en text på bladet; `bacchus.sheets.drawing()` har `views` och
  `items` med ytorna på papperet, `pickedThing()`, `startMove()`,
  `newSheet()`, `editText(id)` och `resetCrop(id)` finns också. Ramens
  grepp dras med musen på den valda vyns kanter (`views[i].frame`). Filer läggs in med `page.expect_file_chooser()` runt ett
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
