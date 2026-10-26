# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 26 oktober 2026, efter 0.10.2
(marken planerad samma dag).

## Läget

- **0.10.2 Takfot och taket i planen är klar** på `main` (samma format,
  17; bara valfria nya parametrar). Carl August sa "kör nästa version"
  och fick planen i chatten innan arbetet började (inget svar än). Taket
  är nu en kropp av plana bitar (`roofBody` i den nya `roofBody.ts`):
  takfoten snittas vinkelrätt mot takytan från början (en remsa längs
  kanten), nock, grat och gavel lodrätt; takfotens snitt väljs på taket
  och en kant kan få ett eget i Modifiera (*Vinkelrätt*, *Lodrätt*,
  *Vinkel*, *Förval*). Språngets tjocklek (utanför husets kontur,
  `footprint.ts`) är ett fält på taket. Snitthöjd per våning (förval
  1200, `Storey.cutHeight`): taket ritas punktstreckat ovanför,
  heldraget under och med snittyta där planet skär (`roofPlan.ts`); ett
  tak syns också i planen för en våning det går upp i
  (`ElementType.alsoOnStorey`, bara planen). *Husets kontur genom taket*
  under Visa (Modell), släckt från början (`+footprint` i vyns `hide`).
  Nivåkoten *Takfot* är kroppens lägsta undersida. Referensritningarna
  med tak ändrades med avsikt. Testerna: 467 på ca 11 s. Provat med
  Playwright mot `dist/` (egenskaperna, Visa, snitthöjden, sektionen,
  smartmenyn för en kant); klickjämförelsen kördes inte. Claudes val i
  PLAN.md, koden i UTVECKLING.md under *Takfot och taket i planen
  (0.10.2)*.
- **Inkorgen 26 oktober** (efter 0.10.1) sorterades av Claude som
  förslag, inte bekräftade (se synpunktsfilen och *Att fråga*): skarven
  mellan våningarna syns inte hos Carl August, och bandet i fasaden får
  vara (svar på frågorna om 0.10.1); Visa för väggar m.m. och att dölja
  objekt med högerklick föreslås som 0.10.10, linjerna i 2D-formen
  (Förskjut flera kanter, fortsätta och sluta en linje, foga ihop) som
  0.10.11, sparade 3D-vyer efter 0.12 eller efter piloten. *Upp till
  taket* är kvar (26 oktober).
- **0.10.1 Granskning**: Carl August bad om granskningen före takfoten
  (26 oktober). Inkorgens punkt 26 oktober (bjälklaget kapar väggen som
  taket) togs med, eftersom det är samma kod.
- **0.10.1**: felet Carl August såg (väggar under bjälklag i 3D och
  sektion) var väggarnas kantlinjer: de slogs ihop per våning och fick
  den första väggens id, så bjälklaget kapade inte innerväggarnas linjer
  och en markerad YV01 lyste upp alla väggars linjer i sektionen. Nu har
  varje vägg sina linjer (`edgeOwners`), bjälklagen ovanför kapar väggen
  exakt där de täcker den (`underSlabs` i den nya `wall3d.ts`, i stället
  för regeln om väggens mitt), och linjen mellan våningar med samma liv
  är borta (`joinStoreys`; kvar under dörrar och där väggen kragar ut).
  `wall.ts` delad i `wallBodies.ts`, `wall3d.ts` och `wall.ts`; 3D-vyn
  ritar alla kantlinjer i en geometri; en kvadratisk slinga i väggarnas
  3D borta. Referensritningarna ändrades med avsikt (linjernas id, `tva-*`).
  Klickjämförelsen mot 0.10.0: 223 steg, bara de tio med fasader och
  sektion av tvåvåningshuset skiljer (som väntat: egna pennor på rätt
  linjer, kapningen, skarvarna). Testerna: 459 på ca 11 s. Claudes val i
  PLAN.md, koden i UTVECKLING.md under *Granskning (0.10.1)*.
- **0.10.0**: Carl August valde enkla takfall i stället för en kontur med
  takfot och gavel per kant: komplexa tak byggs av flera. Ett tak har
  kontur (2D-form med bågar) och referenslinje (`ref`, `refBulge`) med
  höjd för under- eller ovansidan, lutning och tjocklek; en båge ger en
  kon (64 plana bitar). Verktyget: Takfall (kontur, referenslinje, sida),
  snabbvalen Pulpet/Sadel/Valm över en rektangel i ytterlivet och *Över
  hela huset*. Kapa mot tak i Modifiera. Taket kapar väggar på alla
  våningar; Upp till taket bara på egen våning. Exempelvillans tak är två
  takfall, så referensritningarna ändrades (samma geometri som förut,
  utom att undersidan når 2700 exakt i ytterlivet). Claudes val i
  PLAN.md, koden i UTVECKLING.md under *Tak (0.10)*. Testerna: 456 på ca
  15 s. Provat med Playwright mot `dist/` (valm, takfall, kon, Kapa mot
  tak, greppen i fasaden); klickjämförelsen kördes inte.
- **0.9.4**: håltagningarna är `{ points, bulges? }` och ändras som en
  2D-form när bjälklaget är markerat (grepp, Lägg till/Flytta/Ta bort
  punkt, Förskjut kant, Böj, Räta ut, *Flytta hålet*, *Ta bort hålet*);
  *Avrunda* och *Fasa hörn* för både hål och 2D-former; kryssrutan
  *Bjälklagens yta går att klicka i* i Gränssnitt (av från början).
  Rättat: pipetten förde över håltagningarna och *Ur väggarna*; speglade
  hål behöll bågarnas riktning. Claudes val i PLAN.md, koden i
  UTVECKLING.md under *Bjälklag del 2 (0.9.4)*. Testerna: 450 på ca 11 s.
  Klickjämförelsen mot 0.9.3 (med formatnumret och hålens form
  normaliserade) skiljer bara där ett bjälklag med hål är markerat:
  hålens grepp och en rad i egenskaperna. Det nya provat med Playwright
  mot `dist/`.
- **0.9.3**: fasader och sektioner av samma projekt och vy bygger
  3D-modellen en gång (`modelShapes` sparar de senaste svaren), och
  kanterna räknas fortare: fyra fasader och en sektion av ett hus med tre
  våningar à 312 väggar ca 4,3–4,9 → 3,0–3,6 s. `section.ts` 519 → 371
  rader (`sectionLevels.ts`, `sectionCut.ts`), en slinga i `modelShapes`,
  kvarlevorna `z0 = 0` borttagna. Testprojektet `twoStoreys` (två
  våningar, fasta id) med referensritningar `tva-*`, skrivna med 0.9.2;
  klickjämförelsen 223 steg (våningar, bjälklag, nivåer), samma läge och
  bild i 0.9.2 och 0.9.3. Testerna: 444 på ca 11 s. Står i README,
  PLAN.md och UTVECKLING.md under *Granskning (0.9.3)*.
- **0.9.2**: nivåkoter med beteckning (FG, UK bjl, Takfot, Nock; Carl
  August valde FG/ÖK/UK), höjdmått i sektioner (bjälklagens tjocklek och
  fri höjd), innerväggarna slutar vid bjälklaget ovanför (synpunkt från
  Inkorgen), båda markeringarna i Visa (Markörer). Referensritningarna för
  fasader och sektioner ändrades (texterna och UK bjl under plattan).
  Claudes val i PLAN.md, koden i UTVECKLING.md under *Nivåer (0.9.2)*.
  Testerna: 440 på ca 12 s. Provat med Playwright mot `dist/` med ett
  tvåvåningshus (exempelvillan med väggarna och plattan kopierade till
  plan 2); klickjämförelsen kördes inte.
- **Inkorgen 25 oktober (efter 0.9.1)** sorterades och bekräftades av
  Carl August: kapade innerväggar i 0.9.2; ingen littera på bjälklag som
  standard och inga automatiska bjälklag på nya våningar (redan så); hål
  som 2D-form och klickbar bjälklagsyta i 0.9.3; marklinjen efter
  markhöjder i 0.10.3 (sedan 26 oktober: marken ur Höjdkurvor i
  0.10.3–0.10.5, urgrävningen i 0.10.4).
- **0.9.1**: nytt objekt `Slab` med littera BJ och tjocklek per typ,
  verktyget *Bjälklag* (rektangel, *Ur väggarna*, *Håltagning*),
  konturen ur ytterväggarnas insida som följer väggarna, ritad kontur som
  ändras i Modifiera som takets, hål med kryss i planen, i 3D, fyllt i
  sektioner och som kant i fasader, rummens golvskiva bort där det finns
  bjälklag. Exempelvillan har en platta på mark (BJ01 400), så
  referensritningarna ändrades. Claudes val i PLAN.md, koden i
  UTVECKLING.md under *Bjälklag (0.9.1)*. Testerna: 437 på ca 11 s.
  Klickjämförelsen kördes inte (det nya provades med Playwright mot
  `dist/`).
- **0.9**: ny våning ovanför och under (golvnivån från grannen, de som
  redan ligger där flyttas), byta våning (trädet, Page Up/Down,
  smartshell), ta bort med fråga, flytta och kopiera till våning
  (högerklick, smartshell), väggarnas höjd följer våningshöjden (format
  14), kalkera våningen under eller över, 3D med alla våningar och *Bara
  den här våningen*, fasader och sektioner med alla våningar och linjerna
  i alla planer, felet med golvnivån i 3D. Claudes val i PLAN.md, koden i
  UTVECKLING.md under *Flera våningsplan (0.9)*. Testerna: 432 på ca 10 s.
  Klickjämförelsen kördes inte (referensritningarna är oförändrade); de
  nya delarna provades med Playwright mot `dist/`.
- **0.8.38 Granskning är klar** på `main` (samma format, 13, utan nya
  funktioner). DXF-underlag med grus och mark (mönster vars linjer är
  förskjutna hundratals linjeavstånd) ritas som klippta streck i stället
  för som ett nästan 90° snett SVG-mönster, som Chrome målade långsamt
  och fel: 2 000 sådana skrafferingar 14 s → 0,6 s per omritning, och
  stenar i stället för prickar (stämmer med ezdxf). Skrafferingen ritas
  med mönstrets kod på skärmen och i PDF:en. `fillTypes.ts` uppdelad
  (`hatchStrokes.ts`, `patFile.ts`). Referensritningar för
  fyllningstyperna och detaljnivåerna, klickjämförelsen 188 steg med
  `--bilder`. Testerna: 424 på ca 10 s. Står i README, PLAN.md och
  UTVECKLING.md under *Granskning (0.8.38)*.
- **0.8.37 Detaljnivåer och fyllningar är klar** på `main` (samma
  format, 13). Tre detaljnivåer per vy (littera, 2D-symboler, 3D och
  fasader) i Visa och vyns egenskaper; vyradens knappar sätter alla tre.
  Fyllningarna: åtta inbyggda typer (kopierbara), linjetjocklek per typ
  och snabbguiden. Claudes val i PLAN.md, koden i UTVECKLING.md.
  Testerna: 420 på ca 11 s. Carl Augusts beslut 25 oktober: tre val per
  vy; rikare 3D-detalj i 0.11.2; att rita mönster grafiskt i 0.11.1;
  isoleringsobjekt efter piloten.
- **0.8.33–0.8.36** (pennor per typ och symbollinjer, rummens kontur och
  rumsgränser, Filtrera och markera, egna fyllningstyper med .pat) står i
  PLAN.md med Claudes val och i UTVECKLING.md med var koden ligger.
- **0.8.32 Granskning** (testerna färre, snabbare och typkontrollerade,
  `dxf.ts` uppdelad, rummen och väggarnas utsida delar sammanslagningen)
  står i README, PLAN.md och UTVECKLING.md under *Granskning (0.8.32)*.
- **0.8.28–0.8.31** (rättelser i 2D-formen, bakgrund i fyllningar och
  ändformer, linjetyper och mask, linjetyp och penna per objekt) står i
  PLAN.md med Claudes val och i UTVECKLING.md med var koden ligger.
  Carl August har inte svarat på frågorna om 0.8.29–0.8.31 nedan.
- **0.8.27 Granskning** (utan nya funktioner; fasaderna ungefär dubbelt så
  fort) står i README, PLAN.md och UTVECKLING.md under *Granskning
  (0.8.27)*.
- **Carl Augusts provning 25 oktober**: 0.8.26 syns på webbhotellet, och
  sorteringen av Inkorgen 24 oktober stämde. Tre fel i 2D-formen blev
  0.8.28 (klar). Inkorgen 25 oktober sorterades och
  ordningen bekräftades av Carl August. Efter 0.8.28 (samma dag) svarade
  han: fortsätta bara den markerade linjen är bra; fyllningarna ska få en
  bakgrundsfärg med egen opacitet; ändformerna ska följa linjen i
  ritordningen. Det blev **0.8.29** (klar). Efter 0.8.29 kom fyra nya
  synpunkter (mask, penna och linjetyp per objekt, footprint genom taket,
  dolda linjer i fasader), och ordningen i färdplanen nedan bekräftades
  samma dag. 2D-formernas linjer, fyllningar och masker ska kunna ligga
  framför väggarna i planen.
- **0.8.22–0.8.26** (småsaker, granskning, 2D-form del 2 med bågar och
  ändar i format 13, ritordning och fyllningar, pennor i stilmallen) står
  i PLAN.md med Claudes val och i UTVECKLING.md med var koden ligger.
- **0.8.12–0.8.26 är inte provade fullt ut** av Carl August (han har
  provat 2D-formen, se ovan). Frågorna nedan gäller.
- Tidigare versioner (0.8.15–0.8.21) står i PLAN.md med Claudes val.
- **Publicering:** varje push till `main` laddas upp med
  `.github/workflows/publicera.yml` (FTPS; secrets `FTP_SERVER`,
  `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_DIR` =
  `/agrellarkitektur.se/public_html/cad-apa/`). Se efter med `gh run list`.
  Halvfärdigt arbete kan läggas på en egen gren (som `granskning-0823`
  i 0.8.23), så att det inte publiceras.
- **Prestandatestet** varierar med sandlådans hastighet (gick över 1,6 s i
  0.8.16 och 0.8.25). Fasaden i testet tar sedan 0.8.27 ca 0,2 s, så
  marginalen är större.
- **Färdplan** (Carl August 22 oktober): 0.13 är hans egen provning (han
  ritar ett hus), sedan en inbjuden **alfa** för arkitektvänner, sedan en
  **öppen beta**. **Formatfrysen kommer med den öppna betan.** Inget av
  stegen är 1.0. Håll färdplanen nedan aktuell vid varje överlämning
  (CLAUDE.md).
- **Ord:** *palett* och *snabbmeny* betyder samma sak för honom. Säg bara
  **smartmeny**.
- **Bakåtkompatibilitet:** inga migreringar före formatfrysen (den öppna
  betan). Höj `FORMAT_VERSION` när formatet ändras; äldre filer får ett
  meddelande om att de kommer från en äldre alfaversion (`parse` i
  `src/storage/format.ts`). Valfria nya parametrar (som `opacity` och
  `labelAt`) har inte krävt ett nytt format.
- **Telefonen är inget mål.** Testa på dator (Chrome).
- Arbetssätt: Carl August testar varje version på webbhotellet. Ingen demo
  och ingen zip om han inte ber om det. Säg alltid hur stora föreslagna
  ändringar är och om de riskerar att behöva mer än en session (CLAUDE.md).
- **Synpunkter:** Carl August samlar dem i `cad-apa-synpunkter.md`
  (projektets kunskapsbas), med rubrikerna Inkorg, Planerat per version,
  Parkerat och Avfärdat. Läs den vid sessionsstart (Projects-verktyget,
  `project_read`). Sortera Inkorgen tillsammans med honom: föreslå version
  för varje punkt och säg om något är för stort för en session. Ta bort
  hanterade punkter när de görs; behåll Avfärdat med anledning.

## Färdplan

Kort; detaljerna står i PLAN.md. Uppdateras vid varje överlämning.

- ~~0.8.8 Mallblad~~ … ~~0.8.21 Kommandoraden del 2~~,
  ~~0.8.22 Småsaker~~, ~~0.8.23 Granskning~~, ~~0.8.24 2D-form del 2~~,
  ~~0.8.25 Ritordning och fyllningar~~, ~~0.8.26 Pennor i stilmallen~~,
  ~~0.8.27 Granskning~~, ~~0.8.28 Rättelser i 2D-formen~~,
  ~~0.8.29 Bakgrund i fyllningar och ändformer~~,
  ~~0.8.30 Linjetyper och mask~~, ~~0.8.31 Linjetyp och penna per
  objekt~~, ~~0.8.32 Granskning~~, ~~0.8.33 Pennor per typ och
  symbollinjer~~, ~~0.8.34 Rum: kontur och rumsgränser~~,
  ~~0.8.35 Filtrera och markera~~, ~~0.8.36 Egna fyllningstyper~~,
  ~~0.8.37 Detaljnivåer och fyllningar~~, ~~0.8.38 Granskning~~,
  ~~0.9 Flera våningsplan~~, ~~0.9.1 Bjälklag~~, ~~0.9.2 Nivåer~~,
  ~~0.9.3 Granskning~~, ~~0.9.4 Bjälklag del 2~~, ~~0.10 Tak~~,
  ~~0.10.1 Granskning~~, ~~0.10.2 Takfot och taket i planen~~ (klara)
- **Marken före piloten** (Carl August 26 oktober): **0.10.3 Markmodell**
  (platspaketet från Höjdkurvor, nollpunkt och SWEREF, RH 2000, befintlig
  mark, automatisk medelmarknivå; nytt format 18), **0.10.4 Markobjekt del
  1** (platå, platå runt huset, urgrävning, färdig mark, schakt och fyll;
  stor), **0.10.5 Markobjekt del 2 och byggnadshöjd** (ramp, gångväg,
  infart, höjdpunkt, brytlinje, stödmur; byggnadshöjd enligt PBF; stor),
  **0.10.6 Granskning**
- **0.10.7 Dolda linjer i fasader**
- **0.10.8 Småsaker** (högerklick på planer, Visa i kolumner, snäpp mot
  kalkering, hovring i 3D) och **0.10.9 Höjder i förhållande till
  våningen**
- Förslag, inte bekräftade: **0.10.10 Visa och dölja** (väggar m.m. i
  Visa, dölja ett objekt eller en typ med högerklick) och **0.10.11
  Linjerna i 2D-formen** (Förskjut flera kanter, fortsätta och sluta en
  linje, foga ihop linjer)
- **0.11 Trappor** (nytt format)
- **0.11.1 Profilverktyget** (nytt format, stor; också att rita ett
  mönster och göra det till en fyllningstyp) och **0.11.2 Dörrar och
  fönster** (stor)
- **0.12 Export**: IFC4, DXF, areor för bygglov
- **0.13 Pilotprojektet**: Carl August ritar själv ett hus
- **Inbjuden alfa** för arkitektvänner; deras synpunkter i småversioner
- **Öppen beta och formatfrys**; etiketten blir *Beta*
- Efter piloten: se *Efter pilotprojektet* i PLAN.md (bl.a. kulör och
  material, explodera DXF-underlag, mallblad mellan projekt, **sol och
  analys på platsen**: skuggstudie, horisont, skyfall, lutning). **1.0**
  bygglovshandling.

## Nästa session

Fråga först om 0.10.2 syns på webbhotellet och hur taket ser ut i planen,
3D och fasaderna (frågorna nedan; 0.9.2–0.10.1 har inte provats fullt ut
än). Be honom bekräfta sorteringen av Inkorgen 26 oktober (0.10.10,
0.10.11 och 3D-vyerna, se synpunktsfilen). Läs synpunktsfilen och sortera
ny Inkorg. Be om en riktig platsfil (*Spara platsfil för cad-apa* i
Höjdkurvor, helst pilotens tomt) om den inte redan finns. Sedan **0.10.3
Markmodell** (PLAN.md, *Marken före piloten*), mellanstor till stor:

- Ta emot platspaketet (`docs/UTBYTE-CAD-APA.md` i
  `agrellarkitektur/hojdkurvor`, läsbart utan rättigheter): `postMessage`
  och `.hkplats.json`. Höjdkurvors sida är byggd; `test/cad-apa-mock.html`
  där visar handskakningen
- Nollpunkt, zon, vridning och sann nord; höjder i RH 2000 (modellen
  relativt projektets höjd, visat i RH 2000)
- Rutnätet sparas för sig, inte som tal i projektets JSON
- Befintlig mark i 3D, höjdkurvor i planen (0,5 m), tunn streckad
  marklinje i fasader och sektioner, grannhus som volymer
- Automatisk medelmarknivå
- Föreslå fältet `fastigheter` för Höjdkurvor (finns inte än, står på
  deras lista) och läs det om det finns

Besluten 26 oktober: befintlig mark ändras aldrig; markobjekten är
fristående; ingen penselmodellering; befintlig tunn streckad, ny tjock
heldragen; jordskraffering som val, av från början; medelmarknivån mot
färdig mark som förval, befintlig också (tillstånden); förvalen (slänt
1:2, fall 1:20 de första 3 m, ramp 1:12) går att ändra; ingen skiss
tillbaka till Höjdkurvor; analyserna i cad-apa efter piloten; *Upp till
taket* är kvar.

Nästa granskning: 0.10.6, efter marken.

## Att fråga Carl August om

- **0.10.2 efter provning** (Claudes val, se PLAN.md): att takfoten är
  kanterna som vetter nedåt i lutningen och snittas vinkelrätt från
  början; att vinkeln räknas mot det vågräta (90 = lodrätt); att en kants
  eget snitt glöms när kanten ändras (ett hörn flyttas, kanten förskjuts,
  taket kapas). Språnget räknas från ytterväggarnas utsida på alla
  våningar (husets kontur); stämmer det för ett hus med en lägre
  tillbyggnad? Snitthöjden 1200 från början: vilken använder han? Ett
  tak syns i planen för en våning det går upp i, men ett tak på plan 2
  syns inte i plan 1; ska takfoten (eller hela taket) kunna visas
  streckad i planen under, som vyinställning? Snittytan i planen får
  stilmallens snittfyllning, som väggarna; ska den vara egen? Husets
  kontur ritas bara inne i taken; ska den kunna visas också utan tak (en
  situationsplan)? Nivåkoten *Takfot* är takets lägsta undersida (med
  snittet nu 2515 i stället för 2445 i exempelvillan); byggnadshöjden
  kommer i 0.10.5.

- **Upp till taket**: kryssrutan är kvar (Carl August 26 oktober). Kvar
  att fråga: ska den gå före ett bjälklag som täcker väggen? (Bakgrund:
  synpunkt 26 oktober, "behöver vi ens det?"): taket
  kapar redan väggar som når upp i det, på alla våningar, automatiskt.
  *Upp till taket* gör det omvända: drar upp en vägg som slutar under
  taket (gaveln) till takets undersida. Utan kryssrutan skulle gaveln få
  en höjd över nocken, som taket sedan kapar; det fungerar redan i dag,
  men väggens höjd säger då inget och den sticker upp där den går utanför
  taket. Ska kryssrutan vara kvar, bli förval för ytterväggar under tak,
  eller tas bort? Och ska den gå före ett bjälklag som täcker väggen
  (fråga kvar från 0.10.1)?

- **0.10.1 efter provning** (Claudes val, se PLAN.md): bandet i fasaden
  när bjälklaget ritas till utsidan får vara (svar 26 oktober), och ingen
  skarv syns mellan våningarna i hans Chrome (svar 26 oktober). Kvar:
  linjen mellan våningarna tas bara bort mellan väggar med samma åtgärd
  (mellan befintligt och nytt är den kvar); en vägg med egen penna har
  den nu på sina linjer i fasader och sektioner.

- **0.10.0 efter provning** (Claudes val, se PLAN.md): att taket stiger
  åt vänster om referenslinjen och *Vänd lutningen* byter; att höjden
  gäller undersidan från början och taket ligger kvar när valet byts; att
  positiv radie stiger mot centrum; att snabbvalen dras upp i ytterlivet
  med nocken längs den längre sidan, och pulpettakets takfot på den
  långsida som första hörnet ligger på; att *Över hela huset* bara finns
  för rektangulära hus. Kapa mot tak behåller sidan där man klickade på
  takfallet (strax innanför kanten); kapade bågar blir polylinjer. Upp
  till taket drar bara upp väggar under tak på samma våning. I fasaden
  finns inte längre Shift för att låta nocken stå still. Takfot-koten är
  takets lägsta undersida som förut. Ska referenslinjen synas i planen
  också när taket inte är markerat (t.ex. med lutningspil), och ska
  konturen kunna ritas med bågar direkt i verktyget?

- **0.9.4 efter provning** (Claudes val, se PLAN.md): att hålen är kvar i
  bjälklaget och ändras när det är markerat, inte som egna objekt; att
  menyn för ett hål har *Flytta hålet* och *Ta bort hålet* men inte
  Vrid och Spegla (de gäller hela bjälklaget); förvalen 500 mm för
  Avrunda och 300 mm för Fasa; krysset i ett hål med bågar (den
  omslutande rektangelns diagonaler). Med klickbar yta går ett klick i ett
  rum till bjälklaget, och rummet nås med stämpeln eller Tab: är det rätt
  avvägt, eller ska rummen gå före? Ska håltagningsverktyget också kunna
  rita en cirkel direkt?

- **0.9.3 efter provning**: inget nytt att prova; allt ska bete sig som
  förut. Ett blad med flera fasader och sektioner av ett stort hus, och
  exporten, ska gå fortare. Säg till om något beter sig annorlunda.

- **0.9.2 efter provning** (Claudes val, se PLAN.md): FG vid varje
  vånings golv och UK bjl bara där sektionen skär ett bjälklag; ÖK skrivs
  inte (bjälklagets ovansida är golvet). Beteckningen står före höjden
  (*FG +2,700*), och *Takfot* och *Nock* har fått stor bokstav. Höjdmåttet
  är en kedja bredvid nivåerna; en översta våning utan bjälklag ovanför
  får ingen fri höjd förrän taket finns (fri höjd under tak är inte gjort). Ska fri höjd hellre stå
  som text i rummet (t.ex. *RH 2400*)? Ska våningens namn också stå vid
  FG? (Sedan 0.10.1 kapar bjälklaget väggen där det täcker den, också
  under tak.)

- **0.9.1 efter provning** (Claudes val, se PLAN.md): verktyget med
  rektangel, *Ur väggarna* och *Håltagning*; att *Ur väggarna* slutar vid
  ytterväggarnas insida och att innerväggarna står på bjälklaget; att
  konturen i planen är tunna linjer under väggarna och bara går att klicka
  på (Tab vid väggens insida); förvald tjocklek 300 (BJ01) och 400 för plattan i
  exempelvillan. (Svarat 25 oktober: ingen littera som standard, inga
  automatiska bjälklag, marklinjen efter marken, innerväggarna kapas; se
  *Läget*.)

- **0.9 efter provning** (Claudes val, se PLAN.md): att en ny våning
  ovanför flyttar dem som redan ligger ovanför, och att en ändrad
  våningshöjd flyttar våningarna ovanför (golvnivån gäller bara våningen
  själv); namnen Plan 2 … och Källarplan; att Ta bort också tar bort
  vyerna av våningen från bladen; att Flytta/Kopiera till våning finns i
  högerklicksmenyn och smartshell men inte i smartmenyn, och att kopian
  får samma tillstånd som originalet; att den tonade våningen är ett val i
  Kalkera (med kalkeringens färg och opacitet); att *Bara den här
  våningen* gäller för honom, inte per vy; att norrpilen också hör till
  projektet. (Sedan 0.10 kapar taket väggar på alla våningar.)

- **0.8.38 efter provning**: inget nytt att prova; allt ska bete sig som
  förut. Ett DXF-underlag med grus, mark och liknande mönster ska ritas
  fortare och se ut som i AutoCAD (stenar, inte prickar). Säg till om
  något beter sig annorlunda.

- **0.8.37 efter provning** (Claudes val, se PLAN.md): att vyradens
  knappar sätter alla tre nivåerna och att valen var för sig ligger i
  Visa och vyns egenskaper; att fasaderna följer 3D-nivån; att
  rumsstämpeln inte följer någon nivå. Fyllningarna: ser de inbyggda
  rätt ut (tegelmåtten 250 × 62 med fog, block 600 × 200, betong och trä
  på papper)? Räcker guiden?

- **0.8.36**: Carl August svarade 25 oktober: linjetjocklek per typ,
  färdiga typer och en guide (gjorda i 0.8.37), att rita mönster
  grafiskt (0.11.1) och isolering som objekt (efter piloten). Kvar att
  fråga: fungerar hans `.pat`-filer (han har inte använt dem förut), och
  att mönster med mer än 20 mm mellan linjerna antas vara i verkliga mått.

- **0.8.35 efter provning** (Claudes val, se PLAN.md): att det är en
  dialog (inte en panel) och inte finns i smartmenyns *Mer*; att *Finns
  i* kräver alla ikryssade tillstånd; att bara det som syns i tillståndet
  räknas; att egenskapens värde är "innehåller" utan hänsyn till stora
  och små bokstäver; att egenskaperna öppnas efter Ersätt och Lägg till.
  Saknas något villkor (t.ex. riktning, längd, area)?

- **0.8.34**: Carl August svarade 25 oktober att de fyra punkterna
  (kontur under väggarna, gränsen gäller med 2D släckt, osynlig gräns
  inte tonad, rumsstämpelns pil kvar bland markörerna) är bra som de är.

- **0.8.33 efter provning** (Claudes val, se PLAN.md): förvalen snitt
  0,25, vy 0,18 och symbol 0,13 mm; att dörrbladen (0,35 → 0,18) och
  fönstrens glas (0,25 → 0,18) blev tunnare; att väggen under fönstret
  är kvar på 0,13 utan klass; att bara *Symbol* gäller i fasader och
  sektioner. Den egna pennans *Snitt* och *Symbol* är oberoende: en dörr
  som fick en egen färg i 0.8.31 har nu slagbågen i stilmallens färg.
  Ska *Symbol* hellre följa *Snitt* när den inte är satt? Ska *Vy* också
  finnas som egen del i den egna pennan? Typens penna går fält för fält
  under objektets.

- **0.8.32 efter provning**: inget nytt att prova; allt ska bete sig som
  förut, och planen ritas om lite fortare när en vägg flyttas i ett stort
  hus. Säg till om något beter sig annorlunda.

- **0.8.31 efter provning** (Claudes val, se PLAN.md): att pennan finns
  för väggar, dörrar, fönster, tak och möbler men inte för rum (som inte
  ritar någon kontur); att tjockleken gäller alla objektets linjer
  (sedan 0.8.33 utom slagbågen, som har *Symbol*); att texter och fyllningar
  följer stilmallen; att pennan inte finns i smartmenyn. Rummens kontur
  kommer i 0.8.34; pennan på typen kom i 0.8.33.

- **0.8.30 efter provning** (Claudes val, se PLAN.md): vilka sju
  inbyggda linjetyper som finns och deras mönster; att de egna ligger i
  stilmallen och följer med den (också vid byte till en förinställd); att
  mönstret skrivs med mellanslag och decimalkomma; att pennornas linjetyp
  inte gäller pilspetsar, trianglar och text; att hörn skarpare än 35°
  börjar om mönstret (med ett helt streck i varje hörn); att masken också
  döljer rutnätet på skärmen. Ska DXF-underlagens streckade linjer ritas
  streckade (inte gjort)? Behövs en förhandsvisning av linjetypen i
  listorna (nu bara namnet), eller räcker bilden i stilmallen?

- **0.8.29 efter provning** (Claudes val, se PLAN.md): bakgrunden slås på
  med en kryssruta och är vit från början; opaciteten är bakgrundens egen
  (skrafferingens opacitet påverkar den inte); i verktyget väljs bara
  färgen. En bakgrund döljer linjer och ändformer bakom, men inte en undre
  forms fyllning (den ritas i ritordningen som förut). Ska bakgrunden
  också kunna sättas i stilmallen?

- **0.8.28 efter provning**: Carl August har svarat (25 oktober) att
  bara den markerade linjen ska fortsättas, som nu; skrafferingens
  bakgrund och ändformerna blir 0.8.29. Kvar att fråga: ska *Fortsätt*
  kunna väljas bort i inställningarna för snabbknappar, och ska nya kanter
  få verktygets penna i stället för formens?

- **0.8.26 efter provning** (Claudes val, se PLAN.md): vilka nio pennor
  som finns och deras namn; att färgen också gäller markörens text och
  fyllda trianglar, men tjockleken bara linjerna; att pennorna ligger längst
  ned i stilmallen (inte i en egen dialog); att det inte går att ge ett
  enskilt objekt en egen penna. Saknas någon markör (skalstocken,
  stämplarna, rumsstämpelns text)? Ska streckning också kunna väljas?

- **0.8.25 efter provning** (Claudes val, se PLAN.md): att ritordningen
  bara gäller inom en sort på samma yta (en text går inte att lägga bakom
  en 2D-form; sorterna ligger i fasta lager), och att väggar, dörrar och
  fönster inte har någon; att Bak och Fram hoppar förbi det som inte
  överlappar; var knapparna finns (egenskaperna, Mer i smartmenyn,
  högerklick, `främst`/`fram`/`bak`/`längstbak`) och att det inte finns
  kortkommandon (Ctrl+] och Ctrl+[ som i Illustrator kräver AltGr på
  svenskt tangentbord). Bakom eller framför väggarna gäller bara planen;
  i fasader och sektioner ligger det ritade ovanpå som förut. Ska det
  gälla där också? Rummets fyllning ligger alltid bakom väggarna och
  2D-formerna, ställs in för ett rum i taget och går inte att klicka i;
  ska flera rum kunna fyllas på en gång, och ska fyllningen kunna sättas
  per rumstyp eller i stilmallen? Vid lika poäng vinner nu det som ritas
  överst när man klickar; säg till om något annat markeras än förut.

- **0.8.24 efter provning** (Claudes val, se PLAN.md): att en rektangel
  inte förblir rät när ett hörn dras (som en polylinje i AutoCAD), och att
  cirkeln saknar centrumgrepp (två punkter på cirkeln; flytta med Flytta);
  att Böj och Räta ut finns i Modifiera och inte som grepp mitt på kanten;
  att en böjd kant inte går att förskjuta, trimma eller dela; ändformernas
  utseende och förvalda storlek (2,5 mm), att de bara väljs i egenskaperna
  och smartmenyn (inte i verktyget) och bara på öppna linjer. Ska
  smartmenyn alltid visa *Ändar* för en markerad linje, eller tar det för
  mycket plats? Ska bågar kunna ritas direkt i Linje (som `A` i AutoCADs
  PLINE)?

- **0.8.22 efter provning** (Claudes val, se PLAN.md): opaciteten är *Samma
  för linje och fyllning* från början, och kryssrutan skiljer dem; den
  finns i egenskaperna och smartmenyn, inte i verktyget. Rumsstämpelns
  ordning är en mall i stilmallen (som litteramallarna) och gäller hela
  projektet, inte ett rum i taget; raden med `{namn}` är den stora och
  feta. *Fyllningar* under Visa gäller vyn, så en sparad vy med
  fyllningarna släckta visas utan dem också på bladen. Rumsstämpelns pil är
  kvar tunn (bara sektionspilen ändrades). Former ritade som enkellinje
  före 0.8.22 heter också *Linje*.

- **0.8.27 och 0.8.23 efter provning**: inget nytt att prova; allt ska
  bete sig som förut. I 0.8.27 ska fasaderna komma fortare, i 0.8.23
  pekandet i planen kännas lika snabbt med ett stort DXF-underlag som
  utan. Säg till om något beter sig annorlunda.

- **0.8.21 efter provning** (Claudes val, se PLAN.md): bokstäverna för
  alternativen (Å för Ångra, ML/MV i Justera) och att de går direkt till
  raden bara medan något ritas (S är då Stäng, inte snäpp); att *Avsluta*
  är samma som Enter; att taket visar Sadeltak/Pulpettak redan före första
  klicket; att högerklick i ritningen medan något pågår visar frågans
  alternativ (inte objektmenyn); att historiken bara låter klicka på
  kommandon, inte på punkter; 48 px som gräns för att docka och 720 px som
  största bredd för den fria raden. Ska *Avbryt* också stå bland
  alternativen? Ska Skala och måttbandet ta emot skrivna punkter?

- **0.8.20 efter provning** (Claudes val, se PLAN.md): namnet *smartshell*
  på raden (prompten heter SMARTSHELL sedan 0.8.21); att den ligger under ritytan och inte
  under panelerna; att bokstäverna (W, D, L …) är kvar som kortkommandon så
  att kommandon skrivs efter Enter, men siffror, `@`, `#` och `<` i vägg-,
  2D- och måttverktyget går direkt till raden (2, 3 och 4 byter inte vyläge
  där); att Enter i ett tomt fält kör senaste kommandot igen; att `CO` är
  Kopiera i rad; förkortningarna för det som inte finns i AutoCAD (`VG`,
  `WA`, `NP`, `HS` …). Ska man kunna skriva kommandon direkt utan Enter,
  som i AutoCAD (då försvinner kortkommandona med en bokstav)? Fungerar
  `@` med AltGr på hans tangentbord?

- **0.8.19 efter provning** (Claudes val, se PLAN.md): namnen *2D-form*,
  *Rita* och *Ritad som*; att sättet att rita inte går att byta efteråt;
  att fyllningen väljs redan i verktyget (förval ingen) och att en rak
  linje inte får någon; att en form utan linje och fyllning inte syns alls
  utom markerad eller med *Visa dolda 2D-element*; att fyllningar inte
  längre går att släcka för sig i Visa; mönstren utan namn i
  verktygsraden. Ska fyllningen kunna ligga över väggarna (ordning per
  form)? Projekt från 0.8.18 öppnas inte (format 11).

- **0.8.18 efter provning** (Claudes val, se PLAN.md): är rutnätet lagom
  tydligt (nivåerna tonas in mellan 4 och 16 px; finare linjer är svagare)?
  Ska segmentpunkterna gälla bara vyn de lades i (som nu), och ska Rensa
  rensa alla vyer (som nu)? Delningen gäller hela mätningen, alla klickade
  sträckor. osifont gäller all ritningstext utan val; vill han kunna välja
  typsnitt per projekt? Fet text är osifont med ett tunt streck. Tecknen ”
  och … saknas i osifont och skrivs som " och ... Autospar till fil är på
  från början och kräver att filen sparats eller öppnats efter att sidan
  laddats; ska appen komma ihåg filen mellan sidladdningar (kräver att
  Chrome frågar om lov)?

- **0.8.17 efter provning** (Claudes val, se PLAN.md): att man drar i
  stämpeln först när rummet är markerat; att stämpelns läge är en fast
  punkt i modellen (står kvar när väggarna flyttas, följer med när rummet
  flyttas); pilens utseende (tunn linje, öppen spets, till närmaste kant
  och 2 mm in); att stämpeln inte snäpper när den dras. Ska pilen hellre
  gå mot rummets mitt?

- **0.8.16 efter provning** (Claudes val, se PLAN.md): att X och Y är
  nedre vänstra hörnet också för DXF (inte filens nollpunkt, som kan vara
  bra för koordinatsatta DXF); att bredd och höjd i fälten sträcker en bild
  var för sig; Shift i ett hörn sträcker fritt; att linjen man kände på
  glöms vid byte av verktyg, och att sneda linjer i jämna 15° inte får eget
  *Parallellt* (vinkellåset tar dem); att skärningar nu snäpps överallt,
  också mellan väggliv. Hittade *Zooma till* inte DXF-underlag förut? (Det
  gjorde den inte; rättat.) Ska gruppen för en fil på flera ställen vara
  utfälld från början?

- **0.8.15 efter provning**: inget nytt att prova; Modifiera ska bete sig
  exakt som förut, bara snabbare med många markerade väggar. Säg till om
  något ändå beter sig annorlunda.

- **0.8.14 efter provning** (Claudes val, se PLAN.md): Justeras knappar och
  att ett klick på en vägg lägger objekten mot livet som vetter mot dem;
  vad pipetten tar med (allt utom form och läge, möblernas mått räknas som
  form, bara samma slag); att Skala inte gäller väggar, tak och rum och inte
  ändrar texthöjden; att Shift+X väljer Förläng alla med flera markerade
  men Shift+T behåller den gamla Trimma; bokstäverna Shift+N, H och Y.
  Smartmenyn för flera markerade har nu en fjärde grupp och bryts på fler
  rader. Ska tjocklekstabellen också finnas för linjer i stilmallen?

- **0.8.13 efter provning** (Claudes val, se PLAN.md): bokstäverna för
  kortkommandona (Shift+Q Ta bort punkt och Shift+K Flytta punkt är
  godtyckliga); att Trimma, Hörnskarv och Dela avslutas efter ett klick (i
  AutoCAD fortsätter Trimma tills Esc); att Dela finns fast Lägg till punkt
  också delar en vägg; att baspunkten gäller också Spegla och I rad. Ska
  Avrunda alla och Fasa alla också gälla 2D-polylinjer?

- **Bladen efter provning** (0.8.9, Claudes val): att bilder på bladet
  ligger under vyerna och linjer och text över; att mått inte går att rita
  på bladet; att en vy i en större markering bara går att flytta (inte
  vrida, spegla eller kopiera); att bladet inte följer tillstånden.
- **Textrutorna**: förankringen är punkten i rutans över-, mitt- eller
  underkant och justeringen rutans vänster-, mitt- eller högerkant; utan
  förankring står första radens baslinje på punkten som förut. Rutan ställs
  in i egenskaperna (0 = ingen gräns). Vill han kunna dra upp rutan med
  textverktyget, och se rutans kant när texten är markerad? Skärmen och PDF:en
  har samma typsnitt sedan 0.8.18 (osifont).
- **Fälten efter provning** (0.8.10, Claudes val): vad som är inbyggt och
  vilka fält som gäller hela projektet från början, `{skala a3}` (nämnaren
  gånger långsidan / 420), att fält utan värde blir tomma på papperet, att
  ett fält med *(olika)* inte går att tömma på flera blad samtidigt, och
  att rubrikerna i tabellen är namnet som det först skrivs, med stor
  bokstav.
- **Mallbladen efter provning** (0.8.8, Claudes val): att mallen ritas från
  papperets nedre vänstra hörn på blad i andra format (med ett tips), att
  ett valt mallblad föreslår sitt format, att loggan nu är ett underlag på
  mallbladet och att mallbladet inte följer tillstånden.
- **Hans ram** (gjord om i format 10, 21 oktober): platshållarna som blev smarttext är Claudes gissning
  (#PROJEKTNAMN, #DATUM, #RITNINGSNR, #RAD 3, #FÖRHANDSKOPIA,
  #FASTIGHETSBETECKNING, #PROJEKTNR, #REV, #ARKITEKTKONTOR, #INITIALER MV,
  #SIGN ANSVARIG, #SKALA A1). Övriga (#KOMMUN, #MAPPNAMN, #RAD 1, 2 och 4,
  #INITIALER HL, #SKALA A3) blev fält, `{mapp}` och `{skala a3}`. Skriptet
  kördes med `--utan 605,22,716,50 --behall HÖJD --behall SWEREF` (utan
  skalstocken) och projektet med fälten `kommun,projektbeskrivning,handläggare`.
- **0.8.12 efter provning** (Claudes val): skalstocken alltid 100 mm (ingen
  inställning för längd och indelning); andra skalor än hans tolv delas in
  som den med samma siffror (1:200 som 1:2000) eller efter jämna tal;
  skalan från bladets första vy när den läggs på; läget 230 mm från
  papperets högerkant och 40 mm upp på alla format (x 611 på A1); texthöjd
  3 mm, linjerna 0,7/0,35/0,18 och texten 0,25; skalstockar och stämplar
  går bara att flytta; en stämpel läggs nere till vänster innanför ramen
  (eller där man högerklickar) och ritas över vyerna; en stämpel i en
  stämpel blir en streckad ruta. I 1:50 är strecket vid 10 mm 4 mm långt
  och tunt, som i DXF:en (de andra skalorna har ett mellanstreck där);
  avsiktligt?
- **Vyns ram efter provning** (0.8.7, Claudes val): att ramen följer med
  när skalan byts. Vill han kunna dölja hela vyrubriken, inte bara skalan?
- **Synpunktsformuläret**: kommer breven fram till Gmail nu, efter `-f`?
  Annars: prova att sätta Gmail-adressen direkt som `to` i
  `feedback-config.php`. Kommer de fram då är det vidarebefordran från
  Loopia som stoppar dem.
- **Smartmenyn efter provning**: placeringen (höger, vänster, under, över
  det markerade), att den syns vid markering med ruta, och om rubriken
  *Ändra* i Modifiera-raden ska heta något annat.
- **0.8.11 efter provning** (Claudes val): kategorierna i Visa (Modell,
  Littera, Rum, mått och text, 2D, Markörer), littera per typ och underlag
  i Visa; att MTEXT fästs efter sin bredaste rad; namnen Skärm, Verklig och
  Tunna på *Linjer*; snett streck på avslagna knappar och accentfärg på
  påslagna (också verktygen och panelknapparna fick en tydligare ram); att
  en sluten 2D-form inuti ett rum går före rummet men en linje nära klicket
  går före båda. Synpunkten om polylinjer som bara markeras vid kanten gick
  inte att återskapa (slutna polylinjer gick att klicka inuti); nu räknas
  också en polylinje vars ändar möts som sluten. Hände det på ett annat
  sätt behövs ett exempel.

### Från 0.8.0

- **Typsnittet** är osifont på skärmen och i PDF:en sedan 0.8.18.
- Modellvyer på blad ritas med förslaget jämfört med befintligt. Sparade
  vyer ritas med sina egna inställningar.

## Öppna frågor och kända begränsningar

- **Synpunkter på webbhotellet:** formuläret skickar (sedan 0.8.2) och
  breven kommer fram till webbposten hos Loopia, men nådde inte Gmail.
  0.8.6 sätter kuvertavsändaren; se *Att fråga Carl August om*.
- **Följ sektionen** klipper 3D, men caps (snittytorna) saknas medan en stor
  sektion räknas i tråden.
- **2D på arbetsblad följer tillstånden** som 2D i planen (mallblad gör det
  inte, sedan 0.8.8). Fråga om arbetsblad ska vara oberoende av tillstånd.
- På ett mallblad finns Visa-menyns skala för texter och mått kvar, fast
  allt ritas i 1:1; den gör ingenting där.
- På ett blad och ett mallblad visar statusraden fortfarande skärmskalan
  (Rutnät är grått sedan 0.8.11). Underlagens formulär säger *Bredd i
  modellen* också på papper, och tipset om att kalibrera skalan kommer
  också där.
- Markeringen på ett blad markerar inte mallens grafik (bara bladets egen),
  som väntat; men det ritade på bladet och mallen ligger på samma papper,
  så det kan vara svårt att se vad som är vad.
- Konens bitar syns svagt i 3D-vyns skuggning (64 bitar per varv, plan
  skuggning).
- Två takfall som möts ritar samma linje två gånger i fasaden (nocken och
  takfoten bakom), utan att det syns.
- Takfotens snitt (0.10.2): där två snittade kanter möts i ett konvext
  hörn av samma takfall tar den första kantens snitt hörnet (ingen
  gering). En kon snittas bit för bit; en boolesk operation som inte går
  att räkna ger lodrätt snitt för den biten.
- Spegla vänder inte bilden i ett underlag, bara läget.
- DXF: skraffering med solid fyllning ritas som en ton (färgerna i DXF läses inte). Bilder och externa
  referenser efter pilotprojektet. Vektorsnäpp mot PDF avvaktar.
- **Att markera många väggar** (840) tar ca 0,15 s, nästan allt i
  webbläsarens ritning av markeringen (mätt i 0.8.15, lämnat).
- **En flyttad vägg** räknar fortfarande om sammanslagningen av alla
  väggytor på våningen, två gånger: med öppningar för ritningen (`union` i
  väggarnas `planBatch`) och utan för rummen och utsidan (`bareWallUnion`,
  en gång sedan 0.8.32 när vyn visar alla väggar); `polygon-clipping`
  står för det mesta, ca 0,06 s för 312 väggar. Ett nytt rumsnamn räknar
  om rum och dörrar (0,08 s).
- Under en zoom med hjulet syns ritningen skalad i 140 ms innan den ritas
  om; texter som var för små att ritas dyker upp först då.
- **Visas i** räknar vyer utan att bry sig om tillstånd.
- Modellvyerna har inga vy-taggar, så ett element med taggar syns inte där
  (inte heller på ett blad via modellvyn); *Visa dolda 2D-element* visar
  dem tonade.
- En borttagen taklutning är dold för gott i den fasaden; bara ångra tar
  tillbaka den automatiska.
- Spårlinjerna kan kännas för klistriga (`TRACK_REACH` i
  `src/ui/tools/snap.ts`).

## Arbeta i miljön

- Repot är `agrellarkitektur/cad-apa`. Bygga och testa: se CLAUDE.md.
  Commit avslutas med raderna som sessionen anger (Co-Authored-By och, om
  sessionen har en, Claude-Session), sedan `git fetch origin main` och
  `git push origin HEAD:main`. Pushen publicerar på webbhotellet; följ
  körningen med `gh run list` (loggarna går inte att läsa härifrån, men
  status syns). Releaser (zip) gör Carl August själv om han vill.
- En egen gren i den grunda klonen: `git push -u origin <gren>`, och
  sedan `git config --add remote.origin.fetch
  +refs/heads/<gren>:refs/remotes/origin/<gren>` och `git fetch origin
  <gren>`, så att grenen spåras.
- Titta på resultatet: `npm run build`, servera `dist/` med
  `python3 -m http.server 8765` och styr med Playwright (Python). Det är
  samma bygge som hamnar på webbhotellet. `window.bacchus` har `store`,
  `view`, `selection`, `ui`, `modifier`, `smartMenu`, `view3d`, `plan`, `sheets`,
  `plot`, `setTool`, `setMode` och `goTo` (t.ex.
  `goTo({kind:'marker', id:'sektion-a'})`, `goTo({kind:'sheet', id})`).
  `bacchus.sheets.pick({kind:'viewport', id})` markerar en vy på bladet
  (`selection`), `pick({kind:'sheet', id})` visar bladet i panelen;
  `bacchus.sheets.drawing()` har `views` med ytorna på papperet och
  `pickables`; `pickedViewport()`, `place(bladId, vy, skala)`,
  `newSheet()`, `newMaster()` och `resetCrop(id)` finns också. Det ritade
  på bladet är vanliga element med `space` = bladets id. Ett mallblad öppnas med `goTo({kind:'worksheet', id:'mall-a3'})`. Ramens
  grepp dras med musen på den valda vyns kanter (`views[i].frame`). Filer läggs in med `page.expect_file_chooser()` runt ett
  klick på *Lägg in underlag…*; ett projekt öppnas med
  `[data-action="open-file"]:visible` och `showOpenFilePicker = undefined`. Ritningen ligger i
  `.plan-drawing .content` (0.8.3), markeringen i `svg.plan .highlight`.
  `bacchus.view.redraw()` ritar om ritningen. Egenskapspanelen är
  `aside.panel[aria-label="Egenskaper"]` (projektträdet har också en
  `.panel-body`).
- Plot/export i Playwright: sätt `window.showSaveFilePicker = undefined` med
  `add_init_script`, så sparas zipfilen som en nedladdning
  (`page.expect_download()`). Kontrollera PDF:erna med `qpdf --check` och
  `pdftoppm -png`; `pdffonts` ska visa Osifont inbäddad (0.8.18). Ett
  blad blir snabbast PDF i ett tillfälligt vitest-test med `buildSheet` och
  `writePdf(..., { deflate: browserDeflate() })`.
- osifont görs om med `scripts/osifont.py` (kräver fonttools och brotli).
- **Jämföra Modifiera före och efter** (0.8.15): servera det gamla och det
  nya bygget på var sin port, ladda samma projekt i båda med
  `store.load`, och kör förlopp som `selection.set`, klick på ett
  modellläge (`view.camera.toScreen` plus `svg.plan`:s läge),
  `modifier.choose(op)`, `hover`, klick och `modifier.applyValue(v)`; spara
  efter varje steg hashar av `store.doc`, markeringen, `svg.plan .overlay`,
  `.highlight`, `.plan-drawing .content`, panelen och smartmenyns text.
  Kärnan jämförs snabbast utan webbläsare: samma skript buntat mot båda
  arbetskopiorna, med fasta id.
- **Klickjämförelsen från 0.8.27** ligger i `scripts/jamfor-klick.py`
  (223 steg sedan 0.9.3: stilmallen med linjetyper, pennor och
  fyllningstyper, snabbraden, den egna pennan, rummets fyllning,
  2D-formens fält med mask, bakgrund och fyllningstyp, ritordning, Visas
  i, underlag, detaljnivåerna, Filtrera och markera, våningar, bjälklag,
  kalkering, fasader, sektion och nivåer). Kommandon skrivs i smartshell
  (`#ss-input`, Enter), och en meny (som *Kopiera till våning*) väljs i
  `.ctx-menu`. Kör den mot två byggen på var sin port och sedan med
  `--jamfor`; lägg till steg för det som granskas. Med `--bilder` sparas
  en bild av ritytan efter varje steg, och när markupen skiljer sig
  jämförs bilderna (så gjordes 0.8.38, där skrafferingen ritas med ny
  kod). Inget steg felar sedan 0.9.3; kör den gamla versionen två gånger
  mot sig själv om något skiljer, så syns det som inte är bestämt. En
  rad om att en bild är inlagd kan skilja i steget efter att Visa
  öppnats (meddelandet tonas ut olika fort).
  Verktygets klassnamn minifieras olika i två byggen; jämförelsen kräver
  bara att namnen motsvarar varandra. Vänta på
  `!bacchus.sections.pending` och tryck *Zooma till allt* innan en fasad
  jämförs (annars beror kameran på hur fort den räknats), och räkna inte
  `blob:`-adresser. En klick i modellen måste hamna inne i objektet, inte
  på takets streckade kontur.
- **Jämföra före och efter** (så gjordes granskningen): bygg den gamla
  versionen i en egen arbetskopia (`git worktree add <mapp> <commit>`, länka
  in `node_modules`, `npx vite build --outDir <mapp>`), kör samma klick i
  båda byggena och jämför läget efter varje steg. Byt
  `crypto.getRandomValues` mot en fast följd i `add_init_script`, så att nya
  id blir desamma. Skript utan webbläsare buntas snabbast med
  `npx rolldown skript.mts --dir ut --format esm --platform node` (med
  `--file` vägrar den när koden delas i flera delar) och körs med `node
  ut/skript.js` (tsx lägger till `__name` som syns i profiler). Skriptet kan
  importera `tests/projekt.ts` (`roomGrid`, `shapesProject` …).
- **Testerna** (0.8.32): de vanliga delar process (`isolate: false`), så
  ett test får inte lämna något ändrat för de andra; prova en ny fil med
  `npx vitest run --sequence.shuffle --sequence.seed=1` (och 2, 3).
  `npx tsc --noEmit` kontrollerar också `tests/`. Hjälpfunktionerna och
  testprojekten ligger i `tests/projekt.ts`; spara-och-läs prövas en gång,
  i `core.test.ts`. Ett hus med två våningar och fasta id är
  `twoStoreys` (0.9.3). Se *Tester* i UTVECKLING.md.
- Demon bara på begäran: `npm run preview:artifact`, läs artefakten
  (https://claude.ai/artifact/2m7gq5gkkgSP2wFZ7fLGNJ, Artifact `read`) och
  publicera `artifact/cad-apa.html` till samma URL.
- Stoppa servern med `ps -eo pid,args | grep "[p]ython3 -m http.server"`
  och `kill <pid>`, inte `pkill -f` eller `pgrep -f` i samma kommando (de
  träffar också skalet, som stängs).
- Testfiler att lägga in går snabbt att göra med reportlab (PDF), PIL
  (bild) och några rader text (DXF). Riktiga DXF med skraffering, block och
  bågar gör ezdxf (`pip install --break-system-packages ezdxf`), som också
  ger facit för konturerna (`ezdxf.path.from_hatch_boundary_path`) och
  mönstrens streck (`ezdxf.render.hatching.hatch_entity(h,
  jiggle_origin=False)`; utan det flyttas mönstret slumpvis några mm).
- Mäta hur fort Chrome målar en SVG (0.8.38): lägg markupen i en tom
  sida med `set_content`, sätt `innerHTML` och vänta två
  `requestAnimationFrame`; jämför varianter (utan fyllning, ett mönster,
  …). Bilderna jämförs med PIL (`ImageChops.difference`, pixlar som
  skiljer mer än 64).
- Mäta i webbläsaren: hela bildrutan, från `page.mouse.move` till två
  `requestAnimationFrame`, jämfört med ett tomt varv; att bara mäta
  JavaScript missar webbläsarens målning, som var det dyra vid panorering.
- En profil (`node --cpu-prof`) sammanfattas snabbast med några rader
  Python som summerar `timeDeltas` per `callFrame` i `.cpuprofile`, och
  inklusive tid genom att gå upp till föräldrarna (så mättes 0.10.1).
  Polygon-clippings egna funktioner heter `split`, `compare` och `run`.
- Fasader, sektioner och blad utan webbläsare: ett skript med
  `registerBuiltInTypes()` från `src/elements` först, sedan `buildSection`
  eller `buildSheet` och `writePdf`. Stora projekt att mäta på: `wallGrid`
  och `roomGrid` i `tests/prestanda.test.ts`. Profilera med
  `node --cpu-prof skript.mjs`.
- Playwright: verktygsraden (`.tool-options`) ligger över nedre delen av
  ritytan; klicka högre upp. 2D-verktyget behöver en `mouse.move` före
  klicket. Verktyget som är aktivt är `bacchus.view.currentTool` (t.ex.
  dess `points` och `current`).
- Jämföra före och efter en uppdelning: bygg båda, kör samma klick och
  spara `store.doc`, markeringen, `.plan-drawing .content`, panelens text
  och smartmenyn som hashar per steg (så gjordes 0.8.1 och 0.8.11).
- Playwright: dra med flera `mouse.move` i steg (två steg räcker inte för
  att vyn ska räkna det som en dragning). Modifiera Flytta utgår från
  punkten där man klickade på det markerade, så ett klick efter valet är
  målet. Filvalet för underlag öppnas pålitligast med ett riktigt klick på
  menyn (inte `element.click()` i JavaScript).
- Underlag i Playwright (0.8.16): en fil läggs snabbast in genom att
  skicka `dragover` och `drop` med en `DataTransfer` till `.pane-2d`; det
  nya underlaget är markerat. Snäppningen i ett ritverktyg syns i
  `bacchus.view.currentTool.current` (`kind`, `label`, `point`). Exempelprojektet
  har huset kring origo, så flytta underlaget bort (X i egenskaperna) innan
  snäpp prövas.
- Playwright och Modifiera (0.8.14): smartmenyn ligger ofta över det man
  vill klicka på i ritningen; dölj den med en stilregel
  (`.smart-menu{display:none!important}`) eller klicka utanför den.
  `bacchus.modifier` har `choose(op)`, `chooseRail(id)`, `applyValue(v)`,
  `setValue(v)`, `active` och `detailMarkup()`; Shift + bokstav fungerar
  efter en `mouse.move` över ritytan.
