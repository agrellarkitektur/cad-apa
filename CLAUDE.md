# cad-apa / Bacchus

Webbaserat ritprogram för små svenska arkitektkontor. Motorn heter Bacchus,
cad-apa är ett tillfälligt varumärke. Öppen källkod (GPL-3.0 eller senare).
Läs `README.md` (vad som finns, version för version), `docs/PLAN.md` (vad som
byggs i vilken version), `docs/ARKITEKTUR.md` (idé och principer) och
`docs/UTVECKLING.md` (filformat, hur man lägger till objekttyper) innan du
ändrar något. Planen räknas i versioner, aldrig i steg. Läs också
`docs/OVERLAMNING.md`: där står läget just nu och vad nästa session ska göra.

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
- En session per version. Småversioner (0.7.2 …) har 3–6 punkter. Säg till
  när chatten blir lång, och skriv då en överlämning i `docs/OVERLAMNING.md`.
- Snabbläge för småfixar: typer, tester och demon räcker; skärmbilder bara
  när ändringen syns. README och versionsnummer uppdateras ändå.
- Nya delar av gränssnittet läggs som egna filer i `src/ui/app/`, inte i
  `src/ui/app.ts` (se UTVECKLING.md).

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
