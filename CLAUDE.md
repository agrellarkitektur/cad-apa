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
- Inriktningen står överst i `docs/PLAN.md`: små svenska projekt, och närmast
  ett proof of concept fram till pilotprojektet (0.13). Föreslå inget som
  inte behövs för en bygglovshandling före piloten, utan lägg det under
  *Efter pilotprojektet*.
- Bakåtkompatibilitet: före formatfrysen (0.13) skrivs inga migreringar.
  Höj `FORMAT_VERSION` när formatet ändras och skriv den kortaste, bästa
  koden; äldre filer får ett meddelande om att de kommer från en äldre
  betaversion. Formatändringar behöver inte samlas till stora uppdateringar.
  Efter formatfrysen får varje formatändring en migrering i
  `src/storage/format.ts` och ett test som öppnar en fil i det gamla
  formatet.
- Han testar varje version på webbhotellet, via en release på GitHub som han
  gör själv. Ingen demo och ingen zip behövs. Demon byggs och publiceras
  bara när han ber om det (https://claude.ai/artifact/2m7gq5gkkgSP2wFZ7fLGNJ),
  och svaren behöver inte sluta med länken.
- När ändringar föreslås: säg hur stora de är och om de riskerar att behöva
  mer än en session. Föreslå hellre en mindre version, eller dela upp den,
  än att krama in för mycket.
- Han testar på Windows 11 med Chrome. Telefonen är inget mål: det som finns
  för telefon får ligga kvar men testas inte och styr inga beslut.
- Prestanda: `tests/prestanda.test.ts` ska gå igenom. Undvik algoritmer som
  prövar varje objekt mot alla andra; pröva bara grannar (`BoxIndex` i
  `src/geometry/boxIndex.ts`, eller `boxOf` och `boxesTouch` i
  `src/geometry/boolean.ts`). Ändringar i flera objekt görs i en
  transaktion, inte en per objekt.
- Ungefär var tredje version föreslås en granskningssession utan nya
  funktioner: städa, dela upp stora filer och leta efter långsam kod.
- En session per version. Småversioner (0.7.2 …) har 3–6 punkter. Säg till
  när chatten blir lång, och skriv då en överlämning i `docs/OVERLAMNING.md`.
- Snabbläge för småfixar: typer och tester räcker; skärmbilder bara
  när ändringen syns. README och versionsnummer uppdateras ändå.
- Nya delar av gränssnittet läggs som egna filer i `src/ui/app/`, inte i
  `src/ui/app.ts` (se UTVECKLING.md).

## Bygga och leverera

```
npm install
npx tsc --noEmit && npx vitest run   # typer och tester
npm run build                         # dist/ till webbhotellet
npm run preview:artifact              # demon: artifact/cad-apa.html, bara på begäran
```

Testa mot `dist/` (det som hamnar på webbhotellet), se
`docs/OVERLAMNING.md`. Demon (`npm run preview:artifact`, publiceras från
`artifact/cad-apa.html` till artefakten ovan) bara på begäran. Höj versionen
i `src/core/engine.ts` och `package.json` och skriv vad som är nytt i README
vid varje uppdatering.
