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
  funktioner: städa, dela upp stora filer (`app.ts`, `propertiesPanel.ts`),
  leta efter algoritmer som växer med kvadraten på antalet objekt och gå
  igenom testerna (dubbletter, tester som låser detaljer, och hela
  körningen under en minut; sedan 0.8.28).

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
| 0.8.21 | Kommandoraden del 2: frågor med alternativ, SMARTSHELL vid blixten, kommandon som väntar på en markering, historik (F2), högerklick, dockningsbar rad, skrivna punkter i tak, sektion, fasad och Modifiera |
| 0.8.22 | Småsaker: Linje är polylinjen, opacitet för linje och fyllning, skraffering i smartmenyn, Visa → Fyllningar, rumsstämpelns mall, sektionspilens hullingar |
| 0.8.23 | Granskning: smartshell, Markera och projektträdets klick uppdelade; klick och hover i planen prövar bara det nära markören; rutnätet ritas inte om vid musrörelser |
| 0.8.24 | Format 13: 2D-formen är en kedja av raka segment och bågar, Böj och Räta ut, ändformer (pil, triangel, punkt …) |
| 0.8.25 | Ritordning (Längst bak … Främst), 2D-formens fyllning och linje framför eller bakom väggarna, fyllning i rum |
| 0.8.26 | Pennor i stilmallen: tjocklek och färg för pilar och markörer |
| 0.8.27 | Granskning: fasaderna ungefär dubbelt så fort, stilmallen, 2D-formens, underlagets och Visas i:s fält, snabbraden, Vrid/Spegla/Kopiera och `app.css` uppdelade |
| 0.8.28 | Rättelser i 2D-formen: fortsätta en markerad linje, fyllningens färg i smartmenyn direkt, en täckande fyllning döljer linjerna under |
| 0.8.29 | Bakgrund i skraffering och korsskraffering (färg och egen opacitet), ändformerna döljs som linjen av en täckande fyllning ovanför |
| 0.8.30 | Sju linjetyper och egna i stilmallen, för 2D-former och pennorna; streckningen längs hela linjen; bakgrunden och fyllningen *Mask* |
| 0.8.31 | Egen penna (tjocklek, färg, linjetyp) för väggar, dörrar, fönster, tak och möbler, i planen, fasaderna och sektionerna |
| 0.8.32 | Granskning: testerna (färre, snabbare, typkontrollerade, referensritningar för 2D-formerna), `dxf.ts` uppdelad, rummen och väggarnas utsida delar sammanslagningen |
| 0.8.33 | Pennor för dörrarnas och fönstrens delar i tre klasser (snitt, vy, symbol), egen penna i två delar, penna per typ |
| 0.8.34 | Rummens kontur med penna i stilmallen och per rum, rumsgränser (*Avgränsar rum* på 2D-former) |
| 0.8.35 | Filtrera och markera: sort, typ, tillstånd, åtgärd, egen penna, egen egenskap och våning |
| 0.8.36 | Egna fyllningstyper (linjefamiljer med streckning), läsa och spara .pat, streckade mönster i DXF-underlag |
| 0.8.37 | Detaljnivå för littera, 2D-symboler och 3D var för sig, färdiga fyllningstyper, linjetjocklek per typ, snabbguide |
| 0.8.38 | Granskning: starkt snedställda mönster (grus, mark) som klippta streck, snabbt och rätt; skrafferingen som mönster; `fillTypes.ts` uppdelad; referensritningar och klick för fyllningstyperna och detaljnivåerna |
| 0.9 | Format 14: flera våningsplan, byta, flytta och kopiera mellan våningar, väggarnas höjd följer våningen, kalkera våningen under och över, alla våningar i 3D, fasader och sektioner |
| 0.9.1 | Format 15: bjälklag med littera och tjocklek per typ, ur väggarna eller ritade, håltagning |
| 0.9.2 | Nivåmarkörer FG, UK bjl, takfot och nock; höjdmått med bjälklagens tjocklek och fri höjd; innerväggarna slutar vid bjälklaget ovanför |
| 0.9.3 | Granskning: fasader och sektioner av samma projekt bygger 3D-modellen en gång; `section.ts` uppdelad; referensritningar och klick för våningar, bjälklag och nivåer |
| 0.9.4 | Format 16: håltagningarna ändras som 2D-former (grepp, punkter, bågar, flytta, ta bort), avrunda och fasa hörn i hål och 2D-former, klickbar bjälklagsyta som inställning |

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

- Brutna sektionsmarkörer
- Fler nivåmarkörer, höjdmått och marklinje mot terräng (med marken, 0.10.3–0.10.5)
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

### 0.8.22 Småsaker

Carl Augusts synpunkter 24 oktober, de enkla (sorterade 24 oktober; han bad
att de skulle göras före granskningen).

- **Fyllningens vinkel och avstånd i smartmenyn**, och **opacitet** för
  linjer och fyllningar, tillsammans eller var för sig
- **Enkellinjen bort**: polylinjen heter *Linje*, och kommandona för linje
  och polylinje leder till samma verktyg
- **Rumsstämpelns ordning** kan ändras (ibland ska numret stå ovanför namnet)
- **Dölj fyllningar** i vyn
- **Sektionspilens hullingar** lika tjocka som vinkeln

*Byggd (24 oktober), samma format (12): opaciteten är två valfria
parametrar. Claudes val, att stämma av: opaciteten är *Samma för linje och
fyllning* från början (ett fält), och kryssrutan skiljer dem åt; den
finns i egenskaperna och smartmenyn, inte i verktyget. 0 % syns inte men
går att klicka på. Smartmenyn visar vinkel, avstånd och opacitet direkt
också för flera markerade former (olika värden står tomma). Rumsstämpelns
ordning är en mall i stilmallen, som litteramallarna (`{namn}`, `{nummer}`,
`{area}`, `TH {takhöjd}` och egna egenskaper): den gäller hela projektet,
inte ett rum i taget, och raden med namnet är den stora och feta.
*Fyllningar* ligger under Visa (2D) och gäller vyn, som det andra där, så
en sparad vy med fyllningarna släckta visas utan dem också på bladen.
Former som ritats som enkellinje finns kvar och heter också *Linje*.
Pilarna gäller sektionsmarkören i planen; rumsstämpelns pil är kvar tunn.*

### 0.8.23 Granskning

Carl August 24 oktober: granskningen efter kommandoraden (efter 0.8.22,
som han ville ha först). Utan nya funktioner: städa, dela upp stora filer
(`commandLine.ts`, `selectTool.ts`, `app.ts`, `actions.ts`) och leta efter
långsam kod. Förra granskningen var 0.8.15.

*Byggd (24 oktober), samma format (12). `commandLine.ts` 868 → 587
rader (läget, historiken, dockningen, frågans text och de direkta
kommandona i egna filer), `selectTool.ts` 699 → 567 (greppen i
`selectGrips.ts`) och `actions.ts` 482 → 343 (projektträdets klick i
`treeClicks.ts`). `app.ts` delades inte, eftersom ordningen mellan
prenumerationerna där styr omritningen. Långsamt som rättades: klick och
hover prövade varje del av varje objekt i planen vid varje musrörelse
(med 3 000 delar i ett underlag 0,85 ms → 0,05 ms, och nu oberoende av
underlagets storlek); rutnätet byggdes om vid varje musrörelse;
`BoxIndex` gav och sorterade allt vid stora frågor; Rikta efter objekt
prövade alla sträckor. Samma klick i 0.8.22 och 0.8.23 (106 steg) gav
samma läge. Mätt men lämnat: snäppningen långt utzoomat över ett stort
DXF-underlag (räckvidden i mm vore ett nytt val).*

### 0.8.24 2D-form del 2 · *nytt format*

Carl Augusts synpunkter 24 oktober (förslag 24 oktober). Stor, kan behöva
delas (segmenten först, ändformerna sedan).

- **Radie per segment**: varje segment i en linje kan vara rakt eller en
  båge med radie, som väggarna
- **Ritsättet är inte låst**: formen är en kedja av segment, och det sätt
  den ritades på (rektangel, båge …) bestämmer bara hur den började
- **Pil i början eller slutet** av en linje, med flera former: pil, öppen
  pil, punkt, cirkel, triangel m.m.

*Byggd (24 oktober), format 13, i en session (inte delad). Formen är en
kedja av punkter med en pilhöjd per segment (`bulges`, som väggarnas),
eller en spline. Claudes val, att stämma av: rektangel, båge och cirkel
finns kvar som sätt att rita men blir kedjor; en rektangel förblir alltså
inte rät när ett hörn dras (som en polylinje i AutoCAD), och en cirkel är
två halvcirklar mellan två punkter på cirkeln (centrumgreppet finns inte
längre; flytta cirkeln med Flytta). När en punkt dras behåller bågarna
intill sin vinkel, så att en cirkel förblir en cirkel. Böj och Räta ut
ligger i Modifiera (samma knappar som för väggar), inte som grepp mitt på
kanten; radien skrivs i Böj. En böjd kant går inte att förskjuta, och
Trimma, Hörnskarv, Dela och Förläng gäller bara raka linjer. Ändformerna:
Pil (fylld, smal), Öppen pil, Triangel (ofylld), Punkt, Cirkel,
Snedstreck och Tvärstreck, alla i linjens penna och färg (heldragna också
på en streckad linje), storlek på papper 2,5 mm. De väljs i egenskaperna
och smartmenyn, inte i verktyget, och bara på öppna former med linje.
Linjen kapas där en pil, triangel eller cirkel täcker den. Delas en linje
behåller den första delen början och den andra slutet. Pennorna för
ändformerna kommer i 0.8.26.*

### 0.8.25 Ritordning och fyllningar

Carl Augusts synpunkter 24 oktober (förslag 24 oktober). Mellanstor;
kanske nytt format.

- **Ritordning**: Längst bak, Bak, Fram, Främst
- **2D-formens linje eller fyllning framför eller bakom väggarna**; som
  nu är förvalt (fyllningen under, linjen över)
- **Fyllning i rumszoner**, med samma inställningar som fyllningar i övrigt

*Byggd (24 oktober), samma format (13), i en session. Claudes val, att
stämma av: ritordningen gäller bland objekt av samma sort på samma yta
(2D-former bland 2D-formerna, underlag bland underlagen); sorterna ritas i
fasta lager som förut (underlag, rumsfyllningar, 2D-fyllningar, väggar,
möbler, rum, 2D-linjer, text …), så en text går inte att lägga bakom en
2D-form. Väggar, dörrar och fönster har ingen ritordning. Bak och Fram
hoppar förbi det som inte överlappar, så att varje klick syns. Knapparna
står i egenskaperna (och under Mer i smartmenyn), i högerklicksmenyn och
som kommandon (`främst`, `fram`, `bak`, `längstbak`); inga kortkommandon.
Fyllningen och linjen väljs var för sig: *Bakom väggarna* eller *Framför
väggarna*, bara i planen (i fasader och sektioner ligger det ritade ovanpå
som förut). En fyllning framför väggarna går före dem också när man
klickar. Vid lika poäng vinner nu det som ritas överst när man klickar
(förut det som ritades först). Rummets fyllning ligger alltid bakom
väggarna och 2D-formerna, ställs in för ett rum i taget och går inte att
klicka i (rummet markeras som förut).*

### 0.8.26 Pennor i stilmallen

Carl Augusts synpunkt 24 oktober (förslag 24 oktober). Mellanstor. En del
av penntabellen under *Efter pilotprojektet*, framflyttad.

- **Linjetjocklek och färg för pilar och markörer** (sektion, fasad,
  norrpil, rumsstämpelns pil, taklutning, mått) m.m., bara centralt i
  stilmallen

*Byggd (24 oktober), samma format (13), i en session. Claudes val, att
stämma av: nio pennor (sektionsmarkör, fasadmarkör, norrpil, rumsstämpelns
pil, taklutning, mått, måttens snedstreck, nivåmarkör, litterans streck) i
en egen del längst ned i stilmallen, med tjocklek ur samma tabell som
2D-formerna och en färg. Färgen gäller också markörens text (sektionens
bokstav, fasadens namn, N, måttal, gradtal, nivåns höjd) och de fyllda
trianglarna; texten behåller sin tjocklek. Svart sparas som *ink* och
följer skärmens tema. Bara det som ändrats sparas (`pens` i stilmallen,
samma tabell som fasadernas linjer), och *Förval* tar bort det. Skalstocken,
stämplarna och rumsstämpelns text har inga pennor. Inga pennor per objekt.*

### 0.8.27 Granskning

Carl August 25 oktober: granskningen enligt planen (ungefär var tredje
version; förra var 0.8.23). Utan nya funktioner: städa, dela upp stora
filer (`styleDialog.ts`, `app.css`) och leta efter långsam kod.

*Byggd (25 oktober), samma format (13). Uppdelat: `app.css` (5 418 rader)
i tretton filer i samma ordning, som ger exakt samma byggda CSS;
stilmallen i `src/ui/style/` (åtgärderna, texterna, pennorna och
färgerna, en fil per del med dess fält och ändringar); `drawingPanel.ts`
436 → 79 rader (2D-formen i `shapeFields.ts`, underlaget i
`underlayFields.ts`, Visas i i `showFields.ts`); snabbradens knappar i
`quickBar.ts` (`propertiesPanel.ts` 654 → 575); Kopiera, Vrid och Spegla
i `core/transforms.ts` (`commands.ts` 714 → 588). Tre oanvända funktioner
borttagna. Långsamt som rättades: rutnätet i de dolda linjerna delade
bredd och höjd i lika många rutor, så att en låg och bred fasad fick rutor
några mm höga och varje vägg hamnade i tusentals; rutorna är nu
kvadratiska och inte mindre än halva den vanliga triangeln. Hela trianglar
innanför sektionens djup klipps inte. Fasaden av 312 väggar med dörrar och
fönster 0,38 → 0,20 s; sektionerna nästan oförändrade. `modelBounds` och
`northAngle` (som anropas flera gånger per fasad när planen ritas) går
igenom elementen utan att bygga listor. Fasaderna och sektionerna i tre
projekt ger exakt samma linjer före och efter, och samma klick i 0.8.26
och 0.8.27 (114 steg: stilmallen, snabbraden, 2D-formens fält, underlag,
fasader och sektion) gav samma läge. Mätt men lämnat: väggarnas
sammanslagning (`union`, ca 0,06 s per fasad med 312 väggar) och
triangleringen.*

### 0.8.28 Rättelser i 2D-formen

Carl Augusts provning 25 oktober (förslag 25 oktober). Liten–mellanstor,
en session.

- **Fortsätta en linje**: klicka på ändpunkten av en öppen 2D-form (också
  med bågar) och rita vidare, som en polylinje
- **Fyllningens färg i smartmenyn** ska synas direkt när formen får en
  fyllning, inte först när den markerats om
- **Det som ligger överst döljer det under**: när en 2D-form skickas fram
  ska dess fyllning också dölja den undre formens linjer, inte bara dess
  fyllning

*Byggd (25 oktober), samma format (13). Claudes val: man fortsätter bara
den markerade linjen (en ny linje är markerad när den ritats), så att man
fortfarande kan börja en ny linje i en annan linjes ände; Ctrl+klick
börjar en ny också i den markerades ände. Knappen *Fortsätt* finns i
snabbraden för en ensam öppen linje eller spline (inte i inställningarna
för snabbknappar). Från början vänds punkterna, bågarna byter tecken och
ändformerna byter plats, så att formen ser likadan ut. Nya kanter är raka;
formens penna och fyllning gäller, inte verktygets. Ångra tar inte bort
formens egna punkter. Smartmenyn ritas om efter ett val i en radioknapp,
kryssruta, färg eller lista (bara skrivfält skyddas), och fyllningens färg
står bland fälten. Det överst: de undre formernas linjer kapas geometriskt
där en senare form har hel fyllning med opaciteten 100 %, eftersom
fyllningarna ligger bakom väggarna och linjerna framför; skraffering och
genomskinlig fyllning döljer ingenting. Bara mellan 2D-former på samma
yta och i samma tillstånd; ändformerna (pilar, punkter) kapas inte, och
markeringen visar hela formen.*

### 0.8.29 Bakgrund i fyllningar och ändformer

Carl Augusts svar efter provningen av 0.8.28 (25 oktober). Liten, en
session; samma format (valfria parametrar).

- **Bakgrund i fyllningar**: en skraffering och en korsskraffering får en
  bakgrund, ingen (förval) eller en färg med egen opacitet, i
  egenskaperna, smartmenyn och 2D-verktyget. Hel fyllning har redan sin
  färg. Gäller också rummens fyllning (samma fält). En bakgrund med
  opacitet 100 % döljer linjerna under, som en hel fyllning (0.8.28). I
  PDF:en och DXF:en en hel fyllning under strecken
- **Ändformerna följer linjen i ritordningen**: de fyllda ändformerna
  (triangel, punkt, pil) och cirkeln döljs av en fyllning ovanför, som
  linjen (pilarnas och strecken linjer gör det redan sedan 0.8.28)

*Byggd (25 oktober), samma format (13). Claudes val: bakgrunden slås på
med en kryssruta och får vit färg från början; opaciteten är bakgrundens
egen och påverkas inte av skrafferingens (eller rummets) opacitet. Den
finns bara för skraffering och korsskraffering och följer med när
fyllningarna släcks i Visa. I verktyget väljs bara färgen (opaciteten i
egenskaperna). Pilen och punkten kapas med en boolesk differens mot de
täckande ytorna ovanför, och deras kontur som linjerna; triangeln och
cirkeln är linjer och kapades redan. En bakgrund döljer inte fyllningen
i en undre form, bara linjerna och ändformerna (fyllningarna ritas i
ritordningen som förut).*

### 0.8.30 Linjetyper och mask

Carl Augusts synpunkter 25 oktober (ordningen bekräftad efter 0.8.29).
Stor men troligen en session; egna linjetyper flyttas till nästa version
om de inte ryms. Grunden för det punktstreckade ovanför snittet i 0.10.

- **Linjetyp** (heldragen, streckad, punktstreckad, prickad m.fl.) för
  2D-former och pennorna i stilmallen. Väggar och andra objekt får sin
  linjetyp i 0.8.31
- **Egna linjetyper**: ett mönster av streck och mellanrum i mm på papper
- **Bakgrunden som mask** (liten): kryssrutan *Bakgrund* ger från början
  en mask, som döljer det under i ritordningen men har ingen egen färg (den
  syns som ritningens bakgrund på skärmen, också i mörkt tema, och som
  papperet i PDF:en). En egen färg går att välja som i 0.8.29. Med
  fyllningen *framför väggarna* (0.8.25) döljer masken också väggar och
  andra modellobjekt; 2D-formernas linjer, fyllningar och masker ska
  kunna ligga framför väggarna (Carl August 25 oktober; finns sedan
  0.8.25 och prövas för masken)
- Kanske: DXF-underlagens streckade linjer ritas streckade

*Byggd (25 oktober), samma format (13). Claudes val: sju inbyggda
linjetyper (heldragen, streckad, kort och lång streckad, prickad,
punktstreckad och streck med två punkter); de egna ligger i stilmallen
(inte i projektet för sig), med nycklarna `egen-1`, `egen-2` …, och
följer med när stilmallen sparas, öppnas (de egna som filen saknar är
kvar) eller byts mot en förinställd. Mönstret skrivs som tal med
mellanslag och decimalkomma; ett streck under 0,5 mm blir en punkt. En
borttagen linjetyp ritas heldragen och står som *Saknas* i listan;
stilmallen visar hur många som använder en egen linjetyp (i knappens
tips). Pennornas linjetyp gäller linjerna, inte pilspetsar, trianglar
och text. Streckningen räknas nu längs hela linjen: en sträcka slutar vid
ett hörn skarpare än 35°, och mönstret töjs så att varje sträcka börjar
och slutar med ett helt streck (en sluten kurva utan hörn får ett helt
antal perioder). Masken är bakgrundens förval (kryssrutan *Bakgrund*), med
*Egen färg* som alternativ i en lista; fyllningen *Mask* är ny. Masken är
ritningens bakgrund, så den döljer också rutnätet. Inte gjort:
DXF-underlagens streckade linjer (ritas heldragna som förut), och DXF-export
finns inte ännu (0.12).*

### 0.8.31 Linjetyp och penna per objekt

Carl Augusts synpunkt 25 oktober. Mellanstor, en session. Bygger på 0.8.30.

- **Egen penna och linjetyp** för de flesta objekt, också väggar, dörrar,
  fönster, rum och tak: *Stilmallens* (förval) eller en egen, för de udda
  fall där standardrepresentationen blir missvisande. I planen, fasaderna
  och sektionerna

*Byggd (25 oktober), samma format (13). Claudes val: pennan är ett eget
fält på objektet (`Element.pen`), inte i typen, med tjocklek, färg och
linjetyp var för sig och *Stilmallens* för varje fält. Den finns för
väggar, dörrar, fönster, tak och möbler; inte för rum, som inte ritar
någon kontur i planen (fyllningen har sin egen färg). Tjockleken gäller
alla objektets linjer, så en dörr med egen tjocklek får samma på blad,
karm och slagbåge. Linjetypen *Heldragen* tar bort stilmallens
streckning (t.ex. på en riven vägg). En vägg med egen penna flyter ihop
med grannarna som förut; konturen delas efter vilken vägg varje kant
kommer ifrån. Texter (littera, rumsstämplar) och fyllningar följer
stilmallen. Inte i smartmenyn och inte för objekt på blad.*

### 0.8.32 Granskning

Enligt planen (ungefär var tredje version; förra var 0.8.27). Utan nya
funktioner: städa, dela upp stora filer och leta efter långsam kod, och
(Carl August 25 oktober) gå igenom testerna: slå ihop dubbletter, ta bort
tester som prövar samma sak två gånger och tester som låser detaljer
utan anledning, och se till att hela körningen tar under en minut (386
tester på ca 17 s efter 0.8.29).

*Byggd (25 oktober), samma format (13). Testerna: 406 → 399, hela
körningen 26 → 12 s i sandlådan. 19 borttagna eller sammanslagna: tio som
sparade ett enskilt fält eller låste formatets nummer (elementen sparas
som de är, så ett test i `core.test.ts` sparar nu ett rikt projekt, ett
prövar stilmallen från fil och ett att äldre format får meddelandet),
dubbletterna av "fyllningen bakom väggarna", sektionspilens tjocklek,
kortkommandona i Modifiera-raden, streckningen per sträcka, L och PL i
kommandoregistret, 30°-dörrarna i Befintligt och öppningarnas markering,
ett svagt prov av ändformerna i planen och ett av bakgrunden som döljer.
De tre proven av att en täckande fyllning döljer linjen under (hel,
bakgrund, mask) är ett prov med en tabell. Tester som låste detaljer
utan anledning är lösare: hela listan med Modifiera-val för en vägg,
exakt åtta linjer i sektionspilen, bokstäverna N, H och Y och ett id.
Nya: stilmallen från fil, två för sammanslagningen och nio
referensritningar. Jämförelserna med den gamla koden (klick och snäpp) prövar
600 och 120 punkter i stället för 5 000 och 400. Hjälpfunktionerna
(`storeWithShapes`, `wallsProject`, `toolHost`, `dxf` …) ligger i
`tests/projekt.ts`, testerna typkontrolleras med `tsc`, och de vanliga
testerna körs utan att koden läses in igen för varje fil
(`isolate: false`; prestandatestet har kvar sin egen process).
Referensritningarna har fått ett projekt med 2D-formerna, linjetyperna,
masken och de egna pennorna, och raden visar mönster, opacitet,
bakgrund, `under` och streckningens fas. Koden: `dxf.ts` 793 → 342 rader
(skrafferingen, texterna och läsningen av koderna i egna filer);
rummens hål och husets ytterkontur tar sammanslagningen av väggarna ur
samma minne (`bareWallUnion`), så att planen efter en flyttad vägg i
`roomGrid(12)` tar ca 57 ms i stället för 70; `pathLength`, typen
`SectionQueue` och rensningen av bladens texter från format 8 borttagna.
Samma klick i 0.8.31 och 0.8.32 (141 steg, nu också linjetyper, mask
och egen penna) ger samma läge. Mätt men lämnat: väggarnas sammanslagning
med öppningar när planen ritas (ca 25 % av omritningen); den går inte att
ta ur sammanslagningen utan öppningar, eftersom en öppning nära en
T-skarv då skulle skära i grannväggen.*

### 0.8.33 Pennor per typ och symbollinjer

Carl Augusts synpunkter 25 oktober (ordningen bekräftad samma dag).
Mellanstor, en session.

- **Pennor för dörrarnas och fönstrens delar** i stilmallen, i tre
  klasser: snitt (väggkontur, karm), vy (dörrblad, fönsterbåge) och
  symbol (slagbåge, öppningssätt). Symbollinjerna tunnare än
  snittlinjerna från början
- **Egen penna i två delar**: *Snitt* och *Symbol*, så att t.ex. en dörr
  kan få en egen tjocklek bara på slagbågen
- **Penna per typ** (YV01, D10 …): objektets egen går före typens, som
  går före stilmallens

*Byggd (25 oktober), samma format (13). Claudes val: klasserna ligger i
stilmallens `pens` (som markörerna) under *Pennor för dörrar och
fönster*, med förvalen snitt 0,25, vy 0,18 och symbol 0,13 mm. Väggens
kontur har sin penna under åtgärderna som förut, så *Snitt* gäller
karmarna. Klassen ger varje del samma tjocklek, så dörrbladen (0,35) och
fönstrens glas (0,25) blev 0,18 mm, och fönstrens bågar och glas i
Detalj ritas lika tjocka. Väggen under fönstret (sedd nedanför snittet)
är kvar på 0,13 utan klass. I fasader och sektioner gäller bara
*Symbol*, för öppningssättet (streckat som förut om klassen inte har en
egen linjetyp); karmar och bågar där har sina pennor som förut. Den
egna pennans två delar heter *Snitt* (karmar, blad, bågar och glas) och
*Symbol*; de är oberoende, så en dörr som fått en egen färg i 0.8.31
har nu slagbågen i stilmallens färg tills *Symbol* också får en.
Väggar, tak och möbler har bara en del. Typens penna (`Definition.pen`)
står under *Påverkar fler objekt* och går fält för fält under
objektets; i objektets fält heter det ärvda *Typens* när typen har
fältet. Knappen under typen heter *Stilmallens penna*, den på objektet
*Typens penna* (eller *Stilmallens* utan typens).*

### 0.8.34 Rum: kontur och rumsgränser

Carl Augusts synpunkter 25 oktober. Mellanstor, en session.

- **Rummens kontur**, med penna i stilmallen och egen per rum (från
  början ingen kontur, som förut)
- **Rumsgränser**: kryssrutan *Avgränsar rum* på en 2D-linje; linjen
  räknas som en vägg när rummen räknas ut, för alkover och öppna
  planlösningar. Med pennan 0 syns den inte

*Byggd (25 oktober), samma format (13). Claudes val: pennan heter
*Rummens kontur* och står under *Penna för rum* i stilmallen, med
förvalet *Ingen linje*. Ett rum och en rumstyp kan få en egen penna,
som väggarna. Konturen ritas under väggarna, så den syns bara mot
öppningar och rumsgränser. *Avgränsar rum* finns för alla 2D-former i
modellen (inte på blad), i egenskaperna och smartmenyn men inte i
verktyget; linjen räknas som en 1 mm bred vägg, förlängd 1 mm i
ändarna, så arean minskar bara med några kvadratcentimeter. Gränserna
gäller också när 2D är släckt i Visa eller formen inte visas i vyn,
eftersom rummen annars skulle ändras med vyn. Ett rum som ritats för
hand (utan klickpunkt) följer inte gränserna, liksom det inte följer
väggarna.*

### 0.8.35 Filtrera och markera

Carl Augusts synpunkt 25 oktober. Mellanstor, en session.

- **Filtrera och markera**: välj sort, typ, tillstånd, åtgärd (befintligt,
  rivs, nytt), våning, egen penna och egna egenskaper (t.ex. brandklass);
  ersätt markeringen, lägg till eller dra ifrån. Sedan ändras alla i
  egenskaperna som förut

*Byggd (25 oktober), samma format (13). Claudes val: en dialog, inte en
panel, som öppnas från huvudmenyn, högerklicksmenyerna och kommandot
`FM` (`QSELECT` och `FILTER` som i AutoCAD); inte från smartmenyns
*Mer*, som visar egenskaperna. *Finns i* kräver alla ikryssade
tillstånd; *Åtgärd* syns bara när vyn jämför. Egenskapens värde ska
finnas i texten, utan hänsyn till stora och små bokstäver, och ett tomt
värde betyder att egenskapen har ett värde. Bara det som syns i
tillståndet räknas; markörerna (fasader, sektioner, norrpil) alltid.
Efter Ersätt eller Lägg till öppnas egenskaperna. Sparade filter ligger
under *Efter pilotprojektet*.*

### 0.8.36 Egna fyllningstyper

Carl Augusts synpunkt 25 oktober; tidigarelagd från *Efter
pilotprojektet* samma dag. Stor, troligen en session. Bygger på 0.8.30:
mönstrens linjer kan vara streckade.

- **Egna fyllningstyper**: ett mönster av en eller flera linjefamiljer
  (vinkel, avstånd, förskjutning och streckning), som ritas lika på
  skärmen, i PDF:en och i DXF:en
- Kanske: läsa in färdiga `.pat`-filer (AutoCAD, ArchiCAD)

*Byggd (25 oktober), samma format (13). Claudes val: typerna ligger i
stilmallen och följer med den (också vid byte till en förinställd), som
linjetyperna. En typ har måtten på papper eller i verkligheten (ett val
per typ, inte per familj). Familjens fält är som i `.pat`: vinkel,
baspunkt X och Y, avstånd, förskjutning och streckning; streckningen
skrivs som linjetypernas (streck och mellanrum, decimalkomma). Ingen
inbyggd typ utöver skraffering och korsskraffering. En 2D-form eller ett
rum med en typ får *Vridning* och *Skala* i stället för vinkel och
avstånd, och kan ha bakgrund; typens penna är 0,13 mm (0,18 mm som
snittfyllning), utan eget val. `.pat` läses in (samma namn byts ut,
över 20 mm mellan linjerna = verkliga mått) och sparas. DXF-underlagens
streckade mönster ritas nu streckade. Linjernas fas räknas från
modellens nollpunkt på skärmen och från papperets i PDF:en, som
skrafferingen förut.*

### 0.8.37 Detaljnivåer och fyllningar

Carl Augusts synpunkter 25 oktober. Detaljnivån väljs per vy, som i
ArchiCAD, med tre val per vy: littera, 2D-symboler och 3D (Carl August
25 oktober). Rikare 3D-detalj (foder, bågar, handtag) kommer med 0.11.2.
Efter 0.8.36 kom tre önskemål om fyllningarna, som lades här.

- **Detaljnivå per del**: varje vy har en nivå (Skiss, Normal, Detalj)
  för litteran, en för 2D-symbolerna och en för 3D
- **Fyllningstypernas linjetjocklek**, per typ i stilmallen
- **Färdiga fyllningstyper**: tegel, lättbetong, betong, trä, plattor,
  mark och sicksack
- **Snabbguide** för egna fyllningstyper i stilmallen

*Byggd (25 oktober), samma format (13). Claudes val: vyradens knappar
sätter alla tre nivåerna på en gång, och de tre valen finns i Visa och
i vyns egenskaper (*Littera*, *2D-symboler*, *3D och fasader*). Med
olika nivåer är ingen av vyradens knappar nedtryckt och knappraden har
en streckad ram. Fasaderna följer 3D-nivån, eftersom dörrarna och
fönstren där ritas ur 3D-modellen; taklutningens symbol följer 2D.
Vyerna sparar littera och 3D bara när de skiljer sig från 2D, så äldre
vyer är oförändrade. Rumsstämpeln följer ingen nivå (som förut).
Typens tjocklek gäller före fyllningens förval (0,13 mm i former och
rum, 0,18 mm i snittytor) och ändras inte av skalan. De inbyggda typerna
går inte att ändra, men att kopiera till en egen; tegel, block och
plattor har verkliga mått, de andra mått på papper. Guiden är en
utfällbar ruta överst bland fyllningstyperna.*


### 0.8.38 Granskning

Enligt planen (ungefär var tredje version; förra är 0.8.32). Utan nya
funktioner. Sist i 0.8 (Carl August 25 oktober).

*Byggd (25 oktober), samma format (13). Testerna: 420 → 424 på ca 10 s.
Det långsamma var DXF-underlag med grus och mark: deras linjer är
förskjutna hundratals linjeavstånd, så mönsterrutan på skärmen blev
nästan 90° sned, och en sådan ruta målar Chrome långsamt (2 000
skrafferingar med grus, mark, tegel och betong: 14 s per omritning) och
fel (prickar i stället för stenar, jämfört med ezdxf). Familjer som är
snedare än 63° (förskjutningen minskad till högst en halv streckperiod
är mer än två linjeavstånd) ritas nu som streck klippta mot ytan
(`clippedDashes`), som stämmer med ezdxf; resten som mönster som förut.
Samma fil ritas om på ca 0,6 s. Av de inbyggda typerna gäller det en av
träets familjer; bilden är densamma. Skrafferingen ritas med mönstrets
kod på skärmen och i PDF:en (samma bild, pixel för pixel).
`fillTypes.ts` är uppdelad (strecken i `hatchStrokes.ts`, `.pat` i
`patFile.ts`), stilmallens pennor läses på ett ställe (`stylePen`),
detaljnivåernas namn finns på ett ställe och den oanvända `typeFill` är
borttagen. Referensritningarna har fyllningstyperna (också tegel som
snittfyllning och en borttagen typ) och detaljnivåerna, skrivna med
0.8.37 innan koden ändrades. Klickjämförelsen har 188 steg (också
fyllningstyperna, pennorna för dörrar, fönster och rum, Filtrera och
markera och detaljnivåerna) och kan jämföra bilder när markupen skiljer
sig (`--bilder`): samma läge och samma bild i 0.8.37 och 0.8.38. Mätt
men lämnat: DXF-underlag ritas om (markup och målning) vid varje
ändring i planen, också när underlaget är detsamma; att spara det
ritade per underlag kräver ett eget lager och är större än en
granskning.*

### 0.9 Flera våningsplan · *nytt format (14)*

*Framflyttad från 0.14. Delad i 0.9, 0.9.1 och 0.9.2, en session var
(Carl August 25 oktober).*

- Ny våning ovanför eller under, med golvnivån räknad från grannen
  (golvnivå + våningshöjd). Byt namn, ändra nivå, ta bort (med objekt
  och vyer, efter fråga)
- Byta våning i projektträdet, med Page Up och Page Down och i smartshell
- Kopiera eller flytta det markerade till en annan våning; dörrar och
  fönster följer väggen
- Väggarnas höjd följer våningshöjden från början, men kan sättas till
  ett eget mått
- Vyinställning i planen: våningen under (eller över) visas tonad
- 3D visar alla våningar, med *Bara den här våningen* som val
- Fasader och sektioner visar alla våningar och hör till projektet;
  linjerna syns i alla planer (att välja våningar väntar till efter
  piloten)
- Fel (synpunkt 20 oktober): ändras golvnivån flyttas konturerna och
  karmarna i 3D, men inte ytorna och fönsterhålen

*Byggd (25 oktober), format 14 (väggens höjd kan saknas och följer då
våningen). Claudes val: en ny våning ovanför flyttar våningarna som
redan ligger ovanför lika mycket (och under likaså), och en ändrad
våningshöjd flyttar dem ovanför, som i ArchiCAD; golvnivån ändras bara
för våningen själv. Nya våningar heter Plan 2, Plan 3 … och Källarplan.
Att ta bort en våning tar bort det som är ritat på den och dess vyer
(också på bladen); fasader, sektioner och det som är ritat i dem finns
kvar. Flytta och kopiera finns i högerklicksmenyn (*Till våning*, en rad
per våning) och smartshell, inte i smartmenyn; kopian finns i samma
tillstånd som originalet. Den tonade våningen är ett val i *Kalkera*
(Våningen under, Våningen över), så den sparas i vyn och har
kalkeringens färg och opacitet; fasad- och sektionsmarkörerna ritas inte
i den. *Bara den här våningen* gäller för användaren, inte vyn.
Norrpilen hör också till projektet. Sektionen får en nivåmarkör för varje
våning (de riktiga nivåmarkeringarna kommer i 0.9.2). Ett tak hör
fortfarande till en våning, och väggarna kapas bara av tak på samma
våning; riktiga tak kommer i 0.10.*

### 0.9.1 Bjälklag · *nytt format (15)*

- Nytt objekt med littera (BJ01 …) och tjocklek per typ
- Ligger på våningen det är golv i: ovansidan i golvnivån, tjockleken
  nedåt. Plattan på mark är bjälklaget i plan 1
- Konturen ritas, eller tas ur ytterväggarna (till väggarnas insida, så
  att väggarna går obrutna golv till golv i sektionen) och följer med när
  de flyttas
- Håltagning, med kryss i planen
- Syns i 3D, fylls som väggarna i sektioner och ritas som kant i fasader
- Rummens tunna golvskiva (30 mm) försvinner där det finns ett bjälklag

*Byggd (25 oktober), format 15 (ny elementtyp `Slab`). Claudes val: en
egen verktygsknapp *Bjälklag* under Rita (`bj`, `slab` i smartshell)
som drar upp en rektangel med två klick, som taket, och *Ur väggarna*
som lägger ett bjälklag innanför ytterväggarna (finns det redan ett på
våningen i tillståndet markeras det). Ytterväggar är de som har inne på
ena sidan och ute på den andra, som för väggarnas utsida; bjälklaget är
husets ytterkontur minus deras massa, så innerväggarna står på det och
fristående väggar ger inget. Kryssrutan *Ur väggarna* i egenskaperna
gör konturen som den är till en ritad kontur (det största stycket), som
sedan ändras med hörn och kanter i Modifiera som takets. Håltagningar är
rektanglar som dras upp med *Håltagning* i verktyget, i bjälklaget under
första hörnet; de listas med mått i egenskaperna och tas bort där (att
ändra ett hål görs genom att ta bort det och rita ett nytt). I planen
ritas konturen med tunna linjer (0,13) under väggarna och hålen med
kryss; konturen är linjer, inte en sluten yta, så ett klick i ett rum
markerar inte bjälklaget (Tab växlar till det vid väggens insida). Ny
typ BJ01 (300 mm) i nya projekt; exempelvillan har BJ01 platta på mark
400 mm. Förvald tjocklek 300. Ingen littera i planen än (bara i
egenskaperna och typtabellen), ingen egen penna, och innerväggar på
våningen under går upp i bjälklaget ovanför (det syns inte i sektionen,
där båda fylls). Marklinjen i fasaderna ligger vid det lägsta, alltså
under plattan (−0,4 i exempelvillan, förut −0,03).*

### 0.9.2 Nivåer · *troligen samma format*

Blir 0.9.1 liten kan 0.9.2 läggas i den.

- Nivåmarkering per våning i sektioner och fasader, automatiskt.
  Relativa nivåer: ±0 är plan 1:s golv. Höjd över havet (RH 2000) kommer
  med koordinatversionen efter 0.12
- Mått för fri höjd och bjälklagets tjocklek i sektioner
- Innerväggar kapas av bjälklaget ovanför (synpunkt 25 oktober)

*Byggd (25 oktober), samma format (15). Beteckningarna valde Carl August
(FG/ÖK/UK). Claudes val: FG vid varje vånings golv och UK bjl vid
undersidan av bjälklag som sektionen skär; ÖK skrivs inte, eftersom
bjälklagets ovansida är golvet. Takfot och Nock som förut men med stor
bokstav och beteckningen före höjden (*FG +2,700*). Fasaderna har bara
FG, takfot och nock (de skär inga bjälklag). Höjdmåttet är en måttkedja
bredvid nivåerna genom bjälklagens under- och ovansidor (tjocklek, fri
höjd, tjocklek …); en översta våning utan bjälklag ovanför får ingen fri
höjd (taket kommer i 0.10). Nivåer närmare än en textrad får texten
uppskjuten. Både nivåer och höjdmått kan släckas under Visa (Markörer).
En vägg räknas som under ett bjälklag när mitten av dess kontur ligger i
det (inte i ett hål); den slutar då vid bjälklagets undersida, också med
egen höjd. Väggar under tak (sned ovansida) kapas inte. Ingen littera på
bjälklag som standard och inga automatiska bjälklag på nya våningar
(Carl August 25 oktober; så var det redan).*

### 0.9.3 Granskning

Enligt planen (ungefär var tredje version; förra var 0.8.38). Utan nya
funktioner. `section.ts` hade vuxit med nivåerna och höjdmåttet,
`storeyShapes.ts` byggde bjälklagen ovanför en gång till med *Bara den här
våningen*, och klickjämförelsen saknade våningar, bjälklag och nivåer.

*Byggd (25 oktober), samma format (15). Testerna: 440 → 444 på ca 11 s.
Skyddet först, skrivet med 0.9.2 innan koden ändrades: ett testprojekt
med två våningar (`twoStoreys`: exempelvillan med väggar, öppningar, rum
och platta på plan 2, en håltagning där sektionen går och taket på plan
2) med referensritningar för plan 2, sektionen, en fasad och 3D, också
med bara plan 1; klickjämförelsen har 223 steg (ny våning, byta, kopiera
till våning, väggens våningshöjd, kalkera, bjälklag ur väggarna och som
rektangel, håltagning, egen kontur, ta bort hålet, släcka nivåer och
höjdmått), och de tre steg som felade likadant i båda byggena är
rättade. Samma klick i 0.9.2 och 0.9.3 ger samma läge och samma bild.
Det långsamma var att varje fasad och sektion byggde hela 3D-modellen
själv: nu sparas de senaste formerna för samma projekt, vy och
stilmall, så att fyra fasader och en sektion av ett hus med tre våningar
à 312 väggar tar ca 3,0–3,6 s i stället för 4,3–4,9 s (också kanterna
räknas fortare, med tal i stället för text som nycklar). Koden:
`section.ts` 519 → 371 rader (nivåerna och höjdmåttet i
`sectionLevels.ts`, snittet genom formerna i `sectionCut.ts`), en
slinga i `modelShapes` i stället för två, materialen som fylls i snitt på
ett ställe (också 3D-vyns lock), och kvarlevorna från före 0.9 (`z0 = 0` i
sektionen och 3D-vyns klippning) borttagna. Testerna för 0.9–0.9.2
använder det gemensamma projektet med två våningar; provet av att
markörerna ritas i alla planer ersattes av referensritningen för plan 2.
Mätt men lämnat: resten av tiden i en fasad är de dolda linjerna
(`visibleSegments`) och sammanslagningarna, som förut.*

### 0.9.4 Bjälklag del 2 · *nytt format (16)*

Synpunkter 25 oktober, efter 0.9.1.

- Håltagningarna får samma Modifiera-verktyg som 2D-formen (lägga till
  punkter, radier, runda av hörn …) och kan ändras, inte bara tas bort
- UI-inställning: om bjälklagets yta är klickbar eller bara kanterna

*Byggd (25 oktober), format 16 (en håltagning är `{ points, bulges? }`
som en 2D-form, inte bara en lista med punkter). Claudes val: hålen är
kvar i bjälklaget, inte egna objekt, och ändras när bjälklaget är
markerat: hörnen får grepp som dras som 2D-formens punkter, och ett klick
på ett hörn eller en kant ger 2D-formens val. 2D-formen hade inte
*Avrunda* och *Fasa*; de finns nu för båda (ett hörn mellan två raka
kanter, förval 500 och 300 mm; för stort ger ett tips), också i
Modifiera-raden (Shift+F, Shift+C). För ett hål finns *Flytta hålet* (från
punkten man klickade) och *Ta bort hålet*; Flytta, Vrid, Spegla och I rad
finns inte i menyn för ett hål, eftersom de gäller hela bjälklaget (klicka
någon annanstans på det). Vrida och spegla ett hål för sig går inte.
Hålets raka kanter ritas som förut och bågarna som korta raka bitar;
krysset går mellan hörnen som förut, och i ett hål med bågar längs den
omslutande rektangelns diagonaler, klippta till hålet. Klickbar yta är en
kryssruta i Gränssnitt under Planen, av från början, och gäller användaren
(inte projektet eller vyn). Ytan är mjuk: väggar, linjer, 2D-former och
rumsstämplar går före, men ytan går före rummen, så ett klick i ett rum
markerar bjälklaget (rummet med stämpeln eller Tab). Två fel rättade:
pipetten förde över håltagningarna och *Ur väggarna*, och speglade hål
behöll bågarnas riktning.*

### 0.10 Tak · *nytt format (17)*

Uppdelat 25 oktober i fem versioner (bekräftat av Carl August). Taket görs
som enkla takfall i stället för en kontur där varje kant är takfot eller
gavel: komplexa tak byggs av flera takfall (Carl August 25 oktober). Det
tar bort den svåra geometrin (vinkelrännor ur en godtycklig kontur).

- Ett tak är ett takfall: en kontur (raka kanter och bågar, ändras som en
  2D-form) och en referenslinje med höjd, lutning och tjocklek. Höjden
  gäller översidan eller undersidan. Referenslinjen kan ligga var som
  helst, även mitt i takfallet; taket fortsätter nedåt på andra sidan
- Referenslinje med radie: taket lutar vinkelrätt mot bågen, så en
  halvcirkel blir en halv kon
- Verktyget: konturen, sedan referenslinjen och sidan som stiger.
  Snabbval över en rektangel: pulpet (ett takfall), sadel (två) och valm
  (fyra), med takfots- och gavelsprång. *Över hela huset* när huset är
  rektangulärt
- Kapa mot tak i Modifiera: ett takfalls kontur kapas där det möter ett
  annat (nock, grat, vinkelränna)
- Taket kapar väggar på alla våningar efter verklig höjd
- Greppen i fasad och sektion (höjd och lutning), taklutningen och
  nivåmarkörerna följer de nya taken

*Byggd (25 oktober), format 17. Claudes val: referenslinjen sparas som
två punkter (`ref`) med pilhöjd (`refBulge`), och taket stiger åt vänster
sett från start mot slut; *Vänd lutningen* byter riktning. Höjden gäller
undersidan från början. Byts valet till ovansidan ligger taket kvar
(höjden räknas om). Konen delas i 64 plana bitar per varv, så att väggar,
3D, fasader och sektioner fungerar som förut; positiv radie i
egenskaperna stiger mot centrum. Snabbvalen dras upp i husets ytterliv
(referenslinjerna där), nocken längs den längre sidan och pulpettakets
takfot på den långsida som första hörnet ligger på; förval 27°, 2700,
takfotssprång 500 och gavelsprång 300. Valmens takfall räknas så att varje
del är där takfallet ligger lägst. *Över hela huset* finns bara när
ytterkonturen är en rektangel (97 % av den omslutande rektangeln).
Kapa mot tak kapar de markerade takfallen längs skärningen med det man
klickar på, förlängd över hela konturen; kvar blir den sida där man
klickade på takfallet (strax innanför kanten), med flera markerade den
största. Kapade kanter blir raka (bågar blir polylinjer). Taket kapar
väggar på alla våningar där det ligger ovanför väggens fot, men Upp till
taket drar bara upp väggar under tak på samma våning (en gavel på plan 1
går inte upp genom plan 2). Nivåmarkören *Takfot* är takets lägsta punkt på
undersidan, som förut (i fasadlivet med byggnadshöjden i 0.10.5). I
fasaden sitter höjdgreppet vid referenslinjen och lutningsgreppet i
punkten längst från den; Shift (nocken still) finns inte längre.
Skarven vid nocken syns inte i 3D och fasader: ett hörn som ett annat
takfall delar, där de fria kanterna ligger på en linje, får ingen
lodrät kantlinje.*

### 0.10.1 Granskning

Före takfoten (Carl August 26 oktober; takfoten blev 0.10.2). Enligt
planen (ungefär var tredje version; förra var 0.9.3).

- Väggar under bjälklag i 3D och sektion (synpunkt 25 oktober)
- Väggar med samma liv på två våningar ska inte ge konturlinjer mellan
  dem i 3D och fasad (synpunkt 25 oktober)
- Bjälklaget kapar väggen där det täcker den, som taket (synpunkt 26
  oktober, sorterad hit av Claude eftersom det är samma kod)

*Byggd (26 oktober), samma format (17). Testerna: 456 → 459 på ca 11 s.
Felet var väggarnas kantlinjer: de slogs ihop per våning (för att
skarvarna inte ska synas) och fick den första väggens id, så att
bjälklagen inte kapade innerväggarnas linjer (de kapades efter id) och
en markerad vägg i sektionen lyste upp alla väggars linjer. Ytterväggarnas
snittyta går golv till golv med flit när bjälklaget är *Ur väggarna*.
Nu delas linjerna efter vilken vägg kanten kommer ifrån, med samma
uppslag som de egna pennorna (`edgeOwners`), så en vägg med egen penna
har den också på sina linjer i fasader och sektioner. Claudes val:
bjälklagen ovanför kapar väggen exakt där de täcker den, i stället för
regeln från 0.9.2 (väggens mitt under bjälklaget), och gäller alla väggar,
också ytterväggar och väggar under tak (där gäller det lägsta av taket
och bjälklaget). Det lägsta bjälklaget ovanför gäller; ett som ligger
högre än väggen gör ingenting. Flisor tunnare än en halv millimeter, där
bjälklagets kant nästan följer väggens liv, räknas inte. Linjen mellan
våningarna tas bort där ovansidan av en vägg och undersidan av en vägg på
en annan våning har samma kant, med väggen på samma sida och samma
åtgärd; den är kvar under en dörr (eller en öppning som går upp till
väggens ovansida) och där väggen ovanför kragar ut. Bjälklagens kanter
ritas som förut, så ett bjälklag ritat till ytterväggarnas utsida syns
som ett band i fasaden. Granskningen: `wall.ts` 572 → 147 rader
(kropparna i `wallBodies.ts`, 3D i `wall3d.ts`); väggarnas bitar slås upp
per vägg i 3D (förut prövades alla bitar för varje vägg); 3D-vyn ritar
alla kantlinjer i en geometri i stället för en per lista; en vägg som
ligger helt i eller utanför ett bjälklag kapas utan boolesk operation.
3D av ett hus med tre våningar à 312 väggar och bjälklag tar ungefär som
förut (ca 0,3 s, några hundradelar mer för kapningen och skarvarna).
Testet för 0.9.2:s kapning är ihopslaget med det nya.*

### 0.10.2 Takfot och taket i planen

Mellanstor. Var 0.10.1 före granskningen.

- Språngets tjocklek separat från takets (språnget är delen utanför
  ytterväggarnas utsida)
- Takfotens snitt per kant: vinkelrätt mot takytan (förval för takfoten),
  lodrätt (nock och grat) eller egen vinkel
- Tak och volymer ovanför planets snitt ritas punktstreckade (synpunkt 20
  oktober), med en snitthöjd per våning
- Vyinställning: byggnadens footprint (ytterväggarnas kontur) som streckad
  linje genom taket i planen (synpunkt 25 oktober)

*Byggd (26 oktober), samma format (17), med valfria nya parametrar. Testerna:
459 → 467 på ca 11 s. Claudes val: taket är en kropp av plana bitar
(`roofBody`) med takets ovansida överallt; undersidan är takets innanför
husets kontur, språngets utanför och snittets i en remsa längs en snett
snittad kant. Väggarna kapas, och 3D, fasader och sektioner ritas, efter
samma bitar. **Takfot** är en kant som vetter nedåt i lutningen (taket
stiger in från den); den snittas vinkelrätt mot takytan från början, och
remsan är tjockleken gånger sin(lutningen) bred (136 mm för 300 och 27°).
Nock, grat, gavel och kanter mot ett annat takfall snittas lodrätt. Ett
vinkelrätt snitt som inte går in under ovansidan (vid en nock) blir
lodrätt. Takfotens snitt väljs på taket (*Vinkelrätt mot takytan*,
*Lodrätt*, *Med vinkel mot det vågräta*, förval för vinkeln 90° minus
lutningen); en kant får ett eget i Modifiera (*Vinkelrätt*, *Lodrätt*,
*Vinkel* med 60° från början, och *Förval* när kanten har ett eget). En
kants eget snitt sparas med kantens två hörn, så det följer med när taket
flyttas, vrids och speglas men glöms när kanten ändras (ett hörn flyttas,
kanten förskjuts, taket kapas). En båge som takfot snittas bit för bit
utan synliga skarvar. **Språnget** är delen utanför husets kontur:
ytterväggarnas utsida på alla våningar, sammanslagen (rummen och gårdar
fylls i, det som rivs räknas inte). Språngets tjocklek är vinkelrätt mot
takytan som takets; samma som takets sparas inte. Vid väggen syns steget i
undersidan som två linjer. **Snitthöjden** är våningens, 1200 mm från
början (förvalet sparas inte); i planen ritas det av konturen som ligger
ovanför punktstreckat, det under heldraget, och snittytan (där höjden
ligger mellan undersidan och ovansidan) får stilmallens snittfyllning och
ritas under väggarna. Ett tak syns i planen för en annan våning när det
når in i våningens höjd (golv till golv), så ett tak på plan 1 syns i
vindsplanet men ett tak på plan 2 syns inte i plan 1. **Husets kontur
genom taket** står under Visa (Modell) och är släckt från början; den
tänds med `+footprint` i vyns `hide`, så att äldre vyer inte får den. Den
ritas streckad (*Streckad*, 0,18) inne i varje takfall och går inte att
klicka på. Nivåmarkören *Takfot* är nu kroppens lägsta undersida (2515 i
stället för 2445 i exempelvillan, där snittet tar takfotens nedre hörn).
Kända begränsningar: där två snittade kanter möts i ett konvext hörn (två
takfötter på samma takfall) tar den första kantens snitt hörnet; ett
vinkelrätt snitt i hörnet mellan takfot och en gavel med vinkel ritas
inte som ett geringssnitt.*

### Marken före piloten (bestämt 26 oktober)

Carl August 26 oktober: marken ska inte behöva anges för hand. Med
platspaketet från Höjdkurvor finns alltid en markmodell, och
medelmarknivån räknas automatiskt, också när marken fylls upp eller grävs
ut runt huset. Därför flyttas terrängen från *Efter pilotprojektet* till
0.10.3–0.10.5, och koordinaterna från *Koordinater, SWEREF och sol*.
Höjderna är riktiga (RH 2000). Den befintliga marken ändras aldrig; den
färdiga marken räknas om ur den och markobjekten, som är fristående och går
att flytta och ändra. Ingen penselmodellering. Skissen skickas inte
tillbaka till Höjdkurvor: analyserna görs i cad-apa (efter piloten).

### 0.10.3 Markmodell · *nytt format (18)*

Mellanstor till stor, en session.

- Ta emot platspaketet från Höjdkurvor (`docs/UTBYTE-CAD-APA.md` i
  hojdkurvor-repot, version 1): `postMessage` med handskakningen och
  `.hkplats.json` som fil. Fråga innan ett öppet projekt ersätts
- Projektet får nollpunkt, SWEREF-zon, vridning och sann nord (norrpilen);
  planen ritas runt nollpunkten, så att stora koordinater inte når 3D-vyn
- Höjder i RH 2000: modellen räknar relativt projektets höjd och visar
  RH 2000 (*FG +114,500*). Utan markmodell som i dag (plan mark)
- Rutnätet sparas för sig (inte som tal i projektets JSON; upp till 1,2
  miljoner punkter) och kan beskäras till ett mindre utsnitt
- Befintlig mark i 3D, som höjdkurvor i planen (förval 0,5 m, val 0,25 och
  1 m; tunna och streckade) och som tunn streckad marklinje i fasader och
  sektioner
- Grannhusen (`byggnader`) som enkla volymer, träd, vägar och stompunkter
- Medelmarknivån räknas automatiskt längs husets kontur, viktad efter
  fasadernas längd, och visas i husets egenskaper och som nivåmarkör
- Fastighetsgränser läses om paketet har dem (fältet finns inte än; står
  på Höjdkurvors lista). cad-apa föreslår fältets form och läser det när
  det finns
- Behöver ett riktigt platspaket att prova mot (Carl August sparar en
  platsfil ur Höjdkurvor; testdata går att göra med Höjdkurvors
  `test/data/make_dtm.py`)

*Byggd (26 oktober), format 18. Provad mot Carl Augusts platsfil
Bosgård (Nybro, 200 × 150 m, 1 m rutnät, Höjdkurvor 0.7.0). Testerna:
467 → 474 på ca 12 s. Claudes val: **Platsen** är ett eget fält i
projektet (`site`: koordinatsystem, nollpunkt, vridning, sann nord,
utsnitt, ±0 i RH 2000, rutnätets mått, källa, licens och gränsvarning);
rutnätets höjder ligger i en fil bland projektets filer (`assets`,
base64 som i paketet), inte som tal i JSON. Modellens origo är paketets
nollpunkt, och zonens koordinater räknas om med Höjdkurvors formler; de
når aldrig planen eller 3D-vyn. **±0** (plan 1:s golv) är markens höjd
mitt i utsnittet avrundad till decimeter från början och ändras i
dialogen *Platsen* (huvudmenyn), där knappen *Medelmarknivån* fyller i
den; nivåmarkörerna i fasader och sektioner skrivs i RH 2000 (*FG +62,600*)
när projektet har en plats, och våningens egenskaper visar golvets
RH-höjd. Grannhus, träd och stompunkter har kvar sina höjder i RH 2000,
så att ett nytt ±0 flyttar huset mot marken. **Det som kommer med
platsen** blir låsta objekt i alla tillstånd på plan 1: *Befintlig mark*
(höjdkurvorna), *Grannhus* (fotavtrycket, i 3D en volym på marken med
registrets höjd, 6 m utan), *Träd* (kronan i plan, stam och krona som
prismor i 3D) och *Kartobjekt* (fastighetsgränser streck-punkt, tunnare
och grå med mer än 1 m osäkerhet som i Höjdkurvor; vägar; gränspunkter;
fastighetens beteckning; stompunkter med höjd). Fastighetsgränserna
läses: fältet `fastigheter` finns sedan Höjdkurvor 0.7.0. Grannhus och
träd syns i 3D-vyn men inte i fasader och sektioner (de skulle fylla
fasaderna med det som står långt bort). **Höjdkurvorna** räknas i
cad-apa ur rutnätet (paketets kurvor används inte), 0,5 m från början
och 0,25 eller 1 m i dialogen; hela meter 0,18 med höjden utskriven,
övriga 0,13, alla grå och streckade, och de går inte att klicka på.
**Marken i 3D** är ett triangelnät (högst 250 000 noder, glesare annars)
utan skuggplanet vid ±0; det räknas inte när 3D-vyn ställer in sig på
huset. **Marklinjen** i en sektion följer linjen; i en fasad följer den
husets kontur närmast betraktaren och utanför huset konturens framkant,
5 m ut på varje sida, tunn (0,18) och streckad. Den tjocka linjen vid
±0 ritas inte när det finns en markmodell (den nya marken kommer i
0.10.4). **Medelmarknivån** är markhöjden längs husets kontur (som
genom taket) i medel per meter, med nivåmarkören *MMN* i fasader och
sektioner och värdet i dialogen. **Ta emot platsen**: Öppna fil, dra
och släpp en `.hkplats.json` på planen, *Uppdatera ur fil…* i dialogen,
och meddelandet från Höjdkurvors flik (`#hojdkurvor-import`, `cad-apa:redo`,
`hojdkurvor:plats`, `cad-apa:mottaget`; godkända ursprung är cad-apas eget,
agrellarkitektur.se och höjdkurvor.se). En fråga följer alltid: *Nytt
projekt* (förval) eller *Lägg i det öppna*; för samma plats (`projekt.id`)
är förvalet *Uppdatera platsen*. Läggs en plats in i ett projekt som
redan har en i samma koordinatsystem behålls nollpunkten, vridningen och
±0, så att huset står kvar, och det som kom med den gamla platsen byts ut.
Norrpilen ställs mot sann nord (rutnätets nord vriden med
meridiankonvergensen). **Beskär** i dialogen skär markmodellen och det
som kom med platsen till en ruta runt huset (30 m från början).
Licenstexten och gränsvarningen står i dialogen. Kända begränsningar:
höjdkurvorna för ett stort och brusigt rutnät (1,2 miljoner noder) tar
ett par sekunder första gången; licenstexten skrivs ännu inte ut på
bladen; skissen tillbaka till Höjdkurvor görs inte (beslut 26 oktober).*

### 0.10.4 Markobjekt del 1

Stor, kan behöva två sessioner.

- Den färdiga marken räknas ur den befintliga och markobjekten (ritordning
  där de överlappar), och räknas om när ett objekt ändras
- **Platå**: kontur med höjd, plan eller med fall; varje kant möter marken
  med slänt (förval 1:2) eller stödmur
- **Platå runt huset**: följer husets kontur och sockel, avstånd ut från
  fasaden och fall från huset (förval 1:20 de första 3 m); följer med när
  huset flyttas
- **Urgrävning**: kontur med bottenhöjd och slänt inåt; en variant följer
  bjälklaget i mark
- Höjdkurvor över färdig mark (tjocka) och befintlig (tunna, streckade);
  marksnittslinjen för ny mark tjock och heldragen i fasader och sektioner;
  jordskraffering under snittlinjen som val (av från början)
- Befintlig mark hör till tillståndet *befintligt*, markobjekten till
  *nytt*: före och efter syns med tillstånden. Medelmarknivån mot färdig
  mark (förval) och mot befintlig
- Schakt och fyll i m³
- Förvalen (lutningar, avstånd) går att ändra i projektet

*Byggd (26 oktober) i en session, samma format (18): en ny elementtyp
gör inte äldre filer oläsliga. Testerna: 474 → 481 på ca 12 s. Claudes
val: **ett objekt**, *Markobjekt* (`Ground`), med sorten i parametrarna:
platå, urgrävning, platå runt huset (`around`) och urgrävning under ett
bjälklag (`slab`). Verktyget **Mark** (Rita) drar upp en rektangel som
bjälklagsverktyget; konturen ändras sedan i Modifiera som bjälklagets.
Platåns höjd föreslås ur marken i rektangelns mitt, urgrävningens en
meter under (avrundat till 50 mm), och skrivs i RH 2000 i egenskaperna.
**Urgrävningens kontur är botten och slänten går utåt** (avsteg från
"slänt inåt", så att urgrävningen under bjälklaget har hela bjälklaget
med arbetsutrymme i botten och samma regel gäller som för platån). **Slänten**
är ett band runt ytan som vidgas med avståndet (d/N över och under
kantens höjd); befintlig mark inom bandet är orörd, annars schaktas eller
fylls den till bandet. En urgrävning tar bara ned. En stödmur ger ingen
slänt (lodrätt mellan två noder i rutnätet); den ritas tjock i planen.
**Platå med fall**: 1:N och riktning, höjden gäller i konturens mitt, och
en pil visar fallet. **Runt huset**: marken vid fasaden en sockel (200)
under objektets våning, fall 1:20 de första 3 m, platån 3 m ut (rundade
hörn); marken under huset rörs inte, utom noderna närmast fasaden.
**Under bjälklaget**: bjälklagets kontur (husets kontur när det följer
väggarna) plus 500 arbetsutrymme, botten i underkanten. Urgrävningar under
bjälklag räknas alltid först (grunden fylls igen av platån runt huset),
övriga i ritordning (Fram och Bak finns för markobjekt). **Förvalen**
(slänt 1:2, fall 1:20, 3 m, 3 m ut, sockel 200, arbetsutrymme 500) står i
*Platsen*; ett tomt fält i egenskaperna följer dem. **Tillstånden**:
markobjekt hör till förslaget; ritas de i Befintligt läggs de i alla
förslag. I ett förslag är marklinjen den färdiga marken, tjock (0,5) och
heldragen, också utan markobjekt (då lika med den befintliga); den
befintliga ritas tunn och streckad bara där den skiljer sig. I
Befintligt som i 0.10.3. Höjdkurvorna för färdig mark (0,25, hela meter
0,35 med höjden) ritas bara där markobjekten ändrat marken; den befintligas
som förut. **Medelmarknivån** mot den färdiga marken i ett förslag, mot
den befintliga som val i *Platsen*, där båda visas; knappen
*Medelmarknivån* för ±0 använder den befintliga (annars flyttar platån
runt huset sig med ±0). **Schakt och fyll** per objekt (det objektet
ändrar efter dem bakom) i egenskaperna och för förslaget i *Platsen*.
**Jord** under marklinjen i sektionerna (fyllningen *Mark*, 600 mm
djup) som val i *Platsen*, av från början. Under Visa heter *Befintlig
mark* nu *Marken*, och *Markobjekt* släcker konturerna (marken räknas
ändå med dem). Kända begränsningar: stödmuren är bara ett språng i marken,
inget eget objekt (0.10.5); jorden ritas också under huset; konturerna
ritas bara som rektanglar med verktyget (Lägg till punkt i Modifiera ger
andra former).*

### 0.10.5 Markobjekt del 2 och byggnadshöjd

Stor.

- **Ramp och gångväg**: mittlinje med bredd och höjder i ändarna eller en
  lutning; sidorna möter marken med slänt eller mur; lutningspil med
  *1:12*; varning när en gräns som ställts in i projektet överskrids (som
  projektvinklarna). Gränserna kontrolleras mot BBR innan de blir förval
- **Infart**: som rampen, bredare och med tvärfall
- **Höjdpunkt och brytlinje**: låser marken i en punkt eller längs en linje
- **Stödmur** som eget objekt längs en linje
- Byggnadshöjd enligt PBF: från medelmarknivån till där fasadlivet skär
  takets översida (för tak brantare än 45° med 45°-planet); `roofBody` har
  översidan. Kontrolleras mot PBF 1 kap. 3 § och Boverkets vägledning
  (takutsprång, beräkningsgrundande fasad) innan den byggs. Nivåmarkör *BH*
- *Upp till taket* är kvar (Carl August 26 oktober); fråga kvar om den går
  före ett bjälklag som täcker väggen

*Byggd (26 oktober) i en session, samma format (18): nya sorter av
`Ground` och valfria parametrar. Testerna: 481 → 491 på ca 11 s. Claudes
val: **Byggnadshöjden** följer PBF 1 kap. 3 § (kontrollerad på lagen.nu):
från medelmarknivån invid byggnaden till skärningen mellan fasadplanet och
ett plan som lutar 45° inåt och berör takets ovansida. Den räknas för
varje fasad i husets kontur som det största z − d över takkroppens
ovansida (d = avståndet inåt från fasaden), så ett flackt tak berörs vid
takfotens yttre kant och språnget höjer byggnadshöjden med sitt mått,
ett tak brantare än 45° vid nocken. Bara taket framför fasaden räknas
(mellan dess ändar, och utanför den bara det som inte står över huset,
högst 3 m ut). **Den beräkningsgrundande fasaden är den längsta** (bland
lika långa den högsta), som oftast är en långsida; en gavel skulle ge
nockens höjd. Undantagen (kupor och frontespiser under en tredjedel av
takfoten, allmän plats närmare än 6 m, en annan beräkningsgrundande
fasad) bedöms för hand och står i dialogen. Boverkets *treplansmodell*
(2016:30) är ett förslag och används inte. Nivåmarkören **BH** i fasader
och sektioner (Visa, Markörer, *Byggnadshöjd*), också utan markmodell;
värdet och fasadens väderstreck i dialogen *Platsen*. **Ramp, gångväg och
infart** är en sort (`path`) med mittlinje (polylinje), bredd (ramp 1 500,
gångväg 1 200, infart 3 000) och höjd i början och slutet, ur den
befintliga marken när den ritas; fältet *Lutning* ändrar höjden i slutet.
Tvärfall 1:N (positivt faller åt höger i linjens riktning; infarten 1:50
från början). Sidorna och ändarna möter marken med slänt eller stödmur.
Planen: konturen, pilen nedför mittlinjen med *Ramp 1:12* och höjderna i
ändarna; en varning (accentfärg och *!* i planen, raden i egenskaperna)
när en ramp är brantare än 1:12 eller går mer än 0,5 m utan vilplan, och
när en gångväg är brantare än 1:20. Värdena kommer ur Boverkets regler om
tillgänglighet (ALM, BBR) via Göteborgs tekniska handbok; paragrafen
kunde inte läsas, så de ska kontrolleras. De går att ändra under
*Platsen*. Vilplan ritas genom att dela rampen i flera. **Höjdpunkt och
brytlinje** låser marken (brytlinjen rakt mellan höjderna i ändarna) och
tonar marken runt omkring mot dem inom 5 m (vikten en S-kurva), ett nytt
sätt i den färdiga marken; de följer ritordningen som de andra.
**Stödmuren** är en linje med tjocklek (200): slänterna och
utjämningen går inte över den, så att marken bakom är orörd. Krönet är
den högre sidans högsta mark längs muren plus *Över marken* (0), eller en
egen höjd; foten 300 under den lägre sidans lägsta. Planen: fylld svart
med tjock kontur; 3D, fasader och sektioner: en kropp. Linjerna ändras med
punkterna i Modifiera som en öppen 2D-linje (bågar går inte). Provat med
Playwright mot `dist/` med en egen kuperad platsfil i exempelvillan;
klickjämförelsen kördes inte. Kända begränsningar: rutnätet (1 m) är
grovt för en smal ramp; krönet är vågrätt längs hela muren; murens
ändar möter inte marken med slänt; byggnadshöjden räknas för hela huset,
inte per byggnadskropp.*

### 0.10.6 Granskning

Efter marken, som är ny och tung geometri.

*Byggd (26 oktober), samma format (18), utan nya funktioner. Testerna:
491 → 501, ca 16 s (20 s med 0.10.5 i samma sandlåda). Skyddet först,
skrivet med 0.10.5: testprojektet `groundProject` (exempelvillan på en
kuperad plats, vriden 10°, med alla sorters markobjekt, ett träd och ett
grannhus) med referensritningar för planen, Befintligt, sektionen,
fasaderna och 3D, och den färdiga marken som siffror (höjderna där den
ändrats, schakt och fyll per objekt, medelmarknivån, byggnadshöjden och
stödmurens krön). Klickjämförelsen har 288 steg (platsen släpps på
planen, verktyget Mark i alla sätt, egenskaperna för varje sort, dialogen
*Platsen*, en innerväggs höjd). Samma klick i 0.10.5 och 0.10.6 ger samma
läge och bild, och 3D-vyn samma bild. I klickjämförelsen upprepades nya id
efter några hundra (den fasta följden tog de låga bitarna), så att ett
nytt markobjekt kunde ersätta ett annat; rättat. **Det som räknades om i
onödan**, mätt på en brant plats 200 × 150 m med 0,5 m mellan noderna och
tio markobjekt: varje ändrad vägg (också en innervägg, en väggs höjd eller
penna) räknade om hela den färdiga marken, eftersom husets kontur blev ett
nytt objekt; nu jämförs den till värdet (208 → under 4 ms). Kurvavståndet
och jorden i sektionerna räknade också om den, eftersom platsen byts som
objekt (ca 200 → 0,2 ms). Ett ändrat markobjekt räknade om alla; nu
börjar räkningen vid objektet, så att den sista brytlinjen tar 22 ms i
stället för 208 och den tredje platån 141 i stället för 230.
Höjdkurvornas linjer i planen byggdes om när en vägg ändrades (nu
sparade), så att planen efter en ändrad innervägg tar 18 ms i stället för
338. 3D-nätet byggdes om helt för varje ny färdig mark; nu byts bara
höjderna (44 → 4,5 ms). I Chromium blir en ändrad innervägg på den platsen
färdig i planen på ca 177 ms i stället för 308. Koden: `ground.ts` 497 →
61 rader (formerna och den färdiga marken i `groundGeometry.ts`,
ritningen i `groundPlan.ts`). Testerna för 0.10.4 och 0.10.5 i en fil
(`mark.test.ts`), den sneda marken en gång (`slopeSite` i
`tests/projekt.ts`, också för platstestet), och provet av att den färdiga
marken ritas tjock i planen och sektionen ersatt av referensritningarna.
Mätt men lämnat: fasader och sektioner byggs om helt vid varje ändring i
projektet, också av ett markobjekt (ca 20–60 ms per vy i exempelvillan,
lika med och utan mark); på en brant plats ändrar ett objekt stora ytor
(40 000 noder för urgrävningen under plattan) och varje ändrad nod kostar
1–3 µs; den färdiga markens höjdkurvor räknas för hela området som
markobjekten ändrat (ca 70–100 ms på den branta platsen).*

### 0.10.7 Markobjekt del 3 · *nytt format*

Carl Augusts synpunkter 26 oktober, efter 0.10.5. Marken togs före de
dolda linjerna, medan den är färsk (Carl August 26 oktober).

- Felen: höjdpunkten (och vägar, brytlinjer och stödmurar) gick inte att
  flytta; *Avrunda* på en ramp eller brytlinje gav fler raka bitar
- Ramp, gångväg och infart blir en sort, *Ramp/väg*, med namn och en egen
  gräns för lutningen
- Platå och urgrävning blir en sort, *Markyta*: schakt där marken ligger
  högre, fyll där den ligger lägre, också i samma objekt
- Vägens referenslinje syns, i mitten eller på en kant, med förskjutning
- Tvärlinjen i vägens början och slut går att slå av
- Linjetyp, penna och fyllning för markobjekten; alla går att låsa

*Byggd (26 oktober), format 19. Testerna: 501 → 504, ca 12 s. **Felen:**
`movePatch` flyttade konturen men inte `line`, så att alla markobjekt
längs en linje stod kvar när de flyttades (med Flytta, dragning eller
pilarna); nu följer linjen med. Markobjektens linjer är 2D-former utan
bågar (`noArcs`, `allowsArcs`): Böj och Avrunda finns inte i Modifiera
förrän bågarna kommer (0.10.19, förut 0.10.16, 0.10.17 och 0.10.18), Fasa finns kvar. **Ramp/väg**
(`kind: 'path'` utan `path`): förvald bredd 1 500, tvärfall bara när det
anges (förvalet 1:50 för infarten är borta), varning när den är brantare
än sin gräns (`maxSlope`, förval *Brantaste ramp/väg* 1:12 under
*Platsen*) och, när den är brantare än *Vilplan brantare än* (1:20), när
höjdskillnaden är mer än 0,5 m. Namnet (*Ramp*, *Infart* …) står i
planen i stället för *Ramp/väg*. **Markyta** (`kind: 'area'`): tar ned
och fyller som platån gjorde; urgrävningen under bjälklaget tar
fortfarande bara ned (grunden). Planen: heldragen kontur; den ritade
urgrävningen var streckad, nu bara den under bjälklaget. **Referenslinjen**
är den ritade linjen; vägens mitt ligger `centerShift` från den (vänster
kant: vägen till höger; förskjutningen positiv utåt från vägen, negativ
mot mitten, och i mitten positiv åt vänster). Höjden, tvärfallet och
lutningen räknas längs mitten. Den ritas blå och tunn som takets och
väggarnas när vägen är markerad, i planen och i 3D (med höjden längs
linjen); som fast linje på papperet behövs den inte. **Tvärlinjerna**:
vägen ritas som två sidor och två ändar (`kant`, `början`, `slutet`), och
`startLine`/`endLine` false släcker en ände. **Penna**: `Ground` i
`OWN_PEN_TYPES` (tjocklek, färg och linjetyp gäller linjerna och
konturerna, inte texterna och stödmurens fyllning); **fyllning**:
2D-formens fält (`d2:`) för markytor och vägar, ritad bakom väggarna och
släckt med *Fyllningar* i Visa; **lås**: `Ground` i `LOCKABLE`. Format 19
eftersom sorterna `plateau`, `excavation` och `path` (ramp, walk, drive)
är borta; äldre filer får meddelandet. Provat med Playwright mot `dist/`
med `groundProject` (dra höjdpunkten, rampens egenskaper, referenslinjen i
planen och 3D, smartmenyn på gångvägens hörn, lås och dragning).
Klickjämförelsen (293 steg, nya steg för namn, referenslinje,
förskjutning, tvärlinje, gräns och lås) kördes mot 0.10.7 utan fel;
mot 0.10.6 går den inte, eftersom verktygets knappar är andra.
Referensritningarna `mark-plan` och `mark-siffror` ändrades med avsikt
(namnen, rampens referenslinje på vänster kant, gångvägen utan
tvärlinje i slutet och med skraffering).*

### 0.10.8 Marken i ritningarna

Carl Augusts synpunkter och svar 26 oktober. Mellanstor; delad i två
(Carl August 26 oktober): höjderna i fasaden i 0.10.8b.

- Höjdkurvor och marklinje som inte ändrats ritas heldragna; streckat bara
  den tidigare marken där den ändrats
- Halvmeterskurvorna tunnare än helmeterskurvorna
- Höjdkurvor i 3D-vyn
- Släntmarkeringar i planen (långa och korta streck nedför slänten)
- Flera lutningspilar när fallet varierar mycket
- Jorden i sektionerna med skraffering eller bara vit bakgrund
- ±0 med ett klick på topografin, ändras efteråt
- Licenstexten som fältet `{licens}`

*Byggd (26 oktober), samma format (19). Testerna: 504 → 508, ca 13 s.
**Höjdkurvorna** (`groundContours` i `elements/site.ts`): `solid` är den
befintliga marken utanför de ändrade rutorna och den färdiga innanför,
`old` den befintliga innanför. En ruta är ändrad när någon av dess fyra
noder skiljer sig mer än 10 mm (`changedCells`); varje sträcka i en kurva
går genom en ruta och delas efter sin mitt. Heldragna 0,25 (hela meter)
och 0,13 (halvmeter, förut 0,25 och 0,18 i grått streckat); den gamla
grå och streckad 0,18/0,13 som förut. I Befintligt är allt heldraget,
och marklinjen i fasader och sektioner också (0,5, förut tunn och
streckad). **3D**: samma kurvor som sträckor 40 mm över marken
(`contourSegments3d`, `setTerrain` med en andra parameter), mörka och
halvgenomskinliga; *Höjdkurvor i 3D-vyn* under Visa, Platsen
(`contours3d`). **Släntmarkeringar** (`slopeMarks` i `groundPlan.ts`):
för markobjekt med slänt (inte stödmur eller utjämning), från ringens
kanter (inte husets hål) var 2,5 mm på papperet: gå ut längs normalen i
steg om en tredjedels ruta så länge den färdiga marken skiljer sig från
den befintliga (15 mm) och lutar minst hälften så brant som slänten.
Schakt (den färdiga lägre) har krönet ute, fyll vid kanten; långa och
korta (40 %) om vartannat; i utåtgående hörn en solfjäder lika tät som
kanten 1,5 m ut. Jämförs med den färdiga marken efter alla objekt, så
ett objekt som fylls igen av ett senare får inga streck. `Ground` läser
`Ground` (`planReads`), eftersom strecken beror på de andra
markobjekten. **Fallet** runt huset: en pil per fasad längre än 3 m, mitt
på markytan, med *1:20*; en markyta är plan och har en pil som förut.
**Jorden**: `site.earthWhite` (vit fyllning, `paper`) bredvid
`earthHatch`; en valfri parameter, inget nytt format. **±0**: *Klicka i
planen* i dialogen *Platsen* sätter ett tillfälligt verktyg; klicket
läser den befintliga marken (`groundAt`), avrundar till cm och öppnar
dialogen igen med värdet ifyllt (inte sparat). Esc avbryter. Andra
ändringar i dialogen sparas inte när man klickar i planen. **`{licens}`**
i `BUILT_IN` och `smartVars` (`doc.site.licence`). Referensritningarna
`mark-plan` och `mark-plan-befintligt` ändrades med avsikt (kurvorna,
strecken och pilarna). Provat med Playwright mot `dist/` (planen,
3D-vyn och ±0). Klickjämförelsen kördes inte (bara ritningen av marken
är ändrad, och den ändras med avsikt).*

### 0.10.8b Höjderna i fasaden ✓

Carl Augusts svar 26 oktober (fråga 19). Mellanstor.

- En linje i planen, *Beräkningsgrundande fasad*, längs fasadlivet; byggnadshöjden
  mäts mot den (finns ingen: den längsta fasaden, som nu)
- Byggnadshöjden utan språng: där fasadlivet möter takets överkant
  (0.10.5 räknar med PBF:s 45°-plan, språnget med)
- Kryssrutor per fasad för byggnadshöjd, nockhöjd och totalhöjd, från
  medelmarknivån
- Medelmarknivån (knappen för ±0) ur den nya marken, med den befintliga
  att jämföra

*Byggd (26 oktober), nytt format (20). Testerna: 508 → 510, ca 17–20 s.
Carl August sa "kör" på upplägget med Claudes val: nivåmarkören och måttet
visas båda, totalhöjden räknar det som syns i vyn (tak och väggar så
länge), och en beräkningsgrundande fasad per projekt (inte per
tillstånd). **Linjen** är objekttypen `BasisFacade` (`start`, `end`;
global och på alla våningar som fasadmarkörerna), ritad med Fasadverktygets
val *Beräkningsgrundande fasad* (två klick, ingen sida); en ny tar bort
den gamla i samma steg. Den ritas streckprickad 0,5 med texten utanför
huset. Byggnadshöjden mäts mot den närmaste fasaden i husets kontur som
är parallell inom 15° och vars sträcka linjens mitt ligger högst 1,5 m
från. **Utan språng**: 45°-planet räknas bara över huset (d ≥ 0); för ett
tak flackare än 45° blir det precis skärningen mellan fasadlivet och
takets ovansida, för ett brantare nocken (PBF). I exempelvillan sjönk BH
från +3,282 till +3,037. **Höjderna per linje** (`heights` på fasad- och
sektionsmarkörer: `bh`, `nh`, `th`, `mmnOld`); förvalet är BH i fasaden som
ser den beräkningsgrundande fasaden (blicken inom 45° mot fasadens
normal), inget annat. Kryssas en ruta sparas alla fyra. Måtten står 25 mm
(på papper) till höger om nivåmarkörerna, 7 mm isär: lodrätt streck med
snedstreck, texten längs strecket (*BH 3,04 m*). NH är takets högsta
ovansida, TH den högsta punkten i vyn (minst NH). *MMN bef.* blir en
egen nivåmarkör när den skiljer sig från MMN. Visa-valet *Byggnadshöjd*
döljer allt. **Platsen**: *Medelmarknivån* ur den nya marken (den
färdiga i förslaget som visas), *Befintlig* bredvid när den skiljer sig;
raden *Byggnadshöjd* säger beräkningsgrundande eller längsta och
nockhöjden. Provat med Playwright mot `dist/` (fasaderna, kryssrutorna,
verktyget, linjen i planen, Platsen). Klickjämförelsen kördes inte.*

### 0.10.9 Stödmur del 2 ✓

Carl Augusts synpunkt 26 oktober. Mellanstor.

- Referenslinje i mitten eller på en kant, med förskjutning
- Höjd över marken i början och slutet (t.ex. 700 och 900); krönet följer
  den utjämnade marken (medelvärdet av det den passerar)
- Fler kontrollpunkter, och höjdpunkter längs muren med *ÖK +65,765*

*Byggd (26 oktober), samma format (20). Testerna: 510 → 514, ca 10–13 s.
Carl August sa "kör" på upplägget, och ja till ett rakt krön som val.
Claudes val: **referenslinjen** som vägens (`refSide`, `refOffset`,
`centerShift` med tjockleken); den syns markerad med en pil i linjens
riktning, också i 3D. **Krönet** i ändarna är *Över marken* (`above`,
`endAbove`, mot den högre sidan) eller en egen ÖK (`height`,
`endHeight`; förut gällde `height` hela muren). Längs muren följer det
den högre sidans mark utjämnad med ett glidande medelvärde (±1 m), med
korrigeringen rakt mellan ankarna (ändarna och höjdpunkterna); med
*Rakt* (`straight`) går krönet rakt mellan ankarna. **Höjdpunkter**
(`crest`: punkt på referenslinjen och höjd) läggs med *Höjdpunkt på
krönet* i Modifiera (smartmenyn på murens linje) med krönets höjd där,
avrundad till 5 mm; höjden ändras och tas bort i egenskaperna. **Foten**
300 under den lägre sidans lägsta mark inom ±1 m. **Planen**: ÖK vid
ändarna (på vänster sida) och vid höjdpunkterna (på höger sida, med ett
streck tvärs över muren); texten *Stödmur +…* i mitten är borta.
**3D**: bitar på högst 0,5 m med lutande ovan- och undersida, slagna
ihop där krönet och foten går rakt (inom 5 mm), utan egna kanter;
kanterna (krönet, foten, ändarna och hörnen) levereras för sig med
fasadens tunna vy-penna, som förut. Spegling byter referenslinjens sida
(också för vägen, där det saknades). Provat med Playwright mot `dist/`
(planen, Modifiera, egenskaperna, 3D). Klickjämförelsen kördes inte.
Kända begränsningar: bitarna syns svagt som strimmor i 3D-vyn (som
konens); där en fasads djup slutar mitt i muren ritas ingen kant vid
gränsen (som för husets väggar); murens ändar möter fortfarande inte
marken med slänt.*

### 0.10.10 Dolda linjer och vyns djup ✓

Carl Augusts synpunkter 25 och 26 oktober. Mellanstor.

- Vyinställning i fasader: närmaste bjälklag och ytterväggarnas insida som
  streckade linjer genom fasaden
- Fasader och sektioner med ett största djup och en zon före det där allt
  ritas tonat (tunna grå linjer)
- Ett tak på våningen ovanför streckprickat i planen (över snittet), ett
  under vyn streckat, som vyinställning (svar 26 oktober, fråga 21)
- Ritordningen (bakom eller framför väggarna) också i fasader och
  sektioner (fråga 55)

*Byggd (27 oktober), samma format (20). Testerna: 514 → 518, ca 14 s.
Carl August sa "kör nästa version" utan att se upplägget; Claudes val
står här och som frågor till nästa session. **Dolda linjer**: två
Visa-val, släckta från början (`+hiddenSlabs`, `+hiddenWalls`), bara i
fasader. Alla bjälklagens kanter (inte bara det närmaste) ritas där de är
skymda, tunt streckade (0,13, *Streckad*), och linjer som ligger på
varandra slås ihop, så att fram- och bakkant blir en linje. Ytterväggarnas
insida är en lodrät linje i varje hörn av det som ligger innanför
ytterväggarna (de väggar som når husets utsida), från väggens fot till
krön; inga vågräta linjer (bjälklagen visar dem). Linjerna går inte att
klicka på. **Tonat från** (`toneDepth`, mm från linjen) bredvid *Djup*,
för fasader och sektioner: kanter bortom ritas 0,13 grå, oavsett penna;
snittet och det som skymmer är detsamma. **Tak på andra våningar**
(`+roofsAround`): alla tak syns i alla planer; det som ligger över
snitthöjden streckprickat (som förut), under våningens golv streckat.
**Ritordningen**: 2D-formernas *Fyllningen* och *Linjen* gäller också i
fasader och sektioner (*Bakom/Framför modellen*), med samma förval som i
planen: fyllningen bakom, linjen framför. Det ändrar fasader där en
fyllning förut låg över modellen (också en mask). Provat med Playwright
mot `dist/` (Visa-menyn, *Tonat från*). Klickjämförelsen kördes inte.
Inga referensritningar ändrades.*

### 0.10.11 Småsaker ✓

Synpunkter 25 och 26 oktober.

- Högerklick på planerna i modellfliken
- Visa-menyn i flera kolumner, så att allt syns samtidigt
- Snäppa mot kalkerunderlaget
- Hovring i 3D visar vad som väljs, som i planen; markobjekten går att
  markera i 3D
- Importerade träd, grannhus m.m. som befintligt eller förslag, och att ta
  bort dem helt
- Ingen skarv i fasaden mellan befintligt och nytt när fasadmaterialet är
  detsamma (svar 26 oktober, fråga 25)
- Takets snitthöjd 1100 från början, inte 1200 (fråga 20)
- Bjälklagets *Fasa* får förvalet 500 mm, som *Avrunda* (fråga 32)
- **-markör** för symbolerna i ritningen (Carl August 26 oktober):
  *nivåmarkör* i stället för nivåkota, *sektionsmarkör* och *fasadmarkör*
  i stället för sektions- och fasadlinje, och liknande (klart i 0.10.11). I gränssnittet
  (penntabellen, hjälptexter, verktygen, egenskaperna), i README och
  dokumenten; koden byter ord i kommentarerna

*Byggd (27 oktober), samma format (20). Testerna: 518 → 522, ca 13 s.
Carl August sa "kör" med Claudes val som frågor. **Högerklick på en
våning** (och ⋯ på raden): Visa, Inställningar, Byt namn, Ny våning
ovanför/under den våningen, Ta bort. **Visa-menyn**: inställningarna i en
kolumn till vänster, kategorierna i två (CSS-kolumner) till höger, 680 px
bred och flyttad eller smalare så att den ryms i ritytan. **Snäpp mot
kalkeringen**: linjerna, polylinjerna och ytornas kanter i det kalkerade
(utom `noPick`), sist i listan, alltid på när kalkeringen syns.
**Hovring i 3D**: en ljusare variant av markeringsfärgen, en gång per
bildruta, inte medan vyn dras. **Markobjekt i 3D**: strålen provas mot den
färdiga marken i steg, och objektet i punkten (det som ritas sist går
före) markeras; konturen ritas 60 mm över marken, heldragen markerad och
svagare hovrad. **Träd och grannhus** jämförs (`compares`, inte `global`)
och går att ta bort fast de är låsta (också kartobjekten; marken bara med
platsen); *Riv* och *Behåll* bland deras snabbknappar. Nya träd ritas som
befintliga (grå). **Skarven**: `joinStoreys` jämför inte längre åtgärden,
eftersom alla väggar har samma fasadmaterial tills material går att
välja. **Förvalen**: snitthöjd 1100, *Fasa* för hörn i bjälklag och
2D-former 500 (väggarnas *Fasa* är kvar på 600). **-markör** i
gränssnittet, README, dokumenten och kommentarerna; verktygen och vyerna
heter fortfarande *Sektion* och *Fasad*. Provat med Playwright mot
`dist/` (Visa-menyn, våningens meny, snäpp mot kalkeringen, hovring och
markobjekt i 3D). Klickjämförelsen kördes inte. Inga referensritningar
ändrades.*

### 0.10.12 Småjusteringar ✓

Carl Augusts svar 27 oktober (förmiddag), om 0.10.9–0.10.11. Små, före
granskningen. Versionerna efter 0.10.11 flyttades samtidigt fram ett steg:
inga b-versioner, nästa lediga nummer i stället.

- Låst betyder låst, också mot borttagning, för alla objekt; vill man ta
  bort låser man upp först
- Sektions- och fasadmarkören: vyn heter som nu *Sektion* och *Fasad*; en
  egen del *Markör* i egenskaperna med markörens stil
- *Fasa* 500 som förval överallt, också väggarnas hörn
- Snäpp mot kalkeringen som inställning, på från början
- Bjälklag bakom snittet streckade i sektioner, med en vyinställning
- Tak på andra våningar: våningen ovanför och alla under
- Stödmurens *Över marken* mot den högre sidan, eller den lägre

*Byggd (27 oktober), samma format (20). Testerna: 522 → 526, ca 18 s.
**Låst**: `deleteElements` tar aldrig bort ett låst objekt, inte heller
träd och grannhus (undantaget från 0.10.11 är borta) eller en vägg med en
låst dörr eller ett låst fönster i sig. En blandad markering tar bort det
olåsta; de låsta står kvar markerade och ett meddelande säger att de måste
låsas upp. Låset finns nu i egenskaperna för alla objekt (förut bara
2D-former, text, mått, markörer, underlag och markobjekt), utom marken och
kartan, som tas bort med platsen. **Riv** och *Finns i* fungerar på låsta
objekt (de ändrar status, inte läget; träden importeras låsta och rivs
så), och en våning som tas bort tar med sina låsta objekt efter frågan.
**Markör**: delen *Sektion*/*Fasad* har vyns namn, djup, *Tonat från*,
höjderna och *Öppna*; delen *Markör* har beteckningen, längden, vinkeln,
*Rikta efter objekt*, *Vänd blickriktningen*, pennan (tjocklek, färg,
linjetyp) och *Lås*. Pennan är stilmallens för sektions- respektive
fasadmarkörer och gäller alla i projektet, som i stilmallen; en egen
penna per markör har inte byggts. **Snäpp mot kalkeringen**: i
Inställningar (Planen) och i planens högerklicksmeny under *Snäppning*;
sparas i webbläsaren. **Bjälklag bakom snittet** (`hiddenSlabsSection`):
**på** från början i sektioner (i fasaderna är de släckta från början),
släcks under Visa; ett snittat bjälklag får inga streckade linjer. **Tak
på andra våningar**: våningen närmast ovanför och alla under. **Stödmuren**:
*Över marken mot* Den högre sidan (förval) eller Den lägre; krönet längs
muren följer då den lägre sidans mark. Provat med Playwright mot `dist/`
(Delete på en låst vägg, *Markör*, högerklicksmenyn). Klickjämförelsen
kördes inte. Inga referensritningar ändrades.*

### Granskning efter 0.10.12 ✓

Enligt planen (förra var 0.10.6). Inget eget versionsnummer (Carl August
27 oktober: nästa lediga nummer, och granskningen har inga nya
funktioner); appen heter fortfarande 0.10.12.

- Dela stora filer: `view3d.ts` först, sedan de som vuxit
- Gå igenom testerna: dubbletter, det som låser detaljer, under en minut
- Leta efter långsam kod
- Klickjämförelsen med nya steg för 0.10.11 och 0.10.12

*Gjord (27 oktober), samma format (20). Testerna: 526 → 524, ca 14–18 s.
**Filerna**: `view3d.ts` 790 → 464 rader (dragningen och greppen i
`edit3d.ts`, klippningen, snittytorna, markträffen och kropparna i
`geometry3d.ts`); `selectionFields.ts` 389 → 266 (markörernas fält i
`markerFields.ts`, måttens, textens, skalstockens och stämpelns i
`annotationFields.ts`, `numberField` och `textField` i `fieldMarkup.ts`);
`propertiesPanel.ts` 614 → 434 (knapparna i `selectionActions.ts`);
`section.ts` 431 → 302 (linjerna, det som skymmer dem och de dolda i
`sectionLines.ts`); `commands.ts` 625 → 310 (flytta och vända i
`moveCommands.ts`). Allt exporteras vidare från de gamla filerna, så
inget annat ändrades. **Testerna**: fyra som prövade samma sak är
ihopslagna eller kortade (skarven mellan våningarna befintligt mot nytt,
tak på andra våningar, låst mot borttagning, byggnadshöjden i fasaden).
Hela körningen är långt under en minut; snäpptestet från 0.8.3 (1,2 s)
står kvar med sina 120 punkter. **Långsam kod**: inget nytt som växer med
kvadraten. En fasad eller sektion tar 11–25 ms i exempelvillan på den
kuperade platsen efter en ändring, med eller utan markobjekt; 3D-formerna
byggs om vid varje ändring (inga är samma objekt efter ett ändrat
markobjekt), så linjerna kan inte sparas förrän formerna för oförändrade
objekt blir desamma. Det är lämnat (en egen, mellanstor uppgift, inte
före piloten om det inte märks). Ytterväggarnas insida tar 36 ms för ett
rutnät av 12 × 12 rum och 129 ms för 24 × 24. **Klickjämförelsen** har
347 steg (54 nya efter `slut`: våningens meny, Visa-menyn, snäpp mot
kalkeringen av och på, låst mot borttagning, delen *Markör* med pennan,
stödmurens *Över marken mot*, bjälklag bakom snittet, och 3D-vyn med
hovring, klick på vägg och mark, grepp, flytt och *Följ sektionen*, med en
bild av 3D-vyn efter varje steg). Samma klick i 0.10.12 före och efter
granskningen ger samma läge, ritning och 3D-bild i alla 347 steg. Mot
0.10.10 (de 293 stegen till och med `slut`) skiljer sig bara det som
0.10.11 och 0.10.12 ändrade med avsikt: orden i stilmallen (-markör),
*Lås* i egenskaperna för alla objekt, Visa-menyns kolumner, snitthöjden
1100 (takets snitt på plan 2), ingen skarv mellan befintligt och nytt
mellan våningarna (gaveln i fasad 2), och snäpp mot kalkeringen: hörnen
i bjälklaget som ritas på plan 2 snäpper mot en kalkerad 2D-form på plan 1
(y 0 i stället för 200), vilket följer med i projektet till slutet.*

### 0.10.13 Höjder i förhållande till våningen ✓

Synpunkt 25 oktober. Mellanstor.

- En minus- eller plusnivå i förhållande till våningen för bjälklag,
  väggar, objekt m.m.
- Takets höjd gäller referenslinjen, och man väljer om den ligger mot
  takets översida eller undersida (fråga 26). Lutningsriktningen, *Vänd
  lutningen* och radiens tecken som nu
- Stödmurens höjdpunkter: höjden skrivs när punkten klickas ut, och
  punkten dras längs muren (27 oktober)
- BH, NH och TH i fasaden flyttas för hand (27 oktober)
- Ur Inkorgen 27 oktober: netto och andel berg för markobjekten

*Byggd 27 oktober, samma format (20; nya valfria parametrar). Carl
Augusts svar: en vägg vars nivå ändras i egenskaperna flyttar bara foten
(toppen ligger kvar), medan en flyttning flyttar hela väggen; takets
referenslinje mot undersidan från början. Claudes val: **nivån** heter
`level` (mm från våningens golv) och finns för väggar (foten; fältet *Fot
mot våningen*), bjälklag (ovansidan) och möbler (undersidan). Väggens
höjd räknas från foten, så toppen är `level + height`; dörrar och fönster
lyfts med väggens fot (bröstningen räknas från foten). Bjälklag kapar
bara väggar vars fot ligger under dem. **Flytta i höjd** är ett nytt val
i Modifiera för det markerade (väggar, bjälklag, möbler och tak, inte
låsta), med ett värde som skrivs in; det fanns ingen lodrät flytt förut.
Takets *Höjden gäller* fanns redan (sedan 0.10), med undersidan som
förval: inget ändrat. **Höjdpunkten** på stödmuren är inte längre ett
direktval: värdefältet föreslår krönets höjd där man klickade (i meter
RH 2000 med plats, annars mm) och Enter eller ett klick lägger punkten.
Punkterna har romber på referenslinjen när muren är markerad, och dras
längs linjen (minst 100 mm från ändarna); höjden följer med. **BH, NH och
TH** får en ruta i måttets överände i den öppna fasaden eller sektionen
och dras i sidled; flyttningen från förvalet sparas på markören
(`heightOffsets`), så den följer med när huset ändras. Måttens delar heter
nu `höjd-bh`, `höjd-nh` och `höjd-th`. **Massorna**: netto = fyll −
schakt, och *Berg i schakten* (`rock`, procent) delar schakten i berg och
jord. Inte gjort: en vägg vars fot ligger över planens snitthöjd ritas
fortfarande som snittad i planen; klickjämförelsen har inga nya steg.*

### 0.10.14 Fyllningar och opacitet ✓

Inkorgen 27 oktober. En gemensam mall för alla objekt med fyllning, med
så många egenskaper som möjligt.

- Tre sorter: **Solid** (färg, opacitet i tio steg eller skriven),
  **Mask** (solid med pappersbakgrund, opacitet ur en lista) och
  **Mönster** (mönstret, förgrundens penna och opacitet, bakgrundens färg
  och opacitet), med förslagsbubblor under varje
- Samma kontroller för markobjekten (också slänterna för sig), 2D-former
  och rum
- Det som tidigare frågats: fyllningens bakgrund och sparade fyllningar i
  stilmallen (fråga 52 och 56), masken och rutnätet (51), mönstrets mått i
  papper eller verkligheten och utgångspunkt (45)
- Ur svaren 27 oktober: fönstrets bröstning från våningens golv med ett
  val att följa väggens fot, och Flytta i höjd från kommandoraden

*Byggd 27 oktober, samma format (20; nya valfria parametrar). Carl
Augusts svar (Claudes val, godkända): mönstrets mått på papper eller i
verkligheten per objekt, med förvalet från fyllningstypen, och mönstret
utgår från objektets första hörn; masken döljer rutnätet på skärmen som
förut; sparade fyllningar i stilmallen **kopplas** till objekten, och ett
ändrat fält gör fyllningen objektets egen; kryssrutan *Samma för linje och
fyllning* är borta, fyllningen har alltid sin egen opacitet; det som ligger
över snittet blir en egen version, 0.10.16. Hans svar om höjderna: fönster
följer våningens golv som förval men kan följa väggens fot (dörrar följer
foten); `M Z -500` flyttar det markerade i höjd. Claudes val: lägena heter
Ingen, Solid, Mask och Mönster; opaciteten i tio knappar (10–100) och ett
skrivet fält, för masken en lista (100, 75, 50, 25); förslagen är Vit,
Ljusgrå, Grå 50 %, Gräs, Grus, Hårdgjort och Vatten (Solid), hel och halv
mask, och Skraffering, Tät skraffering, Kors, Tegel, Betong, Plattor 300
och Mark (Mönster). Mönstrets penna är ny (förval 0,13 eller typens).
Bakgrunden är en lista (ingen, mask, egen färg) i stället för en
kryssruta. En sparad fyllning sparas med *Spara i stilmallen…*; samma namn
skriver över den. Kopplade objekt har en kopia av fälten, så att de ser
likadana ut när den sparade tas bort. Slänternas fyllning täcker ytan som
släntstrecken går över (känns av med halva strecktätheten), bakom
objektets egen. Kommandoraden tar också `FZ -500`, `MZ -500` och `Z -500`
medan Flytta pågår. Inte gjort: fyllning per status och gradient för
slänter (Claudes förslag; efter piloten om de behövs), sparade fyllningar
i stilmallens dialog (de sparas och tas bort från panelen); egna `.pat`
läses som förut som fyllningstyper i stilmallen.*

### 0.10.15 Visa och dölja ✓

- Väggar m.m. var för sig under Visa; dölja ett objekt eller en typ med
  högerklick, sparat i vyn
- *Tonat från* ställs in med ett grepp när vyn är markerad i planen (27
  oktober)
- Kryssrutor för om markobjektens linjer och släntmarkeringarna syns i 3D
  (Inkorgen 27 oktober)

*Byggd 27 oktober, samma format (20). Carl August hoppade över frågorna
den här gången. Claudes val: väggar, dörrar och fönster fick egna
kryssrutor under Modell (de andra typerna fanns redan); dörrar och
fönster följer väggen när den döljs; det dolda ritas inte, men räknas med
i väggarnas skarvar, rummens konturer, bjälklag ur väggarna och
numreringen (gäller också typerna som kunde döljas förut); högerklick
har *Dölj i vyn* och *Dölj alla …* (typer med en egen kryssruta), inte på
blad; de enskilt dolda tas fram alla på en gång med *Visa dolda objekt*
under Visa och i planens högerklicksmeny (inte ett och ett); greppet för
*Tonat från* är en romb en bit från mitten, streckad utan värde (då vid
djupet eller 4 m ut), och djupet får ett fyrkantigt grepp i mitten när
det är satt; närmare linjen än 100 mm blir inget; bara i planen och för
en ensam olåst markör; linjerna i 3D är släckta från början och ligger
under Visa → Platsen, konturerna mörka och släntstrecken halvt
genomskinliga. Inte gjort: dölja i 3D-vyn och planen för sig (det dolda
gäller vyn, och 3D följer vyn som förut); ett och ett tillbaka.*

### Granskning efter 0.10.15 ✓ (0.10.15.1)

Enligt planen (förra var efter 0.10.12). Två småfel ur Inkorgen 27 oktober
gör att något syns, så den heter 0.10.15.1 (Carl August 27 oktober).

- Markobjektens start- och ändmarkering i 3D följer planen
- Maskens opacitet i samma tio steg som de andra lägena, och skriven
- Dela stora filer: `selectTool.ts`, `showMenu.ts` och det som vuxit
- Gå igenom testerna och leta efter långsam kod
- Klickjämförelsen med steg för 0.10.13–0.10.15

*Gjord 27 oktober, samma format (20). Testerna: 542, ca 14 s.
**Småfelen**: 3D-vyns konturer för vägar (`groundLines3d`) tar kanterna
och tvärlinjerna ur planen (delarna `kant`, `början` och `slutet`), så en
avslagen tvärlinje (`startLine`, `endLine`) syns inte i 3D heller; andra
markobjekt har konturen som förut. Masken har knapparna 10–100 och ett
skrivet fält som Solid (`MASK_STEPS` är borta). **Filerna**:
`selectTool.ts` 682 → 445 rader (greppen utöver väggändarna, med
dragningen, skrivningen och ritningen, i `selectDrags.ts` som en typ
`GripDrag`); `showMenu.ts` 368 → 204 (det som kan tändas och släckas,
`SHOW_GROUPS`, `isShown` och `setShown`, i `showKeys.ts`, och skärmskalan
i statusraden i `scalePop.ts`); `drawing2d.ts` 515 → 354 (fyllningen,
`FillParams` som eget gränssnitt och `fillPrims`, i `fill2d.ts`, som
`drawing2d.ts` exporterar vidare); `blad.css` 528 → 324 (mönstren och
fyllningens panel i `fyllningar.css`, direkt efter i kaskaden). En sak
rättad på vägen: Markera glömde höjdpunkten, djupet och höjdmåttet när en
dragning avbröts (verktygsbyte, avbruten pekare), så att nästa släpp kunde
gå till dem. **Testerna**: inga dubbletter bland de nya; hela körningen
14 s. **Långsam kod**: inget nytt som växer med kvadraten. Linjerna i 3D
tar 4–7 ms för exempelvillan på den kuperade platsen (konturerna) och
6–10 ms med släntstrecken efter en ändring. Fasader och sektioner byggs
fortfarande om helt vid varje ändring (lämnat, se granskningen efter
0.10.12). **Klickjämförelsen** har 396 steg (50 nya efter 3D-stegen: Fot
mot våningen, Flytta i höjd med `M Z`, stödmurens höjdpunkt, en 2D-forms
punkt och bildens hörn som dras, med ett steg mitt i varje dragning,
fyllningens lägen, förslag, mask, sparad och kopplad fyllning, slänternas
fyllning, Dölj i vyn, Dölj alla möbler, Visa dolda objekt, greppet för
Tonat från, BH-måttet i fasaden och linjerna i 3D). Kryssrutorna under
Visa klickas nu (`__set` ändrade bara rutan, så stegen gjorde ingenting
förut), och de gamla stegen för 2D-formens fyllning följer panelen från
0.10.14. Samma klick i 0.10.15 och 0.10.15.1 skiljer bara i maskens panel
(tre steg) och rampens tvärlinje i början i 3D-bilden (två steg).*

### 0.10.16 Snittet i planen ✓

Carl Augusts svar 27 oktober (fråga om väggar över snittet efter 0.10.13).

- Objekten ritas "smart" mot planens snitthöjd (1100): snittyta bara där
  objektet skär snittet, delar under snittet som vanliga vylinjer och
  delar över snittet som sticker ut utanför det snittade streckprickat
- Gäller väggar vars fot ligger över snittet eller vars topp ligger under
  det, stödmurar och andra objekt som varierar i höjd
- Dubbelklick på Visa-knappen visar allt i vyn (Inkorgen 27 oktober)

*Byggd 27 oktober, samma format (20). Carl Augusts svar (frågorna i
början): bjälklag, möbler, tak och väggar följer snittet, och pelare och
profiler när de finns (0.11.1); väggarna ska kunna luta (en egen version,
0.10.21); pennan ställs in per objekttyp i stilmallen, med en egen per
objekt. Claudes val: zonerna är tre (genom, helt under, helt över; ett
objekt som bara rör snittet är snittat); en vägg under snittet ritas som
kontur med vyns penna utan fyllning, över snittet streckprickad och bara
där den sticker ut utanför de snittade väggarna; dörrar och fönster som
inte går genom snittet tar inget hål i väggen och ritas som hålets två
kanter (och glaset), streckprickat över och med vyns penna under (t.ex.
källarfönster); ett bjälklag genom snittet är en snittyta med väggens
fyllning, över snittet streckprickat utan kryss i håltagningarna; möbler
över snittet streckprickade (en möbel genom snittet ritas som förut, som
symbol); stödmurar delas längs muren där krönet går genom snitthöjden;
taken som förut men med stilmallens pennor. Pennorna: elva rader under
*Snittet i planen* i stilmallen (över och under för väggar, dörrar och
fönster, bjälklag, tak och stödmurar; över för möbler), det över 0,13
eller 0,18 punktstreckat; den egna pennan har en tredje del, *Över snittet
i planen*, som utan värden följer objektets övre del. Bjälklag kan få en
egen penna. Dubbelklick på Visa tänder allt utom det som är släckt från
början (husets kontur genom taket, tak på andra våningar, de dolda
linjerna i fasader och linjerna i 3D) och tar fram de dolda objekten;
detaljnivåerna ändras inte. Märks i hans ritningar: en låg stödmur (krön
under 1100 över våningens golv) ritas som kontur, inte skrafferad; en
vägg vars fot ligger över snittet är inte längre snittad.*

### 0.10.17 Linjerna i 2D-formen ✓

- Fortsätta och sluta en linje med ändpunkterna; Förskjut flera kanter;
  foga ihop linjer
- Ett klick mitt på en linje startar det senast använda verktyget
- Takets kontur med bågar direkt i verktyget (fråga 29); håltagningen i
  bjälklaget som en cirkel direkt (fråga 34)
- Ett markerat hål i bjälklaget ändras (flyttas, formas om, vrids,
  speglas) utan att bjälklaget påverkas (fråga 31)
- Referens- och konturlinjernas punkter (t.ex. takets kontur) syns som
  riktiga punkter när objektet är markerat (Inkorgen 27 oktober)

*Byggd 27 oktober (kväll), samma format (20). Carl August hoppade över
frågorna. Claudes val: **Rita vidare** gäller alla öppna linjer och
splines i vyn, inte bara de markerade (de markerade går före när två ändar
ligger i samma punkt; Ctrl+klick börjar en ny linje som förut); ett klick
på ena änden och sedan den andra sluter linjen utan nya punkter (det var
felet: utan nya punkter gjordes ingenting). **Förskjut** har *Kanter* (1,
3, 5, Alla) bredvid avståndet i smartmenyn och verktygsraden, kvar till
nästa gång; kanterna väljs symmetriskt kring den klickade (runt en sluten
form, till ändarna i en öppen); vänster sett längs varje kant, så alla
kanter i en sluten form går åt samma håll; hörnen räknas om där kanterna
möts (en förskjuten kant och en kvar som förut); en båge förskjuts med sin
tangent i hörnen och behåller sin vinkel (Förskjut finns nu också på
bågar); en kant får inte vända och ytan inte klappa ihop. Samma *Kanter*
för bjälklagets och markytans kontur. **Foga ihop** är en egen knapp i
raden (Shift+V, ikon två linjer och en punkt), också i smartmenyn när
minst två öppna linjer är markerade; linjer och splines fogas var för sig,
ändar inom 1 mm räknas som samma, den första i markeringen behåller penna
och id, ändformerna sitter kvar i kedjans ändar, och en kedja som slutar
där den började blir sluten. **Klick mitt på en kant** (inte väggar)
startar det som senast valts på en kant (Lägg till punkt, Böj, Förskjut
…), inte val som utförs direkt (Räta ut); första gången visas bara
smartmenyn. Läst som en önskan; säg till om det var ett fel du ville bli
av med. **Bågar** i takets kontur och håltagningens polygon: *Båge*
(knapp, G) gör nästa kant till en båge, med slutet och en punkt på bågen
(som 2D-formens båge); ett klick på första punkten med Båge på sluter med
en båge; Enter och Klar sluter med en rak kant (Enter slöt inte takets
kontur förut). Bågar i 2D-verktygets linje (fråga 59) är inte gjort.
**Bjälklaget** ritas som rektangel eller polygon (utan bågar, konturen har
inga), håltagningen som rektangel, polygon eller cirkel. **Hålet för sig**:
Vrid hålet och Spegla hålet bredvid Flytta hålet och Ta bort hålet, kring
punkten man klickade på; Flytta, Vrid och Spegla i raden gäller hålet när
man klickat på det; att forma om (punkterna, Avrunda …) fanns redan. Ett
klick inne i hålet markerar inte hålet (det träffar inget). **Punkterna**:
takets och bjälklagets kontur hade dem redan; markobjektens linjer (väg,
ramp, stödmur) får dem nu. Inte gjort: klickjämförelsen har inga steg för
0.10.16–0.10.17 än (läggs till i granskningen).*

### 0.10.18 Rampens referenslinje ✓

Inkorgen 27 oktober. Den gamla 0.10.18 delades, eftersom rampen fick
många nya önskemål (Carl August 27 oktober).

- Referenslinjen lever sitt eget liv och styr lutningen i XYZ; sidornas
  linjer styr rampens utbredning i XY, så att bredden kan variera längs
  rampen (nu är det sidorna som är klickbara och styr referenslinjen)
- Höjden i början och slutet: två sorters kontrollpunkter med olika färg,
  vanliga för X och Y och en sort (oftast bara i ändarna) för XYZ
- Förlänga rampen med ett klick på första eller sista ändpunkten
- Stödmur eller slänt per sida
- Referenslinjens punkter syns som riktiga punkter när rampen är markerad

*Byggd (27 oktober, kväll), samma format (20). Carl August hoppade över
frågorna. Testerna: 558 → 569 på ca 13 s. Claudes val: **referenslinjen
styr höjden och tvärfallet**: höjden räknas längs den och tvärfallet
vrider kring den, också när den ligger på en kant eller är förskjuten
(förut kring mittlinjen). **Punkterna med höjd**: ändarna alltid, och
punkter däremellan när de fått en med *Höjd i punkten* i Modifiera
(förslaget är höjden som lutningen ger där); *Utan höjd* tar bort den. En
punkt utan höjd styr bara läget. Mellan punkterna med höjd går rampen
rakt, så att en plan sträcka är ett vilplan i samma ramp; lutningen (1:N
med pil) och varningarna gäller varje sträcka. Fältet *Lutning* finns bara
när rampen har en sträcka. Punkterna med höjd är orange cirklar när rampen
är markerad, de andra vita fyrkanter, sidornas små grå. **Sidorna**
följer referenslinjen med bredden som förut tills en av dem ändras i
Modifiera (punkterna och kanterna som 2D-formens, utan bågar); då sparas
den sidan och ligger kvar när referenslinjen ändras. *Sidorna: Följer
referenslinjen / Ritade* i egenskaperna. **Kanterna**: *Kanterna* gäller
alla som förut och nollställer sidorna; *Vänster sida* och *Höger sida*
för sig; ändarna följer *Kanterna*. En sida som är mur ritas tjock (0,5),
har inga släntstreck och lämnar marken utanför orörd (ingen kropp i 3D,
som förut). **Förlänga**: ett klick på en ände med Mark (Ramp/väg), eller
*Förläng* på en ände i Modifiera; lutningen i sista (eller första)
sträckan fortsätter, avrundad till 10 mm, och den gamla änden behåller sin
höjd som en punkt med höjd. Provat med Playwright mot `dist/` med
`groundProject` (sidans punkt i Modifiera och dragen, Höjd i punkten,
förlängd med Mark, höger sida som mur, 3D). Klickjämförelsen mot 0.10.17:
samma `doc` i alla 396 steg; ritningen skiljer från *tvärfall* (rampen
med referenslinjen på kanten vrider kring den), greppen och panelen för
rampen.*

### Granskning efter 0.10.18 ✓ (0.10.18.1)

Ungefär tre versioner efter den förra (0.10.16–0.10.18). Utan nya
funktioner, utom småfelen ur Inkorgen (Carl August hoppade över frågorna
27 oktober, så Claudes förslag gäller):

- Mer-knappen i smartmenyn syns fast det inte finns fler val (t.ex. för
  fastighetsgränsen från Höjdkurvor); leta upp fler ställen och visa den
  bara när valen inte får plats
- Egen färg på höjdkurvorna i stilmallen
- Stilmallens fönster bredare, i kolumner grupperade efter typ (om det
  ryms; annars en egen liten version)
- Klickjämförelsen får steg för 0.10.16–0.10.18 (snittet i planen,
  linjerna i 2D-formen, rampens punkter med höjd, sidorna och
  förlängningen)
- Städa, dela upp stora filer, gå igenom testerna

*Gjord 27 oktober (kväll), samma format (20). Det syns något, så den
heter 0.10.18.1. Testerna: 569 → 572, ca 14–17 s. **Mer**: smartmenyn
visar *Mer* (och högerklicksmenyn *Alla inställningar här*) bara när det
utfällda har något; utan var de kartans linjer (fastighetsgränser,
vägar, punkter), den befintliga marken och markeringar av bara sådana.
Andra objekt har alltid något (Finns i, Lås, typen, pennan). **Höjdkurvorna**:
tre pennor i stilmallen under *Höjdkurvor* (hela meter, däremellan, den
befintliga marken där den ändrats) med tjocklek, färg och linjetyp, och
höjden på hela meter i kurvans färg; förvalen som förut, utom att den
ändrade markens streckning nu är *Streckad* (3 och 1,5 mm i stället för
2 och 1). 3D-vyns kurvor har sin egen färg. **Stilmallens fönster**: upp
till 1480 px brett med tre kolumner som rullar var för sig när skärmen är
minst 1180 px: åtgärderna (med en egen rubrik) och texterna, pennorna,
och linjetyperna och fyllningstyperna. Raderna staplas i kolumnerna, och
pennorna har inte tjocklek, färg och linjetyp utskrivet på varje rad.
Läst som *efter sorts inställning*; säg till om du menade efter objekttyp
(väggar, dörrar …), det är en större omflyttning. Rättat på vägen:
fönstret hoppade till början vid varje ändring (nu är rullningen och
fokus kvar), och en penna för snittet som ställts heldragen blev
punktstreckad igen när projektet öppnades. **Filerna**: `ops.ts` 514 →
301 rader (`opDefs.ts`, `rail.ts`), `groundPlan.ts` 420 → 254
(`groundSlopes.ts`), `groundFields.ts` 322 → 183 (`groundFieldEdits.ts`);
stilmallens CSS i `stilmallen.css`. `commandLine.ts` (623) och
`planView.ts` (591) är störst nu; de är en sluten helhet var och lämnas
till en granskning där de hinner provas för sig. **Testerna**: inga
dubbletter bland 0.10.16–0.10.18; tre nya (höjdkurvornas pennor, heldraget
kvar, den ändrade markens färg). **Långsam kod**: inget nytt som växer med
kvadraten. **Klickjämförelsen** har 457 steg (61 nya): mot 0.10.18 samma
`doc` i alla steg före de nya sist; ritningen skiljer bara i den ändrade
markens streckning (från att platsen läggs in) och stilmallens fönster i
sin markup.*

### 0.10.19 Markobjektens bågar ✓

Carl Augusts synpunkter 26 oktober (förut 0.10.18). Stor; efter 0.10.17,
som har samma verktyg.

- 2D-formens redigering för markobjekten: Böj, Avrunda med riktiga bågar,
  Fasa
- Bågar på vägens referenslinje och på kanterna (kanterna ändrar bara
  bredden)
- Docka ihop två ramper med olika lutning
- Mjuka eller skarpa övergångar i höjd (Carl August 28 oktober): en
  gångväg jämnas av i övergångarna, en betong- eller stenramp har skarpa
  brytningar mot vilplanen; en inställning för rampen (med radie) i
  början, slutet och punkterna med höjd, och per punkt

*Byggd 28 oktober (natt), samma format (20): bågarna, övergångarna och
dockningen är frivilliga parametrar. Carl August svarade i början: Foga
ihop för dockningen, samma verktyg för stödmur och brytlinje, bågar på
sidorna ändrar bara bredden. Testerna: 572 → 588 på ca 14 s. Claudes
val: **bågarna** är pilhöjder per kant som 2D-formens (`bulges`, och
`leftBulges`/`rightBulges` på ritade sidor); all räkning mot marken görs
på linjen med bågarna som korta raka bitar, så sträckan längs
referenslinjen (höjderna) går längs bågen; sidorna som följer
referenslinjen är koncentriska med den (samma vinkel, större eller mindre
radie), och utan bågar räknas de precis som förut. Avrunda och Fasa kräver
som förut två raka kanter i hörnet; ett avrundat hörn med höjd ger sin
höjd till den nya punkten närmast. Verktyget Mark fick *Båge* (G) för
linjerna, som takets kontur i 0.10.17, och *Ångra* tar bort senaste
klicket. **Övergångarna** är parabler med en vertikal radie (förval 20 m
under Platsen, *Rampens mjuka övergångar*): i en punkt däremellan ersätter
kurvan brytningen lika långt åt båda håll (längden R·|Δlutning|, kortad
om den inte ryms på de raka delarna intill); i ändarna börjar och slutar
rampen plant med ändens höjd, så den raka delen riktas om och blir
brantare (h = g·S − R·g²/2; ryms radien inte kortas den). Lutningen i
planen, panelen och varningarna gäller den raka delen; fältet *Lutning*
sätter den raka delens lutning. En punkt utan höjd kan inte ha en
övergång (den styr bara läget). **Dockningen** med Foga ihop: ändar inom
den bredaste rampens bredd räknas som samma; den andra rampen hängs på
(vänd om det behövs: *reversedRamp* byter början och slut, sidor,
tvärfall och referenslinjens sida), skarven blir en punkt med den förstas
sluthöjd, den förstas inställningar gäller, och sidorna blir ritade om
någon var det eller bredderna skiljer. Provat med Playwright mot `dist/`:
en ramp med båge ur verktyget, Avrunda på referenslinjen, Böj på en sida,
övergångarna i panelen och Modifiera, dockning, 3D. Klickjämförelsen mot
0.10.18.1: samma `doc` och ritning i alla 457 steg; panelen, Platsen och
smartmenyn skiljer där det nya syns. Inte gjort: markytans kontur har
inga bågar (den ändras med takets konturverktyg); stödmurens sidor i 3D
följer bågen som bitar på 0,5 m som förut.*

### 0.10.20 Situationsplanens beteckningar ✓

Carl Augusts bilder 27 oktober; som landskapsarkitekter redovisar.

- Murens ledare *M01* och *MK +22.20*; markhöjder (befintlig
  understruken, utgående inom parentes, ny utan) med ett litet kors;
  minsta sidolutning i procent; låglinje för dagvatten som pilar;
  littera med två siffror som förval (inställning)
- Kontur runt släntmarkeringarna (Inkorgen 27 oktober)
- Släntmarkeringar ritade ur den befintliga marken där den är brantare än
  ett gränsvärde (inställning, 1:3 som förval). Annan grafik ur
  topografin (lågpunkter, avrinning, punkthöjder, lutningsfärger) efter
  piloten

*Byggd 28 oktober (morgon), samma format (20), tillsammans med rättningen
av markeringen (ramen för objekt med många linjer, 0.10.19.1 blev en del
av den här). Carl August bad att den byggdes utan frågor först. Testerna:
590 → 610 på ca 14 s. Claudes val: **markhöjden** är en egen sort
(`level`) under *Beteckning* i Mark: ett kors och texten till höger;
höjderna läses ur marken (den färdiga i förslaget) och marken räknas som
oförändrad när de skiljer mindre än 5 cm; en egen ny höjd i egenskaperna
går före. Befintlig understruken, ny utan, utgående inom parentes utan
understrykning (Stockholms ritningsmanual). **Låglinjen** (`drain`) ritas
i flödets riktning med pilar var 10 mm på papperet och minst en.
**Murens ledare** går vinkelrätt ut åt höger (i linjens riktning) från
murens mitt, 7 mm, med ett vågrätt streck 11 mm och texten på det:
litterat över och *MK* med krönets höjd under; varierar krönet står
lägsta–högsta. Litterat numreras i ritordningen bland vyns stödmurar
(*M01*); fältet *Littera* i egenskaperna ger ett eget. *ÖK* heter *MK*
överallt (ändarna, höjdpunkterna, fälten). Ledaren släcks under Visa,
Littera, *Stödmurar*. **Decimalerna** i markobjektens höjder är en
inställning under Platsen, två som förval (nivåmarkörerna har kvar tre);
**antalet siffror** i littera likaså. **Minsta sidolutning** är ett fält
i procent på markytan och rampen, utskrivet understruket (under höjden
respektive över namnet) bara när det är ifyllt; det är en anteckning,
inget som räknas. **Konturen runt slänterna** följer strecken ytterändar
(medianen av tre grannar), tunn 0,13, bruten där ingen slänt börjar;
strecken bryts nu där den färdiga marken lämnar släntens egen lutning,
vilket också kortar strecken som förut gick in över ett grannobjekts
slänt. **De branta slänterna** är en vyinställning under Visa, Platsen,
släckt från början, med gränsen under Platsen (1:3): gränsen mellan brant
och flackt räknas som en höjdkurva i lutningens fält, och strecken följer
fallinjen från krönet, grå, inte där markobjekten ändrat marken. Provat
med en ritning av `groundProject` till SVG (planen, markhöjderna,
låglinjen, ledaren och de branta slänterna med gränsen 1:8) och i
Playwright mot `dist/`. Inte gjort: markhöjden har ingen egen
textvridning eller förskjutning; låglinjens pilar går inte att glesa;
ledarens läge går inte att dra.*

### 0.10.21 Lutande väggar ✓

Carl August 27 oktober, i svaret om snittet i planen; 28 oktober bad han
att den byggdes före piloten ("kör nästa version").

- En vägg kan luta: en vinkel (eller ett mått i toppen) åt ena sidan, och
  väggen ritas som en lutande kropp i 3D, fasader och sektioner
- I planen följer den snittet: snittytan där väggen skär snitthöjden,
  foten som vy och det som lutar ut över snittet streckprickat
- Öppningarna följer lutningen; skarvarna mot andra väggar och tak prövas

*Byggd 28 oktober (förmiddag), samma format (20). Testerna: 610 → 616 på
ca 14 s. Claudes val: **lutningen** sparas som en vinkel i grader
(`lean`), positiv åt vänster som bågen, samma i båda ändarna (Carl August
hoppade över frågan om olika i ändarna; en vriden vägg får vänta); fältet
*Toppen i sidled* i mm räknas om till vinkeln ur höjden, så att vinkeln
håller när höjden ändras (en vägg upp till taket). Foten ligger kvar på
referenslinjen. Bågväggar lutar inte. **3D-formatet** fick `shear` i
stället för en egen kropp: ytorna är plana också lutade, så fasadernas
dolda linjer och kanter behövde inget nytt, och sektionen är exakt (en
affin avbildning av konturen, också under sneda tak). **Tak och bjälklag**
räknas i väggens oförskjutna koordinater; takets yta i plan flyttas
tillbaka så långt som väggen lutar ut vid sin höjd, en förenkling som
syns bara där takets kant går diagonalt över en lutande vägg. **Skarvarna**
mot andra väggar räknas vid foten i 3D (en lutande vägg som möter en
lodrät får en glipa eller går in i den högre upp; det prövas inte) och
vid snitthöjden i planen (dörrar, fönster, hål och skarvar hamnar där
snittet skär väggen). **Foten och toppen** i planen är väggens egen
rektangel utan skarvar, med fotens kontur bruten av dörrarna och toppens
av hål som når toppen. Rummen, bjälklag ur väggarna, väggsidorna,
automåtten, greppen och snäppningen utgår från foten; ett klick på
snittytan markerar väggen, men greppen ligger på referenslinjen vid
foten, en bit ifrån. Inte gjort: olika lutning i ändarna; lutande
bågväggar; ytterväggarnas insida som dold linje i fasaden ritas lodrät;
ingen lutning i väggverktyget (sätts i panelen efteråt).*

### Granskning efter 0.10.21 ✓ (0.10.21.1)

Utan nya funktioner. Klickjämförelsen får steg för 0.10.19–0.10.21,
`groundRamp.ts` delas, testerna gås igenom. Småfelen ur Inkorgen 28
oktober (Carl August godkände Claudes förslag A–H samma morgon):

- Slänternas fyllning fungerar inte (inget händer oavsett inställning)
- Släntstrecken dubbelt så glest (5 mm på papperet), som en inställning
  under Platsen
- 3D-perspektivet återställs när man växlar mellan Båda och 3D; det ska
  ligga kvar

*Gjord 28 oktober (förmiddag), samma format (20). Det syns något, så den
heter 0.10.21.1. Testerna: 616 → 617, ca 16 s. **Slänternas fyllning**:
felet låg i rampen och vägen (`linePlan`), som aldrig ritade
`slopeFill` fast panelen hade fältet; markytan ritade den. Nu ritas den
för båda, bakom objektets egen fyllning. Säg till om det inte händer
något på en markyta heller. **Släntstrecken**: *Släntstreckens avstånd*
under Platsen, mm på papperet, 5 som förval (förut fast 2,5); gäller
markobjektens slänter och de branta slänterna i den befintliga marken.
Konturen runt slänterna och slänternas yta känns av var 1,25 mm som
förut, oberoende av inställningen, så de blir inte grövre. **3D-kameran**
ligger kvar när man växlar mellan Båda och 3D; hela modellen visas bara
första gången 3D-vyn öppnas. **Filerna**: `groundRamp.ts` 618 → 257
rader: höjdprofilen i `rampProfile.ts` (`rampLevels`, `rampRuns`,
`easeRadiusAt`, `heightAtS`, `rampProfile`) och ändringarna i
referenslinjen i `rampEdits.ts` (`remapLevels`, `remapEases`,
`tidyLevels`, `tidyEases`, `extendRamp`, `reversedRamp`, `fusedRamp`).
`commandLine.ts` (623) och `planView.ts` (591) lämnas som förut.
**Testerna**: inga dubbletter bland 0.10.19–0.10.21; två nya (rampens
släntfyllning, strecken följer Platsen); referensen `mark-plan.txt`
omskriven för det glesare avståndet. **Klickjämförelsen** har 496 steg
(39 nya för 0.10.19–0.10.21: Böj på referenslinjen, mjuka övergångar och
en skarp punkt, en ramp till med Båge i verktyget och Foga ihop,
markhöjd, låglinje, murens littera, minsta sidolutning, decimalerna och
siffrorna under Platsen, branta slänter under Visa, en lutande vägg i
planen och 3D): mot 0.10.21 samma `doc` i alla steg; ritningen skiljer från det att platsen läggs in (släntstrecken glesare; med avståndet ställt på 2,5 mm är ritningen densamma i alla steg), 3D-bilderna där kameran nu står kvar, och Platsens dialog med det nya fältet.*

### 0.10.20.1 Litteran ✓

Inkorgen 28 oktober; utvidgad samma dag i samtalet. Carl August: alla
littera med ledare ska gå att flytta (också rumslitteran utanför rummet),
inte bara murens; ledaren går först vinkelrätt ut från texten (uppåt, åt
höger, nedåt eller åt vänster) och viker sedan av mot punkten, med Shift i
steg om 15°, och olika ändar. Flera ledare från samma littera delar stammen
och viker av från den (hans skiss: parallella sneda delar från en vågrät
stam). Ett generellt littera med fritext och smarttext ur det man pekar på
och flera ledare blev en egen version, **0.10.20.2**. Han godtog Claudes
val O–S ("allt blir bra, kör").

- **Den gemensamma ledaren** (`src/elements/leader.ts`): textens ruta,
  stammen ut från en sida och knäcken, de sneda delarna och ändarna. Med en
  gemensam vinkel räknas knäckarna ut så att flera ledare blir parallella
  och stammen så lång som behövs (till 0.10.20.2; prövat men inte använt
  än). En punkt rakt ut från texten nås av stammen själv
- **Sidan** väljs automatiskt: åt höger eller vänster efter vilken sida av
  textens mittlinje punkten ligger, uppåt eller nedåt när den ligger rakt
  över eller under textens mittersta halva; går att låsa
- **Ändarna**: ingen, pil, fylld pil, prick, snedstreck, ring och
  *Automatiskt* (pil mot en kant, prick inne i en yta)
- **Rummet, väggarna, dörrarna, fönstren och stödmuren** använder den. Rummet
  får en ledare när stämpeln står utanför rummet (som förut), väggar alltid
  (rakt in till väggens mitt, som förut), dörrar och fönster när litteran
  flyttats. Stödmurens text har strecket mellan raderna, och stammen
  fortsätter det in till knäcken rakt ut från muren
- **Grepp** i Markera för det markerade: texten dras i sig själv,
  punkten (rund) och knäcken (fyrkant, stammens längd). Shift: den sneda
  delen i steg om 15°. Punkten snäpper mot det ritade
- **Littera** i egenskaperna: stammens sida, änden, stammens längd och
  *Litteran tillbaka*; förvalen per sort i stilmallen (*Ledarna* under
  *Texter och littera*)
- Valfria parametrar, samma format (20)

*Claudes val:* förskjutningarna sparas på objektet i mm i modellen (inte
på papperet, som Claude först föreslog), eftersom rumsstämpeln redan
sparades så (`labelAt`) och punkten sitter på objektet; i olika skalor
står litteran därför lika långt från objektet i verkligheten. För littera
längs en vägg står de i textens egna axlar och följer väggen när den
vrids; rummets och stödmurens i planens axlar, och de vrids och speglas med
objektet. Förvalen ritar som förut: väggens och murens streck utan ände,
rummets öppna pil, dörrarnas och fönstrens *Automatiskt* (prick i
öppningens mitt). Stammen 3 mm på papperet. Textens grepp ritas inte (det
skulle dölja texten); man drar i texten. *Stämpeln i mitten* blev
*Litteran tillbaka*.

*Gjordes inte:* flera ledare och det generella littrat (0.10.20.2),
markhöjdens och de andra markbeteckningarnas text (de har ingen ledare),
nivåmarkörernas text, ett grepp för ramens storlek, en egen penna per
littera (stilmallens *Litterans streck* och *Rumsstämpelns pil* gäller).
Klickjämförelsen kördes inte; nya steg i nästa granskning.

### 0.10.20.2 Generell littera ✓

Carl August 28 oktober, i samtalet om litteran, och hans svar på frågorna
om 0.10.20.1 samma dag (13.33): A *testa pappersstorlek* (förskjutningen
på papperet), B och C som de var, D *bara det finns som en visuell
kontrollpunkt om man markerar litterat, kan vara på ledarens ansats*, E
*testa att ha strecket under litterat som helhet; borde vara en generell
inställning om litterats ledare ska ansluta till sidan eller
understryka litterat*. Format 21.

- **Littera-verktyget** (K, `littera`): klick på det litteran pekar på,
  Shift+klick för fler, sedan där texten står. *Lägg till ledare* i
  egenskaperna använder samma verktyg
- **Objekttypen `Label`** (`src/elements/label.ts`): fritext och
  smarttext ur objekten (`{typ}`, `{id}`, `{namn}`, `{nummer}`, `{area}`,
  `{bredd}`, `{höjd}`, `{längd}`, litteramallarnas fält och egna
  egenskaper); *varierar* eller en lista
- **Flera ledare på stammen**, parallella med en gemensam vinkel (45° som
  förval, 0 = fria)
- **Punkterna sitter fast i objekten** (objektets axlar,
  `src/elements/anchor.ts`) och följer dem; röd ledare när objektet tagits
  bort; en punkt som dras fastnar i objektet den släpps på
- **Sort och löpnummer** i ritordning, eget nummer går före; Visa per sort
- **Ram**: ingen, understrykning, rektangel, cirkel, sexhörning
- **Rikta och fördela**: Justera och Fördela flyttar litteran utan punkterna
- **Understruken ledare** (E) för alla littera: *Mot texten* per sort i
  stilmallen och per littera under Littera; stödmuren understruken som
  förval
- **Förskjutningen på papperet** (A): `tag.at` i mm på papperet
- **Grepp på ansatsen** (D): en romb där ledaren lämnar texten

*Claudes val:* löpnumren räknas över hela projektet per sort (inte per
våning), i den ordning litterorna skapats; sorten jämförs utan skiftläge.
Vinkeln gäller bara när ledarna är flera, så att en ensam ledare beter sig
som de andra litterornas (stammens längd). En punkt som ligger bakom
stammens början får knäcken vid stammens minsta längd och blir inte
parallell. Rummets stämpel står kvar i modellen (`labelAt`); det är bara
de förskjutna litterorna (väggar, dörrar, fönster, stödmurar) som står på
papperet. Det generella littrat står i modellen (`pos`), som en text.
Texten vrids inte med Vrid (den står kvar upprätt). Littera i Skiss visas
(det generella littrat är en anteckning, som text). En ensam radbrytning
går inte att skriva i verktygsraden, bara i egenskaperna. Formatet höjdes
eftersom `tag.at` bytte betydelse.

*Gjordes inte:* löpnummer efter läget (bara ritordning), litteran i
fasader och sektioner (verktyget ritar i planen), dubbelklick för att
skriva i texten, spegling som håller punkten exakt på en vägg (den hamnar
lika långt från väggens nya början), ledare till punkter i 3D,
förteckningen (0.12 Export). Klickjämförelsen kördes inte; nya steg i
nästa granskning.

### 0.10.22 Snäpp och smartspöt ✓

Inkorgen 28 oktober (*Snäpp i marken*), utvidgad av Carl August samma dag
(14.15): snäppet och liknande funktioner ska fungera för allt som är
rimligt, inte bara de fall han listat; trollstaven ska heta något med
smart, vara anpassad efter verktyget man står i (i Markera utan verktyg)
och vara lätt att bygga ut. Claudes förslag E, F, J och N i den här
versionen, G, H, I, K, L och M i 0.10.23; *kör*. Hans svar om 0.10.20.2:
A, B, C och E bra som de är; D en inställning för vridningen. Samma format
(21).

- **Snäpp mot allt som ritas**: markobjekt, bjälklag, tak, rum, grannhus,
  fastighetsgränser och vägar från Höjdkurvor, träd, markörer, mått och
  allt nytt, ur primitiverna; höjdkurvorna som kurvor (på linjen, inga
  ändar)
- **Smartspöt** (Q, eller knappen i statusraden), med register och en fil
  per funktion; förhandsvisning vid hovring, Tab växlar, Shift samlar
- **E Vägg**: väggar runt en kontur eller längs en kant (bjälklag,
  markobjekt, 2D-form, underlag, fastighetsgräns …)
- **F Mark**: stödmur, brytlinje, låglinje eller väg längs en sida eller
  runt en kontur (rampens sida, markytans kant, höjdkurva …)
- **J 2D**: en sluten 2D-form runt en snittyta, ett objekts kontur eller
  den minsta slutna ytan mellan linjer
- **N Markera**: allt som hänger ihop med objektet, Tab för allt av samma
  sort i vyn
- **D Litterans vridning**: Horisontell, Vertikal och egna grader i
  verktyget och egenskaperna; förvalet i stilmallen (*Vridning* för
  Littera under Ledarna)

*Claudes val:* spöet slås av när man byter verktyg och med Esc eller Q
(det ligger inte kvar mellan verktygen). Väggar runt en kontur ritas med
verktygets referenslinje och medurs, så att *Ute* lägger väggarna
innanför konturen och *Inne* utanför. Hela konturen kommer först för
väggar, sidan först för markens linjer. En sida slutar där kedjan viker
mer än 35°. Stödmuren läggs utanför objektet när insidan är känd, annars
med linjen i mitten. Väggarnas liv följs inte i väggverktyget. En båge
följs som korta raka bitar (bågar i väggar och markobjekt blir många
korta delar). Spöet fungerar inte i 3D eller på ritningsbladen.
`setLabelAngle` sparar också 0, så att en vågrät littera inte vrids när
förvalet ändras.

*Gjordes inte:* bågar ur kedjor (de följs som raka bitar), spöet på
ritningsbladen och i 3D, ett skrivet avstånd från kanten (förskjutning),
hål i 2D-formen runt en yta med hål. Klickjämförelsen kördes inte; nya
steg i granskningen.

### Granskning efter 0.10.22 ✓ (0.10.22.1)

Utan nya funktioner: Carl Augusts svar C om 0.10.22 (inget snäpp mot
höjdkurvorna i planen, men mot marken i sektion och fasad), klicksteg
för 0.10.20.1, 0.10.20.2 och 0.10.22, mätning av snäppet och spöet på en
stor plats, och `commandLine.ts` och `planView.ts` delade.

*Gjord 28 oktober (eftermiddag), samma format (21). Det syns, så den
heter 0.10.22.1. Testerna: 648 → 650, ca 17 s. **Höjdkurvorna** ligger
kvar i snäppets lista men bara för smartspöt (`wandOnly`), så en stödmur
längs en höjdkurva går som förut; i sektionen och fasaden snäpper man mot
marklinjen (*På marken*, på linjen utan ändpunkter i rutnätets steg).
**Klickjämförelsen** fick 43 steg: punkten, texten och knäcken dragna på
väggens littera, delen Littera, det generella littrat med två ledare,
ram, understruken, löpnummer, lodrät, lista och en borttagen ledare,
vridningen i stilmallen, och spöet i Vägg (hovra, Tab, Tab, klick),
Markera (klick, Tab, klick), Mark (stödmur längs sidan) och 2D (form runt
bjälklaget). Den visade två småsaker som rättades: **Tab direkt efter
ett klick** gjorde inget (förslagen töms efter klicket och räknades om
först vid nästa musrörelse); och när **litterans grepp** ligger på
varandra (en rak ledare har knäcken i punkten) tog knäcken greppet, nu
punkten. Ett steg från förra granskningen (*stäng Visa* med Esc) stängde
inte menyn, så den låg över ritningen i stegen efter; rättat i skriptet.
Med snäppet oförändrat är 528 steg lika mot 0.10.22 och de 11 som skiljer
är de två rättelserna; med svar C skiljer stegen från gropens andra hörn,
som förut drogs till en höjdkurva. **Mätt**: 1,2 miljoner noder ger
105 000 kurvbitar i snäppets lista (10–40 ms att bygga, 40 ms för
rutnätet första gången); spöets `faceAround` tog 81 ms per hovring med
1040 höjdkurvebitar, nu 17 ms med en `BoxIndex` för skärningarna.
**Filerna**: `commandLine.ts` 623 → 542 (`shellList.ts`, `shellMenus.ts`),
`planView.ts` 591 → 403 (`planInput.ts`, `zoomHistory.ts`).*

*Claudes val:* höjdkurvorna hålls kvar i listan med en flagga i stället
för att tas bort, så att spöet kan följa dem; Justera och markörerna
hoppar också över dem. Marklinjen snäpps som en kurva (inga ändpunkter
och mittpunkter i varje steg, som höjdkurvorna i 0.10.22). Punkten går
före knäcken bara när de ligger inom samma tolerans.

### 0.10.23 Smartspöt del 2 ✓

Claudes förslag 28 oktober, godkända med *kör* för 0.10.22, och svar E om
0.10.22 (riktiga bågar). Byggd 28 oktober (eftermiddag) på *Kör*, samma
format (21).

- **E Bågar ur kedjor** (`fitArcs`): minst tre korta bitar som viker
  lika åt samma håll och ligger på en cirkel blir en båge; i väggar,
  markobjektens linjer, 2D-former, takfall och håltagningar
- **G Bjälklag**: innanför väggarna (klick i rummet), ur takets, en
  2D-forms eller en sluten ytas kontur, innanför ytterväggarna; med
  *Håltagning* ett hål ur konturen
- **H Tak**: takfall över väggarna (husets kontur) eller bjälklaget, med
  takfoten utanför; snabbvalen över den omslutande rektangeln
- **I Markyta och ramp**: runt huset, ur en 2D-form eller ett objekt,
  mellan linjer (inom fastighetsgränsen); ramp och väg längs en sida fanns
  redan (0.10.22) och får nu bågar
- **K 2D-linje**: längs en kant eller kedja (öppen; runt en kontur sluten)
- **L Littera**: klick på ett objekt ger en littera med verktygets text
- **M Mått**: en måttkedja över väggen, öppningarna och de anslutande
  väggarnas liv

*Claudes val:* en båge kräver minst tre bitar, högst 25° per bit, bitar
högst tre gånger så långa som den kortaste och 1 mm (plus 0,1 promille av
radien) från cirkeln; en sluten kedja utan hörn på en cirkel blir två
halvcirklar. Bjälklagets och markytans konturer har inga bågar, så där
blir bågen korta raka bitar. Takfallet har takfoten vid kanten närmast
markören och stiger inåt; takfotens kontur är husets kontur förskjuten
med takfotssprånget (gering i hörnen). Snabbvalen läggs över den
omslutande rektangeln också när konturen inte är en rektangel. Litteran
hamnar 8 mm (papper) snett upp till höger, med verktygets text, sort och
vridning; Shift samlar flera objekt som får var sin littera (inte en
littera med flera ledare). Måttkedjan ligger 8 mm (papper) utanför livet
och tar med båda liven på varje anslutande vägg (också i hörnen, där det
blir väggtjockleken); mått som hamnar inne i en anslutande vägg (insidan
i ett hörn) tas bort i ändarna. En öppning måttsätts med sin vägg.
Höjdkurvorna stänger inga ytor för spöet (de korsar allt på
situationsplanen). I 2D kommer kanten före ytan när båda finns.

*Gjordes inte:* bågväggar måttsätts inte, och väggar runt en bågvägg
följer den som förut; en båge av två bitar räknas som ett hörn; bågar i
bjälklagets och markytans kontur; spöet på ritningsbladen och i 3D; ett
skrivet avstånd från kanten. Klickjämförelsen kördes inte; nya steg i
granskningen.

### 0.10.24 Bågar i bjälklagets och markytans kontur ✓

Carl August 28 oktober (kväll): han provade spöet mot en bågformad
yttervägg och konturen följde den; skillnaden mot en riktig båge syns
först när konturen ändras. "Gör det som är bäst för framtiden, kör."
Byggd samma kväll, samma format (21): `bulges` är frivilligt på
bjälklaget och markytan, som på håltagningen och markobjektens linjer.

- **Formatet**: `bulges` (pilhöjd per kant, 2D-formens regel) på
  `SlabParams` och på `GroundParams` för markytan (samma fält som linjens
  bågar; en markyta har ingen linje). En kontur av två punkter med bågar
  är en cirkel, som håltagningen
- **Ytorna**: konturen går via `shapePoints` där den blir en yta (planen,
  3D, klick i ytan, urgrävningen under bjälklaget, litterans area)
- **Verktygen**: *Båge* i bjälklagets polygon också för konturen;
  markytan som *Polygon* med *Båge* och *Klar med konturen* (Enter,
  dubbelklick, första hörnet)
- **Spöet**: `fitArcs` på konturen i Bjälklag och Markyta (moturs med
  bågarna vända när ytan går medurs); *Ur väggarna* urbockat ger bågar
- **Modifiera**: bjälklagets och markytans kontur går genom 2D-formens
  väg (`shapeOf`, `shapePatch`), så Böj, Räta ut, Avrunda, Fasa, Förskjut
  med flera kanter och dragbara punkter följer med; den gamla raka vägen
  (`hasEditableOutline`, valen `roof*`, `roofId`) är borttagen

*Claudes val:* ingen ny formatversion (frivilligt fält, som 0.10.19).
Äldre bjälklag och markytor behåller sina korta raka bitar; det finns
ingen knapp som gör om dem till bågar (rita om med spöet, eller Räta ut
och Böj). Spegling vänder pilhöjderna som för hålen. Markytans polygon
sluts på tool-byte som linjerna avslutas (skapas om den går att sluta).

*Gjordes inte:* bågar i rummets sparade kontur (`Space.outline`, ur
väggarna som förut) och i `insideWalls` (bjälklag ur väggarna följer
väggarna och ritas som väggarna ger dem). Klickjämförelsen kördes inte;
nya steg i granskningen (bjälklag med båge i verktyget, Böj på konturen,
markyta som polygon).

### 0.10.25 Platsen som modellflik ✓ · *nytt format (22)*

Beslutat 28 oktober i materialutredningen (planeringssession), i den här
ordningen före materialen så att illustrationsplanen finns när de får sin
färg. Byggd 28 oktober (kväll) på *Kör*, format 22.

- **Platsen** som modellflik bredvid våningarna, för situationsplan,
  markplaneringsritning och illustrationsplan; allt ses ovanifrån, utan
  snitthöjd. Platsens meny tar över dialogen Platsen (*Inställningar…*)
- **Markobjekten** och det som kommer ur Höjdkurvor hör till Platsen, inte
  till våningen närmast ±0; i våningsplanerna visas marken som kalkering
  (*Visa → Kalkera → Platsen*)
- **Vyer** av Platsen med tre förinställningar: *Situationsplan*,
  *Markplaneringsritning* och *Illustrationsplan*, och vykategorin på
  vyn (materialen i 0.10.26 ritas efter den)
- **Husets kontur** på situationsplanen (parkerat 26 oktober) och taken
  från alla våningar

*Claudes val:* Platsen ligger i våningslistan (`site: true`, id
`platsen`, sist, golvet vid ±0), så att vyer, verktyg, urklipp, blad och
markering fungerar som på en våning; `buildingStoreys` och `storeysUp`
räknar bara husets våningar (nya våningar, nivåmarkörer, rumsnummer, Page
Up och Page Down, tak på andra våningar). Snitthöjden är oändlig, så taken
ritas som sedda ovanifrån och väggar på Platsen som vy, men
**stödmurarna ritas snittade** (fyllda) hela vägen, som på en
markplaneringsritning (rör frågan om 0.10.16). Husets kontur är
ytterväggarnas utsida på alla våningar, 0,35 heldragen utanför taken och
0,18 streckad under dem (inte en penna i stilmallen än); släcks med *Husets
kontur (på Platsen)* under Visa. Marken i våningsplanerna är en
kalkering, inte ett eget val: den tonas, går inte att klicka på och
ersätter annan kalkering medan den visas. Verktyget Mark öppnar Platsen
och lägger alltid markobjekten där; urgrävningen tar bjälklaget på den
lägsta våningen som har ett där man klickar, och marken runt huset
utgår från våningen närmast ±0 (`groundStorey`). Markobjekten och
platsens objekt (`onSite` på typen) går inte att flytta till en våning;
annat går att flytta och kopiera till Platsen. Platsen har inget namn,
golv eller höjd att ändra och går inte att ta bort. Förinställningarna:
Situationsplan 1:400 utan markörer och stödmurarnas littera,
Markplaneringsritning 1:200 med de branta slänterna, Illustrationsplan
1:200 utan höjdkurvor, mått, generell littera, stödmurarnas littera och
markörer; alla i förslaget som visas från början, utan jämförelse. En
vy som sparas om behåller sin kategori. Efter *Lägg in platsfil* öppnas
Platsen.

*Gjordes inte:* koordinaterna i SWEREF på situationsplanen och i
exporten (hör till *Koordinater, SWEREF och sol*); kategorin ändrar inget
i ritningen än (materialen i 0.10.26); en egen penna för husets kontur;
*Bara den här våningen* i 3D heter så också på Platsen och visar då bara
platsens objekt. Klickjämförelsen kördes inte (skriptet öppnar dialogen
Platsen med `bacchus.site`, och efter *släpp platsen* öppnas Platsen, så
stegen därefter skiljer mot äldre byggen); nya steg i granskningen.

### Utredning: material i stället för fyllningar ✓

Gjord 28 oktober (planeringssession). Beslutet står i
`cad-apa-synpunkter.md` och i de fyra versionerna 0.10.25–0.10.28: ett
material bor i stilmallen med en representation per vykategori, objektet
pekar på ett material eller har *Eget*, och teckenförklaringen läser
materialen ur bladets vyer.

### Granskning efter 0.10.25 ✓ (0.10.25.1)

Utan nya funktioner: det Platsen glömde på några ställen, dubbletter,
grannkoll där allt prövades mot allt, och klicksteg för 0.10.23–0.10.25.

*Påbörjad 28 oktober (sent) och gjord 29 oktober, samma format (22).
Det syns, så den heter 0.10.25.1. Testerna: 676, ca 12–16 s.
**Platsen räknas inte som våning** i Filtrera och markera (*Alla
våningar* bara med flera husvåningar), 3D (*Bara den här våningen* göms
med en våning) och låsta rums- och dörrnummer; `storeysUp` borttagen
(`storeysUpFrom`). **Verktyget Rum** räknade hålen per dokument och
tillstånd men inte per våning, så ett byte av våning utan ändring gav
förra våningens rum: cachen tar våningen med. **`parse`** känner igen
Platsen på id:t också. **Dubbletter**: skosnöresformeln fanns på ett
tiotal ställen, nu `signedArea`; `nearestEdge`, `ccw` och `offsetEdge`
samlade i `geometry/` (`core/roofEdit.ts` borta). **Grannkoll**: husets
kontur på Platsen prövas bara mot taken vars ruta rör den, och måttkedjan
med spöet bara mot väggarna som når fram. **Zooma till allt** och
fasadmarkörens *Följ byggnaden* räknar med bågarnas buktning.
**Klickjämförelsen** fick 43 steg för 0.10.23–0.10.25 (spöet i Takfall,
Mått och Littera, bjälklag med båge och Böj, markyta som polygon med
båge på Platsen, 3D, kalkeringen, Platsens meny med en situationsplan och
Egenskaper) och anpassades till Platsen (markobjekten markeras där, samma
utsnitt efter varje byte, dokumenten jämförs utan Platsen mot äldre
byggen). Den visade inget fel i koden; tre saker i skriptet rättades
(*Båge* i Mark ligger kvar från rampen, så den sätts i stället för
växlas; zoomen efter bytet från 3D; klicket på det vridna hålet låg
utanför hålet och snäppte till bjälklagets kant, så *Spegla* vände hela
bjälklaget kring kanten — rätt beteende, fel klick; och stegen för
0.10.23 ritade takfallet på Platsen, dit stödmuren fört vyn — husets
verktyg spärras inte där, en fråga till Carl August). Mot 0.10.25 skiljer bara de
avsiktliga stegen (dialogen Filtrera, fasadmarkören runt bågen); mot
0.10.22.1 skiljer bilderna från *släpp platsen*, eftersom markobjekten
inte längre ritas på Plan 1, men dokumenten är lika.*

*Claudes val:* `reversedChain` behåller första hörnet när en kontur vänds
moturs (testet för 0.10.17 låste den gamla ordningen utan skäl).
`dimWall.nearWall` använder samma räckvidd som kedjans eget test, så
resultatet är detsamma.

### 0.10.26 Rampen och stödmuren ✓

Inkorgen 29 oktober, före materialen på Carl Augusts begäran ("Ta rampen
och stödmuren först, sen 3D-kontroller och sen material"). Byggd samma
dag, samma format (22): de nya fälten är frivilliga.

- **Slänt per sida** på rampen (`leftSlope`, `rightSlope`); tomt följer
  rampens `slope`, som också gäller ändarna
- **Marken längs en stödmurskant** följer rampens kontur skarpt och går
  rakt ned till befintlig mark (den var vågig: rutnätets trianglar tonade
  över kanten)
- **Stödmurens skarvar**: kantlinjerna i 3D bara i ändarna och i riktiga
  hörn

*Claudes val:* de skarpa kanterna gäller alla ramper och markytor (inte
runt huset och under bjälklag), också slänternas kanter, där slänten nu
börjar vid kanten i stället för en ruta in. De räknas inte in i den
färdiga marken (rutnätet) utan läggs på där den ritas: 3D-nätet skärs
längs konturen, marklinjen i sektionerna och linjerna på marken i 3D
läser höjden med kanterna. Utanför en stödmurskant ligger marken som den
var utan objektet (de andra objektens ändringar kvar). Planens
höjdkurvor, slänternas markeringar och volymerna räknas som förut på
rutnätet. Ett hörn på stödmuren får en kantlinje när muren viker mer än
20°. En stödmur kunde redan ha riktiga bågar (*Båge* i verktyget Mark och
Böj i Modifiera, sedan 0.10.19); det som syntes var kantlinjerna i varje
utplattad punkt.

*Gjordes inte:* höjdkurvorna i planen vid en stödmurskant (de följer
rutnätet och kan ligga en ruta fel; i 3D tas de bort där), och
lodytan har ingen egen kulör (markens). Ingen knapp som gör om en
stödmur ritad med många punkter till bågar (frågan om 0.10.24 gäller
också den). Klickjämförelsen kördes inte.

### 0.10.27 Styrningen i 3D ✓

Inkorgen 29 oktober. Byggd samma dag, samma format (22). Som i ArchiCAD:

- **Mittenknappen panorerar**, Shift + mittenknappen snurrar (orbit)
- **Vänsterklick markerar**, och ett vänsterdrag är en markeringsruta som
  i planen: från vänster till höger det som ryms helt, från höger till
  vänster allt som nuddas
- **Högerklick öppnar menyn** (högerdrag panorerade förut)
- **Utan mittenknapp**: Mellanslag + dra panorerar och Mellanslag +
  Shift + dra snurrar (Carl August sa "kör" på Claudes förslag)

*Claudes val:* rutan jämför objektets omslutande rektangel på skärmen
(hörnen räknade till skärmen), som planen gör med sina rektanglar; ett
objekt som delvis ligger bakom kameran ryms aldrig helt, och det en
sektion klipper bort räknas inte. Markobjekten tas med sina konturer på
marken, rummens golv inte (som med ett klick). Shift eller Ctrl lägger
till, som i planen. Ett drag som börjar på något markerat flyttar det som
förut, och greppen dras som förut. Dubbelklick med mittenknappen visar
hela modellen, som i planen. Ctrl + mittenknappen snurrar också
(kamerastyrningen gör så). Med fingret snurrar vyn som förut (telefonen
är inget mål). En tipsrad om styrningen visas när 3D-vyn öppnas första
gången i en session.

*Gjordes inte:* ingen förhandsvisning av vad rutan tar medan den dras
(planen har ingen heller). Ingen inställning för knapparna.

### 0.10.28 Material, mark först ✓ · *nytt format*

Beslutat 28 oktober (svaren A–E). Byggd 29 oktober på "kör nästa
version", delad som överlämningen föreslog: marken nu, bjälklag och tak i
0.10.28.2 (förut 0.10.28.1). Format 23 (projekt från 0.10.27 öppnas inte).

- Ett material i stilmallen: namn, kategori (mark först) och representation
  per vykategori: planen (fyllningen, med opaciteten), illustrationsplanen
  (färg, opacitet) och 3D (kulör)
- Objektet pekar på ett material eller har *Eget*; *Fyllning* heter
  *Material* för markobjekten; opaciteten och vridningen går att överstyra
  per objekt. Mönstrets utgångspunkt (första hörnet) och status är objektets
- Fyllningspanelen är redigeraren för planrepresentationen; förslagen Gräs,
  Grus, Hårdgjort och Vatten och de sparade fyllningarna blev material
- Markyta, slänter, ramp och stödmur. Väggar med lager i 0.11.1

*Claudes val:* objektet behåller en kopia av planens fyllning (som de
sparade fyllningarna), så att ett borttaget material lämnar det som
syntes. Det man ändrar i panelen för ett objekt med material ändrar
materialet (alla objekt med det); vill man ändra bara ett objekt väljer
man *Eget*. Ett nytt projekt har åtta markmaterial: Gräs, Grus, Asfalt
(förut Hårdgjort), Plattor 300, Tegel, Vatten, Betong och Mark, med
färger för illustrationsplanen och 3D. Tegel, Betong, Plattor 300 och
Mark finns kvar som förslag för egen fyllning (för detaljer i 2D).
Materialen visas för alla objekt med fyllning (2D-former och rum ser
alla), men markobjekten ser bara markens. Stödmuren ritas snittad med
materialets fyllning och konturen 0,35, och svart utan material. I 3D
färgas marknätets trianglar efter sin mitt, markytor och ramper ovanpå
sina slänter. Illustrationsplanens förinställning döljer marken (sedan
0.10.25), så 3D visar ingen mark i den vyn.

*Gjordes inte:* brytlinjen har ingen yta och fick inget material. Snittet
och vyn i sektion och fasad (fälten i materialet kommer med bjälklag och
tak i 0.10.28.2; marken i sektionerna är jorden, som förut). Ingen lista
över materialen i stilmallens dialog (frågan om 0.10.14). Slänternas
yttre kant i 3D följer rutnätet. Klickjämförelsen kördes inte.

### 0.10.28.1 Materiallistan ✓ · *nytt format (24)*

Svaren 29 oktober på frågorna om 0.10.28 (planeringssessionen på
eftermiddagen, som också satte ordningen nedan). Byggd 29 oktober. Format 24
(projekt från 0.10.28 öppnas inte): kategorin blev två kryssrutor.

- En gemensam materiallista i stilmallens dialog: byta namn, ta bort, ordna
  och lägga till; kryssrutorna *Mark* och *Byggnad*, och listan i panelen
  visar de material som passar objektet
- Fler material i ett nytt projekt: Jord, Stenmur, Singel, Täckbark, Trall,
  Planteringsyta, Stenmjöl, Gatsten och Aluminium. Betong, Tegel och Trall
  båda; Aluminium byggnad
- Panelen som i 0.10.28: en ändring ändrar materialet för alla, om man inte
  väljer *Eget*
- Stödmurarna ritas ovanifrån utan snitt i Platsens vyer, med materialets
  ytfyllning
- Marken i 3D i alla Platsens vyer, också illustrationsplanen
- Orbit med Shift och mittenknappen i valfri ordning

*Claudes val:* listan står först i stilmallens tredje kolumn (Material,
linjetyper och fyllningstyper), en rad per material med namnet, pilarna
och *Ta bort* överst och kryssrutorna och tre färger under: planens
färg (fyllningens, eller mönstrets linjer), illustrationsplanens och
kulören i 3D. Mönstret i planen ändras i objektets panel, som i 0.10.28;
listan har ingen egen redigerare för det. Ett nytt material är grått,
helt och för marken; ett material som sparas ur en 2D-form får inga
kryssrutor (bara 2D-former och rum ser det tills man kryssar). Fyra nya
inbyggda fyllningstyper för de nya materialen: Gatsten 100 (i förband),
Stenmur (stora block), Trall (brädor 145) och Singel (prickar på
papper). Stödmuren utan material på Platsen är bara konturen (förut
svart). På Platsen tänds marken i 3D fast *Höjdkurvor* är släckt under
Visa; kurvorna i 3D släcks då. Shift mitt i ett drag byter mellan
panorera och snurra från där pekaren står, åt båda hållen (släpps Shift
panoreras vyn igen).

*Gjordes inte:* ingen redigerare för planens mönster i listan.
Klickjämförelsen kördes inte (inget i husets verktyg ändrades).

### 0.10.28.2 Material på bjälklag och tak ✓ · *samma format (24)*

Delad ur 0.10.28 (29 oktober). Mellanstor. Byggd 29 oktober.

- Materialet på bjälklagen och taken (kulören i 3D, fyllningen i planen),
  ur byggnadsmaterialen i listan
- Snittet i sektion (snittfyllning) och vyn i fasad (ytfyllning, kan vara
  tom) i materialet
- Materialets konturpenna i planen

*Claudes val:* inget nytt format: snittet, ytan och pennan är valfria fält
i materialet, och fyllningen och `material` ligger i bjälklagets och
takets parametrar som i rummen. Panelen *Material* för bjälklag och tak
visar byggnadens material; under materialet *Sektion, fasad och kontur*
med tre listor (snittet: *Som stilmallen*, hel färg, skraffering, kors
eller en fyllningstyp; ytan likadant men *Ingen* som förval; konturen:
*Stilmallens* eller en tjocklek) och färgerna. Samma fält i
materiallistan för material med *Byggnad*. Bjälklaget fylls i planen
under snittet (golvet sett uppifrån; det kan bli mycket mönster, men så
gör ArchiCAD), taket där det ligger helt under snittet och hela taket på
Platsen; fyllningen går inte att klicka på, så att ett klick i ett rum
inte markerar bjälklaget. Snittet ersätter stilmallens fyllning för det
som är kvar och nytt, med papperet under och konturen 0,35, men inte för
det som rivs. Ytan gäller fasader, inte sektionernas vy bortom snittet,
och räknas exakt mot det som ligger framför (trianglarna klipps mot ytans
plan, som de dolda linjerna). Mönstret utgår från en punkt per objekt,
så att bitarna av en yta ser likadana ut. Pennan gäller konturen under
snittet; över snittet streckprickat som förut. Nya material: Takpannor
(linjer var 350 mm) och Plåt (falsar var 600 mm), med ytan i fasaden; Betong och
Tegel har sina mönster som snitt, Aluminium grått.

*Gjordes inte:* ytan i sektionernas vy bortom snittet. Materialets penna
för markobjekten. Mönstrets mått (vinkel, avstånd, skala) för snittet och
ytan går inte att ändra; förvalen gäller. Klickjämförelsen kördes inte (husets verktyg ändrades inte).

### Granskning efter 0.10.28.2 ✓ (0.10.28.3)

Mellanstor. Inga nya funktioner utöver dessa:

- Rampens start- och sluthöjd läser den färdiga marken under klicket
- Stödmurens krön ligger jämnt med rampens kant
- Markmodellen förtätas där markobjekt ritas (foten i tänder)
- Markobjekten flyttar inte när en våningshöjd ändras

*Gjord 29 oktober, samma format (24). Det syns, så den heter 0.10.28.3.
Testerna: 707, ca 13 s. **Rampens höjder**: verktyget Mark läser den
färdiga marken (`finishedTerrain` i tillståndet som ritas i) för ramper,
gångvägar, brytlinjer och markytornas förslag; utan markobjekt den
befintliga som förut. **Krönet**: `wallProfile` (nu i
`elements/wallProfile.ts`, för att inte dra en cirkel mellan
`groundGeometry` och `crispGround`) läser marken genom `crispHeight`, de
skarpa kanterna från 0.10.26, så att en punkt 0,7 m in på rampen får
rampens exakta höjd i stället för rutnätets tolkning mellan en nod på
rampen och en utanför; det var det som gjorde avståndet till kanten
ojämnt. Utjämningens fönster (±1 m) krymper symmetriskt nära ändarna, så
att krönet inte ligger 50 mm fel i början och slutet av en mur på 1:10.
**Tänderna**: i stället för att förtäta rutnätet (det hade gett mindre
tänder, inte inga) skärs marknätet längs stödmurens båda kanter som längs
rampernas (`crispShapes` får en form per stödmur, utan lodytor), och
höjden på kanten tolkas ur noderna på samma sida om muren
(`groundBeside`: alla fyra noder som vanligt, tre som ett plan, annars
viktat efter avståndet). Marken utanför muren blir då en jämn yta fram
till muren, och marklinjen i sektionen får ett steg vid muren. Provat i
Playwright mot `dist/` i 3D: foten och krönet raka längs en ramp med
stödmur. **Våningshöjden**: markobjekten på Platsen har sina höjder från
±0 och Platsen flyttas inte (`storeyPatch` sedan 0.10.25); ett test låser
det. Platån runt huset följer golvet som den ska. Om Carl August sett
något flytta behövs en skärmbild. **Städat**: kamerastyrningen i 3D
(mellanslag, Shift mitt i draget, dubbelklick med mittenknappen) ligger i
`view3d/navigation.ts` (`view3d.ts` 621 → 564 rader). Referensbilderna
för markprojektet uppdaterade (stödmurens krön och fot).*

*Gjordes inte:* klickjämförelsen (inget husverktyg ändrat). Höjdkurvorna i
planen räknas som förut på rutnätet.

### 0.10.29 Ritandet ✓

Liten till mellanstor. Shift låser vinkeln man står i; Förskjut med
skrivet värde och avståndet grafiskt vid objektet; verklig och lokal höjd
i våningslistan; Kanter i Förskjut som skrivet antal (fråga 0.10.17,
Carl August 29 oktober: ja).

*Gjord 29 oktober, samma format (24). Testerna: 712, ca 20 s. **Shift**:
`snap()` fångar riktningen när Shift trycks (`held` i `snap.ts`, ur en
snäppning utan Shift) och håller den tills Shift släpps, kedjan får en ny
punkt eller verktyget byts. Claudes val: ett vinkellås (15°-steg,
parallellt eller vinkelrätt mot linjen man känt på) eller en punkt man
snäpper till ger exakt den riktningen, fritt avrundas till hela grader;
markören får gå bakåt längs linjen (riktningen vänds); skärningar och
spårlinjer längs låset snäpps som förut. Gäller alla ritverktyg, Flytta,
greppen och 3D (samma `snap`). **Förskjut**: valen med `atObject` i
`opDefs.ts` (Förskjut, Förskjut kant, Parallell kopia, Förskjut alla
kanter; Claudes val att Parallell kopia och Förskjut alla kanter följer
med) har inget värdefält i smartmenyn. Siffrorna går genom
`Modifier.typeKey` till `ModifyTool.typing` och visas i måttet vid objektet
(`offsetDimension` i `tools/overlay.ts`: en linje med snedstreck från
klicket på kanten till där kanten hamnar, etiketten i accentfärg medan man
skriver). Enter utför åt markörens sida; ett klick med något skrivet
använder värdet åt klickets sida. **Kanter**: ett textfält (`parseEdges`:
heltal, tomt, 0 eller *Alla* = alla); `edgeRun` tar `toward`, och ett
jämnt antal får den extra kanten mot den sida av kantens mitt där
markören är. **Våningslistan**: `storeyLevels` i `navigator.ts`, "Plan 1
– +63,525 / 0,000" med plats, "Plan 2 – 3,000" utan (Carl August: med
tankstreck, så att våningen inte blandas ihop med höjden), på samma rad
som namnet. Provat i Playwright mot `dist/`: Förskjut med 1200 + Enter,
måttet vid väggen, våningslistan.*

*Gjordes inte:* klickjämförelsen (Shift-låset ändrar inget klick utan
Shift). Platsens rad i listan har kvar *markmodell* / *plan mark* utan
tankstreck.

### 0.10.30 Teckenförklaring ✓

Beslutat 28 oktober. Liten till mellanstor. Ett automatobjekt på bladet som
läser materialen hos synliga objekt i bladets vyer och ritar en ruta med
mönstret i vyns skala och namnet; kategorier, ordning, rutans storlek,
egna och bortvalda rader, och *Eget* som "Eget" eller inte alls. Med tre
småfixar från Carl August 29 oktober: kalkera en våning från
projektträdet utan vy, *Ny vy* från en modellflik, och webbläsarens meny
bort där högerklick inte gör något.

*Gjord 29 oktober, samma format (24; en ny elementtyp med egna fält
behöver inget nytt format). Testerna: 716, ca 16 s. **Teckenförklaringen**
är elementtypen `Legend` (`elements/legend.ts`), på bladet som
skalstocken. `buildSheet` räknar `legendSources` ur vyernas ritade
primitiver (objekten bakom dem, så att dolt och bortklippt inte räknas)
och skickar dem i `ViewStates.legend`, bara när bladet har en
teckenförklaring. Claudes val: rutan 10 × 6 mm, text 2,5 och rubriken
TECKENFÖRKLARING 3,5 fet; mönstret i den första vyns skala där materialet
syns, med vykategorin (en illustrationsplan ger materialets färg);
*Alltid* och *Aldrig* per material i stället för fria rader; egna
fyllningar som en rad "Eget" per olika fyllning; ett blad med bara Platsen
får *Markens*. **Kalkera**: `TRACE_STOREY` + våningens id i `trace`
(`tracedStorey`), i våningens och Platsens meny och under Visa (varje
våning, också från Platsen). Fasader och sektioner kalkeras inte (inget
kalkeras i dem). **Ny vy…**: `newViewOf` i `views.ts`, det som visas nu
för våningen eller markören. **Webbläsarens meny**: en lyssnare på
`document` i `menus.ts` som stoppar den utom i textfält, på länkar och på
markerad text. Provat i Playwright mot `dist/`.*

*Gjordes inte:* vykategorier för planer, fasader och sektioner (Mått och
littera, Undertak, Golvplan/ytskikt) med egna och omdöpta kategorier: de
hör till utredningen om stilinställningar per vytyp, eftersom en kategori
är en förinställning; *Undertak* (spegelvänd plan sedd underifrån) kräver
en egen ritning och läggs där som egen punkt.

### 0.10.31 Texturer i 3D och ortofotot på marken ✓

Beslutat 28 oktober (svar E: före piloten). Mellanstor. En bild i
materialets 3D-representation, sparad i filen och upprepad i meter på
markobjekten; kulören där texturen saknas. Ortofotot draperat på marken,
också den ändrade; först undersöks om det inte följer med från Höjdkurvor
eller tappas här. Hör ihop med trädens detaljnivåer.

*Gjord 29 oktober, samma format (24; valfria fält). Testerna: 724.
**Undersökningen:** ortofotot tappades inte här. Höjdkurvor skickar det
aldrig: platspaketet (`Utbyte.platspaket`) har inget fält för det, och
Höjdkurvors överlämning har "ortofotot som underlag i cad-apa" bland
obeslutade idéer. Ortofotot finns i Höjdkurvors zip (`ortofoto/…jpg` med
`_sweref.jgw` och `_lokal.jgw`) och i `senaste.ortofoto` (`bild` som
data-URL, `x0`/`y1` pixelns mitt, `s`, `W`, `H`, `ar`). **Här:**
platspaketets valfria fält `ortofoto` med just de fälten
(`PaketOrtofoto` i `core/siteOrtho.ts`), och för hand bilden med
världsfil i Platsens dialog. `site.ortho` har bildens kanter i zonens
koordinater; `orthoUvMatrix` ger 3D-vyn en affin avbildning från planens
mm till bilden, så att den fungerar med vridning. **Texturen:**
`material.texture` = `{ asset, size }` (mm), en fil i projektet som
underlagen. Marknätets grupper (`colorGroups`) skiljer på kulör och
textur (`lookKey`); kropparna (stödmur, bjälklag, tak) får `texture` och
UV i 3D-vyn (`boxUv`: liggande ytor planens x och y, stående längs ytan
och höjden). Claudes val: ortofotot *Där marken saknar material* som
förval (materialen går före), högst 4096 px för ortofotot och 1024 px för
en textur (nedskalade vid inläsning), bildens sida 1 000 mm som förval
och i mm som andra mått, en världsfil med små tal läses som Höjdkurvors
lokala (meter från nollpunkten, utan vridning) när zonens inte hamnar
över platsen, och en ny bild behåller storleken. Provat i Playwright mot
`dist/` (ortofotot och tegeltexturen på rätt ställe uppifrån, dialogerna,
bildvalet).*

*Gjordes inte:* Höjdkurvors sida (två rader: `ortofoto: s && s.ortofoto`
till `Utbyte.platspaket` i `app.js`, och fältet i `platspaket` i
`utbyte.js` med licensen) hör till Höjdkurvor och görs i en session där;
till dess läggs ortofotot in ur zipen. Ortofotot i 2D (illustrationsplan
på flygfoto) hör till utredningen om underlag i vyn. Texturer på väggar,
rum och andra objekt kommer när materialen utökas till alla objekttyper.
Stilmallen som fil tar inte med texturerna (bilderna bor i projektet).
Trädens detaljnivåer i 0.12.1.

### Utredning: stilinställningar per vytyp och underlag i vyn ✓

Planeringssession 29–30 oktober (ingen kod). Besluten och mockupen står i
synpunkterna (`cad-apa-synpunkter.md`, *Beslut 29–30 oktober*) och i
Claude Design "Stilinställningar – mockup" (tavla 5 är utseendet som
gäller). Uppdelningen i sju versioner, A–G, allt före 0.11; F kan skjutas
in var som helst efter A, och bara A ger nytt format:

- **A. 0.10.32 Tre nivåer med arv** (stor, nytt format)
- **B. 0.10.33 Avvikelser och kategorier i vyn** (mellanstor): ockra
  prick och *Återställ* per rad, *Visa bara avvikelser*, *Återställ till
  kategorin*, *Gör avvikelserna till kategorins förval*, *Spara som ny
  kategori*, punkt efter vynamnet, *Stil för den här vyn…*, *Vyer med den
  här kategorin*, *Ny vy…* som föreslår kategorier
- **C. 0.10.34 Radkontrollerna** (tavla 5; mellanstor; bara utseende) ✓
- **D. 0.10.35 Underlag i vyn** (stor): en våning, Platsen, ortofotot i
  2D, ett arbetsblad, en annan vy, DXF/bild; marken i 2D och 3D per kategori ✓
- **E. 0.10.36 Pennor och ställen** (tavla 3; mellanstor; med penn- och
  linjesystemet) ✓
- **F. 0.10.39 Projektet › Allmänt** (mellanstor; förut 0.10.37)
- **G. 0.10.40 Stilboken ut och in** (mellanstor; två öppna frågor: var
  mallen för nya projekt ligger, och om bladmallar och stämplar följer med;
  förut 0.10.38)

Före F och G (Carl August 30 oktober, svaren på frågorna om 0.10.36):
**0.10.37 Snitt- och konturlinjer i planen** ✓ och **0.10.38 Snitt- och
konturlinjer i fasader och sektioner**, se nedan.

### 0.10.32 Tre nivåer med arv ✓ · *nytt format (25)*

Projektets resurser → vykategori per vytyp → enskild vy, med avvikelser
rad för rad. Stilmallens dialog byggd om till vänsterkantens struktur och
kategoriflikarna. Radkontrollerna är de gamla tills C.

*Gjord 30 oktober. Testerna: 735. Stilboken (`StyleBook`) ersätter
stilmallen i projektet: resurserna och `categories`. Vyn har `category`
och `overrides` i stället för `compare`, detaljnivåerna, `hide`,
`hideDemolished` och `style`; renderarna får en `StyleSheet` som förut
(`sheetFor`). Se UTVECKLING.md, *Stilboken*. Claudes val: pennorna ligger
i kategorierna tills E (de är i praktiken ställen med värden; markörernas
penna i egenskaperna ändras i alla kategorier, som förut i hela
projektet); vyns skala är vyns egen, kategorin har *Skala för nya vyer*;
förinställningarna (Svensk standard, Poché, Färgmarkerad) finns under
*Kopiera från* och ger bara stilen; en fasad, sektion, Platsen eller ett
arbetsblad utan vy får vytypens första kategori och dess visning när man
går dit (förut följde Visa med mellan alla ställen); ändras kategorin
följer visningen med, och det som ändrats under Visa är kvar; en vy som
byter kategori i egenskaperna tar den nya som den är (stilens avvikelser
kvar); en borttagen kategoris vyer får vytypens första; *Importera…* och
*Exportera…* i rubrikraden tar redan hela stilboken (G lägger till
*Mall för nya projekt*), och en äldre stilmall ger sin stil till den valda
kategorin. Ordet *stilmallen* i appen heter *stilboken*. Provat i
Playwright mot `dist/` (dialogen, flikarna och verktygen, Visa,
projektträdets formulär, bladet med Skiss och jämförelsen).*

*Gjordes inte:* allt som hör till B–G (prickarna, *Stil för den här
vyn…*, de nya radkontrollerna, underlagen, ställena, Allmänt med
projektets uppgifter, mallen för nya projekt). *Allmänt* har bara
stilbokens namn. Pennorna visas alla i varje vytyp (filtreras med
ställena i E). Öppningsmarkeringens bredd har fortfarande inget fält.

### 0.10.33 Avvikelser och kategorier i vyn ✓

Ockra prick och *Återställ* per rad, *Visa bara avvikelser*, *Stil för
den här vyn…*, *Återställ till kategorin*, *Gör avvikelserna till
kategorins förval*, *Spara som ny kategori*, punkt efter vynamnet, *Vyer
med den här kategorin*, *Ny vy…* med kategorierna, Poché och Färgmarkerad
som egna kategorier och *Ortofoto* bland markobjektens material.

*Gjord 30 oktober. Testerna: 744. Samma format (25); `ortho3d` på
markobjekten är ett valfritt fält. En vys stil i stilboken är kategorin
som vyn ser ut med (`effectiveCategory`); det man ändrar där räknas om
till avvikelser (`overridesFrom`), så att det som inte längre avviker
försvinner. Se UTVECKLING.md, *Avvikelser och kategorier i vyn*. Claudes
val: en kategori jämförs med sitt förval (förvalskategorin med samma
nyckel, annars vytypens första; samma som *Återställ till förvalet*), en
vy med sin kategori. Pricken sitter på raderna som har ett fält:
visningens fält, kryssen under Innehåll, en åtgärds rad och en penna
(öppningsmarkeringens bredd har inget fält än). *Återställ* syns när
musen är över raden. I en vys stil finns inte kategorins skala, Platsens
sort och *Kopiera från*. *Gör avvikelserna till kategorins förval* frågar
när fler vyer har kategorin. *Spara som ny kategori…* lägger den direkt
efter kategorin. Ändras den öppna vyn i stilboken följer Visa med på de
rader som ändrades; det som ändrats under Visa och inte sparats är kvar på
de andra. *Ny vy* på en våning, fasad eller sektion: *Med det som visas
nu…* (som förut) och vytypens kategorier som de är, med kategorins skala;
namnet föreslås som "Plan 1 – Undertak". Nya kategorier i ett nytt
projekt: för planer *Mått och littera* (utan möbler), *Undertak* (1:50,
utan möbler, öppningssätt, littera och mått) och *Golvplan* (1:50, utan
möbler, öppningssätt och littera); Poché för planer och sektioner,
Färgmarkerad för planer, fasader och sektioner (Färgmarkerad är statusen i
färg: kvar grått, nytt rött, rivs gult streckat). Planens förval är kvar
först. *Ortofoto* visas bland materialen bara på markytor och ramper och
bara när platsen har ett ortofoto; objektet får det som syntes i planen
som egen fyllning, och i 3D ortofotot (markens eget utseende när
ortofotot är *Av*). Provat i Playwright mot `dist/` (prickarna i en vy och
en kategori, *Visa bara avvikelser*, *Återställ* på en rad med Visa som
följer med, *Spara som ny kategori*, listan, punkterna i projektträdet,
*Ny vy → Undertak…*).*

*Gjordes inte:* Undertaket ritas inte spegelvänt (ser uppåt); kategorin
har bara sitt innehåll. *Jämför med*, förhandsvisningen och de nya
radkontrollerna (C) väntar. Prickarna i vytypens rad i vänsterkanten och
på flikarna ("N ändrade" per flik) gjordes inte; antalet står i
verktygsraden och i listan.

### 0.10.34 Radkontrollerna ✓

Tavla 5 i mockupen: tjocklek, linjetyp och färg som runda knappar utan
rullgardinspil, tjockleksraden med eget värde, den sökbara
linjetypslistan med *Lägg till egen…*, färgpanelen med förval, favoriter
i set, färgfält, hex och opacitet, textvalsknapparna, ikonknappar för
återställ och ta bort, sök och *Vanliga/Alla* i panelen. Bara utseende.

*Gjord 30 oktober. Samma format (25); favoritseten är det valfria fältet
`colorSets` i stilbokens resurser. Testerna: 747. Knapparna läggs på de
vanliga fälten efter varje omritning (`ui/style/rowControls.ts`); fälten
finns kvar dolda och får `change`, så dialogens hantering är densamma.
Se UTVECKLING.md, *Radkontrollerna*. Claudes val: knapparna gäller hela
stilboken (pennor, åtgärder, visning, material, fyllningstyper, texter),
inte panelerna för objekt; tjocklekens rad har de vanliga tjocklekarna
(0,13–1,40 och Ingen där den finns) och *Eget* med Enter; färgpanelens
förval är svart, grått, ljusgrått, vitt, rött, ockra och blått; plus
lägger färgen i det valda setet (det första heter *Favoriter* om inget
finns), högerklick tar bort en favorit, och setet byts, döps om och tas
bort i listan i panelen; ett drag i färgfältet sätter färgen när knappen
släpps (en ångring per drag); opacitet finns bara där fältet har en
(åtgärdernas fyllning och bakgrund; pennorna har ingen); *Lägg till
egen…* lägger en linjetyp under Resurser och går dit; sök gäller raderna
i den del som visas; *Vanliga* är förvalet och döljer *Snittet i planen*
och några kryss under Innehåll (husets kontur genom taket, tak på andra
våningar, de streckade dolda linjerna, 3D-vyns linjer och slänter, branta
slänter, beräkningsgrundande fasad, höjdmått, byggnadshöjd, taklutning,
underlag), men aldrig det som är ändrat; resurserna har ingen *Vanliga*.
Pennans egen återställningsknapp (till programmets förval) döljs när
raden har prickens *Återställ*. Provat i Playwright mot `dist/` (alla
tre panelerna på en penna, färgpanelen kvar efter en ändring, favoriter,
draget i färgfältet, textval i åtgärderna, sök, *Lägg till egen…*,
mörkt tema).*

*Gjordes inte:* mockupens ikonknappar för export, import och mall i
rubrikraden (G), förhandsvisningen och *Jämför med* (efter piloten). Visa-
menyn har kvar sina kryssrutor utan symboler (samma nycklar som
knapparna). Panelerna för objekt (egenskaper, smartmenyn) har kvar sina
listor och färgfält.

### 0.10.35 Underlag i vyn ✓

Underlag som del av vyn: en våning, Platsen, ortofotot i 2D, ett
arbetsblad, en annan vy, DXF/bild; under/över, tonad/gråskala/konturer,
procent, *Lägg till underlag…*; följer med till bladet. Dagens Kalkera
blir en genväg som lägger ett underlag. Marken i 2D och 3D per kategori.
Provet: illustrationsplanen på flygfoto.

*Gjord 30 oktober, i en session. Samma format (25); underlagen är det
valfria fältet `underlays` i kategorins visning, och vyns avvikelse
`underlays`. Testerna: 755. Underlagen ritas av `repr/viewUnderlays.ts`
(källans primitiver med underlagets utseende, ursprunget `ViewUnderlay`
utan objektets id); `buildViewPrims` lägger dem under och över vyn, och
`placeView` klipper dem mot ramen. Se UTVECKLING.md, *Underlag i vyn*.
Claudes val: underlagen ligger i **kategorins visning** (en kategori som
Illustrationsplan kan ha ortofotot i alla sina vyer), och en vy avviker
med hela listan som en rad (pricken i stilboken, *Spara i vyn*);
källorna är våningen under och över (relativt där vyn står), varje
våning, Platsen, ortofotot (bara i planer och på Platsen), arbetsbladen
och de andra vyerna; en vy som är underlag ritas **utan sina egna
underlag** (ingen rundgång), och en våning med vyns tillstånd, detaljnivå
och dolda, utan markörer och norrpil (som kalkeringen); **DXF/bild** är
ingen egen källa: *Fil (DXF, PDF, bild)…* i menyn lägger in filen där
man är, som förut (filunderlagen syns i stället och på bladet redan); fyra
sätt: *Tonad* (förval), *Gråskala*, *Bara konturer* och *I en färg*
(kalkeringens egna färg, rött som förval); täckningen 40 % som förval
(kalkeringen hade 30 %) i steg om 5; över ritningen tas vita fyllningar
bort; bilder (ortofotot) blir grå i alla sätt utom *Tonad*; listan ritas
nedifrån och upp i den ordning underlagen lades till (ingen flyttknapp);
krysset *Underlag* under Visa gäller fortfarande bara filunderlagen;
**kalkeringen** i äldre vyer (`trace`) läses som ett underlag (inget nytt
format), och kalkeringens utseende i användarinställningarna är borta;
*Kalkera* i projektträdet lägger och tar bort källan där man är; på ett
blad och ett mallblad finns inga underlag under Visa (bladets vyer har
sina); underlagen hör till Visa, så att ett byte av vytyp utan sparad vy ger
kategorins underlag (förut låg kalkeringen kvar överallt). **Marken i 3D-vyn** är ett eget kryss (`terrain3d`, Platsens grupp);
*Marken* (`Terrain`) släcker höjdkurvorna och marklinjerna, och i en
våningsplan också marken i 3D, som förut. Snäpp mot underlagen är
kalkeringens inställning, med det nya namnet. Provat i Playwright mot
`dist/` (Visa med *Lägg till underlag…*, sättet, över och procent,
*Spara i vyn*, stilboken med ortofotot i Illustrationsplan, ortofotot på
Platsen i 2D) och klickjämförelsen mot 0.10.34.*

*Gjordes inte:* en flyttknapp för underlagens ordning, DXF/bild som egen
källa (en fil som bara hör till vyn), undertaket spegelvänt (efter
piloten). Illustrationsplanen har inget ortofoto som förval i nya
projekt; det läggs till i stilboken.

### 0.10.36 Pennor och ställen ✓

Tavla 3 i mockupen: pennlistan med nummer, prov och antal ställen,
sortering per rubrik (alla tabeller), ställena med sök och automatiska
taggar för vytyp och objekt, byt penna per ställe, *Gå dit*, *Flytta till
pennan…*, ta bort penna utan ställen; samma lista över ställen för
linjetyper, fyllningstyper och material.

*Gjord 30 oktober. Samma format (25); pennlistan är det valfria fältet
`penList` i stilbokens resurser. Testerna: 768. Se UTVECKLING.md,
*Pennor och ställen*. Claudes val: **en penna är en tjocklek och en
färg** med ett nummer; linjetypen hör till stället (den har en egen lista
under Linjetyper). **Ställena behåller sina värden** (kategoriernas och
vyernas penntabell och åtgärdernas kontur, som förut), och ett ställe hör
till pennan med samma tjocklek och färg; så ritas allt som förut, och
inget nytt format behövs. Pennor som ställena har men listan saknar
numreras efter de sparade, efter färg och tjocklek, och listan **låses**
vid varje ändring i stilboken, så att numren inte flyttar. En penna som
ändras tar med alla sina ställen; en ändring till en tjocklek och färg som
en annan penna redan har nekas (med ett meddelande om att flytta ställena
dit). En flytt ändrar inte pennorna (0,25: 59 → 57, 0,18: 169 → 171 i
provet). En penna utan ställen tas bort med papperskorgen, eller alla med
*Ta bort pennor utan ställen*. **Ställena** är kategoriernas pennrader
(de grupper som visas i vytypen) och snittets kontur per åtgärd
(våningar, fasader och sektioner), och i en vy de rader den verkligen
avviker på. Materialens konturpenna och objektens egna pennor är inte
ställen (de är objektens). **Taggarna**: vytypen (plan, platsen, fasad,
sektion, arbetsblad, och Platsens situationsplan, markplanering och
illustrationsplan; *vy* för en vy) och objektet och delen (vägg, dörr,
fönster, snitt, över snittet, mått, markör …); flera taggar ska alla
stämma. *Gå dit* går till raden i kategorin eller vyn i stilboken, som
blinkar (*Alla* slås på, så att *Snittet i planen* syns); i materialens
lista till objektet i ritningen. **Pennraderna per vytyp**: planens snitt
och rummen bara i våningar, höjdkurvorna i våningar och på Platsen,
dörrar och fönster i våningar, fasader och sektioner, markörerna
överallt. **Fasadernas och sektionernas linjer** (`FACADE_PENS`, förut
`PART_PEN` utan rader i stilboken) är en egen grupp, och deras linjetyp
läses nu (förut lästes bara tjocklek och färg). Pennans nummer står först
på varje pennrad i kategorierna och leder till pennlistan.
**Sorteringen** gäller varje tabell med rubrikrad (pennlistan, ställena,
typerna i panelen, bladets fält) och kommer ihåg sig per tabell under
sessionen, inte i filen; tal sorteras som tal. Provat i Playwright mot
`dist/` (pennlistan, en penna med taggen fasad, flytt av två ställen,
sortering på Ställen, *Gå dit*, linjetypernas ställen, färgen på en penna
som ändrar sektionsmarkören i alla kategorier).*

*Gjordes inte:* penn- och linjesystemet i ArchiCAD:s mening (snittlinje
och konturlinje per objekt, öppningarnas oskurna linjer styrda av
väggen, om *Symbol* följer *Snitt*) är inte ändrat; det är frågor till
Carl August i överlämningen. Pennor har inget eget namn (siffror, som
beslutat). Fyllningstypernas ställen tar inte med former och rum med
egen fyllning (de räknas i listan ovanför). Sorteringen sparas inte.

### 0.10.37 Snitt- och konturlinjer i planen ✓

Carl August 30 oktober (svar A–H på frågorna om 0.10.36). Stor, samma
format. Ställen per objekttyp i stället för dörrarnas och fönstrens
klasser *Snitt*, *Vy* och *Symbol*: snittlinje och konturlinje (det
oskurna) för vägg, dörr, fönster, bjälklag, tak, stödmur, möbel och rum,
och sammansatta objekt med flera (fönstrets karm i snitt och kontur, båge,
glas, bleck; dörrens karm, blad, slagbåge). Snittlinjen ger tjockleken,
åtgärden färg och streckning när jämförelsen är på. Öppningarnas oskurna
linjer (vägghålet) tar väggens penna. Den egna pennans *Symbol* följer
*Snitt* när den inte är satt. Över- och undersnitten är kvar som egna
ställen. Pennlistan får också materialens konturpenna, typernas och
objektens egna pennor som ställen (*Gå dit* till objektet). Linjetypen
hör till stället. Ändrade *Snitt*, *Vy* och *Symbol* faller bort (inga
migreringar). Blir den för lång: väggar, dörrar och fönster först.

*Gjord 30 oktober, i en session. Samma format (25); raderna är nya
nycklar i penntabellen. Testerna: 774. Se UTVECKLING.md, *Snitt- och
konturlinjer i planen*. Claudes val: **raderna finns där linjen finns i
planen**: väggens snittlinje (0,35) och konturlinje (0,13, linjerna
under fönstren), dörrens karm (snitt), blad (med glasningen) och
slagbåge, fönstrets karm (snitt), karm (kontur, under- och överkarmen
sedda uppifrån), båge och glas, bjälklagets, takets och stödmurens
snittlinjer, fast inredning (0,25) och lösa möbler (0,18 grå) som
konturlinjer, och rummens kontur (förut en egen grupp). Dörrens karm
(kontur) och fönstrets bleck ritas inte i planen och har ingen rad (de
kommer med fasaderna i 0.10.38). **Bjälklagens, takens och stödmurarnas
konturlinjer är *under snittet*-raderna** (svar H): det oskurna av dem
är det som ligger under snittet, så de fick ingen rad till. Grupperna:
*Väggar*, *Dörrar*, *Fönster* och *Bjälklag, tak, stödmurar, möbler och
rum*, bara i våningar. **Snittlinjen**: `applyStyle` i planen tar
tjockleken ur objekttypens rad (`cutRowOf`: bjälklag, tak, stödmur,
annars väggens; igensatta hål är väggens); med jämförelsen på färg och
streckning ur åtgärdens kontur, utan jämförelse radens färg (eller
åtgärdens när raden är svart) och linjetyp (åtgärdens streckning går
före). En åtgärd utan kontur ritar ingen snittlinje, som förut.
**Åtgärdens färg går före radernas** när jämförelsen är på och åtgärden
har en färg (Färgmarkerad), också på blad, glas och möbler (förut höll
en färgad rad sin färg). Åtgärdernas kontur har ingen tjocklek i
gränssnittet och är kvar som ställe (den gäller fasaderna och
sektionerna tills 0.10.38). Materialets snitt i planen ritar konturen
som snittets (efter mönstret, åtgärdens färg); i sektionerna som förut.
**Hålets oskurna kanter** (under fönstren) hör till väggen i ritningen
(`origin` = väggen), så att väggens egen penna gäller dem; hålets kanter
över och under snittet (`uncutOpening`) har kvar *Dörrar och fönster
över/under snittet*. **Symbolen** följer den egna pennans övre del fält
för fält. **Fasadernas öppningssätt** läser bara sin rad (förvalet är
detsamma). **Egna pennor som ställen**: materialets konturpenna när den
är satt, och varje del (snitt, symbol, över snittet) av en typs eller ett
objekts egna penna som har en tjocklek (penna) eller linjetyp; en del med
bara en färg är inget ställe. *Gå dit* för en typ markerar typens objekt
på den förstas våning. Provat i Playwright mot `dist/` (grupperna i
Våningar › Plan, väggens snittlinje 0,7 i planen, ett objekts egna penna
i pennlistan och *Gå dit*).*

*Gjordes inte:* fasadernas och sektionernas linjer (0.10.38), dörrens
karm i kontur och fönstrets bleck i planen, taklinjerna i snittzonen
(de har takets penna under snittet som förut).

### 0.10.38 Snitt- och konturlinjer i fasader och sektioner

Mellanstor, samma format. Fasadernas och sektionernas linjer
(`FACADE_PENS`) läggs ihop med objektens snitt- och konturlinjer från
0.10.37.

### 0.11 Trappor · *nytt format*

- *Syns också på* per objekt: objektet hör till Platsen eller en våning och
  ritas som vy i det andra (trappan och rampen vid entrén i både
  våningens ritning och markplaneringsritningen) (29 oktober)
- Rak trappa och trappa med vilplan eller sväng (L och U), med steghöjd och
  stegdjup som räknas ut från våningshöjden
- Trappan i plan med snittlinje och gångriktning, i sektion och i 3D
- Håltagning i bjälklaget och enkelt räcke

### 0.11.1 Profilverktyget · *nytt format*

Carl August 22 oktober; före piloten (24 oktober). Stor.

- Pelare och profiler följer planens snitt som de andra objekten (0.10.16,
  Carl August 27 oktober)
- Man ritar en profil och sedan en referenslinje, och profilen följer
  linjen. Ett verktyg i stället för Archicads flera (pelare, balkar,
  räcken): man anger om profilen är generell eller en byggdel (pelare,
  balk, yttervägg …)
- **Rita ett mönster och gör det till en fyllningstyp** (Carl August 25
  oktober): linjer ritade i en ruta (mönstrets upprepning) blir
  linjefamiljer. Samma mekanism som profilen (rita 2D och gör det till
  en definition). Linjerna måste gå vågrätt, lodrätt eller genom rutans
  hörn för att upprepas; bågar blir raka bitar

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
- Förteckning över markförändringarna (Inkorgen 27 oktober): littera och
  namn, status, area i plan, schakt, fyll och netto, berg och jord (m³ och
  procent), lägsta och högsta nya höjd, största lutning, avtagen matjord
  (area × tjocklek, tjockleken en inställning) och en summarad med
  massbalansen för hela projektet

### 0.12.1 3D-vyer

Carl August 26 oktober: före piloten, det är något man kan förvänta sig.
Mellanstor.

- 3D-vyn som en egen punkt i modellfliken, där vyer sparas som perspektiv
  eller axonometri
- Trädmodeller: fem som slumpas vid import och går att byta för markerade
  träd, i tre detaljnivåer (low poly, silhuett, detalj); träd på
  Enscape-nivå efter piloten

### 0.13 Pilotprojektet (proof of concept)

- Carl August ritar själv ett hus, helst ett av sina egna inlämnade bygglov
  (gärna en 1½-plansvilla eller en tillbyggnad), i cad-apa, från underlag
  till plottade blad. Situationsplanen ritas på kommunens grundkarta som
  DXF-underlag och terrängen från Höjdkurvor
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
- **Isoleringsobjekt** för detaljer (Carl August 25 oktober): en linje
  med bredd där isoleringens våg följer linjen. Till dess finns
  fyllningen *Sicksack* för ytor
- **Sparade filter** i Filtrera och markera (0.8.35): spara villkoren
  med ett namn, i projektet eller stilmallen
- **Husets kontur på situationsplanen**, också utan tak: ett helhetsgrepp
  om situationsplanen (Carl August 26 oktober, fråga 23)

### Grafik och markörer (från 0.8 del 3)

- Flera blad i en PDF
- Gör om ett DXF-underlag till 2D-objekt (linjer och texter), i appen
- Mallblad och stämplar mellan projekt: spara som fil och lägg in i ett annat projekt
- En andra 2D-ruta: planen bredvid en öppen sektion eller fasad, där det man markerar i den ena markeras i den andra
- Ritningshuvud enligt BEAst, som ett färdigt mallblad

Grafik:

- Penntabell i stilmallen (pilar och markörer flyttade till 0.8.26): linjetjocklek och färg per sorts linje (hål, karm, båge, foder, sammanfogningar, glas, öppningssätt, marklinje …). I dag gäller fasta värden: 0,13 skraffering, glas och sammanfogningar; 0,18 mått, foder, möbler och detaljer; 0,25 karm, båge, dörrblad och konturer bortom; 0,35 hålens omfattning och fasadkonturer; 0,5 bärande snitt; 0,7 marklinje och sektionsmarkörens ändar
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

- Tak ur en kontur där varje kant är takfot eller gavel (valm och vinkelhus
  som ett objekt, med vinkelrännor); till dess byggs de av takfall (0.10)
- Fler trappformer (spiraltrappa, fri form) och räcken som eget objekt

### Sol och analys på platsen (stor, minst två sessioner)

Carl August 26 oktober: efter piloten. Samma analyser som i Höjdkurvor,
direkt i cad-apa: sol och skugga per vy (datum och tid), skuggstudie,
horisont (behöver höjddata 5 km ut: nytt fält i platspaketet eller hämtning
direkt), skyfall och lutning. Export i SWEREF utöver lokal nolla.

### Fler markobjekt

- Svackdike och utvändig trappa (med 0.11 Trappor)

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
