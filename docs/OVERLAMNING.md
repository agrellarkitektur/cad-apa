# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 20 oktober 2026, efter 0.8 del 3
(0.8.0).

## Läget

- **0.8.0 är klar**: del 1, del 2, del 2.1 och del 3 ligger på `main`, och
  versionen heter `0.8.0`. Filformatet är fortfarande **5**; del 3 behövde
  ingen formatändring (loggan ligger i `project.fields`, vyernas läge på
  bladen i `Viewport.at`).
- **Del 3 (ritningsblad och plot)** är byggd i sin helhet, inget flyttades
  till 0.8.1: blad A4–A0 med ram och ritningshuvud enligt BH90, smarttext,
  logga, vyer i skala med vyrubrik, annoteringsskala per vy, och
  Plot/export till PDF i vektorform i en zipfil med förlopp och avbryt.
  Hur det är byggt står i `docs/UTVECKLING.md` under 0.8 del 3.
- **Inriktningen** (överst i `docs/PLAN.md`): proof of concept fram till
  pilotprojektet. Nästa är 0.8.1 (snabbare ritning, referensritningar),
  sedan 0.9 flera våningsplan och bjälklag, 0.10 tak, 0.11 trappor, 0.12
  IFC- och DXF-export och 0.13 pilotprojektet med formatfrys.
- **Bakåtkompatibilitet:** inga migreringar före formatfrysen (0.13). Höj
  `FORMAT_VERSION` när formatet ändras; äldre filer får ett meddelande om
  att de kommer från en äldre betaversion (`parse` i `src/storage/format.ts`).
- **Telefonen är inget mål.** Testa på dator (Chrome).
- Arbetssätt: Carl August testar varje version på webbhotellet via en
  release på GitHub, som han gör själv. Ingen demo och ingen zip om han inte
  ber om det. Säg alltid hur stora föreslagna ändringar är och om de
  riskerar att behöva mer än en session (CLAUDE.md).

## Nästa session: 0.8.1

Står i PLAN.md under *0.8.1 Snabbare ritning och referensritningar*:
fasader och sektioner i en bakgrundstråd, panorering som flyttar bilden i
stället för att bygga om SVG:n, planen ombyggd bara för det som ändrats,
referensritningar i testerna, HATCH i DXF-underlag och synpunktsformuläret.
Det är sex punkter; de tre första är stora. Föreslå gärna att dela upp den,
eller att göra en **granskningssession** först: `src/ui/app.ts` har vuxit
till drygt 1 900 rader och `propertiesPanel.ts` till drygt 1 000.

Referensritningarna kan nu plottas med `buildSheet` och `writePdf` (eller
jämföras som primitiver, vilket är enklare att läsa i ett test).

## Att fråga Carl August om (del 3)

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
  e-posten. Sedan del 1 visar formuläret vad servern svarar. Fråga vad det
  säger. Troligast är `from` en adress som inte finns (använd
  `kontakt@agrellarkitektur.se`), eller att webbhotellet stoppar `mail()`
  och kräver SMTP; då får `feedback.php` byggas ut (planerat i 0.8.1).
- **2D på arbetsblad följer tillstånden** som 2D i planen. Fråga om
  arbetsblad ska vara oberoende av tillstånd.
- På ett blad visar statusraden fortfarande Skärm och Rutnät, fast
  rutnätet är dolt. Mappars kryssrutor i Plot/export visar inte läget
  "delvis ikryssat" tydligt med appens kryssrutestil.
- Prestanda som återstår (0.8.1): fasader och sektioner räknas i
  huvudtråden (också på blad, men en gång per projektversion tack vare
  `cachedViewPrims`), panorering bygger om hela SVG-bilden, och planen
  byggs om helt vid varje ändring.
- Taksprånget ändras lika på båda sidor av ett sadeltak; riktiga tak med
  takfot per kant kommer i 0.10.
- Spegla vänder inte bilden i ett underlag, bara läget.
- DXF: skraffering (HATCH) läses i 0.8.1; bilder och externa referenser
  efter pilotprojektet. Vektorsnäpp mot PDF avvaktar.
- **Visas i** räknar vyer utan att bry sig om tillstånd.
- Modellvyerna har inga vy-taggar, så ett element med taggar syns inte där
  (inte heller på ett blad via modellvyn); *Visa dolda 2D-element* visar
  dem tonade.
- En borttagen taklutning är dold för gott i den fasaden; bara ångra tar
  tillbaka den automatiska.
- Den första fasaden eller sektionen tar 100–200 ms; testet som mäter
  tiden kan fela när alla tester körs samtidigt på en belastad maskin.
- Spårlinjerna kan kännas för klistriga (`TRACK_REACH` i
  `src/ui/tools/snap.ts`).

## Arbeta i miljön

- Repot är `agrellarkitektur/cad-apa`. Bygga och testa: se CLAUDE.md.
  Commit avslutas med raderna som sessionen anger (Co-Authored-By och
  Claude-Session), sedan `git fetch origin main` och
  `git push origin HEAD:main`. Releaser på GitHub gör Carl August själv.
- Titta på resultatet: `npm run build`, servera `dist/` med
  `python3 -m http.server 8765` och styr med Playwright (Python). Det är
  samma bygge som hamnar på webbhotellet. `window.bacchus` har `store`,
  `view`, `selection`, `ui`, `modifyPalette`, `view3d`, `plan`, `sheets`,
  `plot`, `setTool`, `setMode` och `goTo` (t.ex.
  `goTo({kind:'marker', id:'sektion-a'})`, `goTo({kind:'sheet', id})`).
  `bacchus.sheets.pick({kind:'viewport', id})` visar en vy på bladet i
  egenskaperna. Filer läggs in med `page.expect_file_chooser()` runt ett
  klick på *Lägg in underlag…* eller *Välj logga…*.
- Plot/export i Playwright: sätt `window.showSaveFilePicker = undefined` med
  `add_init_script`, så sparas zipfilen som en nedladdning
  (`page.expect_download()`). Kontrollera PDF:erna med `qpdf --check` och
  `pdftoppm -png`. Sandlådans ersättning för Helvetica saknar ² (m² ser ut
  som m i bilderna), men texten i filen är rätt (`pdftotext`).
- Demon bara på begäran: `npm run preview:artifact`, läs artefakten
  (https://claude.ai/artifact/2m7gq5gkkgSP2wFZ7fLGNJ, Artifact `read`) och
  publicera `artifact/cad-apa.html` till samma URL.
- Stoppa servern med `pgrep -af "http.server 8765"` och `kill`, inte
  `pkill -f` (det stänger skalet).
- Testfiler att lägga in går snabbt att göra med reportlab (PDF), PIL
  (bild) och några rader text (DXF).
- Fasader, sektioner och blad utan webbläsare: ett skript med
  `registerBuiltInTypes()` från `src/elements` först, sedan `buildSection`
  eller `buildSheet` och `writePdf`, och `npx tsx skript.mts`. Stora
  projekt att mäta på: `wallGrid` i `tests/prestanda.test.ts`. Profilera
  med `npx tsx --cpu-prof skript.mts`.
