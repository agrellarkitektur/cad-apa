# Bidra till cad-apa

Tack för att du vill bidra. Läs först `README.md` (vad som finns),
`docs/PLAN.md` (vad som byggs i vilken version) och `docs/UTVECKLING.md`
(filformatet, hur man lägger till objekttyper). Inriktningen är små svenska
projekt fram till en bygglovshandling; det som inte behövs för det väntar.

## Avtal om bidrag (CLA)

Alla bidrag kräver att du godkänner vårt **CLA**, `CLA.md`. Du behåller
upphovsrätten till ditt bidrag, men ger Agrell Arkitektur rätt att
licensiera det också under andra villkor än AGPL. Det är vad som gör det
möjligt att sälja kommersiella undantag och att hålla ihop projektet;
bidraget finns alltid kvar under AGPL-3.0 för alla andra.

När du öppnar en pull request ber CLA Assistant dig godkänna avtalet med en
länk. Det görs en gång. En DCO (*Signed-off-by*) räcker inte, eftersom den
inte ger rätt att licensiera om.

## Så går det till

1. Öppna gärna ett ärende (issue) först och beskriv vad du vill ändra.
2. Gör en gren, och kör `npx tsc --noEmit && npx vitest run` innan du skickar
   en pull request. Prestandatestet (`tests/prestanda.test.ts`) ska gå igenom.
3. Nya källfiler börjar med licenshuvudet:

   ```ts
   // SPDX-License-Identifier: AGPL-3.0-or-later
   // Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur
   ```

4. Lägger du till ett bibliotek, ett typsnitt eller någon annan tillgång:
   kontrollera att licensen är förenlig med AGPL-3.0 (MIT, BSD, ISC,
   Apache-2.0, LGPL, GPL-3.0, AGPL-3.0, MPL-2.0, SIL OFL fungerar;
   GPL-2.0-*only*, proprietära och "non-commercial"-licenser fungerar inte),
   skriv in den i `THIRD-PARTY.md` och lägg licenstexten i `LICENSES/`.
5. Texten i appen är på svenska, utan engelska ord.

## Namn och varumärke

Namnen cad-apa och Bacchus och deras logotyper får inte användas för
ändrade versioner utan skriftligt tillstånd.

## Frågor

kontakt@agrellarkitektur.se
