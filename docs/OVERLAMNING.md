# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git. Senast: 24 oktober 2026, efter 0.8.24.

## Läget

- **0.8.24 2D-form del 2 är klar** på `main` (**format 13**, i en session):
  2D-formen är en kedja av raka segment och bågar (`bulges`, pilhöjd per
  segment som väggarnas) eller en spline. Rektangel, båge och cirkel blir
  kedjor efter ritandet (`chainFrom` i `draw2dTool.ts`); en cirkel är två
  halvcirklar. Böj (radie eller klick) och Räta ut för en kant i
  Modifiera. Ändformer `startCap`/`endCap` (pil, öppen pil, triangel,
  punkt, cirkel, snedstreck, tvärstreck) och `capSize` på papper, i
  egenskaperna och smartmenyn. Spegla vänder bågarna, Skala skalar dem;
  Trimma/Dela/Hörnskarv bara för raka linjer. Provat i bygget med
  Playwright (ritat cirkel, båge, rektangel; böjt med radie 2000 och rätat
  ut; alla ändformer visuellt) och `tests/v0824.test.ts`; alla 343 tester
  gick igenom. Står i README, PLAN.md och UTVECKLING.md under *2D-form
  del 2 (0.8.24)*. Projekt i format 12 öppnas inte.
- **0.8.23 Granskning är klar** på `main` (samma format, 12), utan nya
  funktioner: `commandLine.ts` uppdelad (`shellPoints.ts`, `shellLog.ts`,
  `shellDock.ts`, `shellHint.ts`, `shellActions.ts`), greppen i Markera i
  `src/ui/tools/selectGrips.ts`, projektträdets klick i
  `src/ui/app/treeClicks.ts`. Klick och hover i planen (`pickAllAt`) prövar
  bara objekt och delar nära markören (rektangel per objekt och `BoxIndex`
  över delarna i stora underlag), rutnätet ritas bara om när kameran
  ändrats, `BoxIndex.near` ger inte längre allt vid stora frågor.
  Kontrollerat med samma klick i 0.8.22 och 0.8.23 (Playwright, 106 steg,
  samma läge efter varje) och `tests/v0823.test.ts`; alla 330 tester gick
  igenom. Står i README, PLAN.md och UTVECKLING.md under *Granskning
  (0.8.23)*. `app.ts` delades inte (prenumerationernas ordning).
- **0.8.22 Småsaker är klar** på `main` (samma format, 12), de fem enkla
  synpunkterna från 24 oktober: Linje är polylinjen (`L`, `LINE`, `PL`,
  `PLINE`), opacitet för linje och fyllning tillsammans eller var för sig
  (`opacity`, `fillOpacity`), skrafferingens vinkel och avstånd direkt i
  smartmenyn, Visa → Fyllningar (`fill` i vyns `hide`), rumsstämpelns mall
  i stilmallen (`labels.room`) och sektionspilens hullingar 0,5. Provat i
  bygget med Playwright och `tests/v0822.test.ts`. Carl August bad att
  först få de enkla synpunkterna åtgärdade och sedan granskningen körd.
- **Inkorgen sorterades 24 oktober** (Claudes förslag, inte avstämt med
  Carl August; se *Att fråga*): 0.8.24 2D-form del 2, 0.8.25 Ritordning
  och fyllningar, 0.8.26 Pennor i stilmallen, alla före 0.9.
- **0.8.12–0.8.24 är inte provade** av Carl August. Frågorna nedan gäller.
- Tidigare versioner (0.8.15–0.8.21) står i PLAN.md med Claudes val.
- **Publicering:** varje push till `main` laddas upp med
  `.github/workflows/publicera.yml` (FTPS; secrets `FTP_SERVER`,
  `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_DIR` =
  `/agrellarkitektur.se/public_html/cad-apa/`). Se efter med `gh run list`.
  Halvfärdigt arbete kan läggas på en egen gren (som `granskning-0823`
  denna gång), så att det inte publiceras.
- **Prestandatestet** varierar med sandlådans hastighet (gick över 1,6 s i
  0.8.16, igenom sedan dess).
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
  ~~0.8.22 Småsaker~~, ~~0.8.23 Granskning~~, ~~0.8.24 2D-form del 2~~
  (klara)
- **0.8.25 Ritordning och fyllningar**: Längst bak … Främst, 2D-formens
  linje eller fyllning framför eller bakom väggarna, fyllning i rum
- **0.8.26 Pennor i stilmallen**: tjocklek och färg för pilar och markörer
- **0.9 Flera våningsplan och bjälklag** (nytt format; felet med golvnivån
  i 3D)
- **0.10 Tak** (nytt format; volymer ovanför snittet punktstreckade)
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

Fråga först om 0.8.24 syns på webbhotellet (numret vid alfa-knappen) och
hur 0.8.12–0.8.24 fungerar, särskilt bågarna och ändarna, och om
sorteringen av Inkorgen (0.8.25–0.8.26 före 0.9) stämmer. Läs
synpunktsfilen och sortera ny Inkorg. Nästa version är **0.8.25
Ritordning och fyllningar**: Längst bak … Främst, 2D-formens linje eller
fyllning framför eller bakom väggarna, och fyllning i rum. Säg hur stor
den är (mellanstor; kanske nytt format) innan den byggs. En
granskningssession bör föreslås igen efter 0.8.26 (ungefär var tredje
version; senast 0.8.23).

## Att fråga Carl August om

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

- **Sorteringen av Inkorgen** (24 oktober, Claudes förslag): 0.8.24 2D-form
  del 2 (radie per segment, ritsättet inte låst, pilar och ändformer),
  0.8.25 Ritordning och fyllningar (Längst bak … Främst, framför eller
  bakom väggarna, fyllning i rum), 0.8.26 Pennor i stilmallen; alla före
  0.9. Rätt ordning? Penntabellen för markörer flyttades fram från *Efter
  pilotprojektet*.

- **0.8.22 efter provning** (Claudes val, se PLAN.md): opaciteten är *Samma
  för linje och fyllning* från början, och kryssrutan skiljer dem; den
  finns i egenskaperna och smartmenyn, inte i verktyget. Rumsstämpelns
  ordning är en mall i stilmallen (som litteramallarna) och gäller hela
  projektet, inte ett rum i taget; raden med `{namn}` är den stora och
  feta. *Fyllningar* under Visa gäller vyn, så en sparad vy med
  fyllningarna släckta visas utan dem också på bladen. Rumsstämpelns pil är
  kvar tunn (bara sektionspilen ändrades). Former ritade som enkellinje
  före 0.8.22 heter också *Linje*.

- **0.8.23 efter provning**: inget nytt att prova; allt ska bete sig som
  förut, men pekandet i planen ska kännas lika snabbt med ett stort
  DXF-underlag som utan. Säg till om något beter sig annorlunda.

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
  väggytor på våningen (`union` i väggarnas `planBatch` och i rummens hål;
  `polygon-clipping` står för det mesta), 0,07–0,16 s för 300–700 väggar. Ett nytt rumsnamn räknar om rum och dörrar (0,08 s).
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
- **Jämföra före och efter** (så gjordes granskningen): bygg den gamla
  versionen i en egen arbetskopia (`git worktree add <mapp> <commit>`, länka
  in `node_modules`, `npx vite build --outDir <mapp>`), kör samma klick i
  båda byggena och jämför läget efter varje steg. Byt
  `crypto.getRandomValues` mot en fast följd i `add_init_script`, så att nya
  id blir desamma. Skript utan webbläsare buntas snabbast med
  `npx rolldown skript.mts --file skript.mjs --format esm --platform node`
  och körs med `node` (tsx lägger till `__name` som syns i profiler).
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
