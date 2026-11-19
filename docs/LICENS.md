# Licensbeslut: AGPL-3.0 + kommersiella undantag

*19 november 2026. Gäller cad-apa och är skrivet för att kunna kopieras rakt in i Sisyfos och Höjdkurvor. Det som skiljer mellan projekten står bara i tabellen under "Projektspecifikt". Samma text som `cad-apa-licens.md` i projektets kunskapsbas; genomfört i cad-apa 0.12.5.4.*

## Beslutet i korthet

1. **Licens: GNU AGPL-3.0-or-later** (ersätter GPL-3.0).
2. **Kommersiella undantag** säljs av Carl August Agrell / Agrell Arkitektur till den som vill bygga in koden i något stängt.
3. **Bidrag från andra kräver ett CLA**, så att möjligheten att sälja undantag finns kvar.
4. **Namnen skyddas separat**. Licensen täcker koden, inte namnet.
5. **Finansiering** sker via frivilliga bidrag från privatpersoner och supporteravtal med företag. Inga funktioner läggs bakom betalning.

## Varför inte GPL-3.0

GPL-3.0 kräver bara att källkoden delas när programmet *distribueras*. En webbapp som körs på någon annans server distribueras aldrig till användaren. Någon kan alltså ta koden, ändra lite, stänga in den och sälja den som betaltjänst utan att dela en rad. AGPL-3.0 är GPL-3.0 plus ett tillägg (§13): den som låter användare köra en ändrad version över nätet måste erbjuda dem hela källkoden.

## Vad målet är

- Personer och företag ska kunna **använda** programmen fritt, även i betalda uppdrag. Att spara pengar på dem är hela poängen.
- Ingen ska kunna **ta koden, stänga in den och sälja den**.
- Det ska vara **enkelt och riskfritt att gå över** från de stora kommersiella programmen.

## Vad det betyder för olika grupper

| Vem | Vad som gäller |
|---|---|
| Arkitektkontor och privatpersoner som använder programmet | Inga skyldigheter alls. Fri användning, även kommersiellt. |
| Den som kör en **oförändrad** version på egen server | Fritt. Länken till källkoden ska finnas kvar. |
| Den som kör en **ändrad** version som tjänst | Måste erbjuda användarna sin ändrade källkod under AGPL. |
| Den som vill bygga in koden i en **stängd** produkt eller tjänst | Måste köpa ett kommersiellt undantag av Agrell Arkitektur. |

**Säljargument för riskfri övergång:** koden kan aldrig låsas in. Om Agrell Arkitektur slutar utveckla programmet kan vem som helst fortsätta köra det och vidareutveckla det, och användarnas ritningar och data blir aldrig gisslan.

## Kommersiella undantag ("selling exceptions")

- Bara upphovsrättsinnehavaren kan bevilja undantag. Den som själv har fått koden under AGPL kan inte göra det.
- FSF, organisationen bakom GPL, beskriver och godtar upplägget i Richard Stallmans text *Selling Exceptions to the GNU GPL*. Kända exempel är MySQL och Qt.
- Formellt heter det att *sälja undantag* och inte dubbellicens, eftersom koden bara släpps under en licens (AGPL). I vardagligt tal säger man ändå ofta "dual licensing".
- Avtalet skrivs först när någon hör av sig, gärna med hjälp av en jurist.
- Stora företag som Google förbjuder AGPL-kod helt internt. De kommer alltså inte att använda koden gratis. Målgruppen för undantag är främst mellanstora företag som vill bygga in programmet i egna produkter.

**Om uppköp:** AGPL hindrar inte ett uppköp. Den som köper projektet köper upphovsrätten och kan då själv välja licens för framtida versioner. Det förutsätter att Agrell Arkitektur äger hela koden, vilket är ytterligare ett skäl till CLA. Redan släppta versioner förblir AGPL för alla som har dem.

## Bidrag och CLA

- Den som bidrar med kod behåller upphovsrätten till sitt bidrag. Utan avtal kan Agrell Arkitektur inte sälja undantag för den delen.
- Därför ska alla externa bidrag ske under ett **CLA (Contributor License Agreement)**. I det ger bidragsgivaren Agrell Arkitektur rätt att licensiera bidraget även under andra villkor än AGPL.
- På GitHub kan det skötas automatiskt med till exempel CLA Assistant: bidragsgivaren godkänner en gång via en länk i pull requesten.
- En DCO ("Signed-off-by") räcker *inte*, eftersom den inte ger rätt att licensiera om.

## Beroenden och tredjepartstillgångar

Kontrollera att alla tredjepartsbibliotek och tillgångar har licenser som är förenliga med AGPL-3.0:
- **Fungerar:** MIT, BSD, ISC, Apache-2.0, LGPL, GPL-3.0, AGPL-3.0, MPL-2.0, SIL Open Font License.
- **Fungerar inte:** GPL-2.0-*only*, proprietära licenser, "non-commercial"-licenser.
- Kommersiella undantag gäller bara Agrell Arkitekturs egen kod. Ett undantag kan inte omfatta någon annans GPL-kod.
- Lista alla tredjepartstillgångar med licens i en fil, till exempel `THIRD-PARTY.md`, och behåll deras licenstexter i repot.

### Typsnitten (cad-apa)

| Typsnitt | Användning | Licens | Bedömning |
|---|---|---|---|
| osifont | Ritningens text (ISO 3098) | GPL-3.0 med typsnittsundantag | Ingen risk, se nedan |
| Archivo | Gränssnittet | SIL OFL | Ingen risk |
| IBM Plex Mono | Gränssnittet | SIL OFL | Ingen risk |
| Arimo, Josefin Sans | Valbara typsnitt i PDF:en | SIL OFL | Ingen risk |

**osifont:**
- **Ritningarna:** Typsnittsundantaget (font exception) betyder att dokument där typsnittet bäddas in, som PDF:er och utskrifter, *inte* blir GPL. Användarnas ritningar påverkas alltså inte.
- **Appen:** GPL-3.0 och AGPL-3.0 är uttryckligen förenliga, så osifont kan följa med cad-apa under AGPL.
- **Kommersiella undantag:** osifont ingår inte i ett sålt undantag. Typsnittet är en separat fil som appen läser in, inte kod som blandas med vår. En köpare kan därför antingen skicka med osifont oförändrat under dess egen licens eller byta till ett annat typsnitt. Skriv det i avtalet.
- **Krav:** behåll osifonts licenstext och upphovsrättsrader, och tacka på Om-sidan som i dag.

## Varumärke

Licensen skyddar inte namnen. Lägg in en rad i README om att projektets namn och logotyp inte får användas för ändrade versioner utan tillstånd. Registrering av varumärket kan bli aktuellt om projektet växer.

## Finansiering: stöd och supporteravtal

Två flöden, eftersom privatpersoner och företag har olika behov:

| | Privatpersoner | Företag |
|---|---|---|
| Form | Frivilligt bidrag, inget i utbyte | Supporteravtal, till exempel ett årsbelopp |
| Betalning | Swish-QR på Om-sidan (Swish Företag), GitHub Sponsors för utlandet | Faktura |
| Moms | Troligen ingen (gåva utan motprestation) | 25 % (företaget drar av den) |
| Motprestation | Ingen, bara ett tack | Logga på supportersidan, eventuellt prioriterad felrapportering |
| Kvitto | Inget krav, kvitto erbjuds på begäran | Fakturan |

- **Inkomstskatt:** alla bidrag är skattepliktig intäkt i näringsverksamheten, även om de kallas gåvor.
- **Moms:** ett helt frivilligt bidrag utan motprestation är troligen inte omsättning och därmed momsfritt. Får givaren något tillbaka blir det en försäljning med moms.
- **Företag** kan i praktiken inte swisha, och en gåva är inte avdragsgill för dem. Därför gäller faktura och supporteravtal.
- **Kassaregister:** Swish räknas som kortbetalning, men rena gåvor är ingen försäljning och betalning via webben omfattas normalt inte. Gränsen är dessutom fyra prisbasbelopp per år.
- **Bokföring:** Swish-notisen räcker inte som underlag. Spara bankens Swish-rapport.
- **Trappan för företag:** stöd → support → kommersiellt undantag. Allt går till kontakt@agrellarkitektur.se.
- **Ton:** säg "Stöd utvecklingen", inte "donation". Inga funktioner bakom betalning och inget tjat.
- **Att stämma av** med revisor eller Skatteupplysningen innan start: att Swish-bidragen kan bokföras som momsfria gåvor, och om de ska hållas isär från arkitektverksamheten med eget Swish-nummer.

## Genomförande: checklista per repo

- [x] Ersätt `LICENSE` med den officiella AGPL-3.0-texten (https://www.gnu.org/licenses/agpl-3.0.txt), oförändrad.
- [x] Sätt licensfältet i `package.json` (eller motsvarande) till `"AGPL-3.0-or-later"`.
- [x] Byt licenshuvuden i källfilerna till `// SPDX-License-Identifier: AGPL-3.0-or-later` plus copyrightrad.
- [x] Lägg till en **länk till källkoden i själva appen**, till exempel i sidfot eller "Om"-ruta. Det är kärnan i AGPL §13, och den ska följa med i ändrade versioner.
- [x] Lägg in licensavsnittet i README (mall nedan).
- [ ] Skapa `CONTRIBUTING.md` med CLA-krav och koppla CLA Assistant om repot ligger på GitHub. *(cad-apa: CONTRIBUTING.md och CLA.md finns; kopplingen och juristens granskning återstår.)*
- [x] Gå igenom beroendenas och tillgångarnas licenser och skriv `THIRD-PARTY.md`.
- [x] Lägg till sektionen **Stöd utvecklingen** på Om-sidan (Swish-QR, med platshållare tills Swish Företag finns, och kontakt för supporteravtal). Texten skriver Carl August själv efter stödord. I Höjdkurvor får Claude skriva den direkt. *(cad-apa: Claude skrev texten på Carl Augusts begäran, Swish som planerat med kontakt till dess; han skriver om den på stället.)*
- [x] Notera i ändringsloggen från vilken version AGPL gäller. Tidigare versioner är fortfarande GPL-3.0.

### Så gjordes det i cad-apa (0.12.5.4, 19 november 2026)

Kan följas i Sisyfos och Höjdkurvor.

- **LICENSE:** gnu.org:s `agpl-3.0.txt`, 661 rader och 34 523 byte. Den gamla GPL-texten flyttades till `LICENSES/GPL-3.0.txt`, eftersom osifonts licens hänvisar till den och tidigare versioner är GPL.
- **Licenshuvudet** i alla källfiler (ts, css, py, php, html, yml), två rader: `SPDX-License-Identifier: AGPL-3.0-or-later` och `Copyright (C) 2026 Carl August Agrell / Agrell Arkitektur`. Tredjepartsfiler (typsnittens data) får sin egen licens i huvudet, aldrig vår copyrightrad.
- **Källkodslänken** går till commiten bygget gjordes från (`VITE_SOURCE_COMMIT` i `vite.config.ts`, ur `GITHUB_SHA` på GitHub, annars `git rev-parse HEAD`). Den står i Om-rutan och som *Källkoden* i menyn (`src/ui/app/sourceLink.ts`).
- **THIRD-PARTY.md** med bibliotek, typsnitt och underlag, och licenstexterna i `LICENSES/`. Alla beroenden var förenliga: three.js och Workbox (MIT), pdf.js (Apache-2.0), earcut (ISC), polygon-clipping och splaytree (MIT), robust-predicates (Unlicense), typsnitten OFL och osifont GPL-3.0 med typsnittsundantag.
- **CONTRIBUTING.md** och **CLA.md** (utkast på engelska med svensk sammanfattning: upphovsrätten kvar hos bidragsgivaren, rätt för Agrell Arkitektur att licensiera om och att överlåta vid ett uppköp, löfte om att varje version också finns under AGPL, svensk lag).
- **Stöd utvecklingen** i `src/ui/app/supportSection.ts`: fälten `intro`, `private`, `business`, `swishQr` och `sponsorsUrl`. Avsnittet syns bara när `intro` är ifylld; utan `swishQr` står en platshållare.
- **Taggar och releaser:** en pushad tagg `v<version>` ger en release med README:s avsnitt som text (`release.yml`).

### Kvar för Carl August (cad-apa)

1. **Koppla CLA Assistant:** logga in på https://cla-assistant.io med GitHub, lägg `CLA.md` i en gist (gist.github.com), välj repot och gisten. Efter juristens granskning, eller nu med utkastet om ett bidrag kommer innan dess.
2. **Juristen:** CLA.md och avtalet om kommersiellt undantag.
3. **Revisorn eller Skatteupplysningen:** Swish-bidragen som momsfria gåvor och om de ska ha ett eget Swish-nummer.
4. **Swish-QR:n** när Swish Företag är tecknat (bilden i `public/`, namnet i `swishQr`), och Stöd-texten i egna ord om du vill.

## Mall: licensavsnitt i README

> **Licens**
> [Projektnamn] är fri programvara under GNU Affero General Public License v3.0 eller senare (AGPL-3.0-or-later). Du får använda, studera, ändra och dela programmet fritt, även i kommersiellt arbete. Kör du en ändrad version som tjänst måste du erbjuda användarna din källkod.
>
> **Kommersiell licens**
> Vill du bygga in [projektnamn] i en produkt eller tjänst utan AGPL:s villkor finns kommersiella licenser. Kontakta kontakt@agrellarkitektur.se.
>
> **Namn och varumärke**
> Namnet [projektnamn] och dess logotyp får inte användas för ändrade versioner utan skriftligt tillstånd.
>
> **Bidrag**
> Bidrag välkomnas och kräver att du godkänner vårt CLA, se CONTRIBUTING.md.

## Projektspecifikt

| Projekt | Projektnamn i mallen | Skyddade namn | Tredjepartstillgångar att kolla | Repo / anm. |
|---|---|---|---|---|
| cad-apa | cad-apa | cad-apa, Bacchus | osifont (GPL-3.0 + typsnittsundantag), Archivo, IBM Plex Mono, Arimo och Josefin Sans (OFL) | agrellarkitektur/cad-apa; genomfört i 0.12.5.4 utom CLA Assistant och Swish-QR:n |
| Sisyfos | Sisyfos | Sisyfos | | |
| Höjdkurvor | Höjdkurvor | Höjdkurvor, höjdkurvor.se | Lantmäteriets data (egna villkor, ej kod) | |

*Sisyfos och Höjdkurvor: kopiera hela dokumentet, byt "cad-apa" i rubrik och inledning, ta bort avsnittet om cad-apas typsnitt och fyll i er rad i tabellen.*

## Källor

- Richard Stallman / FSF: *Selling Exceptions to the GNU GPL*: https://www.gnu.org/philosophy/selling-exceptions.html
- GNU AGPL-3.0, licenstext: https://www.gnu.org/licenses/agpl-3.0.html
- GNU GPL FAQ om typsnittsundantaget: https://www.gnu.org/licenses/gpl-faq.html#FontException
- Googles AGPL-policy: https://opensource.google/documentation/reference/using/agpl-policy
- Heather Meeker: *AGPL in the Light of Day*: https://heathermeeker.com/2023/10/13/agpl-in-the-light-of-day/
- Skatteverket om kassaregister och Swish: https://www.skatteverket.se/foretag/drivaforetag/kassaregister

*Underlaget är inte juridisk rådgivning eller skatterådgivning. Låt en jurist granska det kommersiella avtalet och CLA-texten, och en revisor bokföringen av bidragen, innan de används.*
