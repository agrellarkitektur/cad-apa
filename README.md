# Bacchus

Ritprogram i webbläsaren för små arkitektkontor. *Bacchus* är motorns interna
namn; produktnamnet (just nu låtsasbrandingen **cad-apa**) ligger i `src/brand/`
och kan bytas utan att röra resten av koden.

Idé och principer beskrivs i [docs/ARKITEKTUR.md](docs/ARKITEKTUR.md), och vad
som byggs i vilken version i [docs/PLAN.md](docs/PLAN.md). Nuvarande version är
**0.8.1** (beta, granskning utan nya funktioner); nästa är **0.8.2,
snabbare ritning och referensritningar**.

## Vad som fungerar

Version 0.1, skelett:
- Planvy i mm med rutnät som anpassar sig efter zoomen (1 · 5 · 10 · 50 … mm)
- Panorera och zooma med mus, styrplatta och pekskärm (nyp med två fingrar)
- Zooma till allt med knappen, tangenten **F** eller dubbelklick med mittenknappen
- Skalstock, koordinater och ungefärlig skärmskala i statusraden
- Kan installeras som app (PWA) och fungerar offline

Version 0.2, kärnan:
- Datamodell med våningsplan, tillstånd, element, definitioner och egenskaper
- Tillstånd (Befintligt, förslag, etapper): varje objekt kryssas i där det
  finns, och befintligt, rivs och nytt räknas ut när två tillstånd jämförs
- Väljare för vilket tillstånd som visas
- Nytt förslag som kopia av det som visas
- Ångra och gör om (**Ctrl/Cmd+Z**, **Ctrl/Cmd+Shift+Z**)
- Autospar i webbläsaren, spara och öppna projektfil
- Väggar, dörrar, fönster, möbler och rum som elementtyper med egna planregler
- Exempelprojekt: ombyggnad av en villa med två förslag

Version 0.3, väggverktyget:
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

Version 0.4, 3D-vyn:
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

Version 0.5, dörrar, fönster och anteckningar:
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
- Navigatorn, numera Projektträdet (☰ eller N), med flikarna Underlag,
  Modell, Vyer och Ritningar. På datorn ligger den ovanför egenskaperna i
  högerspalten och de fälls ihop var för sig; på telefonen fyller den
  skärmen. Underlag, arbetsblad och ritningar fylls i 0.8
- Tillfälliga mått: värdet används med Enter, ✓ eller när man trycker
  någon annanstans. På telefonen skrivs det i en rad överst i ritytan

Version 0.6.2 (liten uppdatering, samma filformat):
- En äldre version skriver aldrig över ett projekt som en nyare version har
  autosparat. Statusraden visar då *Autospar låst*; spara som fil i stället.
  Ett autospar som inte går att läsa alls läggs undan i stället för att
  försvinna
- Dörrar som finns i Befintligt ritas 30° öppna, alla andra 90°, oavsett vad
  vyn jämförs med. I stilmallen heter raderna nu Nybyggnad, Befintligt, Rivs
  och Planerat
- Vägglittera har ett rakt streck från texten in till väggens mitt
- Areatexten i rummen är svart
- Ingen kontur mellan skrafferingen och den befintliga väggen vid ny
  håltagning
- På datorn ligger projektträdet och egenskaperna bredvid varandra, med var sin
  knapp (☰ och P). Dra i strecket i vänsterkanten för att ändra bredden,
  klicka på det för att fälla ihop. Bredderna sparas i webbläsaren
- Klicka på skärmskalan i statusraden och skriv en skala, t.ex. 1:50. Med
  skärmens storlek i tum under Gränssnitt blir skalan exakt
- Dubbelklicka (eller dubbeltryck) på en text eller ett rumsnamn för att
  redigera det direkt i ritningen. Etiketter går att träffa var som helst på
  texten
- Texthöjder för annotering visas med två decimaler (2,50 mm)
- Färdig zip för webbhotellet på varje release, och steg-för-steg-hjälp nedan

Version 0.6.3 (liten uppdatering, samma filformat):
- Formler i alla sifferfält: `2400+300`, `+300` (läggs till det som står),
  `*2`, `(3600-2*95)/2`. Enheter går att skriva ut: `30cm`, `2,4m`, `1 m + 5 cm`;
  vinklar i grader eller gon. Resultatet visas medan man skriver och används
  med Enter. På telefonen kommer en rad med + − × ÷ ( ) ovanför knappsatsen.
  Pil upp och ned stegar värdet. Gäller även tillfälliga mått och rutan efter
  ett drag
- Anslutna väggar följer med när en vägg flyttas: hörn och T-skarvar sitter
  kvar och de anslutande väggarna förlängs eller kortas. Håll **Alt** för att
  flytta väggen fri
- Högerklick (långtryck på telefonen) på objekt, i tom ritning, på vyknappen
  och i projektträdet. För objekt: snabbknapparna, alla inställningar,
  zooma till, markera alla av samma typ eller sort, och i vilka tillstånd det
  finns
- Ny topprad: logotypen öppnar huvudmenyn, Nytt, Öppna och Spara bredvid,
  ångra och gör om till vänster, ☰ och P uppe till höger, Tema och Demo
  längst till höger. Zoomknapparna har flyttat ned till skärmskalan
- Spara skriver tillbaka till samma fil (Chrome på datorn); Spara som…
  väljer en ny. **Ctrl+S**, **Ctrl+Shift+S**, **Ctrl+O**, **Ctrl+Alt+N**
- Projektträdet och Egenskaper har rubriker med _ (minimera till ett smalt
  band med texten på högkant) och × (stäng). Ett klick på dragstrecket
  minimerar
- Snabbmenyn vid markören går att flytta i greppet (dubbelklick för att
  släppa den igen). Mer fäller ut alla inställningar i snabbmenyn
- Notera heter Annotera
- Vyknappen: klick går till förra vyn, håll in eller högerklicka för de fem
  senaste (vyer och modellen). Byt namn, duplicera, uppdatera, ta bort och
  Kalkera den här vyn ligger i högerklicksmenyn på vyerna i projektträdet
- Spårning heter Kalkera. Under Visa ställs in om kalkeringen ligger under
  eller över, i vilken färg och med vilken opacitet. Det sparas per användare
  i webbläsaren, inte i projektet
- Vyns tillfälliga inställningar (tillstånd, jämförelse, detaljnivå, visa,
  kalkera) är samlade i en panel med samma utseende på alla knappar

Version 0.7, fasader och sektioner (filformat 4):
- Fasader och sektioner räknas fram ur modellen med dolda linjer borttagna,
  i det tillstånd och den jämförelse som är vald. Sektionen fyller det som
  skärs enligt stilmallen. Marklinje och nivåkoter för golv och högsta punkt
- Varje projekt har en norrpil, fyra fasader som placeras runt huset av sig
  själva och en sektion. Fasaderna heter efter närmaste väderstreck: Fasad
  mot norr, nordost, ost … Automatiskt läge kan slås av; då ligger linjen
  kvar och kan flyttas och vändas
- Verktygen Sektion och Fasad: klicka linjens början och slut och sedan den
  sida som ska synas. Fasader och sektioner listas under Modell i
  projektträdet; dubbelklicka på linjen i planen för att öppna vyn. En sparad
  vy kan visa en fasad eller sektion
- Tak: sadeltak eller pulpettak över en rektangel, eller Över hela huset.
  Väggar kapas av taket, och Upp till taket gör gavlar. Taket syns streckat i
  planen
- Modifiera: klicka på en markerad vägg (utan att dra). På referenslinjen:
  Lägg till punkt, Böj, Båge med tangent, Räta ut, Förskjut, Parallell kopia
  och, för flera väggar, Förskjut alla kanter. På en ände: Sträck och Förläng
  till. I ett hörn: Avrunda, Fasa och Ta bort punkt. Överallt: Flytta, Vrid,
  Spegla och Kopiera i rad. Värden skrivs in i paletten, med formler
- Bågväggar, med dörrar och fönster raka i bågen, i plan, 3D, fasad och
  sektion
- Sneda väggar som slutar mot en annan väggs liv kapas längs livet
- Fält, listor, kryssrutor och rullningslister har temats färger

Version 0.7.1, beta (samma filformat):
- Demo heter Beta. Knappen *Beta – Skicka synpunkter* i topraden, och
  *Skicka synpunkter* i huvudmenyn vid Om, öppnar ett formulär. Inga
  personuppgifter krävs; e-post bara om man vill ha svar. Skyddat mot spam
  med ett dolt fält, en tidsspärr och högst fem meddelanden i timmen. Där
  formuläret inte kan skickas (förhandsvisningen) öppnas ett mejl i stället.
  Se *Synpunkter* under Publicera nedan
- Snabbmenyn och Modifiera har samma utseende: ikon med kort text, och hela
  namnet med förklaring när man håller muspekaren över
- Visa-menyn: länk till Stilmall och ritningsgrafik, Öppningssätt, Taklutning
  i fasad och sektion, Tak, och Fasader, Sektioner och Norrpil var för sig
  (sparas per vy)
- Detaljnivå i fasader och sektioner: Skiss visar hålen, Normal karm, båge,
  dörrblad, handtag och foder, Detalj dessutom sammanfogningar, falsar och
  fönsterbänk. Sammanfogningarna är tunna och grå
- Linjetjocklek efter vad linjen är: hålens omfattning 0,35, karm, båge och
  dörrblad 0,25, foder och handtag 0,18, sammanfogningar och glas 0,13 i grått,
  marklinjen 0,7 (penntabellen kommer i 0.8)
- Glasmarkering med tre tunna, grå snedstreck mitt i glaset
- Öppningssätt för dörrar: streckade linjer med spetsen mot handtagssidan,
  över hela hålet i Skiss och över dörrbladet i Normal och Detalj. Slås av
  och på under Visa
- Taklutningen sätts ut av sig själv där takfallet syns i sin lutning:
  gradtalet i Skiss, vågrät linje, båge och gradtal i Normal och Detalj
- Sektioner ritas bara så långt som linjen går, och med sektionen öppen och
  3D bredvid (Båda) klipps 3D-modellen längs sektionen
- Fasadmarkören i planen: heldragen linje, liten fylld triangel i mitten och
  namnet (FASAD MOT SYD) litet och högerställt ovanför linjen, vridet efter
  den. Sektionsmarkören: öppna pilar, ingen streckprickad linje, skaft lika
  tjocka som ändarna och bokstaven ute vid linjens ände, vriden efter linjen
  men aldrig upp och ned
- Fasad- och sektionslinjer som placerats för hand har grepp i ändarna (med
  förlängning, längd och vinkel som vid väggar), Längd och Vinkel i
  egenskaperna och knappen Rikta efter objekt: klicka på en vägg eller linje,
  så blir fasaden parallell och sektionen vinkelrät mot den (Shift för det
  omvända)
- Streckade linjer (t.ex. väggar som rivs) börjar och slutar med ett helt
  streck i varje hörn, så att väggens två sidor ser likadana ut
- Varning för nästan raka vinklar: väggar, sektions- och fasadlinjer, fast
  inredning och taknockar som ligger inom 5° från 0°, 45° eller 90° utan att
  vara exakta (mer än en halv millimeter fel i änden) får ett utropstecken i
  planen och en rad i egenskaperna med knappen Räta upp. Gränsen ställs in
  under Gränssnitt; 0 stänger av
- Modifiera på takets kontur: lägg till, flytta och ta bort hörn, och
  förskjut en kant
- Avrunda och fasa stannar med ett besked om en dörr eller ett fönster
  skulle hamna utanför väggen
- Måttband (**L**): klicka punkter och se sträcka, total längd, vinkel och
  yta i verktygsraden, med knappar för att kopiera värdena. Fungerar även i
  fasader och sektioner
- Spårlinjer: snäpp mot väggars förlängningar och mot linjer i x- och y-led
  genom hörn nära markören, och där vinkellåset möter dem
- Kopiera och klistra in (**Ctrl+C**, **Ctrl+V**, **Ctrl+X**), även mellan
  projekt och flikar; typerna följer med. Inklistrat hamnar bredvid
  originalet om det finns kvar, annars på samma ställe. Ctrl + dra drar en
  kopia
- Piltangenterna knuffar det markerade 10 mm, med Shift 100 mm (ändras
  under Gränssnitt)
- Zooma till område (**Z**, dra upp en ruta) och förra zoomen (**Shift+Z**),
  också som knappar i statusraden

Version 0.8, del 1 av 3 (filformat 5; släpps som 0.8.0 när alla delar är klara):
- Filformat 5 för allt i 0.8. Projekt i format 4 öppnas och uppgraderas
  utan att något ändras
- 3D-vyn kan snurras under marken, för att se undersidor
- 2D/3D/Båda svävar nere i mitten av ritytan
- Projektträdet har en egen ikon, ett stående träd, och mappar med
  undermappar i alla flikar. Klicka på en vy, fasad, sektion, våning eller
  mapp i trädet så visas dess inställningar i egenskaperna, med Spara och
  Återställ sist; inget ändras förrän man sparar. Där väljs också mappen
- Vy-taggar på vyerna (golvplan, undertak, möblering, bygglov,
  bygghandling, 1:50, 1:100 och egna), och vyns skala på blad
- 2D (**I**): linje, polylinje, rektangel, båge (start, slut, punkt på
  bågen), cirkel, spline och fyllning (hel, skraffering, korsskraffering).
  Penna, linjetyp och färg; Klar, Enter, dubbelklick eller klick på första
  punkten avslutar
- Visas i för 2D-element, text och mått: alla vyer av ytan, bara den här
  vyn, utvalda vyer (även andra våningars) eller vyer med taggar (någon av
  eller alla), med "Syns nu i N vyer" och en varning vid 0. Visa dolda
  2D-element ritar det som inte syns tonat
- Mått, text och 2D ritas i fasader och sektioner, och snäpper mot linjerna
  där. Det som ritats i en fasad eller sektion går att flytta där
- Taklutningen är ett eget objekt: markera den i en fasad eller sektion så
  går den att flytta och ge en stil (båge och gradtal, bara gradtal eller
  lutningstriangel). Lutningen följer taket. Tas den bort kommer den inte
  tillbaka
- Nivåkoter för takfot och nock i fasader och sektioner
- Fasaderna följer byggnaden tills man flyttar dem; texten "placeras
  automatiskt" är borta. Följ byggnaden igen lägger tillbaka en fasad.
  **Lås** (med hänglås) på fasader, sektioner, norrpilen, 2D, text, mått och
  taklutningar hindrar att de flyttas eller tas bort av misstag
- Rikta efter objekt gör både fasader och sektioner parallella (Shift:
  vinkelrätt)
- Spara som vy föreslår namnet på det som visas, t.ex. Fasad mot syd
- Med en sektion öppen och 3D bredvid fylls snittet i 3D (väggar, bjälklag
  och tak mörka, annat grått). **Följ sektionen** nere till höger i 3D-vyn
  slår av och på klippningen
- Synpunktsformuläret visar vad servern svarar när det inte går att skicka,
  i stället för att tyst öppna e-posten

Version 0.8, del 2 av 3 (samma filformat, 5):
- **Grepp för taket i fasader och sektioner.** Markera taket så får nocken
  och takfötterna grepp. Dra nocken upp eller ned för att ändra lutningen
  (hela grader, Alt för fritt); takfoten ligger kvar. Dra takfoten upp
  eller ned för att höja eller sänka hela taket med samma lutning, eller
  med Shift för att låta nocken stå still och ändra lutningen. Dra den åt
  sidan, sett från gaveln, för att ändra taksprånget (lika på båda sidor
  av ett sadeltak); takfoten följer då takfallet nedåt
- **Grepp för 2D-elementens punkter.** Markerade linjer, polylinjer,
  splines, bågar, cirklar, rektanglar och fyllningar har grepp i varje
  punkt som kan dras, med snäpp och vinkellås (Shift). En rektangel förblir
  rät när ett hörn dras och det motstående hörnet står still. Cirkelns
  centrum flyttar hela cirkeln. Klick på en punkt eller kant ger Modifiera
  med Flytta punkt, Ta bort punkt, Lägg till punkt och Förskjut kant.
  Fungerar i planen, i fasader och sektioner och på arbetsblad. 2D-linjer
  går nu också att snäppa mot i planen
- **Underlag**: PDF (en vald sida), bilder (PNG, JPG) och DXF att rita
  över. Lägg in med *Lägg in underlag…* under fliken Underlag i
  projektträdet, med högerklick i ritningen, eller dra filen till ritytan.
  Underlaget hamnar där man är: på våningen, på ett arbetsblad eller i en
  fasad eller sektion, och ligger underst. Filen sparas i projektet
  (PDF:en som den är, och sidan ritas när den visas)
  - **Kalibrera skalan**: klicka två punkter med känt avstånd och skriv
    avståndet (formler och enheter går, t.ex. "12 m"). **Rikta**: klicka två
    punkter längs en linje som ska bli rak, så vrids underlaget till
    närmaste projektvinkel
  - Skala som 1:100 för PDF, enhet för DXF (läses ur filen), bredd i
    modellen och vridning i egenskaperna. **Synlighet** (tona) med ett
    reglage, gråskala för bilder och PDF
  - DXF: linjer, polylinjer med bågar, cirklar, bågar, ellipser, splines,
    text och block. Lagren går att tända och släcka, och man snäpper mot
    linjerna, ändpunkterna och skärningarna
  - Flytta, vrid och lås som andra objekt; Visas i som för 2D-element.
    Underlagen listas i fliken Underlag (i mappar), med Visa, Kalibrera,
    Rikta, Lås, Byt namn och Ta bort. Filen tas bort med den sista
    placeringen av den, och följer med när underlaget kopieras till ett
    annat projekt
- **Arbetsblad**: fria 2D-ritningar som inte hör till någon våning, till
  exempel detaljer och skisser. *Nytt arbetsblad* under fliken Modell. På
  ett arbetsblad finns 2D, text, mått och underlag; det man klistrar in
  hamnar på arbetsbladet. Arbetsblad har namn och mapp i egenskaperna,
  kan sparas som vyer och tas bort med allt som är ritat på dem (går att
  ångra)

Version 0.8, del 2.1 (samma filformat, 5):
- **Snabbare fasader, sektioner och 3D** i stora projekt. Väggarnas skarvar
  räknas nu bara mot väggarna intill, inte mot alla väggar. En fasad av 544
  väggar tar ungefär en halv sekund i stället för 6–10 sekunder; ritningen
  blir densamma
- Ett projekt från en äldre betaversion som inte längre kan uppgraderas
  får ett tydligt meddelande om det
- Planen är omgjord efter ett proof of concept: blad och plot, flera
  våningsplan och bjälklag, tak, trappor och IFC-export först, sedan ett
  pilotprojekt (se `docs/PLAN.md`)

Version 0.8, del 3 av 3, släpps som **0.8.0** (samma filformat, 5):
- **Ritningsblad** A4–A0, liggande eller stående, under fliken Ritningar i
  projektträdet (*Nytt ritningsblad*). Bladet har ritningsram (20 mm
  inbindningsmarginal till vänster, 10 mm i övrigt) och ritningshuvud enligt
  BH90, 180 mm brett: uppdragsnummer, ritningsnummer och ändring, skala,
  datum, ritat och granskat av, ritningens innehåll, skede, projektet med
  adress och fastighetsbeteckning, beställare, arkitekt med logga och
  ansvarig. Ritningsnumret blir nästa lediga efter det senaste bladet
  (A-101, A-102 … eller A-40.1-09, A-40.1-10 …)
- **Smarttext** i ritningshuvudets fält: `{projekt}`, `{adress}`,
  `{fastighet}`, `{beställare}`, `{uppdragsnummer}`, `{arkitekt}`,
  `{ansvarig}`, `{ritningsnummer}`, `{innehåll}`, `{skala}`, `{format}`,
  `{datum}`, `{skede}`, `{ändring}` och `{idag}`. Skalan fylls i av sig själv
  efter vyerna på bladet (1:100, eller 1:100, 1:50). Projektets fält gäller
  alla blad; loggan väljs i bladets inställningar
- **Vyer på bladet**: sparade vyer och modellvyerna av våningar, fasader,
  sektioner och arbetsblad, var och en i sin skala och med vyrubrik (namnet
  och SKALA 1:100 under vyn). En ny vy hamnar på första lediga plats. Dra
  en vy för att flytta den; den fäster mot de andra vyernas kanter och
  mittlinjer (Shift: bara vågrätt eller lodrätt). Klicka på en vy för att
  byta skala, rubrik eller vy (mitten står kvar), dubbelklicka för att
  öppna den, högerklicka för en meny, Delete tar bort den från bladet.
  Underlagen syns genom vyerna och klipps mot vyns ram, så att en stor
  grundkarta inte täcker bladet
- **Annoteringsskala**: texter, mått, rumsetiketter, littera, nivåkoter och
  taklutningar ritas för vyns skala, så att de får rätt höjd på papperet i
  alla skalor. Skalan väljs under Visa (*Skala för texter och mått*) och
  sparas i vyn
- **Plot/export…** i cad-apa-menyn och överst i projektträdet: kryssa i blad
  och vyer, grupperade efter mapparna i projektträdet (hela mappar eller
  enstaka). Varje blad blir en PDF i vektorform i rätt pappersformat med
  filnamn efter ritningsnumret; en vy blir en PDF precis så stor som vyn i
  sin skala. Allt sparas i en zipfil. Exporten visar hur långt den kommit
  och kan avbrytas. Bilder och PDF-underlag läggs in som bilder i PDF:en;
  texten skrivs med Helvetica. Ritningshuvudets texter kortas med … om de
  inte ryms

Version 0.8.1, granskning (samma filformat, 5):
- Inga nya funktioner. Programmet är städat och snabbare i stora projekt;
  ritningarna blir exakt desamma som förut
- **Flytta, kopiera, vrida, spegla och ta bort många objekt på en gång** går
  fort: kopiera och ta bort 684 väggar tar 0,03 s i stället för 1,3 s
- **Fasader** i stora projekt med många dörrar och fönster är 3–5 gånger
  snabbare: en fasad av 312 väggar tar ungefär 0,6 s i stället för 2,5 s.
  Kanter som ligger helt bakom en fasadvägg prövas inte längre mot allt annat
- **Planen och 3D-vyn** är ungefär dubbelt så snabba i stora projekt, och
  rums- och dörrnumreringen fyra gånger, eftersom väggskarvar, rum och dörrar
  bara prövas mot det som ligger intill
- Koden för appen och egenskapspanelen är uppdelad i mindre filer

## Versioner och gamla projekt

Projektfilerna har ett formatnummer. Projekt till och med format 5
uppgraderas automatiskt när de öppnas. Fram till pilotprojektet (0.13)
uppgraderas inte projekt från äldre betaversioner när formatet ändras, så
ett projekt öppnas i den version det gjordes med; därefter uppgraderas äldre
projekt alltid. Nyare projekt än programmet kan inte öppnas. Vill man kunna gå tillbaka kan varje version läggas i en egen mapp
på webbhotellet (t.ex. `cad-apa/0.5/`, `cad-apa/0.6/`) bredvid den senaste.

## Kom igång

Kräver Node.js 20 eller senare.

```sh
npm install
npm run dev        # startar en utvecklingsserver, öppna adressen som visas
npm test           # kör testerna
```

Hur man bygger vidare på programmet står i [docs/UTVECKLING.md](docs/UTVECKLING.md).

## Publicera på webbhotellet

Du behöver inga byggverktyg. Varje version finns färdigbyggd som en zip-fil.
Det enda som krävs är inloggningen till webbhotellet.

### Första gången

1. **Hämta zip-filen.** Gå till
   [Releases](https://github.com/agrellarkitektur/cad-apa/releases) (länken
   finns också i högerspalten på projektets GitHub-sida). Öppna den översta
   versionen och klicka på `cad-apa-v0.6.2.zip` under *Assets*. Numret är
   versionen; ta den senaste.
2. **Packa upp den på datorn.** I Windows: högerklicka på filen, välj
   *Extrahera alla…* och sedan *Extrahera*. På Mac: dubbelklicka. Du får en
   mapp som heter `cad-apa`. I den ligger bland annat `index.html` och en mapp
   som heter `assets`.
3. **Logga in på webbhotellet.** Öppna webbhotellets kontrollpanel och leta
   upp *Filhanteraren* (heter ibland *File Manager* eller *Filer*). Det går
   lika bra med ett FTP-program som FileZilla, med de FTP-uppgifter
   webbhotellet har gett dig.
4. **Gå till webbplatsens rotmapp.** Det är mappen där webbplatsens egna filer
   ligger, ofta kallad `public_html`, `httpdocs`, `www` eller domännamnet. Är
   webbplatsen gjord i WordPress är det mappen där `wp-config.php` och
   `wp-content` ligger.
5. **Ladda upp mappen `cad-apa`.** Hela mappen, så att den hamnar bredvid de
   andra filerna. Kan filhanteraren inte ladda upp mappar: ladda upp zip-filen
   i stället, markera den och välj *Packa upp* eller *Extract*, och ta sedan
   bort zip-filen.
6. **Prova.** Öppna `https://din-domän.se/cad-apa/` i webbläsaren. Programmet
   startar med exempelprojektet. I Chrome kan det installeras som app med
   ikonen i adressfältet, och det fungerar sedan även utan nät.

Kontrollera att det blev `cad-apa/index.html` på servern och inte
`cad-apa/cad-apa/index.html`. Har mappen hamnat ett steg för djupt: flytta
innehållet upp ett steg, eller ändra adressen därefter.

### Uppdatera till en ny version

1. Spara ditt projekt som fil (*Arkiv → Spara som fil…*). Programmet sparar
   också automatiskt i webbläsaren, men en fil är säkrast.
2. Vill du kunna gå tillbaka: döp om den gamla mappen på servern, till exempel
   till `cad-apa-0.6.1`. Den versionen finns då kvar på
   `https://din-domän.se/cad-apa-0.6.1/`. Annars: ta bort den gamla mappen
   `cad-apa`.
3. Hämta och ladda upp den nya zip-filen som i steg 1–5 ovan.
4. Den som har programmet öppet får en rad längst ned: *En ny version finns.*
   Tryck *Ladda om*.

Äldre versioner kan öppna sina egna projekt, men inte projekt som har sparats
i ett nyare format. Sedan 0.6.2 skriver en äldre version aldrig över ett
projekt som en nyare version har autosparat; statusraden visar då *Autospar
låst*, och det man gör i den äldre versionen sparas som fil.

### Synpunkter

Formuläret *Skicka synpunkter* skickar till skriptet `feedback.php` som
följer med i mappen `cad-apa`. Vart det skickas står inte i koden (den är
öppen), utan i en egen fil som bara finns på servern:

1. Skapa en textfil som heter `feedback-config.php` med innehållet

   ```php
   <?php return ['to' => 'ca@agrellarkitektur.se', 'from' => 'kontakt@agrellarkitektur.se'];
   ```

   `to` är den som får synpunkterna. `from` ska vara en adress som finns, på
   samma domän som webbplatsen; annars vägrar många webbhotell att skicka,
   eller så hamnar mejlen i skräpposten.
2. Ladda upp den **bredvid** mappen `cad-apa` (i samma mapp som `cad-apa`
   ligger i, t.ex. `public_html`). Där ligger den kvar när `cad-apa` byts ut
   vid en uppdatering. Det går också att lägga den i `cad-apa`, men då måste
   den flyttas med vid varje uppdatering.
3. Prova: öppna programmet, tryck *Beta – Skicka synpunkter*, skriv något och
   skicka. Titta i skräpposten om inget kommer fram. Går det inte att skicka
   visar formuläret (sedan 0.8) vad servern svarade:
   - *Synpunkter är inte uppsatta på den här servern*: `feedback-config.php`
     hittas inte. Den ska heta exakt så och ligga i mappen som `cad-apa`
     ligger i, eller i `cad-apa`.
   - *Servern kunde inte skicka e-post*: webbhotellet stoppar `mail()`,
     oftast för att `from` inte är en adress som finns på domänen.
   - *fel 500* utan förklaring: ett fel i PHP, ofta ett stavfel i
     `feedback-config.php`, eller en för gammal PHP (minst 7.4 behövs).

Skriptet använder webbhotellets vanliga `mail()`. Kräver webbhotellet SMTP
med inloggning för att skicka får skriptet byggas ut. Flyttar programmet
till en annan domän: flytta `feedback-config.php` med och byt `from` till en
adress på den nya domänen.

### Om något inte fungerar

- **Tom sida:** mappen ligger fel, se ovan. Ladda om med Ctrl+F5.
- **Går inte att installera som app:** webbplatsen måste ha `https://`.
  Webbhotellet skickar dessutom oftast `.webmanifest`-filer rätt, men gör det
  inte det kan en fil som heter `.htaccess` med raden
  `AddType application/manifest+json .webmanifest` läggas i mappen `cad-apa`.

### Göra en ny version (för den som utvecklar)

Höj versionen i `package.json` och `src/core/engine.ts`, skriv vad som är nytt
här i README och skicka upp ändringarna. Gå sedan till *Releases → Draft a new
release*, skriv en ny tagg som `v0.6.3`, och tryck *Publish release*. Efter
några minuter har GitHub byggt programmet, kört testerna och lagt
`cad-apa-v0.6.3.zip` på releasen (se `.github/workflows/release.yml`).

Vill man bygga själv: `npm install` och `npm run build`. Innehållet i `dist/`
är då detsamma som i zip-filens mapp `cad-apa`.

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
  formats/    läsare för andras filformat (DXF), utan beroenden
  sample/     exempelprojektet
  ui/         verktyg, egenskapspanel, stilmall, meny, statusrad, ikoner
  geometry/   vektorer, polygoner och booleska operationer
  styles/     CSS med ljust och mörkt tema
  fonts/      Archivo och IBM Plex Mono (SIL Open Font License)
tests/        tester för kärnan, planen och filformatet
docs/         arkitektur och byggordning, utvecklarguide
.github/      bygget som lägger en zip för webbhotellet på varje release
```

## Licens

Öppen källkod. Licens (MIT eller GPL) bestäms innan koden publiceras.
