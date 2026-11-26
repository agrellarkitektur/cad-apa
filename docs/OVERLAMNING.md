# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning och hålls kort: historiken finns i git, Claudes val och det
som inte gjordes i PLAN.md (klara versioner i `docs/arkiv/`), koden i
UTVECKLING.md (äldre i `docs/arkiv/`), och där också **Arbeta
i sandlådan** (bygga, Playwright, klickjämförelsen, mätningar) och
**Kända begränsningar**. Vad varje version märks i ritningarna står i
README. PLAN.md och UTVECKLING.md ligger i `docs/`. Senast: 26 november
2026, efter granskningen 26 november och 0.12.5.9 (sparandet); nästa är
Carl Augusts provning av 0.12–0.12.5.9, sedan **Förarbete för IFC** och
0.12.6 IFC.

## Läget

- **0.12.5.9 Sparandet** (26 november, samma format 28; snabbfix ur
  granskningen, drift 1, 2, 3 och 11): ett autospar som inte går att öppna
  läggs undan **med besked** och *Spara som fil*, menyraden **Undanlagda
  autospar…**, de fem senaste sparas; `normalize` **behåller okända
  fält** (en äldre cachad version kastade förut `guids` och nya fält ur
  filen); **räddningsrutan** när appen inte startar (`main.ts` fångar
  `mountApp`); `null` i listorna hoppas över; *skadad eller ofullständig*.
  Koden i `src/ui/app/setAside.ts`, `format.ts` (`DOC_KEYS`,
  `PROJECT_KEYS`) och `localStore.ts`. Testerna: 1040 (`v01259.test.ts`,
  `fake-indexeddb`). Provat i Chrome mot `dist/`: beskedet med ett
  autospar i format 27, menyraden (nedladdning), räddningsrutan med en
  vägg utan start och *Börja med exemplet*. Claudes val och *Inte gjort* i
  PLAN.md.
- **Granskningen 26 november** (bara rapporter, mot 0.12.5.8): fyra spår
  och en sammanställning i projektet, `cad-apa-granskning-1126-regler`,
  `-ifc`, `-dokument`, `-drift` och **`-sammanstallning`** (tabellen
  *Ordning*, 1–10). Punkt 1 (dokumenten) och 2 (sparandet) är gjorda.
  **Carl Augusts svar 26 november:** **A** *Förarbete för IFC* före 0.12.6;
  **B** väggtypens skikt stryks ur 0.12.6 (egen version senare om de
  behövs); **C** fönsterdörren och glaspartiet: bredden avgör, en nisch
  under 1,50 m mäts inte, så räknar koden redan, **A3 stryks**; **D**
  räckeshöjden 900 när våningshöjden är högst 3,0 m och räcket står
  inomhus, annars 1 100 (med *Varningarnas texter*); **E** (ordet
  *Uppställd*) obesvarad. Allt i PLAN.md, *Granskningen 26 november*. Han
  vill bli påmind om att inte lägga till mer före det som är planerat.
- **Arbetsfördelningen mot Höjdkurvor** (Carl August 24 november, ersätter
  26 oktober): cad-apa äger modellen och ritningarna, Höjdkurvor platsen
  och **analyserna**; analyser byggs inte två gånger. Skissen skickas
  enkelriktat som låst ögonblicksbild (*Analysera i Höjdkurvor…* i
  logotypmenyn, planerad), inget kommer tillbaka utom bilder och
  rapporter. I PLAN.md under *Framåt*.
- **Inkorgen 20 november** har fyra osorterade punkter (detaljerade träd
  från Höjdkurvor, byggnadshöjder ur importen, Tab för väggslingan, linjer
  tunna i AutoCAD-färg). Sortera med honom.
- **0.12.5.7 Summor enligt SS 21054** (19 november, samma format 28):
  areornas summor och delsummor i hela m² i alla förteckningar, en femma
  uppåt, omkretsen med två decimaler, inställningen *Areornas summor med en
  decimal* som avvikelse. **Carl August:** standarderna följs som förval,
  gärna med inställningar för att avvika. SS 14141 är upphävd (oktober
  2026); en femma avrundas uppåt. Testerna: 1028.
- **0.12.5.6 Granskning efter 0.12** (19 november, samma format 28, en
  session utan frågor; Claudes val och *Inte gjort* i PLAN.md, koden och
  **mätningarna** i UTVECKLING.md). Del 1 (syns inte): lagerregeln med
  test och den nya mappen `src/edit/`, cirkelimporterna (bara
  `graphics` ↔ `viewCategories` kvar), 376 privata exporter, sex stora
  filer delade, **differentialtestet** i testerna (`tests/differential.test.ts`),
  README kortad till 515 rader (0.1–0.11.8.4 i
  `docs/arkiv/README-0.1-0.11.md`), arbetsflödena låsta på commit,
  klickjämförelsen med steg för 0.12. Del 2 (syns): **rumsnumren på plan 2**
  (differentialtestet hittade att de kunde bli 11xx), varningarna för **fri
  höjd i dörrar** (2 kap. 25 §, mätt från golvet) och **horisontella
  öppningar i räcken** (11 § 5), linjetypsnamnen i DXF, trasiga filer,
  *Öppna* som hängde, rivna väggar i 6-meterszonen, mobilmeningen.
  Testerna: 1025. Klickjämförelsen mot 0.12.5.5 visar bara det väntade.
  **Hittat, inte rättat:** `outsideSide` räknar alla väggar oavsett
  tillstånd (en riven tillbyggnad gör väggen mot den till innervägg);
  föreslås som en egen liten version. **Förslag ur mätningarna:**
  autosparet skriver underlagen vid varje ändring (ca 4 ms per MB, två
  gånger med en öppen fil); spara dem för sig innan ortofotot i full
  upplösning (liten–mellan).
- **Granskningen efter 0.12.5.4 och 0.12.5.5** (19 november, samma format
  28). Granskningen var bara en rapport: **`cad-apa-granskning-0.12.md`** i
  projektet (fynden A–E, rangordnade). **0.12.5.5** rättade samma dag det
  som bör vara rätt före IFC: DXF:s boolska gruppkoder som heltal (`ezdxf`
  läser exporten utan fel), GUID sparas vid export och behålls för borttagna
  objekt, licenstexterna i `dist/`, de gamla versionsnumren i appens texter,
  CSV-talen. Varningarna efter Carl Augusts besked: balkongdörrar och
  fönsterdörrar över marken varnas (*Utfallsskydd* tystar, nytt fält för
  dörrar), glipan under ett barnsäkert räcke 50 mm med **Kvittera** i
  räckets egenskaper, fri passage enligt **SS 91 42 21:2006 normalnivå**
  (800 entrédörr och dörr till balkong/uteplats = 10M, 760 innerdörr = 9M;
  den höjda nivån för arbetsplatser har 800 också för innerdörrar; texten
  hänvisar fel enligt granskningen 26 november, V4),
  spiraltrappans fria höjd enligt 2 kap. 25 §. Testerna: 1014 på ca 13 s.
  Provat i Playwright mot `dist/` (export, GUID efter omladdning). Det som
  var kvar gjordes i 0.12.5.6. Carl August: funktionsmåtten för dörrar är
  viktiga och ska stämma när man ritar dörrar (de fria ytorna a och b vid
  dörren är inte byggda än; föreslå dem till granskningen eller en egen
  liten version, med hans skärmklipp ur standarden som underlag).
- **0.12.5.4 Licensen är klar** (19 november, samma format 28): AGPL-3.0
  eller senare enligt `docs/LICENS.md` (= `cad-apa-licens.md`, checklistan
  avbockad). LICENSE är gnu.org:s text, GPL-texten i `LICENSES/GPL-3.0.txt`
  (osifont, versionerna före). SPDX-huvud i alla källfiler, *Källkoden* i
  menyn och Om-rutan till byggets commit, `THIRD-PARTY.md` och
  `LICENSES/`, `CONTRIBUTING.md`, `CLA.md` (utkast). *Stöd utvecklingen*
  i Om-rutan, texten i `src/ui/app/supportSection.ts`, skriven av Claude
  på hans begäran; han skriver om den på stället. Testerna: 1008. Provat i
  Playwright mot `dist/` (menyn, Om-rutan med Stöd-avsnittet).
  **Kvar för Carl August:** Stöd-texten i egna ord om han vill, Swish-QR när Swish Företag finns,
  koppla CLA Assistant (cla-assistant.io, gist med `CLA.md`), juristen
  (CLA, avtalet om undantag), revisorn (Swish-bidragen). Sisyfos och
  Höjdkurvor görs i sina egna sessioner efter avsnittet *Så gjordes det i
  cad-apa* i `docs/LICENS.md`.
- **Flytten till cad-apa.danaid.cloud** (`docs/FLYTT.md`, tabellen *Ordning
  för flytten*): 0.12.5.2 (18 november) tar emot Höjdkurvor från
  hojdkurvor.danaid.cloud och publicerar parallellt till VPS:en. **0.12.5.3**
  (19 november, samma format 28): raden *cad-apa flyttar* på den gamla
  adressen med *Spara som fil* (`src/ui/app/moveNotice.ts`,
  `allLocalEntries` i `localStore.ts`; `?flytt` visar den var som helst),
  `MIME-Version: 1.0` i `feedback.php`, `navigateFallbackDenylist` för
  `.php` i `vite.config.ts`. Testerna: 1006. Provat i Playwright mot
  `dist/` (en fil, zip med mall och trasigt autospar, tomt, stäng). Kvar:
  Carl Augusts provning (steg 8), sedan Höjdkurvor (steg 9) och efter en
  tid omdirigeringen och borttagningen av FTP (steg 10).
- **IFC-utredningen är klar** (13 november, en egen chatt, ingen kod i
  appen): **`cad-apa-ifc-utredning.md`** i projektet är specifikationen för
  **0.12.6 IFC** (stor, en session) och **0.12.6.1 IFC, resten**
  (mellanstor). Jämförd med Carl Augusts export ur Archicad 27 (företagets
  översättare, Reference View; BIP-egenskaper, förteckningarna som egna
  uppsättningar, SB11-lager, allt trianglat, inga rum). Provfilen
  `docs/ifc/provhuset.ifc` (och `provfil.py`, bara ett prov) är godkänd av
  IfcOpenShell 0.9 med reglerna och läses av web-ifc; volymerna stämmer.
  **buildingSMARTs valideringstjänst** (Carl August 13 november) fann fel
  som IfcOpenShell släppte igenom (punktlistans fält, utfasat STANDARD,
  typens företräde, Pset-datatyper, Qto utan BaseQuantities, huvudet). Alla
  rättade; den egna kontrollen `docs/ifc/strikt.py` (med buildingSMARTs
  `pset_definitions.csv`) hittar dem och är förlagan till appens test.
  buildingSMARTs regelkod får inte köras i arbetsmiljön. **Carl August
  validerar den rättade filen igen** (väntat: bara GRF003, inget
  koordinatsystem) och öppnar den i Archicad, Revit, Solibri och SketchUp;
  fråga hur det gick innan skrivaren byggs. Frågorna A–E står i utredningen och nedan.
  **Utredningen stämmer inte med koden på några punkter** (skikten,
  workern, källorna för IsExternal och förteckningens fält):
  `cad-apa-granskning-1126-ifc.md` gäller före utredningen där de skiljer
  sig. Export-utredningens IFC-avsnitt är föråldrat; IFC-utredningen gäller.
- **Ny ordning** (Carl August 13 november): **0.12.6 IFC**, **0.12.7
  Utgåvor och PM**, **0.12.8 3D-vyer**, **0.12.9 Markförändringar**.
  Markförändringarna väntar på att Höjdkurvor kanske kan leverera en
  **jorddjupsmodell** (berg under jorden); då räknas berg och jord ur ytor
  i stället för procentsatsen per objekt. Schakt och fyll per objekt räknas
  redan sedan 0.10.13 (`finishedGround`, `massBalance`). Ändrat i PLAN.md,
  README:s rad 9 och synpunkterna; appens texter rättade i 0.12.5.5.
- **0.12.5 Förteckningen per littera är klar** (12 november, samma format
  28; valfria fält förteckningens `layout`, `figureScale`, `noFigure`,
  `hideEmpty` och bladvyns `maxWidth`), byggd i en session efter Carl
  Augusts svar A–E. Dörr- och fönsterförteckningarna har valet *Uppställd*:
  **Per littera** (förval för nya; fälten som rader, en kolumn per littera,
  ritningen sedd utifrån med karmyttermåtten, rutor som skriver på alla
  objekt med litteran, föreskrifter till höger) eller **Som tabell**
  (0.12.2). Testerna: 1003 på ca 16 s. Provat i Playwright mot `dist/`
  (exemplets fönster och dörrar, skriva i rutor med Tab och Enter,
  föreskrifter, skalan, på ett blad). Inte öppnat som PDF eller DXF utöver
  testerna. Claudes val och det som inte gjordes i PLAN.md, koden i
  UTVECKLING.md.
- **Ordet** (Carl August 12 november): listorna heter **förteckningar**.
  En **uppställning** är en elevation av en byggdel eller ett rum (kök,
  badrum) och finns inte i appen än; säg aldrig uppställning om en
  förteckning. Bytt i appen (*Förteckningens fält*), README, PLAN.md,
  UTVECKLING.md och projektdokumenten.
- **0.12.5.1** (12 november): **grindförteckningen från 0.12.2 är
  borttagen** på Carl Augusts begäran (källan `Gate`). Grindar sätts ut i
  staket och redovisas i planen, det räcker; en grind ritas vid behov för
  sig. En grindförteckning i en äldre fil läses inte in. Testerna: 1003.
  `cad-apa-synpunkter.md` och `cad-apa-dorrar-fonster-utredning.md`
  (26 november, med en rad överst om vad som gäller) är rättade.
- **Märks i hans ritningar efter 0.12.5:** *Ny: Fönster* eller *Dörrar*
  under Förteckningar ger förteckningen per littera. De framräknade fälten
  (utförande, öppningssätt, öppningsbredd och -höjd, poster, spröjs,
  karmdjup, väggtjocklek) är ifyllda, också i tabellerna från 0.12.2 (förut
  `-`). Egenskapernas och stilbokens rubrik heter *Förteckningens fält*.
- **0.12.4.1 är klar** (11 november, buggfix efter en granskning av repot
  och projektdokumenten; samma format 28). Areastämpeln i planen räknades
  inte om när ett markobjekt ändrades (`planReads` i `src/elements/area.ts`
  saknade `Ground` och `Terrain`; test i `tests/v0124.test.ts`).
  `publicera.yml` har `security: strict` och uppladdningssteget låst på en
  commit; **går en publicering inte igenom på certifikatet**, skriv
  leverantörens värdnamn i secret `FTP_SERVER` (inte tillbaka till `loose`
  utan att fråga). README:s exempel för `feedback-config.php` har
  exempeladresser. Testerna: 997. Kvar från granskningen, till
  *Granskning efter 0.12*: byggverktygens sårbarhetsvarningar (via
  `vite-plugin-pwa`, följer inte med i appen), huvudpaketet på 1,77 MB och
  README:s längd (äldre versioner till `docs/arkiv/`).
- **0.12.4 Areor under snedtak och mark är klar** (10 november, samma
  format 28; valfria fält areans `heightSplit`, takets `dormer`), byggd i
  en session efter Carl Augusts svar A–E: A takkupan som kryss (prova), B
  H/L som kryss, C terrängen räcker (inget kryss *Mot annan byggnad*), D BOA
  bortom 6-meterszonen blir BIA(u) av sig själv (prova), E OPA som egen
  kontur med smartspöt på ett tak som start. Testerna: 996 på ca 13 s.
  Provat i Playwright mot `dist/` (lågt sadeltak i exemplet: egenskapernas
  *Redovisas som BOA:H … BOA:L …*, kryssen, kupan som ökar arean, OPA under
  en carport, areaförteckningen); zonen bara i vitest (exemplet på sned
  mark, `onSlope`). Claudes val och det som inte gjordes i PLAN.md, koden i
  UTVECKLING.md.
- **Märks i hans ritningar efter 0.12.4:** areorna och BTA under ett
  snedtak räknas bara där rumshöjden är minst 1,90 m och 0,60 m ut. Takets
  egenskaper har krysset **Takkupa**, areans **Dela efter rumshöjd** (BOA:H,
  BOA:L). På en våning delvis under mark blir BOA bortom zonen **BIA(u)**,
  andra slag (o)/(u), BTA(o)/BTA(u); delarna står i stämpeln, egenskaperna
  och förteckningen. Med slaget **OPA** ger ett klick under ett tak takets
  kontur.
- **0.12.3 Areor** och **0.12.2 Förteckningar** (10 november): se PLAN.md,
  UTVECKLING.md och README, också för vad som märks i ritningarna.
- **0.12.1 DXF** (10 november; lagerkartorna, 2000/2018, *Bärande*): se
  PLAN.md, UTVECKLING.md och README, också för vad som märks i ritningarna.
  Inte öppnat i AutoCAD, Archicad eller QCAD.
- **Lagerunderlaget** (10 november, en egen chatt utan kod):
  `cad-apa-lagerlista.md` är hans AutoCAD-mall, avskriven ur en
  Excel-export (272 lager med linjetyper, linjetjocklekar och plot), med
  pennöversättningen. `cad-apa-lager-bsab-forslag.md` jämför den med tre
  Archicad-mallar (svensk standard 29, företag 27 och företagsanpassad 29)
  och innehåller förslaget som blev lagerkartorna i 0.12.1. Typkoderna i
  byggdelsfältets positioner 5–6 (11, 31, 34, 35, 40 …) är **inte
  utredda**. Säkert är bara 20 mur/puts, 41 gips/stålregel och 42
  gips/träregel ur Archicad-mallen. Källorna står i förslagets avsnitt 2.
  Skriv inga materialkoder förrän han vet vad de betyder.
- **0.12 Exportdialogen och PDF** (7 november) och **0.11.8.3–0.11.8.4**
  (smart och vägghål, granskningen med varningarna uppslagna i
  föreskrifterna): se PLAN.md, UTVECKLING.md och README, också för vad som
  märks i ritningarna.
- **Föreskrifterna** ligger i projektets kunskapsbas (Boverkets BFS
  2024:4–13 med ändringar, SIS-standarderna för dörrar, fönster, area,
  dagsljus och invändiga mått, BBR 30 för jämförelse). Varningarna är
  uppslagna i 0.11.8.4; tröskeln, räckeshöjderna, stegmåtten och
  dagsljusets 10 % har ingen siffra i föreskrifterna och är kvar som
  *avviker från praxis*. Slå upp i filerna, inte ur minnet, när en ny
  varning skrivs.
- **0.11.5–0.11.8.2** (spiraltrappan, profilen, räcket, öppningstyperna,
  Detalj och beslag): se PLAN.md, UTVECKLING.md och README (måtten: hålet
  modulmåttet + 10, karmen − 10; nytt format 28 i 0.11.8).
- **Granskningen efter 0.11.5** och **0.11.1–0.11.5** (räcket, editorn,
  staket och grindar, byggd trappa, spiraltrappan): se PLAN.md och
  UTVECKLING.md.
- **Höjdkurvors del av 0.10.31** (ortofotot i platspaketet) återstår; den
  görs i en Höjdkurvor-session (fälten i `docs/arkiv/PLAN-0.10.md`).
- **Taggar och releaser** (Carl August 19 november, som i danaid): sköts
  av `release.yml`. Vid varje push till `main` läses versionen i
  `package.json`; saknas release `v<version>` skapas tagg och release på den
  commiten, med titel och text ur README:s avsnitt (`scripts/release-notes.sh`),
  och zip-filen läggs på den. **Höj därför versionen sist**, när versionen är
  klar, och skriv README-avsnittet innan. Se efter med `gh run list`
  (*Bygg för webbhotellet*). Sessionen kan inte själv pusha taggar eller
  skapa releaser (403); arbetsflödet gör det, med Carl Augusts tillstånd 19
  november. `v0.12.5.4` skapade han själv. Äldre versioner utan release
  (0.12.5–0.12.5.3 m.fl.) får ingen i efterhand.
- **Publicerad:** 0.12.5.9 pushad till `main` 26 november (se git och
  `gh run list`). `add_repo` med push går direkt när Carl August skriver "push
  godkänd" i första meddelandet.
- **Versionsnumret** är `0.12.5.9` i `engine.ts`, `package.json` och
  `package-lock.json`. Nya funktioner får tredje siffran (0.12.4 …); **den
  fjärde siffran är för snabba buggfixar** utan nya funktioner (Carl August
  10 november). En granskning höjer inte numret, eller får en fjärde siffra
  om något ändras som syns. Nästa lediga är 0.12.5.10 (Förarbete för IFC).
- **0.10.8–0.12.5.9 är inte provade fullt ut** av Carl August (12 november: inte hunnit prova 0.12–0.12.4); han har
  svarat på frågor om flera av dem utifrån beskrivningarna.
- **Frågorna:** de obesvarade (nedan) ställs **högst tio per session**,
  de som hör till den kommande versionen först, **fem åt gången**. En fråga
  han hoppar över räknas som "bra som det är" och stryks. **19 november
  ströks alla frågor om 0.11 och äldre**, utom sju som inte märks vid
  vanlig provning. Samla inte på frågor igen: ställ högst tre per version,
  bara sådant som ändrar ritningen eller en uträkning.
- **Publicering:** varje push till `main` laddas upp med
  `.github/workflows/publicera.yml` (FTPS; secrets `FTP_SERVER`,
  `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_DIR` =
  `/agrellarkitektur.se/public_html/cad-apa/`). Se efter med `gh run list`.
  Sedan 0.12.5.2 publiceras den också till cad-apa.danaid.cloud med
  `.github/workflows/publicera-vps.yml` (rsync, secret `APPS_SSH_KEY`;
  hoppar över tills nyckeln finns). Flytten och ordningen står i
  `docs/FLYTT.md`.
  Halvfärdigt arbete kan läggas på en egen gren, så att det inte
  publiceras. Skrivrätten till repot kan behöva godkännas i sessionen.
- **Färdplan** (Carl August 22 oktober): 0.13 är hans egen provning (han
  ritar ett hus), sedan en inbjuden **alfa** för arkitektvänner, sedan en
  **öppen beta**. **Formatfrysen kommer med den öppna betan.** Inget av
  stegen är 1.0. Håll färdplanen nedan aktuell vid varje överlämning.
- **Ord:** *palett* och *snabbmeny* betyder samma sak för honom. Säg bara
  **smartmeny**. Symboler i ritningen heter **-markör**: *nivåmarkör*,
  *sektionsmarkör*, *fasadmarkör*. Säg inte nivåkota, sektionslinje eller
  fasadlinje. Vyn heter *Sektion* och *Fasad*. **Littera** skrivs med två
  siffror som förval (T01, M01, RÄ01). Spöet heter **smartspöt**. Fliken
  för situationsplanen heter **Platsen**; inga engelska ord i appen.
  Stilinställningarnas helhet heter **stilboken**, med flikarna **Stil**,
  **Typer** och **Allmänt** (sedan 0.11.6); en rad i en vykategori där en
  objekttyp och del får sin penna heter ett **ställe**. Trappans delar
  heter **plansteg**, **sättsteg**, **vangstycke**, **vilplan**,
  **kilsteg**, **stegnos**, **gånglinje**. Räckets: objektet heter
  **Räcke** (också staket, stängsel, spaljé), typen **räckestyp**, delarna
  **stolpe**, **handledare**, **ledstång**, **liggare**, **spjälor**,
  **fyllning**; en sträcka kan bli en **grind**. Vid kilstegen är
  handledaren **Utjämnad** eller **Hoppande**. Profilens: **profiltyp**
  (PR01), **delprofil** (A, B …), **ankare** (flera per typ, numrerade),
  **sträckzon**, **bana**, **avslut** (*Inom*/*Utöver* referenslinjen,
  förskjutning), **ändprofil** (PA01), **profilobjekt** (littera P01, B01,
  L01 efter gruppen); verktyget heter **Profil**. Exportens:
  dialogen heter **Exportera**, ett sparat urval **exportuppsättning**;
  sedan utredningen **utgåva** (en skarp export), **ändringsbeteckning**
  (bet), **revideringsmoln**, **revideringspil**, **handlingsförteckning**,
  **ändrings-PM**.
- **Varningar** (Carl August 30 oktober): hänvisa till BFS 2024:9 (Boverkets
  nya regler; BBR gäller inte längre för nya ansökningar) där det är
  föreskrift. Det som är vedertaget men inte står i föreskriften
  (räckeshöjder, stegdjup, stegformeln, bredd …) får texten *avviker från
  praxis*. Gäller alla varningar i appen (gjort i 0.11.1). Rätt
  föreskrift per ämne (0.11.8.2): säkerhet vid användning (räcken,
  trappor, glas, utfallsskydd) BFS 2024:9, tillgänglighet BFS 2024:12,
  utrymning BFS 2024:7.
- **Versionsnamn:** inga b-versioner; nästa lediga nummer i stället.
- **Bakåtkompatibilitet:** inga migreringar före formatfrysen. Höj
  `FORMAT_VERSION` när formatet ändras; äldre filer får ett meddelande
  (`parse` i `src/storage/format.ts`). Valfria nya parametrar och fält
  har inte krävt ett nytt format (räcket i 0.11.1 inte heller).
- **Telefonen är inget mål.** Testa på dator (Chrome).
- **Arbetssätt:** Carl August testar varje version på webbhotellet. Ingen
  demo och ingen zip om han inte ber om det. Säg alltid hur stora
  föreslagna ändringar är och om de riskerar att behöva mer än en
  session. Större versioner utreds med en mockup i Claude Design i en
  egen chatt före bygget (som räcket och profilen); utredningens fil i
  projektet är specifikationen.
- **Synpunkter:** Carl August samlar dem i `cad-apa-synpunkter.md`
  (projektets kunskapsbas), med rubrikerna Inkorg, Planerat per version,
  Parkerat och Avfärdat. Läs den vid sessionsstart (Projects-verktyget,
  `project_read`). Sortera Inkorgen tillsammans med honom, kort, med
  Claudes förslag per punkt (bokstäver, så att chatten inte numrerar om).
  Han bifogar gärna skärmbilder; be om en när en synpunkt gäller något
  som syns.
- **Läs projektfilen på nytt strax före varje skrivning** (Carl August
  28 oktober). Flera chattar kan arbeta mot `cad-apa-synpunkter.md` och
  överlämningen samma dag, och `project_write` ersätter hela filen: skriv
  aldrig från en kopia som lästes tidigare i sessionen. Gör
  `project_read`, för in ändringen i det som kom tillbaka och skriv
  direkt. `project_write` med `local_path` kräver en fil i
  arbetskatalogen (t.ex. `.proj/` i repot, undantagen i
  `.git/info/exclude`).
- **Svar med nummer:** chatten gör om "17. Ok / 20. 1100" till en
  numrerad lista som börjar på 17. Läs numren i texten han skickat, och be
  honom gärna skriva "17:". Bokstäver med kolon ("A: ok") fungerar.
- **Överlämningen hålls kort** (Carl August 28 oktober): skriv bara läget
  för de senaste versionerna; det som hör till koden går till
  UTVECKLING.md, Claudes val till PLAN.md.

## Färdplan

Kort; detaljerna står i PLAN.md och i `cad-apa-synpunkter.md`.

- ~~0.8.8 Mallblad~~ … ~~0.10.40.1 Granskning efter 0.10.40~~,
  ~~0.11 Trappan~~ … ~~0.11.5 Spiraltrappan~~, ~~Granskning efter
  0.11.5~~, ~~Utredning av profilverktyget~~, ~~0.11.6 Profilen~~, ~~0.11.6.1 Profileditorn, resten~~, ~~0.11.7 Ändprofiler och profilen
  som del~~, ~~0.11.7.1 Profilen, det som inte hanns med~~, ~~0.11.7.2 Räckets
  avslut och spiraltrappan~~, ~~0.11.7.3 Trappan och räcket, det som inte
  hanns med~~, ~~0.11.8 Dörrar och fönster: öppningstyperna~~, ~~0.11.8.1
  Synpunkterna på mockupen~~, ~~0.11.8.2 Detalj och beslag~~, ~~0.11.8.3
  Smart och vägghål~~, ~~0.11.8.4 Granskning efter 0.11.8~~,
  ~~Utredning av 0.12 Export~~, ~~0.12 Exportdialogen och PDF~~,
  ~~0.12.1 DXF~~, ~~0.12.2 Förteckningar~~, ~~0.12.3 Areor~~,
  ~~0.12.4 Areor under snedtak och mark~~, ~~0.12.5 Förteckningen per
  littera~~, ~~0.12.5.1–0.12.5.3~~, ~~0.12.5.4 Licensen~~, ~~Granskning efter 0.12.5.4~~, ~~0.12.5.5 Rättningar ur granskningen~~, ~~0.12.5.6 Granskning efter 0.12~~, ~~0.12.5.7 Summor enligt SS 21054~~ (klara; se tabellen *Klart* i PLAN.md)
- **Flytten till cad-apa.danaid.cloud**: steg 8–10 i `docs/FLYTT.md`
  (Carl Augusts provning, Höjdkurvor, sedan omdirigering och FTP bort)
- **Höjdkurvor: ortofotot med i platspaketet** (liten; i Höjdkurvors repo
  och session)
- ~~Utredning av IFC~~ (13 november, `cad-apa-ifc-utredning.md`)
- ~~Granskningen 26 november~~ (fyra rapporter och sammanställningen i
  projektet), ~~0.12.5.8 Höjdkurvor på hojdkurvor.se~~, ~~0.12.5.9
  Sparandet~~
- **Carl Augusts provning av 0.12–0.12.5.9** (nästa; ett eget litet hus, en timme)
- **Förarbete för IFC** (0.12.5.10; liten–mellan, en session med marginal;
  beslutat 26 november, svar A; ytterväggarna efter tillstånd ingår)
- **Varningarnas texter** (liten; V1, V3, V4, V9, V10 och V8 enligt svar
  D; kan lika gärna ligga efter IFC)
- **Dörrarnas funktionsmått** (liten; om han vill ha den före IFC)
- **Underlagen sparas för sig** (liten–mellan; före ortofotot i full
  upplösning från Höjdkurvor)
- **0.12.6 IFC** (stor; utan skikt, svar B) → **0.12.6.1 IFC, resten** (mellanstor) →
  **0.12.7 Utgåvor och PM** (mockup först; se `cad-apa-export-utredning.md`,
  där står de äldre numren)
- **0.12.8 3D-vyer** (sparade perspektiv och axonometrier, trädmodeller,
  trädens status i planen)
- **0.12.9 Markförändringar** (förteckningen över schakt, fyll och
  massbalans; mellanstor; väntar på jorddjupsmodellen från Höjdkurvor)
- **Glas och utrymning**, **Areorna**, **BYA** (egen version före
  piloten), **Före alfan**: punkt 6–9 i sammanställningens *Ordning*
- **Koordinater, SWEREF och sol** (stor; före piloten; SWEREF på
  situationsplanen och i exporten därifrån)
- **0.13 Pilotprojektet**: Carl August ritar själv ett hus
- **Inbjuden alfa**, sedan **öppen beta och formatfrys**
- Efter piloten: se *Efter pilotprojektet* i PLAN.md. **1.0**
  bygglovshandling.

## Nästa session: Carl Augusts provning, sedan Förarbete för IFC

Fråga först hur provningen av 0.12–0.12.5.9 gick (ett eget litet hus:
väggar, dörrar, fönster, en fönsterförteckning, en area, export till PDF
och DXF; och om ett autospar läggs undan med besked). Fråga om en DXF
öppnas i AutoCAD, om provfilen `docs/ifc/provhuset.ifc` öppnats i
Archicad, Revit och Solibri, och A–E i `cad-apa-ifc-utredning.md` (D
faller med skikten). Kvar sedan förut: Stöd-texten och CLA Assistant,
flyttens steg 8 (`docs/FLYTT.md`).

**Förarbete för IFC (0.12.5.10)**: PLAN.md, avsnittet med samma namn, och
`cad-apa-granskning-1126-ifc.md` avsnitt 4 (a–g). Läs IFC-granskningen
**före** IFC-utredningen: utredningen pekar på källor som inte finns
(`ifcWrite.ts` i exportens worker, som bara skriver PDF; IsExternal och
LoadBearing ur `dxfLayers.ts`; fälten ur `openingSchedule.ts`), och värdena
räknas på andra ställen. Förarbetet bygger dem som funktioner;
**0.12.6 IFC** blir sedan skrivaren, egenskaperna, raden *Modellen* i
`src/ui/app/exportDialog.ts` och provningen, utan skikt och i
huvudtråden.

## Att fråga Carl August om

Fem åt gången, högst tio per session, de som hör till nästa version först.
Hoppar han över en räknas den som bra och stryks. Claudes val står i varje
fråga. Först **A–E i `cad-apa-ifc-utredning.md`** (hör till 0.12.6), sedan
0.12.5.6, 0.12.5.5, 0.12.5, 0.12.4, 0.12.3, 0.12.2, 0.12.1 och 0.12. **Frågorna om
0.11 och äldre ströks 19 november** (ca 200 stycken; de finns i git,
`docs/OVERLAMNING.md` före den dagen). Lägg inte tillbaka dem.

**0.12.5.6 efter provning** (Claudes val, se PLAN.md)
- Horisontella öppningar i ett barnsäkert räcke prövas som springan i
  höjdled ovanför spjälorna eller glaset. Ska en handledare indragen bakom
  fronten (avståndet i sidled) också prövas?

**0.12.5.5 efter provning** (Claudes val, se PLAN.md)
- Balkongdörrarnas varning kommer för alla ytterdörrar och fönsterdörrar
  minst 2,0 m över ±0 och tystas med fältet *Utfallsskydd*. Rätt, eller
  hellre en knapp *Kvittera* som på räcket?
- Glipan under räcket mäts till den lägsta delen som inte är en stolpe.
  Varnar den där du väntar dig, och är *Kvittera* rätt sätt att bortse
  från den?
- Fri passage: den höjda nivån (arbetsplatser, 800 också för innerdörrar)
  är inte ett val. Ska nivån väljas per projekt under Allmänt, och ska de
  fria ytorna vid dörren (a och b i SS 91 42 21) ritas som
  tillgänglighetscirkeln?

**0.12.5 efter provning** (Claudes val, se PLAN.md; svaren A–E 12 november)
- *Utförande* är typens namn och *Öppningsbredd*/*Öppningshöjd* hålets mått
  (modulmåttet + 10). Rätt, eller är öppningsmåttet den fria öppningen?
- Raderna följer stilbokens fältmall. Behöver en förteckning kunna ha egna
  rader eller en egen ordning (t.ex. en kort för bygglovet)?
- När V och H delar littera ritas den första. Vill du se båda i kolumnen?
- Föreskrifterna är gemensamma för alla fönster- (eller dörr-)förteckningar
  i projektet och står i en 70 mm bred kolumn till höger. Rätt plats och
  bredd, och behövs *Förklaringar* och *Hänvisningar* som egna rubriker?

**0.12.4 efter provning** (Claudes val, se PLAN.md; svaren A–E 10 november)
- Takkupan som kryss på taket: kupans kontur i plan gäller i stället för
  taket under, men taket under kapas inte i planen och 3D. Räcker det, eller
  behövs det kapade taket före piloten?
- BOA bortom 6-meterszonen blir BIA(u) av sig själv, och delarna står i
  stämpeln. Stämmer det med hur du redovisar en souterrängvilla?
- (o) och (u) skrivs bara på en våning där golvet ligger under marken
  någonstans, inte på våningarna ovanför. Rätt, eller ska alla våningar få
  (o) när huset har en källare?
- Marken läses 0,30 m utanför fasaden, och golvet räknas i nivå med marken
  inom 20 mm. Rimligt?
- Bredden 0,60 m under nocken prövas bara mot snedtaket, inte mellan en
  vägg och 1,90-linjen. Saknas något fall du brukar ha?

**0.12.3 efter provning** (Claudes val, se PLAN.md; svaren A–J 10 november)
- Väggarna mellan en BIA och en BOA hör till BIA när någon vägg mellan dem
  har en dörr (hela bostaden har förbindelse). Rätt tolkning av 5.18.2, och
  räcker det, eller ska man kunna säga vilka areor som är samma bostad?
- En egen kontur: väggar som skär kanten räknas bort helt, väggar innanför
  följer 0,15-regeln. Rita du konturen längs insidan, eller till väggarnas
  mitt (som i Archicad)?
- Fyllningen ligger ovanpå väggarna med 35 % täckning och konturen 0,35.
  Lagom, och ska stämpeln stå i det första rummet man klickade i?
- Areaförteckningen grupperas per areaslag utan en summa av alla slag, med
  BYA, BTA och BRA framräknade per våning. Saknas en kolumn (t.ex.
  *Namn* på enheten, *Lgh 1101*)?
- XLSX med `SUMMA`-formler och talformaten 0,0 och 0. Öppnas den rätt i din
  Excel, och vill du ha ramar och kolumnbredder som på bladet?

**0.12.2 efter provning** (Claudes val, se PLAN.md; svaren A–E 10 november)
- Förteckningen visas som tabell över ritytan och stängs när man går till
  en våning, vy eller ett blad. Räcker det, eller ska den kunna stå bredvid
  planen (som 3D i *Båda*)?
- Inställningarna sparas direkt när ett fält ändras (inget *Spara*), och
  varje ändring kan ångras. Bra, eller hellre *Spara* som för vyerna?
- På bladet: text 2,5 mm, radhöjd 5,5 mm, rubrikraden fet, ytterram 0,25,
  linjer 0,13. Lagom, och ska texthöjden gå att ändra per förteckning?
- En rad per littera är förval för dörrar och fönster; det som
  skiljer står *Olika*. Rätt förval?
- CSV med semikolon och decimalkomma, för svensk Excel. Öppnas den rätt
  hos dig med ett dubbelklick?

**0.12.1 efter provning** (Claudes val, se PLAN.md; svaren A–E 10 november)
- Utan kryss är ytterväggar bärande (27C) och innerväggar inte (43CB).
  Rätt förval, eller ska *Bärande* ligga i väggtypen (YV01, IV01)?
- Statusen räknas mot Befintligt också i en vy utan jämförelse (bygglovets
  plan får N och E). Rätt, eller `-` när vyn inte jämför?
- Befintliga väggars vita fyllning skrivs inte (DXF har ingen mask), så
  befintligt är bara konturen. Bra, eller hellre en vit solid yta under?
- Pennans färg (t.ex. Färgmarkerad) följer inte med; färgen styrs av
  tjockleken. Räcker det, eller ska Färgmarkerads färger med som RGB i 2018?
- Markörer och möbler skrivs som linjer, inte block. Behöver mottagarna
  block (för att flytta en sektionsmarkör som en enhet)?
- Typkoderna i hans AutoCAD-mall (11, 31, 34, 35, 40 i `A-27C-11--N`
  osv.): har han fått veta vad de betyder, av mallens upphovsman eller ur
  SB 11? Annars skrivs inga (se `cad-apa-lager-bsab-forslag.md`, avsnitt 2).

**0.12 efter provning** (Claudes val, se PLAN.md; utredningens A–E
besvarade 7 november, se `cad-apa-export-utredning.md`)
- Lagren per objektgrupp är 13 grupper ur objektens sort (Väggar, Dörrar,
  fönster och vägghål, Mått, Text och littera …), inte stilbokens ställen.
  Lagom indelning?
- *Ett per vy på bladet* är förval för lagren, och en fil per blad. Rätt,
  eller hellre en samlad fil som förval?
- Stämpeln ARBETSMATERIAL ligger grå och liten nederst till vänster utanför
  ramen. Tillräckligt synlig, eller ska den stå diagonalt över bladet?
- En export till mappen skriver över filer med samma namn utan att fråga
  (så att en ny utgåva hamnar rätt). Bra, eller ska den fråga först?
- Bilden ur 3D följer 3D-vyns kamera; en annan proportion än fönstrets
  visar mer i sidled. Räcker det tills de sparade 3D-vyerna (0.12.8) får
  en sökarram?

**Kvar från 0.11 och äldre** (Carl August 19 november: frågorna om 0.11
och äldre är strukna i klump; piloten är provet för dem. De här är kvar
för att de inte märks vid vanlig provning eller i nyare frågor. Ställ dem
när ämnet kommer upp.)
- **Rampens lutning** (0.10.19): i ändarna börjar och slutar rampen plant,
  så den raka delen blir brantare än det inskrivna (visas som lutningen).
  En ramp inskriven som 1:12 kan alltså bli brantare än 1:12. Rätt, eller
  ska lutningen hållas och höjden i änden bli en annan?
- **Trappans bredd** (0.11.4): bredden är yttermåttet, med vangstyckena
  innanför. Den fria bredden blir då 100 mm mindre än det inskrivna. Rätt,
  eller ska bredden vara den fria bredden mellan vangstyckena?
- **Fallhöjden** (0.11.8.4): varningarna för barnsäkra fönster och
  balkongdörrar räknar våningens höjd över ±0, inte över den färdiga
  marken utanför. På en sluttande tomt kan varningen saknas. Ska fallhöjden
  räknas mot marken?
- **±0-klicket** (0.10.8) läser den befintliga marken, inte den färdiga.
  Rätt?
- **Skedet under Allmänt** (0.10.39): ett ifyllt skede gäller alla blad,
  och bladens egna skeden försvinner och kommer inte tillbaka när fältet
  töms. Rätt?
- **Synpunktsformuläret** (fråga 79): breven kommer fram från VPS:en
  (FLYTT.md), med upp till en timmes fördröjning. Kvar: är fördröjningen
  godtagbar, och ska den gamla adressen bort? Viktigt före alfan (med
  drift 9, `feedback.php`).
- **Trädens status** (till 0.12.8): ska texten "Träd skyddas under
  byggtiden" stå i en förteckning, eller skriver man den själv?
