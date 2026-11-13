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
| 0.11.7 | Ändprofiler och profilen som del: ändprofilerna PA (sidovyn, Inom/Utöver, förskjutning, sträckning med höjdzonen), profiltyper som delar i räckestyper (ankare, vridning) och som vangstycke, PR06–PR08 och PA01 |
| 0.11.7.1 | Profilen, det som inte hanns med: typen i kommandoraden (PROFIL PR03, RÄCKE RÄ02), smartspöt för profilen, Hör till, profilens littera och delprofilernas inre linjer i planen, typerna i stilbokens fil, profildelarna från sidan i räckestypeditorn |
| 0.11.7.2 | Räckets avslut och spiraltrappan: Böjd nedåt och Mot vägg ritade, varningen för fri höjd under nästa varv, mittpelarens material, stegnumren under Visa |
| 0.11.7.3 | Trappan och räcket, det som inte hanns med: utomhustrappa, kontrastmarkeringens material, trappans littera i planen, ändprofilen med vridningen kring ankaret, ytor med mönster (rutnät, diagonalt), staketens typer i kommandoraden |
| 0.11.8 | Format 28: dörrar och fönster, öppningstyperna: karm med rutnät av lufter, förvalda typer med beskrivande namn, dörr- och fönstereditorn, modulmått och fritt karmyttermått med drevmånen, överkant karm, litteraregeln med formel, sparade nummer och Numrera om, verktygen, smartmenyn och egenskaperna, plan, fasad, sektion och 3D ur typen, vägghål och förteckningar i formatet |
| 0.11.8.1 | Dörrar och fönster, synpunkterna på mockupen: hålet modulmåttet + 10 och karmen − 10 (typens karmavdrag), öppningssymbolen mot gångjärnssidan med egna ställen, skjutpilen, fönstrens slag 15° kring gångjärnet, slagbågarna på alla nivåer och egna kryss, spröjs jämnt eller ritade, dörrbladets indelning med material per fyllning, VG01, förteckningens fältmall och fälten på objekten |
| 0.11.8.3 | Dörrar och fönster, Smart och vägghål: vägghålen med verktyg och fyra förvalda typer (ventgaller, nisch, genomföring, rent hål), fasaden som arbetsyta, I liv med fönstret under, Lika avstånd, Mitt i rummet, dagsljuset (rummets andel, smarttexten, glas mot fasaden och per väderstreck), blecklutningen och spegelns raka kant |
| 0.11.8.4 | Granskning efter 0.11.8 (1 november): varningarna uppslagna i föreskrifterna (fri passage, säkerhetsglas, barnsäkra fönster, utrymningsfönster, öppen trappa), `stairGeometry.ts` och `view3d.ts` delade, klickjämförelsen mot stilboken och med profiler, dörrar och fönster |
| 0.12 | Exportdialogen och PDF: trädet med format per rad, sökrutan, exportuppsättningar (också i mallen, `EXPORT Bygglov`), filnamnsmallar med smarttext, mappen på datorn eller zip, förhandslistan, PDF med lager, dokumentegenskaper, samlad fil med bokmärken och arbetsmaterialstämpel, valbart typsnitt (osifont, Arimo, Josefin Sans, eget TTF/OTF), bild ur 3D-vyn, glTF, GUID på objekten, PDF:erna i en bakgrundstråd |
| 0.12.3 | Areor enligt SS 21054: areaobjektet ur rummen (Shift+klick) eller en egen kontur, avdragen för tjocka väggar, pelare, schakt, breda öppningar och hål i bjälklaget, BIA:ns väggar mot BOA, BTA och BYA framräknade, Areaplan med färgerna i stilboken, areaförteckningen med BRA, smarttexten `{BOA}` …, DXF-lagren `A-A-…`, XLSX för alla förteckningar |
| 0.12.4 | Areor under snedtak och mark: det mätvärda vid 1,90/0,60 för BTA och bruksareorna, kryss *Takkupa* på taket, *Dela efter rumshöjd* (H/L), 6-meterszonen ur marken med BIA(u), (o)/(u) och BTA(o)/BTA(u), OPA som egen kontur till ytterväggens utsida med takets kontur som start |
| 0.12.5 | Förteckningen per littera: dörr- och fönsterförteckningen med fälten som rader och en kolumn per littera, ritningen sedd utifrån med karmyttermåtten, rutor som skriver på alla med litteran, de framräknade fälten, föreskrifterna, band under varandra på bladet; *uppställning* heter nu *förteckning* |
| 0.12.2 | Förteckningar: rum, dörrar, fönster, grindar och det generella litterat ur modellen, kolumner ur fälten eller smarttext, sortering, gruppering, delsummor och summarad, en rad per littera, tabellen över ritytan, på bladet i 1:1 bruten i delar bredvid varandra, i bladets PDF och DXF, CSV och PDF i Exportera |
| 0.12.1 | DXF: egen skrivare för AutoCAD 2000 och 2018, vyer i modellens mm och blad i pappers-mm, lagerkartorna SB11 förenklad och fullständig, Enkel och en egen lista ur en DXF, pennan som färg och linjetjocklek, status N/E/R, väggarna delade per vägg, Bärande |
| 0.11.8.2 | Dörrar och fönster, Detalj och beslag: foder, bleck med droppnäsa och fönsterbänk i typen, tröskeln, beslagen (handtag, gångjärn, dörrstängare, brevinkast), spegelns profil, panel med material, spröjs i planen och med skrivna mått, varningarna, tillgänglighetscirkeln, fönstrens slagbågar släckta från början, förteckningens fält i stilboken (Typer) med taggar och smarttext |

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
(0.12, med förteckningarna), spaljéns rutnät och nätet är släta ytor i
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

### 0.11.7 Ändprofiler och profilen som del ✓

Ur utredningen (31 oktober, beslut A): ändprofilerna PA01 … (kontur i
sidovyn som skär änden, Inom/Utöver och förskjutning som de enkla
avsluten), profiltyper som delar i räckestyper (med ankare och vridning
kring ankaret) och i den byggda trappans vangstycke. Byggd i en session 31
oktober (Carl August: "Kör 0.11.7"). Samma filformat (27): allt nytt är
valfria fält (`EndSpec.profile`, `ProfileTypeModel.endProfile`,
`RailProfile.type/anchor/rotate`, `built.stringer.profile`).

**Claudes val (0.11.7):**

- **Ändprofilen är en profiltyp i gruppen Ändprofiler** (som tidigare
  förberett), ritad i samma editor men under en egen post i stilboken
  (Typer › Ändprofiler) med flikarna Sidovyn och 3D; ankare, sträckzoner,
  ändar, uppåt, parametrar och delprofilernas material och avslut visas
  inte där. Gruppen styr: en typ som dras till en annan grupp blir en
  vanlig profiltyp.
- **Konturen behåller det som ligger i den**: allt bortom konturens
  början (u > minU) som inte ligger i konturen tas bort; före den är
  profilen hel. Skärningen görs med konturens konvexa celler (samma
  `stripCells` som tvärsnittet), extruderade tvärs banan, så att kroppen
  förblir konvexa bitar. Konturens y är tvärsnittets y efter ankaret och
  förskjutningen i höjd (vridningen räknas inte in).
- **Utöver är förval för ändprofilen** (utredningen G); Inom sparas
  uttryckligen (`beyond: false`). Förskjutningen flyttar konturen.
- **Höjden**: ändprofilen sträcks med profilens sträckzoner för höjden
  (ritad för profilens ritade höjd). Skiljer höjderna mer än 1 mm efter
  det står en varning; ingen ändprofil, eller en utan yta, ger en
  vinkelrät ände och en varning.
- **Kantlinjerna** i en ände med ändprofil: hörnen längs banan slutar där
  konturen börjar; konturen (inom tvärsnittets höjd) ritas på
  tvärsnittets båda sidor, med linjer tvärs över i skarpa hörn.
- **En del i ett räcke med en profiltyp**: listan visar typerna som får
  användas som *Del i räcke* (PR06 som förval). En längsgående del ligger
  med ankaret på överkantens höjd (fältet heter fortfarande Överkant) och
  sveps vinkelrätt mot linjen (beslut E: räckesdelar vinkelrätt),
  tvärsnittets x utåt från räcket och mitten i sidled där *Inåt* säger;
  ändarna är typens förvalda avslut (en ändprofil kommer med) och
  vinkelräta vid grindar och trappsteg. Stolpar och spjälor står som
  tvärsnittet med x längs linjen och y utåt. Delprofilernas material
  gäller när delen inte har ett eget. Förhandsvisningarna i
  räckestypeditorn ritar delarna med typens mått (sidovyn som rektanglar).
- **En förvald typ som väljs som del eller vangstycke läggs in** i
  projektet (ett eget ångra-steg före ändringen).
- **Vangstycket**: tvärsnittets övre yttre hörn på linjen 50 över
  stegnosarna, x inåt, lodrätt uppåt och lodräta ändar; Höjd och Bredd
  sätts till vangstyckets mått (sträcks i zonerna). En typ utan sträckzon
  ger vangstycket typens mått när den väljs. Planen ritar som förut
  vangstyckets insida ur bredden.
- **Verktyget Profil** visar bara typer som får vara fria profilobjekt
  (PR06 och PR07 inte, om man inte kryssar). *Ta bort* i editorn är
  spärrad för en typ som används som ändprofil, del eller vangstycke.
- `clipPoly` behåller en sida som redan ligger i det kapande planet i
  stället för att lägga ett lock till (ändprofilens kanter kan sammanfalla
  med tvärsnittets; annars dubbla ytor).

**Inte gjort i 0.11.7:** ändprofilen räknar inte med vridningen kring
ankaret; en ändprofil som når förbi banans första eller sista raka bit
skär inte in i nästa (varningen *skär in förbi knäcken* gäller); stolpar
och spjälor med en profiltyp har inga avslut (vågräta); räckets avslut
*Böjd nedåt* och *Mot vägg* ritas fortfarande inte; sidovyerna i
räckestypeditorn ritar profildelarna som rektanglar. Foder, trösklar och
bleck som profiler i 0.11.8; socklar och taklister i ytskikten senare.
Kvar från 0.11.6: smartspöt för profilen, `PROFIL PR03` i kommandoraden,
en profil som följer kanten den lades längs, *Hör till* i panelen,
profilens littera och inre linjer i planen, och profiltyperna i
stilbokens export. Klickjämförelsen körs i granskningen efter 0.11.8.

### 0.11.7.1 Profilen, det som inte hanns med ✓

Carl August 31 oktober: "Kör saker som inte hunnits med i PLAN.md som ny
version 0.11.7.1". Claude valde det som hör till profilen och är litet
(A–F), byggt i samma session. Samma filformat (27): stilboksfilen fick
det valfria fältet `types`.

**Claudes val (0.11.7.1):**

- **Urvalet**: A `PROFIL PR03`, B smartspöt, C *Hör till*, D littera och
  inre linjer i planen, E typerna i stilbokens fil, F sidovyerna i
  räckestypeditorn. Profilen som följer kanten, räckets avslut och
  ändprofilen med vridning är större och väntar (nedan).
- **Kommandoraden** tar typen också för Räcke (`RÄCKE RÄ02`), och
  medan Profil eller Räcke är igång räcker litteran. Litteran jämförs
  utan skiftläge och mellanslag; en förvald typ som projektet saknar
  väljs och läggs in med det första objektet. Ändprofiler och grindtyper
  går inte att välja så.
- **Smartspöt** följer allt spöet kan följa utom andra profiler: sidan
  först, hela kedjan med Tab. *Pelare i hörnet* kommer först när
  markören är inom 10 px från sidans ände (ett hörn, också en
  dörrsmyg). Profilen ligger på verktygets höjd, som *Längs kant*.
- **Hör till** flyttar profilen till Platsen eller en våning som räckets
  (punkternas höjder ändras inte; på Platsen mäts de från ±0).
- **Littera i planen** är en text 2,5 mm (stilbokens litterahöjd) utan
  ledare och utan grepp: bredvid pelaren uppe till höger, eller vid mitten
  av banans längsta raka bit, vriden längs den och på den sida där
  tvärsnittet når längst. *Visa › Littera › Profiler* (`littera:Profile`);
  släckt i nya projekts Undertak och Golvplan som dörrarnas och
  fönstrens.
- **Inre linjer**: i Normal och Detalj ritas varje delprofil ovanifrån
  för sig (samma hölje per bit, pennan *kontur* eller *över snittet*),
  ovanpå det sammanslagna. En delprofil som är dold under en annan ritas
  ändå (planen räknar inte skymning).
- **Typerna i stilboken**: alla profiltyper (med ändprofilerna) och
  räckestyper följer med export, import och mallen, utan kryss. En typ
  med samma id ersätts (objekten med den följer med), projektets andra
  typer är kvar; en ny typ vars littera är upptagen får *(importerat)*.
- **Sidovyerna**: en längsgående profildel ritas mellan tvärsnittets
  lägsta och högsta y, vinkelrätt mot linjen (gerat i knäckarna); en
  stolpe eller spjäla mellan tvärsnittets x längs linjen. Kantlinjerna är
  tvärsnittets kanter parallella med sidovyns riktning (en rund profil har
  inga).

**Inte gjort i 0.11.7.1:** en profil som följer kanten den lades längs
(*Längs kant/Lösgör*, mellanstor), ändprofilen med vridningen kring
ankaret, ändprofilen som skär in förbi knäcken, stolpar och spjälor med
avslut, räckets avslut *Böjd nedåt* och *Mot vägg*, profilens littera som
går att flytta (med ledare), och måtten per objekt i profileditorn. Från
tidigare versioner kvar (0.11–0.11.5, se deras *Inte gjort*): det kopplade
egna hålet, trappans littera och egna penna, räcket som följer andra
kanter än trappans, grindens fasad, spiraltrappans egna varningar m.m.
Klickjämförelsen körs i granskningen efter 0.11.8.

### 0.11.7.2 Räckets avslut och spiraltrappan ✓

Carl August 31 oktober: "Kör saker som inte hunnits med i PLAN.md som ny
version 0.11.7.2". Claude valde fyra små ur *Inte gjort* (A–D), byggt i
samma session. Samma filformat (27): mittpelarens material är det valfria
fältet `spiral.pole`.

**Claudes val (0.11.7.2):**

- **Urvalet**: A räckets avslut *Böjd nedåt* och *Mot vägg* (stod som
  *ritas i 3D senare* sedan 0.11.1), B spiraltrappans varning för den fria
  höjden under nästa varv, C mittpelarens material, D stegnumren under
  Visa (frågan om 0.11.4). Profilen som följer kanten, ändprofilen med
  vridning, flyttbar littera och måtten per objekt är större och väntar.
- **Böjd nedåt**: en lodrät bit med delens tvärsnitt (rund som åttahörning)
  från överkanten till 100 mm under delens underkant, i änden efter
  förlängningen. Ingen böjradie. Syns inte i planen (lodrät).
- **Mot vägg**: en vågrät bit från änden tillbaka till räckets linje
  (förskjutningen *Inåt* bakåt), med delens bredd och höjd; ligger delen på
  linjen går den 60 mm utåt (bort från trappan). Planen ritar den i Detalj
  som en kontur och i Normal som en linje med förlängningen.
- Bara i delens **verkliga ändar** (inte vid grindar och trappsteg), och
  inte för delar med en profiltyp (de har typens avslut) eller i grindens
  blad.
- **Den fria höjden** = varvets längd i gånglinjen / stegdjupet ×
  steghöjden − stegets tjocklek (plansteget i en byggd trappa, annars
  trappans tjocklek). Gränsen 2 000 mm är praxis (den fria höjden 2,0 m i
  BBR; den gamla tillverkarformeln F = (N − n)h − t utan vilplan). Varnar
  bara när trappan går mer än ett varv.
- **Mittpelaren**: *Som trappan* (eller *Målad* i en byggd) som förval,
  annars stilbokens byggnadsmaterial i 3D. Planen ritar den som förut.
- **Stegnumren**: `stairNumbers` under *Visa › Modell* släcker numren och
  texten *15 st à 180/260*; stegnosen och kontrastmarkeringen står kvar.

**Inte gjort i 0.11.7.2:** spiraltrappans stegdjup vid innerkanten (ingen
säker praxis hittad), avslutens böjradie, avslut på stolpar och spjälor med
en profiltyp. Kvar från 0.11.7.1: en profil som följer kanten den lades
längs, ändprofilen med vridningen kring ankaret, ändprofilen som skär in
förbi knäcken, profilens littera som går att flytta (med ledare), måtten
per objekt i profileditorn. Från 0.11–0.11.5 kvar: det kopplade egna
hålet, trappans littera och egna penna, räcket som följer andra kanter än
trappans, grindens fasad, att göra om en vanlig trappa till spiral.
Klickjämförelsen körs i granskningen efter 0.11.8.

### 0.11.7.3 Trappan och räcket, det som inte hanns med ✓

Carl August 31 oktober: "Kör saker som inte hunnits med i PLAN.md som ny
version 0.11.7.3". Claude valde fem små ur *Inte gjort* (A–E), plus ett fel
som provningen hittade (F), byggt i samma session. Samma filformat (27):
`outdoor` och `contrastMaterial` på trappan och `pattern` på en räckesdel
är valfria fält.

**Claudes val (0.11.7.3):**

- **Urvalet**: A utomhustrappan (300 mm, från 0.11), B kontrastremsans
  material (0.11.4), C trappans littera i planen (0.11; den egna pennan
  väntar), D ändprofilen med vridningen kring ankaret (0.11.7), E
  spaljéns rutnät och nätet i 3D (0.11.3). Profilen som följer kanten,
  måtten per objekt, det kopplade hålet och räcket som följer andra kanter
  är större och väntar; flyttbar littera, spiral av en vanlig trappa och
  ett räcke runt det runda hålet väntar på Carl Augusts svar.
- **Utomhus**: utelämnat följer Platsen (ja där, nej på en våning); krysset
  sparas bara när det avviker. Bara stegdjupets varning ändras (300 i
  stället för 250); ingen egen gräns för steghöjden utomhus.
- **Kontrastremsan**: stilbokens byggnadsmaterial (kulören eller texturen i
  3D); planens bakkant har sin penna som förut.
- **Trappans littera**: det egna namnet (fältet *Littera*, `el.name`),
  annars `TR` och löpnummer i dokumentets ordning bland trapporna, med
  stilbokens antal siffror (som stödmurarnas M01). Texten står längs
  gångriktningen (uppåt läsbar) och slutar 1,5 mm före trappans början,
  mitt för den, utan ledare och grepp; bara i trappans eget våningsplan.
  `littera:Stair` under *Visa › Littera*.
- **Ändprofilen och vridningen**: ändprofilens y följer tvärsnittets
  y-axel efter vridningen och speglingen (`endAxis`); skärningen och
  kantlinjerna räknas i en ram med den axeln (`endFrame`). Gäller
  profilobjekt och räckesdelar med en profiltyp. Prövat med volymen:
  vriden 30° eller 90°, och speglad, är lika stor som ovriden.
- **Mönster**: `pattern` med *Rutnät* (lodräta och vågräta ribbor) eller
  *Diagonalt* (±45°), centrumavstånd vinkelrätt mot ribborna och ribbans
  bredd; tjockleken är ytans. Höjderna räknas från ytans underkant, så att
  mönstret följer lutningen; ribborna klipps mot ytan med raka ändar.
  `railingPattern.ts`. Planen ritar ytan som förut. ST03 fick nät 50 med
  tråd 3, SP01 ribbor 34 c/c 150.
- **F**: `RÄCKE SP01` och `SP01` i kommandoraden hittade inte staketens
  förvalda typer, och verktyget föll tillbaka till RÄ01 när typen saknades
  i projektet. Nu söks båda listorna, och typen läggs in med räcket.

**Inte gjort i 0.11.7.3:** trappans egen penna, mönster i planen och
förhandsvisningens plan, utomhustrappans egen steghöjd. Kvar från tidigare
(se 0.11.7.2): en profil som följer kanten den lades längs, ändprofilen
som skär in förbi knäcken, profilens littera som går att flytta, måtten
per objekt, det kopplade egna hålet, räcket som följer andra kanter än
trappans, grindens fasad, att göra om en vanlig trappa till spiral,
spiraltrappans stegdjup vid innerkanten, avslut på stolpar och spjälor
med en profiltyp. Klickjämförelsen körs i granskningen efter 0.11.8.

### 0.11.8 Dörrar och fönster: öppningstyperna ✓

Carl August 22 oktober; utredd 31 oktober med en mockup i Claude Design
(*Dörrar och fönster – utredning 0.11.8*, sex tavlor) och
`cad-apa-dorrar-fonster-utredning.md` i projektet, som är
specifikationen. Delad i tre (beslut D): **0.11.8 Öppningstyperna**,
**0.11.8.1 Detalj och beslag**, **0.11.8.2 Smart och vägghål** (blev
0.11.8.2 och 0.11.8.3 när synpunkterna på mockupen blev 0.11.8.1). Byggd 31
oktober (Carl August: "Kör 0.11.8 dörrar och fönster enligt mockup i
föregående session"). **Nytt format 28**: `Definition.opening`, dörrarnas
och fönstrens nya parametrar, projektets `openingNumbers` och
`openingSchedule`, och sorten `WallHole`.

**Besluten (utredningen, 31 oktober):** A fönster och dörrar var för sig
(egna verktyg, grupper och littera) med en gemensam motor; B litteran
ändras med projektet (litteraregeln), två siffror som förval och egen
formel; C vägghål som tredje grupp; D delningen; E modulmåttet som förval,
karmyttermåttet fritt; gångjärnen ritas som en markering (två, 100 från
kanterna); förteckningen som Carl Augusts förteckningar A-42-5-101 och
-102 (fälten som rader, en kolumn per littera; tomma fält `-`); typen har
en föreskrift i stället för tillverkaren; *Numrera om* efter våning,
fasad N–Ö–S–V och vänster till höger.

**Claudes val (0.11.8):**

- **Modulmåttet och hålet**: 1M = 100 mm med drevmånen inräknad, som i
  Elitfönsters produktblad: karmyttermåttet är modulmåttet minus två
  drevmånar (10 × 13 → 980 × 1 280), i höjd en för det som står på golvet
  (dörrar, fönsterdörren: 21 → 2 090), och **hålet är karmyttermåttet
  plus drevmånen**, alltså modulmåttet. Förut var hålet modulmåttet + 10
  och karmen − 10; med drevmån 15 under Allmänt blir hålet som förut.
- **Höjdläget** *Överkant karm* är förval för fönster som inte står på
  golvet; bröstningen (`sill`, hålets underkant) räknas ur den. Ett
  objekt med en egen bröstning i filen (och fönsterdörren) står på
  bröstningen.
- **Karmens läge**: fönster i liv ute (avstånd 0, förut 50 in),
  ytterdörrar i liv på den sida de slår mot (så att bladet går att
  öppna), innerväggar som förut.
- **Hängningen**: objektets `hinge` (start/slut längs väggen) är där
  typens första sidohängda luft har sina gångjärn; typen speglas när den
  inte stämmer. *Spegla hängning* byter. Sett utifrån; i innerväggar från
  den sida en dörr inte slår mot.
- **Litterans nummer sparas** per kombination (`openingNumbers`) i samma
  ångra-steg som ändringen som gav den; en ny kombination får nästa
  lediga. Byts regeln blir alla kombinationer nya och numreras i
  ordningen våning, fasad, läge. En egen littera (`littera`) är låst.
  `{typ}` och `{littera}` i litteramallen ger litteran, `{typnamn}`
  typens namn, `{hål}` och `{karm}` de räknade måtten.
- **Pardörrens passiva blad** är det med gångjärnen till höger sett
  utifrån; dess slagbåge är streckad.
- **Fönstrens slag i planen** (bladlinjen och en streckad båge) ritas i
  Normal och Detalj, som på tavla 2; *Visa › Öppningssätt* släcker dem.
- **Symbolerna**: pivå horisontell = under- och överkantshängd ihop,
  vertikal = båda sidorna, skjut en pil mot gångjärnssidan (*Skjuts åt*),
  vik en sicksack, porten en pil uppåt.
- **Grupperna** i editorn är Fönster, Dörrar, Vägghål och de som typerna
  har; *Ny grupp…* flyttar den valda typen till en ny grupp.
- **Den gamla Typer-fliken** i panelen visar inte längre dörrar och
  fönster (måtten hör till objektet); smartmenyns *Glasad* är borta
  (bladet är typens).

**Inte gjort i 0.11.8:** typens parametrar med formler (handtagets höjd
*Höjd / 2*), karm och båge som profiltyper (PR30 …), att dra i posten för
att ändra delningen, editorns vyer Plan, Sektion och 3D, material per
del, litteran i fasaden, en egen formel per editorgrupp (YD för
ytterdörrar), förhandsvisningen i *Numrera om* (antalet står i
ångra-steget), kortkommandona T, M och S i smartmenyn, snedda smygar, fri
passage. Planerat: foder, bleck, fönsterbänk, spröjs, beslag, trösklar i
Detalj, varningarna och tillgänglighetscirkeln (0.11.8.1); fasaden som
arbetsyta, linjering, dagsljus och vägghålen med verktyg och typer
(0.11.8.2); förteckningen som vytyp (0.12). Klickjämförelsen körs i
granskningen efter 0.11.8.

### 0.11.8.1 Dörrar och fönster: synpunkterna på mockupen ✓

Carl August 1 november: "Arbeta in kommentarer från mockup som 0.11.8.1."
Kommentarerna A–I på mockupen *Dörrar och fönster – utredning 0.11.8*
(Inkorgen i `cad-apa-synpunkter.md`), plus måtten: **modulmåttet är
alltid i decimeter, hålmåttet görs ofta 10 mm större på höjd och bredd
(praxis, ingen regel), karmyttermåttet är tillverkarens och brukar vara
10–20 mm mindre på vardera ledd** (det får variera). Samma format, 28
(valfria fält). *Detalj och beslag* blev 0.11.8.2 och *Smart och vägghål*
0.11.8.3.

**Gjort:** måtten (hålet + 10, karmen − 10, under Allmänt; typens
karmavdrag); A öppningssymbolen spretar mot gångjärnssidan, egna ställen
(när och bortre sida) och kan släckas; B fönstrens slag 15° kring
gångjärnet; C 2-luft V · H mot karmsidorna (följer av A och B); D spröjs
jämnt eller special (ritade referenslinjer); E skjutpilen åt
öppningshållet, ingen triangel; F dörrbladets indelning med mm och andelar
och material per fyllning; G VG01; H slagbågarna på alla nivåer, egna
kryss för dörrar och fönster; I fältmallen och fälten på objekten.

**Claudes val (0.11.8.1):**

- **Måtten**: `holeAdd` (10) och `frameLess` (10) under Allmänt ersätter
  drevmånen; typen har `frameLess` (tillverkarens). Hålet räknas alltid
  ur modulmåttet, också när karmyttermåttet är eget; karmen sitter mitt i
  hålet i höjd, eller på golvet för det som står där.
- **Symbolens ställen**: delen `swing` från den sida luften öppnas mot
  (heldragen som förval) och `swingFar` från den andra (streckad), för
  dörrar och fönster var för sig. Typens symbolpenna gäller båda.
- **Kryssen under Visa**: `swing` (*Slagbågar, dörrar*, som förut),
  `swingWindow` och `openingSymbol`. Kategorierna utan inredning släcker
  båda slagbågarna (som förut dörrarnas).
- **Fönstrets slag**: heldraget, med fönstrets slagbågspenna (förut
  streckad båge); vinkeln `swingAngle` under Allmänt, 15° som förval.
- **Spröjsens utförande**: löstagbar 28, mellan glasen 26, fast 28 mm.
  Lister i 3D på glasets båda sidor (inte för mellan glasen), sneda
  spröjs bara som linjer. Vågräta bryts vid lodräta i fasaden.
- **Special**: referenslinjerna som andelar av glaset, så att de följer
  måttet; snäppet till kanterna (0,06), delningarna ½, ⅓, ¼ (0,035), andra
  spröjs ändar och lägen, rakt inom 8°.
- **Dörrbladets indelning** är ett rutnät som typens (mm och andelar);
  rutor utan fyllning är bladet. *Spegel* och *Glasat* är förval som blir
  en egen indelning när de ändras. Fyllningarna sammanslås med *Bredda åt
  höger* och *Förläng nedåt*. Glas ritas som glas, en skiva 16 mm i mitten
  med materialets kulör.
- **Fältmallen** ligger i projektet (`openingSchedule.fields`) men ändras
  under stilboken › Allmänt, där litteraregeln står. Fält som räknas fram
  eller kommer ur typen (antal, hängning, mått, poster, spröjs, karmdjup …)
  är märkta *räknas* och har inget fält på objekten. Egenskaperna skriver
  på de markerade; förteckningen (0.12) skriver på alla med samma littera
  (`sameLittera`). Ett fält som tas bort ur mallen lämnar värdena kvar på
  objekten.

**Inte gjort i 0.11.8.1:** fyllningar med material i fönstrens lufter
(panel under glas), sneda fyllningar i bladet, spröjs i planen (Detalj),
en punkt som visar var en påbörjad spröjslinje började, spröjs som
profiltyper, förteckningens vytyp (0.12), fälten i litterans smarttext.

### 0.11.8.2 Dörrar och fönster: Detalj och beslag ✓

Carl August 1 november: "Kör 0.11.8.2", med svaren på fem av frågorna om
0.11.8.1 (A–E) i samma meddelande. Mellanstor (utredningen, delning D).
Samma format, 28 (valfria fält: typens `trim` och `hardware`, luftens
`material`, stilbokens `scheduleFields` och Allmänts `accessCircle`).

**Gjort:** foder, bleck med droppnäsa och fönsterbänk i typen, ritade i
Detalj (plan, fasad, sektion, 3D); tröskeln i planen; beslagen (handtag,
gångjärnens markering, dörrstängare, brevinkast); varningarna;
tillgänglighetscirkeln; panel med material under glas och spröjs i
planen (ur 0.11.8.1). Svaren: **A** fönstrens slagbågar släckta från
början; **B** spröjsens förval står; **C** skrivna mått för Special;
**D** spegelns profil i Detalj; **E** fältmallen i stilboken (Typer ›
Förteckningens fält), sökbar med taggar, med smarttexten och *Bara
egna*, och den följer med stilbokens export (liksom dörr- och
fönstertyperna).

**Claudes val (0.11.8.2):**

- **Förvalen**: foder 70 × 15 på båda sidor; bleck med utsprång 40 och
  droppnäsa 20; bänk 22 mm med utsprång 20, 20 mm förbi fodret i ändarna;
  blecket 10 mm förbi fodret. Bara fönster som inte står på golvet, och
  bara i ytterväggar, får bleck och bänk; bänken och blecket tar fodrets
  underdel på sin sida (fodret blir ett U som står på dem). I innerväggar
  är utsidan den sida fönstret ses ifrån.
- **Blecket** är vågrätt (kropparna dras upp lodrätt, så en lutning blir
  trappstegad); en 2 mm plåt under karmen till utsprånget och droppnäsan
  som en lodrät läpp längst ut. Bänkens överkant är karmens underkant.
- **Beslagen** ritas bara i Detalj och inte i planen. Dörrhandtaget på
  låssidan 70 mm in, trycke 130 långt eller draghandtag 300 högt, på båda
  sidor; gångjärnen som 16 × 80 på slagsidan; stängaren 280 × 55 överst på
  slagsidan vid gångjärnet; brevinkastet 300 × 45 mitt på bladet, med
  mitten 850 över golvet. Fönstrens handtag inne på bågen: låssidan mitt
  på höjden (sidohängda, dreh-kipp, skjut, vertikal pivå), nertill
  (överkantshängda, horisontell pivå) eller upptill (underkantshängda).
- **Fri passage** räknas ur geometrin: bladets luft minus bladets tjocklek
  (skjutdörrar minus 40 för handtaget, pardörren på det aktiva bladet).
  Gränserna 760 och 800 (ytter- och huvudentré) är praxis, liksom
  tröskeln 25, säkerhetsglas under 600, utfallsskydd under 600 på en
  våning med golvet minst 1,5 m över nollan, och utrymningsfönstret
  (bredd 500, höjd 600, bredd + höjd 1 500, bröstning högst 1 200). Alla
  har *avviker från praxis* med en hänvisning till föreskriften att slå
  upp: **tillgänglighet är BFS 2024:12**, säkerhet vid användning BFS
  2024:9 och utrymning BFS 2024:7 (siffrorna inte uppslagna i
  föreskrifterna). Innerdörrarnas karm blev 40 (förut 50) i de förvalda
  typerna, så att en 9M-dörr klarar 760.
- **Tillgänglighetscirkeln** ritas på båda sidor om dörren, mitt för
  karmen och tangerande väggens liv, när *Visa › Tillgänglighetscirkel*
  är tänd, på alla nivåer. Diametern under Allmänt, 1 300 som förval.
- **Slagbågarna för fönster** följer `OFF_BY_DEFAULT` (`+swingWindow` i
  vyns `hide`); `swingWindow` i BARE togs bort.
- **Spröjsens skrivna mått** är i mm i det mått ritytan visar (*Prova
  mått*) men sparas som andelar, så att linjerna följer glaset. Special
  utan linjer står kvar som Special (förut föll den tillbaka till Jämn).
- **Fältmallen** bor i `graphics.scheduleFields` (listorna och egna
  taggar); ett projekt från 0.11.8.1 läses ur `project.openingSchedule`
  tills mallen ändras, då flyttas den. Förteckningens fält har inbyggda
  taggar och märks *cad-apa*, de egna *eget*. Smarttexten är fältets namn
  (`{U-värde}`), också med `fält:` före; den slås upp utan skiftläge
  före egna egenskaper. Taggarna följer med ett namnbyte.

**Inte gjort i 0.11.8.2:** lutande bleck (trappstegat som kropp), fodrets
och bänkens material (som karmen), beslag i planen, handtagets höjd som
formel, sneda fyllningar i bladet, spröjs som profiltyper, en punkt som
visar var en påbörjad spröjslinje började, förteckningens vytyp (0.12),
föreskrifternas siffror uppslagna (varningarna säger *praxis*), kopplingen
mellan dörr och rum (vilka dörrar som ska vara tillgängliga).

### 0.11.8.3 Dörrar och fönster: Smart och vägghål ✓

Carl August 1 november: "Testa att köra A+B tillsammans med smart och
vägghål i 0.11.8.3" (A och B ur Inkorgen: blecket med justerbar lutning,
spegeln med eller utan fas). Mellanstor. Samma format, 28 (valfria fält:
typens `hole`, bleckets `slope`, fyllningens `flat`).

**Gjort:** vägghålen med verktyg, editor, egenskaper och fyra förvalda
typer; fasaden som arbetsyta; *I liv med fönstret under*, *Lika
avstånd* och *Mitt i rummet* i smartmenyn; dagsljuset; A blecklutningen;
B spegelns kant *Fasad* eller *Rak*.

**Claudes val (0.11.8.3):**

- **Vägghålen** har måttet i mm (modulmått passar inte en genomföring
  Ø 160), höjdläget är alltid underkanten (`sill`, också negativ), och
  förvalen: Ventgaller 300 × 200 på 300, Nisch 600 × 600 på 900 och 100
  djup, Genomföring Ø 160 på 300, Rent hål 600 × 600 på 900. Nya projekt
  får Ventgaller och Rent hål; finns inga vägghålstyper har verktygsraden
  *Lägg in vägghålens typer*. Nischen går in från den sida man pekar på
  (`swing`), ändras under egenskaperna (*Nischens sida*); djupet högst
  väggens tjocklek minus 1. Den runda skärs ur väggen i 16 skivor (hålets
  kant i fasaden är en cirkel med 32 kanter), så kroppen blir lätt
  trappstegad i 3D. Ventgallret är en 8 mm platta i livet på utsidan med
  lameller var 25 mm (inte i Skiss). Vägghålen har ingen hängning, inget
  foder och ingen förteckning än; *Riv* som för fönster.
- **Krocken** när man sätter in prövas också i höjd, så att ett
  ventgaller kan sitta över ett fönster.
- **Fasaden som arbetsyta**: draget i vyns x blir läget längs väggen
  delat med hur mycket väggen vetter mot vyn (en vägg nästan i vyns
  djupled, under 0,2, flyttas inte i sidled); y blir överkant karm när den
  står fast, annars bröstningen (vägghål: underkanten). Dörrar bara i
  sidled. Läget hålls inom väggen. Snäppet är fasadens linjer, så *i liv*
  i fasaden är att snäppa mot ett annat fönsters kant. Bara flytt; Vrid,
  Spegla och de andra i Modifiera gäller inte i fasaden.
- **I liv med fönstret under**: närmaste våning under som har en öppning i
  samma liv (parallell vägg, mittpunkten högst 300 + väggarnas halva
  tjocklekar från linjen), närmast längs väggen; mitten läggs lodrätt
  över dess mitt (inte kanterna). Gäller också dörrar och vägghål.
- **Lika avstånd** kräver tre eller fler i samma vägg; de yttersta står
  kvar och avstånden mellan hålen (inte mitt till mitt) blir lika. Med
  två finns inget att fördela; *Mitt på väggen* finns redan i verktyget.
- **Mitt i rummet**: rummet på insidan (ytterväggar) eller på dörrens
  slagsida (innerväggar, annars vänster), ur väggarnas rum; mitten av
  rummets kant längs livet där öppningen sitter.
- **Dagsljuset**: glasarean är glaset innanför bågarna, hela luften för
  fast glas i karmen och de glasade fyllningarna i dörrblad, utan spröjs;
  bara dörrar och fönster i ytterväggar som finns i tillståndet (inte
  rivna). Ett fönster hör till rummet där en punkt 50 mm innanför väggen
  ligger. Tumregeln 10 % av golvarean (rummets area) är praxis, så
  varningen säger *avviker från praxis*. Smarttexten `{dagsljus}` (14 %)
  och `{glasarea}` (4,6 m²); förvalsmallen för rumsstämpeln är oförändrad.
  Glaset mot en fasad är det som vetter inom 45° från fasadens riktning;
  per väderstreck (åtta) under Allmänt räknas i förslaget som är förval.
- **Blecklutningen**: grader utåt, förval 15° (också för bleck i filer
  från 0.11.8.2), 0–45°. Plåten är en kropp med sned ovan- och undersida;
  droppnäsan hänger från den lägre änden. Planen ritar blecket som förut.
- **Spegelns kant**: `flat` på fyllningen; förval fasad.
- **Snabbknapparna**: dörrar får *Mitt i rummet* och *Lika avstånd*,
  fönster också *I liv med fönstret under*; vägghålen har en egen lista.
  En sparad lista utan *Lika avstånd* får de nya före *Riv*.

**Inte gjort i 0.11.8.3:** vägghålens förteckning (med
0.12), ventgaller i planen, sneda och runda nischer, ett runt hål som
riktig cylinder i 3D, *i liv* med kanten i stället för mitten, *Lika
avstånd* mot väggens ändar, flytt i fasaden med tangentbordet, dagsljuset
med fönstrens LT-värde och avskärmning, föreskrifternas siffror uppslagna
(väntar på att Carl August laddar upp dem).

### Granskning efter 0.11.8 (0.11.8.4) ✓

1 november 2026, inga nya funktioner. Fick en fjärde siffra eftersom
varningstexterna syns.

- **Föreskrifterna uppslagna** (Carl August laddade upp BFS 2024:7, 9, 12
  och 8 i projektet). Varningar med en siffra i föreskriften hänvisar till
  paragrafen; det som bara var allmänt råd i BBR är kvar som *avviker
  från praxis*. Nytt: barnsäkra fönster enligt 2 kap. 4 § (1,8 m och
  0,6 m, fallhöjd 2,0 m) och öppningen mellan planstegen i en öppen
  trappa (2 kap. 6 §). Se README och `openingWarnings.ts`,
  `stairWarnings.ts`, `railingWarnings.ts`.
- **Stilmallsstegen i klickjämförelsen** omskrivna mot stilboken: texterna,
  linjetyperna och fyllningstyperna nås via vänsterkanten (`data-sb-go`),
  förinställningen är kategoriflikarna (`data-sb-cat`), dörrarnas och
  fönstrens pennor heter `doorSwing` och `windowGlass`. Inga `saknas`-fel
  kvar.
- **Filerna delade:** `stairGeometry.ts` 620 → 542 rader
  (`stairSpiral.ts` 43, `stairWarnings.ts` 49); `view3d.ts` 663 → 549
  (`materials3d.ts` 152: klassen `Materials3D` med de inbyggda materialen,
  egna kulörer, texturer och ortofotot, och klippplanen).
- **Klickjämförelsen** med 64 nya steg för 0.11.6–0.11.8.3 (balk, pelare,
  gesims längs kant, profilens egenskaper, Pelare här, dörr och fönster
  med modulmått, vägghål, egenskaperna, Lika avstånd, Mitt i rummet,
  dagsljuset, fasaden som arbetsyta med ett draget fönster, typen i
  editorn, Detalj och 3D), 697 steg; mot 0.11.8.3 skiljer bara panelerna
  med de nya varningstexterna.
- **Testerna:** 942 på ca 25 s (två nya test för varningarna).

**Claudes val:** fallhöjden för 2 kap. 4 § räknas som våningens höjd över
±0 plus bröstningen, marken antas vid ±0 (ingen terräng i räkningen).
Kontrastmarkeringen (2 kap. 8 §) får ingen varning: kravet gäller inte
en- och tvåbostadshus eller bostadslägenheter.

**Inte gjort:** `stairGeometry.ts` är fortfarande störst bland
elementfilerna (542); `profileTypes.ts` (875) och `openingTypes.ts` i
`src/ui/style/` (828) är de största filerna nu och delas vid nästa
granskning. Tröskelns 25 mm och räckeshöjderna har ingen föreskrift att
hänvisa till.

### 0.12 Exportdialogen och PDF ✓

7 november 2026, efter utredningen (`cad-apa-export-utredning.md` i
projektet, svaren A–E). Stor, en session. Samma format, 28 (valfria fält:
`exportSets`, `guids`, stilbokens `export`, `font` som en fil).

**Gjort:** exportdialogen (trädet med Ritningar, Vyer, 3D-vyer och
Modellen, kryssrutor, sökruta, format per rad), uppsättningarna
(spara, spara som, ta bort, i mallen, `EXPORT <namn>`), filnamnsmallarna
under stilboken › Allmänt › Export, mappen på datorn (File System Access)
eller zip, undermappar per format, förhandslistan med dubbletter och
storlekar, kön i en bakgrundstråd med förlopp och Avbryt; PDF med lager
(OCG), dokumentegenskaper och XMP, samlad fil med bokmärken,
arbetsmaterialstämpel och deterministiska bytes; typsnitten (osifont,
Arimo, Josefin Sans och ett eget TTF/OTF, på skärmen och i PDF:en); bild
ur 3D-vyn i fast storlek; glTF (.glb) med material, marken och GUID;
GUID på objekten.

**Upptäckt i repot före bygget:** bladen plottades redan som vektor med en
egen PDF-skrivare (0.8 del 3) och osifont inbäddad (0.8.18), och zip fanns
utan bibliotek. Därför byggdes vidare på den egna skrivaren i stället för
pdf-lib och fflate, som utredningen föreslog: inget nytt beroende.

**Claudes val (0.12):**

- **Typsnitten som följer med**: osifont (ISO, förval), **Arimo** (Apache/
  OFL, samma bredder som Arial) och **Josefin Sans** (OFL, Carl Augusts
  exempel), frysta vid vikten 400 och delmängdade till WinAnsi med
  `scripts/typsnitt.py`. Liberation Sans och Routed Gothic gick inte att
  hämta härifrån; Arimo är Liberation Sans föregångare med samma mått. Ett
  **eget typsnitt** läses i webbläsaren (bredderna ur `hmtx`/`cmap`) och
  bäddas in helt (TrueType som FontFile2, OpenType/CFF som FontFile3).
  WOFF och TTC avvisas med en förklaring. Fet text är som förut samma
  typsnitt med ett tunt streck. Saknas ett tecken byts det som för
  osifont. Konturtext när filen saknas gjordes inte: då används osifont.
- **Mätningen** följer projektets typsnitt (`useDrawingFont` i planen och
  sektionerna), så att radbrytningar och textrutor stämmer med det som
  ritas.
- **Lagren**: *Ett per vy på bladet* är förval; ramen, huvudet och det
  ritade på bladet ligger i lagret *Bladet*. *Per vy och objektgrupp* lägger
  13 grupper (Väggar, Dörrar, fönster och vägghål, Bjälklag och tak,
  Trappor och räcken, Profiler, Rum, Möbler, Mått, Text och littera,
  Markörer, Mark och plats, Underlag, 2D) under vyn, ur objektets sort, inte
  ur stilbokens ställen; en vy ensam får bara grupperna. Lagren under
  vyn ligger i nästlade BDC, så att vyn släcker sina grupper.
- **Dokumentegenskaperna**: titel, ämne (ritningsnummer och benämning),
  nyckelord (skede, projekt), författare (företag, arkitekt eller
  ansvarig) och egna nycklar Projekt, Uppdragsnummer, Ritningsnummer,
  Benamning, Skala, Format, Skede, Datum och Bet (tom tills 0.12.4), i
  Info och i XMP (namnrymden `cadapa`). Inga datum i filen utom bladets
  egna, så att samma projekt ger samma bytes; zipfilens tidsstämpel är
  dagens datum klockan 00.00.
- **Samlad fil** heter `{projekt}.pdf` och gäller bara bladen (vyerna blir
  egna filer); bokmärkena är ritningsnummer och benämning.
- **Arbetsmaterial** är en stämpel 2,5 mm grå nederst till vänster utanför
  ramen (`ARBETSMATERIAL 2026-11-07`), av som förval. *Skarp* kommer med
  utgåvorna i 0.12.4.
- **Uppsättningarna** ligger i projektet (`exportSets`). När alla blad
  eller alla vyer är kryssade sparas det som *alla*, så att nya kommer med.
  I mallen (stilbokens fil) följer bara *alla*, 3D-vyn, modellen, formaten
  och inställningarna med, eftersom bladen i ett nytt projekt är andra; de
  läggs i det nya projektet om det inte har egna. `EXPORT Bygglov` öppnar
  dialogen med uppsättningen och kör den (namnets början räcker).
- **Filnamnen**: smarttexten är bladets (med `{titel}` = benämningen och
  `{datum}` = bladets datum eller dagens), och för vyer, bilder och modellen
  projektets och kontorets plus `{vy}`, `{titel}`, `{skala}`, `{datum}`.
  Otillåtna tecken blir bindestreck, punkter och mellanslag i slutet tas
  bort, CON/PRN … får ett bindestreck. Dubbletter varnas och får *(2)*.
- **Vart**: mappen som förval i Chrome; den väljs när man klickar
  *Exportera* (lov krävs i samma klick) och kommer ihåg sig i IndexedDB per
  projekt (namn och uppdragsnummer). Utan File System Access blir det zip.
  En ensam fil till zip sparas som den filen. Filer med samma namn i mappen
  skrivs över (det är så en ny utgåva ska hamna).
- **Bild ur 3D-vyn**: duken ritas om i bildens storlek med samma kamera och
  höjdvinkel (en annan proportion visar mer i sidled), vit bakgrund, utan
  markering och grepp. Har 3D-vyn aldrig visats ställs hela modellen in.
  PNG som förval, JPEG 92 % som val; storleken 64–8 192.
- **glTF**: binär .glb ur 3D-vyns kroppar med deras material, marken med
  sitt utseende, utan kantlinjer och höjdkurvor, i meter med y uppåt. Varje
  objekt heter sorten och litteran (*Wall YV01*) och har `id`, `type` och
  `guid` i `extras`.
- **GUID** ligger i projektet (`guids`, objektets id → GUID), inte på
  objektet, sätts för alla objekt vid första exporten och utan ett steg att
  ångra. En kopia har ett nytt id och får därför en ny; borttagna släpps ur
  listan vid nästa export.
- **Bakgrundstråden** skriver PDF:erna; bladen ritas i huvudtråden (där
  projektet och bilderna finns). Går tråden inte att starta skrivs de i
  huvudtråden.

**Inte gjort i 0.12:** konturtext när typsnittsfilen saknas; lager ur
stilbokens ställen (grupperna är objektsorter); bilder och 3D-vyer på
blad rastrerade i vald upplösning (det finns inga 3D-vyer på blad än;
0.12.5); storleksvarning mot kommunens maxstorlek (storleken visas efter
exporten, inte före); att mappens innehåll jämförs eller rensas;
renderingarna (0.12.5); *Skarp* och utgåvorna (0.12.4).

### 0.12.1 DXF ✓

10 november 2026, en session. Samma format, 28 (valfria fält: stilbokens
`export.dxf`, uppsättningens `dxfVersion`, väggens `loadBearing`).
Carl August 10 november: versionen heter **0.12.1** (inte 0.12.0.1), och
de följande flyttar ett steg (0.12.2 förteckningar, 0.12.3 IFC, 0.12.4
utgåvor, 0.12.5 3D-vyer); **den fjärde siffran reserveras för snabba
buggfixar** som inte lägger till funktioner. Underlag: hans AutoCAD-mall
`Mallfil_SB11-lager.dxf` (272 lager), `cad-apa-lagerlista.md` och
förslaget `cad-apa-lager-bsab-forslag.md` från en annan session (SB11
förenklad och fullständig), pennväljarens färger (svar D) och DXF 2018 som
val (svar E).

**Gjort:** en egen DXF-skrivare (`src/formats/dxfWrite.ts`) för AutoCAD
2000 (AC1015, förval) och 2018 (AC1032), med alla sektioner, handtag,
ägare, lagerbeskrivningar och layouterna; vyer i modellens mm med texter
och linjetyper i vyns skala, blad platta i pappers-mm; LINE, ARC, CIRCLE,
LWPOLYLINE, TEXT och HATCH (solid och skrafferingarnas linjefamiljer).
Lagerkartorna (`src/core/dxfLayers.ts`) **SB11 förenklad** (förval),
**SB11 fullständig**, **Enkel** och en **egen lista** ur *Läs lagerlista ur
DXF…* under stilboken › Allmänt › DXF, med *Alla lager i listan*. Pennan som
färg och linjetjocklek. Status N/E/R ur åtgärden. Kryssrutan **Bärande** i
väggens egenskaper. DXF i exportdialogen (vyer DXF som förval, blad PDF och
DXF som val) med versionen. Kontrollerat med ezdxf (inga fel i `audit`) och
vår egen läsare; ritat med ezdxf:s matplotlib för ögat.

**Claudes val (0.12.1):**

- **Lagret härleds ur primitivens ursprung** (sort, del), objektet
  (yttervägg ur `outsideSide`, bärande, fast inredning, profilens littera,
  Platsen) och statusen. Väggarna i planen flyter ihop till en yta per
  åtgärd; ytan bär nu sina väggar (`owners`), och DXF:en klipper fyllningen
  och delar konturen per vägg, så att en innervägg och en yttervägg hamnar
  på var sitt lager. I sektionerna får en sammanslagen yta den första
  väggens lager.
- **Bärande**: utan val är ytterväggar bärande (27C) och innerväggar inte
  (43CB); kryssrutan i egenskaperna ändrar (27B, 42A).
- **Status**: har projektet ett befintligt tillstånd räknas åtgärden mot
  det, också i en vy utan jämförelse (N, E, R); vyn av Befintligt ger E;
  utan befintligt tillstånd `-`. Allmänna lager (text, mått, markörer, ram)
  har alltid `-`.
- **Förenklad**: byggdelarna enligt förslaget (15, 27B–27G, 41, 42A,
  42D--B/C, 43CB, 43CC-B/C, 45C, 46B--B/C, 3 mark, U rum) med `E-`; litteran
  `A-------T2-`, text `T-`, mått `D-`, plushöjder `D3`, markörer `J-`,
  norrpil `O2`, skalstock `O4`, ramen och det ritade på bladet `F-`,
  underlag `V1`, rumsstämpeln `A-U-----T1`. Profiler efter littera: P 27D, B
  27E, L 42E, TD 41. Trappor och räcken på Platsen hamnar på mark.
- **Fullständig**: dessutom vy-lagren för 15, 27, 42A, 42E, 43CB, 45C och
  46B (EI skuren, EJ bortom, EK dold/streckad, EM hitom = över snittet),
  litteran per byggdel (`A-27C---T2N`), 45CA trappor, 45CB räcken, J1
  sektions- och J4 fasadmarkörer, Y6 höjdkurvor, vägghål i yttervägg
  42D--M. Typ-/materialkoderna (11, 31 …) skrivs inte (förslagets 4.3 punkt
  2: tabellen tom tills betydelsen är utredd).
- **Färgerna**: ur hans mall när lagret står där; annars samma lager med en
  annan status; annars efter presentationskoden (EI grön 0,35, EJ röd 0,25,
  EK DASHED_1, EM DASHDOT1, T grön 0,35 …; rivs röd 0,25 DASHED_2); annars
  byggdelens *Beskrivande grafik* i mallen. Beskrivningen sätts samman som
  i mallen (*Arkitekt, Stomytterväggar, Beskrivande grafik, Nytt*).
- **Pennorna**: färgen efter tjockleken som i pennväljaren (grå 0,13 = 9,
  cyan 4, röd 1, grön 3, svart 0,50 = 7, magenta 6, blå 5, gul 2) och
  linjetjockleken (370) lika med pennan. En linje som har lagrets färg,
  tjocklek och linjetyp skrivs BYLAYER; annars får den egna (så ser filen
  ut som PDF:en oavsett lager). Pennans egen färg (t.ex. Färgmarkerad)
  följer inte med; solida ytor får närmaste ACI-färg och i 2018 också RGB
  och transparens.
- **Vitt** (papperets fyllning under befintliga väggar) skrivs inte: DXF
  har ingen mask, och en vit yta blir svart i AutoCAD.
- **Linjetyper**: mallens tolv definitioner följer med (mönstren i
  pappers-mm); en penna vars streck är en av stilbokens får stilbokens namn
  (*Streckad*), annars `CA-3_1,5`. `$LTSCALE` är vyns skala, 1 på bladen.
- **Texterna** är TEXT med versalhöjden 0,72 × texthöjden (som läsaren
  räknar), justering vänster, mitt eller höger, en rad per textrad, stilen
  `cad-apa` med `isocp.shx` för osifont, `arial.ttf` för Arimo.
- **Egen lista**: följer den SB11 läggs varje SB11-namn på närmaste lager i
  listan (samma namn, annan status, *E-*, samma byggdel), annars på 0;
  följer den inte SB11 skrivs SB11-namnen med listans färger där namnen är
  lika. Listan sparas i stilboken (följer med *Exportera…* och mallen).
- **Den samlade PDF:en** tar bara de blad som ska bli PDF, så att ett blad
  som bara blir DXF inte hamnar i den.

**Inte gjort i 0.12.1:** BLOCK/INSERT för markörer och upprepade symboler
(allt skrivs som entiteter); DIMENSION-entiteter (måtten är linjer och
text); layout med viewports för bladen; bilder (underlag och loggor; de
räknas upp efter exporten); fet text (samma stil); MTEXT; typ-/materialkoder
och brand/areor per slag (finns inga sådana objekt än); CoClass-lager
(Carl August: en framtida version); SWEREF (kommer med koordinaterna);
öppnat i AutoCAD, Archicad och QCAD (finns inte i sandlådan; Carl August
provar).

### 0.12.2 Förteckningar ✓

10 november 2026, en session. Samma format, 28 (valfria fält: projektets
`schedules` och vyns `maxHeight` på bladet). Carl August 10 november:
**0.12.2 Förteckningar och areor delas** i 0.12.2 Förteckningar och 0.12.3
Areor och förteckningen, och resten flyttar ett steg (A); en lång tabell
bryts i delar bredvid varandra på samma blad (C); CSV nu och XLSX i 0.12.3
med en egen skrivare och zipen som finns (D); rumsförteckningens förval
nummer, namn, våning, area och rumshöjd (E). Olika beskrivningar kan
behöva mer: först en egen enkel **rumsbeskrivningsmall**, sedan ett eget
**BEAst-paket** med allt som hör till den redovisningstekniken (E, efter
piloten).

**Gjort:** förteckningen som eget objekt i projektet (`src/core/schedules.ts`)
med källa (rum, dörrar, fönster, grindar, det generella litterat),
kolumner ur källans fält eller smarttext, sortering i två led, gruppering
med delsumma, summarad, en rad per littera, tillstånd och våningar.
Raderna räknas ur modellen (`src/repr/schedules.ts`), tabellen ritas som
en vy på bladet (`src/repr/scheduleTable.ts`), i ritytan som HTML och i
egenskaperna med direktsparade fält (`src/ui/scheduleFields.ts`,
`src/ui/app/schedules.ts`). CSV och PDF i *Exportera…*; i bladets PDF och
DXF. Provat i Playwright mot `dist/` (skapa, ändra, ångra, lägga på blad,
exportera; PDF:erna med `qpdf` och `pdftoppm`, DXF:en med ezdxf `audit`
utan fel).

**Claudes val (0.12.2):**

- **Förteckningen är inget ritat objekt** utan en inställning i projektet,
  som vyerna; raderna räknas fram varje gång (med en cache per dokument).
  Den ligger under **Vyer** i projektträdet, utan mappar.
- **Källorna och fälten**: rum (nummer, namn, våning, area, omkrets,
  rumshöjd, dagsljus, glasarea), dörrar och fönster (littera, antal,
  nummer för dörrar, typ, beskrivning, våning, modulmått, karmyttermått,
  hålmått, hängning, bröstningshöjd för fönster, och förteckningens fält
  ur stilboken), grindar (littera, antal, räcke, bredd, höjd för *Eget här*,
  hängning, lås), littera (nummer, sort, text, antal objekt), och status
  (Nytt, Befintligt) för alla. **Eget fält** läses som smarttext:
  rummens egna egenskaper, dörrarnas och fönstrens litterafält och
  förteckningens fält, litterans fält ur objekten den pekar på.
- **Förteckningens framräknade fält** som inte finns i modellen än
  (öppningssätt, utförande, poster, spröjs, karmtyp …) står som `-` tills
  förteckningen kommer i 0.12.3. *Hängning* är litteraregelns (V, H,
  sedd som Allmänt › Fönster och dörrar säger).
- **Förvalen**: rum per nummer med arean summerad; dörrar, fönster och
  grindar en rad per littera med antal summerat, sorterade på littera;
  littera per sort och nummer. Namnet *Rumsförteckning*, *Dörrförteckning*
  … med nummer om det är taget.
- **En rad per littera**: lika värden står kvar, olika blir *Olika*,
  *Våning* och *Nummer* räknas upp (*Plan 1, Plan 2*).
- **Sorteringen**: tal efter värdet, text med siffror i ordning (D2 före
  D10), tomma sist, våningarna nerifrån och upp (Platsen först).
- **Tillståndet**: förslaget som förval, ett annat väljs per förteckning;
  bara det som finns i tillståndet räknas (det som rivs inte). Littera
  utan tillstånd räknas alltid.
- **Enheten i rubriken** (*Area, m²*, *Bröstningshöjd, mm*); rubriken går
  att skriva om. Arean med stilbokens decimaler, omkrets och glasarea med
  en.
- **I ritytan** visas tabellen som HTML över ritningen, som förhandsvisning;
  den stängs när man går till en våning, vy, fasad eller ett blad.
  Inställningarna sparas direkt när ett fält ändras (inget *Spara*), och
  varje ändring är ett steg att ångra.
- **På bladet** i 1:1 med rubriken ovanför och ingen skala; den räknas inte
  i bladets `{skala}`. Text 2,5 mm (rubrikraden fet), radhöjd 5,5 mm,
  ytterram 0,25, rubrikraden och summaraden med 0,35 under och över,
  rutnätet 0,13, tal högerställda. Bryts vid bladets ramhöjd minus 20 mm
  när vyn inte har en egen *Största höjd*, med 8 mm mellan delarna.
- **DXF**: förteckningen på lagret `A-------I--` (SB11, som
  teckenförklaringen) och `A-TEXT` (Enkel); PDF-lagret *Förteckningar*.
- **CSV**: semikolon, decimalkomma och BOM (svensk Excel), tal utan
  tusentalsavgränsare, gruppernas rubriker och summor som egna rader.
  Filnamnet `{projekt}_{vy}` som vyernas; undermappen *Förteckningar*.

**Inte gjort i 0.12.2:** areorna enligt SS 21054 och förteckningen av
fönster och dörrar med ritningen per littera (0.12.3); förteckningen över
markförändringarna (0.12.3 eller egen version); XLSX (0.12.3);
handlingsförteckningen (med utgåvorna, 0.12.5); att förteckningarna följer
med *Mall för nya projekt…*; mappar för förteckningarna; att skriva i
tabellen (förteckningens rutor skriver på objekten, 0.12.3); fet stil på
skärmen (osifont har ingen fet, som förut).

### 0.12.3 Areor ✓

10 november 2026, en session. Samma format, 28 (ny objekttyp `Area` och
stilbokens valfria `general.areas`). Carl August 10 november, F–J (efter
A–E samma dag): **0.12.3 delas** i 0.12.3 Areor (med XLSX), 0.12.4 Areor
under snedtak och mark och 0.12.5 Förteckningen, och resten flyttar (F).
Areorna ritas som egna objekt över rummen, som BOA-zonen i Archicad;
rummen räknas inte med (B, C). Konturen följer väggarna och går att lösgöra
till en egen polygon, med eller utan de automatiska avdragen (G). `e/g`
och `(t)/(it)` som val (H). En Areaplan med areorna i färg, halvtransparent
fyllning och opak kontur i samma färg; förvalsfärgerna hans (I). Areor
redovisas oftast som tal i ritningshuvudet eller en tabell i ritningens
typsnitt, så smarttexten och förteckningen är huvudsaken. Snedtaket räknas
mot takets undersida; hanbjälkar och låga innertak behöver inte hanteras
(J). Allt exakt enligt standarden före piloten (D).

**Gjort:** objekttypen och beräkningen (`src/elements/areaCalc.ts`,
`area.ts`), verktyget Area med Shift+klick, egenskaperna med *Lösgör*,
BTA och BYA framräknade, avdragen (5.3, 5.8, 5.12, 5.15.2, 5.16.3,
5.17, 5.18.2), Areaplan, färgerna i stilboken, areaförteckningen med BRA,
smarttexten, DXF-lagren och XLSX för alla förteckningar.

**Claudes val:**
- **Enheten ur rummen**: rummen man klickat i, och väggarna som har ett av
  dem på båda sidor (klippta till det som ligger mellan rummen, så att en
  vägg som fortsätter förbi enheten inte följer med). Väggarna som bara har
  enheten på ena sidan är omslutande och räknas inte.
- **Avdragen** som en regel: det i väggar, pelare och schakt inom enheten
  som ligger mer än 0,15 m från golvet räknas bort. Det ger 0,30-regeln för
  väggar och pelare på en gång (600 × 600 drar av 300 × 300, 900 × 900 drar
  av 600 × 600). En pelare intill en omslutande vägg hör till väggmassan och
  ligger utanför rummet, så den räknas bort helt. Lodräta profiler (P01 …)
  räknas som pelare.
- **En egen kontur**: väggar som skär kanten är omslutande och räknas bort
  helt; väggar helt innanför följer 0,15-regeln. En pelare ritad som vägg
  intill den egna konturens kant följer också 0,15-regeln (den syns inte
  som pelare); rita konturen längs väggarnas insida.
- **BIA och BOA i samma bostad** (5.18.2): när någon vägg mellan en BIA och
  en BOA på våningen har en dörr hör alla väggar upp till 0,30 m mellan dem
  till BIA, och BOA:n lämnar dem. Utan dörr mellan dem hör väggen till ingen.
- **Breda öppningar** (5.3.2, 5.7, 5.17.2): dörrar och glaspartier
  (bröstning högst 0,15 m) på minst 1,50 m i en omslutande vägg. I en
  yttervägg räknas smygen till karmens insida, mot en annan enhet till
  karmens mitt. Fönster med bröstning räknas inte.
- **Hål i bjälklaget**: ritade hål i våningens bjälklag dras av, utom över
  en trappa från våningen under när hålet är högst 30 % större än trappan
  (då räknas allt, annars bara trappan). Trappans eget hål räknas med.
- **BTA** är husets ytterkontur ur väggarna (ytterväggarnas utsida) minus
  hålen. **BYA** räknas på den lägsta våningen med golvet högst 0,6 m under
  ±0; taksprångets djup mäts vinkelrätt mot fasaden (geringen i hörnen) och
  lägsta punkten på takets undersida, mot ±0 som marken. Balkonger och
  burspråk finns inte som objekt än.
- **Avrundningen** enligt SS 14141 regel A: delposterna med en decimal,
  summorna i hela m². BRA per våning räknas ur de exakta areorna, inte de
  avrundade.
- **Förteckningen** grupperad per areaslag (BYA, BTA, BRA, BOA, BIA, LOA,
  ÖVA, OPA) med delsumman och ingen summa av alla slag; *En rad per
  beteckning, funktion och våning* som förval. BTA- och BYA-objekten visar
  bara konturen och räknas inte två gånger.
- **Smarttexten** `{BOA}` … är inbyggd (inte ett fält), för hela projektet
  i förslaget, tom när slaget saknas.
- **Ritningen**: fyllningen ovanpå väggarna (det som räknas i väggar och
  pelare syns), BYA och BTA under de andra, konturen 0,35, stämpeln i det
  första rummet med beteckningen fet och arean under, svart text.
  Täckningen 35 %. Areorna syns bara där `+Area` är tänt (Areaplanen, eller
  *Visa › Areor*); de går inte att klicka på annars.
- **DXF**: SB11 `A-A-BOA-E-N` och `A-A-BOA-T2N` (ÖVA som `OVA`, som i
  mallen), Enkel `A-AREA-BOA`.
- **XLSX**: en egen skrivare (`src/formats/xlsxWrite.ts`) med texten direkt
  i cellerna, talformaten 0, 0,0 och 0,00, rubrikraden fryst, `SUM` (Excel
  visar `SUMMA`) med det uträknade värdet i filen. Provad i LibreOffice och
  openpyxl.
- **Kategorin Areaplan** kommer med nya projekt; en äldre stilbok får den
  med *Lägg in Areaplan* i verktygets rad (inte av sig själv, så att en
  borttagen inte kommer tillbaka).

**Inte gjort i 0.12.3:** snedtaket (1,90 och 0,60), takkupan, rumshöjden
H/L, våning under mark med 6-meterszonen och `(o)/(u)` och OPA:s egna
regler (0.12.4); att rita en ny egen kontur direkt med verktyget (nu
*Lösgör* och Modifiera); NTA och KA; att en vägg i en egen kontur känns
igen som pelare; balkonger, burspråk och skärmtak i BYA (finns inga sådana
objekt); att areorna följer med *Mall för nya projekt…*.

### 0.12.4 Areor under snedtak och mark ✓

10 november 2026, en session. Samma format, 28 (valfria fält: areans
`heightSplit`, takets `dormer`). Carl Augusts svar A–E 10 november: A
takkupan som ett kryss på taket (prova); B H/L med ett kryss per area; C
terrängen räcker, inget kryss *Mot annan byggnad*; D BOA bortom zonen blir
BIA(u) av sig själv (prova); E OPA som egen kontur, med smartspöt på ett
tak som start.

**Gjort:** snedtaket för BTA och bruksareorna (5.1.3, 5.13, 8.4), kryss
*Takkupa* (5.14), *Dela efter rumshöjd* (18.5), 6-meterszonen med BIA(u),
(o) och (u) och BTA(o)/BTA(u) (10.3.1.3, 11.3.1.3, 18.3), OPA:s egen kontur
till ytterväggens utsida (7.4) med takets kontur som start, delarna i
stämpeln, egenskaperna och förteckningen.

**Claudes val:**
- **Rumshöjden** mäts bara mot taken (svar J): bjälklaget ovanför, fasta
  undertak och nedstickande balkar räknas inte. Tak på alla våningar räknas,
  utom de som ligger helt under golvet. Taken räknas också när de är
  släckta i vyn, så att arean inte ändras med Visa.
- **Bredden 0,60** (5.1.3) som en öppning: det som är kvar när den låga
  delen vuxit 0,30 m växer tillbaka. Det gäller bara mot snedtak, inte en
  smal remsa mellan en vägg och 1,90-linjen.
- **0,60 m ut** med raka hörn (planen möts), också runt valmens hörn.
- **Takkupan**: inom kupans kontur i plan räknas kupans tak; konturen bör
  gå från kupans framkant in till där den möter taket (dess tänkta
  förlängning in i byggnaden).
- **H och L** delas vid 2,10 utan 0,60-tillägget (figur 29). ÖVA delas inte
  (18.5 nämner bara BRA, BOA, BIA och LOA).
- **6-meterszonen**: marken läses 0,30 m utanför väggens utsida var 0,25 m;
  golvet räknas i nivå med marken inom 20 mm. Zonen går från väggens
  utsida (så att BTA(o) får med väggen) till 6 m in från insidan. Vid en
  vägg som slutar i ett invändigt hörn förlängs remsan 6 m (linjerna möts),
  annars halva väggtjockleken över hörnet. Där marken ligger utanför
  markmodellen räknas golvet som ovan mark.
- **Beteckningarna**: (o) och (u) bara på en våning där golvet ligger under
  marken någonstans; BOA får ingen (o) (BOA är ovan mark per definition),
  BOA bortom zonen blir BIA(u). Ordningen är slag, tillhörighet, läge,
  temperatur och rumshöjd: *BIAe(u)(t)*, *BOA:H*. BRA och BYA delas inte.
- **Delarna** är rader i förteckningen och står i stämpeln och
  egenskaperna; `{BIA}` räknar med BIA(u).
- **OPA** räknas utan avdrag (väggar och pelare inom det öppna räknas med,
  7.3.2) och slutar vid ytterväggens utsida (7.4). Smartspöt tar det
  minsta taket under klicket, på alla våningar.

**Inte gjort i 0.12.4:** trappan som gräns mellan två nyttjandeenheter
(5.15.5, sällsynt i villor; efter piloten); att kupan kapar taket under i
planen och 3D; vägg mot annan byggnad (svar C); den ”mörka” arean i andra
hus än småhus räknas som i småhus; hanbjälkar och låga undertak (svar J).

### 0.12.5 Förteckningen per littera ✓

Carl August 12 november: "Nästa är 0.12.5", med svaren A–E på Claudes
förslag och en rättelse av namnet. Mellanstor, en session. Samma format, 28
(valfria fält: förteckningens `layout`, `figureScale`, `noFigure`,
`hideEmpty`; bladvyns `maxWidth`).

**Namnet (Carl August):** listorna heter **förteckningar**. En
*uppställning* är en elevation av en enskild byggdel eller ett rum (kök,
badrum); ritningen av dörren eller fönstret i förteckningen är en liten
illustration, en bonus. Allt som hette uppställning i appen och dokumenten
heter nu förteckning (*Förteckningens fält*). Vytypen *Uppställningar* i
stilboken (efter piloten) behåller sitt namn och betyder elevationerna.

**Svaren:** **A** markförändringarnas förteckning blir en egen version
(0.12.6), resten flyttar ett steg; **B** ritningen i 1:50 som förval,
valbar per förteckning; **C** alla rader syns som förval, också de tomma;
**D** nivån Normal, och V och H ska både kunna dela littera (förval, tidigt
i projektet) och vara skilda (senare); **E** man skriver i tabellen över
ritytan, inte på bladet. **Grindarna stryks**: han menade att grindar ska
kunna sättas ut i staket och redovisas i planen (finns sedan 0.11.3), inte
att de ska in i en förteckning; en grind ritas vid behov som egen ritning.

**Gjort:** dörr- och fönsterförteckningen *uppställd per littera* (fälten
som rader, en kolumn per littera, ritningen sedd utifrån med
karmyttermåtten), rutorna som skriver på alla objekt med litteran,
*Olika*, de framräknade fälten ifyllda, föreskrifterna till höger, *Dölj
tomma rader*, ritningens skala, band under varandra på bladet, CSV och XLSX
med fälten som rader, och namnbytet.

**Claudes val (0.12.5):**

- **Ingen ny sort i trädet.** Förteckningen per littera är ett val
  (*Uppställd*) på dörr- och fönsterförteckningarna från 0.12.2, och
  förvalet för nya; tabellen med en rad per objekt eller littera finns kvar
  som det andra valet. Då delar de tillstånd, våningar, blad och export.
- **Raderna är stilbokens fältmall**, i dess ordning (stilboken › Typer ›
  Förteckningens fält); förteckningen har inga egna rader. Kolumner,
  sortering, gruppering och summor gäller bara tabellen.
- **V och H** styrs av litteraregeln som redan finns (stilboken › Allmänt):
  *Typ och mått* (förval) ger en kolumn där *Hängning* räknar upp (*2 V,
  1 H*) och ritningen visar den första; *Typ, mått och hängning* ger var
  sin kolumn. Inget nytt val i förteckningen.
- **En ruta skriver på objekten i kolumnen**, alltså de med litteran i
  förteckningens tillstånd och våningar, i en transaktion.
- **De framräknade fälten**: *Utförande* är typens namn, *Öppningssätt*
  lufternas (dörrblad med slag skrivs *Slagdörr*), *Öppningsbredd* och
  *Öppningshöjd* hålets mått, *Poster* antalet lodräta och vågräta,
  *Spröjs* sorten och antalet (*Löstagbar 1+2*), *Karmdjup* typens,
  *Väggtjocklek* väggens. *Karmtyp* räknas inte än och står `-`.
- **Ritningen**: linjer i tre tjocklekar (karmens kontur 0,25, delarna
  0,18, symbolen 0,13; streckad när luften öppnas inåt), utan glasmarkering
  och beslag. Måtten är karmyttermåtten, bredden under och höjden till
  höger. Ritningarna står på en gemensam linje.
- **Föreskrifterna** är gemensamma för sortens förteckningar och bor i
  projektet (`project.openingSchedule.notes`, i formatet sedan 0.11.8);
  typernas föreskrift (`spec`) står efter, med litterorna som ett spann.
  Kolumnen är 70 mm bred på bladet.
- **På bladet** bryts den på bredden (band under varandra), inte på höjden
  som tabellen. *Största bredd* på bladvyn.
- **Grindförteckningen** från 0.12.2 togs bort i 0.12.5.1 (Carl August 12
  november: "Ta bort grindförteckning från 0.12.2"): källan `Gate` finns
  inte längre, en sådan förteckning i en äldre fil läses inte in (ingen
  migrering före frysen).

**Inte gjort i 0.12.5:** markförändringarnas förteckning (0.12.6, sedan
13 november 0.12.9);
vägghålens förteckning; ritningen per hängning i samma kolumn; egna rader
per förteckning (annan ordning än fältmallens); radbrytning i en ruta med
lång text (kolumnen blir bredare); löpnummer per objekt; *Karmtyp*;
förteckningarna och uppställningarna som vytyper i stilboken med egna
pennor (efter piloten).

### 0.12.6 IFC

Flyttad före markförändringarna 13 november (Carl August: Höjdkurvor kan
kanske leverera en jorddjupsmodell, och markförändringarna väntar på den).
Utredningen gjord 13 november i en egen chatt, med Carl Augusts export ur
Archicad 27 (företagets översättare, Reference View) som jämförelse:
**`cad-apa-ifc-utredning.md`** i projektet är specifikationen. IFC4
Reference View, mm, utan mark och träd (svar D). GUID:en finns sedan 0.12.
Stor; byggs i två sessioner, **0.12.6** (strukturen, väggar, bjälklag, tak,
dörrar, fönster, rum, egenskaperna, raden i exportdialogen) och
**0.12.6.1** (trappor, räcken, profiler, möbler, vägghål, granskningen mot
Archicad, Revit och Solibri). Mottagare först Carl August själv, sedan en
konstruktör.

### 0.12.7 Utgåvor och PM

Mockup i Claude Design först, sedan snapshot, jämförelse, revideringsmoln
och -pilar, beteckningar, handlingsförteckningen, ändrings-PM och panelen
Utgåvor. Stor, troligen två sessioner.

### 0.12.8 3D-vyer

Carl August 26 oktober: före piloten, det är något man kan förvänta sig.
Mellanstor.

- 3D-vyn som en egen punkt i modellfliken, där vyer sparas som perspektiv
  eller axonometri
- Trädmodeller: fem som slumpas vid import och går att byta för markerade
  träd, i tre detaljnivåer (low poly, silhuett, detalj); träd på
  Enscape-nivå efter piloten

### 0.12.9 Markförändringar

Förteckningen över markförändringarna (Inkorgen 27 oktober, lyft ur 0.12.5
12 november): littera och namn, status, area i plan, schakt, fyll och
netto, berg och jord (m³ och procent), lägsta och högsta nya höjd, största
lutning, avtagen matjord (area × tjocklek, tjockleken en inställning) och
en summarad med massbalansen. Mellanstor.

Flyttad efter 3D-vyerna 13 november: Carl August ser om Höjdkurvor kan
leverera en **jorddjupsmodell** (berg under jorden), så att berg och jord
räknas ur ytor i stället för den uppskattade andelen berg per objekt
(0.10.13). Schakt och fyll per objekt räknas redan (`finishedGround` i
`src/core/ground.ts`, `massBalance` i `src/elements/groundGeometry.ts`);
det som saknas är källan *Mark* i förteckningarna, arean, höjderna,
lutningen, matjorden och summaraden.

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

- **Areor: trappan som gräns mellan två nyttjandeenheter** (SS 21054 5.15.5): utrymmet under trappan som snedtak, resten till grannen (0.12.4). Och att en takkupa kapar taket under i planen och 3D.
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
