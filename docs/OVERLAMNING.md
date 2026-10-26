# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git (äldre versioners läge och frågor står
i tidigare versioner av den här filen, och Claudes val i PLAN.md).
Senast: 26 oktober 2026, efter 0.10.7.

## Läget

- **0.10.7 Markobjekt del 3 är klar** på `main` (format 19). Carl August
  ville ta marken före de dolda linjerna och sa "kör" efter upplägget i
  chatten. Rättat: markobjekt längs en linje (höjdpunkt, ramp, brytlinje,
  stödmur) flyttades inte (`movePatch` tog inte `line`); *Avrunda* och
  *Böj* finns inte för markobjektens linjer (`noArcs`). **Ramp/väg** är en
  sort (namn, bredd 1 500, egen gräns `maxSlope` med förval 1:12, vilplan
  när den är brantare än 1:20 och går mer än 0,5 m). **Markyta** är platå
  och urgrävning i ett (schakt och fyll i samma objekt; urgrävningen under
  bjälklaget tar fortfarande bara ned). Referenslinjen i mitten eller på en
  kant med förskjutning (negativ mot mitten), blå när vägen är markerad i
  planen och 3D. Tvärlinjerna kan slås av. Penna, linjetyp, fyllning och
  lås för markobjekten. Testerna: 504 på ca 12–14 s. Klickjämförelsen 293
  steg utan fel mot 0.10.7 (mot 0.10.6 går den inte: andra knappar).
  Provat med Playwright mot `dist/`. Claudes val i PLAN.md, koden i
  UTVECKLING.md under *Markobjekt del 3 (0.10.7)*.
- **Carl Augusts svar 26 oktober** (frågorna 1–16, se nedan) ligger i
  planen: 0.10.8 Marken i ritningarna, 0.10.9 Stödmur del 2, 0.10.10 Dolda
  linjer och vyns djup, 0.12.1 3D-vyer (före piloten). Inkorgen 26 oktober
  är sorterad och bekräftad (synpunktsfilen).
- **Frågorna:** de obesvarade (17–81 nedan) ställs **tio per session**,
  de som hör till den kommande versionen först. En fråga han hoppar över
  räknas som "bra som det är" och stryks.
- **0.10.6 Granskning** och äldre versioner står i README, PLAN.md och
  UTVECKLING.md. **0.9.2–0.10.7 är inte provade fullt ut** av Carl August.
- **Publicering:** varje push till `main` laddas upp med
  `.github/workflows/publicera.yml` (FTPS; secrets `FTP_SERVER`,
  `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_DIR` =
  `/agrellarkitektur.se/public_html/cad-apa/`). Se efter med `gh run list`.
  Halvfärdigt arbete kan läggas på en egen gren, så att det inte
  publiceras.
- **Prestandatestet** varierar med sandlådans hastighet.
- **Färdplan** (Carl August 22 oktober): 0.13 är hans egen provning (han
  ritar ett hus), sedan en inbjuden **alfa** för arkitektvänner, sedan en
  **öppen beta**. **Formatfrysen kommer med den öppna betan.** Inget av
  stegen är 1.0. Håll färdplanen nedan aktuell vid varje överlämning.
- **Ord:** *palett* och *snabbmeny* betyder samma sak för honom. Säg bara
  **smartmeny**.
- **Bakåtkompatibilitet:** inga migreringar före formatfrysen. Höj
  `FORMAT_VERSION` när formatet ändras; äldre filer får ett meddelande
  (`parse` i `src/storage/format.ts`). Valfria nya parametrar har inte
  krävt ett nytt format.
- **Telefonen är inget mål.** Testa på dator (Chrome).
- Arbetssätt: Carl August testar varje version på webbhotellet. Ingen demo
  och ingen zip om han inte ber om det. Säg alltid hur stora föreslagna
  ändringar är och om de riskerar att behöva mer än en session.
- **Synpunkter:** Carl August samlar dem i `cad-apa-synpunkter.md`
  (projektets kunskapsbas), med rubrikerna Inkorg, Planerat per version,
  Parkerat och Avfärdat. Läs den vid sessionsstart (Projects-verktyget,
  `project_read`). Sortera Inkorgen tillsammans med honom.

## Färdplan

Kort; detaljerna står i PLAN.md. Uppdateras vid varje överlämning.

- ~~0.8.8 Mallblad~~ … ~~0.10.6 Granskning~~, ~~0.10.7 Markobjekt del 3~~
  (klara)
- **0.10.8 Marken i ritningarna** (mellanstor)
- **0.10.9 Stödmur del 2** (mellanstor)
- **0.10.10 Dolda linjer och vyns djup** (mellanstor)
- **0.10.11 Småsaker** (högerklick på planer, Visa i kolumner, snäpp mot
  kalkering, hovring och markering i 3D, importerade objekt som
  befintligt eller förslag och att ta bort dem)
- **0.10.12 Höjder i förhållande till våningen**
- **0.10.13 Visa och dölja** och **0.10.14 Linjerna i 2D-formen**
  (förslag, inte bekräftade)
- **0.10.15 Markobjektens linjer** (stor: bågar, Avrunda, docka ramper)
- **0.11 Trappor** (nytt format)
- **0.11.1 Profilverktyget** (stor) och **0.11.2 Dörrar och fönster**
  (stor)
- **0.12 Export**: IFC4, DXF, areor för bygglov
- **0.12.1 3D-vyer** (sparade perspektiv och axonometrier, trädmodeller)
- **0.13 Pilotprojektet**: Carl August ritar själv ett hus
- **Inbjuden alfa**, sedan **öppen beta och formatfrys**
- Efter piloten: se *Efter pilotprojektet* i PLAN.md. **1.0**
  bygglovshandling.

## Nästa session

Fråga först om 0.10.7 syns på webbhotellet och hur Markyta, Ramp/väg,
referenslinjen, fyllningen och låset känns (frågorna om 0.10.7 nedan).
Ställ sedan tio av de obesvarade frågorna (först de som rör marken och
fasaderna). Sedan **0.10.8 Marken i ritningarna** (mellanstor): lägg
upplägget i chatten först (hur den oförändrade marken skiljs från den
ändrade, släntmarkeringarnas form, kryssrutan för BH per fasad, klicket
på topografin för ±0) och säg hur stort det är.

## Carl Augusts svar 26 oktober

- **Byggnadshöjd:** oftast mot den mest framträdande fasaden (mot gatan).
  Varje fasad får en kryssruta som visar dess BH. Språnget räknas oftast
  inte: från skärningen mellan fasadliv och takets överkant (0.10.8).
- **Ramp/väg**: en sort (gjort i 0.10.7). Gränsen 1:12 och 1:20 vanliga
  men lutningen kan vara vilken som helst.
- **Toningen** för höjdpunkt och brytlinje ska gå att ställa in (finns per
  objekt, *Tonas inom*, med förval under Platsen).
- **3D-vyer före piloten** (0.12.1).
- Rampens höjder ur marken och vilplan genom att dela rampen: bra.
- Urgrävningens kontur som botten: bra; **automatiska släntmarkeringar**
  (0.10.8). Platå och urgrävning som ett objekt (gjort i 0.10.7).
- Fallet 1:N med riktning: bra; **flera lutningspilar** när fallet
  varierar (0.10.8).
- Runt huset: rundade hörn och sockeln från våningen är ok.
- Jorden 600 mm, också under huset: prova; **vit fyllning** som val
  (0.10.8).
- Markverktyget med bara rektangel räcker så länge punkter kan läggas
  till och tas bort.
- **Medelmarknivån** ur den nya marken, med den befintliga att jämföra
  (0.10.8).
- **±0 med ett klick på topografin**, ändras efteråt (0.10.8).
- Origo i sydvästra hörnet är bra så länge.
- Grannhus i fasader: oftast inte; **vyns djup** med tonad zon i fasader
  och sektioner (0.10.10).
- 0,5 m kurvor räcker; **halvmeterskurvorna tunnare** (0.10.8).
- **Licenstexten** som `{licens}` (0.10.8).

## Att fråga Carl August om

Tio per session, de som hör till nästa version först. Hoppar han över en
räknas den som bra och stryks. Claudes val står i varje fråga.

**0.10.7 efter provning** (Claudes val, se PLAN.md)
- Referenslinjen syns bara när vägen är markerad (som takets); ska den
  kunna ritas på papperet?
- Vägens förskjutning i mitten är positiv åt vänster; på en kant positiv
  utåt. Begripligt?
- Pennan gäller linjerna men inte texterna; fyllningen ligger bakom
  väggarna. Ska markobjektens fyllning kunna ligga framför?
- En gångväg varnade förut brantare än 1:20; nu gäller vägens egen
  gräns (förval 1:12, ändras per väg eller under Platsen). Ok?

**Tak (0.10–0.10.2)**
17. Takfoten är kanterna som vetter nedåt och snittas vinkelrätt från
    början; vinkeln räknas mot det vågräta (90 = lodrätt).
18. En kants eget snitt glöms när kanten ändras.
19. Språnget räknas från ytterväggarnas utsida på alla våningar: hur blir
    det för ett hus med en lägre tillbyggnad?
20. Snitthöjden 1200 från början: vilken använder han?
21. Ett tak på plan 2 streckat i planen under, som vyinställning?
22. Snittytan i planen med stilmallens snittfyllning: ska den vara egen?
23. Husets kontur också utan tak (en situationsplan)?
24. Ska *Upp till taket* gå före ett bjälklag som täcker väggen?
25. Linjen mellan våningarna är kvar mellan befintligt och nytt: ok?
26. Taket stiger åt vänster om referenslinjen (*Vänd lutningen* byter);
    höjden gäller undersidan; positiv radie stiger mot centrum.
27. Snabbvalen: nocken längs den längre sidan, pulpettakets takfot på
    första hörnets långsida, *Över hela huset* bara för rektangulära hus.
28. Takets referenslinje i planen också omarkerad, med lutningspil?
29. Takets kontur med bågar direkt i verktyget?
30. Shift för att låta nocken stå still i fasaden finns inte: saknas den?

**Bjälklag och våningar (0.9–0.9.4)**
31. Hålen hör till bjälklaget; de vrids och speglas inte var för sig.
32. Förvalen 500 mm för Avrunda och 300 mm för Fasa.
33. Med klickbar bjälklagsyta går ett klick i ett rum till bjälklaget:
    ska rummet gå före?
34. Håltagningen som cirkel direkt?
35. Fri höjd som text i rummet (*RH 2400*) i stället för måttkedja?
36. Våningens namn vid FG?
37. Bjälklagets kontur tunn under väggarna, klickbar vid kanten; förval
    300.
38. En ny våning ovanför flyttar dem där; ändrad våningshöjd flyttar
    våningarna ovanför.
39. Namnen Plan 2 … och Källarplan.
40. En borttagen våning tar bort sina vyer från bladen.
41. Flytta och Kopiera till våning i högerklicksmenyn, inte i smartmenyn.
42. *Bara den här våningen* gäller för honom, inte per vy.

**Pennor, linjer och fyllningar (0.8.22–0.8.37)**
43. Vyradens knappar sätter alla tre detaljnivåer; fasaderna följer
    3D-nivån; rumsstämpeln ingen nivå.
44. Ser de inbyggda fyllningarna rätt ut? Räcker guiden?
45. Fungerar hans `.pat`-filer? Mönster med mer än 20 mm mellan linjerna
    antas vara i verkliga mått.
46. Saknas något villkor i Filtrera och markera (riktning, längd, area)?
47. Förvalen snitt 0,25, vy 0,18, symbol 0,13 mm; *Vy* som egen del i den
    egna pennan?
48. Rum har ingen egen penna; pennan finns inte i smartmenyn.
49. DXF-underlagens streckade linjer streckade?
50. Förhandsvisning av linjetypen i listorna?
51. Masken döljer också rutnätet på skärmen.
52. Fyllningens bakgrund i stilmallen?
53. *Fortsätt* bortvalbar bland snabbknapparna? Nya kanter med verktygets
    penna?
54. Saknas någon markör bland pennorna? Streckning valbar?
55. Ritordningen bakom eller framför väggarna också i fasader och
    sektioner?
56. Rummets fyllning för flera rum på en gång, per rumstyp eller i
    stilmallen?
57. En rektangel förblir inte rät när ett hörn dras; cirkeln saknar
    centrumgrepp.
58. Smartmenyn alltid *Ändar* för en markerad linje?
59. Bågar direkt i Linje (A som i PLINE)?
60. Rumsstämpelns ordning gäller hela projektet; *Fyllningar* under Visa
    gäller vyn.

**Kommandoraden, ritande och underlag (0.8.13–0.8.21)**
61. *Avbryt* bland alternativen? Skala och måttbandet med skrivna
    punkter?
62. Kommandon direkt utan Enter (kortkommandon med en bokstav
    försvinner)? Fungerar `@` med AltGr?
63. Rutnätet lagom tydligt? Segmentpunkterna per vy; Rensa rensar alla.
64. Typsnitt per projekt?
65. Autosparen kommer ihåg filen mellan sidladdningar (Chrome frågar)?
66. Rumsstämpelns pil mot närmaste kant eller rummets mitt?
67. X och Y nedre vänstra hörnet också för DXF, inte filens nollpunkt.
68. Gruppen för en fil på flera ställen utfälld från början?
69. Tjocklekstabell för linjer i stilmallen?
70. Trimma avslutas efter ett klick: fortsätta tills Esc som i AutoCAD?

**Blad och mallar (0.8.7–0.8.12)**
71. Bilder under vyerna, linjer och text över; inga mått på bladet;
    bladet följer inte tillstånden.
72. Arbetsbladen oberoende av tillstånden?
73. Textrutor: dra upp rutan med textverktyget, se kanten markerad?
74. Fält utan värde blir tomma på papperet.
75. Mallen från papperets nedre vänstra hörn på andra format.
76. Stämmer platshållarna i hans ram som blev smarttext?
77. Skalstocken 230 mm från högerkanten och 40 mm upp; i 1:50 är strecket
    vid 10 mm kort och tunt: avsiktligt?
78. Dölja hela vyrubriken, inte bara skalan?

**Övrigt**
79. Kommer synpunktsformulärets brev fram till Gmail nu (efter `-f`)?
    Annars Gmail-adressen direkt som `to` i `feedback-config.php`.
80. Smartmenyns placering; ska rubriken *Ändra* heta något annat?
81. Har felet med polylinjer som bara markeras vid kanten kommit tillbaka?

## Öppna frågor och kända begränsningar

- **Marken efter 0.10.6** (mätt men lämnat): fasader och sektioner byggs
  om helt vid varje ändring i projektet, också av ett markobjekt (ca
  20–60 ms per vy i exempelvillan, lika med och utan mark; nyckeln är hela
  projektet i `modelShapes`). På en brant plats ändrar ett objekt stora
  ytor (40 000 noder för urgrävningen under plattan på 0,5 m) och varje
  ändrad nod kostar 1–3 µs i `probe` (närmaste kant); den färdiga markens
  höjdkurvor räknas för hela området som alla markobjekt ändrat (ca
  70–100 ms på en brant plats). 3D-vyn i Chromium utan grafikkort ritar
  en stor mark på ca 1 s; inte mätt på en riktig dator.
- **Marken (0.10.3):** höjdkurvorna för ett stort, brusigt rutnät (1,2
  miljoner noder, 0,5 m) tar ca 2 s första gången (sedan sparade);
  `contours` har en `Map` per nivå som går att byta mot typade listor om
  det behövs. Platsens objekt läggs på våningen närmast ±0 och syns inte i
  de andra planerna. Beskärningen tar bort kartobjekt utan någon punkt i
  rutan (en gräns som bara korsar den försvinner). Licenstexten skrivs
  inte ut på bladen.
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
- Konens bitar syns svagt i 3D-vyns skuggning (64 bitar per varv, plan
  skuggning).
- Två takfall som möts ritar samma linje två gånger i fasaden (nocken och
  takfoten bakom), utan att det syns.
- Takfotens snitt (0.10.2): där två snittade kanter möts i ett konvext
  hörn av samma takfall tar den första kantens snitt hörnet (ingen
  gering). En kon snittas bit för bit; en boolesk operation som inte går
  att räkna ger lodrätt snitt för den biten.
- Spegla vänder inte bilden i ett underlag, bara läget.
- DXF: skraffering med solid fyllning ritas som en ton (färgerna i DXF läses inte). Bilder och externa
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
  (293 steg sedan 0.10.7: stilmallen med linjetyper, pennor och
  fyllningstyper, snabbraden, den egna pennan, rummets fyllning,
  2D-formens fält med mask, bakgrund och fyllningstyp, ritordning, Visas
  i, underlag, detaljnivåerna, Filtrera och markera, våningar, bjälklag,
  kalkering, platsen och markobjekten, fasader, sektion och nivåer).
  Platsen släpps på planen som en fil (`PLATS`, samma mark som
  `groundProject`), och dialogen väljs med `pg.click` (flera `.dialog`
  finns i sidan; dialogen *Platsen* har klassen `site-dialog`). Väggarna
  är vridna när marken prövas, så plattan ur väggarna har ingen kontur:
  urgrävningen läggs under ett ritat bjälklag. Den fasta följden i
  `crypto.getRandomValues` tar de höga bitarna sedan 0.10.6 (med de låga
  upprepades id efter några hundra). Kommandon skrivs i smartshell
  (`#ss-input`, Enter), och en meny (som *Kopiera till våning*) väljs i
  `.ctx-menu`. Kör den mot två byggen på var sin port och sedan med
  `--jamfor`; lägg till steg för det som granskas. Med `--bilder` sparas
  en bild av ritytan efter varje steg, och när markupen skiljer sig
  jämförs bilderna (så gjordes 0.8.38, där skrafferingen ritas med ny
  kod). Inget steg felar sedan 0.9.3; kör den gamla versionen två gånger
  mot sig själv om något skiljer, så syns det som inte är bestämt. En
  rad om att en bild är inlagd kan skilja i steget efter att Visa
  öppnats (meddelandet tonas ut olika fort).
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
  i `core.test.ts`. Ett hus med två våningar och fasta id är
  `twoStoreys` (0.9.3). Se *Tester* i UTVECKLING.md.
- Demon bara på begäran: `npm run preview:artifact`, läs artefakten
  (https://claude.ai/artifact/2m7gq5gkkgSP2wFZ7fLGNJ, Artifact `read`) och
  publicera `artifact/cad-apa.html` till samma URL.
- Stoppa servern med `ps -eo pid,args | grep "[p]ython3 -m http.server"`
  och `kill <pid>`, inte `pkill -f` eller `pgrep -f` i samma kommando (de
  träffar också skalet, som stängs).
- Testfiler att lägga in går snabbt att göra med reportlab (PDF), PIL
  (bild) och några rader text (DXF). Riktiga DXF med skraffering, block och
  bågar gör ezdxf (`pip install --break-system-packages ezdxf`), som också
  ger facit för konturerna (`ezdxf.path.from_hatch_boundary_path`) och
  mönstrens streck (`ezdxf.render.hatching.hatch_entity(h,
  jiggle_origin=False)`; utan det flyttas mönstret slumpvis några mm).
- Mäta hur fort Chrome målar en SVG (0.8.38): lägg markupen i en tom
  sida med `set_content`, sätt `innerHTML` och vänta två
  `requestAnimationFrame`; jämför varianter (utan fyllning, ett mönster,
  …). Bilderna jämförs med PIL (`ImageChops.difference`, pixlar som
  skiljer mer än 64).
- Mäta i webbläsaren: hela bildrutan, från `page.mouse.move` till två
  `requestAnimationFrame`, jämfört med ett tomt varv; att bara mäta
  JavaScript missar webbläsarens målning, som var det dyra vid panorering.
- En profil (`node --cpu-prof`) sammanfattas snabbast med några rader
  Python som summerar `timeDeltas` per `callFrame` i `.cpuprofile`, och
  inklusive tid genom att gå upp till föräldrarna (så mättes 0.10.1).
  Polygon-clippings egna funktioner heter `split`, `compare` och `run`.
- **Marken utan webbläsare** (0.10.6): ett skript som importerar
  `tests/projekt.ts` (`groundProject`, `slopeSite`, `planCtx`) och byter
  platsen mot ett större rutnät med `applySitePackage` (t.ex. 200 × 150 m
  med 0,5 m och en brant sluttning), buntat med rolldown; mät
  `finishedTerrain(planCtx(store))` och `buildPlan` efter `updateParams`.
  Jämför med en färsk `finishedGround` utan `prev` för att se att svaret
  är detsamma.
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
