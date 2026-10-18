# cad-apa / Bacchus

Webbaserat ritprogram för små svenska arkitektkontor. Motorn heter Bacchus,
cad-apa är ett tillfälligt varumärke. Öppen källkod (GPL-3.0 eller senare).
Läs `README.md` (vad som finns, version för version), `docs/ARKITEKTUR.md`
(idé, principer och byggordning) och `docs/UTVECKLING.md` (filformat, hur man
lägger till objekttyper) innan du ändrar något.

## Arbetssätt med Carl August

- Svara på svenska.
- Kör inga uppdateringar, inte ens små, förrän han säger till. Diskutera först,
  sammanställ ändringarna, kör sedan.
- Håll isär stora uppdateringar (ändrar filformatet, `FORMAT_VERSION`) och små
  justeringar. Formatändringar samlas till nästa stora uppdatering.
- Bakåtkompatibilitet är mycket viktig: varje formatändring får en migrering i
  `src/storage/format.ts` och ett test som öppnar en fil i det gamla formatet.
- Avsluta varje svar med länken till demon:
  https://claude.ai/artifact/2m7gq5gkkgSP2wFZ7fLGNJ
- Han testar på iPhone 13 Pro med Chrome och Windows 11 med Chrome.

## Bygga och leverera

```
npm install
npx tsc --noEmit && npx vitest run   # typer och tester
npm run build                         # dist/ till webbhotellet
npm run preview:artifact              # artifact/cad-apa.html, en enda fil
```

Demon publiceras från `artifact/cad-apa.html` till artefakten ovan. Höj
versionen i `src/core/engine.ts` och `package.json` och skriv vad som är nytt
i README vid varje uppdatering.
