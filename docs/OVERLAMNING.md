# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 20 oktober 2026, efter 0.8 del 2.1.

## Läget

- **0.8 del 1, del 2 och del 2.1 är byggda** och ligger på `main`; versionen
  heter `0.8.0-del.2.1`. Filformatet är fortfarande **5**. 0.8.0 släpps när
  del 3 är klar.
- **Ny inriktning (20 oktober), överst i `docs/PLAN.md`:** närmast byggs ett
  proof of concept. Ordningen är 0.8 del 3 (blad och plot), 0.8.1
  (snabbare ritning, referensritningar), 0.9 flera våningsplan och
  bjälklag, 0.10 tak, 0.11 trappor, 0.12 IFC- och DXF-export, och 0.13
  pilotprojektet, där Carl August ritar ett eget inlämnat bygglov och
  formatet fryses. Allt annat ligger under *Efter pilotprojektet*.
- **Bakåtkompatibilitet:** inga migreringar före formatfrysen (0.13). Höj
  `FORMAT_VERSION` när formatet ändras; äldre filer får ett meddelande om
  att de kommer från en äldre betaversion (`parse` i `src/storage/format.ts`).
- **Telefonen är inget mål längre.** Det som finns får ligga kvar men testas
  inte. Testa på dator (Chrome).
- **Del 2.1 (prestanda):** `model3dBatch` i `src/elements/wall.ts` prövade
  varje vägg mot alla tidigare för T-skarvar. Nu bara mot väggar vars
  omskrivande rektanglar möts (`boxOf`, `boxesTouch` i
  `src/geometry/boolean.ts`). En fasad av 544 väggar: 6–10 s → ca 0,5 s.
  Planer, fasader, sektioner och 3D för exempelprojektet blev exakt
  desamma; i ett rutnät med många skarvar skiljer bara vilket hörn en
  polygon börjar i. `tests/prestanda.test.ts` ska gå igenom.
- Arbetssätt: Carl August testar varje version på webbhotellet via en
  release på GitHub, som han gör själv. Ingen demo och ingen zip om han inte
  ber om det. Säg alltid hur stora föreslagna ändringar är och om de
  riskerar att behöva mer än en session (CLAUDE.md).

## Nästa session: 0.8 del 3

Del 3 är bantad för att rymmas i en session (PLAN.md, *Del 3: ritningsblad
och plot*):

- Ritningsblad A4–A0 med ritningshuvud enligt BH90, egen logga och smarttext
- Flera vyer per blad (planer, fasader, sektioner, arbetsblad), var och en i
  sin skala och med vyrubrik
- Annoteringsskala per vy
- Plot/export-dialogen: kryssrutor efter trädets mappar, PDF i vektorform
  för blad och vyer, zip, förlopp och avbryt

Formatet finns redan (`sheets` med `viewports`, `ViewDef.scale`,
`graphics.pens`, `graphics.font`). Underlag på blad: ett blad visar vyer,
och vyerna visar underlagen som redan finns i dem. Blir det för mycket:
flytta annoteringsskalan eller Plot/export-dialogen till 0.8.1 och säg det
tidigt. Penntabell, typsnitt, markörstilar, projektvinklar och den andra
2D-rutan ligger nu efter pilotprojektet; DXF av blad kommer i 0.12.

## Öppna frågor och kända begränsningar

- **Synpunkter på webbhotellet:** fortfarande obesvarat. Han har laddat upp
  `feedback-config.php` i mappen ovanför `cad-apa`, men formuläret öppnade
  e-posten. Sedan del 1 visar formuläret vad servern svarar. Fråga vad det
  säger. Troligast är `from` en adress som inte finns (använd
  `kontakt@agrellarkitektur.se`), eller att webbhotellet stoppar `mail()`
  och kräver SMTP; då får `feedback.php` byggas ut (planerat i 0.8.1).
- **2D på arbetsblad följer tillstånden** som 2D i planen: det som ritas i
  Förslag A syns inte när Befintligt visas. Tillståndsknapparna syns också
  på arbetsbladet. Fråga om arbetsblad ska vara oberoende av tillstånd.
- Prestanda som återstår (0.8.1): fasader och sektioner räknas i
  huvudtråden, panorering bygger om hela SVG-bilden (`render` i
  `src/view2d/planView.ts`), och planen byggs om helt vid varje ändring
  (130–270 ms för 544 väggar).
- Taksprånget ändras lika på båda sidor av ett sadeltak (testtaket har en
  takfot för hela taket). Riktiga tak med takfot per kant kommer i 0.10.
- Spegla vänder inte bilden i ett underlag, bara läget.
- DXF: skraffering (HATCH) läses i 0.8.1; bilder och externa referenser
  efter pilotprojektet. Vektorsnäpp mot PDF avvaktar (PLAN.md).
- pdf.js laddas först när ett PDF-underlag visas (1,6 MB med arbetaren).
- **Visas i** räknar vyer utan att bry sig om tillstånd.
- Modellvyerna har inga vy-taggar, så ett element med taggar syns inte där;
  *Visa dolda 2D-element* under Visa visar dem tonade.
- En borttagen taklutning är dold för gott i den fasaden; bara ångra tar
  tillbaka den automatiska.
- Den första fasaden eller sektionen tar 100–200 ms; testet som mäter
  tiden kan fela när alla tester körs samtidigt på en belastad maskin.
- Spårlinjerna kan kännas för klistriga (`TRACK_REACH` i
  `src/ui/tools/snap.ts`). Varningen för nästan raka vinklar gäller bara
  raka väggar.

## Arbeta i miljön

- Repot är `agrellarkitektur/cad-apa`. Bygga och testa: se CLAUDE.md.
  Commit avslutas med raderna som sessionen anger (Co-Authored-By och
  Claude-Session), sedan `git fetch origin main` och
  `git push origin HEAD:main`. Releaser på GitHub gör Carl August själv.
- Titta på resultatet: `npm run build`, servera `dist/` med
  `python3 -m http.server 8765` och styr med Playwright (Python). Det är
  samma bygge som hamnar på webbhotellet.
- Demon bara på begäran: `npm run preview:artifact`, läs artefakten
  (https://claude.ai/artifact/2m7gq5gkkgSP2wFZ7fLGNJ, Artifact `read`) och
  publicera `artifact/cad-apa.html` till samma URL. `window.bacchus` har
  `store`, `view`, `selection`, `ui`, `modifyPalette`, `view3d`, `plan`,
  `setTool`, `setMode` och `goTo` (t.ex.
  `goTo({kind:'marker', id:'sektion-a'})` eller
  `goTo({kind:'worksheet', id})`). Filer läggs in med
  `page.expect_file_chooser()` runt ett klick på *Lägg in underlag…*.
  Stoppa servern med `pgrep -af "http.server 8765"` och `kill`, inte
  `pkill -f` (det stänger skalet).
- Testfiler att lägga in går snabbt att göra med reportlab (PDF), PIL
  (bild) och några rader text (DXF).
- Fasader och sektioner utan webbläsare: ett skript eller test med
  `buildSection` från `src/repr/section.ts`. Stora projekt att mäta på:
  `wallGrid` i `tests/prestanda.test.ts`. Profilera med
  `npx tsx --cpu-prof skript.mts` (ett ES-modulskript som importerar från
  `src/`).
