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
| 0.11.1 | Räcket: eget objekt med typmodellen (delar och parametrar med formler), längs trappans kant eller ritat, utjämnad eller hoppande vid kilstegen, plan/sektion/fasad/3D, stilboksgruppen *Räcken*, varningar ur BFS 2024:9 och praxis |
| 0.11.2 | Räckestypeditorn: stilboken › Resurser › *Räckestyper* med grupper, förhandsvisning i sex lägen, delträd och delens egenskaper; Shift går före snäppet |
| 0.11.3 | Staket och grindar: räcket på Platsen med höjden ur den färdiga marken, Trappstegat, stolpar under mark och i plint, Längs kant för hål, bjälklag, väggar, ramper och stödmurens krön, ST01–ST03, SP01 och G01, grinden som en sträcka i räcket; räckestypeditorn som tavla 4 |
| 0.11.4 | Byggd trappa: vangstycken, plansteg med stegnos och sättsteg som delar med egna mått och material, öppen trappa, kontrastmarkering, vangstyckena i planen, stegnummer och stegtext i Detalj |
| 0.11.5 | Spiraltrappan: numeriskt läge (inner- och ytterdiameter, grader också över ett varv, varvriktning), referenslinjen en genererad helix, mittpelaren, planen med snittet och det dolda över ett varv, runt hål |
| – | Granskning efter 0.11.5 (31 oktober): räckets filer delade, klickjämförelsen med trappor och räcken; ingen ny version |
| 0.11.6 | Profilen (format 27): profiltypen med delprofiler, ankare och sträckzoner, verktyget *Profil* (linje, lodrät, längs kant), avsluten med inom/utöver och förskjutning, gering, vridning, plan/sektion/fasad/3D, profileditorn, stilbokens flikar Stil/Typer/Allmänt |
| 0.11.6.1 | Profileditorn, resten: Förskjut (kant eller hela konturen), Runda hörn, Mått i ritytan som kan peka på parametrar, Läge som snäpphjälp, provmått i Sträckt, varningen för avslut som skär in |

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
räcket: 0.11–0.11.5*). Grundtanken (Carl August): bygg för flexibilitet från
början i stället för "rak trappa och enkelt räcke först". Trappan och räcket
hålls isär. Facit för planen: Carl Augusts *Trappskiss bygglov 1:50*
(L-trappa med kilsteg; det under snittet heldraget, det ovanför
streckprickat med snittlinjen snett över, gångriktning från ring till pil;
i varianten med plansteg är första/sista plansteget i golvnivå streckat; i
våningen ovanför ritas trappan hel upp till sista steget). Bara 0.11 ger
nytt format: fälten för den byggda trappan och spiraltrappan läggs in som valfria från början.
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
- **Spiraltrappan** förbereds i formatet (byggs i 0.11.5).
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
byggda trappan (0.11.4) och spiraltrappan (0.11.5; fälten finns).

### 0.11.1 Räcket ✓

Utredningen klar och godkänd 30 oktober 2026 (mockup i Claude Design
"Räcket – utredning 0.11.1", fem tavlor; specifikationen i
`cad-apa-racket-utredning.md` i projektets kunskapsbas). Stor, kan behöva
två sessioner.

**Besvarat 30 oktober:** A uppdelning i tre versioner; B ett objekt för
räcke och ledstång, som också ritar staket, stängsel och spaljéer; C
handledaren vid kilstegen *Utjämnad* (förval) eller *Hoppande*; D
smartspöt plus *Räcke längs kanten* i trappans smartmeny; E BFS 2024:9 i
varningarna där det är föreskrift, *avviker från praxis* för det
vedertagna (räckeshöjder, stegdjup, stegformeln, bredd …), i alla
varningar i appen; F 0.11.1 räcket, 0.11.2 editorn, 0.11.3 staket och
grindar; G typen bestämmer vilka mått som får ändras per räcke (kryss
*per räcke*, höjderna kryssade som förval); H grinden är en sträcka i
räcket, redovisas oftast i en uppställning, förteckning valbar.
Typlistan: grupper, egna grupper som kan skapas, döpas om, flyttas och
tas bort, typer dras mellan grupperna.

- **Eget objekt *Räcke*** under Rita, med typ och littera (RÄ; ST för
  staket och stängsel, SP för spaljé, G för grind). Referenslinje med
  punkter i X, Y och Z, raka sträckor och bågar (G).
- **Två sätt att rita:** *Längs kant* (smartspöt; i 0.11.1 trappans
  kanter) och *Ritat* (Z ur det man snäpper till). Läge mot kanten:
  innanför, på kanten, utanpå.
- **Kopplat till trappan:** räcket sparar sträckan längs kanten, så det
  följer trappan. *Lösgör* gör räcket fritt.
- **Höjden mäts lodrätt**, i trappan från stegnoslinjen, på en våning från
  golvet. Övergången lutning–plan: krök (R 150) eller knäck.
- **Typmodellen:** en typ är en lista med delar av fyra slag: *punkt*
  (stolpe, konsol, plint), *längsgående* (handledare, liggare, bottenlist,
  ledstång, spänntråd), *upprepad* (spjälor, ribbor) och *yta* (glas,
  plåt, nät, spaljérutnät). Varje del har profil, material, läge, ändar,
  beteende i trappa och vid kilsteg, ritningens nivå och ställe. Nya slags
  delar utan nytt format.
- **Typens parametrar** med formler (*Ledstångshöjd = Skyddshöjd − 40*),
  egna parametrar och kryss för vilka som får ändras per räcke.
- **Mönster:** modul (största delning, jämnt, förval högst 1 200); i
  trappa följer lutningen.
- **Ledstången:** förlängning i början och slutet (förval 300) och avslut
  (böjd nedåt, mot vägg, rak).
- **Ritningen:** stilboksgrupp *Räcken* (planen: konturlinje, över
  snittet, stolpar, ledstång; fasader och sektioner: snittlinje,
  konturlinje, fyllning). Skiss en linje, Bygglov plus ledstångens
  förlängning, Detalj stolpar och avslut. 3D: delarna svepta längs linjen.
- **Varningar, aldrig spärrar:** BFS 2024:9, 2 kap. 11 § (barnsäkert),
  12 § (ledstång på båda sidor; står på trappan, kan kvitteras), 13 §
  (kontinuerlig ledstång), och *avviker från praxis* för höjderna och
  avvikelse vid kilstegen över 50 mm. Trappans varningstexter skrivs om.
- I 0.11.1 ändras typerna i panelen (tavla 2); editorn kommer i 0.11.2.

**Fynd** (uppslaget 30 oktober): Boverkets nya regler gäller sedan 1 juli
2025, övergångstiden med BBR slutade 30 juni 2026. Räcken och ledstänger
står i BFS 2024:9, 2 kap. 10–13 §, utan mått för steg, räckeshöjd eller
ledstångshöjd (de var allmänna råd i BBR).

**Claudes val (0.11.1):**

- Typen bor i definitionen (`Definition.railing`), som väggarnas och
  dörrarnas typer: littera, och alla räcken av typen ändras med den.
  Inget nytt format. De förvalda typerna läggs i projektet första gången
  ett räcke läggs: **RÄ01** räcke med stolpar (40, högst 1 200 mellan),
  handledare 50 × 40 på Skyddshöjd 900, bottenliggare, spjälor 20 med
  högst 90 öppning och en rund ledstång Ø 40 på *Skyddshöjd − 40*, 70 mm
  innanför, förlängd 300; **RÄ02** glasräcke; **RÄ03** ledstång på
  väggen med konsoler (grupp Ledstänger). Littera med två siffror.
- Räcket på en trappa har trappan som elementets `host` (som dörren i
  väggen): det tas bort, kopieras och flyttas med trappan. Det flyttas
  inte för sig; *Lösgör från trappan* först. Läget är *Innanför* 50 mm
  som förval på en trappa, *På kanten* när det ritas.
- *Utjämnad*: rak lutning längs kanten från loppets första till sista
  stegnos (planen och vilplanen som de är). Avvikelsen mäts i de inre
  stegnosarna; i en vanlig L-trappa blir den över 50 mm på båda kanterna,
  så varningen syns ofta.
- Stegnoslinjen på ett vilplan är plan tills nästa lopps lutning möter
  den (ett stegdjup före nästa sättsteg); på plansteget i golvet likadant.
- Planen: det som står på trappsteg ovanför planens snitt (stegnoslinjen
  över snitthöjden) är streckprickat, som trappans steg. I Detalj ritas
  handledare, ledstång (dubbla linjer) och stolpar, inte spjälorna och
  ytorna. Ledstångens förlängning syns från Normal.
- Stolparna står jämnt i varje rak bit mellan hörn (över 15°); spjälorna
  med lika öppningar mellan stolparna, mätta längs linjen. Ytorna delas
  i linjens brytpunkter.
- 3D: liggarna är raka kroppar per bit (runda som fyrkantiga), stolparna
  åttahörningar när de är runda. Ledstångens avslut (*böjd nedåt*, *mot
  vägg*) sparas i typen men ritas inte än.
- Varningarna (aldrig spärrar): skyddshöjd under 900 i trappor och 1 100
  för ett ritat räcke i gruppen Räcken; ledstång utanför 800–1 000 över
  stegnosen; barnsäkert (11 §): öppningar över 100, ingen fyllning, glipan
  under räcket över 50 över stegnosen (100 över golv), liggare mellan
  150 och 800; 13 §: ledstången går inte hela trappan, förlängning under
  300; den utjämnade handledaren mer än 50 från stegnoshöjden. 12 § står
  på trappan och kvitteras där.

**Inte gjort i 0.11.1:** räckestypeditorn (0.11.2; typerna ändras i
panelen), grupperna som egen lista att döpa om och flytta, delarnas
ordning, ledstångens avslut i 3D, delsträcka (`from`/`to` finns i
formatet men inte i panelen), räcke på Platsen och andra kanter (0.11.3),
*Flytta i höjd* för ett ritat räcke, egen profil (0.11.6). Klickjämförelsen
körd i granskningen efter 0.11.5.

### 0.11.2 Räckestypeditorn ✓

Stilboken › Resurser › *Räckestyper* (tavla 4): typlistan i grupper
(Räcken, Ledstänger, Staket, Stängsel, Spaljéer, Grindar; *Ny typ…*,
*Duplicera*, *Ny grupp…*) med kryssen *Mark* och *Byggnad*, delträdet med
*+ Lägg till del…*, förhandsvisning (Rak, I trappa, På sluttning, Grind,
Planen, 3D) där man klickar på en del, den valda delens egenskaper och
typens parametrar. Egen profil när profilverktyget finns (0.11.6).
Dessutom ur Inkorgen (Carl August 30 oktober, godkänt): Shift-låset går
före snäppet.

**Claudes val (0.11.2):**

- Gruppernas ordning (och tomma egna grupper) ligger i stilboken
  (`railingGroups`), typerna i projektets definitioner som förut. En
  grupp tas bara bort när den är tom; döps den om följer typerna med.
  Typerna i en grupp står i litteras ordning.
- *Ny typ…* frågar efter littera (nästa lediga med gruppens bokstäver:
  RÄ, ST för staket och stängsel, SP för spaljéer, G för grindar) och
  ger delar som passar gruppen: stolpe, handledare eller överliggare och
  spjälor; spaljén ett rutnät som yta, ledstången konsoler. Staket,
  stängsel, spaljéer och grindar får *Mark*, räcken och ledstänger
  *Byggnad*, räcken *Barnsäkert*. *Duplicera* tar nästa lediga littera
  utan att fråga. *Ta bort* bara för en typ som inget räcke har.
- Ett projekt utan räckestyper får RÄ01–RÄ03 med en knapp i editorn (inte
  av sig själv när stilboken öppnas, så att det inte blir ett ångrasteg).
- Förhandsvisningen ritas med typens förvalda värden (inte ett visst
  räckes), med samma geometri som ritningen. *På sluttning* följer
  marken; *Trappstegat* och stolpar under mark ritas från 0.11.3. *Grind*
  visar vilka delar som avbryts (förval för alla delar) innan grindarna
  finns. *3D* är en isometrisk teckning, inte 3D-vyn.
- Delens egenskaper i grupper: profil och material, läge, ändar (eller
  stolpar i hörnen), beteende, under mark (punkter) och ritningen
  (detaljnivå och ställe ur gruppen *Räcken*). *I trappa* går att välja
  för punkter och ytor (spjälorna står alltid lodrätt).
- Typens fält i räckets panel finns kvar, med *Öppna i
  räckestypeditorn…*.
- Shift före snäppet: punkten läggs på låsets linje (ett *i linje med*),
  en vägg ger skärningen med låset. Spårlinjer och vinkelrätt utan Shift
  som förut.

**Inte gjort i 0.11.2:** ledstångens avslut i 3D, *Trappstegat* och
stolpar under mark (0.11.3), egna profiler (0.11.6), typerna i stilbokens
export (de bor i projektet; grupperna följer med stilboken),
förhandsvisningen med ett visst räckes egna värden.

### 0.11.3 Staket och grindar ✓

Platsen (höjden ur den färdiga marken, sluttning *Följer marken* eller
*Trappstegat*, stolpar under mark), andra kanter (hål, bjälklag, ramp,
stödmurens krön, vägg), typerna ST, SP och G. **Grind** (tavla 5): en
sträcka i räcket görs till grind (*Gör till grind…*), typ *Följer
staketet*, en grindtyp eller *Eget här*; bredd (hålmått), hängning
(vänster, höger, par, skjut), utåt/inåt, slagbåge i planen som dörrarna,
grindstolpar, littera; längsgående delar avbryts vid grinden. På Platsen
visas typerna med *Mark* först, på en våning de med *Byggnad*. *Flytta
till våning* byter hemvist. IFC (0.12): IfcRailing, grindar som IfcDoor.
Dessutom (Carl August 30 oktober): räckestypeditorn ska i stort följa
tavla 4.

**Claudes val (0.11.3):**

- På Platsen är punkternas `z` höjden **över den färdiga marken** (0 som
  förval), och linjen får en punkt var 250 mm med marken under
  (`RailPath.base`). Marken är den färdiga i förslaget som ritas, med
  stödmurarnas skarpa kanter (som stödmurens profil), annars den
  befintliga. *Höjden från: Fast höjd* (`heightFrom: 'fixed'`) tar `z`
  mot ±0 som ett ritat räcke på en våning.
- *Trappstegat* gäller per del och bara på marken: varje fack mellan
  stolparna ligger vågrätt på fackets **högsta** punkt, så att inget går
  ned i marken; stolparna når det högre facket. I editorn sätter
  *Mönster › På sluttning* alla delar (visar *Blandat* när de skiljer).
- *Nedgrävd* drar stolpen så långt under marken; *I plint* ger en
  åttakantig plint (minst 250, tre gånger stolpen) från 600 under marken
  till 50 över, och stolpen står 100 ned i den.
- De förvalda staketen (fasta id `t-st01`, `t-st02`, `t-st03`, `t-sp01`,
  `t-g01`) läggs in första gången ett räcke läggs på Platsen och ingen
  typ har *Mark*; RÄ01–RÄ03 som förut när projektet saknar räckestyper.
  *Lägg in förvalda typer* i editorn lägger in de som saknas. ST01 har
  stolpar 70 × 70 nedgrävda 600, två liggare 45 × 70 och spjälor 22 × 70
  med 30 fritt, trappstegat; ST02 sex ribbor 22 × 95; ST03 stolpar Ø 48
  c/c 2 500 i plint, tre spänntrådar och nätet som yta; SP01 stolpar
  90 × 90 och ram 45 × 45 med rutnätet som yta (*Mark* och *Byggnad*);
  G01 sidstycken, liggare och spjälor. Trä är materialet *Trall* tills
  vidare.
- **Längs kant** prövar trappans kanter först (inte på Platsen), sedan
  allt man kan snäppa mot utom räcken och trappor: kedjan genom kanten
  och sidan mellan två hörn som i smartspöt; Shift+klick tar hela. Det
  blir ett ritat räcke (kopierad linje, följer inte objektet). Längs en
  stödmur på Platsen får punkterna krönets höjd (närmaste station i
  murens profil) och *Fast höjd*.
- **Grinden** (`RailingParams.gates`): `at` och `width` längs räckets
  linje (hålmåttet). *Gör till grind…* tar facket mellan de två stolparna
  där man klickade (mellan stolparnas sidor). Grindstolparna (förval 100)
  står med centrum en halv stolpe utanför hålet, i stället för stolparna
  närmare än en tredjedel av delningen (minst 300); de får stolpens
  material och under mark. Liggarna avbryts vid hålet, spjälor och ytor i
  grindens fack, om inte delen har *Vid grind: Fortsätter*.
- **Bladet**: grindtypens delar, eller staketets (*Följer staketet*: de
  delar som avbryts, med stolparna som sidstycken högst 45 breda; *Eget
  här* likadant med egen höjd på typens första parameter). Punktdelarna
  står bara i ändarna. Bladet är vågrätt på den högre änden av hålet, 10
  mm från stolparna (par: två blad med 10 emellan). Typens *Grindtyp*
  (`gateType`) är den nya grindar får; utan den följer de staketet och
  får en egen littera, nästa lediga G med två siffror efter typerna (G02
  när G01 är en typ).
- **Planen**: räckets linje avbryts vid grinden; bladet ritas öppet med
  vinkeln (90°) från gångjärnet (vänster: början av hålet i linjens
  riktning, höger: slutet, par: båda) och slagbågen streckad, åt sidan
  bort från insidan (utåt) eller mot den (inåt). Skjut: bladet 80 mm
  utanför hålet och en streckad linje lika lång bortom dess slut.
  Litteran 260 mm innanför. Grindstolparna syns från Normal; stolparna i
  ST-typerna också (de andra delarna i Detalj).
- **Editorn som tavla 4**: fyra kolumner (typlistan, typen, förhandsvisningen
  med parametrarna, delens egenskaper). Gruppernas knappar (döp om,
  flytta, ta bort) syns när musen är över gruppen, i stället för
  högerklick. Parametrarna som tabell: ett fast värde skrivs i *Värde*,
  en formel i *Formel* (töms den blir det räknade värdet fast). *Ändar*
  är en sammanfattning, inte fält. *I räckets egenskaper* (tavla 4) är
  kryssen *Per räcke* i tabellen.

**Inte gjort i 0.11.3:** räcket följer inte kanten det lades längs (hål,
bjälklag, ramp …; bara trappor), grindarna har ingen förteckning
(0.12, med uppställningarna), spaljéns rutnät och nätet är släta ytor i
3D (inget mönster), grinden ritas inte i fasad och sektion som öppen,
*Dela sträckan här*, *Fyllning för sträckan…* och *Höjd för sträckan…*
(tavla 5), grindens lås och stopp är bara text. Klickjämförelsen körd i
granskningen efter 0.11.5.

### 0.11.4 Byggd trappa ✓

Vangstycken, plan- och sättsteg som delar med egna inställningar, stegnos,
kontrastmarkering, synliga vangstycken i planen, bygghandlingsgrafiken.
Byggd i en session 31 oktober 2026 (Carl August: "kör"), utan nytt format:
fälten `built` fanns valfria sedan 0.11; `contrast` och `contrastWidth` är
nya valfria fält.

**Claudes val (0.11.4):**

- Vangstyckena står **innanför** trappans bredd (bredden är fortfarande
  trappans yttermått, så att räckena och hålet inte flyttar), 50 × 300 med
  överkanten 50 mm över linjen genom stegnosarna och höjden mätt lodrätt.
  Sidorna väljs: båda (förval), vänster, höger eller inga. Vangstycket går
  från första till sista sättsteget (inte över planstegen i början och
  slutet), och nedtill kapas det mot golvet.
- Vid ett vilplan ligger vangstyckets överkant plant och tar ett språng
  på en steghöjd där nästa lopp börjar (linjen genom stegnosarna); vid
  kilstegen är vangstycket en bit per steg, och på insidan nära hörnet
  bara en smal kil (där brukar det stå en stolpe; den kommer med räcket).
- Stegnosen ligger framför sättsteget: plansteget börjar vid stegets
  framkant (som i 0.11) och sättsteget står `stegnos` bakom den; plansteget
  går in under nästa sättsteg. Sättsteg 0 mm ger en öppen trappa, och då
  ingen stegnos. Det första plansteget i golvnivå är golvet och byggs inte.
- Kulörerna utan material: plansteg i trä (#c8a57a), vangstycken och
  sättsteg målade (#ece8df). Inget nytt material *Trä* i stilboken, så att
  befintliga projekt inte ändras; välj ett eget.
- Kontrastmarkeringen gäller också den monolitiska trappan: ingen
  (förval), första och sista steget, eller alla steg (också vilplanens och
  det sista planstegets framkant), 50 mm. I 3D en mörk remsa (2 mm), i
  planen remsans bakkant (kort streckad) i Detalj. Ingen varning och ingen
  paragraf: kravet gäller tillgängliga trappor, och vi har inte slagit upp
  det i BFS 2024:9 än.
- Planen: vangstyckenas insida i Normal och Detalj (inte Skiss); stegens
  framkanter, stegnosen och kontrasten går mellan vangstyckena. I Detalj
  stegens nummer nerifrån (texthöjd 1,8) och *N st à steghöjd/stegdjup*
  (2,0, längs gånglinjen nära början; det minsta stegdjupet). Nya ställen:
  *vangstycke*, *kontrastmarkering*, *stegnummer och text*.
- Varje del är en egen form i 3D, så att sektionerna snittar dem var för
  sig med sina material.

**Inte gjort i 0.11.4:** detaljsnittet med profiler (plansteg infällda i
vangstycket, spår), en egen kulör eller material för kontrastremsan,
pinnar/vangstycke under stegen (mittvange), stegnummer som går att släcka
utan att byta penna. Klickjämförelsen körd i granskningen efter 0.11.5.

### 0.11.5 Spiraltrappan ✓

Numeriskt läge (inner- och ytterdiameter, grader också över 360,
varvriktning; referenslinjen en genererad helix); planen med snittet rätt
också när den snurrar mer än ett varv. Byggd i en session 31 oktober 2026
(Carl August: "kör"), utan nytt format: fältet `spiral` fanns valfritt
sedan 0.11.

**Claudes val (0.11.5):**

- `inner` och `outer` är **diametrar** (som Carl August skrev), inte
  radier. Förval 200 och 1 800 (bredd 800), 360°, **moturs** uppåt.
  Gränser: ytterdiametern minst 600, innerdiametern minst 300 mindre,
  30–1 080°.
- `line` sparar **mitten och en punkt i startriktningen**; referenslinjen
  räknas fram vid varje ritning (inte sparad), så att diametrar och grader
  kan ändras i panelen. Radien är mitt emellan inner- och ytterradien och
  referenslinjen ligger i mitten; gånglinjen följer trappans regel (300
  från utsidan). Sträckor, svängar och vilplan finns inte för spiralen
  (sista plansteget i slutet går att få med *Slut: Plansteg*).
- I verktyget två klick: mitten, sedan riktningen. Ingen formväljare i
  panelen för att göra om en vanlig trappa till spiral eller tvärtom.
- Ett nytt stegdjup ändrar **graderna** (inte diametrarna).
- **Mittpelaren** ritas när innerdiametern är minst 50 mm, i planen med
  trappans konturlinje och i 3D från golvet till trappans topp (målad i den
  byggda trappan, trappans material i den monolitiska). Ingen egen
  pelardel med eget material.
- **Planen över ett varv**: det som ligger mer än ett varv under det
  högsta som syns ritas inte (ovanifrån täcker stegen ovanför). Det
  ovanför snittet ritas alltid streckprickat, också ovanpå det heldragna.
  I våningen ovanför ritas bara det sista varvet. Stegnummer ett varv upp
  står på andra sidan gånglinjen; texten *N st à h/d* utanför ytterkanten.
- **Hålet** är runt med ytterdiametern när det som går genom bjälklaget
  är ett helt varv eller mer (97 %); annars bandet.
- Varningen för bredden (900) gäller också spiraltrappan; den räknas ur
  diametrarna.

**Inte gjort i 0.11.5:** spiraltrappans egna varningar (stegdjup vid
innerkanten, fri höjd under nästa varv), pelaren med eget material och
egen penna, att göra om en vanlig trappa till spiral (eller tvärtom), och
ett räcke kring hålet i bjälklaget som följer cirkeln (det går att rita).
Klickjämförelsen körd i granskningen efter 0.11.5.

### Granskning efter 0.11.5 ✓

31 oktober 2026, inga nya funktioner och ingen ny version (inget syns).

- **Klickjämförelsen** med 51 nya steg för 0.11–0.11.5 (rak trappa,
  L-trappa med vilplan och byggd uppbyggnad, räcken på trappan och ritat
  med grind, spiraltrappa 450°) utan fel; mot 0.10.40.1 är dokument,
  ritning, smartmeny och 3D lika i alla 582 gamla steg (bara panelerna
  och stilboken skiljer, som väntat).
- **Räckets filer delade:** `railingGeometry.ts` → linjen kvar, delarna i
  `railingBody.ts`; `railing.ts` → planen i `railingPlan.ts` (får kroppen
  och grindens littera som argument, så att filerna inte importerar
  varandra) och varningarna i `railingWarnings.ts`; `railingFields.ts` →
  typen i `railingTypeFields.ts`. Alla under 410 rader.
- **Dubbletter:** planens `pointOn`/`zOn` och trappkanternas egen
  höjdinterpolation ersatta med `pathPoint`/`pathZ`; `nearestOn` använder
  `closestOnSegment`. Femton exporter som bara användes i sin egen fil är
  inte exporter längre.
- **Testerna** (843 på 22–29 s) gicks igenom utan ändring: 0.11–0.11.5 har
  6–11 test var, utan dubbletter.

**Inte gjort:** `stairGeometry.ts` (606 rader) och `view3d.ts` (663) är
kvar odelade; de är de största filerna nu. Stilmallsstegen i
klickjämförelsen från 0.8.27–0.8.38 ger `saknas`-fel sedan stilboken
(0.10.32) och borde skrivas om mot stilbokens selektorer (liten).

### 0.11.6 Profilen ✓ · *nytt format (27)*

Utredd 31 oktober 2026 med mockup i Claude Design (*Profilverktyget –
utredning 0.11.6*, fem tavlor); specifikationen och besluten A–H står i
`cad-apa-profil-utredning.md` i projektets kunskapsbas. Byggd i en session
31 oktober (Carl August: "Bygg 0.11.6"). Beslutade (31 oktober):

- **A** Delningen: 0.11.6 profilen, 0.11.7 ändprofilerna och profilen som
  del (räcken, vangstycket), 0.11.8 dörrar och fönster.
- **B** Två sträckzoner per typ (Höjd lodrätt, Bredd vågrätt).
- **C** En delprofil får ligga ovanpå en annan (den tar sin yta ur den),
  kant i kant eller fritt.
- **D** Stilboken med flikarna Stil / Typer / Allmänt; *Stilbok…* och
  *Typer…* i huvudmenyn öppnar samma fönster på var sin flik.
- **E** Uppåt lodrätt (förval) eller vinkelrätt mot banan, och en fri
  vridning kring ankaret.
- **F** Flera ankare per typ, numrerade och namngivna, ett förval.
- **G** Varje ände Inom eller Utöver referenslinjen, och en förskjutning i
  mm (+ ut).
- **H** Stil, Typer och Allmänt ser ut som flikar.

**Claudes val (0.11.6):**

- **Svepningen** (`elements/profileBody.ts`): varje delprofil delas i
  konvexa celler (band mellan hörnens x), varje cell sveps längs varje rak
  bit av banan som en konvex kropp kapad av planen i ändarna och
  knäckarna, och kroppen görs om till programmets 3D-format (lodräta
  extruderingar med sneda ovan- och undersidor). 3D-vyn, sektionerna och
  fasaderna behövde därför ingen ändring. Kantlinjerna levereras för sig
  (skarpa hörn längs banan, och i en rundad kontur de yttersta punkterna;
  konturen i ändarna och i knäckar över 8°).
- **Inom/Utöver** räknas mot hela tvärsnittet: *Inom* lägger avslutet så
  att inget av tvärsnittet går förbi referenslinjens ände, *Utöver* så att
  allt gör det. För lodräta och vinkelräta avslut på en vågrät bana är de
  lika; skillnaden syns för vågräta avslut och vinklar på lutande banor.
- **Förval för avsluten**: lodrätt för gruppen *Pelare och balkar*,
  vinkelrätt för resten (typens *Avslut som förval* går före). En pelare
  har alltid vågräta ändar.
- **Tvärsnittet läggs till höger om banan** (x bort från väggen; en vägg
  som ritas moturs har utsidan till höger). Tab och *Spegla* lägger det på
  andra sidan. En pelares tvärsnitt har x längs planens x; den vrids med
  *Vridning* och med objektet.
- **Höjd och Bredd** är parametrar (*per objekt* som förval) med hela
  tvärsnittets mått; zonerna sträcks lika mycket var tills måttet stämmer,
  och ingen zon krymper under 1 mm. Ändras konturerna i editorn följer ett
  fast värde det ritade.
- **Littera**: typen PR01 …, objektet P01 (pelare), B01 (balk), L01 (list
  och gesims) och TD01 (takdetaljer; T är trädens).
- **Planen**: en pelare ritas med sitt tvärsnitt (snittat med materialets
  snitt, utan snitt svart som bjälklagen); en linje som ett konvext hölje
  per rak bit, under snittet konturlinje och över streckprickat.
  Delprofilernas inre linjer syns inte i planen.
- **Längs kant** kopierar kanten (som räcket längs ett hål i 0.11.3); profilen
  följer inte väggen när den flyttas. Shift tar hela objektets kontur
  (en väggs fyra sidor, inte husets).
- **Typerna** läggs i projektet med den första profilen (som räckestyperna);
  verktygsraden visar de förvalda före dess.
- **Editorn** snäpper till punkterna och till 5 mm. Rektangel, Cirkel och
  Linje gör en ny delprofil; punkterna ändras också i tabellen (x, y och
  pilhöjd för kanten till nästa punkt). *Sträckt* visar tvärsnittet med
  Höjd och Bredd 1,5 gånger det ritade.
- Smartmenyns *Profil längs kanten* och *Pelare här* använder verktygets
  senaste typ och höjd.

**Inte gjort i 0.11.6 (till 0.11.6.1):** editorns verktyg *Förskjut*,
*Runda hörn* och *Mått* (måtten i ritytan som pekar på parametrarna),
*Läge* (kant i kant, ovanpå, fritt) som hjälp när man ritar (det sparas
men styr inget), en egen höjd och bredd att prova i *Sträckt*, och
varningen när ett avslut skär in i en delprofil. Dessutom: smartspöt för
profilen, typen som argument i kommandoraden (`PROFIL PR03`), en profil
som följer kanten den lades längs (*Längs kant/Lösgör*), *Hör till* i
panelen, profilens littera i planen, delprofilernas inre linjer i planen,
och profiltyperna i stilbokens export (räckestyperna följer inte med där
heller). Vågräta och vinklade avslut på en lutande bana räknas exakt;
geringen mellan två olika lutningar är ett plan genom knäcken (exakt).
Klickjämförelsen är inte körd (granskningen efter 0.11.8): smartmenyn på
en väggs kant och hörn har nya val, så smartmenyns hash skiljer där.

### 0.11.6.1 Profileditorn, resten ✓

Det som inte hanns med i 0.11.6 (se ovan). Byggd i en session 31 oktober
(Carl August: "Kör 0.11.6.1"). Samma filformat (27): måtten är ett valfritt
fält i typen (`dims`).

**Claudes val (0.11.6.1):**

- **Förskjut**: ett klick på en kant (inom 8 px) väljer kanten, ett klick
  bredvid väljer hela konturen; nästa klick ger avståndet (från kantens
  linje, eller från konturen med minus inuti), eller så skrivs det ovanför
  ritytan. En kant flyttas parallellt och grannkanterna förlängs eller
  kortas (skärningen med deras linjer; en rak granne i samma riktning
  flyttas med). Bågarna behåller sin vinkel, så en cirkel och en rundad
  hörna förskjuts koncentriskt. En kontur som skulle vända sig ändras inte.
- **Runda hörn**: bara mellan två raka kanter; radien minskas tills bågen
  ryms på den kortare kanten, och går hela kanten åt blir hörnet och
  grannpunkten en. Förvalet är 20 mm.
- **Måtten** är lodräta eller vågräta (efter den största skillnaden mellan
  de två punkterna) och sparas som från–till på axeln och måttlinjens
  läge, inte som punkter, så de följer inte med när en punkt dras (bara
  när ritningen sträcks vid ett mått). Ett nytt värde flyttar allt på
  eller bortom måttets övre (högra) gräns: punkter, egna ankarpunkter,
  zonernas och de andra måttens gränser. Ett mått kan peka på en egen
  parameter med ett tal (inte Höjd och Bredd, som styr zonerna, och inte
  en formel); parametern får måttets värde, och ett nytt värde på
  parametern sträcker ritningen. **Per objekt** väntar (beslut B: fria
  parametrar kopplade till mått senare); kryssen gör ännu inget för dem.
- **Läge**: *Kant i kant* och *Ovanpå* snäpper till alla delprofilers
  punkter och de andras kanter (längs en vågrät eller lodrät kant med
  rutnätet 5 mm); *Kant i kant* skjuter dessutom ut en punkt som hamnat
  inuti en annan delprofil till dess kant (bara punkten, inte kanterna
  mellan punkterna). *Fritt* snäpper till de egna punkterna och rutnätet.
  Linje, Rektangel och Cirkel har valet ovanför ritytan (det nya
  delprofilens läge); Förskjut, Mått, Ankare och zonerna snäpper som
  *Ovanpå*.
- **Sträckt**: fälten Höjd och Bredd (förval 1,5 gånger det ritade, som
  förut) hör till editorn, inte typen, och nollställs när en annan typ
  väljs. Måtten ritas sträckta, med det sträckta värdet.
- **Varningen** räknar hur långt avslutets plan når in längs banan från
  referenslinjens ände (det största för någon delprofil, med *Inom/Utöver*,
  förskjutningen och förlängningen): förbi den första eller sista raka
  biten varnar, och på en rak profil när de två avsluten tillsammans är
  längre än profilen. En delprofil utan kropp ger en egen varning. En
  båge räknas i sina korta bitar, så ett snett avslut på en bågformad bana
  varnar tidigt.

**Inte gjort i 0.11.6.1:** måtten per objekt (en parameter kopplad till ett
mått som sträcker objektet), mått som följer punkterna, sneda mått,
*Förskjut* med flera kanter, och *Kant i kant* för hela kanter (bara
punkterna). Från 0.11.6 kvar: smartspöt för profilen, `PROFIL PR03` i
kommandoraden, en profil som följer kanten den lades längs, *Hör till* i
panelen, profilens littera och delprofilernas inre linjer i planen, och
profiltyperna i stilbokens export. Klickjämförelsen körs i granskningen
efter 0.11.8.

### 0.11.7 Ändprofiler och profilen som del

Ur utredningen (31 oktober, beslut A): ändprofilerna PA01 … (kontur i
sidovyn som skär änden, Inom/Utöver och förskjutning som de enkla
avsluten), profiltyper som delar i räckestyper (med ankare och vridning
kring ankaret) och i den byggda trappans vangstycke. Mellanstor–stor.

### 0.11.8 Dörrar och fönster

Carl August 22 oktober. Stor; delas om det behövs. Foder, tröskel, bleck,
droppnäsa, karm, båge, mittpost och spröjs som profiler (utredningen 31
oktober).

- Redigerbara foder
- Fler öppningssätt för dörrar: skjutdörr, pardörr, vikdörr,
  pendel-/svängdörr och pivådörr. För fönster: över-, under- och
  sidohängda, vertikal och horisontell pivå, skjut- och vikfönster
- Om det ryms (annars efter piloten): dörr- och fönsterhandtag, flera
  bågar och luft i höjd och sida, spröjs

### Granskning efter 0.11.8

Inga nya funktioner. Det som inte gjordes i granskningen efter 0.11.5:
stilmallsstegen i `scripts/jamfor-klick.py` (0.8.27–0.8.38) skrivs om mot
stilbokens selektorer, så att stilboken jämförs igen; `stairGeometry.ts`
och `view3d.ts` delas när 0.11.8 visat hur de växer; klickjämförelsen körs
med profiler, dörrar och fönster.

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
- Fler trappformer (fri form); spiraltrappan och räcket finns i 0.11.1–0.11.5

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
