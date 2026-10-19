# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 20 oktober 2026, efter 0.8.1
(granskning).

## Läget

- **0.8.1 är klar**: en granskningssession utan nya funktioner, på `main`.
  Filformatet är fortfarande **5**. Det som gjordes står i PLAN.md under
  *0.8.1 Granskning* och i UTVECKLING.md under *Granskning (0.8.1)*:
  - Transaktioner, väggskarvar, dolda linjer och rum växer inte längre med
    kvadraten på antalet objekt. Kopiera och ta bort 684 väggar 1,3 s →
    0,03 s; en fasad av 312 väggar med dörrar och fönster 2,5 s → 0,65 s;
    planen och 3D ungefär dubbelt så snabba, rumsnumreringen fyra gånger.
  - `src/ui/app.ts` 1 922 → 836 rader (nya delar i `src/ui/app/`:
    `actions`, `panes`, `pane3d`, `files`, `textEdit`, `snapping`), och
    `src/ui/propertiesPanel.ts` 1 065 → 571 (`selectionFields.ts`,
    `selectionEdits.ts`).
  - Prestandatestet har två nya fall (rum med dörrar och fönster; flytta,
    kopiera och ta bort alla väggar) som felar med den gamla koden.
  - Resultaten är exakt desamma som förut: kontrollerat med fingeravtryck
    av planer, fasader, 3D, rumsnummer och kommandon, och med drygt 140
    steg i webbläsaren mot det gamla och det nya bygget.
- **Planen**: den version som hette 0.8.1 (snabbare ritning,
  referensritningar) heter nu **0.8.2**. Sedan 0.9 flera våningsplan och
  bjälklag, 0.10 tak, 0.11 trappor, 0.12 IFC- och DXF-export och 0.13
  pilotprojektet med formatfrys.
- **Bakåtkompatibilitet:** inga migreringar före formatfrysen (0.13). Höj
  `FORMAT_VERSION` när formatet ändras; äldre filer får ett meddelande om
  att de kommer från en äldre betaversion (`parse` i `src/storage/format.ts`).
- **Telefonen är inget mål.** Testa på dator (Chrome).
- Arbetssätt: Carl August testar varje version på webbhotellet via en
  release på GitHub, som han gör själv. Ingen demo och ingen zip om han inte
  ber om det. Säg alltid hur stora föreslagna ändringar är och om de
  riskerar att behöva mer än en session (CLAUDE.md).

## Nästa session: 0.8.2

Står i PLAN.md under *0.8.2 Snabbare ritning och referensritningar*:
fasader och sektioner i en bakgrundstråd, panorering som flyttar bilden i
stället för att bygga om SVG:n, planen ombyggd bara för det som ändrats,
referensritningar i testerna, HATCH i DXF-underlag och synpunktsformuläret.
Sex punkter, varav de tre första är stora; föreslå att dela upp den (t.ex.
0.8.2 bakgrundstråd och referensritningar, 0.8.3 panorering och cache per
objekt).

Underlag från granskningen:

- En fasad tar nu ungefär 0,1 s i exemplet och 0,65 s för 312 väggar. Det
  som återstår är jämnt fördelat: 3D-formerna (`model3dBatch`,
  polygon-clipping), trianguleringen och de dolda linjerna. Med en
  bakgrundstråd märks det inte.
- Panorering ritar om hela planen: 15 ms för 684 väggar, mer med stora
  DXF-underlag.
- Snäppningen (`snap` i `src/ui/tools/snap.ts`, sträckorna från
  `src/ui/app/snapping.ts`) går igenom alla sträckor vid varje musrörelse.
  Det är linjärt men tungt med stora DXF-underlag; `BoxIndex` passar för att
  bara ta sträckor nära markören.
- Referensritningarna kan plottas med `buildSheet` och `writePdf`, eller
  jämföras som primitiver, vilket är enklare att läsa i ett test. Samma
  teknik som granskningen använde (fingeravtryck av `buildPlan`,
  `buildSection` och `buildModel3d`) kan bli testet.

## Att fråga Carl August om (från 0.8.0)

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

- **Synpunkter på webbhotellet:** fortfarande obesvarat. Han har laddat upp
  `feedback-config.php` i mappen ovanför `cad-apa`, men formuläret öppnade
  e-posten. Sedan 0.8 del 1 visar formuläret vad servern svarar. Fråga vad
  det säger. Troligast är `from` en adress som inte finns (använd
  `kontakt@agrellarkitektur.se`), eller att webbhotellet stoppar `mail()`
  och kräver SMTP; då får `feedback.php` byggas ut (planerat i 0.8.2).
- **2D på arbetsblad följer tillstånden** som 2D i planen. Fråga om
  arbetsblad ska vara oberoende av tillstånd.
- På ett blad visar statusraden fortfarande Skärm och Rutnät, fast
  rutnätet är dolt. Mappars kryssrutor i Plot/export visar inte läget
  "delvis ikryssat" tydligt med appens kryssrutestil.
- Taksprånget ändras lika på båda sidor av ett sadeltak; riktiga tak med
  takfot per kant kommer i 0.10.
- Spegla vänder inte bilden i ett underlag, bara läget.
- DXF: skraffering (HATCH) läses i 0.8.2; bilder och externa referenser
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
