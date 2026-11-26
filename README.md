# Bacchus

Ritprogram i webbläsaren för små arkitektkontor. *Bacchus* är motorns interna
namn; produktnamnet (just nu låtsasbrandingen **cad-apa**) ligger i `src/brand/`
och kan bytas utan att röra resten av koden.

Idé och principer beskrivs i [docs/ARKITEKTUR.md](docs/ARKITEKTUR.md), och vad
som byggs i vilken version i [docs/PLAN.md](docs/PLAN.md). Nuvarande version är
**0.12.5.9** (alfa), Förteckningen per littera, flytten till cad-apa.danaid.cloud, licensen AGPL-3.0, rättningarna ur granskningen, Granskning efter 0.12, summorna enligt SS 21054 och sparandet; nästa är **Förarbete för IFC** och sedan **0.12.6 IFC** (utredd 13 november, granskad 26 november), sedan 0.12.7 Utgåvor och PM, 0.12.8 3D-vyer och 0.12.9 Markförändringar.

## Vad programmet är

Ett ritprogram för bygglovshandlingar till små svenska projekt, som körs i
webbläsaren (Chrome på dator) och sparar i webbläsaren eller som fil.
Ombyggnader är grunden: varje objekt finns i ett eller flera tillstånd
(Befintligt, förslag, etapper), och befintligt, rivs och nytt räknas ut.

- Väggar, bjälklag, tak, dörrar, fönster och vägghål med typer och littera,
  trappor, räcken och staket, profiler, möbler, rum och areor enligt SS 21054
- Platsen: terräng och träd ur Höjdkurvor, markobjekt med schakt och fyll
- Planer, fasader, sektioner och 3D ur samma modell, med stilboken för
  pennor, fyllningar och linjetyper
- Blad med ritningshuvud, förteckningar för dörrar, fönster och areor,
  export till PDF, DXF (SB11-lager), CSV och XLSX
- Varningar mot Boverkets föreskrifter (BFS 2024:7, 9 och 12)

Vad varje version har lagt till står under *Versioner* nedan (0.12 och
senare) och i [docs/arkiv/README-0.1-0.11.md](docs/arkiv/README-0.1-0.11.md)
(0.1–0.11.8.4).

## Kom igång

Kräver Node.js 20 eller senare.

```sh
npm install
npm run dev        # startar en utvecklingsserver, öppna adressen som visas
npm test           # kör testerna
```

Hur man bygger vidare på programmet står i [docs/UTVECKLING.md](docs/UTVECKLING.md).

## Versioner och gamla projekt

Projektfilerna har ett formatnummer, i dag 28 (sedan 0.11.8). Fram till
den öppna betan uppgraderas inte projekt från äldre alfa- och betaversioner när
formatet ändras, så ett projekt öppnas i den version det gjordes med;
därefter uppgraderas äldre projekt alltid. Nyare projekt än programmet kan inte öppnas. Vill man kunna gå tillbaka kan varje version läggas i en egen mapp
på webbhotellet (t.ex. `cad-apa/0.5/`, `cad-apa/0.6/`) bredvid den senaste.

Version 0.12.5.9, Sparandet (samma filformat, 28):
- **Ett autospar som inte går att öppna sägs till om.** Är det autosparade
  projektet från en äldre version (eller trasigt) läggs det undan som förut,
  men nu med en rad överst: *Det autosparade projektet kunde inte öppnas och
  har lagts undan*, med **Spara som fil**. Förut startade appen med exemplet
  utan ett ord, och det såg ut som att projektet var borta
- Ny rad i menyn: **Undanlagda autospar…** sparar dem som fil (fler i en
  zipfil). De fem senaste sparas; äldre tas bort
- **En äldre version av appen förstör inte längre en nyare fil.** Fält som
  appen inte känner till behålls när filen sparas. Förut kunde en dator med
  en äldre version i cachen öppna en fil från en nyare och, två sekunder
  efter en ändring, skriva tillbaka den utan till exempel objektens GUID
- **Går appen inte att starta** (ett autospar som går att läsa men inte att
  rita) visas en ruta med **Spara autosparet som fil** och **Börja med
  exemplet**, i stället för en tom sida vid varje start
- Trasiga filer: tomma poster (`null`) i våningar, tillstånd, vyer och blad
  hoppas över, och en avhuggen fil får *Filen är skadad eller
  ofullständig*

Version 0.12.5.8 (samma filformat, 28):
- **Höjdkurvors nya adress, igen**: *Fortsätt rita i cad-apa* fungerar från
  https://hojdkurvor.se/ (samma VPS som förut). hojdkurvor.danaid.cloud och
  den gamla adressen på webbhotellet fungerar fortfarande

Version 0.12.5.7, Summor enligt SS 21054 (samma filformat, 28):
- **Summor och delsummor av areor står i hela m²** i alla förteckningar,
  också rumsförteckningen (förut stilbokens decimaler där). SS 21054, 4.3:
  delposter med en decimal, summaposter utan decimaler. Areaförteckningen
  hade redan hela m²
- **En femma avrundas uppåt** också i summorna (förut kunde 0,15 bli 0,1)
- **Omkretsen** i rumsförteckningen står i meter med två decimaler
  (längdmått enligt 4.3; förut en)
- Ny inställning i förteckningen: **Areornas summor med en decimal
  (avviker från SS 21054)**, avstängd som förval

Version 0.12.5.6, Granskning efter 0.12 (samma filformat, 28):
- **Rumsnumren på plan 2** kunde bli 11xx i stället för 12xx när det
  första som ritades på våningen hörde till en annan våning, till exempel
  sedan taket på plan 2 tagits bort. Numret tar nu våningen som ritas
- **Varning för fri höjd i dörrar** under 2,00 m (BFS 2024:9, 2 kap.
  25 §), mätt från golvet till karmens överkant inuti: en 20M-dörr varnas,
  en 21M-dörr inte
- **Varning för horisontella öppningar** på 110–230 mm ovanför skyddets
  front i ett barnsäkert räcke (BFS 2024:9, 2 kap. 11 § 5), till exempel
  när spjälorna eller glaset slutar en bit under handledaren
- **DXF:** egna linjetypers namn rensas från tecken som DXF inte tillåter
  (`/ \ : ; * ? " < > | , =`), och de framräknade namnen skrivs `CA-1p5_0p5`
  i stället för med kommatecken
- **6-meterszonen** för areor under mark räknar inte med rivna väggar i
  husets kontur
- En **littera med ett trasigt mål** i en fil får inte längre hela planen
  att krascha, och ett element som är tomt (`null`) i filen hoppas över i
  stället för att ge ett tekniskt fel
- **Öppna** väntar inte längre för evigt när dialogen avbryts i en
  webbläsare utan filsystems-API; samma för *Läs DXF* i profileditorn
- Den tomma egenskapspanelen säger inte längre något om mobilen
- Inget annat syns: koden är städad (lagerregeln, cirkelimporterna, 376
  oanvända exporter, sex stora filer delade), ett differentialtest jämför
  planen och 3D med och utan cache, README är kortad (äldre versioner i
  `docs/arkiv/README-0.1-0.11.md`) och arbetsflödena är låsta på commit

Version 0.12.5.5, Rättningar ur granskningen (samma filformat, 28):
- **DXF:** fem ja/nej-värden skrevs som decimaltal (`0.0`), vilket stränga
  läsare kan vägra. De skrivs nu som heltal. Öppnas en export inte i
  AutoCAD: prova igen med den här versionen
- **Objektens GUID sparas direkt vid en export**, och ett objekt som tas
  bort och sedan ångras tillbaka behåller sin GUID. Förut kunde samma
  objekt få en ny GUID vid nästa export om projektet stängdes utan en
  ändring emellan (förberedelse för IFC)
- **Balkongdörrar och fönsterdörrar** på en våning över marken varnas
  (BFS 2024:9, 2 kap. 4 §: spärr mot att barn faller ut). Fältet
  *Utfallsskydd* tystar varningen, och finns nu också för dörrar
- **Glipan under ett barnsäkert räcke** får vara högst 50 mm också när
  räcket inte sitter på en trappa (BFS 2024:9, 2 kap. 11 §; förut 100 mm).
  Varningen kan **kvitteras** i räckets egenskaper, till exempel för ett
  räcke på ett trapplan, där 100 mm gäller
- **Fri passage genom dörrar** hänvisar till funktionsmåtten i SS 91 42 21,
  normalnivå: 800 mm för entrédörrar och dörrar till balkong och uteplats
  (en 10M-dörr), 760 mm för innerdörrar (en 9M-dörr). Gränserna är de samma
  som förut
- Spiraltrappans varning för fri höjd hänvisar till BFS 2024:9, 2 kap.
  25 § (minst 2,00 m i trappor) i stället för praxis
- **CSV** av en förteckning per littera skriver tal över tusen utan
  blanksteg (*1500*), så att Excel läser dem som tal
- **Licenstexterna följer med** programmet (`LICENSE.txt`, `THIRD-PARTY.md`
  och mappen `LICENSES/` bredvid `index.html`, också i zip-filen)
- Exportdialogen säger rätt versioner för det som kommer (IFC i 0.12.6,
  3D-vyerna i 0.12.8)

Version 0.12.5.4, Licensen (samma filformat, 28):
- **Ny licens: GNU AGPL-3.0 eller senare** från och med den här versionen.
  Versionerna till och med 0.12.5.3 är fortfarande GPL-3.0 eller senare
  för den som har dem. För den som använder programmet ändras ingenting:
  det är fritt att använda, också i betalda uppdrag. Den som kör en ändrad
  version som tjänst måste erbjuda användarna sin källkod. Se *Licens*
  längst ned
- **Källkoden** i menyn och i Om-rutan går till koden för just den version
  som körs (commiten bygget gjordes från)
- **Om-rutan** har licensen, länken till källkoden och förteckningen över
  det som kommer från andra (`THIRD-PARTY.md`), och **Stöd utvecklingen**:
  för privatpersoner ett frivilligt bidrag (Swish är på väg, till dess
  kontakt), för företag supporteravtal och kommersiella licenser
  (`src/ui/app/supportSection.ts`)
- Alla källfiler har ett licenshuvud (`SPDX-License-Identifier`).
  `CONTRIBUTING.md` och `CLA.md` (utkast) för den som vill bidra

Version 0.12.5.3 (samma filformat, 28):
- **cad-apa flyttar till https://cad-apa.danaid.cloud/**. På den gamla
  adressen (agrellarkitektur.se/cad-apa/) står en rad överst: projektet som
  är sparat i webbläsaren följer inte med till den nya adressen. *Spara som
  fil* sparar det öppna projektet som projektfil; finns också en mall för
  nya projekt eller ett autospar som inte gick att läsa blir det en zipfil
  med alltihop. Öppna filen med *Öppna* på den nya adressen. Raden går att
  stänga och kommer tillbaka när sidan laddas om. Inställningarna för
  gränssnittet (rutnät, färger, snabbknappar, tema) följer inte med
- Synpunkternas brev har `MIME-Version: 1.0`
- `feedback.php` i webbläsarens adressfält når servern i stället för att
  visa appen (service workern lämnar `.php` i fred)

Version 0.12.5.2 (samma filformat, 28):
- **Höjdkurvors nya adress**: *Fortsätt rita i cad-apa* fungerar från
  https://hojdkurvor.danaid.cloud/ (och fortfarande från den gamla adressen
  under flytten). Länken tillbaka till Höjdkurvor går dit
- **Publicering på VPS:en**: varje push till `main` publiceras också till
  cad-apa.danaid.cloud med rsync (`.github/workflows/publicera-vps.yml`),
  parallellt med FTP till webbhotellet. Flytten beskrivs i `docs/FLYTT.md`

Version 0.12.5.1 (samma filformat, 28):
- **Grindförteckningen är borttagen** (*Ny: Grindar* under Förteckningar,
  från 0.12.2). Grindar sätts ut i staket och redovisas i planen med
  littera, som förut; behövs en ritning av en grind görs den för sig. En
  grindförteckning i ett äldre projekt läses inte in, och låg den på ett
  blad står *Vyn finns inte längre* där tills bladvyn tas bort

Version 0.12.5, Förteckningen per littera (samma filformat, 28; projekt från
0.11.8 öppnas; nya valfria fält: förteckningens `layout`, `figureScale`,
`noFigure` och `hideEmpty`, och bladvyns `maxWidth`):
- **Namnet**: det som hette *uppställning* heter nu **förteckning** överallt
  (stilboken › Typer › *Förteckningens fält*, egenskapernas *Förteckningens
  fält*). En uppställning är en elevation av en byggdel eller ett rum (kök,
  badrum) och kommer som egen vytyp efter piloten
- **Dörr- och fönsterförteckningen per littera**, som A-42-5-101 och -102:
  *Ny: Fönster* eller *Dörrar* under Förteckningar ger fälten som **rader**
  och en **kolumn per littera**, med **ritningen sedd utifrån** överst
  (karm, poster, bågar, blad, spröjs och öppningssymbol, nivån Normal) och
  karmyttermåtten måttsatta. Alla rader i fältmallen syns, också de tomma
  (`-`); *Dölj tomma rader* i egenskaperna tar bort dem ingen littera har
  ifyllda
- **Skriv i rutorna**: ett värde i en ruta sätts på alla objekt med
  litteran, i ett ångra-steg. Skiljer de sig står *Olika*. Enter och
  pilarna går mellan raderna, Tab till nästa littera. Det som räknas fram
  är grått och går inte att skriva i
- **Fälten som räknas fram** är ifyllda: antal, hängning, utförande (typens
  namn), öppningssätt, karmyttermått, öppningsbredd och öppningshöjd
  (hålets mått), bröstningshöjd, poster, spröjs, karmdjup och
  väggtjocklek. De står också i den vanliga tabellen (förut `-`)
- **V och H under samma littera** (litteraregeln *Typ och mått*, förvalet):
  en kolumn, och raden *Hängning* räknar upp dem, *2 V, 1 H*. Med regeln
  *Typ, mått och hängning* får de var sin kolumn
- **Ritningens skala** 1:50 (förval), 1:20 eller 1:100 per förteckning,
  eller ingen ritning
- **Föreskrifter** till höger om tabellen: projektets egna rader (skrivs i
  förteckningens egenskaper) och typernas föreskrifter med litterorna de
  gäller, *F01–F02: Träfönster typ … eller likvärdig*
- **På bladet** bryts en bred förteckning i **band under varandra**, med
  fältens namn i varje (*Största bredd* på bladvyn, förval bladets ram).
  Den följer med i bladets PDF och DXF, och CSV och XLSX får fälten som
  rader
- *Uppställd* i egenskaperna byter mellan *Per littera* och *Som tabell*
  (tabellen från 0.12.2, med kolumner, sortering och summor)
- Grindarna får ingen egen förteckning per littera (grindförteckningen från
  0.12.2 togs bort i 0.12.5.1)
- Versionerna efter heter nu 0.12.6 (markförändringar), 0.12.7 (IFC),
  0.12.8 (utgåvor och PM) och 0.12.9 (3D-vyer)

Version 0.12.4.1, buggfix (samma filformat, 28):
- **Areastämpeln följer marken**: på en våning delvis under mark stod den
  gamla delningen (t.ex. BOA och BIA(u)) kvar i planen när ett markobjekt
  ändrades, tills något annat ritades om. Förteckningen och smarttexten
  räknade rätt hela tiden
- **Publiceringen** kontrollerar webbhotellets certifikat (`security:
  strict`), och uppladdningssteget är låst på en bestämd commit
- Exemplet för `feedback-config.php` nedan har exempeladresser

Version 0.12.4, Areor under snedtak och mark (samma filformat, 28; projekt
från 0.11.8 öppnas; nya valfria fält: areans `heightSplit` och takets
`dormer`):
- **Snedtaket** (SS 21054 5.13, 8.4): rumshöjden räknas mot det lägsta
  takfallets undersida. BOA, BIA, LOA, ÖVA och BTA räknas där höjden är
  minst 1,90 m och 0,60 m ut från den linjen; en del smalare än 0,60 m
  räknas inte (5.1.3). Når 0,60 m förbi ytterväggen slutar BTA vid dess
  utsida
- **Takkupa**: ett kryss i takets egenskaper. Inom kupans kontur gäller
  kupans tak i stället för taket under när areorna räknas (5.14). Taket
  under kapas inte i planen och 3D
- **Dela efter rumshöjd**: ett kryss i areans egenskaper ger BOA:H (minst
  2,10 m) och BOA:L som egna rader (18.5)
- **Våning delvis under mark** (10.3.1.3, 11.3.1.3, 18.3): längs fasaderna
  där golvet ligger i nivå med eller över den färdiga marken räknas 6,00 m in
  från väggens insida som ovan mark, med zonens linjer förlängda i
  invändiga hörn. BOA bortom zonen blir **BIA(u)** av sig själv, de andra
  slagen får (o) och (u), och BTA blir BTA(o) och BTA(u). Utan markmodell
  ligger allt ovan mark. Stämpeln och egenskaperna visar delarna
- **OPA** (7.4): en egen kontur utan avdrag, som slutar vid ytterväggens
  utsida och inte räknas i BRA. Med verktyget Area och slaget OPA ger ett
  klick under ett tak (en carport, ett skärmtak) takets kontur som start

Version 0.12.3, Areor (samma filformat, 28; projekt från 0.11.8 öppnas;
ny objekttyp `Area`, nytt valfritt fält stilbokens `general.areas`):
- **Areor enligt SS 21054:2020**. Verktyget **Area** under Annotera: välj
  areaslag (BOA, BIA, LOA, ÖVA, OPA) och klicka i ett rum. Konturen följer
  de omslutande väggarnas insida och flyttas med väggarna; **Shift+klick**
  lägger till fler rum i den markerade arean (en bostad, en lokal), eller
  tar bort ett, och innerväggarna mellan rummen räknas med
- **De automatiska avdragen**: innerväggar upp till 0,30 m räknas i sin
  helhet, tjockare 0,15 m in från varje sida; fristående pelare och schakt
  likadant (en pelare 600 × 600 drar av 300 × 300); pelare intill en
  omslutande vägg räknas bort helt. En öppning eller smyg på minst 1,50 m
  räknas till karmen (yttervägg) eller karmens mitt (mot en annan enhet).
  Väggarna mellan en BIA och en BOA i samma bostad hör till BIA. Andra hål i
  bjälklaget än trappans räknas inte; ett hål över en trappa räknas med när
  det är högst 30 % större än trappan
- **Egen kontur**: bocka ur *Följer väggarna* så blir konturen en polygon
  som ändras i Modifiera; *Automatiska avdrag* kan bockas ur för sig
- **BTA och BYA räknas fram**: BTA per våning till ytterväggarnas utsida,
  BYA på markplanet med de taksprång som är mätvärda (djupare än 0,50 m
  under 3,00 m, eller mer än 1,50 m utanför fasaden mellan 3,00 och 5,00
  m, mot ±0). Ett klick med BTA eller BYA visar konturen i planen
- **Underindelning**: *Funktion* (t.ex. *Handel* och *Kontor* inom LOA, med
  egen färg), tillhörighet (e/g) och temperaturreglering ((t)/(it)), valfria
- **Areaplan**: en ny kategori för våningarna med areorna tända och utan
  möbler, mått och rumsstämplar. Areorna har en halvtransparent fyllning
  ovanpå väggarna och konturen i samma färg, och en stämpel med
  beteckningen och arean. I andra vyer är de släckta (*Visa › Areor*).
  Färgerna under stilboken › Allmänt › **Areor**: BTA orange, BOA ljusgrön,
  BIA mörkgrön, ÖVA grå, LOA gul, Kontor blå; BYA bara konturen. En äldre
  stilbok får kategorin med *Lägg in Areaplan* i verktygets rad
- **Areaförteckning**: *Ny: Areor* under Förteckningar ger BYA, BTA, BRA
  (summan av BOA, BIA, LOA och ÖVA) och de ritade areorna per våning,
  grupperade per areaslag. Delposterna med en decimal, summorna i hela m²
  (SS 21054, 4.3)
- **Smarttext**: `{BYA}`, `{BTA}`, `{BRA}`, `{BOA}`, `{BIA}`, `{LOA}`,
  `{ÖVA}` och `{OPA}` för hela projektet, t.ex. *96 m²*, i ritningshuvudet
  eller en text på bladet
- **DXF**: areorna på mallens lager `A-A-BOA-E-N` (ytan) och `A-A-BOA-T2N`
  (stämpeln), i Enkel `A-AREA-BOA`
- **XLSX**: förteckningarna kan sparas som Excel-fil (*Spara som XLSX* och
  i *Exportera…*), med talen som tal och delsummorna och summan som formler
- Versionerna efter heter nu 0.12.4 (areor under snedtak och mark), 0.12.5
  (förteckningen), 0.12.6 (IFC), 0.12.7 (utgåvor och PM) och 0.12.8
  (3D-vyer)

Version 0.12.2, Förteckningar (samma filformat, 28; projekt från 0.11.8
öppnas; nya valfria fält: projektets `schedules` och vyns `maxHeight` på
bladet):
- **Förteckningar** under Vyer i projektträdet: *Ny:* **Rum**, **Dörrar**,
  **Fönster**, **Grindar** eller **Littera** (det generella litterat). En
  förteckning räknas fram ur modellen varje gång och är alltid aktuell;
  den visas som en tabell över ritytan, och dess inställningar i
  egenskaperna
- **Kolumnerna** väljs ur källans fält (rum: nummer, namn, våning, area,
  omkrets, rumshöjd, dagsljus, glasarea; dörrar och fönster: littera,
  antal, typ, beskrivning, våning, modulmått, karmyttermått, hålmått,
  hängning, bröstningshöjd och förteckningens fält ur stilboken; grindar:
  littera, antal, räcke, bredd, höjd, hängning, lås; littera: nummer, sort,
  text, antal objekt; och status för alla), eller som **eget fält** med
  smarttext ur objektet. Rubriken går att skriva om, kolumnerna flyttas och
  tas bort, och tal kan **summeras** (Σ)
- **Sortering** i två led (stigande eller fallande), **gruppering** med en
  rubrik och delsumma per grupp, och en **summarad** längst ned. Dörrar,
  fönster och grindar har **en rad per littera** med antal som förval;
  det som skiljer sig mellan objekten står som *Olika*, våningarna räknas
  upp. **Tillståndet** och **våningarna** som räknas väljs per förteckning
- **På bladet**: en förteckning läggs på ett blad som en vy (*Lägg på
  bladet* i förteckningen, eller bland vyerna i bladets egenskaper). Den
  ritas i 1:1 med rubriken ovanför, och en lång tabell **bryts i delar
  bredvid varandra** med rubrikraden i varje (*Största höjd*, förval
  bladets ram). Den följer med i bladets PDF och DXF (lagret `A-------I--`,
  i Enkel `A-TEXT`) och räknas inte i bladets `{skala}`
- **Export**: förteckningarna är en egen grupp i *Exportera…*, med **CSV**
  (förval; semikolon och decimalkomma för svensk Excel) och PDF. *Spara som
  CSV* finns också i förteckningen. Filnamnsmallen under stilboken ›
  Allmänt › Export
- Versionerna efter heter nu 0.12.3 (areor och förteckningen), 0.12.4
  (IFC), 0.12.5 (utgåvor och PM) och 0.12.6 (3D-vyer)

Version 0.12.1, DXF (samma filformat, 28; projekt från 0.11.8 öppnas;
nya valfria fält: stilbokens `export.dxf`, uppsättningens `dxfVersion` och
väggens `loadBearing`):
- **DXF i Exportera…**: vyer blir DXF som förval (PDF som val), blad PDF
  med DXF som val. Under **DXF** i dialogen väljs versionen: **AutoCAD
  2000** (förval, öppnas av alla program) eller **AutoCAD 2018**
- **Vyerna** i modellens koordinater i mm (lokal nolla), med texter och
  linjetyper i vyns skala; **bladen** platta i pappers-mm med ramen och
  ritningshuvudet. Linjer, bågar, cirklar, polylinjer, texter och
  skrafferingar (HATCH, solid eller med skrafferingens linjer); bilder
  (underlag, loggor) följer inte med, och dialogen säger till
- **Lagren** räknas fram ur objektet: byggdel (yttervägg eller innervägg,
  bärande eller inte, fönster och dörrar efter väggen, fast eller lös
  inredning …), del och **status** (N nytt, E befintligt, R rivs, mot
  Befintligt när projektet har det). Under stilboken › Allmänt › **DXF**:
  **SB11 förenklad** (förval, t.ex. `A-27C---E-N`), **SB11 fullständig**
  (också skuren, bortom och hitom, och litteran per byggdel), **Enkel**
  (`A-VÄGG-NY`, `A-DÖRR` …) eller en **egen lista**: *Läs lagerlista ur
  DXF…* läser lagren ur kontorets mall (färg, linjetyp, tjocklek och
  beskrivning), och exporten lägger varje lager på det närmaste i listan.
  *Alla lager i listan* skriver också de tomma
- **Färgerna** följer pennan som i pennväljaren (grå 0,13, cyan 0,18, röd
  0,25, grön 0,35, svart 0,50, magenta 0,70, blå 1,00, gul 1,40), och
  linjetjockleken är pennans. Lagren har färgerna ur SB11-mallen; en linje
  med lagrets penna följer lagret (BYLAYER)
- **Väggarna** i planen hamnar på var sitt lager också där de flyter ihop
- **Bärande** i väggens egenskaper (utan val är ytterväggar bärande och
  innerväggar inte), för lagren 27B/27C och 43CB/42A
- Versionerna efter heter nu 0.12.2 (förteckningar och areor), 0.12.3
  (IFC), 0.12.4 (utgåvor och PM) och 0.12.5 (3D-vyer); den fjärde siffran
  är för snabba buggfixar

Version 0.12, Exportdialogen och PDF (samma filformat, 28; projekt från
0.11.8 öppnas; nya valfria fält `exportSets`, `guids`, stilbokens `export`
och ett eget typsnitt som fil):
- **Exportera…** (förut *Plot/export*, kommandot `EXPORT`) är en dialog för
  all export: trädet med **Ritningar**, **Vyer**, **3D-vyer** och
  **Modellen**, kryssrutor på mappar och rader, en sökruta och **formatet
  per rad** (blad och vyer PDF, 3D-vyn PNG och/eller JPEG, modellen glTF;
  DXF, förteckningar och IFC kommer i 0.12.1–0.12.3)
- **Uppsättningar**: *Spara som…* sparar urvalet, formaten och
  inställningarna med namn i projektet (*Bygglov*, *Till konstruktören*);
  välj den i listan, eller skriv `EXPORT Bygglov` i kommandoraden. Är alla
  blad (eller vyer) kryssade sparas det som *alla*, så att nya blad kommer
  med; uppsättningarna följer med *Mall för nya projekt…*
- **Vart**: direkt i en **mapp på datorn** (Chrome frågar om lov; mappen
  kommer ihåg sig per projekt, *Välj en annan mapp…*), eller en
  **zipfil**; *Undermappar per format* (PDF, Bilder, glTF). En ensam fil
  sparas för sig
- **Förhandslistan** visar filnamnen innan något skrivs, med *dubblett* där
  två blir lika (den andra får *(2)*), och filernas storlek efteråt.
  Filnamnen skrivs som smarttext under stilboken › Allmänt › **Export**:
  `{ritningsnummer}` för blad som förval (beteckningen inte i namnet),
  t.ex. `{ritningsnummer}_{titel}`; `{projekt}_{vy}` för vyer och bilder,
  `{projekt}` för modellen
- **PDF:en**: **lager** (ett per vy på bladet, eller dessutom per
  objektgrupp: väggar, dörrar och fönster, mått, text …) som går att släcka
  i Acrobat och Bluebeam; **dokumentegenskaper** (titel, ämne, nyckelord,
  ritningsnummer, benämning, skede, datum, också som XMP); en fil per blad
  eller **en samlad fil med bokmärken** i trädets ordning; valfri stämpel
  **ARBETSMATERIAL** med datum nederst till vänster. Samma projekt ger
  samma bytes
- **Typsnittet** väljs under stilboken › Allmänt: **osifont** (förval),
  **Arimo** (mäter som Arial) eller **Josefin Sans**, eller **Eget
  typsnitt** (*Välj fil…*, en öppen TTF- eller OTF-fil som sparas i
  stilboken och följer med *Exportera…* och mallen). Samma fil ritar på
  skärmen och bäddas in i PDF:en, så att texterna bryts lika
- **Bild ur 3D-vyn** i vald storlek (förval 3 000 × 2 000), ur 3D-vyns
  kamera men aldrig ur fönstret: utan markering och med vit bakgrund
- **glTF** (.glb) av modellen med material och marken, för Blender;
  objekten har sort och GUID
- **GUID**: varje objekt får en beständig IfcGloballyUniqueId första
  gången det exporteras, som sedan följer med (en kopia får en ny)
- PDF:erna skrivs i en bakgrundstråd, en fil i taget med förlopp och
  *Avbryt*; bilderna ur 3D sist

## Publicera på webbhotellet

Du behöver inga byggverktyg. Varje version finns färdigbyggd som en zip-fil.
Det enda som krävs är inloggningen till webbhotellet.

### Första gången

1. **Hämta zip-filen.** Gå till
   [Releases](https://github.com/agrellarkitektur/cad-apa/releases) (länken
   finns också i högerspalten på projektets GitHub-sida). Öppna den översta
   versionen och klicka på `cad-apa-v0.6.2.zip` under *Assets*. Numret är
   versionen; ta den senaste.
2. **Packa upp den på datorn.** I Windows: högerklicka på filen, välj
   *Extrahera alla…* och sedan *Extrahera*. På Mac: dubbelklicka. Du får en
   mapp som heter `cad-apa`. I den ligger bland annat `index.html` och en mapp
   som heter `assets`.
3. **Logga in på webbhotellet.** Öppna webbhotellets kontrollpanel och leta
   upp *Filhanteraren* (heter ibland *File Manager* eller *Filer*). Det går
   lika bra med ett FTP-program som FileZilla, med de FTP-uppgifter
   webbhotellet har gett dig.
4. **Gå till webbplatsens rotmapp.** Det är mappen där webbplatsens egna filer
   ligger, ofta kallad `public_html`, `httpdocs`, `www` eller domännamnet. Är
   webbplatsen gjord i WordPress är det mappen där `wp-config.php` och
   `wp-content` ligger.
5. **Ladda upp mappen `cad-apa`.** Hela mappen, så att den hamnar bredvid de
   andra filerna. Kan filhanteraren inte ladda upp mappar: ladda upp zip-filen
   i stället, markera den och välj *Packa upp* eller *Extract*, och ta sedan
   bort zip-filen.
6. **Prova.** Öppna `https://din-domän.se/cad-apa/` i webbläsaren. Programmet
   startar med exempelprojektet. I Chrome kan det installeras som app med
   ikonen i adressfältet, och det fungerar sedan även utan nät.

Kontrollera att det blev `cad-apa/index.html` på servern och inte
`cad-apa/cad-apa/index.html`. Har mappen hamnat ett steg för djupt: flytta
innehållet upp ett steg, eller ändra adressen därefter.

### Uppdatera till en ny version

1. Spara ditt projekt som fil (*Arkiv → Spara som fil…*). Programmet sparar
   också automatiskt i webbläsaren, men en fil är säkrast.
2. Vill du kunna gå tillbaka: döp om den gamla mappen på servern, till exempel
   till `cad-apa-0.6.1`. Den versionen finns då kvar på
   `https://din-domän.se/cad-apa-0.6.1/`. Annars: ta bort den gamla mappen
   `cad-apa`.
3. Hämta och ladda upp den nya zip-filen som i steg 1–5 ovan.
4. Den som har programmet öppet får en rad längst ned: *En ny version finns.*
   Tryck *Ladda om*.

Äldre versioner kan öppna sina egna projekt, men inte projekt som har sparats
i ett nyare format. Sedan 0.6.2 skriver en äldre version aldrig över ett
projekt som en nyare version har autosparat; statusraden visar då *Autospar
låst*, och det man gör i den äldre versionen sparas som fil.

### Synpunkter

Formuläret *Skicka synpunkter* skickar till skriptet `feedback.php` som
följer med i mappen `cad-apa`. Vart det skickas står inte i koden (den är
öppen), utan i en egen fil som bara finns på servern:

1. Skapa en textfil som heter `feedback-config.php` med innehållet

   ```php
   <?php return ['to' => 'du@dindomän.se', 'from' => 'noreply@dindomän.se'];
   ```

   `to` är den som får synpunkterna. `from` ska vara en adress som finns, på
   samma domän som webbplatsen; annars vägrar många webbhotell att skicka,
   eller så hamnar mejlen i skräpposten.
2. Ladda upp den **bredvid** mappen `cad-apa` (i samma mapp som `cad-apa`
   ligger i, t.ex. `public_html`). Där ligger den kvar när `cad-apa` byts ut
   vid en uppdatering. Det går också att lägga den i `cad-apa`, men då måste
   den flyttas med vid varje uppdatering.
3. Prova: öppna programmet, tryck *Alfa – Skicka synpunkter*, skriv något och
   skicka. Titta i skräpposten om inget kommer fram. Går det inte att skicka
   visar formuläret (sedan 0.8) vad servern svarade:
   - *Synpunkter är inte uppsatta på den här servern*: `feedback-config.php`
     hittas inte. Den ska heta exakt så och ligga i mappen som `cad-apa`
     ligger i, eller i `cad-apa`.
   - *Servern kunde inte skicka e-post*: webbhotellet stoppar `mail()`,
     oftast för att `from` inte är en adress som finns på domänen.
   - *fel 500* utan förklaring: ett fel i PHP, ofta ett stavfel i
     `feedback-config.php`, eller en för gammal PHP (minst 7.4 behövs).

Skriptet använder webbhotellets vanliga `mail()`. Kräver webbhotellet SMTP
med inloggning för att skicka får skriptet byggas ut. Flyttar programmet
till en annan domän: flytta `feedback-config.php` med och byt `from` till en
adress på den nya domänen.

### Om något inte fungerar

- **Tom sida:** mappen ligger fel, se ovan. Ladda om med Ctrl+F5.
- **Går inte att installera som app:** webbplatsen måste ha `https://`.
  Webbhotellet skickar dessutom oftast `.webmanifest`-filer rätt, men gör det
  inte det kan en fil som heter `.htaccess` med raden
  `AddType application/manifest+json .webmanifest` läggas i mappen `cad-apa`.

### Göra en ny version (för den som utvecklar)

Höj versionen i `package.json` och `src/core/engine.ts`, skriv vad som är nytt
här i README och skicka upp ändringarna. Sedan 0.8.13 laddas varje push till
`main` upp till webbhotellet med FTP (`.github/workflows/publicera.yml`, med
uppgifterna i repots secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` och
`FTP_DIR`). En zip för den som vill lägga upp själv: gå till *Releases → Draft a new
release*, skriv en ny tagg som `v0.6.3`, och tryck *Publish release*. Efter
några minuter har GitHub byggt programmet, kört testerna och lagt
`cad-apa-v0.6.3.zip` på releasen (se `.github/workflows/release.yml`).

Vill man bygga själv: `npm install` och `npm run build`. Innehållet i `dist/`
är då detsamma som i zip-filens mapp `cad-apa`.

## Byta varumärke

1. Kopiera `src/brand/cad-apa.ts` till en ny fil och ändra namn, logga och färg.
2. Lägg till den i listan i `src/brand/index.ts`.
3. Bygg med `VITE_BRAND=<nyckel> npm run build`.

## Mappar

```
src/
  brand/      produktnamn, logga, färger och filändelse
  core/       datamodell, tillstånd, kommandon, ångra och gör om
  elements/   en fil per objekttyp: vägg, dörr, fönster, möbel, rum
  repr/       ritningsprimitiver, planen och 3D-formerna
  view2d/     planvyn: kamera, rutnät, skalstock, ritning av primitiver
  view3d/     3D-vyn med three.js (laddas först när den öppnas)
  storage/    filformat med versioner, autospar, spara och öppna
  formats/    läsare för andras filformat (DXF), utan beroenden
  sample/     exempelprojektet
  ui/         verktyg, egenskapspanel, stilmall, meny, statusrad, ikoner
  geometry/   vektorer, polygoner och booleska operationer
  styles/     CSS med ljust och mörkt tema
  fonts/      Archivo, IBM Plex Mono, Arimo och Josefin Sans (SIL Open Font License), osifont (GPL med typsnittsundantag)
tests/        tester för kärnan, planen och filformatet
docs/         arkitektur och byggordning, utvecklarguide
LICENSES/     licenstexterna för det som kommer från andra (se THIRD-PARTY.md)
.github/      bygget som lägger en zip för webbhotellet på varje release
```

## Licens

**Licens**
cad-apa är fri programvara under GNU Affero General Public License v3.0
eller senare (AGPL-3.0-or-later, se `LICENSE`). Du får använda, studera,
ändra och dela programmet fritt, även i kommersiellt arbete. Kör du en
ändrad version som tjänst måste du erbjuda användarna din källkod.
AGPL gäller från version 0.12.5.4; tidigare versioner är GPL-3.0 eller
senare.

**Kommersiell licens**
Vill du bygga in cad-apa i en produkt eller tjänst utan AGPL:s villkor
finns kommersiella licenser. Kontakta kontakt@agrellarkitektur.se.

**Namn och varumärke**
Namnet cad-apa (och motorns namn Bacchus) och dess logotyp får inte
användas för ändrade versioner utan skriftligt tillstånd.

**Bidrag**
Bidrag välkomnas och kräver att du godkänner vårt CLA, se
`CONTRIBUTING.md`.

**Det som kommer från andra**
Bibliotek och typsnitt med sina licenser står i `THIRD-PARTY.md`, och
licenstexterna i `LICENSES/` och `src/fonts/`.
