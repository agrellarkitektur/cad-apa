# Överlämning

Läget när en session slutar, så att nästa kan ta vid. Skrivs om vid varje
överlämning och hålls kort: historiken finns i git, Claudes val och det
som inte gjordes i PLAN.md (klara versioner i `docs/arkiv/`), koden i
UTVECKLING.md (äldre i `docs/arkiv/`), och där också **Arbeta
i sandlådan** (bygga, Playwright, klickjämförelsen, mätningar) och
**Kända begränsningar**. Vad varje version märks i ritningarna står i
README. Senast: 31 oktober 2026, efter granskningen efter 0.11.5.

## Läget

- **Granskningen efter 0.11.5 är klar** (31 oktober; samma version 0.11.5,
  inget som syns). Klickjämförelsen körd med 51 nya steg för trappor och
  räcken (633 steg; inga fel i de nya, dokument och ritning lika mot
  0.10.40.1 i de gamla), räckets filer delade (`railingBody.ts`,
  `railingPlan.ts`, `railingWarnings.ts`, `railingTypeFields.ts`),
  dubbletter ihopslagna, testerna genomgångna (843 på ca 25 s). Det som
  inte gjordes står i PLAN.md (*Granskning efter 0.11.5*).
- **0.11.5 Spiraltrappan är klar** (samma format, 26), byggd i en session
  (Carl August: "kör"). *Spiral* i trappverktyget: inner- och
  ytterdiameter, grader (också över 360) och varvriktning, två klick (mitt
  och startriktning). Referenslinjen genereras som en båge; `line` är
  mitten och startpunkten. Mittpelaren, planen som döljer det som ligger
  mer än ett varv under, det sista varvet i våningen ovanför, runt hål.
  Testerna: 843 på ca 14 s. Provat i Playwright mot `dist/` (verktyget,
  förhandsvisningen, 450° i plan Normal och Detalj, 3D, panelen). Koden i
  UTVECKLING.md (*Spiraltrappan*), Claudes val i PLAN.md.
- **0.11.4 Byggd trappa är klar** (samma format, 26), byggd i en session
  (Carl August: "kör"; ingen utredning eller mockup före, så Claudes val
  står i PLAN.md och frågorna nedan). *Uppbyggnad: Byggd* ger vangstycken,
  plansteg med stegnos och sättsteg (0 = öppen trappa) med egna mått och
  material; kontrastmarkering (också monolitisk); vangstyckenas insida i
  planen i Normal och Detalj; stegnos, kontrast, stegnummer och *N st à
  h/d* i Detalj. Testerna: 837 på ca 11 s. Provat i Playwright mot
  `dist/` (L-trappa med plansteg och en öppen rak trappa i plan Detalj och
  3D, panelen). Koden i UTVECKLING.md (*Byggd trappa*).
- **0.11.3 Staket och grindar är klar** (samma format, 26), byggd i en
  session med grindarna (ingen delning behövdes). Räcket på Platsen med
  höjden ur den färdiga marken, *Trappstegat*, stolpar nedgrävda och i
  plint, *Längs kant* för hål, bjälklag, väggar, ramper, linjer och
  stödmurens krön (Shift: hela konturen), ST01–ST03, SP01 och G01 som
  förval på Platsen, *Hör till* och *Höjden från* i panelen, grinden
  (*Gör till grind…* i smartmenyn, grindstolpar, typ, hängning,
  utåt/inåt, slagbåge, littera). Räckestypeditorn omgjord efter tavla 4
  (Carl August bad om det i sessionen; han bifogade tavlorna som PDF).
  Testerna: 831 på ca 14 s. Provat i Playwright mot `dist/` (staket på en
  sned plats i plan och 3D, trappstegat, grinden i plan, smartmenyn,
  panelen, editorn i fyra lägen). Koden i UTVECKLING.md, Claudes val och
  det som inte gjordes i PLAN.md.
- **0.11.2 Räckestypeditorn** (samma format): typlistan i grupper,
  förhandsvisningen, delträdet; Shift-låset går före snäppet.
- **0.11.1 Räcket** (samma format): objektet `Railing` med typmodellen,
  verktyget *Räcke*, trappans smartmeny, plan, sektion, fasad, 3D och
  varningarna ur BFS 2024:9.
- **Höjdkurvors del av 0.10.31** (ortofotot i platspaketet) återstår; den
  görs i en Höjdkurvor-session (fälten i `docs/arkiv/PLAN-0.10.md`).
- **Publicerad:** granskningen pushad till `main` 31 oktober efter 0.11.5 (se git och
  `gh run list`). `add_repo` med push går direkt när Carl August skriver
  "push godkänd" i första meddelandet.
- **Märks i hans ritningar efter 0.11.5:** inget i befintliga ritningar.
  *Spiral* i trappverktygets rad.
- **Märks i hans ritningar efter 0.11.4:** inget i befintliga ritningar
  utom att trappans plan i Detalj nu har stegens nummer och texten med
  antal, steghöjd och stegdjup. *Byggd* går att välja under *Uppbyggnad*.
- **Märks i hans ritningar efter 0.11.3:** inget i befintliga ritningar,
  utom att stolparna i ST-typerna och grindstolparna syns redan i Normal.
  Verktyget *Räcke* fungerar på Platsen; editorn ser annorlunda ut.
- **Märks i hans ritningar efter 0.11.2:** inget i ritningarna. *Räckestyper*
  under Resurser i stilboken; med Shift ritar linjen i låset också nära
  en punkt.
- **Märks i hans ritningar efter 0.11.1:** inget i befintliga ritningar,
  utom att trappans varningar har nya texter och att en trappa utan
  räcken varnar för ledstång på båda sidor (kvittera i trappans
  egenskaper). Verktyget *Räcke* under Rita, gruppen *Räcken* i stilboken.
- **Märks i hans ritningar efter 0.11:** projekt och autospar från
  0.10.32–0.10.40.1 öppnas inte (nytt format). Verktyget *Trappa* under
  Rita, och i stilboken grupperna *Trappor* och *Från annan våning*. I
  egenskaperna för bjälklag, markobjekt och trappor finns *Syns också på*.
- **Versionsnumret** är `0.11.5` i `engine.ts`, `package.json` och
  `package-lock.json`. En granskning höjer inte numret, eller får en
  fjärde siffra om något ändras som syns.
- **0.10.8–0.11.5 är inte provade fullt ut** av Carl August; han har
  svarat på frågor om flera av dem utifrån beskrivningarna.
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
  publiceras. Skrivrätten till repot kan behöva godkännas i sessionen.
- **Färdplan** (Carl August 22 oktober): 0.13 är hans egen provning (han
  ritar ett hus), sedan en inbjuden **alfa** för arkitektvänner, sedan en
  **öppen beta**. **Formatfrysen kommer med den öppna betan.** Inget av
  stegen är 1.0. Håll färdplanen nedan aktuell vid varje överlämning.
- **Ord:** *palett* och *snabbmeny* betyder samma sak för honom. Säg bara
  **smartmeny**. Symboler i ritningen heter **-markör**: *nivåmarkör*,
  *sektionsmarkör*, *fasadmarkör*. Säg inte nivåkota, sektionslinje eller
  fasadlinje. Vyn heter *Sektion* och *Fasad*. **Littera** skrivs med två
  siffror som förval (T01, M01, RÄ01). Spöet heter **smartspöt**. Fliken
  för situationsplanen heter **Platsen**; inga engelska ord i appen.
  Stilinställningarnas helhet heter **stilboken**; en rad i en vykategori
  där en objekttyp och del får sin penna heter ett **ställe**. Trappans
  delar heter **plansteg**, **sättsteg**, **vangstycke**, **vilplan**,
  **kilsteg**, **stegnos**, **gånglinje**. Räckets: objektet heter
  **Räcke** (också staket, stängsel, spaljé), typen **räckestyp**, delarna
  **stolpe**, **handledare**, **ledstång**, **liggare**, **spjälor**,
  **fyllning**; en sträcka kan bli en **grind**. Vid kilstegen är
  handledaren **Utjämnad** eller **Hoppande**.
- **Varningar** (Carl August 30 oktober): hänvisa till BFS 2024:9 (Boverkets
  nya regler; BBR gäller inte längre för nya ansökningar) där det är
  föreskrift. Det som är vedertaget men inte står i föreskriften
  (räckeshöjder, stegdjup, stegformeln, bredd …) får texten *avviker från
  praxis*. Gäller alla varningar i appen (gjort i 0.11.1).
- **Versionsnamn:** inga b-versioner; nästa lediga nummer i stället.
- **Bakåtkompatibilitet:** inga migreringar före formatfrysen. Höj
  `FORMAT_VERSION` när formatet ändras; äldre filer får ett meddelande
  (`parse` i `src/storage/format.ts`). Valfria nya parametrar och fält
  har inte krävt ett nytt format (räcket i 0.11.1 inte heller).
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
  Han bifogar gärna skärmbilder; be om en när en synpunkt gäller något
  som syns.
- **Läs projektfilen på nytt strax före varje skrivning** (Carl August
  28 oktober). Flera chattar kan arbeta mot `cad-apa-synpunkter.md` och
  överlämningen samma dag, och `project_write` ersätter hela filen: skriv
  aldrig från en kopia som lästes tidigare i sessionen. Gör
  `project_read`, för in ändringen i det som kom tillbaka och skriv
  direkt. `project_write` med `local_path` kräver en fil i
  arbetskatalogen (t.ex. `.proj/` i repot, undantagen i
  `.git/info/exclude`).
- **Svar med nummer:** chatten gör om "17. Ok / 20. 1100" till en
  numrerad lista som börjar på 17. Läs numren i texten han skickat, och be
  honom gärna skriva "17:". Bokstäver med kolon ("A: ok") fungerar.
- **Överlämningen hålls kort** (Carl August 28 oktober): skriv bara läget
  för de senaste versionerna; det som hör till koden går till
  UTVECKLING.md, Claudes val till PLAN.md.

## Färdplan

Kort; detaljerna står i PLAN.md och i `cad-apa-synpunkter.md`.

- ~~0.8.8 Mallblad~~ … ~~0.10.40.1 Granskning efter 0.10.40~~,
  ~~0.11 Trappan~~, ~~Utredning av räcket~~, ~~0.11.1 Räcket~~, ~~0.11.2 Räckestypeditorn~~, ~~0.11.3 Staket och grindar~~, ~~0.11.4 Byggd trappa~~, ~~0.11.5 Spiraltrappan~~, ~~Granskning efter 0.11.5~~ (klara; se
  tabellen *Klart* i PLAN.md)
- **Höjdkurvor: ortofotot med i platspaketet** (liten; i Höjdkurvors repo
  och session)
- **0.11.6 Profilverktyget** (stor) och **0.11.7 Dörrar och fönster**
  (stor)
- **Granskning efter 0.11.7**: stilmallsstegen i klickjämförelsen
  omskrivna mot stilboken, `stairGeometry.ts` och `view3d.ts` delade
- **0.12 Export**: IFC4, DXF, areor för bygglov, förteckning över
  markförändringarna
- **0.12.1 3D-vyer** (sparade perspektiv och axonometrier, trädmodeller,
  trädens status i planen)
- **Koordinater, SWEREF och sol** (stor; före piloten; SWEREF på
  situationsplanen och i exporten därifrån)
- **0.13 Pilotprojektet**: Carl August ritar själv ett hus
- **Inbjuden alfa**, sedan **öppen beta och formatfrys**
- Efter piloten: se *Efter pilotprojektet* i PLAN.md. **1.0**
  bygglovshandling.

## Nästa session

Läs synpunkterna först och sortera Inkorgen om den har något. Be om
skrivrätt till repot ("push godkänd"). Nästa version är **0.11.6
Profilverktyget** (stor, nytt format; se PLAN.md): diskutera omfattningen
med Carl August innan bygget, och föreslå en delning om den inte ryms i
en session. Ställ frågorna om 0.11.5–0.11.1 (nedan) när Carl August
provat.

## Att fråga Carl August om

Fem åt gången, högst tio per session, de som hör till nästa version först.
Hoppar han över en räknas den som bra och stryks. Claudes val står i varje
fråga. Frågorna om 0.10.28.2 och 0.10.28.1 när han provat materialen; de
om 0.10.27–0.10.23 likaså. Nästa omgång börjar med 0.11.5, 0.11.4, 0.11.3,
0.11.2, 0.11.1 och 0.11, sedan 0.10.35, 0.10.34 och 0.10.33 när han provat.

**0.11.5 efter provning** (Claudes val, se PLAN.md)
- Förvalen 200/1 800 mm, 360° och moturs uppåt. Rimliga, eller hellre
  medurs?
- Gånglinjen ligger 300 från ytterkanten, som i andra trappor. Rätt för
  en spiraltrappa, eller ska den ligga i mitten?
- Ett nytt stegdjup ändrar graderna (inte diametrarna). Rätt?
- Det ovanför snittet ritas streckprickat också ovanpå det heldragna när
  trappan går mer än ett varv. Rätt, eller bara det som inte ligger över
  något heldraget?
- Behövs en knapp för att göra om en vanlig trappa till spiral (och
  tillbaka)?

**0.11.4 efter provning** (Claudes val, se PLAN.md)
- Vangstyckena står innanför trappans bredd (bredden är yttermåttet).
  Rätt, eller ska bredden vara den fria bredden mellan dem?
- Vangstycke 50 × 300, plansteg 40 med stegnos 30, sättsteg 20. Rimliga
  förval för en villatrappa?
- Utan material: plansteg i trä, vangstycken och sättsteg vitmålade. Ska
  stilboken få ett material *Trä* (bara nya projekt)?
- Kontrastmarkeringen: ingen som förval, 50 mm, mörk remsa. Ska *Första
  och sista* vara förval, och ska en varning hänvisa till BFS 2024:9 (inte
  uppslaget än)?
- Stegnummer och *15 st à 180/260* syns i Detalj för alla trappor. Rätt
  nivå, eller ska de vara ett eget val under Visa?

**0.11.3 efter provning** (Claudes val, se PLAN.md)
- Ett trappstegat fack ligger på sin högsta punkt, så att glipan under
  växer nedåt i facket. Rätt, eller hellre medelhöjden (och lite i
  marken)?
- *Längs kant* längs ett hål, ett bjälklag eller en ramp kopierar linjen;
  räcket följer inte med när kanten ändras (bara trappor gör det).
  Behövs det kopplade räcket före piloten?
- En grind som följer staketet får en egen littera (G02 när G01 är en
  typ). Hellre ingen littera utan grindtyp?
- Stolparna i ST-typerna och grindstolparna syns redan i Normal (andra
  delar i Detalj). Rätt nivå för situationsplanen?
- Gruppernas knappar i editorn syns när musen är över gruppen, i stället
  för högerklick som på tavla 4. Räcker det?

**0.11.2 efter provning** (Claudes val, se PLAN.md)
- En grupp tas bara bort när den är tom. Hellre att typerna flyttas till
  gruppen ovanför?
- *Ny typ…* ger delar efter gruppen (stolpe, handledare, spjälor; spaljén
  ett rutnät). Hellre en kopia av den valda typen?
- Förhandsvisningen ritar typens förvalda värden, inte det markerade
  räckets. Räcker det?
- Projekt utan räckestyper får RÄ01–RÄ03 med en knapp i editorn. Ska de
  hellre finnas från början i nya projekt?

**0.11.1 efter provning** (Claudes val, se PLAN.md)
- RÄ01 har en rund ledstång 70 mm innanför handledaren, på *Skyddshöjd −
  40*. Rätt förval, eller ett räcke utan ledstång och RÄ03 bredvid?
- Den utjämnade handledaren avviker mer än 50 mm vid kilstegen i de flesta
  L-trappor, så varningen syns ofta. Lagom, eller ska gränsen gälla bara
  den inre kanten?
- I Detalj ritas handledare, ledstång och stolpar, inte spjälorna. Ska
  spjälorna synas i planen?
- Ett räcke på en trappa flyttas inte för sig (*Lösgör* först). Rätt?
- Innanför 50 mm som förval på trappan. Lagom?

**0.11 efter provning** (Claudes val, se PLAN.md)
- Referenslinjen ligger i mitten som förval. Hellre en kant (oftast ritar
  man längs en vägg)?
- Kilstegen strålar från det inre hörnet, så att de blir spetsiga där.
  Rätt, eller ska de balanseras (framkanterna inte genom hörnet)?
- Snittlinjen snett över trappan är 0,25 och samma ställe som trappans
  snitt i sektionerna. Rätt, eller två ställen?
- Hålet ritas i planen ovanför som bara en kant (utan kryss), så att
  trappan syns. Rätt?
- *Gör till eget hål* gör hålet till en vanlig håltagning som inte följer
  trappan. Räcker det, eller behövs det kopplade hålet (följer med vid
  flytt, kan låsas upp) före piloten?
- *Syns också på* ritar allt grått 0,18 utan text och går inte att klicka
  på där. Rätt?

**Besvarade 30 oktober, planeringen av 0.11:** A delningen 0.11–0.11.3
(räcket direkt efter trappan, ska kunna byggas ut); B vilplan både per
sträcka och per sväng; C gånglinjen ställbar, alltid från utsidan, förval
300; D första/sista plansteget räknas som en del av trappan; E räcket får
egen utredning med mockup. Dessutom: referenslinjen ritas i
trappverktyget, smartspöt är ett alternativ. Allt gjort i 0.11 utom
räcket (0.11.1). Räckets utredning: A–H besvarade (se PLAN.md).

**Besvarade 30 oktober** (Claudes val gäller): 0.10.32 alla fyra
(vytypens kategori när ingen vy är sparad; kategoribyte släpper vyns
ändringar; pennorna per kategori tills 0.10.36; Poché och Färgmarkerad
som kategorier, gjort i 0.10.33). 0.10.31: ortofotot där marken saknar
material, plus valet *Ortofoto* (gjort i 0.10.33); bildens sida i mm.
0.10.30: rutornas mått lagom så länge; en rad "Eget" per fyllning (prova).

**0.10.40 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Mallbladen och stämplarna är ikryssade som förval vid export, import
  och mallen. Rätt, eller hellre okryssade vid import (så att samma
  mallblad inte läggs in två gånger)?
- Mallbladens mappar i projektträdet följer inte med (de hamnar överst i
  Ritningar). Störande?
- Typerna (YV01, D1 …) och vy-taggarna följer inte med mallen. Ska de?

**0.10.39 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Kontorets taggar (`{företag}`, `{telefon}` …) är inga fält på bladen;
  de fylls bara i under Allmänt. Rätt, eller ska ett blad kunna skriva
  över dem?
- Ett ifyllt skede under Allmänt gäller alla blad (bladens egna försvinner
  och kommer inte tillbaka när det töms). Rätt?
- Måtten i m skrivs med två–tre decimaler (3,45 och 3,455), i cm med en
  (345,5). Lagom?
- Logotypen läggs 40 mm bred med nedre vänstra hörnet där man klickar.
  Lagom, eller hellre i ramens hörn?

**0.10.38 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Dörrar och fönster har nu var sina rader i fasaden för karm, glas, foder,
  skarvar och öppningssätt (förut gemensamma). Bra, eller hellre
  gemensamma rader för öppningarna?
- Väggar, bjälklag och tak slås ihop i sektionens snitt så länge deras
  snittlinjer är lika; ändras en blir det en skarv mellan dem. Rätt?
- Gruppen heter *Bjälklag, tak, stödmurar, möbler och rum* också i
  fasaden, där rummen inte har någon rad. Störande?

**0.10.37 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Med jämförelsen på går åtgärdens färg före en rad med egen färg (i
  Färgmarkerad blir allt nytt rött, också en blå glasrad). Rätt?
- Bjälklag, tak och stödmurar har bara en snittlinje; deras oskurna
  linjer är raderna *under snittet*. Räcker det?
- Fönstrets bleck och dörrens karm i kontur ritas inte i planen och har
  ingen rad där. Ska blecket synas i planen?
- En egen penna med bara en färg (ingen tjocklek) står inte i
  pennlistan. Rätt?

**Besvarade 30 oktober (förmiddag), 0.10.36:** A snitt- och konturlinjer
per objekt, sammansatta objekt med flera av varje (0.10.37); B väggens
penna för öppningarnas oskurna linjer; C *Symbol* följer *Snitt*; D
linjetypen hör till stället; E alla pennor i projektet ska gå att söka
(material, typer, objekt); F snittlinjen ger tjockleken, åtgärden färg och
streckning; G snitt- och konturlinjerna före Allmänt; H över- och
undersnitt kvar som egna ställen. Kvar efter provning: sparas sorteringen
per rubrik i filen, eller räcker det att den kommer ihåg sig medan sidan
är öppen?

**0.10.35 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Underlagen ligger i kategorin (Illustrationsplan kan ha ortofotot i alla
  sina vyer). Ska ett nytt projekts Illustrationsplan ha ortofotot under
  sig från början, när platsen har ett?
- DXF/bild är ingen egen källa: *Fil…* lägger in filen där du är, som
  förut. Behövs en fil som bara hör till vyn?
- Krysset *Underlag* under Visa gäller bara filunderlagen. Ska det också
  släcka underlagen i vyn?
- Underlagen ritas i den ordning de lades till, utan flyttknapp. Räcker
  det? Och 40 % som förval?

**0.10.34 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- *Vanliga* är förvalet och döljer *Snittet i planen* och sällan ändrade
  kryss under Innehåll (det ändrade syns alltid). Rätt urval, eller ska
  *Alla* vara förvalet?
- Favoriterna: plus sparar i det valda setet, högerklick tar bort en.
  Räcker det, eller behövs en tydligare knapp för att ta bort?
- Pennorna har ingen opacitet (bara åtgärdernas fyllning och bakgrund).
  Behövs det?
- Visa-menyn har kvar sina kryssrutor. Ska den också få knappar med
  symbol, som Innehåll?

**0.10.33 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- *Återställ* på en ändrad rad syns när musen är över raden (pricken
  syns alltid). Hellre alltid synlig?
- En kategori får prickar mot sitt förval (t.ex. Skiss mot Plan), inte
  bara en vy mot sin kategori. Hjälper det, eller stör det?
- Undertak och Golvplan i 1:50 utan möbler, öppningssätt och littera
  (undertaket också utan mått); Mått och littera utan möbler. Rätt
  innehåll? Undertaket ritas inte spegelvänt än.
- *Ny vy → en kategori* tar kategorin som den är, inte det som visas nu
  (det gör *Med det som visas nu…*). Rätt?

**0.10.31 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Ortofotot och texturerna skuggas som kulörerna; Carl August vill att
  allt skuggas men har inte sett det än. Ser det rätt ut?

**0.10.30 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Rader läggs till och tas bort per material (*När det syns*, *Alltid*,
  *Aldrig*). Behövs fria rader med egen text och eget mönster? (Oklart
  för honom innan han testat; fråga efter provning.)

**0.10.29 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Shift fritt avrundar vinkeln till hela grader; står man i ett vinkellås
  eller på en punkt gäller exakt den riktningen. Rätt, eller ska fritt
  också vara exakt (t.ex. 37,28°)?
- Parallell kopia och Förskjut alla kanter skrivs också vid objektet, som
  Förskjut. Rätt?
- Platsens rad i våningslistan har kvar *markmodell* / *plan mark* under
  namnet. Ska den också få tankstreck och en höjd (t.ex. ±0 i RH 2000)?

**0.10.28.3 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Markytans höjd föreslås nu också ur den färdiga marken (inte bara
  rampens). Rätt?
- Markobjekten på Platsen hänger på ±0 och flyttar inte när en
  våningshöjd ändras (testat); platån runt huset följer golvet. Såg du
  något annat flytta? Då behövs en skärmbild.

**0.10.28.2 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Bjälklaget fylls i planen under snittet med materialets mönster (Betong
  ger betongmönster över hela golvet, under rummen). Rätt, eller ska
  bjälklagen bara få materialet i snitt och 3D och planen vara tom som
  förut?
- Materialets snitt gäller det som är kvar och nytt, och ersätter
  stilmallens fyllning (t.ex. skrafferingen för nytt); det som rivs ritas
  som förut. Rätt, eller ska stilmallens fyllning för nytt gå före?
- Ytan syns bara i fasader, inte i sektionernas vy bortom snittet. Ska
  den synas där också?
- Takpannor (linjer var 350 mm) och Plåt (falsar var 600 mm) är nya. Ser
  de rätt ut i fasaden och på Platsen? Saknas något byggnadsmaterial?
- Mönstrets vinkel, avstånd och skala för snittet och ytan går inte att
  ändra (förvalen gäller; Takpannor och Plåt har sina). Räcker det, eller
  behövs en redigerare som för planen?

**0.10.28.1 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Listan har tre färger per material (planen, illustrationsplanen, 3D),
  men mönstret i planen ändras bara i panelen för ett objekt med
  materialet. Räcker det, eller ska mönstret också gå att välja i listan?
- En stödmur utan material på Platsen är bara konturen (förut svart).
  Rätt, eller ska den få en ton?
- Ett material som sparas ur en 2D-form får varken *Mark* eller
  *Byggnad* (markobjekten ser det inte förrän man kryssar). Rätt?
- De nya fyllningstyperna: Gatsten 100 i förband, Stenmur i stora block,
  Trall med brädor 145 och Singel som prickar på papper. Ser de rätt ut?
- Shift som släpps mitt i ett drag panorerar igen. Ska vyn hellre
  fortsätta snurra tills knappen släpps?

**0.10.27 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Mellanslag + dra panorerar och Mellanslag + Shift + dra snurrar (du sa
  "kör" utan att svara på frågan). Bra, eller hellre något annat?
- Rutan tar det vars omslutande rektangel på skärmen ryms i eller nuddar
  rutan, som i planen. Snett sett kan en vägg tas från höger till vänster
  fast rutan bara går nära den. Störande?
- Ett drag som börjar på det markerade flyttar det, som förut. Ska ett
  drag alltid vara en ruta (flytt bara med Flytta och greppen)?

**0.10.26 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Ser rampens kant med stödmur rätt ut nu? Lodytan har markens kulör;
  ska den se ut som en mur (eller ska sidan bli en riktig stödmur med
  krön, frågan om 0.10.18)?
- Höjdkurvorna i planen räknas som förut på rutnätet och kan ligga en
  ruta fel vid en stödmurskant (i 3D tas de bort där). Störande?
- Stödmuren har kantlinjer i hörn som viker mer än 20°. Lagom gräns?

**0.10.25 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Husets verktyg (vägg, tak, bjälklag …) går att använda på Platsen, och
  objekten hamnar då på Platsen, inte i huset (klickjämförelsen visade
  det). Ska de spärras där, eller öppna en våning, som Mark öppnar
  Platsen?
- Husets kontur på Platsen är 0,35 heldragen utanför taken och streckad
  under dem. Rätt, eller ska taket vara streckat och fasadlivet
  heldraget? Behövs en egen penna i stilmallen?
- Marken i våningsplanerna är en kalkering (tonad, inte klickbar, i
  stället för annan kalkering). Räcker det, eller ska den vara ett eget
  val under Visa, så att våningen under kan kalkeras samtidigt?
- Förinställningarnas skalor och innehåll (Situationsplan 1:400 utan
  markörer; Markplaneringsritning 1:200 med branta slänter;
  Illustrationsplan 1:200 utan höjdkurvor, mått och littera). Lagom?
- Ska *Bara den här våningen* i 3D heta något annat på Platsen?

**0.10.24 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Äldre bjälklag och markytor behåller sina korta raka bitar. Behövs en
  knapp som gör om en sådan kontur till bågar (som *Ur väggarna* urbockat
  gör), eller räcker det att rita om med spöet?
- Markytans polygon sluts när man byter verktyg (som linjerna avslutas).
  Rätt, eller ska den kastas som bjälklagets?

**0.10.23 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Takfallet med spöet täcker hela husets kontur, med takfoten vid kanten
  närmast och taket stigande inåt (ett pulpettak över huset). Rätt, eller
  ska spöet i *Takfall* ge ett takfall per sida?
- Pulpet, Sadel och Valm läggs över den omslutande rektangeln också när
  huset inte är rektangulärt. Räcker det?
- Måttkedjan tar båda liven på varje anslutande vägg, också i hörnen
  (väggtjockleken). Rätt, eller bara innerväggarna?
- Littera med Shift: var sin littera på varje objekt. Hellre en littera
  med en ledare till varje?

**0.10.20 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Markhöjden räknar marken som oförändrad när ny och befintlig skiljer
  mindre än 5 cm (då bara den befintliga, understruken). Lagom gräns?
- Konturen runt slänterna är alltid på (0,13). Ska den vara ett val, eller
  få en egen penna i stilmallen?
- De branta slänterna är grå (muted) och följer fallinjen; strecken bryts
  där markobjekten ändrat marken. Rätt färg och gräns (1:3)?

**0.10.19 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
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

**0.10.18.1 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Höjdkurvornas färg gäller planen och bladen; 3D-vyns kurvor har sin
  egen. Ska de följa stilmallen också?

**0.10.18 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
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

**0.10.17 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Ett klick på änden av en omarkerad linje ritar vidare på den. Störande
  när man vill börja en ny linje där (Ctrl+klick)?
- Ett klick mitt på en kant startar det senast använda valet på en kant.
  Var det så du menade, eller ville du bli av med något sådant?
- Bågar direkt i takets kontur och håltagningen (*Båge*, G). Ska 2D-
  verktygets linje få samma (fråga 59)?
- Vrid och spegla hålet kring punkten man klickade på. Hellre kring hålets
  mitt?

**0.10.16 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Ett fönster helt över eller under snittet ritas som hålets två kanter
  och glaset. Räcker det, eller ska karmen synas?
- En möbel som går genom snittet (t.ex. ett högskåp) ritas som förut, som
  symbol. Ska den ritas snittad?
- Den egna pennans del *Över snittet* följer objektets penna när den är
  tom. Rätt, eller ska den följa stilmallen?
- Dubbelklick på Visa tänder inte det som är släckt från början (husets
  kontur genom taket, linjerna i 3D). Rätt?

**0.10.15 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Det dolda räknas med i väggarnas skarvar och rummen. Rätt, eller ska en
  dold vägg också försvinna ur rummens konturer?
- De dolda objekten tas fram alla på en gång. Behövs en lista att ta fram
  dem ett och ett?
- Greppet för *Tonat från* ligger en bit från mitten (romb), djupets i
  mitten (fyrkant). Lätt att hitta?
- Ska högerklick i 3D-vyn dölja bara i 3D, eller gälla vyn som nu?

**0.10.14 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Slänternas fyllning täcker ytan som släntstrecken går över. Rätt yta,
  också där två markobjekt möts?
- Mönstret utgår från objektets första hörn. Behövs ett grepp för att
  flytta utgångspunkten?

**0.10.12 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
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

**0.10.11 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
- Våningens meny: Visa, Inställningar, Byt namn, Ny våning ovanför och
  under (den högerklickade våningen), Ta bort. Saknas något? Ska
  arbetsbladen få en meny också?
- Visa-menyn: inställningarna till vänster, kategorierna i två kolumner
  till höger. Bra ordning, eller detaljnivåerna överst över hela bredden?
- Hovring i 3D tonar objektet ljust i markeringsfärgen. Lagom tydligt?
- Markobjekten markeras med ett klick i marken, och konturen ritas på
  marken. Ska hörnen också gå att dra i 3D?

**0.10.8 efter provning** (Claudes val, se `docs/arkiv/PLAN-0.10.md`)
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
65. Autosparen kommer ihåg filen mellan sidladdningar (Chrome frågar)?
66. Rumsstämpelns pil mot närmaste kant eller rummets mitt?
67. X och Y nedre vänstra hörnet också för DXF, inte filens nollpunkt.
68. Gruppen för en fil på flera ställen utfälld från början?
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
