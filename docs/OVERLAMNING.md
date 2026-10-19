# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 19 oktober 2026, efter 0.8 del 2.

## Läget

- **0.8 byggs i tre delar** och släpps som 0.8.0 när alla är klara. **Del 1
  och del 2 är byggda** och ligger på `main`; versionen heter
  `0.8.0-del.2` och demon visar den
  (https://claude.ai/artifact/2m7gq5gkkgSP2wFZ7fLGNJ). Filformatet är
  fortfarande **5**.
- **Nytt arbetssätt (19 oktober):** Carl August testar varje version på
  webbhotellet via en release på GitHub, som han gör själv. Ingen demo och
  ingen zip om han inte ber om det, och svaren behöver inte sluta med
  demolänken. Säg alltid hur stora föreslagna ändringar är och om de
  riskerar att behöva mer än en session (CLAUDE.md).
- Del 2 innehåller det som blev kvar från del 1 (grepp för nock och takfot
  i fasader och sektioner, grepp och Modifiera för 2D-elementens punkter),
  underlag (PDF, bilder, DXF) och arbetsblad. Vad det är står i README
  (*Version 0.8, del 2 av 3*), hur det är byggt i UTVECKLING.md (*Grepp,
  underlag och arbetsblad*), och vad som återstår i `docs/PLAN.md`.
- Beslut 19 oktober (i PLAN.md): takfoten som dras uppåt tar med sig
  nocken, Shift håller nocken still; PDF-filen sparas som den är; underlag
  går att lägga även i fasader och sektioner.

## Nästa session: 0.8 del 3

Enligt PLAN.md: ritningsblad (A4–A0, BH90 eller BEAst, logga, smarttext),
flera vyer per blad i egen skala, annoteringsskala, en andra 2D-ruta,
Plot/export (ett ställe, kryssrutor efter trädets mappar, PDF och DXF,
zip, avbryt), penntabell, typsnitt, öppningssätt för fönster, markörstilar
och projektvinklar. Formatet finns redan (`sheets` med `viewports`,
`ViewDef.scale`, `graphics.pens`, `graphics.font`, `project.angles`).

Del 3 är för stor för en session. Föreslå Carl August en uppdelning (t.ex.
blad och vyer på blad i en session, Plot/export i nästa, grafik, markörer
och projektvinklar i en tredje eller i 0.8.1) och fråga innan något byggs
(CLAUDE.md). Underlag på blad hör
till del 3: ett blad visar vyer, och vyerna visar underlagen som redan
finns i dem.

## Öppna frågor och kända begränsningar

- **Synpunkter på webbhotellet:** fortfarande obesvarat. Han har laddat upp
  `feedback-config.php` i mappen ovanför `cad-apa`, men formuläret öppnade
  e-posten. Sedan del 1 visar formuläret vad servern svarar. Fråga vad det
  säger. Troligast är `from` en adress som inte finns (använd
  `kontakt@agrellarkitektur.se`), eller att webbhotellet stoppar `mail()`
  och kräver SMTP; då får `feedback.php` byggas ut.
- **2D på arbetsblad följer tillstånden** som 2D i planen: det som ritas i
  Förslag A syns inte när Befintligt visas. Tillståndsknapparna syns också
  på arbetsbladet. Fråga om arbetsblad ska vara oberoende av tillstånd.
- Taksprånget ändras lika på båda sidor av ett sadeltak (testtaket har en
  takfot för hela taket). Riktiga tak med takfot per kant kommer i 0.9.
- Spegla vänder inte bilden i ett underlag, bara läget.
- DXF: skraffering (HATCH), bilder och externa referenser läses inte.
  Mycket stora DXF-filer är inte provade; allt ritas om vid varje
  panorering. Vektorsnäpp mot PDF avvaktar (PLAN.md).
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
- Demon bara på begäran: `npm run preview:artifact`, läs artefakten ovan
  (Artifact `read`) och publicera `artifact/cad-apa.html` till samma URL.
  `window.bacchus` har `store`, `view`, `selection`, `ui`, `modifyPalette`,
  `view3d`, `plan`, `setTool`, `setMode` och `goTo` (t.ex.
  `goTo({kind:'marker', id:'sektion-a'})` eller
  `goTo({kind:'worksheet', id})`). Filer läggs in med
  `page.expect_file_chooser()` runt ett klick på *Lägg in underlag…*.
  Stoppa servern med `pgrep -af "http.server 8765"` och `kill`, inte
  `pkill -f` (det stänger skalet).
- Testfiler att lägga in går snabbt att göra med reportlab (PDF), PIL
  (bild) och några rader text (DXF).
- Fasader och sektioner utan webbläsare: ett skript eller test med
  `buildSection` från `src/repr/section.ts`.
- Telefon: viewport 390 × 844, `is_mobile`, `has_touch`.
