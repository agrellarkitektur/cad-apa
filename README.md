# Bacchus

Ritprogram i webbläsaren för små arkitektkontor. *Bacchus* är motorns interna
namn; produktnamnet (just nu låtsasbrandingen **cad-apa**) ligger i `src/brand/`
och kan bytas utan att röra resten av koden.

Arkitektur och byggordning beskrivs i dokumentet *Ritprogram för små kontor –
arkitektur och demoplan*. Koden motsvarar **steg 5 av 12: dörrar, fönster och anteckningar**.

## Vad som fungerar

Steg 1, skelett:
- Planvy i mm med rutnät som anpassar sig efter zoomen (1 · 5 · 10 · 50 … mm)
- Panorera och zooma med mus, styrplatta och pekskärm (nyp med två fingrar)
- Zooma till allt med knappen, tangenten **F** eller dubbelklick med mittenknappen
- Skalstock, koordinater och ungefärlig skärmskala i statusraden
- Kan installeras som app (PWA) och fungerar offline

Steg 2, kärnan:
- Datamodell med våningsplan, tillstånd, element, definitioner och egenskaper
- Tillstånd (Befintligt, förslag, etapper): varje objekt kryssas i där det
  finns, och befintligt, rivs och nytt räknas ut när två tillstånd jämförs
- Väljare för vilket tillstånd som visas
- Nytt förslag som kopia av det som visas
- Ångra och gör om (**Ctrl/Cmd+Z**, **Ctrl/Cmd+Shift+Z**)
- Autospar i webbläsaren, spara och öppna projektfil
- Väggar, dörrar, fönster, möbler och rum som elementtyper med egna planregler
- Exempelprojekt: ombyggnad av en villa med två förslag

Steg 3, väggverktyget:
- Rita väggar punkt för punkt (**W**), med mus eller finger
- Snäpp till ändpunkter, mittpunkter, vinkelrätt, skärningar, på vägg och 15°-vinklar
  (**Shift** låser till 45°)
- Skriv in längd och tryck Enter; avsluta med Esc, dubbelklick, Klar eller startpunkten
- Referenslinje vänster, mitt eller höger
- Väggskarvar: gering i hörn, rena T- och korsskarvar, öppningar utskurna
- Markera (**V**) med klick, Shift-klick eller ruta; dra i väggändarna
- Egenskapspanel (**P**) för det markerade: i vilka tillstånd det finns, typ och mått
- Typer med littera (IV01, D1, F1): tjocklek och mått ändras på ett ställe för alla
- Stilmallar: svensk standard (vita väggar med svart kontur, rivs streckat, nytt
  skrafferat, befintliga dörrar 30°), Poché och Färgmarkerad som alternativ,
  egna färger och fyllningar, spara och öppna som fil
- Filformat 2 med automatisk uppgradering av äldre projekt

Steg 4, 3D-vyn:
- 3D, plan eller båda sida vid sida (**2**, **3**, **4**)
- Väggar med fönster och dörrar i rätt höjd, möbler och golv; varje vägg är
  en hel kropp med öppningarna som urtag, så att inga skarvar syns
- Snurra med ett finger eller vänster musknapp, panorera och zooma med två fingrar,
  höger musknapp eller hjulet; klicka för att markera
- Visar det tillstånd som är valt; nya väggar tonas när jämförelsen är på
- Igensatta dörrhål ritas som ny vägg och nya öppningar i befintlig vägg får
  skrafferade zoner på sidorna
- Väggändar dras en vägg i taget; är flera anslutna väggar markerade följer
  de med. Efter draget visas en ruta där längd, ändring och vinkel kan skrivas in
- Markerade objekt flyttas genom att dra i dem; avstånd och vinkel kan
  sedan skrivas in. Vinkel kan också skrivas in när man ritar väggar
- Grepp och flytt fungerar även i 3D-vyn
- Dörrar och fönster står still när en vägg förlängs eller kortas, oavsett
  vilken ände man drar i
- Snabbrad överst i panelen med det vanligaste för det som är markerat:
  ta bort, riv eller behåll, vänd slag och hängning på dörrar, vrid möbler
- På mobilen kommer panelen upp nedfälld som en snabbrad när något markeras.
  Dra i strecket för att fälla upp hela panelen eller ned för att stänga.
  Varje tryck lägger till i markeringen; ett tryck i tomma delar avmarkerar
- Gränssnitt (i menyn): rutnät, färg på markeringar och referenslinjer,
  vilka snabbknappar som visas för varje sorts objekt, och kortkommandon
- Referenslinjen heter utsida, center eller insida (vänster/höger liv för
  innerväggar) och ritas ut mellan greppen. Väggar som ritats moturs rättas
  när man ritat klart, så att linjen hamnar i det liv man valt
- Detaljnivå Skiss eller Normal. Normal ritar karmar (50 × 100 mm),
  glasningslinje för glasade dörrar, och placerar karmen 50 mm in från
  utsidan i ytterväggar och i liv med öppningssidan i innerväggar. Indrag
  och karmmått kan ändras per dörr och fönster
- Flytt snäpper kant i kant mot väggliv och andra möbler. Markerade möbler
  visar hörnpunkter: tryck nära ett hörn och dra för att lägga just det
  hörnet mot ett annat
- Nytt projekt frågar efter nybyggnad, tillbyggnad eller ombyggnad, så att
  rätt tillstånd skapas. Befintligt ritas med 30°-dörrar även utan jämförelse
- Teman som på höjdkurvor.se: Blueprint, Ljust och Mörkt

Steg 5, dörrar, fönster och anteckningar:
- Dörr (**D**) och fönster (**O**): peka på en vägg och klicka. För dörrar blir
  sidan man pekar på öppningssidan och gångjärnen hamnar närmast markören.
  Avståndet till väggens ändar visas, läget snäpper mot väggens mitt, och
  öppningar som krockar med andra stoppas
- Rum (**R**): klicka i ett utrymme som väggarna omsluter. Rummet följer
  väggarna när de flyttas. Rumsetiketten visar namn, nummer, area och takhöjd
- Rumsnummer med fyra siffror (byggnad, plan, löpnummer) eller tre, räknade i
  vänstervarv från entrén som när man följer vänster vägg. Numreringen kan
  låsas; nya rum får då nästa lediga nummer
- Mått (**M**): klicka punkterna, dubbelklicka eller tryck Enter, och placera
  måttlinjen. Vågrätt, lodrätt eller längs punkterna beroende på var den läggs
- Text (**T**): skriv i verktygsraden och klicka där texten ska stå
- Littera ritas ut för väggar (på insidan av ytterväggar), dörrar och fönster
- Visa-menyn: dölj det som rivs (igensatta dörrhål syns ändå), littera, rum,
  möbler, mått och text
- Fast inredning ritas svart, lös möblering utgråad
- Snabbmeny vid markören på dator när något markeras, med Mer för hela panelen
- I 3D har markering, grepp och referenslinjer samma färger som i planen

Version 0.6 (filformat 3):
- Varje vägg har en insida, höger sida i ritriktningen. Referenslinjen heter
  Utsida, Center eller Insida. Väggverktyget vänder ytterväggar som ritats
  moturs, och äldre projekt vänds när de öppnas. Vänd väggen byter insida
- Modulmått: D10×21 sitter i ett hål 1010×2110 med karm 990×2090
- Tre detaljnivåer: Skiss (ingen littera), Normal (karmar, bygglov) och
  Detalj (dörrblad med tjocklek, falsar, fönsterbågar, bygghandling)
- Litteramallar per objekttyp och detaljnivå i stilmallen, med fält som
  {typ}, {storlek}, {nummer}, {hål}, {karm} och egna egenskaper
- Individuella dörrnummer som följer rumsnumreringen (D1203), kan låsas.
  Huvudentré kan anges på en dörr
- Egna egenskaper på objekt och typer, t.ex. brandklass och ljudklass
- Vägglittera på väggens insida med streck mot väggen; texter vänster- eller
  centrerade och texthöjder i stilmallen
- Fyllningar: Solid, skraffering med egen bakgrund, opacitet för båda
- Mått knutna till väggliv, hålkanter och möbelkanter: de följer med när
  något flyttas och döljs när det de mäter till inte syns. Klick på en vägg
  med måttverktyget måttsätter båda liven. Ett nytt värde i panelen flyttar
  det måttet pekar på
- Tillfälliga mått när en vägg är markerad: klicka och skriv ett nytt avstånd
- Automatisk måttsättning av nya väggar och öppningar när man jämför (av/på
  under Gränssnitt)
- Vyer: tillstånd, jämförelse, detaljnivå, vad som visas, stilmall och
  spårning sparas i projektet. Spårning visar en annan vy tonad under
- Kopiera, spegla och vrid; Avbryt-knapp ovanför verktygsraden; snäppning
  av och på (S); ett ångra-steg per handling; rad om ny version på webbhotellet
- Det som påverkar fler objekt (typens mått, numrering) samlas längst ned i panelen

Version 0.6.1 (liten uppdatering, samma filformat):
- Navigatorn (☰ eller N) med flikarna Underlag, Modell, Vyer och Ritningar.
  På datorn ligger den ovanför egenskaperna i högerspalten och de fälls ihop
  var för sig; på telefonen fyller den skärmen. Underlag, arbetsblad och
  ritningar fylls i steg 6
- Tillfälliga mått: värdet används med Enter, ✓ eller när man trycker
  någon annanstans. På telefonen skrivs det i en rad överst i ritytan

## Versioner och gamla projekt

Projektfilerna har ett formatnummer. När formatet ändras uppgraderas äldre
projekt automatiskt när de öppnas; nyare projekt än programmet kan inte
öppnas. Vill man kunna gå tillbaka kan varje version läggas i en egen mapp
på webbhotellet (t.ex. `cad-apa/0.5/`, `cad-apa/0.6/`) bredvid den senaste.

## Kom igång

Kräver Node.js 20 eller senare.

```sh
npm install
npm run dev        # startar en utvecklingsserver, öppna adressen som visas
npm test           # kör testerna
```

Hur programmet byggs ut steg för steg står i [docs/UTVECKLING.md](docs/UTVECKLING.md).

## Publicera på webbhotellet

```sh
npm run build
```

Ladda sedan upp **innehållet** i mappen `dist/` till en mapp på servern, till
exempel `agrellarkitektur.se/cad-apa/`. Appen använder relativa sökvägar och
fungerar i vilken mapp som helst. Uppdatera genom att bygga igen och ersätta
filerna; den som har appen öppen får den nya versionen vid nästa omladdning.

Servern behöver skicka `.webmanifest` som `application/manifest+json`. De flesta
webbhotell gör det redan.

## Byta varumärke

1. Kopiera `src/brand/cad-apa.ts` till en ny fil och ändra namn, logga och färg.
2. Lägg till den i listan i `src/brand/index.ts`.
3. Bygg med `VITE_BRAND=<nyckel> npm run build`.

## Mappar

```
src/
  brand/      produktnamn, logga, färger och filändelse
  core/       datamodell, tillstånd, kommandon, ångra och gör om
  elements/   en fil per objekttyp: vägg, dörr, fönster, möbel, rum
  repr/       ritningsprimitiver, planen och 3D-formerna
  view2d/     planvyn: kamera, rutnät, skalstock, ritning av primitiver
  view3d/     3D-vyn med three.js (laddas först när den öppnas)
  storage/    filformat med versioner, autospar, spara och öppna
  sample/     exempelprojektet
  ui/         verktyg, egenskapspanel, stilmall, meny, statusrad, ikoner
  geometry/   vektorer, polygoner och booleska operationer
  styles/     CSS med ljust och mörkt tema
  fonts/      Archivo och IBM Plex Mono (SIL Open Font License)
tests/        tester för kärnan, planen och filformatet
docs/         utvecklarguide
```

## Licens

Öppen källkod. Licens (MIT eller GPL) bestäms innan koden publiceras.
