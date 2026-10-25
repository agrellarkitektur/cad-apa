# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 25 oktober 2026, efter 0.8.35.

## Läget

- **Påminn Carl August** (hans önskan 25 oktober): resten av 0.8 är
  0.8.36–0.8.38, med granskningen sist (0.8.38) innan 0.9. Lägg inte
  till funktioner som blir fler 0.8.xx; nya synpunkter ska rymmas i de
  versioner som redan finns i planen, annars läggs de i en senare
  version. Säg det när han tar upp något nytt.
- **0.8.35 Filtrera och markera är klar** på `main` (samma format, 13).
  Dialogen *Filtrera och markera…* (huvudmenyn, högerklick, `FM`):
  sort, typ, finns i, åtgärd, egen penna, egen egenskap, alla våningar;
  ersätt, lägg till, dra ifrån. Claudes val i PLAN.md, koden i
  UTVECKLING.md. Testerna: 409 på ca 10 s.
- **0.8.34 Rum: kontur och rumsgränser är klar** på `main` (samma
  format, 13). Pennan *Rummens kontur* i stilmallen (förval *Ingen
  linje*), egen penna per rum och rumstyp (`Space` i `OWN_PEN_TYPES`),
  konturen under väggarna. Kryssrutan *Avgränsar rum* på 2D-former i
  modellen: linjen blir en 1 mm vägg när rummen räknas ut, också med
  pennan 0 och 2D släckt. Claudes val i PLAN.md, koden i UTVECKLING.md.
  Testerna: 405 på ca 10 s.
- **0.8.33 Pennor per typ och symbollinjer är klar** på `main` (samma
  format, 13). Dörrarnas och fönstrens delar i tre klasser i stilmallen
  (snitt 0,25, vy 0,18, symbol 0,13 mm), den egna pennan i två delar
  (*Snitt* och *Symbol*) för dörrar och fönster, och typens penna under
  *Påverkar fler objekt*. Dörrbladen och fönstrens glas ritas tunnare än
  förut (referensritningarna har nytt facit). Claudes val står i
  PLAN.md, koden i UTVECKLING.md. Testerna: 402 på ca 6 s.
- **0.8.32 Granskning är klar** på `main` (samma format, 13, utan nya
  funktioner). Testerna: 406 → 399 (dubbletter och prov av enskilda fält
  sammanslagna, tester som låste detaljer lösare), hela körningen 26 → 12 s
  (`isolate: false`), testerna typkontrolleras, hjälpfunktionerna i
  `tests/projekt.ts`, och referensritningarna har ett projekt med
  2D-formerna och de egna pennorna (`former`). Koden: `dxf.ts` i fyra
  filer; rummen och väggarnas utsida delar sammanslagningen av väggarna
  (`bareWallUnion`), planen efter en flyttad vägg i `roomGrid(12)` 70 → 57
  ms. Samma klick i 0.8.31 och 0.8.32 (141 steg) ger samma läge. Står i
  README, PLAN.md och UTVECKLING.md under *Granskning (0.8.32)*.
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
  ~~0.8.35 Filtrera och markera~~ (klara)
- **0.8.36 Egna fyllningstyper** (linjefamiljer med streckning; kanske
  `.pat`-filer)
- **0.8.37 Detaljnivåer i stilmallen** (per vy, som i ArchiCAD)
- **0.8.38 Granskning**
- **0.9 Flera våningsplan och bjälklag** (nytt format; felet med golvnivån
  i 3D)
- **0.10 Tak** (nytt format; volymer ovanför snittet punktstreckade,
  footprint streckad genom taket som vyinställning)
- **0.10.1 Dolda linjer i fasader** (närmaste bjälklag och väggarnas
  insida streckade, vyinställning)
- **0.11 Trappor** (nytt format)
- **0.11.1 Profilverktyget** (nytt format, stor) och **0.11.2 Dörrar och
  fönster** (stor)
- **0.12 Export**: IFC4, DXF, areor för bygglov
- **Koordinater, SWEREF och sol** (stor; före eller efter piloten, bestäms
  efter 0.12)
- **0.13 Pilotprojektet**: Carl August ritar själv ett hus
- **Inbjuden alfa** för arkitektvänner; deras synpunkter i småversioner
- **Öppen beta och formatfrys**; etiketten blir *Beta*
- Efter piloten: se *Efter pilotprojektet* i PLAN.md (bl.a. kulör och
  material, explodera DXF-underlag, mallblad mellan projekt). **1.0**
  bygglovshandling.

## Nästa session

Fråga först om 0.8.35 syns på webbhotellet och hur filtret känns
(frågorna nedan). Läs synpunktsfilen och sortera ny Inkorg, och påminn
om att inget nytt ska bli en egen 0.8.xx (se *Läget*). Bygg sedan
**0.8.36 Egna fyllningstyper** (PLAN.md): mönster av linjefamiljer
(vinkel, avstånd, förskjutning, streckning), lika på skärmen, i PDF:en
och DXF:en; kanske `.pat`. Stor, troligen en session; föreslå att
`.pat` blir valfritt sist om tiden tryter. Sedan 0.8.37 Detaljnivåer och
0.8.38 Granskning, sedan 0.9.

## Att fråga Carl August om

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

- **Detaljnivåerna (0.8.37)**: per vy är bestämt. Gäller det bara
  litteran, eller ska dörrar och fönster också ritas olika (då hör en del
  hemma i 0.11.2)? Carl Augusts "ja" 25 oktober tolkades som per vy; säg
  till om det var fel.

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
- Taksprånget ändras lika på båda sidor av ett sadeltak; riktiga tak med
  takfot per kant kommer i 0.10.
- Spegla vänder inte bilden i ett underlag, bara läget.
- DXF: skraffering ritar streckade mönsterlinjer heldragna och solid
  fyllning som en ton (färgerna i DXF läses inte). Bilder och externa
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
  (141 steg sedan 0.8.32: stilmallen med linjetyper, snabbraden, den egna
  pennan, 2D-formens fält med mask och bakgrund, ritordning, Visas i,
  underlag, fasader och sektion). Kör den mot två byggen på var sin port
  och sedan med `--jamfor`; lägg till steg för det som granskas. Tre steg
  felar likadant i båda (`opacitet två`, `spegla linjen`, `x i
  smartmenyn`: fältet finns inte där skriptet letar) och kan rättas.
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
  i `core.test.ts`. Se *Tester* i UTVECKLING.md.
- Demon bara på begäran: `npm run preview:artifact`, läs artefakten
  (https://claude.ai/artifact/2m7gq5gkkgSP2wFZ7fLGNJ, Artifact `read`) och
  publicera `artifact/cad-apa.html` till samma URL.
- Stoppa servern med `ps -eo pid,args | grep "[p]ython3 -m http.server"`
  och `kill <pid>`, inte `pkill -f` eller `pgrep -f` i samma kommando (de
  träffar också skalet, som stängs).
- Testfiler att lägga in går snabbt att göra med reportlab (PDF), PIL
  (bild) och några rader text (DXF). Riktiga DXF med skraffering, block och
  bågar gör ezdxf (`pip install --break-system-packages ezdxf`), som också
  ger facit för konturerna (`ezdxf.path.from_hatch_boundary_path`).
- Mäta i webbläsaren: hela bildrutan, från `page.mouse.move` till två
  `requestAnimationFrame`, jämfört med ett tomt varv; att bara mäta
  JavaScript missar webbläsarens målning, som var det dyra vid panorering.
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
