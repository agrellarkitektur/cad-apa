# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 19 oktober 2026, efter 0.7.1.

## Läget

- **0.7.1 är klar och släppt.** Commit `c4efed2` på `main`, taggen `v0.7.1`
  finns, och demon är version 17 av artefakten
  (https://claude.ai/artifact/2m7gq5gkkgSP2wFZ7fLGNJ). Filformatet är 4.
- **Efter 0.7.1:** `src/ui/app.ts` är uppdelad i delar under `src/ui/app/`
  (se UTVECKLING.md, *Appen*), utan att något ändrats i hur appen fungerar,
  och arbetssättet i CLAUDE.md har fått regler för sessioner och
  småversioner. Det ingår i nästa version; ingen egen release behövs.
- Vad 0.7.1 innehåller står i README (*Version 0.7.1*). Allt som är planerat
  framåt står i `docs/PLAN.md`, version för version.

## Nästa session: granskning av 0.7.1 → 0.7.2

Carl August skickar sina synpunkter på 0.7.1, gärna samlade och märkta *fel*
eller *önskemål*. Arbetsgång:

1. Läs synpunkterna och sortera: fel och små justeringar blir 0.7.2 (samma
   format, 3–6 punkter); större önskemål förs in i PLAN.md under rätt version.
2. Sammanställ och fråga innan något byggs (CLAUDE.md: inga uppdateringar
   förrän han säger till).
3. Bygg i snabbläge om ändringarna inte syns; annars med skärmbilder.

## Sedan: 0.8 i delar

0.8 ändrar filformatet (format 5) och är stor. Förslag att diskutera med
Carl August innan den börjar:

- **Del 1, i en egen session:** bestäm format 5 för allt 0.8 behöver på en
  gång (2D-element med *Visas i* och vy-taggar, penntabell och typsnitt i
  stilmallen, projektvinklar, markörstilar, underlag, arbetsblad och
  ritningsblad), med migrering 4 → 5 och test. Sedan 2D-elementen och
  synligheten, och mått och text i fasader och sektioner.
- **Del 2:** underlag (PDF som bild, bilder, DXF) med kalibrering, och
  arbetsblad.
- **Del 3:** ritningsblad, ritningshuvud, PDF-export, penntabellen,
  typsnitt, markörstilar, projektvinklar och den andra 2D-rutan (planen
  följer markeringen i en öppen sektion).

Formatet höjs bara en gång, i del 1, och släpps som 0.8 när alla delar är
klara. Däremellan kan demon visa del för del.

## Öppna frågor och kända begränsningar

- **Synpunktsformuläret** behöver `feedback-config.php` på webbhotellet
  (README, *Synpunkter*). Det finns ingen noreply-adress; använd en adress
  som finns, `'from' => 'kontakt@agrellarkitektur.se'`. Har han inte
  bekräftat att det fungerar: fråga.
- Fönster saknar öppningssätt (kommer i 0.8). Dörrarnas öppningssätt har
  spetsen mot handtagssidan.
- Spårlinjerna kan kännas för klistriga; det är det första att justera om
  han tycker det (`TRACK_REACH` i `src/ui/tools/snap.ts`).
- Klistra in från menyn läser datorns urklipp; nekar webbläsaren det används
  det som kopierats i samma flik. Ctrl+V fungerar alltid.
- Varningen för nästan raka vinklar gäller bara raka väggar; bågväggar
  räknas inte.
- Den första fasaden eller sektionen tar 100–200 ms (koden kompileras);
  sedan 30–60 ms. Testet mäter efter en uppvärmning.

## Arbeta i miljön

- Bygga och testa: se CLAUDE.md. Commit avslutas med raderna som
  sessionen anger (Co-Authored-By och Claude-Session), sedan
  `git fetch origin main` och `git push origin HEAD:main`. Releaser på
  GitHub gör Carl August själv.
- Demon: `npm run preview:artifact`, publicera `artifact/cad-apa.html` till
  artefakten ovan (samma URL).
- Titta på resultatet: `npm run preview:artifact`, servera `dist-artifact/`
  med `python3 -m http.server 8765` och styr med Playwright (Python).
  `window.bacchus` har `store`, `view`, `selection`, `ui`, `modifyPalette`
  och `view3d`. Stoppa servern med `pgrep -af "http.server 8765"` och
  `kill`, inte `pkill -f` (det stänger skalet).
- Fasader och sektioner utan webbläsare: ett skript med `buildSection` från
  `src/repr/section.ts` som körs med `npx vite-node`, och primitiverna
  skrivna som SVG.
- Telefon: viewport 390 × 844, `is_mobile`, `has_touch`.
