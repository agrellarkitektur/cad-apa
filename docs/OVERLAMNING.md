# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning; historiken finns i git (äldre versioners läge och frågor står
i tidigare versioner av den här filen, och Claudes val i PLAN.md).
Senast: 27 oktober 2026 (förmiddag), efter granskningen efter 0.10.12.

## Läget

- **Nästa session:** sortera Inkorgen med Carl August, sedan **0.10.13
  Höjder i förhållande till våningen** (se *Nästa session*).
- **Granskningen efter 0.10.12 är klar** på `main` (samma format, 20, och
  samma versionsnummer). Inga nya funktioner. Delat: `view3d.ts`
  (`edit3d.ts`, `geometry3d.ts`), `selectionFields.ts` (`markerFields.ts`,
  `annotationFields.ts`, `fieldMarkup.ts`), `propertiesPanel.ts`
  (`selectionActions.ts`), `section.ts` (`sectionLines.ts`) och
  `commands.ts` (`moveCommands.ts`); de gamla filerna exporterar vidare.
  Testerna: 524 (fyra dubbletter ihopslagna) på ca 14–18 s.
  Klickjämförelsen har 347 steg (54 nya för 0.10.11, 0.10.12 och 3D-vyn)
  och ger samma läge, ritning och 3D-bild före och efter granskningen;
  mot 0.10.10 skiljer bara det som 0.10.11 och 0.10.12 ändrade med avsikt
  (se PLAN.md).
  Detaljerna i PLAN.md och UTVECKLING.md under *Granskning efter 0.10.12*.
- **0.10.12 Småjusteringar är klar** på `main` (samma format, 20), byggd
  efter Carl Augusts svar 27 oktober. Byggt: låst betyder låst (också
  träd och grannhus; låset finns för alla objekt utom marken och kartan),
  delen *Markör* i egenskaperna, väggarnas *Fasa* 500, *Snäpp mot
  kalkeringen* som inställning, bjälklag bakom snittet streckade i
  sektioner, tak från våningen ovanför och alla under, stödmurens *Över
  marken mot* den högre eller lägre sidan. Koden i UTVECKLING.md under
  *Småjusteringar (0.10.12)*; Claudes val i PLAN.md.
- **Märks i hans ritningar efter 0.10.12:** låsta objekt (också
  importerade träd och grannhus) går inte att ta bort förrän de låsts upp;
  väggarnas *Fasa* börjar på 500; *Tak på andra våningar* visar inte
  längre tak två våningar upp; sektionerna visar bjälklag bakom snittet
  streckade (släcks under Visa).
- **Versionerna flyttades fram ett steg** (Carl August 27 oktober): inga
  b-versioner. Det som förut hette 0.10.12–0.10.15 heter nu
  0.10.13–0.10.16, också i PLAN.md.
- **0.10.11 Småsaker**, **0.10.10 Dolda linjer och vyns djup**, **0.10.9
  Stödmur del 2** och **0.10.8b Höjderna i fasaden** (nytt format, 20):
  se PLAN.md.
- **Versionsnumret** är `0.10.12` i `engine.ts` och `package.json`
  (granskningen fick inget eget); nästa version är `0.10.13`.
- **0.10.8–0.10.12 är inte provade fullt ut** av Carl August; han har
  svarat på frågor om 0.10.9–0.10.11 utifrån beskrivningarna.
- **Frågorna:** de obesvarade (nedan) ställs **högst tio per session**,
  de som hör till den kommande versionen först. Carl August vill ha **fem
  åt gången**. En fråga han hoppar över räknas som "bra som det är" och
  stryks. Han bad 27 oktober att resten väntar; ställ dem inte förrän han
  ber om det, utom de som hör till 0.10.13.
- **Släntmarkeringarna** (0.10.8) jämför den färdiga marken med den
  befintliga efter alla markobjekt; där två objekt möts kan strecken gå
  in över grannens yta om den också är ändrad men lutar som en slänt.
  Inte sett i `groundProject`, men inte prövat med branta grannar.
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
  **smartmeny**. Symboler i ritningen heter **-markör**: *nivåmarkör*,
  *sektionsmarkör*, *fasadmarkör*. Säg inte nivåkota, sektionslinje eller
  fasadlinje. Vyn heter *Sektion* och *Fasad* (markören är något annat än
  vyn; sedan 0.10.12 har den en egen del *Markör* i egenskaperna).
  **Littera** skrivs med två siffror som förval (T01, M01); antalet
  siffror blir en inställning.
- **Versionsnamn:** inga b-versioner; nästa lediga nummer i stället.
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
  `project_read`). Sortera Inkorgen tillsammans med honom (tio punkter från
  27 oktober väntar, om marken, fyllningar och opacitet).
- **Svar med nummer:** chatten gör om "17. Ok / 20. 1100" till en
  numrerad lista som börjar på 17. Läs numren i texten han skickat, och be
  honom gärna skriva "17:".

## Färdplan

Kort; detaljerna står i PLAN.md och i `cad-apa-synpunkter.md`. Uppdateras
vid varje överlämning.

- ~~0.8.8 Mallblad~~ … ~~0.10.11 Småsaker~~, ~~0.10.12
  Småjusteringar~~ (klara)
- ~~Granskning efter 0.10.12~~ (klar; nästa granskning om ungefär tre
  versioner)
- **0.10.13 Höjder i förhållande till våningen** (och takets
  referenslinje mot över- eller undersidan, stödmurens höjdpunkter med
  skriven höjd och dragning, flyttbara BH, NH och TH)
- **0.10.14 Visa och dölja** (med grepp för *Tonat från*) och **0.10.15
  Linjerna i 2D-formen** (förslag; bågar i takets kontur, cirkulära hål,
  hål som ändras för sig)
- **0.10.16 Markobjektens linjer** (stor: bågar, Avrunda, docka ramper)
- **Situationsplanens beteckningar** (förslag: murens ledare *M01 / MK*,
  markhöjder med status, sidolutning, låglinje; i eller efter 0.10.16)
- **0.11 Trappor** (nytt format)
- **0.11.1 Profilverktyget** (stor) och **0.11.2 Dörrar och fönster**
  (stor)
- **0.12 Export**: IFC4, DXF, areor för bygglov
- **0.12.1 3D-vyer** (sparade perspektiv och axonometrier, trädmodeller,
  trädens status i planen)
- **0.13 Pilotprojektet**: Carl August ritar själv ett hus
- **Inbjuden alfa**, sedan **öppen beta och formatfrys**
- Efter piloten: se *Efter pilotprojektet* i PLAN.md. **1.0**
  bygglovshandling.

## Nästa session

**Först Inkorgen** (tio punkter från 27 oktober, om marken, fyllningar och
opacitet; i `cad-apa-synpunkter.md`). Sortera dem tillsammans med Carl
August, kort, och flytta dem till versionerna. Claudes förslag att utgå
från:

- Schakt, fyllnad och netto för ett markobjekt: schakt och fyll står
  redan i egenskaperna (*Schakt … m³, fyll … m³*); nettot och andelen
  berg är små tillägg. Förteckningen med namn och volymer hör ihop med
  0.12 Export (areor och förteckningar).
- Opacitet på mask och fyllningar i markobjekten, och samma kontroller
  för alla objekt med fyllning (Solid, Mask, Mönster med förslag):
  mellanstor; en egen version efter 0.10.13 eller i 0.10.14.
- Kontur runt släntmarkeringarna, egen fyllning för slänterna,
  kryssrutor för markobjektens linjer och släntmarkeringarna i 3D:
  tillsammans med *Situationsplanens beteckningar*.
- Slänter och annan grafik som räknas fram ur den befintliga marken:
  också där, eller efter piloten.
- Ortofotot på marken (också den ändrade): en undersökning med repot och
  terrängappen, för sig.

Sedan **0.10.13 Höjder i förhållande till våningen** (mellanstor, en
session; se PLAN.md): en plus- eller minusnivå mot våningen för
bjälklag, väggar och objekt; takets referenslinje mot över- eller
undersidan; stödmurens höjdpunkter med höjden skriven direkt och dragna
längs muren; BH, NH och TH flyttbara i fasaden. Frågorna om 0.10.8b
(BH, NH och TH) hör dit och kan ställas först.

## Att fråga Carl August om

Fem åt gången, högst tio per session, de som hör till nästa version först.
Hoppar han över en räknas den som bra och stryks. Claudes val står i varje
fråga.

**0.10.12 efter provning** (Claudes val, se PLAN.md)
- Riv och *Finns i* fungerar på låsta objekt (de ändrar status, inte
  läget). Ska låset hindra dem också?
- Markörens penna i delen *Markör* är stilmallens och gäller alla
  sektions- (eller fasad-)markörer. Behövs en egen penna per markör?
- Bjälklag bakom snittet är på från början i sektionerna (släckta i
  fasaderna). Rätt?
- En våning som tas bort tar med sig sina låsta objekt (efter frågan).
  Rätt?

**Följdfrågor från 27 oktober**
- Trädens status (till 0.12.1): ska texten "Träd skyddas under
  byggtiden" stå i en förteckning, eller skriver man den själv?

**0.10.11 efter provning** (Claudes val, se PLAN.md)
- Våningens meny: Visa, Inställningar, Byt namn, Ny våning ovanför och
  under (den högerklickade våningen), Ta bort. Saknas något? Ska
  arbetsbladen få en meny också?
- Visa-menyn: inställningarna till vänster, kategorierna i två kolumner
  till höger. Bra ordning, eller detaljnivåerna överst över hela bredden?
- Hovring i 3D tonar objektet ljust i markeringsfärgen. Lagom tydligt?
- Markobjekten markeras med ett klick i marken, och konturen ritas på
  marken. Ska hörnen också gå att dra i 3D?

**0.10.8b efter provning** (Claudes val, se PLAN.md)
- Linjen *Beräkningsgrundande fasad* gäller fasaden inom 1,5 m och 15°.
  Den ritas som en egen tjock streckprickad linje med text och syns på
  papperet (den släcks under Visa). Rätt som förval?
- Förvalet: BH bara i fasaden som ser den beräkningsgrundande fasaden,
  NH och TH ingenstans. Rätt?
- Språnget räknas inte alls. Behövs ett val för att räkna det (som
  0.10.5)?

**0.10.8 efter provning** (Claudes val, se PLAN.md)
- Höjdkurvorna: hela meter 0,25 och halvmeter 0,13 heldragna; den gamla
  marken grå streckad. Lagom?
- Släntstrecken var 2,5 mm på papperet, korta 40 %, solfjäder i
  utåtgående hörn; jämförs med den färdiga marken efter alla objekt.
  Ser de rätt ut, också där två markobjekt möts?
- Fallpilen runt huset: en per fasad längre än 3 m. Lagom?
- ±0-klicket läser den befintliga marken (inte den färdiga). Rätt?

**Bjälklag och våningar (0.9–0.9.4)**
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
52. Fyllningens bakgrund i stilmallen? (Hör ihop med Inkorgens förslag om
    en gemensam mall för fyllningar, 27 oktober.)
53. *Fortsätt* bortvalbar bland snabbknapparna? Nya kanter med verktygets
    penna?
54. Saknas någon markör bland pennorna? Streckning valbar?
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

## Öppna frågor och kända begränsningar

- **Låst (0.10.12):** låset hindrar flytt, grepp och borttagning, men inte
  Riv, *Finns i* eller ändrade värden i egenskaperna. En våning som tas
  bort tar med sina låsta objekt.
- **Dolda linjer (0.10.10):** ytterväggarnas insida syns inte genom ett
  fönster (bara de skymda delarna ritas). De dolda linjerna tonas inte
  bortom *Tonat från* (de är redan tunna). Ett bjälklag under
  marken ritas streckat där marken skymmer det.
- **Stödmuren (0.10.9):** bitarna (högst 0,5 m) syns svagt som strimmor i
  3D-vyn; där en fasads djup slutar mitt i muren ritas ingen kant vid
  gränsen (`mark-fasad-2`); murens ändar möter inte marken med slänt.
- **Marken efter 0.10.6** (mätt men lämnat, mätt igen i granskningen
  efter 0.10.12): fasader och sektioner byggs om helt vid varje ändring i
  projektet, också av ett markobjekt (11–25 ms per vy i exempelvillan på
  den kuperade platsen när koden är varm, lika med och utan mark; nyckeln
  är hela projektet i `modelShapes`, och efter ett ändrat markobjekt är
  ingen av 3D-formerna samma objekt, så linjerna i `sectionLines` kan inte
  sparas förrän formerna för oförändrade objekt blir desamma). På en brant plats ändrar ett objekt stora
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
  rutan (en gräns som bara korsar den försvinner). Licenstexten kommer
  med på bladen bara där `{licens}` står i en text (0.10.8).
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
  (347 steg sedan granskningen efter 0.10.12: stilmallen med linjetyper,
  pennor och fyllningstyper, snabbraden, den egna pennan, rummets
  fyllning, 2D-formens fält med mask, bakgrund och fyllningstyp,
  ritordning, Visas i, underlag, detaljnivåerna, Filtrera och markera,
  våningar, bjälklag, kalkering, platsen och markobjekten, fasader,
  sektion och nivåer till och med `slut`; efter den våningens meny,
  Visa-menyn, snäpp mot kalkeringen, låst mot borttagning, delen
  *Markör*, *Över marken mot*, bjälklag bakom snittet och 3D-vyn med en
  bild per steg, `v3d`). Mot ett bygge äldre än 0.10.12 jämförs bara
  stegen till och med `slut`. 3D-stegen räknar ut skärmpunkten med
  `bacchus.view3d.project` och vyns läge (`at3d`), greppen med
  `bacchus.view3d.editor.handles()`, och höjden i marken med
  `bacchus.view3d.ground.height`.
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
