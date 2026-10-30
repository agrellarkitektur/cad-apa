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
| 0.10 | Tak (format 17) |
| 0.10.1 | Granskning |
| 0.10.2 | Takfot och taket i planen |
| 0.10.3 | Markmodell (format 18) |
| 0.10.4 | Markobjekt del 1 |
| 0.10.5 | Markobjekt del 2 och byggnadshöjd |
| 0.10.6 | Granskning |
| 0.10.7 | Markobjekt del 3 (format 19) |
| 0.10.8 | Marken i ritningarna |
| 0.10.8b | Höjderna i fasaden |
| 0.10.9 | Stödmur del 2 |
| 0.10.10 | Dolda linjer och vyns djup |
| 0.10.11 | Småsaker |
| 0.10.12 | Småjusteringar |
| (0.10.12) | Granskning efter 0.10.12, utan eget nummer |
| 0.10.13 | Höjder i förhållande till våningen |
| 0.10.14 | Fyllningar och opacitet |
| 0.10.15 | Visa och dölja |
| 0.10.15.1 | Granskning efter 0.10.15 |
| 0.10.16 | Snittet i planen |
| 0.10.17 | Linjerna i 2D-formen |
| 0.10.18 | Rampens referenslinje |
| 0.10.18.1 | Granskning efter 0.10.18 |
| 0.10.19 | Markobjektens bågar |
| 0.10.20 | Situationsplanens beteckningar |
| 0.10.21 | Lutande väggar |
| 0.10.21.1 | Granskning efter 0.10.21 |
| 0.10.20.1 | Litteran |
| 0.10.20.2 | Generell littera |
| 0.10.22 | Snäpp och smartspöt |
| 0.10.22.1 | Granskning efter 0.10.22 |
| 0.10.23 | Smartspöt del 2 |
| 0.10.24 | Bågar i bjälklagets och markytans kontur |
| 0.10.25 | Platsen som modellflik (format 22) |
| 0.10.25.1 | Granskning efter 0.10.25 |
| 0.10.26 | Rampen och stödmuren |
| 0.10.27 | Styrningen i 3D |
| 0.10.28 | Material, mark först (format 23) |
| 0.10.28.1 | Materiallistan (format 24) |
| 0.10.28.2 | Material på bjälklag och tak |
| 0.10.28.3 | Granskning efter 0.10.28.2 |
| 0.10.29 | Ritandet |
| 0.10.30 | Teckenförklaring |
| 0.10.31 | Texturer i 3D och ortofotot på marken |
| 0.10.32 | Tre nivåer med arv (format 25) |
| 0.10.33 | Avvikelser och kategorier i vyn |
| 0.10.34 | Radkontrollerna |
| 0.10.35 | Underlag i vyn |
| 0.10.36 | Pennor och ställen |
| 0.10.37 | Snitt- och konturlinjer i planen |
| 0.10.38 | Snitt- och konturlinjer i fasader och sektioner |
| 0.10.39 | Projektet › Allmänt |
| 0.10.40 | Stilboken ut och in |
| 0.10.40.1 | Granskning efter 0.10.40 |
| 0.11 | Trappan (format 26): referenslinje med bågar, kilsteg och vilplan, gånglinje, plansteg, varningar, plan/sektion/3D, hålet, *Syns också på* |

Varje version från 0.8 har ett eget avsnitt med vad som bestämdes, Claudes
val och det som *inte gjordes*. De ligger i arkivet:
[arkiv/PLAN-0.8-0.9.md](arkiv/PLAN-0.8-0.9.md) och
[arkiv/PLAN-0.10.md](arkiv/PLAN-0.10.md). Sök i hela `docs/` (`grep -rn … docs/`)
när en version eller ett val behöver slås upp.

## Framåt

Det här står kvar att göra, version för version. Allt som diskuterats och
bestämts ska stå här, så att arbetet kan tas upp av någon annan (eller i en
ny session) utan att något faller bort.

Klara versioner flyttas till `docs/arkiv/` när en ny huvudversion börjar,
så att den här filen bara har det som står kvar.

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

### 0.11 Trappan ✓ · *nytt format (26)*

Planerat 30 oktober 2026 (beslut i `cad-apa-synpunkter.md`, *Trappan och
räcket: 0.11–0.11.3*). Grundtanken (Carl August): bygg för flexibilitet från
början i stället för "rak trappa och enkelt räcke först". Trappan och räcket
hålls isär. Facit för planen: Carl Augusts *Trappskiss bygglov 1:50*
(L-trappa med kilsteg; det under snittet heldraget, det ovanför
streckprickat med snittlinjen snett över, gångriktning från ring till pil;
i varianten med plansteg är första/sista plansteget i golvnivå streckat; i
våningen ovanför ritas trappan hel upp till sista steget). Bara 0.11 ger
nytt format: fälten för 0.11.1–0.11.3 läggs in som valfria från början.
Stor, kan behöva mer än en session (då på en gren).

- **Referenslinjen ritas i trappverktyget** (raka sträckor och bågar);
  smartspöt längs en linje eller kurva är ett alternativ. Ingen formväljare
  (rak, L, U): formen är linjen. Bredd och vilken sida gånglinjen räknas
  från är inställningar.
- **Svängar** får kilsteg som förval; en sträcka blir **vilplan** med
  *Vilplan härifrån* per punkt i smartmenyn, eller med en växel per sväng
  (kilsteg/vilplan).
- **Gånglinjen**, där stegdjupet räknas: ställbart avstånd, alltid från
  utsidan, förval 300 mm (BBR: gånglinjen 0,30–0,45 m från det yttre
  vangstyckets utsida eller stegänden).
- **Stigningen** förvalt *till våningen ovanför*, annars egen höjd. Antal
  steg ur förvald steghöjd; ändras antal, steghöjd eller stegdjup följer
  resten.
- **Varningar, aldrig spärrar:** stegformeln och BBR:s mått ger röd varning
  i panelen, men trappan går att rita.
- **Början och slut** med sättsteg eller plansteg; första och sista
  plansteget med egen längd, och de räknas som en del av trappan. Plansteg
  i golvnivå ritas med egen linjetyp (streckad).
- **Uppbyggnad** i formatet: *Monolitisk* eller *Byggd* (vangstycken,
  plansteg och sättsteg). 0.11 ritar den monolitiska.
- **Planen:** stilboksgrupp *Trappor* med ställena snittlinje,
  konturlinje, steg under snittet, steg över snittet (streckprickad),
  plansteg i golvnivå, stegnos, gångriktning. I våningen ovanför ritas
  trappan hel.
- **Sektion och 3D:** trappkroppen (sågtandsprofil och undersida).
- **Hålet i bjälklaget ovanför:** automatiskt ur fri höjd 2,1 m; *Rita
  eget* ger en kopplad kontur som kan låsas upp.
- ***Syns också på*** per objekt: trappor, ramper, markytor, stödmurar och
  bjälklag ritas som vy (kontur) på Platsen eller en annan våning, med en
  egen grupp av ställen (*Från annan våning*).
- **Spiraltrappan** förbereds i formatet (byggs i 0.11.3).
- Trappan sparar sina kanter så att räcket har något att haka i.

**BBR och vägledningen** (uppslaget 30 oktober 2026, inte ur minnet):
stegdjupet i gånglinjen bör vara minst 0,25 m inomhus och 0,30 m utomhus
(BBR 8:232); BBR anger ingen steghöjd, utan hänvisar till lutning, längd och
förhållandet steghöjd/stegdjup; stegformeln 2 × steghöjd + stegdjup =
600–650 mm (lämplig steghöjd i bostäder 180–200); fri höjd minst 2,0 m över
stegnosen; bredd i bostäder vanligen 900 mm fri bredd (SS 914221). Trapplan
bör ha minst trappans bredd.

**Claudes val (0.11):**

- Referenslinjen ligger i mitten som förval (som rampens); vänster eller
  höger kant väljs i verktygsraden och i egenskaperna.
- Gånglinjen i en rak trappa ligger i mitten (där finns ingen utsida); med
  svängar 300 från utsidan av svängarna sammantaget (den första svängens
  utsida när de tar ut varandra).
- Kilstegen strålar från det inre hörnet (stegen blir spetsiga där); i en
  båge radiella. En sträcka med *Vilplan härifrån* tar svängarna i sina
  ändar med sig, så att en U-trappa får ett helt vilplan med en knapp.
- Stegdjupet är lika i varje lopp mellan vilplanen, inte i hela trappan;
  stegen fördelas efter loppens längd. Ändras stegdjupet förlängs den
  sista sträckan (bara när den är rak).
- Hålet börjar vid det första steg där stegets ovansida plus den fria
  höjden (2 100) når bjälklagets undersida, och går till trappans slut. Det
  ritas som kant (utan kryss) i planen ovanför, så att trappan syns.
- *Rita eget* hål är *Gör till eget hål*: automathålet blir en vanlig
  håltagning i bjälklaget och trappan tar inget eget. Det kopplade hålet
  som följer trappan vid flytt väntar.
- Snittlinjen i planen (0,25) är samma ställe som trappans snitt i
  sektionerna. Stegnosen ritas bara i Detalj.
- *Syns också på* ritar med en penna (*Från annan våning: konturlinje*,
  0,18 grå), utan text och fyllning; objektet går inte att klicka på där.
- Varningar: stegdjup under 250 (300 utomhus finns i koden men trappan vet
  inte om den står ute), stegformeln 600–650, steghöjd över 200, bredd
  under 900, vilplan kortare än bredden.

**Inte gjort i 0.11:** det kopplade egna hålet (följer trappan, kan låsas
upp), trappans littera och egna penna, utomhustrappa (300 mm), den
byggda trappan (0.11.2) och spiraltrappan (0.11.3; fälten finns).

### 0.11.1 Räcket

Egen utredning först (mockup i Claude Design, ett par tavlor, med all
önskad funktionalitet från början), sedan bygge. Eget objekt, fristående
från trappan: smartspöas dit längs trappans kant, eller ritas med egna
referenslinjer; punkter flyttas manuellt i X, Y och Z. Följer med trappan
vid flytt. Ska kunna byggas ut.

### 0.11.2 Byggd trappa

Vangstycken, plan- och sättsteg som delar med egna inställningar, stegnos,
kontrastmarkering, synliga vangstycken i planen, bygghandlingsgrafiken.

### 0.11.3 Spiraltrappan

Numeriskt läge (inner- och ytterdiameter, grader också över 360,
varvriktning; referenslinjen en genererad helix); planen med snittet rätt
också när den snurrar mer än ett varv.

### 0.11.4 Profilverktyget · *nytt format*

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

### 0.11.5 Dörrar och fönster

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
