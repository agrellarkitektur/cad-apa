# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning och hålls kort: historiken finns i git, Claudes val och det
som inte gjordes i PLAN.md (klara versioner i `docs/arkiv/`), koden i
UTVECKLING.md (äldre i `docs/arkiv/`), och där också **Arbeta
i sandlådan** (bygga, Playwright, klickjämförelsen, mätningar) och
**Kända begränsningar**. Vad varje version märks i ritningarna står i
README. Senast: 10 november 2026, efter 0.12.2 Förteckningar.

## Läget

- **0.12.2 Förteckningar är klar** (10 november, samma format 28; valfria
  fält projektets `schedules` och vyns `maxHeight` på bladet), byggd i en
  session efter Carl Augusts svar A–E: **0.12.2 Förteckningar och areor
  delades** i 0.12.2 Förteckningar och **0.12.3 Areor och uppställningen**,
  resten flyttade ett steg (IFC 0.12.4, Utgåvor och PM 0.12.5, 3D-vyer
  0.12.6); en lång tabell bryts i delar bredvid varandra på samma blad; CSV
  nu, XLSX i 0.12.3 med en egen skrivare; rumsförteckningens förval nummer,
  namn, våning, area och rumshöjd. Han vill senare ha en egen enkel
  **rumsbeskrivningsmall** och ett eget **BEAst-paket** (efter piloten).
  Testerna: 977 på ca 13 s. Provat i Playwright mot `dist/` (skapa, ändra
  kolumner, ordning och gruppering, ångra, lägga på blad, exportera CSV,
  PDF och bladets DXF; `qpdf`, `pdftoppm`, ezdxf `audit` utan fel). Claudes
  val och det som inte gjordes i PLAN.md, koden i UTVECKLING.md.
- **Märks i hans ritningar efter 0.12.2:** under **Vyer** i projektträdet
  finns **Förteckningar** med *Ny:* Rum, Dörrar, Fönster, Grindar, Littera.
  En förteckning visas som tabell över ritytan med inställningarna i
  egenskaperna (kolumner med rubrik och Σ, eget fält som smarttext,
  sortering, gruppering, summarad, en rad per littera, tillstånd,
  våningar, *Lägg på bladet*, *Spara som CSV*). På bladet i 1:1 med
  rubriken ovanför, *Största höjd* där den bryts. *Exportera…* har gruppen
  **Förteckningar** (CSV och PDF).
- **0.12.1 DXF är klar** (10 november, samma format 28; valfria fält
  stilbokens `export.dxf`, uppsättningens `dxfVersion`, väggens
  `loadBearing`), byggd i en session efter Carl Augusts svar A–E:
  versionen heter 0.12.1 och resten flyttar ett steg, **den fjärde siffran
  är för snabba buggfixar**; lagerkartorna ur `cad-apa-lager-bsab-forslag.md`
  (SB11 förenklad som förval, fullständig, Enkel, *Läs lagerlista ur
  DXF…*; CoClass i en framtida version); pennväljarens färger; 2018 som
  val. Hans mall `Mallfil_SB11-lager.dxf` är baslinjen
  (`src/core/dxfLayerData.ts`). Testerna: 969 på ca 14 s. Kontrollerat
  med ezdxf (`audit` utan fel) och i Playwright mot `dist/` (dialogen,
  stilboken, inläsningen av hans mall). Inte öppnat i AutoCAD, Archicad
  eller QCAD (finns inte här). Claudes val och det som inte gjordes i
  PLAN.md, koden i UTVECKLING.md.
- **Märks i hans ritningar efter 0.12.1:** *Exportera…* har **DXF** per
  rad (vyer DXF som förval, blad PDF med DXF som val) och avsnittet **DXF**
  med versionen (AutoCAD 2000 eller 2018). Stilboken › Allmänt › **DXF**:
  *Lager* (SB11 förenklad, SB11 fullständig, Enkel, Egen), *Läs lagerlista
  ur DXF…*, *Alla lager i listan*. Väggens egenskaper har **Bärande**.
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
- **Publicerad:** 0.12.2 pushad till `main` 10 november (se git och `gh run
  list`). `add_repo` med push går direkt när Carl August skriver "push
  godkänd" i första meddelandet.
- **Versionsnumret** är `0.12.2` i `engine.ts`, `package.json` och
  `package-lock.json`. Nya funktioner får tredje siffran (0.12.3 …); **den
  fjärde siffran är för snabba buggfixar** utan nya funktioner (Carl August
  10 november). En granskning höjer inte numret, eller får en fjärde siffra
  om något ändras som syns.
- **0.10.8–0.12.2 är inte provade fullt ut** av Carl August; han har
  svarat på frågor om flera av dem utifrån beskrivningarna.
- **Frågorna:** de obesvarade (nedan) ställs **högst tio per session**,
  de som hör till den kommande versionen först. Carl August vill ha **fem
  åt gången**. En fråga han hoppar över räknas som "bra som det är" och
  stryks. Han bad 27 oktober att resten väntar; ställ dem inte förrän han
  ber om det, utom de som hör till nästa version.
- **Publicering:** varje push till `main` laddas upp med
  `.github/workflows/publicera.yml` (FTPS; secrets `FTP_SERVER`,
  `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_DIR` =
  `/agrellarkitektur.se/public_html/cad-apa/`). Se efter med `gh run list`.
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
  ~~0.12.1 DXF~~, ~~0.12.2 Förteckningar~~ (klara;
  se tabellen *Klart* i PLAN.md)
- **Höjdkurvor: ortofotot med i platspaketet** (liten; i Höjdkurvors repo
  och session)
- **0.12.3 Areor och uppställningen** (stor, kan behöva två sessioner:
  SS 21054, uppställningen av fönster och dörrar, XLSX, markförändringarna
  om de ryms) → **0.12.4 IFC** (egen utredning först) → **0.12.5 Utgåvor
  och PM** (mockup först); se `cad-apa-export-utredning.md`. Sedan
  **Granskning efter 0.12**.
- **0.12.6 3D-vyer** (sparade perspektiv och axonometrier, trädmodeller,
  trädens status i planen)
- **Koordinater, SWEREF och sol** (stor; före piloten; SWEREF på
  situationsplanen och i exporten därifrån)
- **0.13 Pilotprojektet**: Carl August ritar själv ett hus
- **Inbjuden alfa**, sedan **öppen beta och formatfrys**
- Efter piloten: se *Efter pilotprojektet* i PLAN.md. **1.0**
  bygglovshandling.

## Nästa session

Läs synpunkterna först och sortera Inkorgen om den har något. Be om
skrivrätt till repot ("push godkänd"). Fråga om Carl August provat 0.12.2,
0.12.1 och 0.12; ställ i så fall frågorna om dem (nedan) först, högst fem åt
gången. Öppnar en DXF inte i hans AutoCAD eller Archicad: be om
felmeddelandet och fixa det som en fjärde siffra (0.12.2.1). Nästa version
är **0.12.3 Areor och uppställningen** (stor, risk för två sessioner): se
avsnittet i PLAN.md och `cad-apa-export-utredning.md`; föreslå en
uppdelning först (t.ex. areorna och XLSX i en, uppställningen i en).
Areorna ska använda samma areaslag som DXF-lagren (`A-A-BTA`, `BOA`, `BIA`,
`BYA`, `BRA` …, se lagerförslagets 4.2) och följa SS 21054:2020, som ligger
i projektets kunskapsbas. Slå upp definitionerna där, inte ur minnet.
Förteckningarna (`src/repr/schedules.ts`) är grunden: en areaförteckning är
en ny källa, uppställningen en ny sorts tabell. IFC och PM får egen
utredning/mockup i egen chatt före sina versioner. Vid granskningen efter
0.12 delas `src/ui/style/profileTypes.ts` (875) och `openingTypes.ts` (828).

## Att fråga Carl August om

Fem åt gången, högst tio per session, de som hör till nästa version först.
Hoppar han över en räknas den som bra och stryks. Claudes val står i varje
fråga. Frågorna om 0.10.28.2 och 0.10.28.1 när han provat materialen; de
om 0.10.27–0.10.23 likaså. Nästa omgång börjar med 0.12.2, 0.12.1, 0.12, 0.11.8.4, 0.11.8.3, 0.11.8.2, 0.11.8, 0.11.7.3,
0.11.7.2, 0.11.7.1, 0.11.7, 0.11.6.1, 0.11.6, 0.11.5, 0.11.4, 0.11.3,
0.11.2, 0.11.1 och 0.11, sedan 0.10.35, 0.10.34 och 0.10.33 när han
provat.

**0.12.2 efter provning** (Claudes val, se PLAN.md; svaren A–E 10 november)
- Förteckningen visas som tabell över ritytan och stängs när man går till
  en våning, vy eller ett blad. Räcker det, eller ska den kunna stå bredvid
  planen (som 3D i *Båda*)?
- Inställningarna sparas direkt när ett fält ändras (inget *Spara*), och
  varje ändring kan ångras. Bra, eller hellre *Spara* som för vyerna?
- På bladet: text 2,5 mm, radhöjd 5,5 mm, rubrikraden fet, ytterram 0,25,
  linjer 0,13. Lagom, och ska texthöjden gå att ändra per förteckning?
- En rad per littera är förval för dörrar, fönster och grindar; det som
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
  visar mer i sidled. Räcker det tills de sparade 3D-vyerna (0.12.6) får
  en sökarram?

**0.11.8.4 efter provning** (Claudes val, se PLAN.md)
- Barnsäkra fönster varnar på våningar där våningshöjden plus bröstningen
  är minst 2,0 m (marken antas vid ±0). Rätt grund, eller ska fallhöjden
  räknas mot den färdiga marken utanför fasaden?

**0.11.8.3 efter provning** (Claudes val, se PLAN.md)
- Vägghålens förval: Ventgaller 300 × 200, Nisch 600 × 600 och 100 djup,
  Genomföring Ø 160, Rent hål 600 × 600; måtten i mm och höjden som
  underkant. Rätt, och saknas någon typ (urtag, brevinkast i vägg)?
- I fasaden blir ett drag överkant karm när den står fast, annars
  bröstningen; dörrar bara i sidled. Ska fönster också kunna flyttas med
  piltangenterna där?
- *I liv med fönstret under* lägger mitten över mitten. Behövs *i liv med
  kanten* (vänster eller höger) också?
- *Lika avstånd* kräver tre i samma vägg (de yttersta står kvar). Ska två
  kunna fördelas över hela väggen, mot väggarnas liv?
- Dagsljuset räknar glaset innanför bågarna mot golvarean, med 10 % som
  tumregel. Rätt grund, eller ska ljusinsläppet (LT) och avskärmningen
  vägas in?

**0.11.8.2 efter provning** (Claudes val, se PLAN.md)
- Bleck med utsprång 40 och droppnäsa 20, fönsterbänk 22 mm med utsprång
  20 (överkanten i karmens underkant), foder 70 × 15 på båda sidor.
  Rimliga förval? Ska fodret och bänken få material (nu som karmen)?
- Beslagen ritas i fasad, sektion och 3D, inte i planen. Behövs
  handtaget eller dörrstängaren i planen (Detalj)?
- Fri passage räknas ur geometrin (bladets luft minus bladet), och
  varnar under 760 (800 för ytterdörrar och huvudentrén). Alla dörrar
  varnar, inte bara entréplanets. Räcker det, eller behövs ett kryss
  *Tillgänglig* per dörr?
- Tillgänglighetscirkeln står på dörrens båda sidor, mitt för dörren och
  tangerande väggen. Rätt, eller bara på slagsidan, eller flyttbar?

**Besvarade 1 november, 0.11.8.1 (A–E):** A fönstrens slagbågar ska inte
synas som förval (gjort i 0.11.8.2); B spröjsens förval står; C skrivet
mått för Special (gjort); D spegelns profil (gjort); E fältmallen i en
egen flik i stilboken, sökbar med taggar som pennorna, med smarttext, och
alla fält med i exporten, med ett filter för de egna (gjort, Typer ›
Uppställningens fält).

**0.11.8 efter provning** (Claudes val, se PLAN.md; drevmånen besvarad 1
november: hålet + 10, karmen − 10, gjort i 0.11.8.1)
- Ytterdörrar sitter i liv på den sida de slår mot, fönster i liv ute
  (0). Rätt förval?
- Litterans nummer sparas för varje kombination första gången den
  dyker upp; ett nytt fönster får nästa lediga nummer även om det sitter
  först i fasaden. Bra, eller ska numren följa ordningen tills man låser?
- Pardörrens passiva blad är det högra sett utifrån. Rätt förval?

**0.11.7.3 efter provning** (Claudes val, se PLAN.md)
- Trappans littera står längs gångriktningen framför början, utan ledare.
  Rätt plats, eller hellre vid gånglinjens pil eller vågrätt?
- En trappa på Platsen är utomhus av sig själv (300 mm). Rätt, och behövs
  en egen steghöjd utomhus (t.ex. högst 170)?
- Spaljén SP01 fick ribbor 34 mm c/c 150 i ±45°. Ser det rätt ut? Ska
  mönstret också synas i planen (Detalj)?

**0.11.7.2 efter provning** (Claudes val, se PLAN.md)
- *Böjd nedåt* går 100 mm ned under ledstången, utan böjradie. Lagom, och
  behövs en radie?
- *Mot vägg* går tillbaka till räckets linje (60 mm utåt när ledstången
  ligger på linjen). Rätt, eller ska den gå till en vägg den hittar?
- Varningen för fri höjd räknar med 2 000 mm och stegets tjocklek. Rätt
  gräns för spiraltrappor i bostäder?

**0.11.7.1 efter provning** (Claudes val, se PLAN.md)
- Litteran står utan ledare och går inte att flytta (som räckets grindar).
  Behövs den flyttbara, med ledare, som väggarnas?
- De inre linjerna ritas också för en delprofil som ligger dold under en
  annan. Störande?
- Stilbokens export tar alltid med alla profil- och räckestyper (inget
  kryss). Rätt, eller ett kryss som för mallbladen?
- *Pelare i hörnet* kommer först nära en sidas ände, också i en dörr- eller
  fönstersmyg. Bra, eller bara i riktiga hörn?

**0.11.7 efter provning** (Claudes val, se PLAN.md)
- En ändprofil ligger Utöver som förval och sträcks bara med profilens
  höjdzon. Rätt förval? Behövs en egen sträckzon i ändprofilen?
- En räckesdel med en profiltyp ligger med ankaret på *Överkant*. Rätt,
  eller ska fältet heta *Ankarets höjd* för profildelar?
- Bara typer kryssade *Del i räcke* (eller *Vangstycke*) står i listorna,
  så PR01 syns inte som stolpe förrän man kryssar. Rätt, eller alla?

**0.11.6.1 efter provning** (Claudes val, se PLAN.md)
- Måtten pekar på parametrar bara i typen; ändrade per objekt sträcker
  de inte (beslut B: senare). Behövs det före piloten?
- Ett mått sträcker det övre eller högra när värdet ändras. Rätt, eller
  ska man kunna välja vilken ände som flyttas?
- *Kant i kant* skjuter ut punkten ur en annan delprofil, men kanterna
  mellan punkterna kan fortfarande skära in. Räcker det som hjälp?
- Varningen för avslut räknar bågar i korta bitar, så ett snett avslut på
  en bågformad bana varnar tidigt. Störande?

**0.11.6 efter provning** (Claudes val, se PLAN.md)
- Tvärsnittet läggs till höger om banan (Tab byter sida). Rätt förval,
  eller hellre till vänster?
- *Längs kant* kopierar kanten; profilen följer inte väggen när den
  flyttas, och Shift tar bara det klickade objektets kontur (en väggs fyra
  sidor). Behövs en profil som följer väggen, eller hela husets kontur?
- Avsluten: lodrätt som förval för pelare och balkar, vinkelrätt för
  resten. Rätt?
- Smartmenyn på en väggs kant har fått *Profil längs kanten* och *Profil
  längs hela konturen*. Blir den för lång?

**0.11.5 efter provning** (Claudes val, se PLAN.md)
- Förvalen 200/1 800 mm, 360° och moturs uppåt. Rimliga, eller hellre
  medurs?
- Gånglinjen ligger 300 från ytterkanten, som i andra trappor. Rätt för
  en spiraltrappa, eller ska den ligga i mitten?
- Ett nytt stegdjup ändrar graderna (inte diametrarna). Rätt?
- Det ovanför snittet ritas streckprickat också ovanpå det heldragna när
  trappan går mer än ett varv. Rätt, eller bara det som inte ligger över
  något heldraget?
- Behövs en knapp för att göra om en vanlig trappa till spiral (och
  tillbaka)?

**0.11.4 efter provning** (Claudes val, se PLAN.md)
- Vangstyckena står innanför trappans bredd (bredden är yttermåttet).
  Rätt, eller ska bredden vara den fria bredden mellan dem?
- Vangstycke 50 × 300, plansteg 40 med stegnos 30, sättsteg 20. Rimliga
  förval för en villatrappa?
- Utan material: plansteg i trä, vangstycken och sättsteg vitmålade. Ska
  stilboken få ett material *Trä* (bara nya projekt)?
- Kontrastmarkeringen: ingen som förval, 50 mm, mörk remsa. Ska *Första
  och sista* vara förval, och ska en varning hänvisa till BFS 2024:9 (inte
  uppslaget än)?

**0.11.3 efter provning** (Claudes val, se PLAN.md)
- Ett trappstegat fack ligger på sin högsta punkt, så att glipan under
  växer nedåt i facket. Rätt, eller hellre medelhöjden (och lite i
  marken)?
- *Längs kant* längs ett hål, ett bjälklag eller en ramp kopierar linjen;
  räcket följer inte med när kanten ändras (bara trappor gör det).
  Behövs det kopplade räcket före piloten?
- En grind som följer staketet får en egen littera (G02 när G01 är en
  typ). Hellre ingen littera utan grindtyp?
- Stolparna i ST-typerna och grindstolparna syns redan i Normal (andra
  delar i Detalj). Rätt nivå för situationsplanen?
- Gruppernas knappar i editorn syns när musen är över gruppen, i stället
  för högerklick som på tavla 4. Räcker det?

**0.11.2 efter provning** (Claudes val, se PLAN.md)
- En grupp tas bara bort när den är tom. Hellre att typerna flyttas till
  gruppen ovanför?
- *Ny typ…* ger delar efter gruppen (stolpe, handledare, spjälor; spaljén
  ett rutnät). Hellre en kopia av den valda typen?
- Förhandsvisningen ritar typens förvalda värden, inte det markerade
  räckets. Räcker det?
- Projekt utan räckestyper får RÄ01–RÄ03 med en knapp i editorn. Ska de
  hellre finnas från början i nya projekt?

**0.11.1 efter provning** (Claudes val, se PLAN.md)
- RÄ01 har en rund ledstång 70 mm innanför handledaren, på *Skyddshöjd −
  40*. Rätt förval, eller ett räcke utan ledstång och RÄ03 bredvid?
- Den utjämnade handledaren avviker mer än 50 mm vid kilstegen i de flesta
  L-trappor, så varningen syns ofta. Lagom, eller ska gränsen gälla bara
  den inre kanten?
- I Detalj ritas handledare, ledstång och stolpar, inte spjälorna. Ska
  spjälorna synas i planen?
- Ett räcke på en trappa flyttas inte för sig (*Lösgör* först). Rätt?
- Innanför 50 mm som förval på trappan. Lagom?

**0.11 efter provning** (Claudes val, se PLAN.md)
- Referenslinjen ligger i mitten som förval. Hellre en kant (oftast ritar
  man längs en vägg)?
- Kilstegen strålar från det inre hörnet, så att de blir spetsiga där.
  Rätt, eller ska de balanseras (framkanterna inte genom hörnet)?
- Snittlinjen snett över trappan är 0,25 och samma ställe som trappans
  snitt i sektionerna. Rätt, eller två ställen?
- Hålet ritas i planen ovanför som bara en kant (utan kryss), så att
  trappan syns. Rätt?
- *Gör till eget hål* gör hålet till en vanlig håltagning som inte följer
  trappan. Räcker det, eller behövs det kopplade hålet (följer med vid
  flytt, kan låsas upp) före piloten?
- *Syns också på* ritar allt grått 0,18 utan text och går inte att klicka
  på där. Rätt?

**Besvarade 31 oktober, utredningen av 0.11.6:** A–H, se
`cad-apa-profil-utredning.md` och PLAN.md (*0.11.6 Profilen*).

**Besvarade 30 oktober, planeringen av 0.11:** A delningen 0.11–0.11.3
(räcket direkt efter trappan, ska kunna byggas ut); B vilplan både per
sträcka och per sväng; C gånglinjen ställbar, alltid från utsidan, förval
300; D första/sista plansteget räknas som en del av trappan; E räcket får
egen utredning med mockup. Dessutom: referenslinjen ritas i
trappverktyget, smartspöt är ett alternativ. Allt gjort i 0.11 utom
räcket (0.11.1). Räckets utredning: A–H besvarade (se PLAN.md).

**Besvarade 30 oktober** (Claudes val gäller): 0.10.32 alla fyra
(vytypens kategori när ingen vy är sparad; kategoribyte släpper vyns
ändringar; pennorna per kategori tills 0.10.36; Poché och Färgmarkerad
som kategorier, gjort i 0.10.33). 0.10.31: ortofotot där marken saknar
material, plus valet *Ortofoto* (gjort i 0.10.33); bildens sida i mm.
0.10.30: rutornas mått lagom så länge; en rad "Eget" per fyllning (prova).

**0.10.40 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Mallbladen och stämplarna är ikryssade som förval vid export, import
  och mallen. Rätt, eller hellre okryssade vid import (så att samma
  mallblad inte läggs in två gånger)?
- Mallbladens mappar i projektträdet följer inte med (de hamnar överst i
  Ritningar). Störande?
- Typerna (YV01, D1 …) och vy-taggarna följer inte med mallen. Ska de?

**0.10.39 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Kontorets taggar (`{företag}`, `{telefon}` …) är inga fält på bladen;
  de fylls bara i under Allmänt. Rätt, eller ska ett blad kunna skriva
  över dem?
- Ett ifyllt skede under Allmänt gäller alla blad (bladens egna försvinner
  och kommer inte tillbaka när det töms). Rätt?
- Måtten i m skrivs med två–tre decimaler (3,45 och 3,455), i cm med en
  (345,5). Lagom?
- Logotypen läggs 40 mm bred med nedre vänstra hörnet där man klickar.
  Lagom, eller hellre i ramens hörn?

**0.10.38 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Dörrar och fönster har nu var sina rader i fasaden för karm, glas, foder,
  skarvar och öppningssätt (förut gemensamma). Bra, eller hellre
  gemensamma rader för öppningarna?
- Väggar, bjälklag och tak slås ihop i sektionens snitt så länge deras
  snittlinjer är lika; ändras en blir det en skarv mellan dem. Rätt?
- Gruppen heter *Bjälklag, tak, stödmurar, möbler och rum* också i
  fasaden, där rummen inte har någon rad. Störande?

**0.10.37 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Med jämförelsen på går åtgärdens färg före en rad med egen färg (i
  Färgmarkerad blir allt nytt rött, också en blå glasrad). Rätt?
- Bjälklag, tak och stödmurar har bara en snittlinje; deras oskurna
  linjer är raderna *under snittet*. Räcker det?
- Fönstrets bleck och dörrens karm i kontur ritas inte i planen och har
  ingen rad där. Ska blecket synas i planen?
- En egen penna med bara en färg (ingen tjocklek) står inte i
  pennlistan. Rätt?

**Besvarade 30 oktober (förmiddag), 0.10.36:** A snitt- och konturlinjer
per objekt, sammansatta objekt med flera av varje (0.10.37); B väggens
penna för öppningarnas oskurna linjer; C *Symbol* följer *Snitt*; D
linjetypen hör till stället; E alla pennor i projektet ska gå att söka
(material, typer, objekt); F snittlinjen ger tjockleken, åtgärden färg och
streckning; G snitt- och konturlinjerna före Allmänt; H över- och
undersnitt kvar som egna ställen. Kvar efter provning: sparas sorteringen
per rubrik i filen, eller räcker det att den kommer ihåg sig medan sidan
är öppen?

**0.10.35 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Underlagen ligger i kategorin (Illustrationsplan kan ha ortofotot i alla
  sina vyer). Ska ett nytt projekts Illustrationsplan ha ortofotot under
  sig från början, när platsen har ett?
- DXF/bild är ingen egen källa: *Fil…* lägger in filen där du är, som
  förut. Behövs en fil som bara hör till vyn?
- Krysset *Underlag* under Visa gäller bara filunderlagen. Ska det också
  släcka underlagen i vyn?
- Underlagen ritas i den ordning de lades till, utan flyttknapp. Räcker
  det? Och 40 % som förval?

**0.10.34 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- *Vanliga* är förvalet och döljer *Snittet i planen* och sällan ändrade
  kryss under Innehåll (det ändrade syns alltid). Rätt urval, eller ska
  *Alla* vara förvalet?
- Favoriterna: plus sparar i det valda setet, högerklick tar bort en.
  Räcker det, eller behövs en tydligare knapp för att ta bort?
- Pennorna har ingen opacitet (bara åtgärdernas fyllning och bakgrund).
  Behövs det?
- Visa-menyn har kvar sina kryssrutor. Ska den också få knappar med
  symbol, som Innehåll?

**0.10.33 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- *Återställ* på en ändrad rad syns när musen är över raden (pricken
  syns alltid). Hellre alltid synlig?
- En kategori får prickar mot sitt förval (t.ex. Skiss mot Plan), inte
  bara en vy mot sin kategori. Hjälper det, eller stör det?
- Undertak och Golvplan i 1:50 utan möbler, öppningssätt och littera
  (undertaket också utan mått); Mått och littera utan möbler. Rätt
  innehåll? Undertaket ritas inte spegelvänt än.
- *Ny vy → en kategori* tar kategorin som den är, inte det som visas nu
  (det gör *Med det som visas nu…*). Rätt?

**0.10.31 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Ortofotot och texturerna skuggas som kulörerna; Carl August vill att
  allt skuggas men har inte sett det än. Ser det rätt ut?

**0.10.30 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Rader läggs till och tas bort per material (*När det syns*, *Alltid*,
  *Aldrig*). Behövs fria rader med egen text och eget mönster? (Oklart
  för honom innan han testat; fråga efter provning.)

**0.10.29 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Shift fritt avrundar vinkeln till hela grader; står man i ett vinkellås
  eller på en punkt gäller exakt den riktningen. Rätt, eller ska fritt
  också vara exakt (t.ex. 37,28°)?
- Parallell kopia och Förskjut alla kanter skrivs också vid objektet, som
  Förskjut. Rätt?
- Platsens rad i våningslistan har kvar *markmodell* / *plan mark* under
  namnet. Ska den också få tankstreck och en höjd (t.ex. ±0 i RH 2000)?

**0.10.28.3 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Markytans höjd föreslås nu också ur den färdiga marken (inte bara
  rampens). Rätt?
- Markobjekten på Platsen hänger på ±0 och flyttar inte när en
  våningshöjd ändras (testat); platån runt huset följer golvet. Såg du
  något annat flytta? Då behövs en skärmbild.

**0.10.28.2 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Bjälklaget fylls i planen under snittet med materialets mönster (Betong
  ger betongmönster över hela golvet, under rummen). Rätt, eller ska
  bjälklagen bara få materialet i snitt och 3D och planen vara tom som
  förut?
- Materialets snitt gäller det som är kvar och nytt, och ersätter
  stilmallens fyllning (t.ex. skrafferingen för nytt); det som rivs ritas
  som förut. Rätt, eller ska stilmallens fyllning för nytt gå före?
- Ytan syns bara i fasader, inte i sektionernas vy bortom snittet. Ska
  den synas där också?
- Takpannor (linjer var 350 mm) och Plåt (falsar var 600 mm) är nya. Ser
  de rätt ut i fasaden och på Platsen? Saknas något byggnadsmaterial?
- Mönstrets vinkel, avstånd och skala för snittet och ytan går inte att
  ändra (förvalen gäller; Takpannor och Plåt har sina). Räcker det, eller
  behövs en redigerare som för planen?

**0.10.28.1 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Listan har tre färger per material (planen, illustrationsplanen, 3D),
  men mönstret i planen ändras bara i panelen för ett objekt med
  materialet. Räcker det, eller ska mönstret också gå att välja i listan?
- En stödmur utan material på Platsen är bara konturen (förut svart).
  Rätt, eller ska den få en ton?
- Ett material som sparas ur en 2D-form får varken *Mark* eller
  *Byggnad* (markobjekten ser det inte förrän man kryssar). Rätt?
- De nya fyllningstyperna: Gatsten 100 i förband, Stenmur i stora block,
  Trall med brädor 145 och Singel som prickar på papper. Ser de rätt ut?
- Shift som släpps mitt i ett drag panorerar igen. Ska vyn hellre
  fortsätta snurra tills knappen släpps?

**0.10.27 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Mellanslag + dra panorerar och Mellanslag + Shift + dra snurrar (du sa
  "kör" utan att svara på frågan). Bra, eller hellre något annat?
- Rutan tar det vars omslutande rektangel på skärmen ryms i eller nuddar
  rutan, som i planen. Snett sett kan en vägg tas från höger till vänster
  fast rutan bara går nära den. Störande?
- Ett drag som börjar på det markerade flyttar det, som förut. Ska ett
  drag alltid vara en ruta (flytt bara med Flytta och greppen)?

**0.10.26 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Ser rampens kant med stödmur rätt ut nu? Lodytan har markens kulör;
  ska den se ut som en mur (eller ska sidan bli en riktig stödmur med
  krön, frågan om 0.10.18)?
- Höjdkurvorna i planen räknas som förut på rutnätet och kan ligga en
  ruta fel vid en stödmurskant (i 3D tas de bort där). Störande?
- Stödmuren har kantlinjer i hörn som viker mer än 20°. Lagom gräns?

**0.10.25 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Husets verktyg (vägg, tak, bjälklag …) går att använda på Platsen, och
  objekten hamnar då på Platsen, inte i huset (klickjämförelsen visade
  det). Ska de spärras där, eller öppna en våning, som Mark öppnar
  Platsen?
- Husets kontur på Platsen är 0,35 heldragen utanför taken och streckad
  under dem. Rätt, eller ska taket vara streckat och fasadlivet
  heldraget? Behövs en egen penna i stilmallen?
- Marken i våningsplanerna är en kalkering (tonad, inte klickbar, i
  stället för annan kalkering). Räcker det, eller ska den vara ett eget
  val under Visa, så att våningen under kan kalkeras samtidigt?
- Förinställningarnas skalor och innehåll (Situationsplan 1:400 utan
  markörer; Markplaneringsritning 1:200 med branta slänter;
  Illustrationsplan 1:200 utan höjdkurvor, mått och littera). Lagom?
- Ska *Bara den här våningen* i 3D heta något annat på Platsen?

**0.10.24 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Äldre bjälklag och markytor behåller sina korta raka bitar. Behövs en
  knapp som gör om en sådan kontur till bågar (som *Ur väggarna* urbockat
  gör), eller räcker det att rita om med spöet?
- Markytans polygon sluts när man byter verktyg (som linjerna avslutas).
  Rätt, eller ska den kastas som bjälklagets?

**0.10.23 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Takfallet med spöet täcker hela husets kontur, med takfoten vid kanten
  närmast och taket stigande inåt (ett pulpettak över huset). Rätt, eller
  ska spöet i *Takfall* ge ett takfall per sida?
- Pulpet, Sadel och Valm läggs över den omslutande rektangeln också när
  huset inte är rektangulärt. Räcker det?
- Måttkedjan tar båda liven på varje anslutande vägg, också i hörnen
  (väggtjockleken). Rätt, eller bara innerväggarna?
- Littera med Shift: var sin littera på varje objekt. Hellre en littera
  med en ledare till varje?

**0.10.20 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Markhöjden räknar marken som oförändrad när ny och befintlig skiljer
  mindre än 5 cm (då bara den befintliga, understruken). Lagom gräns?
- Konturen runt slänterna är alltid på (0,13). Ska den vara ett val, eller
  få en egen penna i stilmallen?
- De branta slänterna är grå (muted) och följer fallinjen; strecken bryts
  där markobjekten ändrat marken. Rätt färg och gräns (1:3)?

**0.10.19 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Övergångarnas förval är 20 m radie (en ramp 1:12 jämnas av över ca
  1,7 m, under Platsen). Lagom för en gångväg?
- I ändarna börjar och slutar rampen plant med ändens höjd, och den raka
  delen blir brantare (visas som lutningen). Hellre att lutningen hålls
  och höjden i änden blir en annan?
- Dockningen: ändar inom rampens bredd räknas som samma, skarven får den
  första rampens sluthöjd och den andra rampens starthöjd faller bort.
  Rätt?
- *Båge* i verktyget Mark fungerar som i takets kontur. Bra, eller
  räcker Böj i Modifiera?

**0.10.18.1 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Höjdkurvornas färg gäller planen och bladen; 3D-vyns kurvor har sin
  egen. Ska de följa stilmallen också?

**0.10.18 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Tvärfallet vrider kring referenslinjen, också när den ligger på en
  kant. Rätt, eller ska det vrida kring rampens mitt?
- En ritad sida ligger kvar när referenslinjen flyttas. Ska den hellre
  följa med när hela referenslinjen flyttas (men inte när en punkt dras)?
- *Kanterna* gäller alla kanter och nollställer sidorna; ändarna har inget
  eget val. Behövs *Början* och *Slutet* för sig?
- En sida som är stödmur är bara en tjock linje (ingen kropp i 3D, ingen
  höjd). Ska den bli en riktig stödmur med krön, som Stödmur-objektet?
- Förlängd ramp: lutningen fortsätter. Hellre plan (vilplan) eller
  höjden ur marken i den nya änden?

**0.10.17 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Ett klick på änden av en omarkerad linje ritar vidare på den. Störande
  när man vill börja en ny linje där (Ctrl+klick)?
- Ett klick mitt på en kant startar det senast använda valet på en kant.
  Var det så du menade, eller ville du bli av med något sådant?
- Bågar direkt i takets kontur och håltagningen (*Båge*, G). Ska 2D-
  verktygets linje få samma (fråga 59)?
- Vrid och spegla hålet kring punkten man klickade på. Hellre kring hålets
  mitt?

**0.10.16 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Ett fönster helt över eller under snittet ritas som hålets två kanter
  och glaset. Räcker det, eller ska karmen synas?
- En möbel som går genom snittet (t.ex. ett högskåp) ritas som förut, som
  symbol. Ska den ritas snittad?
- Den egna pennans del *Över snittet* följer objektets penna när den är
  tom. Rätt, eller ska den följa stilmallen?
- Dubbelklick på Visa tänder inte det som är släckt från början (husets
  kontur genom taket, linjerna i 3D). Rätt?

**0.10.15 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Det dolda räknas med i väggarnas skarvar och rummen. Rätt, eller ska en
  dold vägg också försvinna ur rummens konturer?
- De dolda objekten tas fram alla på en gång. Behövs en lista att ta fram
  dem ett och ett?
- Greppet för *Tonat från* ligger en bit från mitten (romb), djupets i
  mitten (fyrkant). Lätt att hitta?
- Ska högerklick i 3D-vyn dölja bara i 3D, eller gälla vyn som nu?

**0.10.14 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Slänternas fyllning täcker ytan som släntstrecken går över. Rätt yta,
  också där två markobjekt möts?
- Mönstret utgår från objektets första hörn. Behövs ett grepp för att
  flytta utgångspunkten?

**0.10.12 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Riv och *Finns i* fungerar på låsta objekt (de ändrar status, inte
  läget). Ska låset hindra dem också?
- Markörens penna i delen *Markör* är stilmallens och gäller alla
  sektions- (eller fasad-)markörer. Behövs en egen penna per markör?
- Bjälklag bakom snittet är på från början i sektionerna (släckta i
  fasaderna). Rätt?
- En våning som tas bort tar med sig sina låsta objekt (efter frågan).
  Rätt?

**Följdfrågor från 27 oktober**
- Trädens status (till 0.12.6): ska texten "Träd skyddas under
  byggtiden" stå i en förteckning, eller skriver man den själv?

**0.10.11 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Våningens meny: Visa, Inställningar, Byt namn, Ny våning ovanför och
  under (den högerklickade våningen), Ta bort. Saknas något? Ska
  arbetsbladen få en meny också?
- Visa-menyn: inställningarna till vänster, kategorierna i två kolumner
  till höger. Bra ordning, eller detaljnivåerna överst över hela bredden?
- Hovring i 3D tonar objektet ljust i markeringsfärgen. Lagom tydligt?
- Markobjekten markeras med ett klick i marken, och konturen ritas på
  marken. Ska hörnen också gå att dra i 3D?

**0.10.8 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Höjdkurvorna: hela meter 0,25 och halvmeter 0,13 heldragna; den gamla
  marken grå streckad. Lagom?
- Släntstrecken var 2,5 mm på papperet, korta 40 %, solfjäder i
  utåtgående hörn; jämförs med den färdiga marken efter alla objekt.
  Ser de rätt ut, också där två markobjekt möts?
- Fallpilen runt huset: en per fasad längre än 3 m. Lagom?
- ±0-klicket läser den befintliga marken (inte den färdiga). Rätt?

**Bjälklag och våningar (0.9–0.9.4)**
35. Fri höjd som text i rummet (*RH 2400*) i stället för måttkedja?
36. Våningens namn vid FG?
37. Bjälklagets kontur tunn under väggarna, klickbar vid kanten; förval
    300.
38. En ny våning ovanför flyttar dem där; ändrad våningshöjd flyttar
    våningarna ovanför.
39. Namnen Plan 2 … och Källarplan.
40. En borttagen våning tar bort sina vyer från bladen.
41. Flytta och Kopiera till våning i högerklicksmenyn, inte i smartmenyn.
42. *Bara den här våningen* gäller för honom, inte per vy.

**Pennor, linjer och fyllningar (0.8.22–0.8.37)**
43. Vyradens knappar sätter alla tre detaljnivåer; fasaderna följer
    3D-nivån; rumsstämpeln ingen nivå.
44. Ser de inbyggda fyllningarna rätt ut? Räcker guiden?
46. Saknas något villkor i Filtrera och markera (riktning, längd, area)?
47. Förvalen snitt 0,25, vy 0,18, symbol 0,13 mm; *Vy* som egen del i den
    egna pennan?
48. Rum har ingen egen penna; pennan finns inte i smartmenyn.
49. DXF-underlagens streckade linjer streckade?
50. Förhandsvisning av linjetypen i listorna?
53. *Fortsätt* bortvalbar bland snabbknapparna? Nya kanter med verktygets
    penna?
54. Saknas någon markör bland pennorna? Streckning valbar?
57. En rektangel förblir inte rät när ett hörn dras; cirkeln saknar
    centrumgrepp.
58. Smartmenyn alltid *Ändar* för en markerad linje?
59. Bågar direkt i Linje (A som i PLINE)?
60. Rumsstämpelns ordning gäller hela projektet; *Fyllningar* under Visa
    gäller vyn.

**Kommandoraden, ritande och underlag (0.8.13–0.8.21)**
61. *Avbryt* bland alternativen? Skala och måttbandet med skrivna
    punkter?
62. Kommandon direkt utan Enter (kortkommandon med en bokstav
    försvinner)? Fungerar `@` med AltGr?
63. Rutnätet lagom tydligt? Segmentpunkterna per vy; Rensa rensar alla.
65. Autosparen kommer ihåg filen mellan sidladdningar (Chrome frågar)?
66. Rumsstämpelns pil mot närmaste kant eller rummets mitt?
67. X och Y nedre vänstra hörnet också för DXF, inte filens nollpunkt.
68. Gruppen för en fil på flera ställen utfälld från början?
70. Trimma avslutas efter ett klick: fortsätta tills Esc som i AutoCAD?

**Blad och mallar (0.8.7–0.8.12)**
71. Bilder under vyerna, linjer och text över; inga mått på bladet;
    bladet följer inte tillstånden.
72. Arbetsbladen oberoende av tillstånden?
73. Textrutor: dra upp rutan med textverktyget, se kanten markerad?
74. Fält utan värde blir tomma på papperet.
75. Mallen från papperets nedre vänstra hörn på andra format.
76. Stämmer platshållarna i hans ram som blev smarttext?
77. Skalstocken 230 mm från högerkanten och 40 mm upp; i 1:50 är strecket
    vid 10 mm kort och tunt: avsiktligt?
78. Dölja hela vyrubriken, inte bara skalan?

**Övrigt**
79. Kommer synpunktsformulärets brev fram till Gmail nu (efter `-f`)?
    Annars Gmail-adressen direkt som `to` i `feedback-config.php`.
80. Smartmenyns placering; ska rubriken *Ändra* heta något annat?
