# Plan

Den här filen är den enda planen för vad som byggs och i vilken ordning.
Varje del av planen är en version: "0.8" betyder samma sak här, i appen och i
README. Det finns inga separata steg.

Målet är ett kapabelt, lättdrivet och exakt ritprogram i webbläsaren för
arkitekter: lika kunnigt som de stora BIM-programmen, men mer
strömlinjeformat och automatiserat, med parametriska objekt och
komponenter som ändras överallt på en gång.
Arkitekturen och principerna står i [ARKITEKTUR.md](ARKITEKTUR.md).

**1.0** är när ett litet kontor kan göra en komplett bygglovshandling för en
villa i programmet. Pilotprojektet, alfan och den öppna betan (se nedan)
leder dit, men inget av dem är 1.0.

## Inriktning (bestämt 20 oktober 2026)

cad-apa är till för svenska arkitekter i små företag med små projekt:
villor, tillbyggnader, ombyggnader och mindre flerbostadshus. Det som behövs
för stora projekt byggs inte: samtidigt arbete i samma modell, installationer
och konstruktion, jättemodeller och andra länders regler. Samma avgränsning
gäller våra egna idéer: det som inte behövs för en bygglovshandling väntar
till efter pilotprojektet (0.13).

**Vägen ut** (bestämt 22 oktober 2026): först ritar Carl August själv ett
hus (pilotprojektet, 0.13). När det han hittar är åtgärdat blir det en
inbjuden **alfa** för arkitektvänner; den heter alfa och inte beta, eftersom
man ännu inte kan rita ett helt hus. När deras synpunkter är inarbetade
blir det en **öppen beta** som får spridas fritt, och då fryses formatet.
Appen heter *Alfa* redan nu (sedan 0.8.11).

Närmast byggs ett **proof of concept**: allt som krävs för att Carl August
ska kunna rita ett av sina egna, redan inlämnade bygglov i cad-apa, från
underlag till plottade blad. Därför har flera våningsplan, bjälklag, tak,
trappor och IFC-export flyttats fram, och mycket annat flyttats till
*Efter pilotprojektet*. Piloten (0.13) visar vad som saknas och om det finns
något att bygga vidare på; ordningen efter den bestäms då.

- **Plattform:** Chrome på dator (Windows 11). Telefonen är inget mål
  längre: det som redan finns för telefon får ligga kvar men testas inte och
  styr inga beslut, och tas bort när det står i vägen. Appen förblir en
  webbapp (installerbar som PWA). Håll kärnan (modell, geometri, regler) fri
  från webbläsarkod, så att den kan flyttas till en skrivbordsapp (Electron
  eller Tauri) om det behövs.
- **Bakåtkompatibilitet:** inga migreringar före formatfrysen, som kommer
  med den öppna betan. Formatnumret höjs fortfarande vid varje
  formatändring, och en fil i ett äldre format ger ett tydligt meddelande om
  att den kommer från en äldre alfaversion. Från formatfrysen gäller
  migreringar igen.
- **Kvalitet:** prestandatestet (`tests/prestanda.test.ts`, sedan 0.8 del
  2.1) ska gå igenom i varje version. Referensritningar läggs till i 0.8.2.
  Var tredje version eller så görs en granskningssession utan nya
  funktioner: städa, dela upp stora filer (`app.ts`, `propertiesPanel.ts`)
  och leta efter algoritmer som växer med kvadraten på antalet objekt.

Versioner som ändrar filformatet (`FORMAT_VERSION`) markeras med *nytt
format* nedan. Före formatfrysen behöver formatändringar inte samlas: en
version ändrar formatet när den behöver det. Däremellan kommer små
uppdateringar (0.8.2 …) med 3–6 punkter.

## Klart

| Version | Innehåll |
| --- | --- |
| 0.1–0.5 | Skelett och PWA, kärnan med tillstånd och ångra, väggverktyget med skarvar, typer, littera och stilmallar, 3D-vyn med markering och redigering, dörrar och fönster, rum med numrering, mått och text |
| 0.6 | Format 3: väggars insida, modulmått, detaljnivåer, litteramallar, dörrnummer, egna egenskaper, mått knutna till modellen, vyer, kalkering |
| 0.6.1 | Projektträdet (då kallat navigatorn), tillfälliga mått |
| 0.6.2 | Skyddat autospar, sidopaneler med egen bredd, skärmskala, textredigering i ritningen, zip för webbhotellet |
| 0.6.3 | Formler och enheter i sifferfält, anslutna väggar följer med, ny topprad, minimerade paneler, högerklick, utfällbar snabbmeny, vyhistorik, kalkering med eget utseende, tillfälliga vyinställningar |
| 0.7 | Format 4: fasader och sektioner med dolda linjer, norrpil och fasader efter väderstreck, testtak med gavlar, bågväggar, Modifiera-paletten (lägg till punkt, böj, tangent, förskjut, avrunda, fasa, sträck, kopiera i rad m.m.) |
| 0.7.1 | Betaversion med synpunktsformulär, detaljnivåer och linjetjocklekar i fasad och sektion, glasmarkering och öppningssätt, automatisk taklutning, sektioner begränsade till linjen och klippta i 3D, nya markörer i planen med grepp, längd, vinkel och Rikta efter objekt, streckning från hörnen, varning för nästan raka vinklar, takets kontur i Modifiera, måttband, spårlinjer, kopiera och klistra in mellan projekt, Ctrl + dra, piltangenter, zooma till område och förra zoomen |
| 0.8.0 | Format 5: projektträdet med mappar, 2D-element med Visas i och vy-taggar, mått och text i fasader och sektioner, underlag (PDF, bild, DXF) och arbetsblad, snabbare väggskarvar, ritningsblad med BH90-huvud och smarttext, vyer i skala på bladen, annoteringsskala och Plot/export till PDF i en zipfil |
| 0.8.1 | Granskning utan nya funktioner: transaktioner, väggskarvar, dolda linjer och rum utan algoritmer som växer med kvadraten; `app.ts` och `propertiesPanel.ts` uppdelade |
| 0.8.2 | Fasader och sektioner i en bakgrundstråd, referensritningar i testerna, synpunktsformulärets fel, markering i 3D med Följ sektionen och i sektion, textverktyget på blad, mappräknaren |
| 0.8.3 | Snabbare plan: panorering utan ommålning, cache per objekt, snäpp mot grannar, skraffering i DXF |
| 0.8.4 | Arbetsflöde: skarven mellan 2D och 3D, dubbelklick i trädet, ny vägg från en väggs ände, varningen för sneda vinklar av per objekt, Tab mellan objekt på varandra, flytta med måttbandet |
| 0.8.5 | Smartmenyn (snabbmenyn och Modifiera-paletten i en meny bredvid det markerade) och Modifiera-raden innanför ritverktygen; `modify.ts` uppdelad i `src/ui/modify/` |
| 0.8.6 | Format 6: nya blad blanka, BH90-huvudet som eget objekt på bladet, flytta och ta bort på bladet med smartmenyn |
| 0.8.7 | Format 7: text på bladet, vyernas ram med grepp, dold skala i vyrubriken |
| 0.8.8 | Format 8: mallblad med smarttext i stället för ram och BH90-huvud, förvalt mallblad, exempelmallblad, fet och justerad text, fler skalor |
| 0.8.9 | Format 9: linjer, ytor, text och bilder direkt på bladen, vyer och ritat markeras och flyttas tillsammans, textrutor med radbrytning och förankring, egen skala för vyer |
| 0.8.10 | Format 10: obegränsat med smarta fält, fält för hela projektet, flera blad samtidigt, `{mapp}` och `{skala a3}` |
| 0.8.11 | Granskning: `app.ts` och `sheets.ts` uppdelade, vyerna på bladen räknas inte om i onödan, Visa i kategorier, text i DXF-underlag, mönster med förhandsbild, markering av 2D, statusradens knappar, linjetjocklek på skärmen, Alfa |
| 0.8.12 | Format 11: skalstock på bladet (skalan från en vy eller egen, efter Carl Augusts skalstockar 1:1–1:5000), stämplar som ritas en gång och läggs på flera blad |
| 0.8.13 | Trimma, Hörnskarv, Dela, Avrunda och Fasa alla, baspunkt från en snäppunkt för Flytta, Vrid, Spegla och I rad, kortkommandon i Modifiera-raden, publicering med FTP |
| 0.8.14 | Justera och Fördela, Hämta och överför (pipetten), Skala, Förläng och Trimma flera mot en gräns, linjetjocklekar i en tabell med "gammel-cad"-färger |
| 0.8.15 | Granskning: register för väggändar och dörrar (Modifiera utan kvadratisk tid), `tool.ts` uppdelad |
| 0.8.16 | Underlag: snäpp i DXF (centrum, kvadranter, bågmitt, skärningar), parallellt och vinkelrätt som i SketchUp, X/Y, bredd och höjd, papperskorg, underlagen per filtyp i trädet, bildens grepp och Återställ proportioner |
| 0.8.17 | Rumsstämpeln: flyttbar, pil in i rummet utanför, Stämpeln i mitten |
| 0.8.18 | Småsaker: rutnätet med alla nivåer, segmentpunkter med måttbandet, osifont på skärmen och i PDF:en, Om-rutan, autospara till fil, dra och släpp till mappar |
| 0.8.19 | Format 12: 2D-formen ersätter 2D-linjen och fyllningen; fyllning på vilken form som helst, ingen linje (tjocklek 0), mitten klickbar bara med fyllning |
| 0.8.20 | Kommandoraden del 1: smartshell under ritytan, register med engelska och svenska förkortningar, komplettering, Enter öppnar, mellanslag upprepar, skrivna punkter (avstånd, @x,y, @d<v, x,y) |

## Framåt

Det här står kvar att göra, version för version. Allt som diskuterats och
bestämts ska stå här, så att arbetet kan tas upp av någon annan (eller i en
ny session) utan att något faller bort.

### Egen form

cad-apa ska kännas som ett eget program, inte som en kopia av något annat:
egna ikoner, egna ord och egna arbetsflöden. Ingen text, inga ikoner och
inga dialoger tas från andra program. Kommentarer i koden beskriver vad
koden gör, inte vilket program den liknar. Ord vi valt: *Modifiera*,
*snabbmeny*, *smartobjekt* (parametriska objekt), *smarttext* (text som
fylls i av sig själv), *smartgrupper* (grupper där en ändring slår igenom i
alla), *dumbs* (snabba fria volymer), *projektvinklar*, *vy-taggar*,
*spårlinjer*, *måttband*.

### Regler per land

cad-apa riktar sig till svenska kontor och är på svenska. Det som räknas
efter svenska regler (areor enligt SS 21054, byggnadshöjd och medelmarknivå
enligt PBF, rums- och dörrnumrering, hålmått) skrivs i egna filer och inte
utspritt i koden, men inget särskilt lager för andra länder byggs förrän
någon behöver det.

### Efter 0.7

Fasader och sektioner räknas exakt ur 3D-formerna. Det som återstår av dem
byggs vidare i takt med resten:

- Brutna sektionslinjer
- Fler nivåkoter, höjdmått och marklinje mot terräng (med terrängen, efter pilotprojektet)
- Fönster- och dörrsymboler i fasad efter typ (med smartobjekten, efter pilotprojektet)
- Skuggor och djup i fasader

### 0.8 Ritningar, underlag och utskrift · *nytt format*

0.8 byggs i tre delar och släpps som 0.8.0 när alla är klara. Formatet höjs
en gång, i del 1, till format 5 för allt som 0.8 behöver. Demon visar del för
del.

Från granskningen av 0.7.1:

- 3D-vyn kan snurras under marken, för att se undersidor
- Rikta efter objekt gör både fasader och sektioner parallella med det man klickar på; Shift ger vinkelrätt
- Spara som vy föreslår namnet på det som visas (t.ex. "Fasad mot söder – Nytt")
- Synpunktsformuläret visar serverns felmeddelande i stället för att tyst öppna e-posten; e-post öppnas bara när skriptet saknas (som i demon)
- Projektträdet får en egen ikon: ett stående träd
- Växlaren 2D/3D/Båda svävar nere i mitten av vyn

#### Del 1: format 5, projektträdet, 2D-element och synlighet

*Byggd. De två punkter som blev kvar (grepp i sektioner för nock och
takfot, och grepp och Modifiera för 2D-elementens punkter) byggdes i del 2.*

- Format 5 med migrering 4 → 5 och test, för allt i 0.8 på en gång
- Mappar med undermappar i projektträdet, i alla flikar. Mapparna används också av Plot/export i del 3
- Det man markerar i projektträdet (vy, fasad, sektion, senare blad) visar sina inställningar i egenskapspanelen, med en Spara-knapp sist; ändringarna slår igenom först när man sparar
- Fasader och sektioner skapas med nya filer utan förklarande text. Fasaderna följer byggnaden tills man själv flyttar dem. *Lås* (med hänglås) är ett eget val som hindrar att en linje flyttas av misstag
- Snittytor i 3D: det som skärs av en öppen sektion får en fylld yta i snittet. *Följ sektionen* i 3D-vyn slår av och på klippningen

2D-element och synlighet:

- Linje, polylinje, båge, cirkel, rektangel, spline, fyllning och skraffering, med linjetyper och pennor
- Varje 2D-element (och text och mått) har *Visas i*:
  - *Alla vyer av våningen* (förval)
  - *Bara den här vyn*
  - *Utvalda vyer*: en lista med kryssrutor, där även andra våningars planvyer går att välja
  - *Vyer med taggar*: "alla" eller "någon av" taggarna, med "Syns nu i N vyer" som uppdateras medan man väljer och en varning om det blir 0
- Vy-taggar är egna; förslag att börja med: golvplan, undertak, möblering, bygglov, bygghandling, 1:50, 1:100. Det ersätter till stor del lager i vanlig 2D-CAD
- "Visa dolda 2D-element" för att hitta det som inte syns i den aktuella vyn

Mått och text i fasader och sektioner:

- Mått- och textverktygen fungerar i fasader och sektioner (i dag visas ett tips om att gå till planen)
- Taklutningen blir ett eget objekt: knuten till takfallet så att värdet stämmer, men fri att flytta, och med egen stil (markörstilarna kommer efter pilotprojektet)
- Automatiska höjdkoter för nock och takfot
- Grepp i sektioner: dra i nocken för att ändra taklutningen, och i takfoten

#### Del 2: underlag och arbetsblad

*Byggd (demon visar den), tillsammans med det som blev kvar från del 1.
Bestämt 19 oktober: takfoten som dras uppåt tar med sig nocken (Shift
håller nocken still), PDF-filen sparas som den är i projektet, och
underlag går att lägga även i fasader och sektioner.*

- Underlag: PDF (som bild), bilder och DXF. Skalan kalibreras genom att klicka två punkter och skriva avståndet. Underlaget kan flyttas, riktas, låsas och tonas, och visas i modellvyn, på arbetsblad och i fasader och sektioner. Snäpp mot linjerna i DXF-underlag, med lager som kan släckas
- Arbetsblad: fria 2D-ritningar som inte hör till ett våningsplan

#### Del 2.1: prestanda (småversion, 20 oktober)

*Byggd.* Väggarnas 3D-former (som fasader, sektioner och 3D-vyn räknas ur)
prövade varje vägg mot alla tidigare väggar för att reda ut T-skarvar. Nu
prövas bara väggar som ligger intill. En fasad av 544 väggar gick från
6–10 s till ca 0,5 s, med samma resultat. Prestandatestet
`tests/prestanda.test.ts` fångar om det blir långsamt igen.

#### Del 3: ritningsblad och plot

*Byggd (20 oktober), allt nedan, och 0.8.0 är därmed klar. Formatet är
fortfarande 5: loggan ligger i `project.fields` och vyernas läge på bladet i
`Viewport.at`. En vy på ett blad visar det som är ritat i den med 4 mm luft;
underlag klipps mot den ramen. Att beskära en vy för hand ligger under
Efter pilotprojektet.*

Bantad 20 oktober för att rymmas i en session. Det som stod här om grafik,
markörer, projektvinklar och en andra 2D-ruta ligger nu under *Efter
pilotprojektet*, och DXF av blad kommer i 0.12. Blir det ändå för mycket
flyttas annoteringsskalan eller Plot/export-dialogen till 0.8.1.

- Ritningsblad A4–A0 med ritningshuvud enligt BH90 (BEAst efter
  pilotprojektet), egen logga och smarttext. Formatet finns redan (`sheets`
  med `viewports`)
- Flera vyer per blad (planer, fasader, sektioner, arbetsblad), var och en i
  sin skala och med vyrubrik. Underlagen syns på bladet genom vyerna
- Annoteringsskala per vy, så att texthöjder på papper stämmer i alla skalor

Plot/export (ett ställe för all export, i stället för att plotta från
Ritningar och exportera från Vyer):

- Nås från cad-apa-menyn och från knappen *Plot/export…* under rubriken
  Projektträd, ovanför flikarna
- Kryssrutor grupperade efter mapparna i projektträdet: hela mappar eller
  enstaka blad och vyer
- PDF i vektorform för blad och vyer, med filnamn efter ritningsnumret. DXF
  av vyer och blad kommer i 0.12
- Allt kommer som en zipfil att spara; exporten visar hur långt den kommit
  och kan avbrytas

### 0.8.1 Granskning

*Byggd (20 oktober). Inga nya funktioner och samma filformat (5). Allt
nedan ger exakt samma ritningar och projekt som förut; det kontrollerades
med fingeravtryck av planer, fasader, 3D, rumsnummer och kommandon, och
med samma klick i webbläsaren före och efter.*

- Transaktioner kopierar samlingarna en gång i stället för vid varje
  ändring (`TxBuilder` i `src/core/store.ts`): flytta, kopiera och ta bort
  många objekt växte med kvadraten
- Väggskarvar och T-skarvar prövar bara väggar i närheten (`BoxIndex` i
  `src/geometry/boxIndex.ts`); rum och dörrar i rumsnumreringen likaså
- Dolda linjer: trianglarna i djupordning, och en kant som är helt dold
  slutar prövas (`src/geometry/hiddenLine.ts`)
- `src/ui/app.ts` (1 922 → 836 rader) och `src/ui/propertiesPanel.ts`
  (1 065 → 571) uppdelade i mindre filer
- Prestandatestet utökat med dörrar, fönster och rum, och med flytt, kopia
  och borttagning av alla väggar

Mätt men lämnat: snäppningen går igenom alla sträckor vid varje
musrörelse (linjärt, men tungt med stora DXF-underlag), och planen ritas om
helt vid panorering (15 ms för 684 väggar). Båda hör till 0.8.3.

### 0.8.2 Bakgrundstråd, referensritningar och småfel

*Byggd (20 oktober), allt nedan, med samma filformat (5). Delad samma dag:
panoreringen och cachen per objekt flyttade till 0.8.3. Bladen och
Plot/export räknar fortfarande fasader direkt. Textverktyget på ett blad
stannar på bladet med ett tips; text direkt på bladet ligger kvar under
Efter pilotprojektet.*

- Fasader och sektioner räknas i en bakgrundstråd (Web Worker), så att
  gränssnittet aldrig fryser
- Referensritningar: några testprojekt ritas i testerna och jämförs mot
  facit, så att ändrade ritningar syns
- Synpunktsformuläret: servern svarar 503, alltså hittas eller godtas inte
  `feedback-config.php`. Konfigurationen kan ligga i själva `cad-apa`-mappen
  och de två felen får olika texter

Synpunkter (20 oktober):

- I 3D med *Följ sektionen* går det att markera det som syns, inte bara det
  bortklippta (oftast taket)
- I 2D-sektion markeras väggen man klickar på, inte taket och alla väggar
  som ansluter till det
- Textverktyget på ett ritningsblad hoppar inte tillbaka till en vy
- Mappens räknare i projektträdet står på samma rad som namnet,
  högerjusterad

### 0.8.3 Snabbare plan

*Byggd (20 oktober), allt nedan, med samma filformat (5). Dessutom: hover
och markering ritar inte om planen, och ett stort underlag markeras med sin
ram. En flyttad vägg räknar fortfarande om sammanslagningen av alla
väggytor på våningen (0,2 s för 684 väggar).*

- Panorering och zoom flyttar bilden i stället för att bygga om hela
  SVG-bilden för varje bildruta (`planView.ts`), så att stora DXF-underlag
  inte hackar
- Planen byggs om bara för de objekt som ändrats (cache per objekt)
- Snäppningen prövar bara sträckor nära markören (`BoxIndex`)
- DXF-underlag: skraffering (HATCH) läses

### 0.8.4 Arbetsflöde

*Byggd (20 oktober), allt nedan, med samma filformat (5): att varningen är
avstängd sparas i ett frivilligt fält som äldre versioner hoppar över.
Ritningshuvudet flyttades till 0.8.5.*

Synpunkter (20 oktober):

- Dra i skarven mellan 2D och 3D för att ändra fördelningen
- Dubbelklick i projektträdet när bara 3D visas går över till 2D och visar
  vyn (eller det man klickat på)
- Klick på en väggs ändpunkt fortsätter väggen som förval; Modifiera-paletten
  visas samtidigt, så att man kan välja något annat utan att avbryta först
- Varningen för sneda väggar kan stängas av per vägg i väggens inställningar
- Tab växlar mellan objekt som ligger på varandra, innan man markerar
- Måttbandet: Tab och ett värde flyttar målobjektet (mäter man från en vägg
  till ett bord och skriver in avståndet, flyttas bordet)

### 0.8.5 Smartmeny och Modifiera-raden

Synpunkter (20 oktober): *paletten* (Modifiera) och *snabbmenyn* (vid
markören) blir en och samma, **smartmenyn**, i samma tema som smarttext,
smartobjekt och smartgrupper. Modifiera-verktygen ska också gå att nå utan
menyer som ploppar upp. Tidigarelagd av Carl August, före bladversionerna.
Samma filformat (5). Stor för en session: blir det för mycket flyttas
kortkommandona till 0.8.6 som en småversion.

*Byggd (20 oktober), med samma filformat (5). Kortkommandona och Avrunda
och Fasa för hela markeringen flyttades till 0.8.8, numera 0.8.13 (Carl August, 20
oktober), där verktygslistan bestäms. Modifiera-raden går att dölja i
inställningarna. Ett verktyg i raden som behöver en ände, ett hörn eller en
kant använder den man redan klickat på, annars ber raden om ett klick.*

Smartmenyn:

- Visas så fort något markerats, som snabbmenyn i dag, med Modifiera-valen
  överst för det markerade. För en vägg Flytta, Vrid, Spegla, I rad; för
  flera sammansatta väggar eller linjer också Förskjut alla kanter, Avrunda
  och Fasa där det går. Man ska kunna flytta en vägg direkt, utan att först
  klicka på referenslinjen eller änden. Listorna i synpunkten är exempel:
  alla val som finns för sammanhanget (`opsFor` i `src/ui/modify.ts`) är med,
  och nya val hamnar där av sig själva
- Klick på en ände, ett hörn, en kant eller referenslinjen byter
  Modifiera-valen till det som gäller där (Ny vägg, Sträck, Förläng; Lägg
  till punkt, Böj, Förskjut …), i samma meny. *Ny vägg* vid en ände är
  fortfarande förval (0.8.4)
- Raden med valets namn, värdefält och tips ligger under Modifiera-valen och
  ovanför snabbknapparna (Center, Vänd väggen, Riv …); *Mer* fäller
  fortfarande ut inställningarna nedåt
- Greppet med de sex prickarna till vänster flyttar menyn; dubbelklick på
  greppet låter den följa markeringen igen
- Placeringen utgår från det markerade: menyn läggs bredvid det, på den
  sida där det finns plats, och inte över det
- Namnbyte i gränssnittet, inställningarna och dokumentationen: snabbmeny
  och palett blir smartmeny (`PetPalette` och `ModifyPalette` slås ihop;
  `modify.ts` delas upp samtidigt)

Utan smartmeny (avstängd i inställningarna):

- Inget ploppar upp i ritytan, inte heller vid klick på en ände eller
  referenslinjen
- **Modifiera-raden**: en lodrät verktygsrad på insidan av ritverktygen i
  vänsterkanten med alla Modifiera-verktyg. Med något markerat tänds de som
  går att använda svagt; de andra är släckta. Klick startar verktyget för
  det markerade (för ände, hörn och kant: den man redan klickat på, annars
  ber raden om ett klick). Raden syns också med smartmenyn påslagen, så att
  verktygen alltid finns på samma ställe, och kan döljas i inställningarna
- Tipsraden och värdefältet visas då i verktygsraden under ritytan, som för
  ritverktygen

### 0.8.6 Ritningshuvud · *nytt format*

- Ritningshuvudet hårdkodas inte i bladen: nya blad är blanka och BH90-huvudet
  blir ett eget objekt som läggs på och flyttas. Egna grupper med linjer och
  text kommer med *Smartgrupper* efter pilotprojektet

- Synpunktsbreven kommer inte fram till Gmail: kuvertavsändaren sätts med
  `-f` i `feedback.php`

Mellanstor; en egen småversion så att nya blad blir blanka så snart som
möjligt (Carl August, 20 oktober). Bladets objekt bör rymma både huvudet
och texterna i 0.8.7, och kunna markeras med smartmenyn.

*Byggd (20 oktober), format 6. Carl August valde (20 oktober): ramen är en
kryssruta på bladet; nya blad är blanka, med en kryssruta som ger nya blad
huvud; flera huvuden per blad (bladet kan få annat än huvuden, som
skalstock och orienteringsfigur); fälten ändras i huvudets egenskaper och
ritningens fält sparas per blad. Huvudet lagrar bara läge och mall, med
läget räknat från papperets nedre högra hörn. Vyerna har en egen lista
(`viewports`) bredvid `items`; att slå ihop dem kan tas i en granskning.
Flytta på bladet görs med två klick från smartmenyn eller Modifiera-raden.
Migreringarna till format 5 togs bort, eftersom inget längre når format 6
genom dem.*

### 0.8.7 Text på bladet och vyernas ram · *nytt format*

- Fria texter direkt på ett ritningsblad, med samma textverktyg som i vyerna
  (flyttad från *Efter pilotprojektet*; viktig för handlingarna). En text
  blir ett nytt slag i `SheetItem` (0.8.6) och markeras, flyttas och tas
  bort som huvudet
- Ändra vyns ram på bladet (beskärning) med grepp i kanterna, och
  *Återställ ramen till innehållet*, som i Archicad och InDesign (synpunkt
  20 oktober; tidigare planerad efter pilotprojektet). Vyn får en egen ram
  (`crop`); underlagen klipps redan mot ramen, så klippningen finns
- Skalan i vyns rubrik går att dölja (önskemål 20 oktober)

Mellanstor.

*Byggd (20 oktober), format 7. Claudes val, att stämma av: texten har
höjderna 1,8–10 mm och fet stil, skrivs i verktygsraden som i vyerna och
redigeras på plats med dubbelklick, och kan ha smarttext. Läget räknas från
papperets nedre vänstra hörn, så att texten står kvar när formatet byts.
Vyns ram ligger i modellens koordinater och följer med när skalan byts;
kanterna fäster mot ritningsramen och de andra sakerna på bladet.*

### Bladen om (0.8.8–0.8.12, bestämt 20 oktober)

Carl August tycker att ritningsramen och det inbyggda BH90-huvudet (0.8.6)
är för fördefinierade och låsta. I stället ritar man sina egna utseenden
med de vanliga verktygen, som Archicads *master layouts*: **mallblad** som
andra blad använder, **stämplar** att lägga på blad, **textrutor** och
**smarta fält** utan begränsning. Det som gjorts i 0.8.6 och 0.8.7 ersätts
delvis; ritningen av huvudet, smarttexten, vyernas ram och den dolda skalan
återanvänds. Granskningen och Modifiera-verktygen flyttas efter.

### 0.8.8 Mallblad · *nytt format*

- **Mallblad**: en egen sorts layout med pappersformat och orientering, i
  Ritningar-fliken. Man ritar på den med de vanliga verktygen: linjer,
  rektanglar, ytor, text med smarttext, och bilder, logga och DXF som
  underlag. Byggs som ett arbetsblad (format 5) i skala 1:1 med papperet
  som yta, så att ritverktygen, markeringen, smartmenyn och
  Modifiera-verktygen fungerar utan att skrivas om. Smarttexten fylls i från
  bladet som använder mallen
- Varje blad väljer ett mallblad, och mallens grafik ritas under bladets
  vyer. Projektet har ett förvalt mallblad som nya blad får. Mallen följer
  bladets format; ett blad i ett annat format än mallen får ett tips
- Ritningsramen (`Sheet.frame`) och det inbyggda huvudet (`TitleBlockItem`,
  BH90) tas bort som funktioner. Bladets fält (skede, datum, ändring,
  ritat av, granskat av …) ligger kvar i bladets egenskaper och hamnar i
  mallen genom smarttext, t.ex. `{skede}` och `{datum}`
- Ett **exempelmallblad** följer med nya projekt och exempelprojektet: ram
  och ett huvud i BH90-stil ritat av vanliga linjer och texter, som man kan
  ändra, kopiera eller ta bort
- Carl August har en tom ritningsram med huvud som DWG. Han bifogar den
  (helst också som DXF) när sessionen börjar: Claude gör om den till DXF
  (LibreDWG) och linjerna och texterna till 2D-objekt i ett mallblad, så
  att ramen blir testfallet och texterna kan bytas mot smarta fält

Stor, en session. Blir det trångt väntar exempelmallen eller DWG-ramen.

*Byggd (20 oktober), format 8. Ett mallblad är ett arbetsblad med `paper`
(format och orientering); allt på det ritas i mm på papperet, i 1:1, och
följer inte tillstånden. Claudes val, att stämma av: smarttexten fylls i när
bladet ritas (texterna i mallen byts ut), inte i textobjektet; mallen ritas
från papperets nedre vänstra hörn på blad i andra format (med ett tips);
väljs ett mallblad i bladets formulär föreslås dess format; fälten för
smarttexten ligger i bladets formulär tills 0.8.10; loggan i projektet togs
bort (en logga läggs in som underlag på mallbladet). Text fick fet stil och
justering, eftersom mallar behöver det. Skalorna 1:25, 1:2500, 1:4000 och
1:5000 lades till (Carl Augusts ram). Ramen från DWG:n blev ett mallblad med
`scripts/mallblad-fran-dxf.py` och `scripts/mallblad-projekt.mts`, i en egen
projektfil till Carl August; DXF:en ligger inte i repot (den har ett
telefonnummer). Skalstocken innanför ramen (1:200, x 610–711, y 25–47 mm på
A1) visar var skalstocken står som standard och togs inte med i mallen;
skalstockarna utanför ramen (1:1 till 1:5000) är facit för 0.8.12.*

### 0.8.9 Grafik och textrutor på bladen · *nytt format*

- Linjer, ytor, text och bilder direkt på vanliga blad, med samma verktyg
  som på mallbladet. Det svåra är att vyerna på bladet och de ritade
  objekten ska gå att markera, flytta och ta bort tillsammans
- Texten på bladet från 0.8.7 (`SheetTextItem`) blir vanlig text, så att
  det finns ett sätt att skriva på papper
- **Textrutor**, för text i vyerna också: största bredd och höjd, vänster-,
  centrerad eller högerjustering, och förankring i rutans överkant, mitt
  eller underkant. Raderna bryts vid ord med typsnittets bredder, så att
  skärmen och PDF:en bryter likadant. Ryms texten inte i höjden visas en
  röd markering på skärmen som inte skrivs ut; texten krymps inte

Mellanstor.

Från synpunkterna (20 oktober): **Egen skala** för vyer på bladet (1:___),
och *Återställ ram* kortare i smartmenyn.

*Byggd (20 oktober), format 9. Det som är ritat på ett blad är element med
`space` satt till bladets id, ritade som på ett mallblad (mm på papperet,
1:1, utan tillstånd); bilder ligger under vyerna, resten över. Vyerna på
bladet ligger i den vanliga markeringen (`selection`), så att
markeringsverktyget, Modifiera Flytta, Delete och piltangenterna tar dem
med det ritade; vyerna går bara att flytta (inte vrida, spegla eller
kopiera). Mått på bladet är avstängt med ett tips (mått ritas i vyerna).
Claudes val, att stämma av: textrutans förankring är punkten i rutans
över-, mitt- eller underkant och justeringen dess vänster-, mitt- eller
högerkant; utan förankring står första radens baslinje på punkten som
förut. Rutans mått ställs in i egenskaperna (0 = ingen gräns), inte genom
att dra en ruta med textverktyget. Skärmen visar texten med appens
typsnitt, så en rad kan se något längre eller kortare ut än i rutan;
radbrytningen följer ändå PDF:en.*

### 0.8.10 Smarta fält

- **Mappnamn** (Carl August, 20 oktober): namnet på mappen i projektträdet
  som bladet ligger i, t.ex. BYGGLOV eller SKISS, så att det står på
  ritningen av sig själv. Hans ram har platshållaren #MAPPNAMN
- Obegränsat med smarta fält: allt inom klamrar som inte är ett inbyggt
  namn, t.ex. `{Konstruktör}`, blir ett fält, oavsett om det står i
  mallen, i en stämpel eller direkt på bladet. Namnen jämförs utan hänsyn
  till stora och små bokstäver
- Bladets egenskaper visar en tabell med alla fält bladet använder, där
  värdena fylls i. Ett felstavat namn ger ett nytt, tomt fält som syns i
  tabellen
- Ett fält kan markeras som **gäller hela projektet** (konstruktör,
  beställare, uppdragsnummer): det fylls i på ett ställe och gäller alla
  blad, också nya
- **Flera blad samtidigt**: markera flera blad i projektträdet. Fält med
  olika värden visar *(olika)*, och bara de fält man ändrar skrivs till de
  markerade bladen (t.ex. konstruktör på alla men inte publiceringsdatum)

Mellanstor.

*Byggd (21 oktober), format 10. Fälten sparas med små bokstäver på bladet
eller, för fält som gäller hela projektet, i projektet; kryssrutan
**Projekt** i tabellen flyttar värdet mellan dem. Claudes val, att stämma
av: inbyggt är bara det som räknas fram (projekt, ritningsnummer,
innehåll, `{mapp}`, skala, `{skala a3}`, format, idag); adress, datum,
skede, ritat av m.fl. är vanliga fält, och adress, fastighet, beställare,
uppdragsnummer, arkitekt och ansvarig gäller hela projektet från början.
`{skala a3}` är skalan när bladet skrivs ut på A3 (nämnaren gånger
papperets långsida / 420, alltså 2 för A1). Flera blad markeras med Ctrl-
eller Shift-klick i Ritningar. Ett fält med olika värden som töms skrivs
inte (det går att tömma på ett blad i taget). Fälttabellen visar fälten
i huvudets ordning. Carl Augusts A1-ram gjordes om till ett mallblad i
format 10 (egen projektfil, inte i repot).*

### 0.8.11 Granskning

Förra granskningen var 0.8.1, och bladen har byggts om flera gånger:
städa, dela upp stora filer (`src/ui/app/sheets.ts`, `src/ui/app.ts`) och
leta efter långsam kod. (`Sheet.items` försvann i 0.8.9, när texten på
bladet blev en vanlig text.) **Visa-menyn i kategorier** (Carl August, 20
oktober): en kryssruta per kategori, så att t.ex. alla littera eller alla
markörer tänds och släcks på en gång. Vill Carl August komma fram till 0.9 snabbare kan
granskningen och Modifiera-verktygen (0.8.13) byta plats.

Småsaker från synpunkterna (21 oktober), som hör till städningen:

- **Fel: text i DXF-underlag.** MTEXT får ett udda prefix (`\pxql`, en
  formateringskod som ska tolkas bort), och TEXT och MTEXT läggs alltid
  från insättningspunkten nere till vänster oavsett justering, så många
  texter hamnar fel
- Förhandsvisning av fyllningsmönstret bredvid namnet i listan där man
  väljer mönster
- En sluten polylinje markeras bara vid kanten, inte med ett klick i
  mitten; en linje bakom en fyllning går före fyllningen när man klickar
  nära linjen
- Statusraden: *Rutnät x mm* och skärmskalan får en ram och ser ut som
  knappar; ett klick på *Rutnät* slår av och på rutnätet. *Snäpp* får
  samma text och utseende som de andra knapparna
- Avstängda växlar: synlighetsväxlar får ett snett streck i ikonens egen
  färg (inte rött) när de är avslagna, och påslagna knappar en tydligare
  färg

Från synpunkterna 21 oktober, sorterade 22 oktober:

- **Linjetjocklek på skärmen**: en knapp i statusraden med tre lägen,
  *Tunna* (alla linjer 1 px), *Skärm* (konstant i pixlar, som förut) och
  *Verklig* (pappersmåttet gånger zoomen enligt skärmskalan, minst 1 px).
  Som Archicads hårlinje och True Line Weight och Revits Thin Lines
- **Alfa**: etiketten i appen och meddelandet om äldre filer säger alfa i
  stället för beta (se *Vägen ut* överst)

*Byggd (22 oktober), allt ovan, med samma filformat (10). Uppdelningen
gav samma läge efter samma klick som förut. Dessutom: vyerna på ett blad
räknas inte om när bara bladen ändrats (en flyttad vy 2,4 s → 5 ms med 312
väggar och tre fasader), och delvis ikryssade kryssrutor syns. Claudes val,
att stämma av: kategorierna i Visa (Modell, Littera, Rum, mått och text,
2D, Markörer), littera per typ och underlag i Visa; att MTEXT fästs efter
sin bredaste rad; namnen Skärm, Verklig och Tunna; att avslagna knappar får
ett snett streck och påslagna accentfärgen; att en sluten polylinje inuti
ett rum går före rummet men en linje nära klicket går före båda. Mätt men
lämnat: en flyttad vägg räknar om sammanslagningen av väggytorna (0,07–0,16
s för 300–700 väggar).*

### 0.8.12 Skalstock och stämplar · *nytt format*

- **Skalstock** som ett inbyggt objekt på bladet, inte i mallen (samma ram
  kan behöva olika skalstockar): skalan hämtas från en vy man väljer eller
  anges själv, med längd och indelning. Den läggs där man vill och går att
  flytta när som helst, som de andra sakerna på bladet
- **Stämplar**: egna ritade grupper att lägga på ett blad, t.ex. logga,
  "BYGGLOVSHANDLING", orienteringspil eller ett tilläggshuvud. En stämpel
  ritas med samma verktyg som ett mallblad, fast utan papper, och kan ha
  smarttext och smarta fält. Den läggs på, flyttas och tas bort som
  huvudet i 0.8.6, och ändras på ett ställe för alla blad den ligger på

Mellanstor; stämplarna återanvänder mallbladen.

*Byggd (23 oktober), format 11, med Carl Augusts DXF *skalstockar till
cad-apa* som facit. Skalstocken (`ScaleBar`) och stämpeln (`Stamp`) är
element på bladet, så markera, flytta, ta bort, ångra och kopiera fungerar
som för det andra på bladet. En stämpel är ett arbetsblad med `stamp`,
ritat i mm kring nollpunkten. Claudes val, att stämma av: skalstocken är
alltid 100 mm (längd och indelning går inte att ställa in; hans tolv skalor
som de är, andra skalor efter den med samma siffror, t.ex. 1:200 som 1:2000,
annars jämna tal); den hämtar skalan från bladets första vy när den läggs
på; den läggs med linjen 230 mm från papperets högerkant och 40 mm upp
(x 611 på A1, som hans ram) på alla format; texthöjd 3 mm och linjer 0,7,
0,35 och 0,18 som i DXF:en (texten 0,25); skalstockar och stämplar går bara
att flytta (inte vrida, spegla eller kopiera med smartmenyn); en stämpel
läggs med nollpunkten nere till vänster innanför ramen eller där man
högerklickade; stämplar ritas över vyerna; en stämpel i en stämpel ritas
som en streckad ruta (så att en stämpel inte kan rita sig själv).*

### 0.8.13 Fler Modifiera-verktyg

*Var 0.8.8; flyttad efter bladversionerna (20 oktober).*

Carl August bad om egna förslag på verktyg som finns i motsvarande program
(Archicad, Revit, AutoCAD). Varje verktyg får en plats i smartmenyn och
Modifiera-raden (`RAIL` i `src/ui/modify/ops.ts`) och ett kortkommando.
Förslag, att stämma av först:

- **Trimma**: kapa en vägg eller linje mot en annan (motsatsen till Förläng)
- **Hörnskarv**: två väggar som inte möts förlängs eller kapas till ett
  rent hörn (Archicad *Skär*, Revit *Trim/Extend to Corner*)
- **Dela**: dela en vägg eller linje i en punkt utan att lägga till ett hörn
- **Justera**: lägg flera objekt i linje med en kant eller ett objekt, och
  **Fördela** dem med lika avstånd
- **Hämta och överför inställningar** (pipetten): ta typ, höjd och liv från
  ett objekt och ge dem till det markerade (Archicad *Hämta/Överför*,
  Revit *Matcha egenskaper*)
- **Skala**: för 2D-element, möbler och underlag, med en faktor eller två
  punkter
- **Förläng till** och **Trimma** för flera markerade samtidigt mot en
  gräns
- **Avrunda** och **Fasa** för hela markeringen: alla hörn mellan de
  markerade väggarna på en gång (flyttat från 0.8.5)
- **Kortkommandon för alla Modifiera-verktyg**. De flesta enkla bokstäver är
  tagna (V, H, W, D, O, R, M, L, T, I, F, G, S, P, N, Z), så förslaget är
  Shift + bokstav, t.ex. Shift+M Flytta, Shift+R Vrid, Shift+S Spegla,
  Shift+U I rad, Shift+E Sträck, Shift+X Förläng, Shift+F Avrunda, Shift+C
  Fasa, Shift+O Förskjut, Shift+P Parallell kopia, Shift+W Ny vägg härifrån.
  Visas i tipsen och i listan över kortkommandon. Bestäm listan med Carl
  August innan det byggs (Ctrl-kombinationer krockar med webbläsaren)
  (flyttat från 0.8.5). Shift+Z (förra zoomen) och Shift + piltangenterna
  (knuffa) är redan tagna

- **Linjetjocklekar som i "gammel-cad"** (Carl August, 20 oktober): när
  man väljer tjocklek visas en översättningstabell med färgfält, och ett
  klick på en rad använder tjockleken: grå 0,13; cyan 0,18; röd 0,25; grön
  0,35; svart 0,5; magenta 0,7; blå 1,0; gul 1,4
- **Dra och släpp till mappar** (Carl August, 20 oktober): vyer, ritningar
  m.m. dras till mappar i projektträdet

- **Flytta och Vrid från en snäppunkt** (Carl August, 21 oktober): ett
  slumpmässigt klick på objektet är ingen baspunkt. Klickar man på en
  ändpunkt, ett väggliv eller en referenslinje snäpper baspunkten dit;
  annars ber verktyget om en punkt eller linje. Gäller också att vrida en
  bild, så att den kan riktas exakt mot snäppunkter
- **Dela en mätning i segment** (Carl August, 21 oktober): efter en mätning
  (utan Tab) skriver man ett tal, och Enter tonar mätlinjen och lägger
  tillfälliga snäppunkter i skarvarna, tills man väljer *Rensa
  segmentpunkter*. Blir 0.8.13 för stor tas detta i en egen småversion

Stor med kortkommandona: blir det för mycket görs kortkommandona och
Avrunda/Fasa för hela markeringen först, och resten (med tjocklekstabellen
och dra och släpp) i en egen småversion.

*Byggd (23 oktober), samma format (11). Carl August valde (23 oktober) att
dela versionen: här Trimma, Hörnskarv, Dela, Avrunda och Fasa för hela
markeringen, Flytta och Vrid från en snäppunkt och kortkommandona; resten i
0.8.14. Claudes val, att stämma av: kortkommandona (Shift+M Flytta, R Vrid,
S Spegla, U I rad, O Förskjut, P Parallell kopia, A Förskjut alla kanter,
W Ny vägg, E Sträck, X Förläng, T Trimma, J Hörnskarv, I Lägg till punkt,
K Flytta punkt, Q Ta bort punkt, D Dela, B Böj, G Båge med tangent, L Räta
ut, F Avrunda, C Fasa); att Trimma tar bort biten man klickar på (väggar
mot andra väggars referenslinjer, 2D-linjer mot allt som går att snäppa
till) och att ett verktyg avslutas efter ett klick; att Hörnskarv och
Trimma bara gäller raka väggar, linjer och öppna polylinjer (Hörnskarv bara
raka linjer); att Dela är ett eget val fast Lägg till punkt också delar; att
baspunkten också gäller Spegla och I rad, och att den snäpper mot det
markerades konturer (en bilds hörn); att Avrunda alla hoppar över hörn som
inte går och säger hur många. Dessutom: publicering på webbhotellet med FTP
vid varje push till main.*

### 0.8.14 Modifiera-verktyg del 2

Det som blev kvar av 0.8.13 (Carl August, 23 oktober). Dra och släpp till
mappar och mätning i segment flyttades till 0.8.18 (24 oktober).

- **Justera och Fördela** flera objekt mot en kant eller ett objekt, med
  lika avstånd
- **Hämta och överför inställningar** (pipetten)
- **Skala** för 2D-element, möbler och underlag, med en faktor eller två
  punkter
- **Förläng till och Trimma för flera markerade** samtidigt mot en gräns
- **Linjetjocklekar som i "gammel-cad"**: tabellen med färgfält (grå 0,13;
  cyan 0,18; röd 0,25; grön 0,35; svart 0,5; magenta 0,7; blå 1,0; gul 1,4)

*Byggd (24 oktober), samma format (11). Claudes val, att stämma av:
Justera visar sex knappar (vänster, mitt, höger, över, mitt, under) mot
markeringens yttersta kant och två för Fördela (lika mellanrum, de yttersta
ligger still); ett klick på en linje lägger varje objekt med sin närmaste
kant mot den, och på en vägg används livet som vetter mot objekten.
Pipetten tar typen och allt som inte är form eller läge, bara till objekt
av samma slag (möblernas mått räknas som form). Skala gäller 2D, möbler,
underlag, fria mått och texters läge, inte väggar, tak och rum, och
textens höjd ändras inte. Förläng alla och Trimma mot gräns behöver minst
två väggar eller linjer; Förläng tar änden närmast gränsen och når den
inte någon bit av gränsen används gränsens förlängning; Trimma hoppar över
det som har båda ändarna på samma sida. I Modifiera-raden ligger de under
Förläng och Trimma: Shift+X väljer Förläng alla när flera är markerade,
Shift+T behåller den gamla Trimma. Kortkommandon: Shift+N Justera, Shift+H
Hämta och överför, Shift+Y Skala. Tabellen fälls ut från pennvalet både när
man ritar och i egenskaperna.*

### 0.8.15 Granskning

Förra granskningen var 0.8.11, och Modifiera har fått två versioner nya
verktyg sedan dess (Carl August, 24 oktober). Underlag och versionerna
efter flyttades ett steg.

- **Register** för väggarnas ändar och för dörrar och fönster per vägg,
  så att hörn, anslutna väggar och öppningar inte söks i hela projektet för
  varje vägg
- **`src/ui/modify/tool.ts` uppdelad** per grupp av val, och den småkod som
  fanns på flera ställen samlad
- Justera mot linje klarar mycket stora DXF-underlag
- Prestandatestet får Modifiera-verktygen med 1 200 väggar
- Tabellen *Klart* får 0.8.13 och 0.8.14

*Byggd (24 oktober), samma format (11). Uppdelningen gav samma läge efter
samma klick som förut (45 förlopp med 250 steg genom alla val i Modifiera, i det gamla och
det nya bygget), och kärnans funktioner gav samma projekt i 1 982
jämförelser. Med 840 väggar: musen i Avrunda alla 0,5 s → 0,05 s per
rörelse, hörnen i smartmenyn 0,6 s → 5 ms, Förskjut alla 0,34 s → 0,03 s,
Spegla och Vänd 0,27 s → 0,02 s, Justera 0,34 s → 0,01 s och Förläng alla
0,13 s → 0,01 s. Förskjut alla kanter flyttar nu bara ändar på väggar på
samma våning. Mätt men lämnat: att markera 840 väggar tar 0,15 s, nästan
allt i webbläsarens ritning av markeringen.*

### 0.8.16 Underlag

Carl Augusts synpunkter 21 oktober. Mellanstor, kan bli stor; i så fall
delas den.

- **Snäpp i DXF-underlag**: ändpunkt, mittpunkt, längs linjer och de andra
  vanliga
- **Parallellt och vinkelrätt**: känner man med muspekaren på en linje
  medan man ritar kan man rita parallellt med eller vinkelrätt mot den, som
  i SketchUp (Carl August 22 oktober)
- **X och Y** för att placera ett underlag, som kan ändras senare i
  egenskaperna och smartmenyn
- **Papperskorg** i egenskaperna och smartmenyn för ett markerat underlag
- **Underlagen i trädet** grupperas per filtyp, med en symbol för typen
  framför rubriken, och ett underlag som ligger på flera ställen visas som
  en grupp som fälls ut med en rad per instans
- **Bildens grepp**: en markerad bild får grepp i hörnen (som också är
  snäppunkter) och på sidorna. Hörnen skalar proportionellt, sidorna
  sträcker åt det hållet. Bredd och höjd kan skrivas in i smartmenyn och
  egenskaperna, med *Återställ proportioner* bredvid

*Byggd (24 oktober), samma format (11): bildens sträckning ligger i
`size`, så ingen ny parameter behövdes. Claudes val att fråga om: X och Y
är nedre vänstra hörnet (också för DXF, inte filens nollpunkt); bredd och
höjd i fälten sträcker en bild var för sig (DXF skalas av bredden som
förut); Shift i ett hörn sträcker fritt; linjen man kände på glöms vid
byte av verktyg; linjer i 15°-steg ger inget eget parallellt-lås (vinkellåset
tar dem); skärningar gäller alla linjer, också väggarnas. Gruppen i trädet
är hopfälld från början, och underlag i mappar ligger kvar i sina mappar
som förut.*

### 0.8.17 Rumsstämpeln

Småversion (Carl August, 21 oktober); fler småsaker kan läggas till.

- Rumsstämpeln kan dras till en annan plats i rummet. Dras den utanför
  rummet visas en pil från stämpeln in i rummet

*Byggd (24 oktober), samma format (11): stämpelns läge är den valfria
parametern `labelAt` i rummet. Claudes val att fråga om: man drar i
stämpeln på ett markerat rum (omarkerat flyttar ett drag rummet som förut);
läget är en fast punkt i modellen, inte relativt rummets mitt, så stämpeln
står kvar när väggarna flyttas men följer med när rummet flyttas; pilen går
till närmaste punkt på rummets kant och 2 mm in, med öppen pilspets och
tunn linje (0,18), utan snäpp när stämpeln dras; *Stämpeln i mitten*
lägger tillbaka den.*

### 0.8.18 Småsaker

Carl Augusts synpunkter 20–22 oktober (sorterade 24 oktober).

- **Dra och släpp till mappar** i projektträdet: vyer, ritningar m.m.
- **Dela en mätning i segment** med tillfälliga snäppunkter (skriv ett tal
  efter mätningen; Enter lägger punkterna tills man väljer *Rensa
  segmentpunkter*)
- **osifont** som standardtypsnitt (https://github.com/hikikomori82/osifont),
  krediterat under *Om*, med en länk till projektets GitHub där
  (versionsnumret vid alfa-knappen kom redan 24 oktober)
- **Autospara till fil**
- **Rutnätet** visar rätt nivåer: 500-strecken syns när de ska, och
  0,1 m-strecken kommer när de går att läsa

*Byggd (24 oktober), samma format (11). Claudes val, att stämma av:
rutnätet ritar alla nivåer samtidigt, tonade efter avståndet på skärmen
(in mellan 4 och 16 px, starkare med finare linjer emellan), i en färg i
stället för två. Dela i segment delar hela mätningen (alla klickade
sträckor) i lika delar; ett tal medan måttbandet är aktivt går till fältet
*Dela i*. Segmentpunkterna gäller vyn de lades i, sparas inte i projektet
och rensas för alla vyer på en gång; de ritas som små kryss i accentfärgen.
osifont gäller all ritningstext (ingen inställning för att välja ett annat
typsnitt); fet text är osifont med ett tunt streck, eftersom osifont bara
har en vikt; tecken som saknas (” “ … m.fl.) byts mot " och ... Autospar
till fil är på från början, skriver 2 s efter senaste ändringen och bara
till en fil som sparats eller öppnats i den här sidladdningen. Dra och
släpp: ett släpp på en rad inuti en mapp lägger i mappen, utanför alla
mappar läggs utanför; markerade blad och underlag följer med.*

### 0.8.19 2D-form · *nytt format*

Carl August 22 oktober. Mellanstor till stor.

- 2D-linjen görs om till en **2D-form**. Linje, rektangel, cirkel m.fl. blir
  sätt att rita formen. Formen kan ha linjetjockleken 0 och ändå gå att
  klicka på längs den osynliga linjen
- **Fyllningen** anges på formen som på det tidigare fyllningsobjektet, som
  tas bort; formen behöver inte vara sluten för att få en fyllning (som i
  Illustrator)
- Mitten går bara att klicka på om formen har en fyllning. Det ersätter
  0.8.11:s regel att en sluten polylinje går att klicka inuti

*Byggd (24 oktober), format 12. Claudes val, att stämma av: objektet heter
*2D-form* och sättet att rita *Rita* i verktyget och *Ritad som* i
egenskaperna (det går inte att byta i efterhand, utom att en ny punkt gör
en linje till polylinje som förut). Fyllningen väljs redan i verktyget,
förvalt *Ingen fyllning*; en rak linje får ingen. Fyllningar ritas under
väggarna och formens linje över, som de två gamla objekten. *Ingen linje*
är första raden i tjocklekstabellen; en form utan linje och fyllning syns
inte alls (bara när den markeras eller med *Visa dolda 2D-element*). Den
gamla fyllningens *Kontur* ersattes av formens penna. I Visa är 2D en
kategori, *2D-former*: fyllningar går inte längre att släcka för sig.
Mönstren i verktygsraden visas utan namn (namnen i en tipsruta).*

### 0.8.20 Kommandoraden, del 1

Carl August 24 oktober: skriva kommandon som i AutoCAD (och smartshell i
Sisyfos). Stor, därför två versioner. Efter 2D-formen, eftersom kommandona
för linje, rektangel och cirkel ska byggas mot den.

- Ett **register över kommandon** med namn och förkortningar, både
  AutoCADs engelska (L, PL, M, CO, TR …) och svenska. Verktygsknapparna och
  smartmenyn använder samma register
- **Kommandoraden** nere under ritytan, som i AutoCAD. **Enter** utan att
  ett kommando är igång öppnar den; Enter i ett verktyg avslutar som förut.
  **Mellanslag** kör senaste kommandot igen
- Fältet kompletterar medan man skriver och har en rad under sig som säger
  vad Enter gör, som i smartshell
- **Avstånd och koordinater** i ritverktygen: `2400`, `@1200,600`,
  `@3000<45`, `x,y`

*Byggd (24 oktober), samma format. Carl August bad att raden skulle heta
smartshell, med samma blixt som i Sisyfos. Claudes val, att stämma av:
raden ligger under ritytan (inte under projektträdet och egenskaperna) och
är två rader hög (fältet och raden om vad Enter gör); ramen pulsar bara
när den har fokus. Kortkommandona med en bokstav (W, D, L …) finns kvar,
så kommandon skrivs efter Enter; men en siffra, `@`, `#` eller `<` i vägg-,
2D- och måttverktyget går direkt till raden (där var 2, 3 och 4 förut
vyläget). Mellanslag är Enter i ett kommando som pågår, som i AutoCAD.
Enter i ett tomt fält kör senaste kommandot igen. Ett kommando för det
markerade utan markering ger ett tips (att välja objekt efteråt kommer med
prompterna i 0.8.21). `x,y` och `d<v` utan @ räknas från projektets
nollpunkt; ett avstånd tar markörens riktning, eller den låsta vinkeln.
`2,4m` är ett avstånd med decimalkomma, inte en punkt. *Kopiera* (`CO`)
är *Kopiera i rad*, och *Hörnskarv* fick `CORNER` och `JN` (AutoCADs
`JOIN` gör något annat). Kommandona i tak-, sektions- och fasadverktyget
tar inte emot skrivna punkter än.*

### 0.8.21 Kommandoraden, del 2

- Varje verktyg frågar efter nästa steg, med alternativen inom
  hakparentes (`[Stäng/Ångra]`), och alternativen går att skriva eller
  klicka. Modifiera-verktygen också
- **Historik** över kommandona (F2), och **högerklick** visar en kort
  historik där ett klick kör kommandot igen (flyttad från 0.8.18, samma
  register)
- Kommandoraden blir en **flyttbar panel** som kan dockas nere eller uppe
  eller ligga fritt över ritytan
- Skrivna punkter också i tak-, sektions- och fasadverktyget, och i
  Modifiera (Flytta `@1200,0`)

*Byggd (24 oktober), samma format. Carl August bad att den gula texten
vid blixten skulle heta SMARTSHELL i stället för KOMMANDO; verktygets namn
står nu först på raden under, framför frågan. Claudes val, att stämma av:
alternativen skrivs med en understruken bokstav (Å för Ångra, ML och MV
för mitt lodrätt och vågrätt i Justera) eller början av ordet, och Enter;
medan något ritas går den bokstaven direkt till raden (S är då Stäng, inte
snäpp), annars är bokstäverna kortkommandon som förut. Enter i ett
verktyg avslutar fortfarande direkt, så *Avsluta* är detsamma som Enter.
Taket visar Sadeltak/Pulpettak också innan första klicket. Ett kommando
för det markerade utan markering byter till Markera och väntar; Enter,
mellanslag eller [Klar] kör det. Historiken (F2) är en ruta ovanför raden
med de senaste 200 raderna, och bara kommandon går att klicka på.
Högerklick i ritningen visar de sex senaste kommandona; med något
markerat bara de för det markerade, utan markering de andra. Raden flyttas
genom att dra i blixten; släppt inom 48 px från ritytans över- eller
underkant dockas den där, annars ligger den fritt (högst 720 px bred) och
läget sparas som andel av ritytan. I Modifiera går siffror till värdefältet
som förut (med förhandsvisning) när valet har ett värde, utom medan
baspunkten väntar; ett tal på raden är då värdet (Vrid 90), inte ett
avstånd. Trimma, Hörnskarv, Förläng och Justera tar inte emot skrivna
punkter (de klickar på objekt), inte heller Skala och måttbandet.*

### 0.8.22 Granskning

Carl August 24 oktober: granskningen efter kommandoraden. Utan nya
funktioner: städa, dela upp stora filer (`selectTool.ts`, `app.ts`,
`actions.ts`) och leta efter långsam kod. Förra granskningen var 0.8.15.

### 0.9 Flera våningsplan och bjälklag · *nytt format*

*Framflyttad från 0.14.*

- Våningsplan med egna nivåer och höjder; nytt, byt namn, ta bort, kopiera
  väggar till ett annat plan
- Planvyer per våning, och visa våningen under tonad
- Bjälklag: kontur (ritad eller ur ytterväggarna), tjocklek, håltagning
- Fasader, sektioner och 3D visar alla våningar; mått för fri höjd och
  bjälklag i sektioner
- Fel (synpunkt 20 oktober): ändras golvnivån flyttas konturerna och
  karmarna i 3D, men inte ytorna och fönsterhålen

### 0.10 Tak · *nytt format*

Ett riktigt tak i stället för testtaket:

- Tak och andra volymer ovanför planets snitt ritas punktstreckade i planen
  (synpunkt 20 oktober). Grunden för "ovanför snittet" kan behövas redan i
  0.9 med flera våningsplan

- Referenslinje som polygon; varje kant är takfot eller gavel
- Lutning per takfall, taksprång vid takfot och gavelsprång vid gavel
- Språngets tjocklek separat från takets
- Takfotens snitt: vinkelrätt mot takytan (förval), lodrätt eller egen vinkel
- Snabbval för sadeltak, pulpettak och valmat tak
- Ändra takets form i planen med Modifiera (finns för konturen sedan 0.7.1)
- Medelmarknivå utan terräng: markhöjder anges runt huset och medelmarknivån räknas ut enligt PBF
- Byggnadshöjd enligt PBF (medelmarknivå och 45°-planet)

Enfallstak som delar som sätts ihop väntar till efter pilotprojektet.

### 0.11 Trappor · *nytt format*

- Rak trappa och trappa med vilplan eller sväng (L och U), med steghöjd och
  stegdjup som räknas ut från våningshöjden
- Trappan i plan med snittlinje och gångriktning, i sektion och i 3D
- Håltagning i bjälklaget och enkelt räcke

### 0.11.1 Profilverktyget · *nytt format*

Carl August 22 oktober; före piloten (24 oktober). Stor.

- Man ritar en profil och sedan en referenslinje, och profilen följer
  linjen. Ett verktyg i stället för Archicads flera (pelare, balkar,
  räcken): man anger om profilen är generell eller en byggdel (pelare,
  balk, yttervägg …)

### 0.11.2 Dörrar och fönster

Carl August 22 oktober. Stor; delas om det behövs.

- Redigerbara foder
- Fler öppningssätt för dörrar: skjutdörr, pardörr, vikdörr,
  pendel-/svängdörr och pivådörr. För fönster: över-, under- och
  sidohängda, vertikal och horisontell pivå, skjut- och vikfönster
- Om det ryms (annars efter piloten): dörr- och fönsterhandtag, flera
  bågar och luft i höjd och sida, spröjs

### 0.12 Export: IFC och DXF

- IFC4-export med egen skrivare: våningsplan, väggar, öppningar, dörrar,
  fönster, rum, bjälklag, tak och trappor, med egenskaper (t.ex.
  Pset_DoorCommon) och uträknad åtgärd i Status. Kontrolleras i Archicad och
  i en gratis IFC-visare
- DXF av vyer och blad, med lager per objekttyp
- Areor för bygglov (BTA, BYA, OPA) ur modellen, så långt piloten behöver

### Koordinater, SWEREF och sol (egen version efter 0.12, stor)

Carl Augusts synpunkter 20 oktober; före eller efter piloten bestäms när
0.12 är klar.

- Startar man ett projekt från Höjdkurvor får projektets origo en lokal
  nollsymbol med koordinater inklusive Z = 0, vilket SWEREF som gäller och
  en norrpil mot sann nord. Det ska följa med vid export av modellfiler.
  Fråga: behövs en funktion för att ändra Z, eller går det att rita på
  t.ex. Z = 1000 i motorn?
- Lokal nollpunkt och SWEREF kan också anges för hand
- Har projektet SWEREF kan planmodellen och IFC exporteras i SWEREF, utöver
  lokal nolla (som är förval)
- Sol och skugga hämtas ur SWEREF-koordinaterna; datum och tid anges per vy
  (plan, sektion, fasad och 3D)

### 0.13 Pilotprojektet (proof of concept)

- Carl August ritar själv ett hus, helst ett av sina egna inlämnade bygglov
  (gärna en 1½-plansvilla eller en tillbyggnad), i cad-apa, från underlag
  till plottade blad. Situationsplanen ritas på kommunens grundkarta som
  DXF-underlag; terrängen väntar
- Varje gång något saknas eller måste fuskas skrivs det ner, och tiden
  jämförs med Archicad
- Det som stoppar piloten åtgärdas i småversioner; resten sorteras in under
  *Efter pilotprojektet*

### Inbjuden alfa

- När det piloten visade är åtgärdat bjuds några arkitektvänner (gärna
  ensamföretagande) in att prova. Den heter alfa, inte beta, eftersom man
  ännu inte kan rita ett helt hus
- Deras synpunkter samlas och arbetas in i småversioner. Formatet är inte
  fruset än: en alfatestares fil kan behöva ritas om efter en uppdatering,
  och det ska de veta från början

### Öppen beta och formatfrys

- När alfans synpunkter är inarbetade blir det en öppen beta som får
  spridas fritt. Etiketten i appen blir *Beta*
- Formatet fryses: från och med nu får varje formatändring en migrering och
  ett test som öppnar en fil i det gamla formatet

## Efter pilotprojektet

Allt här är bestämt och ska byggas, men ordningen och versionsnumren sätts
efter pilotprojektet. Det som piloten visar behövs tidigt går först.

- **Kulör, yta och material för alla objekt** (Carl August 22 oktober).
  Behövs fasadkulörer i bygglovet flyttas en enkel kulör per yta upp

### Grafik och markörer (från 0.8 del 3)

- Flera blad i en PDF
- Gör om ett DXF-underlag till 2D-objekt (linjer och texter), i appen
- Mallblad och stämplar mellan projekt: spara som fil och lägg in i ett annat projekt
- En andra 2D-ruta: planen bredvid en öppen sektion eller fasad, där det man markerar i den ena markeras i den andra
- Ritningshuvud enligt BEAst, som ett färdigt mallblad

Grafik:

- Penntabell i stilmallen: linjetjocklek och färg per sorts linje (hål, karm, båge, foder, sammanfogningar, glas, öppningssätt, marklinje …). I dag gäller fasta värden: 0,13 skraffering, glas och sammanfogningar; 0,18 mått, foder, möbler och detaljer; 0,25 karm, båge, dörrblad och konturer bortom; 0,35 hålens omfattning och fasadkonturer; 0,5 bärande snitt; 0,7 marklinje och sektionslinjens ändar
- Klicka på en glasmarkering för att ge den en egen stil i egenskaperna
- Typsnitt: ett för hela projektet och eget per objekt
- Öppningssätt för fönster: fast, sidohängt (vänster/höger), överkantshängt, underkantshängt, vridfönster. I dag har bara dörrar öppningssätt

Markörer:

- Stilar för fasad-, sektions-, norrpils- och taklutningsmarkörer som smartobjekt med smarttext, t.ex. `{sektion}` och `{ritningsnummer}`
- Sektionsmarkörens bokstav och pilar kan flyttas längs linjen
- Markörer per tillstånd (i dag finns de i alla)
- Sektion begränsad till linjen eller oändlig åt sidorna

Vinklar:

- Projektvinklar: 0°, 45° och 90° finns alltid, och egna vinklar kan läggas till (två decimaler, t.ex. 103,50°). Vinkelräta vinklar räknas med. En vinkel kan hämtas från ett objekt. Projektvinklarna används för snäpp och Shift-lås, och varningen för nästan raka vinklar räknar med dem

### Text, ritningsredovisning och dumbs

- Dumbs: snabba fria volymer för skisskedet. Rita en yta, dra upp den till en volym, tryck och dra i sidorna. Dumbs syns i plan, fasad, sektion och 3D som andra former men har inga egenskaper utöver mått och material. Friare formning (följ en bana, böjda ytor) kommer senare
- Textformatering
- Littera som går att flytta
- Handlingsförteckning ur bladen och ritningsnumrering
- Lagerprofil enligt SB11 i DXF-exporten

### Förteckningar och rumsdata

- Rumslista med areor enligt SS 21054 (BOA, BRA, BTA m.m.), med standardens mätregler: väggar inom en enhet, smala nischer och ytor under låg takhöjd. Carl August laddar upp standarden när versionen påbörjas, så att reglerna följer texten
- Dörrförteckning enligt SS 817340 och fönsterförteckning, med förhandsbild
- Ytskikt som styrs av rumsobjektet (innerväggars sidor, ytterväggars insidor, sockel och taklist)
- Rumsbeskrivning
- Export till kalkylblad

### Smartobjekt

- Biblioteksformat för parametriska objekt; reglerna skrivs som uttryck, inte som kod
- Dörrar, fönster och möbler görs om till smartobjekt; möbelverktyget kommer
- Egna smartobjekt kan laddas in i projektet
- Byggaren för smartobjekt: en egen liten app med samma motor

### Smartgrupper

- Smartgrupper: ändrar man en instans ändras alla. För hotellrum och möbleringsgrupper
- Grupper, spegling och "gör unik"

### Tak, våningar och trappor, fortsättning

- Enfallstak som delar som kan sättas ihop
- Fler trappformer (spiraltrappa, fri form) och räcken som eget objekt

### Situationsplan och terräng

- Situationsplan med terräng och höjdkurvor från höjdkurvor.se
- Medelmarknivå, byggnadshöjd och nockhöjd ur markmodellen

### Utbyte med andra program

- IFC som underlag: en IFC-modell (t.ex. konstruktörens) visas i plan och 3D
  via biblioteket web-ifc (MPL-2.0). Den görs inte om till redigerbara
  objekt
- DWG-underlag via LibreDWG (GPLv3, kompileras till WebAssembly), som läses
  in genom samma väg som DXF. Ingen DWG-export: DXF öppnas av alla program
  som läser DWG. Till dess kan DWG göras om till DXF med ODA:s gratis
  filkonverterare
- DXF-underlag: externa referenser och bilder

## 1.0 Bygglovshandling

En villa från nytt projekt till färdig bygglovshandling.

## Avvaktar

- Flyttbara knappar och verktygsrader ("ommöblering"). Avvaktar tills
  gränssnittet har satt sig, och behövs kanske inte alls: ett nytt program
  lärs lika gärna med den arbetsyta som tagits fram för det.
- Vektorsnäpp mot PDF-underlag (0.8 visar PDF som bild).
- Andra språk och andra länders regler. Allt är på svenska och följer
  svenska regler.
- Telefon som ritplattform. En surfplatta med penna för skisser kan vara
  värd att pröva längre fram.
- Skrivbordsapp (Electron eller Tauri), om webbläsaren en dag blir för
  trång eller riktiga filer bredvid projektmappen behövs. Appen är statiska
  filer utan server, så flytten bör rymmas i ungefär en session.
