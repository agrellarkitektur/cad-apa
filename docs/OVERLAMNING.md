# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning och hålls kort: historiken finns i git, Claudes val och det
som inte gjordes i PLAN.md, koden i UTVECKLING.md, och där också **Arbeta
i sandlådan** (bygga, Playwright, klickjämförelsen, mätningar) och
**Kända begränsningar**. Senast: 30 oktober 2026, efter 0.10.34.

## Läget

- **0.10.34 Radkontrollerna är klar** (samma format, 25; favoritseten
  `colorSets` i stilboken är valfria). Runda knappar för tjocklek,
  linjetyp och färg, tjockleksraden med *Eget*, den sökbara
  linjetypslistan med *Lägg till egen…*, färgpanelen (förval, favoriter i
  set, färgfält, hex, opacitet där det finns), textvalsknappar,
  ikonknappar för återställ och ta bort, Innehåll som knappar med symbol,
  sök och *Vanliga/Alla*. Bara i stilboken. Testerna: 747 på ca 17 s.
  Provat i Playwright mot `dist/`. Koden i UTVECKLING.md, Claudes val i
  PLAN.md.
- **0.10.33 Avvikelser och kategorier i vyn är klar** (samma format, 25;
  `ortho3d` på markobjekten är valfritt). Ockra prick och *Återställ* på
  ändrade rader (en kategori mot förvalet, en vy mot kategorin), *Visa
  bara avvikelser*, *Stil för den här vyn…* (högerklick i vyn, och *Stil
  för vyn…* i projektträdet) med *Återställ till kategorin*, *Gör
  avvikelserna till kategorins förval* och *Spara som ny kategori…*,
  listan *Vyer med den här kategorin*, punkt efter vynamnet, *Ny vy* med
  vytypens kategorier, nya kategorier (Mått och littera, Undertak,
  Golvplan, Poché, Färgmarkerad) och *Ortofoto* bland markobjektens
  material. Testerna: 744 på ca 13 s. Provat i Playwright mot `dist/`.
  Koden i UTVECKLING.md, Claudes val i PLAN.md.
- **Frågesessionen 30 oktober (natt):** tio frågor besvarade; de två
  tilläggen (Poché och Färgmarkerad som kategorier, *Ortofoto* bland
  materialen) gjordes i 0.10.33. Färgmarkerad är statusen i färg (kvar
  grått, nytt rött, rivs gult streckat); förklarat i README.
- **0.10.32 Tre nivåer med arv** (**nytt format, 25**): `ProjectDoc.graphics`
  är en `StyleBook`; vyn har `category` och `overrides`. Se PLAN.md och
  UTVECKLING.md. Utredningens beslut i `cad-apa-synpunkter.md` (*Beslut
  29–30 oktober*), mockupen i Claude Design "Stilinställningar – mockup"
  (tavla 5 gäller).
- **0.10.31 Texturer i 3D och ortofotot på marken**: **Höjdkurvors del
  återstår** (två rader, se PLAN.md); den görs i en Höjdkurvor-session.
- **0.10.30**, **0.10.29**, **0.10.28.3**, **0.10.28.2**, **0.10.28.1**,
  **0.10.28**, **0.10.27**, **0.10.26**, **0.10.25.1** och **0.10.25**: se
  PLAN.md.
- **Publicerad:** 0.10.34 pushad till `main` 30 oktober (se git och
  `gh run list`). `add_repo` med push går direkt när Carl August skriver
  "push godkänd" i första meddelandet.
- **Märks i hans ritningar efter 0.10.34:** inget i ritningarna; bara
  stilbokens utseende. Under *Vanliga* (förvalet) döljs *Snittet i
  planen* och några sällan ändrade kryss under Innehåll; *Alla* visar dem.
- **Märks i hans ritningar efter 0.10.33:** inget i befintliga projekt
  (de behåller sina kategorier; de nya finns i nya projekt). Vyer som
  avviker från sin kategori får en ockra punkt i projektträdet. *Ny vy* på
  en våning, fasad eller sektion är en grupp i menyn: *Med det som visas
  nu…* och kategorierna.
- **Märks i hans ritningar efter 0.10.32:** projekt från 0.10.31 öppnas
  inte (nytt format), och det autosparade i webbläsaren inte heller. En
  fasad, sektion eller Platsen utan sparad vy får vytypens kategori under
  Visa (förut följde Visa med från planen). *Stilmall i vyn* heter
  *Vykategori*.
- **Märks i hans ritningar efter 0.10.31:** inget i befintliga projekt
  (inget ortofoto och inga texturer förrän man lägger in dem).
- **Märks i hans ritningar efter 0.10.30:** inget i befintliga projekt.
  Högerklick utanför programmets menyer ger inte längre webbläsarens meny.
- **Märks i hans ritningar efter 0.10.29:** inget i befintliga projekt.
  Shift låser inte längre till 45° utan till vinkeln man står i, och
  Förskjut har inget värdefält i smartmenyn (siffrorna skrivs direkt).
- **Märks i hans ritningar efter 0.10.28.3:** stödmurars krön och fot kan
  ligga några cm annorlunda (de läser marken exakt vid kanten nu), och
  marken i 3D möter en stödmur i en rak linje.
- **Märks i hans ritningar efter 0.10.28.2:** inget i befintliga projekt
  (bjälklag och tak har inget material förrän man väljer ett). Nya
  projekt har Takpannor och Plåt, och Betong och Tegel har mönster i
  snittet.
- **Märks i hans ritningar efter 0.10.28.1:** projekt från 0.10.28
  öppnas inte (nytt format). Stödmurarna på Platsen ritas ovanifrån (inte
  längre svarta utan material).
- **Märks i hans ritningar efter 0.10.28:** fältet *Fyllning* heter
  *Material* på markobjekten, och en ändring där ändrar materialet för
  alla objekt med det.
- **Märks i hans ritningar efter 0.10.25:** markobjekten syns inte längre
  på Plan 1 utan på Platsen, och dialogen Platsen nås från Platsen i
  projektträdet.
- **Tidigare:** 0.10.34, 0.10.33, frågesessionen 30 oktober, 0.10.32, utredningen om stilinställningar, 0.10.31, 0.10.30, 0.10.29, 0.10.28.3, 0.10.28.2, 0.10.28.1, planeringssessionen, 0.10.28, 0.10.27,
  0.10.26, 0.10.25.1, 0.10.25, 0.10.24, materialutredningen, 0.10.23,
  0.10.22 och 0.10.22.1, 0.10.20.1, 0.10.20.2, 0.10.21 och 0.10.21.1. Se
  PLAN.md.
- **Versionsnumret** är `0.10.34` i `engine.ts`, `package.json` och
  `package-lock.json`. En granskning höjer inte numret, eller får en
  fjärde siffra om något ändras som syns.
- **0.10.8–0.10.34 är inte provade fullt ut** av Carl August; han har
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
  publiceras. Skrivrätten till repot kan behöva godkännas i sessionen
  (nekades först 28 och 29 oktober).
- **Färdplan** (Carl August 22 oktober): 0.13 är hans egen provning (han
  ritar ett hus), sedan en inbjuden **alfa** för arkitektvänner, sedan en
  **öppen beta**. **Formatfrysen kommer med den öppna betan.** Inget av
  stegen är 1.0. Håll färdplanen nedan aktuell vid varje överlämning.
- **Ord:** *palett* och *snabbmeny* betyder samma sak för honom. Säg bara
  **smartmeny**. Symboler i ritningen heter **-markör**: *nivåmarkör*,
  *sektionsmarkör*, *fasadmarkör*. Säg inte nivåkota, sektionslinje eller
  fasadlinje. Vyn heter *Sektion* och *Fasad*. **Littera** skrivs med två
  siffror som förval (T01, M01). Spöet heter **smartspöt**. Fliken för
  situationsplanen heter **Platsen**; inga engelska ord i appen.
  Stilinställningarnas helhet heter **stilboken**; en rad i en vykategori
  där en objekttyp och del får sin penna heter ett **ställe**.
- **Versionsnamn:** inga b-versioner; nästa lediga nummer i stället.
- **Bakåtkompatibilitet:** inga migreringar före formatfrysen. Höj
  `FORMAT_VERSION` när formatet ändras; äldre filer får ett meddelande
  (`parse` i `src/storage/format.ts`). Valfria nya parametrar har inte
  krävt ett nytt format.
- **Telefonen är inget mål.** Testa på dator (Chrome).
- **Arbetssätt:** Carl August testar varje version på webbhotellet. Ingen
  demo och ingen zip om han inte ber om det. Säg alltid hur stora
  föreslagna ändringar är och om de riskerar att behöva mer än en
  session.
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

- ~~0.8.8 Mallblad~~ … ~~0.10.22 Snäpp och smartspöt~~, ~~Granskning
  efter 0.10.22 (0.10.22.1)~~, ~~0.10.23 Smartspöt del 2~~, ~~0.10.24
  Bågar i bjälklagets och markytans kontur~~, ~~Utredning: material i
  stället för fyllningar~~, ~~0.10.25 Platsen som modellflik~~,
  ~~Granskning efter 0.10.25 (0.10.25.1)~~, ~~0.10.26 Rampen och
  stödmuren~~, ~~0.10.27 Styrningen i 3D~~, ~~0.10.28 Material, mark
  först~~, ~~0.10.28.1 Materiallistan~~, ~~0.10.28.2 Material på
  bjälklag och tak~~, ~~Granskning efter 0.10.28.2 (0.10.28.3)~~,
  ~~0.10.29 Ritandet~~, ~~0.10.30 Teckenförklaring~~, ~~0.10.31 Texturer
  i 3D och ortofotot på marken~~, ~~Utredning: stilinställningar~~,
  ~~0.10.32 Tre nivåer med arv~~, ~~0.10.33 Avvikelser och kategorier i
  vyn~~, ~~0.10.34 Radkontrollerna~~ (klara)
- **Höjdkurvor: ortofotot med i platspaketet** (liten; i Höjdkurvors repo
  och session)
- **Stilinställningarna, 0.10.35–0.10.38** (F kan skjutas in var som
  helst): **0.10.35 Underlag i vyn** (stor, på tur; risk för två
  sessioner), **0.10.36 Pennor och ställen** (mellanstor), **0.10.37
  Projektet › Allmänt** (mellanstor), **0.10.38 Stilboken ut och in**
  (mellanstor; två öppna frågor)
- **0.11 Trappor** (nytt format; med *Syns också på*)
- **0.11.1 Profilverktyget** (stor) och **0.11.2 Dörrar och fönster**
  (stor)
- **0.12 Export**: IFC4, DXF, areor för bygglov, förteckning över
  markförändringarna
- **0.12.1 3D-vyer** (sparade perspektiv och axonometrier, trädmodeller,
  trädens status i planen)
- **Koordinater, SWEREF och sol** (stor; före piloten; SWEREF på
  situationsplanen och i exporten därifrån)
- **0.13 Pilotprojektet**: Carl August ritar själv ett hus
- **Inbjuden alfa**, sedan **öppen beta och formatfrys**
- Efter piloten: se *Efter pilotprojektet* i PLAN.md. **1.0**
  bygglovshandling.

## Nästa session

**0.10.35 Underlag i vyn** (stor, samma format; valfritt fält på vyn;
risk för två sessioner, dela då upp den). Läs synpunkterna först (D under
Planerat, *Beslut 29–30 oktober*, *Underlag i vyn*) och sortera Inkorgen
om den har något. Underlag som del av vyn: en våning, Platsen, ortofotot
i 2D, ett arbetsblad, en annan vy, DXF/bild; under/över, tonad/gråskala/
konturer, procent, *Lägg till underlag…*; följer med till bladet. Dagens
Kalkera blir en genväg som lägger ett underlag. Här också om marken syns
i 2D och 3D per kategori. Provet: illustrationsplanen på flygfoto. Raderna
i stilboken använder radkontrollerna från 0.10.34 (`rowControls.ts`: en
lista blir en textknapp av sig själv). Ställ frågorna om 0.10.34 och
0.10.33 först, när han provat.

Höjdkurvors del av ortofotot (två rader i `js/app.js` och `js/utbyte.js`,
plus raden i `docs/UTBYTE-CAD-APA.md` där) görs i en session i
Höjdkurvors repo; fälten står i PLAN.md under 0.10.31.

## Att fråga Carl August om

Fem åt gången, högst tio per session, de som hör till nästa version först.
Hoppar han över en räknas den som bra och stryks. Claudes val står i varje
fråga. Frågorna om 0.10.28.2 och 0.10.28.1 när han provat materialen; de
om 0.10.27–0.10.23 likaså. Nästa omgång börjar med 0.10.34 och 0.10.33.

**Besvarade 30 oktober** (Claudes val gäller): 0.10.32 alla fyra
(vytypens kategori när ingen vy är sparad; kategoribyte släpper vyns
ändringar; pennorna per kategori tills 0.10.36; Poché och Färgmarkerad
som kategorier, gjort i 0.10.33). 0.10.31: ortofotot där marken saknar
material, plus valet *Ortofoto* (gjort i 0.10.33); bildens sida i mm.
0.10.30: rutornas mått lagom så länge; en rad "Eget" per fyllning (prova).

**0.10.34 efter provning** (Claudes val, se PLAN.md)
- *Vanliga* är förvalet och döljer *Snittet i planen* och sällan ändrade
  kryss under Innehåll (det ändrade syns alltid). Rätt urval, eller ska
  *Alla* vara förvalet?
- Favoriterna: plus sparar i det valda setet, högerklick tar bort en.
  Räcker det, eller behövs en tydligare knapp för att ta bort?
- Pennorna har ingen opacitet (bara åtgärdernas fyllning och bakgrund).
  Behövs det?
- Visa-menyn har kvar sina kryssrutor. Ska den också få knappar med
  symbol, som Innehåll?

**0.10.33 efter provning** (Claudes val, se PLAN.md)
- *Återställ* på en ändrad rad syns när musen är över raden (pricken
  syns alltid). Hellre alltid synlig?
- En kategori får prickar mot sitt förval (t.ex. Skiss mot Plan), inte
  bara en vy mot sin kategori. Hjälper det, eller stör det?
- Undertak och Golvplan i 1:50 utan möbler, öppningssätt och littera
  (undertaket också utan mått); Mått och littera utan möbler. Rätt
  innehåll? Undertaket ritas inte spegelvänt än.
- *Ny vy → en kategori* tar kategorin som den är, inte det som visas nu
  (det gör *Med det som visas nu…*). Rätt?

**Till 0.10.38 när den är på tur**
- Ska *Mall för nya projekt* ligga i webbläsaren (försvinner vid rensning)
  eller som en fil man pekar på vid *Nytt projekt*?
- Ska bladmallar och stämplar följa med stilbokens export/import redan i
  0.10.38 (parkerat sedan 20 oktober)?

**0.10.31 efter provning** (Claudes val, se PLAN.md)
- Ortofotot och texturerna skuggas som kulörerna; Carl August vill att
  allt skuggas men har inte sett det än. Ser det rätt ut?

**0.10.30 efter provning** (Claudes val, se PLAN.md)
- Rader läggs till och tas bort per material (*När det syns*, *Alltid*,
  *Aldrig*). Behövs fria rader med egen text och eget mönster? (Oklart
  för honom innan han testat; fråga efter provning.)

**0.10.29 efter provning** (Claudes val, se PLAN.md)
- Shift fritt avrundar vinkeln till hela grader; står man i ett vinkellås
  eller på en punkt gäller exakt den riktningen. Rätt, eller ska fritt
  också vara exakt (t.ex. 37,28°)?
- Parallell kopia och Förskjut alla kanter skrivs också vid objektet, som
  Förskjut. Rätt?
- Platsens rad i våningslistan har kvar *markmodell* / *plan mark* under
  namnet. Ska den också få tankstreck och en höjd (t.ex. ±0 i RH 2000)?

**0.10.28.3 efter provning** (Claudes val, se PLAN.md)
- Markytans höjd föreslås nu också ur den färdiga marken (inte bara
  rampens). Rätt?
- Markobjekten på Platsen hänger på ±0 och flyttar inte när en
  våningshöjd ändras (testat); platån runt huset följer golvet. Såg du
  något annat flytta? Då behövs en skärmbild.

**0.10.28.2 efter provning** (Claudes val, se PLAN.md)
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

**0.10.28.1 efter provning** (Claudes val, se PLAN.md)
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

**0.10.27 efter provning** (Claudes val, se PLAN.md)
- Mellanslag + dra panorerar och Mellanslag + Shift + dra snurrar (du sa
  "kör" utan att svara på frågan). Bra, eller hellre något annat?
- Rutan tar det vars omslutande rektangel på skärmen ryms i eller nuddar
  rutan, som i planen. Snett sett kan en vägg tas från höger till vänster
  fast rutan bara går nära den. Störande?
- Ett drag som börjar på det markerade flyttar det, som förut. Ska ett
  drag alltid vara en ruta (flytt bara med Flytta och greppen)?

**0.10.26 efter provning** (Claudes val, se PLAN.md)
- Ser rampens kant med stödmur rätt ut nu? Lodytan har markens kulör;
  ska den se ut som en mur (eller ska sidan bli en riktig stödmur med
  krön, frågan om 0.10.18)?
- Höjdkurvorna i planen räknas som förut på rutnätet och kan ligga en
  ruta fel vid en stödmurskant (i 3D tas de bort där). Störande?
- Stödmuren har kantlinjer i hörn som viker mer än 20°. Lagom gräns?

**0.10.25 efter provning** (Claudes val, se PLAN.md)
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

**0.10.24 efter provning** (Claudes val, se PLAN.md)
- Äldre bjälklag och markytor behåller sina korta raka bitar. Behövs en
  knapp som gör om en sådan kontur till bågar (som *Ur väggarna* urbockat
  gör), eller räcker det att rita om med spöet?
- Markytans polygon sluts när man byter verktyg (som linjerna avslutas).
  Rätt, eller ska den kastas som bjälklagets?

**0.10.23 efter provning** (Claudes val, se PLAN.md)
- Takfallet med spöet täcker hela husets kontur, med takfoten vid kanten
  närmast och taket stigande inåt (ett pulpettak över huset). Rätt, eller
  ska spöet i *Takfall* ge ett takfall per sida?
- Pulpet, Sadel och Valm läggs över den omslutande rektangeln också när
  huset inte är rektangulärt. Räcker det?
- Måttkedjan tar båda liven på varje anslutande vägg, också i hörnen
  (väggtjockleken). Rätt, eller bara innerväggarna?
- Littera med Shift: var sin littera på varje objekt. Hellre en littera
  med en ledare till varje?

**0.10.20 efter provning** (Claudes val, se PLAN.md)
- Markhöjden räknar marken som oförändrad när ny och befintlig skiljer
  mindre än 5 cm (då bara den befintliga, understruken). Lagom gräns?
- Markobjektens höjder skrivs nu med två decimaler (nivåmarkörerna har
  kvar tre). Ska nivåmarkörerna också följa inställningen?
- Konturen runt slänterna är alltid på (0,13). Ska den vara ett val, eller
  få en egen penna i stilmallen?
- De branta slänterna är grå (muted) och följer fallinjen; strecken bryts
  där markobjekten ändrat marken. Rätt färg och gräns (1:3)?

**0.10.19 efter provning** (Claudes val, se PLAN.md)
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

**0.10.18.1 efter provning** (Claudes val, se PLAN.md)
- Höjdkurvornas färg gäller planen och bladen; 3D-vyns kurvor har sin
  egen. Ska de följa stilmallen också?

**0.10.18 efter provning** (Claudes val, se PLAN.md)
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

**0.10.17 efter provning** (Claudes val, se PLAN.md)
- Ett klick på änden av en omarkerad linje ritar vidare på den. Störande
  när man vill börja en ny linje där (Ctrl+klick)?
- Ett klick mitt på en kant startar det senast använda valet på en kant.
  Var det så du menade, eller ville du bli av med något sådant?
- Bågar direkt i takets kontur och håltagningen (*Båge*, G). Ska 2D-
  verktygets linje få samma (fråga 59)?
- Vrid och spegla hålet kring punkten man klickade på. Hellre kring hålets
  mitt?

**0.10.16 efter provning** (Claudes val, se PLAN.md)
- Ett fönster helt över eller under snittet ritas som hålets två kanter
  och glaset. Räcker det, eller ska karmen synas?
- En möbel som går genom snittet (t.ex. ett högskåp) ritas som förut, som
  symbol. Ska den ritas snittad?
- Den egna pennans del *Över snittet* följer objektets penna när den är
  tom. Rätt, eller ska den följa stilmallen?
- Dubbelklick på Visa tänder inte det som är släckt från början (husets
  kontur genom taket, linjerna i 3D). Rätt?

**0.10.15 efter provning** (Claudes val, se PLAN.md)
- Det dolda räknas med i väggarnas skarvar och rummen. Rätt, eller ska en
  dold vägg också försvinna ur rummens konturer?
- De dolda objekten tas fram alla på en gång. Behövs en lista att ta fram
  dem ett och ett?
- Greppet för *Tonat från* ligger en bit från mitten (romb), djupets i
  mitten (fyrkant). Lätt att hitta?
- Ska högerklick i 3D-vyn dölja bara i 3D, eller gälla vyn som nu?

**0.10.14 efter provning** (Claudes val, se PLAN.md)
- Slänternas fyllning täcker ytan som släntstrecken går över. Rätt yta,
  också där två markobjekt möts?
- Mönstret utgår från objektets första hörn. Behövs ett grepp för att
  flytta utgångspunkten?

**0.10.12 efter provning** (Claudes val, se PLAN.md)
- Riv och *Finns i* fungerar på låsta objekt (de ändrar status, inte
  läget). Ska låset hindra dem också?
- Markörens penna i delen *Markör* är stilmallens och gäller alla
  sektions- (eller fasad-)markörer. Behövs en egen penna per markör?
- Bjälklag bakom snittet är på från början i sektionerna (släckta i
  fasaderna). Rätt?
- En våning som tas bort tar med sig sina låsta objekt (efter frågan).
  Rätt?

**Följdfrågor från 27 oktober**
- Trädens status (till 0.12.1): ska texten "Träd skyddas under
  byggtiden" stå i en förteckning, eller skriver man den själv?

**0.10.11 efter provning** (Claudes val, se PLAN.md)
- Våningens meny: Visa, Inställningar, Byt namn, Ny våning ovanför och
  under (den högerklickade våningen), Ta bort. Saknas något? Ska
  arbetsbladen få en meny också?
- Visa-menyn: inställningarna till vänster, kategorierna i två kolumner
  till höger. Bra ordning, eller detaljnivåerna överst över hela bredden?
- Hovring i 3D tonar objektet ljust i markeringsfärgen. Lagom tydligt?
- Markobjekten markeras med ett klick i marken, och konturen ritas på
  marken. Ska hörnen också gå att dra i 3D?

**0.10.8 efter provning** (Claudes val, se PLAN.md)
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
64. Typsnitt per projekt?
65. Autosparen kommer ihåg filen mellan sidladdningar (Chrome frågar)?
66. Rumsstämpelns pil mot närmaste kant eller rummets mitt?
67. X och Y nedre vänstra hörnet också för DXF, inte filens nollpunkt.
68. Gruppen för en fil på flera ställen utfälld från början?
69. Tjocklekstabell för linjer i stilmallen?
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
