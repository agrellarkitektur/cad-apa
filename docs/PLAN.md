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
villa i programmet.

## Inriktning (bestämt 20 oktober 2026)

cad-apa är till för svenska arkitekter i små företag med små projekt:
villor, tillbyggnader, ombyggnader och mindre flerbostadshus. Det som behövs
för stora projekt byggs inte: samtidigt arbete i samma modell, installationer
och konstruktion, jättemodeller och andra länders regler. Samma avgränsning
gäller våra egna idéer: det som inte behövs för en bygglovshandling väntar
till efter pilotprojektet (0.13).

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
  med pilotprojektet (0.13). Formatnumret höjs fortfarande vid varje
  formatändring, och en fil i ett äldre format ger ett tydligt meddelande om
  att den kommer från en äldre betaversion. Från formatfrysen gäller
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
| 0.8.0 | Format 5: projektträdet med mappar, 2D-element med Visas i och vy-taggar, mått och text i fasader och sektioner, underlag (PDF, bild, DXF) och arbetsblad, snabbare väggskarvar, ritningsblad med BH90-huvud och smarttext, vyer i skala på bladen, annoteringsskala och Plot/export till PDF i en zipfil |
| 0.8.1 | Granskning utan nya funktioner: transaktioner, väggskarvar, dolda linjer och rum utan algoritmer som växer med kvadraten; `app.ts` och `propertiesPanel.ts` uppdelade |
| 0.8.2 | Fasader och sektioner i en bakgrundstråd, referensritningar i testerna, synpunktsformulärets fel, markering i 3D med Följ sektionen och i sektion, textverktyget på blad, mappräknaren |
| 0.8.3 | Snabbare plan: panorering utan ommålning, cache per objekt, snäpp mot grannar, skraffering i DXF |
| 0.8.4 | Arbetsflöde: skarven mellan 2D och 3D, dubbelklick i trädet, ny vägg från en väggs ände, varningen för sneda vinklar av per objekt, Tab mellan objekt på varandra, flytta med måttbandet |
| 0.7.1 | Betaversion med synpunktsformulär, detaljnivåer och linjetjocklekar i fasad och sektion, glasmarkering och öppningssätt, automatisk taklutning, sektioner begränsade till linjen och klippta i 3D, nya markörer i planen med grepp, längd, vinkel och Rikta efter objekt, streckning från hörnen, varning för nästan raka vinklar, takets kontur i Modifiera, måttband, spårlinjer, kopiera och klistra in mellan projekt, Ctrl + dra, piltangenter, zooma till område och förra zoomen |

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

### 0.8.5 Ritningshuvud · *nytt format*

- Ritningshuvudet hårdkodas inte i bladen: nya blad är blanka och BH90-huvudet
  blir ett eget objekt som läggs på och flyttas. Egna grupper med linjer och
  text kommer med *Smartgrupper* efter pilotprojektet

Mellanstor; en egen småversion så att nya blad blir blanka så snart som
möjligt (Carl August, 20 oktober).

### 0.8.6 Text på bladet

- Fria texter direkt på ett ritningsblad, med samma textverktyg som i vyerna
  (flyttad från *Efter pilotprojektet*; viktig för handlingarna)

Bygger på att bladet har egna objekt (0.8.5).

### 0.8.7 Smartmeny

Synpunkt (20 oktober): *paletten* (Modifiera) och *snabbmenyn* (vid markören)
blir en och samma, **smartmenyn**, i samma tema som smarttext, smartobjekt
och smartgrupper. Hör tematiskt till arbetsflödet i 0.8.4 men kom efter
den; samma filformat (5). Mellanstor, en session.

- Smartmenyn visas så fort något markerats, som snabbmenyn i dag, med
  Modifiera-valen överst för det markerade: för en vägg Flytta, Vrid,
  Spegla, I rad, för flera sammansatta väggar eller linjer också Förskjut
  alla kanter, Avrunda och Fasa där det går. Man ska kunna flytta en vägg
  direkt, utan att först klicka på referenslinjen eller änden
- Klick på en ände, ett hörn eller referenslinjen byter Modifiera-valen
  till det som gäller där (Ny vägg, Sträck, Förläng; Lägg till punkt, Böj,
  Förskjut …), i samma meny. Ny vägg härifrån som förval vid en ände (0.8.4)
  ligger kvar
- Raden med valets namn, värdefält och tips (från paletten) ligger under
  Modifiera-valen och ovanför snabbknapparna (Center, Vänd väggen, Riv …);
  *Mer* fäller fortfarande ut inställningarna nedåt
- Greppet med de sex prickarna till vänster, som på snabbmenyn, så att
  menyn kan flyttas om den skymmer; dubbelklick på greppet låter den följa
  markeringen igen
- Placeringen utgår från det markerade: menyn läggs bredvid det, på den
  sida där det finns plats, och inte över det
- Namnbyte i gränssnittet, inställningarna och dokumentationen: snabbmeny
  och palett blir smartmeny (`PetPalette` och `ModifyPalette` slås ihop)

### 0.8.8 Granskning

Tredje versionen efter förra granskningen (0.8.1) var 0.8.4. Granskningen
föreslås efter bladversionerna och smartmenyn: städa, dela upp stora filer
och leta efter långsam kod (`modify.ts` är 970 rader och delas när
smartmenyn byggs).

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

### 0.12 Export: IFC och DXF

- IFC4-export med egen skrivare: våningsplan, väggar, öppningar, dörrar,
  fönster, rum, bjälklag, tak och trappor, med egenskaper (t.ex.
  Pset_DoorCommon) och uträknad åtgärd i Status. Kontrolleras i Archicad och
  i en gratis IFC-visare
- DXF av vyer och blad, med lager per objekttyp
- Areor för bygglov (BTA, BYA, OPA) ur modellen, så långt piloten behöver

### 0.13 Pilotprojektet (proof of concept) och formatfrys

- Carl August ritar ett av sina egna inlämnade bygglov (gärna en 1½-plansvilla
  eller en tillbyggnad) i cad-apa, från underlag till plottade blad.
  Situationsplanen ritas på kommunens grundkarta som DXF-underlag; terrängen
  väntar
- Varje gång något saknas eller måste fuskas skrivs det ner, och tiden
  jämförs med Archicad
- Det som stoppar piloten åtgärdas i småversioner; resten sorteras in under
  *Efter pilotprojektet*
- Programmet visas för två eller tre andra ensamföretagande arkitekter
- Formatet fryses: från och med nu får varje formatändring en migrering och
  ett test som öppnar en fil i det gamla formatet

## Efter pilotprojektet

Allt här är bestämt och ska byggas, men ordningen och versionsnumren sätts
efter pilotprojektet. Det som piloten visar behövs tidigt går först.

### Grafik och markörer (från 0.8 del 3)

- Beskära en vy på ett blad för hand (i dag visar vyn allt som är ritat i den, och underlagen klipps mot det)
- Fria linjer och bilder direkt på ett blad (texter kommer i 0.8.6), och flera blad i en PDF
- Typsnittet inbäddat i PDF:en (i dag Helvetica, som alla PDF-läsare har)
- En andra 2D-ruta: planen bredvid en öppen sektion eller fasad, där det man markerar i den ena markeras i den andra
- Ritningshuvud enligt BEAst

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
