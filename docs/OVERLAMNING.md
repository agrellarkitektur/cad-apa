# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 19 oktober 2026, efter 0.8 del 1.

## Läget

- **0.8 byggs i tre delar** och släpps som 0.8.0 när alla är klara (Carl
  August ville ha granskningen av 0.7.1 i 0.8.0 i stället för en 0.7.2).
  **Del 1 är byggd** och ligger på `main`; versionen heter `0.8.0-del.1`
  och demon visar den (https://claude.ai/artifact/2m7gq5gkkgSP2wFZ7fLGNJ).
  Filformatet är **5**. Ingen tagg eller release förrän 0.8.0 är klar.
- Vad del 1 innehåller står i README (*Version 0.8, del 1 av 3*), hur det
  är byggt i UTVECKLING.md (*Ritningsinformation, synlighet och
  projektträdet*), och allt som är bestämt framåt i `docs/PLAN.md`.
- Besluten från granskningen (19 oktober) står i PLAN.md: småpunkterna
  under 0.8, Plot/export i del 3, dumbs i 0.10, smartgrupper i 0.13,
  medelmarknivå i 0.9 och 0.15, areor enligt SS 21054 i 0.11 (han laddar
  upp standarden då), lokalisering under *Avvaktar* och principen *Regler
  per land*.

## Nästa session: 0.8 del 2

Börja med det som blev kvar från del 1:

1. Grepp i sektioner: dra i nocken för att ändra taklutningen, och i
   takfoten (PLAN.md, del 1).
2. Grepp och Modifiera för 2D-elementens punkter (i dag kan de flyttas
   hela, och ändras i egenskaperna, men punkterna går inte att dra).

Sedan del 2 enligt PLAN.md: underlag (PDF som bild, bilder, DXF) med
kalibrering, flytta, låsa och tona, och arbetsblad. Formatet finns redan:
`assets` för filerna, underlag som element med `locked`, `worksheets`
och `space` för det som ritas på ett arbetsblad. Underlag och arbetsblad
ska ligga i flikarna Underlag och Modell i projektträdet, i mappar som
allt annat.

Fråga Carl August innan något byggs (CLAUDE.md), men del 2 är redan
godkänd i sak.

## Öppna frågor och kända begränsningar

- **Synpunkter på webbhotellet:** han har laddat upp `feedback-config.php`
  i mappen ovanför `cad-apa`, men formuläret öppnade e-posten. Sedan del 1
  visar formuläret vad servern svarar (README, *Synpunkter*). Fråga vad
  det säger. Troligast är `from` en adress som inte finns (använd
  `kontakt@agrellarkitektur.se`), eller att webbhotellet stoppar `mail()`
  och kräver SMTP; då får `feedback.php` byggas ut. Skriptet kunde inte
  provas härifrån (nätet släpper inte fram till agrellarkitektur.se).
- **Visas i** räknar vyer utan att bry sig om tillstånd: ett 2D-element som
  bara finns i Förslag A räknas ändå i en vy av Befintligt.
- Vy-taggar ges i vyns inställningar i projektträdet. Modellvyerna (Plan 1
  · modell) har inga taggar, så ett element med taggar syns inte där;
  *Visa dolda 2D-element* under Visa visar dem tonade.
- En borttagen taklutning är dold för gott i den fasaden. Det finns inget
  sätt att få tillbaka den automatiska utom ångra.
- Den första fasaden eller sektionen tar 100–200 ms; testet som mäter
  tiden kan fela när alla tester körs samtidigt på en belastad maskin.
- Fönster saknar öppningssätt (del 3). Spårlinjerna kan kännas för
  klistriga (`TRACK_REACH` i `src/ui/tools/snap.ts`).
- Varningen för nästan raka vinklar gäller bara raka väggar.

## Arbeta i miljön

- Bygga och testa: se CLAUDE.md. Commit avslutas med raderna som
  sessionen anger (Co-Authored-By och Claude-Session), sedan
  `git fetch origin main` och `git push origin HEAD:main`. Releaser på
  GitHub gör Carl August själv.
- Demon: `npm run preview:artifact`, publicera `artifact/cad-apa.html` till
  artefakten ovan (samma URL).
- Titta på resultatet: `npm run preview:artifact`, servera `dist-artifact/`
  med `python3 -m http.server 8765` och styr med Playwright (Python).
  `window.bacchus` har `store`, `view`, `selection`, `ui`, `modifyPalette`,
  `view3d`, `plan`, `setTool`, `setMode` och `goTo` (t.ex.
  `goTo({kind:'marker', id:'sektion-a'})`). Stoppa servern med
  `pgrep -af "http.server 8765"` och `kill`, inte `pkill -f` (det stänger
  skalet).
- Fasader och sektioner utan webbläsare: ett skript eller test med
  `buildSection` från `src/repr/section.ts`.
- Telefon: viewport 390 × 844, `is_mobile`, `has_touch`.
