# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning och hålls kort: historiken finns i git, Claudes val och det
som inte gjordes i PLAN.md, koden i UTVECKLING.md, och där också **Arbeta
i sandlådan** (bygga, Playwright, klickjämförelsen, mätningar) och
**Kända begränsningar**. Senast: 28 oktober 2026 (kväll), efter
0.10.24.

## Läget

- **0.10.24 Bågar i bjälklagets och markytans kontur är klar** på `main`
  (samma format, 21), byggd 28 oktober (kväll) på "kör". `bulges` på
  bjälklagets och markytans kontur som på håltagningen; konturerna
  ändras som 2D-former (Böj, Räta ut, Avrunda, Fasa, Förskjut, dragbara
  punkter), den gamla raka vägen i Modifiera (`roof*`, `roofId`,
  `hasEditableOutline`) är borttagen. *Båge* i bjälklagets polygon för
  konturen, markytan som *Polygon* med *Båge* och *Klar med konturen*.
  Spöet ger riktiga bågar i Bjälklag och Markyta; *Ur väggarna* urbockat
  ger bågar ur bågväggarna. Cirkelhål av två punkter dras nu ifrån (var
  en bugg). Testerna: 668 på ca 16 s. Provat i Playwright mot `dist/`
  (bjälklag som polygon med båge, smartmenyn på bågen och den raka
  kanten, Böj, dra ett hörn, 3D). Klickjämförelsen kördes **inte**; nya
  steg i granskningen. Se PLAN.md och UTVECKLING.md.
- **Märks i hans ritningar efter 0.10.24:** inget ritas annorlunda.
  Äldre bjälklag och markytor behåller sina korta raka bitar; nya ur
  spöet får bågar. Markytans verktygsrad har fått *Form*.
- **Tidigare i dag:** 0.10.23 Smartspöt del 2, 0.10.22 Snäpp och
  smartspöt och granskningen 0.10.22.1, 0.10.20.1 Litteran och 0.10.20.2
  Generell littera (format 21), 0.10.21 Lutande väggar och 0.10.21.1. Se
  PLAN.md.
- **Versionsnumret** är `0.10.24` i `engine.ts`, `package.json` och
  `package-lock.json`. En granskning höjer inte numret, eller får en
  fjärde siffra om något ändras som syns.
- **0.10.8–0.10.24 är inte provade fullt ut** av Carl August; han har
  svarat på frågor om flera av dem utifrån beskrivningarna (0.10.23
  provade han spöet mot en bågvägg, vilket gav 0.10.24).
- **Frågorna:** de obesvarade (nedan) ställs **högst tio per session**,
  de som hör till den kommande versionen först. Carl August vill ha **fem
  åt gången**. En fråga han hoppar över räknas som "bra som det är" och
  stryks. Han bad 27 oktober att resten väntar; ställ dem inte förrän han
  ber om det, utom de som hör till nästa version.
- **Publicering:** varje push till `main` laddas upp med
  `.github/workflows/publicera.yml` (FTPS; secrets `FTP_SERVER`,
  `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_DIR` =
  `/agrellarkitektur.se/public_html/cad-apa/`). Se efter med `gh run list`.
  Halvfärdigt arbete kan läggas på en egen gren, så att det inte
  publiceras.
- **Färdplan** (Carl August 22 oktober): 0.13 är hans egen provning (han
  ritar ett hus), sedan en inbjuden **alfa** för arkitektvänner, sedan en
  **öppen beta**. **Formatfrysen kommer med den öppna betan.** Inget av
  stegen är 1.0. Håll färdplanen nedan aktuell vid varje överlämning.
- **Ord:** *palett* och *snabbmeny* betyder samma sak för honom. Säg bara
  **smartmeny**. Symboler i ritningen heter **-markör**: *nivåmarkör*,
  *sektionsmarkör*, *fasadmarkör*. Säg inte nivåkota, sektionslinje eller
  fasadlinje. Vyn heter *Sektion* och *Fasad*. **Littera** skrivs med två
  siffror som förval (T01, M01). Spöet heter **smartspöt**.
- **Versionsnamn:** inga b-versioner; nästa lediga nummer i stället.
- **Bakåtkompatibilitet:** inga migreringar före formatfrysen. Höj
  `FORMAT_VERSION` när formatet ändras; äldre filer får ett meddelande
  (`parse` i `src/storage/format.ts`). Valfria nya parametrar har inte
  krävt ett nytt format.
- **Telefonen är inget mål.** Testa på dator (Chrome).
- **Arbetssätt:** Carl August testar varje version på webbhotellet. Ingen
  demo och ingen zip om han inte ber om det. Säg alltid hur stora
  föreslagna ändringar är och om de riskerar att behöva mer än en
  session.
- **Synpunkter:** Carl August samlar dem i `cad-apa-synpunkter.md`
  (projektets kunskapsbas), med rubrikerna Inkorg, Planerat per version,
  Parkerat och Avfärdat. Läs den vid sessionsstart (Projects-verktyget,
  `project_read`). Sortera Inkorgen tillsammans med honom, kort, med
  Claudes förslag per punkt (bokstäver, så att chatten inte numrerar om).
- **Svar med nummer:** chatten gör om "17. Ok / 20. 1100" till en
  numrerad lista som börjar på 17. Läs numren i texten han skickat, och be
  honom gärna skriva "17:".
- **Överlämningen hålls kort** (Carl August 28 oktober): skriv bara läget
  för de senaste versionerna; det som hör till koden går till
  UTVECKLING.md, Claudes val till PLAN.md.

## Färdplan

Kort; detaljerna står i PLAN.md och i `cad-apa-synpunkter.md`.

- ~~0.8.8 Mallblad~~ … ~~0.10.22 Snäpp och smartspöt~~, ~~Granskning
  efter 0.10.22 (0.10.22.1)~~, ~~0.10.23 Smartspöt del 2~~, ~~0.10.24
  Bågar i bjälklagets och markytans kontur~~ (klara)
- **Utredning: material i stället för fyllningar** (egen session, rör
  formatet; före fler fyllningsfunktioner och formatfrysen)
- **Ortofotot på marken** (liten undersökning med terrängappen, när det
  passar)
- **0.11 Trappor** (nytt format)
- **Granskning** efter ungefär tre versioner (efter 0.10.22.1)
- **0.11.1 Profilverktyget** (stor) och **0.11.2 Dörrar och fönster**
  (stor)
- **0.12 Export**: IFC4, DXF, areor för bygglov, förteckning över
  markförändringarna
- **0.12.1 3D-vyer** (sparade perspektiv och axonometrier, trädmodeller,
  trädens status i planen)
- **Situationsplanen som modellflik** (stor, ihop med SWEREF; före
  piloten)
- **0.13 Pilotprojektet**: Carl August ritar själv ett hus
- **Inbjuden alfa**, sedan **öppen beta och formatfrys**
- Efter piloten: se *Efter pilotprojektet* i PLAN.md. **1.0**
  bygglovshandling.

## Nästa session

Fråga Carl August vad som är nästa: Claudes förslag är **Utredning:
material i stället för fyllningar** (den rör formatet och ska avgöras före
fler fyllningsfunktioner), annars **0.11 Trappor**. Läs
`cad-apa-synpunkter.md` först och sortera Inkorgen om den har något.
Frågorna om 0.10.23 och 0.10.24 (nedan) kan ställas när han provat. Lägg
klicksteg för 0.10.23 och 0.10.24 i nästa granskning (som nu är efter
fyra versioner sedan 0.10.22.1: en granskning är nära).

## Att fråga Carl August om

Fem åt gången, högst tio per session, de som hör till nästa version först.
Hoppar han över en räknas den som bra och stryks. Claudes val står i varje
fråga.

**0.10.24 efter provning** (Claudes val, se PLAN.md)
- Äldre bjälklag och markytor behåller sina korta raka bitar. Behövs en
  knapp som gör om en sådan kontur till bågar (som *Ur väggarna* urbockat
  gör), eller räcker det att rita om med spöet?
- Markytans polygon sluts när man byter verktyg (som linjerna avslutas).
  Rätt, eller ska den kastas som bjälklagets?

**0.10.23 efter provning** (Claudes val, se PLAN.md)
- Takfallet med spöet täcker hela husets kontur, med takfoten vid kanten
  närmast och taket stigande inåt (ett pulpettak över huset). Rätt, eller
  ska spöet i *Takfall* ge ett takfall per sida?
- Pulpet, Sadel och Valm läggs över den omslutande rektangeln också när
  huset inte är rektangulärt. Räcker det?
- Måttkedjan tar båda liven på varje anslutande vägg, också i hörnen
  (väggtjockleken). Rätt, eller bara innerväggarna?
- Littera med Shift: var sin littera på varje objekt. Hellre en littera
  med en ledare till varje?

**0.10.20 efter provning** (Claudes val, se PLAN.md)
- Markhöjden räknar marken som oförändrad när ny och befintlig skiljer
  mindre än 5 cm (då bara den befintliga, understruken). Lagom gräns?
- Markobjektens höjder skrivs nu med två decimaler (nivåmarkörerna har
  kvar tre). Ska nivåmarkörerna också följa inställningen?
- Konturen runt slänterna är alltid på (0,13). Ska den vara ett val, eller
  få en egen penna i stilmallen?
- De branta slänterna är grå (muted) och följer fallinjen; strecken bryts
  där markobjekten ändrat marken. Rätt färg och gräns (1:3)?

**0.10.19 efter provning** (Claudes val, se PLAN.md)
- Övergångarnas förval är 20 m radie (en ramp 1:12 jämnas av över ca
  1,7 m, under Platsen). Lagom för en gångväg?
- I ändarna börjar och slutar rampen plant med ändens höjd, och den raka
  delen blir brantare (visas som lutningen). Hellre att lutningen hålls
  och höjden i änden blir en annan?
- Dockningen: ändar inom rampens bredd räknas som samma, skarven får den
  första rampens sluthöjd och den andra rampens starthöjd faller bort.
  Rätt?
- *Båge* i verktyget Mark fungerar som i takets kontur. Bra, eller
  räcker Böj i Modifiera?

**0.10.18.1 efter provning** (Claudes val, se PLAN.md)
- Stilmallens fönster i tre kolumner efter sorts inställning (åtgärder och
  texter, pennor, linjetyper och fyllningstyper). Menade du så, eller
  grupperat efter objekttyp (väggar, dörrar och fönster, mark …)?
- Höjdkurvornas färg gäller planen och bladen; 3D-vyns kurvor har sin
  egen. Ska de följa stilmallen också?

**0.10.18 efter provning** (Claudes val, se PLAN.md)
- Tvärfallet vrider kring referenslinjen, också när den ligger på en
  kant. Rätt, eller ska det vrida kring rampens mitt?
- En ritad sida ligger kvar när referenslinjen flyttas. Ska den hellre
  följa med när hela referenslinjen flyttas (men inte när en punkt dras)?
- *Kanterna* gäller alla kanter och nollställer sidorna; ändarna har inget
  eget val. Behövs *Början* och *Slutet* för sig?
- En sida som är stödmur är bara en tjock linje (ingen kropp i 3D, ingen
  höjd). Ska den bli en riktig stödmur med krön, som Stödmur-objektet?
- Förlängd ramp: lutningen fortsätter. Hellre plan (vilplan) eller
  höjden ur marken i den nya änden?

**0.10.17 efter provning** (Claudes val, se PLAN.md)
- Ett klick på änden av en omarkerad linje ritar vidare på den. Störande
  när man vill börja en ny linje där (Ctrl+klick)?
- Ett klick mitt på en kant startar det senast använda valet på en kant.
  Var det så du menade, eller ville du bli av med något sådant?
- *Kanter* i Förskjut: 1, 3, 5 eller Alla. Räcker det, eller behövs ett
  skrivet antal (och jämna antal)?
- Bågar direkt i takets kontur och håltagningen (*Båge*, G). Ska 2D-
  verktygets linje få samma (fråga 59)?
- Vrid och spegla hålet kring punkten man klickade på. Hellre kring hålets
  mitt?

**0.10.16 efter provning** (Claudes val, se PLAN.md)
- En låg stödmur (krönet under snitthöjden) ritas som kontur. Rätt på
  situationsplanen, eller ska murar alltid vara snittade?
- Ett fönster helt över eller under snittet ritas som hålets två kanter
  och glaset. Räcker det, eller ska karmen synas?
- En möbel som går genom snittet (t.ex. ett högskåp) ritas som förut, som
  symbol. Ska den ritas snittad?
- Den egna pennans del *Över snittet* följer objektets penna när den är
  tom. Rätt, eller ska den följa stilmallen?
- Dubbelklick på Visa tänder inte det som är släckt från början (husets
  kontur genom taket, linjerna i 3D). Rätt?

**0.10.15 efter provning** (Claudes val, se PLAN.md)
- Det dolda räknas med i väggarnas skarvar och rummen. Rätt, eller ska en
  dold vägg också försvinna ur rummens konturer?
- De dolda objekten tas fram alla på en gång. Behövs en lista att ta fram
  dem ett och ett?
- Greppet för *Tonat från* ligger en bit från mitten (romb), djupets i
  mitten (fyrkant). Lätt att hitta?
- Ska högerklick i 3D-vyn dölja bara i 3D, eller gälla vyn som nu?

**0.10.14 efter provning** (Claudes val, se PLAN.md)
- Förslagen (Gräs, Grus, Tegel …): rätt sorter och färger? Vilka saknas?
- Ska de sparade fyllningarna också gå att byta namn på och ta bort i
  stilmallens dialog (nu bara från panelen)?
- Slänternas fyllning täcker ytan som släntstrecken går över. Rätt yta,
  också där två markobjekt möts?
- Mönstret utgår från objektets första hörn. Behövs ett grepp för att
  flytta utgångspunkten?

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
46. Saknas något villkor i Filtrera och markera (riktning, längd, area)?
47. Förvalen snitt 0,25, vy 0,18, symbol 0,13 mm; *Vy* som egen del i den
    egna pennan?
48. Rum har ingen egen penna; pennan finns inte i smartmenyn.
49. DXF-underlagens streckade linjer streckade?
50. Förhandsvisning av linjetypen i listorna?
53. *Fortsätt* bortvalbar bland snabbknapparna? Nya kanter med verktygets
    penna?
54. Saknas någon markör bland pennorna? Streckning valbar?
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
