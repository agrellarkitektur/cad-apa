# Plan, arkiv: 0.10–0.10.40.1

Klara versioner, flyttade hit ur [PLAN.md](../PLAN.md) 30 oktober 2026 (efter
0.10.40.1). Innehållet är oförändrat: vad som bestämdes, Claudes val och det
som inte gjordes, version för version.

### 0.10 Tak · *nytt format (17)*

Uppdelat 25 oktober i fem versioner (bekräftat av Carl August). Taket görs
som enkla takfall i stället för en kontur där varje kant är takfot eller
gavel: komplexa tak byggs av flera takfall (Carl August 25 oktober). Det
tar bort den svåra geometrin (vinkelrännor ur en godtycklig kontur).

- Ett tak är ett takfall: en kontur (raka kanter och bågar, ändras som en
  2D-form) och en referenslinje med höjd, lutning och tjocklek. Höjden
  gäller översidan eller undersidan. Referenslinjen kan ligga var som
  helst, även mitt i takfallet; taket fortsätter nedåt på andra sidan
- Referenslinje med radie: taket lutar vinkelrätt mot bågen, så en
  halvcirkel blir en halv kon
- Verktyget: konturen, sedan referenslinjen och sidan som stiger.
  Snabbval över en rektangel: pulpet (ett takfall), sadel (två) och valm
  (fyra), med takfots- och gavelsprång. *Över hela huset* när huset är
  rektangulärt
- Kapa mot tak i Modifiera: ett takfalls kontur kapas där det möter ett
  annat (nock, grat, vinkelränna)
- Taket kapar väggar på alla våningar efter verklig höjd
- Greppen i fasad och sektion (höjd och lutning), taklutningen och
  nivåmarkörerna följer de nya taken

*Byggd (25 oktober), format 17. Claudes val: referenslinjen sparas som
två punkter (`ref`) med pilhöjd (`refBulge`), och taket stiger åt vänster
sett från start mot slut; *Vänd lutningen* byter riktning. Höjden gäller
undersidan från början. Byts valet till ovansidan ligger taket kvar
(höjden räknas om). Konen delas i 64 plana bitar per varv, så att väggar,
3D, fasader och sektioner fungerar som förut; positiv radie i
egenskaperna stiger mot centrum. Snabbvalen dras upp i husets ytterliv
(referenslinjerna där), nocken längs den längre sidan och pulpettakets
takfot på den långsida som första hörnet ligger på; förval 27°, 2700,
takfotssprång 500 och gavelsprång 300. Valmens takfall räknas så att varje
del är där takfallet ligger lägst. *Över hela huset* finns bara när
ytterkonturen är en rektangel (97 % av den omslutande rektangeln).
Kapa mot tak kapar de markerade takfallen längs skärningen med det man
klickar på, förlängd över hela konturen; kvar blir den sida där man
klickade på takfallet (strax innanför kanten), med flera markerade den
största. Kapade kanter blir raka (bågar blir polylinjer). Taket kapar
väggar på alla våningar där det ligger ovanför väggens fot, men Upp till
taket drar bara upp väggar under tak på samma våning (en gavel på plan 1
går inte upp genom plan 2). Nivåmarkören *Takfot* är takets lägsta punkt på
undersidan, som förut (i fasadlivet med byggnadshöjden i 0.10.5). I
fasaden sitter höjdgreppet vid referenslinjen och lutningsgreppet i
punkten längst från den; Shift (nocken still) finns inte längre.
Skarven vid nocken syns inte i 3D och fasader: ett hörn som ett annat
takfall delar, där de fria kanterna ligger på en linje, får ingen
lodrät kantlinje.*

### 0.10.1 Granskning

Före takfoten (Carl August 26 oktober; takfoten blev 0.10.2). Enligt
planen (ungefär var tredje version; förra var 0.9.3).

- Väggar under bjälklag i 3D och sektion (synpunkt 25 oktober)
- Väggar med samma liv på två våningar ska inte ge konturlinjer mellan
  dem i 3D och fasad (synpunkt 25 oktober)
- Bjälklaget kapar väggen där det täcker den, som taket (synpunkt 26
  oktober, sorterad hit av Claude eftersom det är samma kod)

*Byggd (26 oktober), samma format (17). Testerna: 456 → 459 på ca 11 s.
Felet var väggarnas kantlinjer: de slogs ihop per våning (för att
skarvarna inte ska synas) och fick den första väggens id, så att
bjälklagen inte kapade innerväggarnas linjer (de kapades efter id) och
en markerad vägg i sektionen lyste upp alla väggars linjer. Ytterväggarnas
snittyta går golv till golv med flit när bjälklaget är *Ur väggarna*.
Nu delas linjerna efter vilken vägg kanten kommer ifrån, med samma
uppslag som de egna pennorna (`edgeOwners`), så en vägg med egen penna
har den också på sina linjer i fasader och sektioner. Claudes val:
bjälklagen ovanför kapar väggen exakt där de täcker den, i stället för
regeln från 0.9.2 (väggens mitt under bjälklaget), och gäller alla väggar,
också ytterväggar och väggar under tak (där gäller det lägsta av taket
och bjälklaget). Det lägsta bjälklaget ovanför gäller; ett som ligger
högre än väggen gör ingenting. Flisor tunnare än en halv millimeter, där
bjälklagets kant nästan följer väggens liv, räknas inte. Linjen mellan
våningarna tas bort där ovansidan av en vägg och undersidan av en vägg på
en annan våning har samma kant, med väggen på samma sida och samma
åtgärd; den är kvar under en dörr (eller en öppning som går upp till
väggens ovansida) och där väggen ovanför kragar ut. Bjälklagens kanter
ritas som förut, så ett bjälklag ritat till ytterväggarnas utsida syns
som ett band i fasaden. Granskningen: `wall.ts` 572 → 147 rader
(kropparna i `wallBodies.ts`, 3D i `wall3d.ts`); väggarnas bitar slås upp
per vägg i 3D (förut prövades alla bitar för varje vägg); 3D-vyn ritar
alla kantlinjer i en geometri i stället för en per lista; en vägg som
ligger helt i eller utanför ett bjälklag kapas utan boolesk operation.
3D av ett hus med tre våningar à 312 väggar och bjälklag tar ungefär som
förut (ca 0,3 s, några hundradelar mer för kapningen och skarvarna).
Testet för 0.9.2:s kapning är ihopslaget med det nya.*

### 0.10.2 Takfot och taket i planen

Mellanstor. Var 0.10.1 före granskningen.

- Språngets tjocklek separat från takets (språnget är delen utanför
  ytterväggarnas utsida)
- Takfotens snitt per kant: vinkelrätt mot takytan (förval för takfoten),
  lodrätt (nock och grat) eller egen vinkel
- Tak och volymer ovanför planets snitt ritas punktstreckade (synpunkt 20
  oktober), med en snitthöjd per våning
- Vyinställning: byggnadens footprint (ytterväggarnas kontur) som streckad
  linje genom taket i planen (synpunkt 25 oktober)

*Byggd (26 oktober), samma format (17), med valfria nya parametrar. Testerna:
459 → 467 på ca 11 s. Claudes val: taket är en kropp av plana bitar
(`roofBody`) med takets ovansida överallt; undersidan är takets innanför
husets kontur, språngets utanför och snittets i en remsa längs en snett
snittad kant. Väggarna kapas, och 3D, fasader och sektioner ritas, efter
samma bitar. **Takfot** är en kant som vetter nedåt i lutningen (taket
stiger in från den); den snittas vinkelrätt mot takytan från början, och
remsan är tjockleken gånger sin(lutningen) bred (136 mm för 300 och 27°).
Nock, grat, gavel och kanter mot ett annat takfall snittas lodrätt. Ett
vinkelrätt snitt som inte går in under ovansidan (vid en nock) blir
lodrätt. Takfotens snitt väljs på taket (*Vinkelrätt mot takytan*,
*Lodrätt*, *Med vinkel mot det vågräta*, förval för vinkeln 90° minus
lutningen); en kant får ett eget i Modifiera (*Vinkelrätt*, *Lodrätt*,
*Vinkel* med 60° från början, och *Förval* när kanten har ett eget). En
kants eget snitt sparas med kantens två hörn, så det följer med när taket
flyttas, vrids och speglas men glöms när kanten ändras (ett hörn flyttas,
kanten förskjuts, taket kapas). En båge som takfot snittas bit för bit
utan synliga skarvar. **Språnget** är delen utanför husets kontur:
ytterväggarnas utsida på alla våningar, sammanslagen (rummen och gårdar
fylls i, det som rivs räknas inte). Språngets tjocklek är vinkelrätt mot
takytan som takets; samma som takets sparas inte. Vid väggen syns steget i
undersidan som två linjer. **Snitthöjden** är våningens, 1200 mm från
början (förvalet sparas inte); i planen ritas det av konturen som ligger
ovanför punktstreckat, det under heldraget, och snittytan (där höjden
ligger mellan undersidan och ovansidan) får stilmallens snittfyllning och
ritas under väggarna. Ett tak syns i planen för en annan våning när det
når in i våningens höjd (golv till golv), så ett tak på plan 1 syns i
vindsplanet men ett tak på plan 2 syns inte i plan 1. **Husets kontur
genom taket** står under Visa (Modell) och är släckt från början; den
tänds med `+footprint` i vyns `hide`, så att äldre vyer inte får den. Den
ritas streckad (*Streckad*, 0,18) inne i varje takfall och går inte att
klicka på. Nivåmarkören *Takfot* är nu kroppens lägsta undersida (2515 i
stället för 2445 i exempelvillan, där snittet tar takfotens nedre hörn).
Kända begränsningar: där två snittade kanter möts i ett konvext hörn (två
takfötter på samma takfall) tar den första kantens snitt hörnet; ett
vinkelrätt snitt i hörnet mellan takfot och en gavel med vinkel ritas
inte som ett geringssnitt.*

### Marken före piloten (bestämt 26 oktober)

Carl August 26 oktober: marken ska inte behöva anges för hand. Med
platspaketet från Höjdkurvor finns alltid en markmodell, och
medelmarknivån räknas automatiskt, också när marken fylls upp eller grävs
ut runt huset. Därför flyttas terrängen från *Efter pilotprojektet* till
0.10.3–0.10.5, och koordinaterna från *Koordinater, SWEREF och sol*.
Höjderna är riktiga (RH 2000). Den befintliga marken ändras aldrig; den
färdiga marken räknas om ur den och markobjekten, som är fristående och går
att flytta och ändra. Ingen penselmodellering. Skissen skickas inte
tillbaka till Höjdkurvor: analyserna görs i cad-apa (efter piloten).

### 0.10.3 Markmodell · *nytt format (18)*

Mellanstor till stor, en session.

- Ta emot platspaketet från Höjdkurvor (`docs/UTBYTE-CAD-APA.md` i
  hojdkurvor-repot, version 1): `postMessage` med handskakningen och
  `.hkplats.json` som fil. Fråga innan ett öppet projekt ersätts
- Projektet får nollpunkt, SWEREF-zon, vridning och sann nord (norrpilen);
  planen ritas runt nollpunkten, så att stora koordinater inte når 3D-vyn
- Höjder i RH 2000: modellen räknar relativt projektets höjd och visar
  RH 2000 (*FG +114,500*). Utan markmodell som i dag (plan mark)
- Rutnätet sparas för sig (inte som tal i projektets JSON; upp till 1,2
  miljoner punkter) och kan beskäras till ett mindre utsnitt
- Befintlig mark i 3D, som höjdkurvor i planen (förval 0,5 m, val 0,25 och
  1 m; tunna och streckade) och som tunn streckad marklinje i fasader och
  sektioner
- Grannhusen (`byggnader`) som enkla volymer, träd, vägar och stompunkter
- Medelmarknivån räknas automatiskt längs husets kontur, viktad efter
  fasadernas längd, och visas i husets egenskaper och som nivåmarkör
- Fastighetsgränser läses om paketet har dem (fältet finns inte än; står
  på Höjdkurvors lista). cad-apa föreslår fältets form och läser det när
  det finns
- Behöver ett riktigt platspaket att prova mot (Carl August sparar en
  platsfil ur Höjdkurvor; testdata går att göra med Höjdkurvors
  `test/data/make_dtm.py`)

*Byggd (26 oktober), format 18. Provad mot Carl Augusts platsfil
Bosgård (Nybro, 200 × 150 m, 1 m rutnät, Höjdkurvor 0.7.0). Testerna:
467 → 474 på ca 12 s. Claudes val: **Platsen** är ett eget fält i
projektet (`site`: koordinatsystem, nollpunkt, vridning, sann nord,
utsnitt, ±0 i RH 2000, rutnätets mått, källa, licens och gränsvarning);
rutnätets höjder ligger i en fil bland projektets filer (`assets`,
base64 som i paketet), inte som tal i JSON. Modellens origo är paketets
nollpunkt, och zonens koordinater räknas om med Höjdkurvors formler; de
når aldrig planen eller 3D-vyn. **±0** (plan 1:s golv) är markens höjd
mitt i utsnittet avrundad till decimeter från början och ändras i
dialogen *Platsen* (huvudmenyn), där knappen *Medelmarknivån* fyller i
den; nivåmarkörerna i fasader och sektioner skrivs i RH 2000 (*FG +62,600*)
när projektet har en plats, och våningens egenskaper visar golvets
RH-höjd. Grannhus, träd och stompunkter har kvar sina höjder i RH 2000,
så att ett nytt ±0 flyttar huset mot marken. **Det som kommer med
platsen** blir låsta objekt i alla tillstånd på plan 1: *Befintlig mark*
(höjdkurvorna), *Grannhus* (fotavtrycket, i 3D en volym på marken med
registrets höjd, 6 m utan), *Träd* (kronan i plan, stam och krona som
prismor i 3D) och *Kartobjekt* (fastighetsgränser streck-punkt, tunnare
och grå med mer än 1 m osäkerhet som i Höjdkurvor; vägar; gränspunkter;
fastighetens beteckning; stompunkter med höjd). Fastighetsgränserna
läses: fältet `fastigheter` finns sedan Höjdkurvor 0.7.0. Grannhus och
träd syns i 3D-vyn men inte i fasader och sektioner (de skulle fylla
fasaderna med det som står långt bort). **Höjdkurvorna** räknas i
cad-apa ur rutnätet (paketets kurvor används inte), 0,5 m från början
och 0,25 eller 1 m i dialogen; hela meter 0,18 med höjden utskriven,
övriga 0,13, alla grå och streckade, och de går inte att klicka på.
**Marken i 3D** är ett triangelnät (högst 250 000 noder, glesare annars)
utan skuggplanet vid ±0; det räknas inte när 3D-vyn ställer in sig på
huset. **Marklinjen** i en sektion följer linjen; i en fasad följer den
husets kontur närmast betraktaren och utanför huset konturens framkant,
5 m ut på varje sida, tunn (0,18) och streckad. Den tjocka linjen vid
±0 ritas inte när det finns en markmodell (den nya marken kommer i
0.10.4). **Medelmarknivån** är markhöjden längs husets kontur (som
genom taket) i medel per meter, med nivåmarkören *MMN* i fasader och
sektioner och värdet i dialogen. **Ta emot platsen**: Öppna fil, dra
och släpp en `.hkplats.json` på planen, *Uppdatera ur fil…* i dialogen,
och meddelandet från Höjdkurvors flik (`#hojdkurvor-import`, `cad-apa:redo`,
`hojdkurvor:plats`, `cad-apa:mottaget`; godkända ursprung är cad-apas eget,
agrellarkitektur.se och höjdkurvor.se). En fråga följer alltid: *Nytt
projekt* (förval) eller *Lägg i det öppna*; för samma plats (`projekt.id`)
är förvalet *Uppdatera platsen*. Läggs en plats in i ett projekt som
redan har en i samma koordinatsystem behålls nollpunkten, vridningen och
±0, så att huset står kvar, och det som kom med den gamla platsen byts ut.
Norrpilen ställs mot sann nord (rutnätets nord vriden med
meridiankonvergensen). **Beskär** i dialogen skär markmodellen och det
som kom med platsen till en ruta runt huset (30 m från början).
Licenstexten och gränsvarningen står i dialogen. Kända begränsningar:
höjdkurvorna för ett stort och brusigt rutnät (1,2 miljoner noder) tar
ett par sekunder första gången; licenstexten skrivs ännu inte ut på
bladen; skissen tillbaka till Höjdkurvor görs inte (beslut 26 oktober).*

### 0.10.4 Markobjekt del 1

Stor, kan behöva två sessioner.

- Den färdiga marken räknas ur den befintliga och markobjekten (ritordning
  där de överlappar), och räknas om när ett objekt ändras
- **Platå**: kontur med höjd, plan eller med fall; varje kant möter marken
  med slänt (förval 1:2) eller stödmur
- **Platå runt huset**: följer husets kontur och sockel, avstånd ut från
  fasaden och fall från huset (förval 1:20 de första 3 m); följer med när
  huset flyttas
- **Urgrävning**: kontur med bottenhöjd och slänt inåt; en variant följer
  bjälklaget i mark
- Höjdkurvor över färdig mark (tjocka) och befintlig (tunna, streckade);
  marksnittslinjen för ny mark tjock och heldragen i fasader och sektioner;
  jordskraffering under snittlinjen som val (av från början)
- Befintlig mark hör till tillståndet *befintligt*, markobjekten till
  *nytt*: före och efter syns med tillstånden. Medelmarknivån mot färdig
  mark (förval) och mot befintlig
- Schakt och fyll i m³
- Förvalen (lutningar, avstånd) går att ändra i projektet

*Byggd (26 oktober) i en session, samma format (18): en ny elementtyp
gör inte äldre filer oläsliga. Testerna: 474 → 481 på ca 12 s. Claudes
val: **ett objekt**, *Markobjekt* (`Ground`), med sorten i parametrarna:
platå, urgrävning, platå runt huset (`around`) och urgrävning under ett
bjälklag (`slab`). Verktyget **Mark** (Rita) drar upp en rektangel som
bjälklagsverktyget; konturen ändras sedan i Modifiera som bjälklagets.
Platåns höjd föreslås ur marken i rektangelns mitt, urgrävningens en
meter under (avrundat till 50 mm), och skrivs i RH 2000 i egenskaperna.
**Urgrävningens kontur är botten och slänten går utåt** (avsteg från
"slänt inåt", så att urgrävningen under bjälklaget har hela bjälklaget
med arbetsutrymme i botten och samma regel gäller som för platån). **Slänten**
är ett band runt ytan som vidgas med avståndet (d/N över och under
kantens höjd); befintlig mark inom bandet är orörd, annars schaktas eller
fylls den till bandet. En urgrävning tar bara ned. En stödmur ger ingen
slänt (lodrätt mellan två noder i rutnätet); den ritas tjock i planen.
**Platå med fall**: 1:N och riktning, höjden gäller i konturens mitt, och
en pil visar fallet. **Runt huset**: marken vid fasaden en sockel (200)
under objektets våning, fall 1:20 de första 3 m, platån 3 m ut (rundade
hörn); marken under huset rörs inte, utom noderna närmast fasaden.
**Under bjälklaget**: bjälklagets kontur (husets kontur när det följer
väggarna) plus 500 arbetsutrymme, botten i underkanten. Urgrävningar under
bjälklag räknas alltid först (grunden fylls igen av platån runt huset),
övriga i ritordning (Fram och Bak finns för markobjekt). **Förvalen**
(slänt 1:2, fall 1:20, 3 m, 3 m ut, sockel 200, arbetsutrymme 500) står i
*Platsen*; ett tomt fält i egenskaperna följer dem. **Tillstånden**:
markobjekt hör till förslaget; ritas de i Befintligt läggs de i alla
förslag. I ett förslag är marklinjen den färdiga marken, tjock (0,5) och
heldragen, också utan markobjekt (då lika med den befintliga); den
befintliga ritas tunn och streckad bara där den skiljer sig. I
Befintligt som i 0.10.3. Höjdkurvorna för färdig mark (0,25, hela meter
0,35 med höjden) ritas bara där markobjekten ändrat marken; den befintligas
som förut. **Medelmarknivån** mot den färdiga marken i ett förslag, mot
den befintliga som val i *Platsen*, där båda visas; knappen
*Medelmarknivån* för ±0 använder den befintliga (annars flyttar platån
runt huset sig med ±0). **Schakt och fyll** per objekt (det objektet
ändrar efter dem bakom) i egenskaperna och för förslaget i *Platsen*.
**Jord** under marklinjen i sektionerna (fyllningen *Mark*, 600 mm
djup) som val i *Platsen*, av från början. Under Visa heter *Befintlig
mark* nu *Marken*, och *Markobjekt* släcker konturerna (marken räknas
ändå med dem). Kända begränsningar: stödmuren är bara ett språng i marken,
inget eget objekt (0.10.5); jorden ritas också under huset; konturerna
ritas bara som rektanglar med verktyget (Lägg till punkt i Modifiera ger
andra former).*

### 0.10.5 Markobjekt del 2 och byggnadshöjd

Stor.

- **Ramp och gångväg**: mittlinje med bredd och höjder i ändarna eller en
  lutning; sidorna möter marken med slänt eller mur; lutningspil med
  *1:12*; varning när en gräns som ställts in i projektet överskrids (som
  projektvinklarna). Gränserna kontrolleras mot BBR innan de blir förval
- **Infart**: som rampen, bredare och med tvärfall
- **Höjdpunkt och brytlinje**: låser marken i en punkt eller längs en linje
- **Stödmur** som eget objekt längs en linje
- Byggnadshöjd enligt PBF: från medelmarknivån till där fasadlivet skär
  takets översida (för tak brantare än 45° med 45°-planet); `roofBody` har
  översidan. Kontrolleras mot PBF 1 kap. 3 § och Boverkets vägledning
  (takutsprång, beräkningsgrundande fasad) innan den byggs. Nivåmarkör *BH*
- *Upp till taket* är kvar (Carl August 26 oktober); fråga kvar om den går
  före ett bjälklag som täcker väggen

*Byggd (26 oktober) i en session, samma format (18): nya sorter av
`Ground` och valfria parametrar. Testerna: 481 → 491 på ca 11 s. Claudes
val: **Byggnadshöjden** följer PBF 1 kap. 3 § (kontrollerad på lagen.nu):
från medelmarknivån invid byggnaden till skärningen mellan fasadplanet och
ett plan som lutar 45° inåt och berör takets ovansida. Den räknas för
varje fasad i husets kontur som det största z − d över takkroppens
ovansida (d = avståndet inåt från fasaden), så ett flackt tak berörs vid
takfotens yttre kant och språnget höjer byggnadshöjden med sitt mått,
ett tak brantare än 45° vid nocken. Bara taket framför fasaden räknas
(mellan dess ändar, och utanför den bara det som inte står över huset,
högst 3 m ut). **Den beräkningsgrundande fasaden är den längsta** (bland
lika långa den högsta), som oftast är en långsida; en gavel skulle ge
nockens höjd. Undantagen (kupor och frontespiser under en tredjedel av
takfoten, allmän plats närmare än 6 m, en annan beräkningsgrundande
fasad) bedöms för hand och står i dialogen. Boverkets *treplansmodell*
(2016:30) är ett förslag och används inte. Nivåmarkören **BH** i fasader
och sektioner (Visa, Markörer, *Byggnadshöjd*), också utan markmodell;
värdet och fasadens väderstreck i dialogen *Platsen*. **Ramp, gångväg och
infart** är en sort (`path`) med mittlinje (polylinje), bredd (ramp 1 500,
gångväg 1 200, infart 3 000) och höjd i början och slutet, ur den
befintliga marken när den ritas; fältet *Lutning* ändrar höjden i slutet.
Tvärfall 1:N (positivt faller åt höger i linjens riktning; infarten 1:50
från början). Sidorna och ändarna möter marken med slänt eller stödmur.
Planen: konturen, pilen nedför mittlinjen med *Ramp 1:12* och höjderna i
ändarna; en varning (accentfärg och *!* i planen, raden i egenskaperna)
när en ramp är brantare än 1:12 eller går mer än 0,5 m utan vilplan, och
när en gångväg är brantare än 1:20. Värdena kommer ur Boverkets regler om
tillgänglighet (ALM, BBR) via Göteborgs tekniska handbok; paragrafen
kunde inte läsas, så de ska kontrolleras. De går att ändra under
*Platsen*. Vilplan ritas genom att dela rampen i flera. **Höjdpunkt och
brytlinje** låser marken (brytlinjen rakt mellan höjderna i ändarna) och
tonar marken runt omkring mot dem inom 5 m (vikten en S-kurva), ett nytt
sätt i den färdiga marken; de följer ritordningen som de andra.
**Stödmuren** är en linje med tjocklek (200): slänterna och
utjämningen går inte över den, så att marken bakom är orörd. Krönet är
den högre sidans högsta mark längs muren plus *Över marken* (0), eller en
egen höjd; foten 300 under den lägre sidans lägsta. Planen: fylld svart
med tjock kontur; 3D, fasader och sektioner: en kropp. Linjerna ändras med
punkterna i Modifiera som en öppen 2D-linje (bågar går inte). Provat med
Playwright mot `dist/` med en egen kuperad platsfil i exempelvillan;
klickjämförelsen kördes inte. Kända begränsningar: rutnätet (1 m) är
grovt för en smal ramp; krönet är vågrätt längs hela muren; murens
ändar möter inte marken med slänt; byggnadshöjden räknas för hela huset,
inte per byggnadskropp.*

### 0.10.6 Granskning

Efter marken, som är ny och tung geometri.

*Byggd (26 oktober), samma format (18), utan nya funktioner. Testerna:
491 → 501, ca 16 s (20 s med 0.10.5 i samma sandlåda). Skyddet först,
skrivet med 0.10.5: testprojektet `groundProject` (exempelvillan på en
kuperad plats, vriden 10°, med alla sorters markobjekt, ett träd och ett
grannhus) med referensritningar för planen, Befintligt, sektionen,
fasaderna och 3D, och den färdiga marken som siffror (höjderna där den
ändrats, schakt och fyll per objekt, medelmarknivån, byggnadshöjden och
stödmurens krön). Klickjämförelsen har 288 steg (platsen släpps på
planen, verktyget Mark i alla sätt, egenskaperna för varje sort, dialogen
*Platsen*, en innerväggs höjd). Samma klick i 0.10.5 och 0.10.6 ger samma
läge och bild, och 3D-vyn samma bild. I klickjämförelsen upprepades nya id
efter några hundra (den fasta följden tog de låga bitarna), så att ett
nytt markobjekt kunde ersätta ett annat; rättat. **Det som räknades om i
onödan**, mätt på en brant plats 200 × 150 m med 0,5 m mellan noderna och
tio markobjekt: varje ändrad vägg (också en innervägg, en väggs höjd eller
penna) räknade om hela den färdiga marken, eftersom husets kontur blev ett
nytt objekt; nu jämförs den till värdet (208 → under 4 ms). Kurvavståndet
och jorden i sektionerna räknade också om den, eftersom platsen byts som
objekt (ca 200 → 0,2 ms). Ett ändrat markobjekt räknade om alla; nu
börjar räkningen vid objektet, så att den sista brytlinjen tar 22 ms i
stället för 208 och den tredje platån 141 i stället för 230.
Höjdkurvornas linjer i planen byggdes om när en vägg ändrades (nu
sparade), så att planen efter en ändrad innervägg tar 18 ms i stället för
338. 3D-nätet byggdes om helt för varje ny färdig mark; nu byts bara
höjderna (44 → 4,5 ms). I Chromium blir en ändrad innervägg på den platsen
färdig i planen på ca 177 ms i stället för 308. Koden: `ground.ts` 497 →
61 rader (formerna och den färdiga marken i `groundGeometry.ts`,
ritningen i `groundPlan.ts`). Testerna för 0.10.4 och 0.10.5 i en fil
(`mark.test.ts`), den sneda marken en gång (`slopeSite` i
`tests/projekt.ts`, också för platstestet), och provet av att den färdiga
marken ritas tjock i planen och sektionen ersatt av referensritningarna.
Mätt men lämnat: fasader och sektioner byggs om helt vid varje ändring i
projektet, också av ett markobjekt (ca 20–60 ms per vy i exempelvillan,
lika med och utan mark); på en brant plats ändrar ett objekt stora ytor
(40 000 noder för urgrävningen under plattan) och varje ändrad nod kostar
1–3 µs; den färdiga markens höjdkurvor räknas för hela området som
markobjekten ändrat (ca 70–100 ms på den branta platsen).*

### 0.10.7 Markobjekt del 3 · *nytt format*

Carl Augusts synpunkter 26 oktober, efter 0.10.5. Marken togs före de
dolda linjerna, medan den är färsk (Carl August 26 oktober).

- Felen: höjdpunkten (och vägar, brytlinjer och stödmurar) gick inte att
  flytta; *Avrunda* på en ramp eller brytlinje gav fler raka bitar
- Ramp, gångväg och infart blir en sort, *Ramp/väg*, med namn och en egen
  gräns för lutningen
- Platå och urgrävning blir en sort, *Markyta*: schakt där marken ligger
  högre, fyll där den ligger lägre, också i samma objekt
- Vägens referenslinje syns, i mitten eller på en kant, med förskjutning
- Tvärlinjen i vägens början och slut går att slå av
- Linjetyp, penna och fyllning för markobjekten; alla går att låsa

*Byggd (26 oktober), format 19. Testerna: 501 → 504, ca 12 s. **Felen:**
`movePatch` flyttade konturen men inte `line`, så att alla markobjekt
längs en linje stod kvar när de flyttades (med Flytta, dragning eller
pilarna); nu följer linjen med. Markobjektens linjer är 2D-former utan
bågar (`noArcs`, `allowsArcs`): Böj och Avrunda finns inte i Modifiera
förrän bågarna kommer (0.10.19, förut 0.10.16, 0.10.17 och 0.10.18), Fasa finns kvar. **Ramp/väg**
(`kind: 'path'` utan `path`): förvald bredd 1 500, tvärfall bara när det
anges (förvalet 1:50 för infarten är borta), varning när den är brantare
än sin gräns (`maxSlope`, förval *Brantaste ramp/väg* 1:12 under
*Platsen*) och, när den är brantare än *Vilplan brantare än* (1:20), när
höjdskillnaden är mer än 0,5 m. Namnet (*Ramp*, *Infart* …) står i
planen i stället för *Ramp/väg*. **Markyta** (`kind: 'area'`): tar ned
och fyller som platån gjorde; urgrävningen under bjälklaget tar
fortfarande bara ned (grunden). Planen: heldragen kontur; den ritade
urgrävningen var streckad, nu bara den under bjälklaget. **Referenslinjen**
är den ritade linjen; vägens mitt ligger `centerShift` från den (vänster
kant: vägen till höger; förskjutningen positiv utåt från vägen, negativ
mot mitten, och i mitten positiv åt vänster). Höjden, tvärfallet och
lutningen räknas längs mitten. Den ritas blå och tunn som takets och
väggarnas när vägen är markerad, i planen och i 3D (med höjden längs
linjen); som fast linje på papperet behövs den inte. **Tvärlinjerna**:
vägen ritas som två sidor och två ändar (`kant`, `början`, `slutet`), och
`startLine`/`endLine` false släcker en ände. **Penna**: `Ground` i
`OWN_PEN_TYPES` (tjocklek, färg och linjetyp gäller linjerna och
konturerna, inte texterna och stödmurens fyllning); **fyllning**:
2D-formens fält (`d2:`) för markytor och vägar, ritad bakom väggarna och
släckt med *Fyllningar* i Visa; **lås**: `Ground` i `LOCKABLE`. Format 19
eftersom sorterna `plateau`, `excavation` och `path` (ramp, walk, drive)
är borta; äldre filer får meddelandet. Provat med Playwright mot `dist/`
med `groundProject` (dra höjdpunkten, rampens egenskaper, referenslinjen i
planen och 3D, smartmenyn på gångvägens hörn, lås och dragning).
Klickjämförelsen (293 steg, nya steg för namn, referenslinje,
förskjutning, tvärlinje, gräns och lås) kördes mot 0.10.7 utan fel;
mot 0.10.6 går den inte, eftersom verktygets knappar är andra.
Referensritningarna `mark-plan` och `mark-siffror` ändrades med avsikt
(namnen, rampens referenslinje på vänster kant, gångvägen utan
tvärlinje i slutet och med skraffering).*

### 0.10.8 Marken i ritningarna

Carl Augusts synpunkter och svar 26 oktober. Mellanstor; delad i två
(Carl August 26 oktober): höjderna i fasaden i 0.10.8b.

- Höjdkurvor och marklinje som inte ändrats ritas heldragna; streckat bara
  den tidigare marken där den ändrats
- Halvmeterskurvorna tunnare än helmeterskurvorna
- Höjdkurvor i 3D-vyn
- Släntmarkeringar i planen (långa och korta streck nedför slänten)
- Flera lutningspilar när fallet varierar mycket
- Jorden i sektionerna med skraffering eller bara vit bakgrund
- ±0 med ett klick på topografin, ändras efteråt
- Licenstexten som fältet `{licens}`

*Byggd (26 oktober), samma format (19). Testerna: 504 → 508, ca 13 s.
**Höjdkurvorna** (`groundContours` i `elements/site.ts`): `solid` är den
befintliga marken utanför de ändrade rutorna och den färdiga innanför,
`old` den befintliga innanför. En ruta är ändrad när någon av dess fyra
noder skiljer sig mer än 10 mm (`changedCells`); varje sträcka i en kurva
går genom en ruta och delas efter sin mitt. Heldragna 0,25 (hela meter)
och 0,13 (halvmeter, förut 0,25 och 0,18 i grått streckat); den gamla
grå och streckad 0,18/0,13 som förut. I Befintligt är allt heldraget,
och marklinjen i fasader och sektioner också (0,5, förut tunn och
streckad). **3D**: samma kurvor som sträckor 40 mm över marken
(`contourSegments3d`, `setTerrain` med en andra parameter), mörka och
halvgenomskinliga; *Höjdkurvor i 3D-vyn* under Visa, Platsen
(`contours3d`). **Släntmarkeringar** (`slopeMarks` i `groundPlan.ts`):
för markobjekt med slänt (inte stödmur eller utjämning), från ringens
kanter (inte husets hål) var 2,5 mm på papperet: gå ut längs normalen i
steg om en tredjedels ruta så länge den färdiga marken skiljer sig från
den befintliga (15 mm) och lutar minst hälften så brant som slänten.
Schakt (den färdiga lägre) har krönet ute, fyll vid kanten; långa och
korta (40 %) om vartannat; i utåtgående hörn en solfjäder lika tät som
kanten 1,5 m ut. Jämförs med den färdiga marken efter alla objekt, så
ett objekt som fylls igen av ett senare får inga streck. `Ground` läser
`Ground` (`planReads`), eftersom strecken beror på de andra
markobjekten. **Fallet** runt huset: en pil per fasad längre än 3 m, mitt
på markytan, med *1:20*; en markyta är plan och har en pil som förut.
**Jorden**: `site.earthWhite` (vit fyllning, `paper`) bredvid
`earthHatch`; en valfri parameter, inget nytt format. **±0**: *Klicka i
planen* i dialogen *Platsen* sätter ett tillfälligt verktyg; klicket
läser den befintliga marken (`groundAt`), avrundar till cm och öppnar
dialogen igen med värdet ifyllt (inte sparat). Esc avbryter. Andra
ändringar i dialogen sparas inte när man klickar i planen. **`{licens}`**
i `BUILT_IN` och `smartVars` (`doc.site.licence`). Referensritningarna
`mark-plan` och `mark-plan-befintligt` ändrades med avsikt (kurvorna,
strecken och pilarna). Provat med Playwright mot `dist/` (planen,
3D-vyn och ±0). Klickjämförelsen kördes inte (bara ritningen av marken
är ändrad, och den ändras med avsikt).*

### 0.10.8b Höjderna i fasaden ✓

Carl Augusts svar 26 oktober (fråga 19). Mellanstor.

- En linje i planen, *Beräkningsgrundande fasad*, längs fasadlivet; byggnadshöjden
  mäts mot den (finns ingen: den längsta fasaden, som nu)
- Byggnadshöjden utan språng: där fasadlivet möter takets överkant
  (0.10.5 räknar med PBF:s 45°-plan, språnget med)
- Kryssrutor per fasad för byggnadshöjd, nockhöjd och totalhöjd, från
  medelmarknivån
- Medelmarknivån (knappen för ±0) ur den nya marken, med den befintliga
  att jämföra

*Byggd (26 oktober), nytt format (20). Testerna: 508 → 510, ca 17–20 s.
Carl August sa "kör" på upplägget med Claudes val: nivåmarkören och måttet
visas båda, totalhöjden räknar det som syns i vyn (tak och väggar så
länge), och en beräkningsgrundande fasad per projekt (inte per
tillstånd). **Linjen** är objekttypen `BasisFacade` (`start`, `end`;
global och på alla våningar som fasadmarkörerna), ritad med Fasadverktygets
val *Beräkningsgrundande fasad* (två klick, ingen sida); en ny tar bort
den gamla i samma steg. Den ritas streckprickad 0,5 med texten utanför
huset. Byggnadshöjden mäts mot den närmaste fasaden i husets kontur som
är parallell inom 15° och vars sträcka linjens mitt ligger högst 1,5 m
från. **Utan språng**: 45°-planet räknas bara över huset (d ≥ 0); för ett
tak flackare än 45° blir det precis skärningen mellan fasadlivet och
takets ovansida, för ett brantare nocken (PBF). I exempelvillan sjönk BH
från +3,282 till +3,037. **Höjderna per linje** (`heights` på fasad- och
sektionsmarkörer: `bh`, `nh`, `th`, `mmnOld`); förvalet är BH i fasaden som
ser den beräkningsgrundande fasaden (blicken inom 45° mot fasadens
normal), inget annat. Kryssas en ruta sparas alla fyra. Måtten står 25 mm
(på papper) till höger om nivåmarkörerna, 7 mm isär: lodrätt streck med
snedstreck, texten längs strecket (*BH 3,04 m*). NH är takets högsta
ovansida, TH den högsta punkten i vyn (minst NH). *MMN bef.* blir en
egen nivåmarkör när den skiljer sig från MMN. Visa-valet *Byggnadshöjd*
döljer allt. **Platsen**: *Medelmarknivån* ur den nya marken (den
färdiga i förslaget som visas), *Befintlig* bredvid när den skiljer sig;
raden *Byggnadshöjd* säger beräkningsgrundande eller längsta och
nockhöjden. Provat med Playwright mot `dist/` (fasaderna, kryssrutorna,
verktyget, linjen i planen, Platsen). Klickjämförelsen kördes inte.*

### 0.10.9 Stödmur del 2 ✓

Carl Augusts synpunkt 26 oktober. Mellanstor.

- Referenslinje i mitten eller på en kant, med förskjutning
- Höjd över marken i början och slutet (t.ex. 700 och 900); krönet följer
  den utjämnade marken (medelvärdet av det den passerar)
- Fler kontrollpunkter, och höjdpunkter längs muren med *ÖK +65,765*

*Byggd (26 oktober), samma format (20). Testerna: 510 → 514, ca 10–13 s.
Carl August sa "kör" på upplägget, och ja till ett rakt krön som val.
Claudes val: **referenslinjen** som vägens (`refSide`, `refOffset`,
`centerShift` med tjockleken); den syns markerad med en pil i linjens
riktning, också i 3D. **Krönet** i ändarna är *Över marken* (`above`,
`endAbove`, mot den högre sidan) eller en egen ÖK (`height`,
`endHeight`; förut gällde `height` hela muren). Längs muren följer det
den högre sidans mark utjämnad med ett glidande medelvärde (±1 m), med
korrigeringen rakt mellan ankarna (ändarna och höjdpunkterna); med
*Rakt* (`straight`) går krönet rakt mellan ankarna. **Höjdpunkter**
(`crest`: punkt på referenslinjen och höjd) läggs med *Höjdpunkt på
krönet* i Modifiera (smartmenyn på murens linje) med krönets höjd där,
avrundad till 5 mm; höjden ändras och tas bort i egenskaperna. **Foten**
300 under den lägre sidans lägsta mark inom ±1 m. **Planen**: ÖK vid
ändarna (på vänster sida) och vid höjdpunkterna (på höger sida, med ett
streck tvärs över muren); texten *Stödmur +…* i mitten är borta.
**3D**: bitar på högst 0,5 m med lutande ovan- och undersida, slagna
ihop där krönet och foten går rakt (inom 5 mm), utan egna kanter;
kanterna (krönet, foten, ändarna och hörnen) levereras för sig med
fasadens tunna vy-penna, som förut. Spegling byter referenslinjens sida
(också för vägen, där det saknades). Provat med Playwright mot `dist/`
(planen, Modifiera, egenskaperna, 3D). Klickjämförelsen kördes inte.
Kända begränsningar: bitarna syns svagt som strimmor i 3D-vyn (som
konens); där en fasads djup slutar mitt i muren ritas ingen kant vid
gränsen (som för husets väggar); murens ändar möter fortfarande inte
marken med slänt.*

### 0.10.10 Dolda linjer och vyns djup ✓

Carl Augusts synpunkter 25 och 26 oktober. Mellanstor.

- Vyinställning i fasader: närmaste bjälklag och ytterväggarnas insida som
  streckade linjer genom fasaden
- Fasader och sektioner med ett största djup och en zon före det där allt
  ritas tonat (tunna grå linjer)
- Ett tak på våningen ovanför streckprickat i planen (över snittet), ett
  under vyn streckat, som vyinställning (svar 26 oktober, fråga 21)
- Ritordningen (bakom eller framför väggarna) också i fasader och
  sektioner (fråga 55)

*Byggd (27 oktober), samma format (20). Testerna: 514 → 518, ca 14 s.
Carl August sa "kör nästa version" utan att se upplägget; Claudes val
står här och som frågor till nästa session. **Dolda linjer**: två
Visa-val, släckta från början (`+hiddenSlabs`, `+hiddenWalls`), bara i
fasader. Alla bjälklagens kanter (inte bara det närmaste) ritas där de är
skymda, tunt streckade (0,13, *Streckad*), och linjer som ligger på
varandra slås ihop, så att fram- och bakkant blir en linje. Ytterväggarnas
insida är en lodrät linje i varje hörn av det som ligger innanför
ytterväggarna (de väggar som når husets utsida), från väggens fot till
krön; inga vågräta linjer (bjälklagen visar dem). Linjerna går inte att
klicka på. **Tonat från** (`toneDepth`, mm från linjen) bredvid *Djup*,
för fasader och sektioner: kanter bortom ritas 0,13 grå, oavsett penna;
snittet och det som skymmer är detsamma. **Tak på andra våningar**
(`+roofsAround`): alla tak syns i alla planer; det som ligger över
snitthöjden streckprickat (som förut), under våningens golv streckat.
**Ritordningen**: 2D-formernas *Fyllningen* och *Linjen* gäller också i
fasader och sektioner (*Bakom/Framför modellen*), med samma förval som i
planen: fyllningen bakom, linjen framför. Det ändrar fasader där en
fyllning förut låg över modellen (också en mask). Provat med Playwright
mot `dist/` (Visa-menyn, *Tonat från*). Klickjämförelsen kördes inte.
Inga referensritningar ändrades.*

### 0.10.11 Småsaker ✓

Synpunkter 25 och 26 oktober.

- Högerklick på planerna i modellfliken
- Visa-menyn i flera kolumner, så att allt syns samtidigt
- Snäppa mot kalkerunderlaget
- Hovring i 3D visar vad som väljs, som i planen; markobjekten går att
  markera i 3D
- Importerade träd, grannhus m.m. som befintligt eller förslag, och att ta
  bort dem helt
- Ingen skarv i fasaden mellan befintligt och nytt när fasadmaterialet är
  detsamma (svar 26 oktober, fråga 25)
- Takets snitthöjd 1100 från början, inte 1200 (fråga 20)
- Bjälklagets *Fasa* får förvalet 500 mm, som *Avrunda* (fråga 32)
- **-markör** för symbolerna i ritningen (Carl August 26 oktober):
  *nivåmarkör* i stället för nivåkota, *sektionsmarkör* och *fasadmarkör*
  i stället för sektions- och fasadlinje, och liknande (klart i 0.10.11). I gränssnittet
  (penntabellen, hjälptexter, verktygen, egenskaperna), i README och
  dokumenten; koden byter ord i kommentarerna

*Byggd (27 oktober), samma format (20). Testerna: 518 → 522, ca 13 s.
Carl August sa "kör" med Claudes val som frågor. **Högerklick på en
våning** (och ⋯ på raden): Visa, Inställningar, Byt namn, Ny våning
ovanför/under den våningen, Ta bort. **Visa-menyn**: inställningarna i en
kolumn till vänster, kategorierna i två (CSS-kolumner) till höger, 680 px
bred och flyttad eller smalare så att den ryms i ritytan. **Snäpp mot
kalkeringen**: linjerna, polylinjerna och ytornas kanter i det kalkerade
(utom `noPick`), sist i listan, alltid på när kalkeringen syns.
**Hovring i 3D**: en ljusare variant av markeringsfärgen, en gång per
bildruta, inte medan vyn dras. **Markobjekt i 3D**: strålen provas mot den
färdiga marken i steg, och objektet i punkten (det som ritas sist går
före) markeras; konturen ritas 60 mm över marken, heldragen markerad och
svagare hovrad. **Träd och grannhus** jämförs (`compares`, inte `global`)
och går att ta bort fast de är låsta (också kartobjekten; marken bara med
platsen); *Riv* och *Behåll* bland deras snabbknappar. Nya träd ritas som
befintliga (grå). **Skarven**: `joinStoreys` jämför inte längre åtgärden,
eftersom alla väggar har samma fasadmaterial tills material går att
välja. **Förvalen**: snitthöjd 1100, *Fasa* för hörn i bjälklag och
2D-former 500 (väggarnas *Fasa* är kvar på 600). **-markör** i
gränssnittet, README, dokumenten och kommentarerna; verktygen och vyerna
heter fortfarande *Sektion* och *Fasad*. Provat med Playwright mot
`dist/` (Visa-menyn, våningens meny, snäpp mot kalkeringen, hovring och
markobjekt i 3D). Klickjämförelsen kördes inte. Inga referensritningar
ändrades.*

### 0.10.12 Småjusteringar ✓

Carl Augusts svar 27 oktober (förmiddag), om 0.10.9–0.10.11. Små, före
granskningen. Versionerna efter 0.10.11 flyttades samtidigt fram ett steg:
inga b-versioner, nästa lediga nummer i stället.

- Låst betyder låst, också mot borttagning, för alla objekt; vill man ta
  bort låser man upp först
- Sektions- och fasadmarkören: vyn heter som nu *Sektion* och *Fasad*; en
  egen del *Markör* i egenskaperna med markörens stil
- *Fasa* 500 som förval överallt, också väggarnas hörn
- Snäpp mot kalkeringen som inställning, på från början
- Bjälklag bakom snittet streckade i sektioner, med en vyinställning
- Tak på andra våningar: våningen ovanför och alla under
- Stödmurens *Över marken* mot den högre sidan, eller den lägre

*Byggd (27 oktober), samma format (20). Testerna: 522 → 526, ca 18 s.
**Låst**: `deleteElements` tar aldrig bort ett låst objekt, inte heller
träd och grannhus (undantaget från 0.10.11 är borta) eller en vägg med en
låst dörr eller ett låst fönster i sig. En blandad markering tar bort det
olåsta; de låsta står kvar markerade och ett meddelande säger att de måste
låsas upp. Låset finns nu i egenskaperna för alla objekt (förut bara
2D-former, text, mått, markörer, underlag och markobjekt), utom marken och
kartan, som tas bort med platsen. **Riv** och *Finns i* fungerar på låsta
objekt (de ändrar status, inte läget; träden importeras låsta och rivs
så), och en våning som tas bort tar med sina låsta objekt efter frågan.
**Markör**: delen *Sektion*/*Fasad* har vyns namn, djup, *Tonat från*,
höjderna och *Öppna*; delen *Markör* har beteckningen, längden, vinkeln,
*Rikta efter objekt*, *Vänd blickriktningen*, pennan (tjocklek, färg,
linjetyp) och *Lås*. Pennan är stilmallens för sektions- respektive
fasadmarkörer och gäller alla i projektet, som i stilmallen; en egen
penna per markör har inte byggts. **Snäpp mot kalkeringen**: i
Inställningar (Planen) och i planens högerklicksmeny under *Snäppning*;
sparas i webbläsaren. **Bjälklag bakom snittet** (`hiddenSlabsSection`):
**på** från början i sektioner (i fasaderna är de släckta från början),
släcks under Visa; ett snittat bjälklag får inga streckade linjer. **Tak
på andra våningar**: våningen närmast ovanför och alla under. **Stödmuren**:
*Över marken mot* Den högre sidan (förval) eller Den lägre; krönet längs
muren följer då den lägre sidans mark. Provat med Playwright mot `dist/`
(Delete på en låst vägg, *Markör*, högerklicksmenyn). Klickjämförelsen
kördes inte. Inga referensritningar ändrades.*

### Granskning efter 0.10.12 ✓

Enligt planen (förra var 0.10.6). Inget eget versionsnummer (Carl August
27 oktober: nästa lediga nummer, och granskningen har inga nya
funktioner); appen heter fortfarande 0.10.12.

- Dela stora filer: `view3d.ts` först, sedan de som vuxit
- Gå igenom testerna: dubbletter, det som låser detaljer, under en minut
- Leta efter långsam kod
- Klickjämförelsen med nya steg för 0.10.11 och 0.10.12

*Gjord (27 oktober), samma format (20). Testerna: 526 → 524, ca 14–18 s.
**Filerna**: `view3d.ts` 790 → 464 rader (dragningen och greppen i
`edit3d.ts`, klippningen, snittytorna, markträffen och kropparna i
`geometry3d.ts`); `selectionFields.ts` 389 → 266 (markörernas fält i
`markerFields.ts`, måttens, textens, skalstockens och stämpelns i
`annotationFields.ts`, `numberField` och `textField` i `fieldMarkup.ts`);
`propertiesPanel.ts` 614 → 434 (knapparna i `selectionActions.ts`);
`section.ts` 431 → 302 (linjerna, det som skymmer dem och de dolda i
`sectionLines.ts`); `commands.ts` 625 → 310 (flytta och vända i
`moveCommands.ts`). Allt exporteras vidare från de gamla filerna, så
inget annat ändrades. **Testerna**: fyra som prövade samma sak är
ihopslagna eller kortade (skarven mellan våningarna befintligt mot nytt,
tak på andra våningar, låst mot borttagning, byggnadshöjden i fasaden).
Hela körningen är långt under en minut; snäpptestet från 0.8.3 (1,2 s)
står kvar med sina 120 punkter. **Långsam kod**: inget nytt som växer med
kvadraten. En fasad eller sektion tar 11–25 ms i exempelvillan på den
kuperade platsen efter en ändring, med eller utan markobjekt; 3D-formerna
byggs om vid varje ändring (inga är samma objekt efter ett ändrat
markobjekt), så linjerna kan inte sparas förrän formerna för oförändrade
objekt blir desamma. Det är lämnat (en egen, mellanstor uppgift, inte
före piloten om det inte märks). Ytterväggarnas insida tar 36 ms för ett
rutnät av 12 × 12 rum och 129 ms för 24 × 24. **Klickjämförelsen** har
347 steg (54 nya efter `slut`: våningens meny, Visa-menyn, snäpp mot
kalkeringen av och på, låst mot borttagning, delen *Markör* med pennan,
stödmurens *Över marken mot*, bjälklag bakom snittet, och 3D-vyn med
hovring, klick på vägg och mark, grepp, flytt och *Följ sektionen*, med en
bild av 3D-vyn efter varje steg). Samma klick i 0.10.12 före och efter
granskningen ger samma läge, ritning och 3D-bild i alla 347 steg. Mot
0.10.10 (de 293 stegen till och med `slut`) skiljer sig bara det som
0.10.11 och 0.10.12 ändrade med avsikt: orden i stilmallen (-markör),
*Lås* i egenskaperna för alla objekt, Visa-menyns kolumner, snitthöjden
1100 (takets snitt på plan 2), ingen skarv mellan befintligt och nytt
mellan våningarna (gaveln i fasad 2), och snäpp mot kalkeringen: hörnen
i bjälklaget som ritas på plan 2 snäpper mot en kalkerad 2D-form på plan 1
(y 0 i stället för 200), vilket följer med i projektet till slutet.*

### 0.10.13 Höjder i förhållande till våningen ✓

Synpunkt 25 oktober. Mellanstor.

- En minus- eller plusnivå i förhållande till våningen för bjälklag,
  väggar, objekt m.m.
- Takets höjd gäller referenslinjen, och man väljer om den ligger mot
  takets översida eller undersida (fråga 26). Lutningsriktningen, *Vänd
  lutningen* och radiens tecken som nu
- Stödmurens höjdpunkter: höjden skrivs när punkten klickas ut, och
  punkten dras längs muren (27 oktober)
- BH, NH och TH i fasaden flyttas för hand (27 oktober)
- Ur Inkorgen 27 oktober: netto och andel berg för markobjekten

*Byggd 27 oktober, samma format (20; nya valfria parametrar). Carl
Augusts svar: en vägg vars nivå ändras i egenskaperna flyttar bara foten
(toppen ligger kvar), medan en flyttning flyttar hela väggen; takets
referenslinje mot undersidan från början. Claudes val: **nivån** heter
`level` (mm från våningens golv) och finns för väggar (foten; fältet *Fot
mot våningen*), bjälklag (ovansidan) och möbler (undersidan). Väggens
höjd räknas från foten, så toppen är `level + height`; dörrar och fönster
lyfts med väggens fot (bröstningen räknas från foten). Bjälklag kapar
bara väggar vars fot ligger under dem. **Flytta i höjd** är ett nytt val
i Modifiera för det markerade (väggar, bjälklag, möbler och tak, inte
låsta), med ett värde som skrivs in; det fanns ingen lodrät flytt förut.
Takets *Höjden gäller* fanns redan (sedan 0.10), med undersidan som
förval: inget ändrat. **Höjdpunkten** på stödmuren är inte längre ett
direktval: värdefältet föreslår krönets höjd där man klickade (i meter
RH 2000 med plats, annars mm) och Enter eller ett klick lägger punkten.
Punkterna har romber på referenslinjen när muren är markerad, och dras
längs linjen (minst 100 mm från ändarna); höjden följer med. **BH, NH och
TH** får en ruta i måttets överände i den öppna fasaden eller sektionen
och dras i sidled; flyttningen från förvalet sparas på markören
(`heightOffsets`), så den följer med när huset ändras. Måttens delar heter
nu `höjd-bh`, `höjd-nh` och `höjd-th`. **Massorna**: netto = fyll −
schakt, och *Berg i schakten* (`rock`, procent) delar schakten i berg och
jord. Inte gjort: en vägg vars fot ligger över planens snitthöjd ritas
fortfarande som snittad i planen; klickjämförelsen har inga nya steg.*

### 0.10.14 Fyllningar och opacitet ✓

Inkorgen 27 oktober. En gemensam mall för alla objekt med fyllning, med
så många egenskaper som möjligt.

- Tre sorter: **Solid** (färg, opacitet i tio steg eller skriven),
  **Mask** (solid med pappersbakgrund, opacitet ur en lista) och
  **Mönster** (mönstret, förgrundens penna och opacitet, bakgrundens färg
  och opacitet), med förslagsbubblor under varje
- Samma kontroller för markobjekten (också slänterna för sig), 2D-former
  och rum
- Det som tidigare frågats: fyllningens bakgrund och sparade fyllningar i
  stilmallen (fråga 52 och 56), masken och rutnätet (51), mönstrets mått i
  papper eller verkligheten och utgångspunkt (45)
- Ur svaren 27 oktober: fönstrets bröstning från våningens golv med ett
  val att följa väggens fot, och Flytta i höjd från kommandoraden

*Byggd 27 oktober, samma format (20; nya valfria parametrar). Carl
Augusts svar (Claudes val, godkända): mönstrets mått på papper eller i
verkligheten per objekt, med förvalet från fyllningstypen, och mönstret
utgår från objektets första hörn; masken döljer rutnätet på skärmen som
förut; sparade fyllningar i stilmallen **kopplas** till objekten, och ett
ändrat fält gör fyllningen objektets egen; kryssrutan *Samma för linje och
fyllning* är borta, fyllningen har alltid sin egen opacitet; det som ligger
över snittet blir en egen version, 0.10.16. Hans svar om höjderna: fönster
följer våningens golv som förval men kan följa väggens fot (dörrar följer
foten); `M Z -500` flyttar det markerade i höjd. Claudes val: lägena heter
Ingen, Solid, Mask och Mönster; opaciteten i tio knappar (10–100) och ett
skrivet fält, för masken en lista (100, 75, 50, 25); förslagen är Vit,
Ljusgrå, Grå 50 %, Gräs, Grus, Hårdgjort och Vatten (Solid), hel och halv
mask, och Skraffering, Tät skraffering, Kors, Tegel, Betong, Plattor 300
och Mark (Mönster). Mönstrets penna är ny (förval 0,13 eller typens).
Bakgrunden är en lista (ingen, mask, egen färg) i stället för en
kryssruta. En sparad fyllning sparas med *Spara i stilmallen…*; samma namn
skriver över den. Kopplade objekt har en kopia av fälten, så att de ser
likadana ut när den sparade tas bort. Slänternas fyllning täcker ytan som
släntstrecken går över (känns av med halva strecktätheten), bakom
objektets egen. Kommandoraden tar också `FZ -500`, `MZ -500` och `Z -500`
medan Flytta pågår. Inte gjort: fyllning per status och gradient för
slänter (Claudes förslag; efter piloten om de behövs), sparade fyllningar
i stilmallens dialog (de sparas och tas bort från panelen); egna `.pat`
läses som förut som fyllningstyper i stilmallen.*

### 0.10.15 Visa och dölja ✓

- Väggar m.m. var för sig under Visa; dölja ett objekt eller en typ med
  högerklick, sparat i vyn
- *Tonat från* ställs in med ett grepp när vyn är markerad i planen (27
  oktober)
- Kryssrutor för om markobjektens linjer och släntmarkeringarna syns i 3D
  (Inkorgen 27 oktober)

*Byggd 27 oktober, samma format (20). Carl August hoppade över frågorna
den här gången. Claudes val: väggar, dörrar och fönster fick egna
kryssrutor under Modell (de andra typerna fanns redan); dörrar och
fönster följer väggen när den döljs; det dolda ritas inte, men räknas med
i väggarnas skarvar, rummens konturer, bjälklag ur väggarna och
numreringen (gäller också typerna som kunde döljas förut); högerklick
har *Dölj i vyn* och *Dölj alla …* (typer med en egen kryssruta), inte på
blad; de enskilt dolda tas fram alla på en gång med *Visa dolda objekt*
under Visa och i planens högerklicksmeny (inte ett och ett); greppet för
*Tonat från* är en romb en bit från mitten, streckad utan värde (då vid
djupet eller 4 m ut), och djupet får ett fyrkantigt grepp i mitten när
det är satt; närmare linjen än 100 mm blir inget; bara i planen och för
en ensam olåst markör; linjerna i 3D är släckta från början och ligger
under Visa → Platsen, konturerna mörka och släntstrecken halvt
genomskinliga. Inte gjort: dölja i 3D-vyn och planen för sig (det dolda
gäller vyn, och 3D följer vyn som förut); ett och ett tillbaka.*

### Granskning efter 0.10.15 ✓ (0.10.15.1)

Enligt planen (förra var efter 0.10.12). Två småfel ur Inkorgen 27 oktober
gör att något syns, så den heter 0.10.15.1 (Carl August 27 oktober).

- Markobjektens start- och ändmarkering i 3D följer planen
- Maskens opacitet i samma tio steg som de andra lägena, och skriven
- Dela stora filer: `selectTool.ts`, `showMenu.ts` och det som vuxit
- Gå igenom testerna och leta efter långsam kod
- Klickjämförelsen med steg för 0.10.13–0.10.15

*Gjord 27 oktober, samma format (20). Testerna: 542, ca 14 s.
**Småfelen**: 3D-vyns konturer för vägar (`groundLines3d`) tar kanterna
och tvärlinjerna ur planen (delarna `kant`, `början` och `slutet`), så en
avslagen tvärlinje (`startLine`, `endLine`) syns inte i 3D heller; andra
markobjekt har konturen som förut. Masken har knapparna 10–100 och ett
skrivet fält som Solid (`MASK_STEPS` är borta). **Filerna**:
`selectTool.ts` 682 → 445 rader (greppen utöver väggändarna, med
dragningen, skrivningen och ritningen, i `selectDrags.ts` som en typ
`GripDrag`); `showMenu.ts` 368 → 204 (det som kan tändas och släckas,
`SHOW_GROUPS`, `isShown` och `setShown`, i `showKeys.ts`, och skärmskalan
i statusraden i `scalePop.ts`); `drawing2d.ts` 515 → 354 (fyllningen,
`FillParams` som eget gränssnitt och `fillPrims`, i `fill2d.ts`, som
`drawing2d.ts` exporterar vidare); `blad.css` 528 → 324 (mönstren och
fyllningens panel i `fyllningar.css`, direkt efter i kaskaden). En sak
rättad på vägen: Markera glömde höjdpunkten, djupet och höjdmåttet när en
dragning avbröts (verktygsbyte, avbruten pekare), så att nästa släpp kunde
gå till dem. **Testerna**: inga dubbletter bland de nya; hela körningen
14 s. **Långsam kod**: inget nytt som växer med kvadraten. Linjerna i 3D
tar 4–7 ms för exempelvillan på den kuperade platsen (konturerna) och
6–10 ms med släntstrecken efter en ändring. Fasader och sektioner byggs
fortfarande om helt vid varje ändring (lämnat, se granskningen efter
0.10.12). **Klickjämförelsen** har 396 steg (50 nya efter 3D-stegen: Fot
mot våningen, Flytta i höjd med `M Z`, stödmurens höjdpunkt, en 2D-forms
punkt och bildens hörn som dras, med ett steg mitt i varje dragning,
fyllningens lägen, förslag, mask, sparad och kopplad fyllning, slänternas
fyllning, Dölj i vyn, Dölj alla möbler, Visa dolda objekt, greppet för
Tonat från, BH-måttet i fasaden och linjerna i 3D). Kryssrutorna under
Visa klickas nu (`__set` ändrade bara rutan, så stegen gjorde ingenting
förut), och de gamla stegen för 2D-formens fyllning följer panelen från
0.10.14. Samma klick i 0.10.15 och 0.10.15.1 skiljer bara i maskens panel
(tre steg) och rampens tvärlinje i början i 3D-bilden (två steg).*

### 0.10.16 Snittet i planen ✓

Carl Augusts svar 27 oktober (fråga om väggar över snittet efter 0.10.13).

- Objekten ritas "smart" mot planens snitthöjd (1100): snittyta bara där
  objektet skär snittet, delar under snittet som vanliga vylinjer och
  delar över snittet som sticker ut utanför det snittade streckprickat
- Gäller väggar vars fot ligger över snittet eller vars topp ligger under
  det, stödmurar och andra objekt som varierar i höjd
- Dubbelklick på Visa-knappen visar allt i vyn (Inkorgen 27 oktober)

*Byggd 27 oktober, samma format (20). Carl Augusts svar (frågorna i
början): bjälklag, möbler, tak och väggar följer snittet, och pelare och
profiler när de finns (0.11.1); väggarna ska kunna luta (en egen version,
0.10.21); pennan ställs in per objekttyp i stilmallen, med en egen per
objekt. Claudes val: zonerna är tre (genom, helt under, helt över; ett
objekt som bara rör snittet är snittat); en vägg under snittet ritas som
kontur med vyns penna utan fyllning, över snittet streckprickad och bara
där den sticker ut utanför de snittade väggarna; dörrar och fönster som
inte går genom snittet tar inget hål i väggen och ritas som hålets två
kanter (och glaset), streckprickat över och med vyns penna under (t.ex.
källarfönster); ett bjälklag genom snittet är en snittyta med väggens
fyllning, över snittet streckprickat utan kryss i håltagningarna; möbler
över snittet streckprickade (en möbel genom snittet ritas som förut, som
symbol); stödmurar delas längs muren där krönet går genom snitthöjden;
taken som förut men med stilmallens pennor. Pennorna: elva rader under
*Snittet i planen* i stilmallen (över och under för väggar, dörrar och
fönster, bjälklag, tak och stödmurar; över för möbler), det över 0,13
eller 0,18 punktstreckat; den egna pennan har en tredje del, *Över snittet
i planen*, som utan värden följer objektets övre del. Bjälklag kan få en
egen penna. Dubbelklick på Visa tänder allt utom det som är släckt från
början (husets kontur genom taket, tak på andra våningar, de dolda
linjerna i fasader och linjerna i 3D) och tar fram de dolda objekten;
detaljnivåerna ändras inte. Märks i hans ritningar: en låg stödmur (krön
under 1100 över våningens golv) ritas som kontur, inte skrafferad; en
vägg vars fot ligger över snittet är inte längre snittad.*

### 0.10.17 Linjerna i 2D-formen ✓

- Fortsätta och sluta en linje med ändpunkterna; Förskjut flera kanter;
  foga ihop linjer
- Ett klick mitt på en linje startar det senast använda verktyget
- Takets kontur med bågar direkt i verktyget (fråga 29); håltagningen i
  bjälklaget som en cirkel direkt (fråga 34)
- Ett markerat hål i bjälklaget ändras (flyttas, formas om, vrids,
  speglas) utan att bjälklaget påverkas (fråga 31)
- Referens- och konturlinjernas punkter (t.ex. takets kontur) syns som
  riktiga punkter när objektet är markerat (Inkorgen 27 oktober)

*Byggd 27 oktober (kväll), samma format (20). Carl August hoppade över
frågorna. Claudes val: **Rita vidare** gäller alla öppna linjer och
splines i vyn, inte bara de markerade (de markerade går före när två ändar
ligger i samma punkt; Ctrl+klick börjar en ny linje som förut); ett klick
på ena änden och sedan den andra sluter linjen utan nya punkter (det var
felet: utan nya punkter gjordes ingenting). **Förskjut** har *Kanter* (1,
3, 5, Alla) bredvid avståndet i smartmenyn och verktygsraden, kvar till
nästa gång; kanterna väljs symmetriskt kring den klickade (runt en sluten
form, till ändarna i en öppen); vänster sett längs varje kant, så alla
kanter i en sluten form går åt samma håll; hörnen räknas om där kanterna
möts (en förskjuten kant och en kvar som förut); en båge förskjuts med sin
tangent i hörnen och behåller sin vinkel (Förskjut finns nu också på
bågar); en kant får inte vända och ytan inte klappa ihop. Samma *Kanter*
för bjälklagets och markytans kontur. **Foga ihop** är en egen knapp i
raden (Shift+V, ikon två linjer och en punkt), också i smartmenyn när
minst två öppna linjer är markerade; linjer och splines fogas var för sig,
ändar inom 1 mm räknas som samma, den första i markeringen behåller penna
och id, ändformerna sitter kvar i kedjans ändar, och en kedja som slutar
där den började blir sluten. **Klick mitt på en kant** (inte väggar)
startar det som senast valts på en kant (Lägg till punkt, Böj, Förskjut
…), inte val som utförs direkt (Räta ut); första gången visas bara
smartmenyn. Läst som en önskan; säg till om det var ett fel du ville bli
av med. **Bågar** i takets kontur och håltagningens polygon: *Båge*
(knapp, G) gör nästa kant till en båge, med slutet och en punkt på bågen
(som 2D-formens båge); ett klick på första punkten med Båge på sluter med
en båge; Enter och Klar sluter med en rak kant (Enter slöt inte takets
kontur förut). Bågar i 2D-verktygets linje (fråga 59) är inte gjort.
**Bjälklaget** ritas som rektangel eller polygon (utan bågar, konturen har
inga), håltagningen som rektangel, polygon eller cirkel. **Hålet för sig**:
Vrid hålet och Spegla hålet bredvid Flytta hålet och Ta bort hålet, kring
punkten man klickade på; Flytta, Vrid och Spegla i raden gäller hålet när
man klickat på det; att forma om (punkterna, Avrunda …) fanns redan. Ett
klick inne i hålet markerar inte hålet (det träffar inget). **Punkterna**:
takets och bjälklagets kontur hade dem redan; markobjektens linjer (väg,
ramp, stödmur) får dem nu. Inte gjort: klickjämförelsen har inga steg för
0.10.16–0.10.17 än (läggs till i granskningen).*

### 0.10.18 Rampens referenslinje ✓

Inkorgen 27 oktober. Den gamla 0.10.18 delades, eftersom rampen fick
många nya önskemål (Carl August 27 oktober).

- Referenslinjen lever sitt eget liv och styr lutningen i XYZ; sidornas
  linjer styr rampens utbredning i XY, så att bredden kan variera längs
  rampen (nu är det sidorna som är klickbara och styr referenslinjen)
- Höjden i början och slutet: två sorters kontrollpunkter med olika färg,
  vanliga för X och Y och en sort (oftast bara i ändarna) för XYZ
- Förlänga rampen med ett klick på första eller sista ändpunkten
- Stödmur eller slänt per sida
- Referenslinjens punkter syns som riktiga punkter när rampen är markerad

*Byggd (27 oktober, kväll), samma format (20). Carl August hoppade över
frågorna. Testerna: 558 → 569 på ca 13 s. Claudes val: **referenslinjen
styr höjden och tvärfallet**: höjden räknas längs den och tvärfallet
vrider kring den, också när den ligger på en kant eller är förskjuten
(förut kring mittlinjen). **Punkterna med höjd**: ändarna alltid, och
punkter däremellan när de fått en med *Höjd i punkten* i Modifiera
(förslaget är höjden som lutningen ger där); *Utan höjd* tar bort den. En
punkt utan höjd styr bara läget. Mellan punkterna med höjd går rampen
rakt, så att en plan sträcka är ett vilplan i samma ramp; lutningen (1:N
med pil) och varningarna gäller varje sträcka. Fältet *Lutning* finns bara
när rampen har en sträcka. Punkterna med höjd är orange cirklar när rampen
är markerad, de andra vita fyrkanter, sidornas små grå. **Sidorna**
följer referenslinjen med bredden som förut tills en av dem ändras i
Modifiera (punkterna och kanterna som 2D-formens, utan bågar); då sparas
den sidan och ligger kvar när referenslinjen ändras. *Sidorna: Följer
referenslinjen / Ritade* i egenskaperna. **Kanterna**: *Kanterna* gäller
alla som förut och nollställer sidorna; *Vänster sida* och *Höger sida*
för sig; ändarna följer *Kanterna*. En sida som är mur ritas tjock (0,5),
har inga släntstreck och lämnar marken utanför orörd (ingen kropp i 3D,
som förut). **Förlänga**: ett klick på en ände med Mark (Ramp/väg), eller
*Förläng* på en ände i Modifiera; lutningen i sista (eller första)
sträckan fortsätter, avrundad till 10 mm, och den gamla änden behåller sin
höjd som en punkt med höjd. Provat med Playwright mot `dist/` med
`groundProject` (sidans punkt i Modifiera och dragen, Höjd i punkten,
förlängd med Mark, höger sida som mur, 3D). Klickjämförelsen mot 0.10.17:
samma `doc` i alla 396 steg; ritningen skiljer från *tvärfall* (rampen
med referenslinjen på kanten vrider kring den), greppen och panelen för
rampen.*

### Granskning efter 0.10.18 ✓ (0.10.18.1)

Ungefär tre versioner efter den förra (0.10.16–0.10.18). Utan nya
funktioner, utom småfelen ur Inkorgen (Carl August hoppade över frågorna
27 oktober, så Claudes förslag gäller):

- Mer-knappen i smartmenyn syns fast det inte finns fler val (t.ex. för
  fastighetsgränsen från Höjdkurvor); leta upp fler ställen och visa den
  bara när valen inte får plats
- Egen färg på höjdkurvorna i stilmallen
- Stilmallens fönster bredare, i kolumner grupperade efter typ (om det
  ryms; annars en egen liten version)
- Klickjämförelsen får steg för 0.10.16–0.10.18 (snittet i planen,
  linjerna i 2D-formen, rampens punkter med höjd, sidorna och
  förlängningen)
- Städa, dela upp stora filer, gå igenom testerna

*Gjord 27 oktober (kväll), samma format (20). Det syns något, så den
heter 0.10.18.1. Testerna: 569 → 572, ca 14–17 s. **Mer**: smartmenyn
visar *Mer* (och högerklicksmenyn *Alla inställningar här*) bara när det
utfällda har något; utan var de kartans linjer (fastighetsgränser,
vägar, punkter), den befintliga marken och markeringar av bara sådana.
Andra objekt har alltid något (Finns i, Lås, typen, pennan). **Höjdkurvorna**:
tre pennor i stilmallen under *Höjdkurvor* (hela meter, däremellan, den
befintliga marken där den ändrats) med tjocklek, färg och linjetyp, och
höjden på hela meter i kurvans färg; förvalen som förut, utom att den
ändrade markens streckning nu är *Streckad* (3 och 1,5 mm i stället för
2 och 1). 3D-vyns kurvor har sin egen färg. **Stilmallens fönster**: upp
till 1480 px brett med tre kolumner som rullar var för sig när skärmen är
minst 1180 px: åtgärderna (med en egen rubrik) och texterna, pennorna,
och linjetyperna och fyllningstyperna. Raderna staplas i kolumnerna, och
pennorna har inte tjocklek, färg och linjetyp utskrivet på varje rad.
Läst som *efter sorts inställning*; säg till om du menade efter objekttyp
(väggar, dörrar …), det är en större omflyttning. Rättat på vägen:
fönstret hoppade till början vid varje ändring (nu är rullningen och
fokus kvar), och en penna för snittet som ställts heldragen blev
punktstreckad igen när projektet öppnades. **Filerna**: `ops.ts` 514 →
301 rader (`opDefs.ts`, `rail.ts`), `groundPlan.ts` 420 → 254
(`groundSlopes.ts`), `groundFields.ts` 322 → 183 (`groundFieldEdits.ts`);
stilmallens CSS i `stilmallen.css`. `commandLine.ts` (623) och
`planView.ts` (591) är störst nu; de är en sluten helhet var och lämnas
till en granskning där de hinner provas för sig. **Testerna**: inga
dubbletter bland 0.10.16–0.10.18; tre nya (höjdkurvornas pennor, heldraget
kvar, den ändrade markens färg). **Långsam kod**: inget nytt som växer med
kvadraten. **Klickjämförelsen** har 457 steg (61 nya): mot 0.10.18 samma
`doc` i alla steg före de nya sist; ritningen skiljer bara i den ändrade
markens streckning (från att platsen läggs in) och stilmallens fönster i
sin markup.*

### 0.10.19 Markobjektens bågar ✓

Carl Augusts synpunkter 26 oktober (förut 0.10.18). Stor; efter 0.10.17,
som har samma verktyg.

- 2D-formens redigering för markobjekten: Böj, Avrunda med riktiga bågar,
  Fasa
- Bågar på vägens referenslinje och på kanterna (kanterna ändrar bara
  bredden)
- Docka ihop två ramper med olika lutning
- Mjuka eller skarpa övergångar i höjd (Carl August 28 oktober): en
  gångväg jämnas av i övergångarna, en betong- eller stenramp har skarpa
  brytningar mot vilplanen; en inställning för rampen (med radie) i
  början, slutet och punkterna med höjd, och per punkt

*Byggd 28 oktober (natt), samma format (20): bågarna, övergångarna och
dockningen är frivilliga parametrar. Carl August svarade i början: Foga
ihop för dockningen, samma verktyg för stödmur och brytlinje, bågar på
sidorna ändrar bara bredden. Testerna: 572 → 588 på ca 14 s. Claudes
val: **bågarna** är pilhöjder per kant som 2D-formens (`bulges`, och
`leftBulges`/`rightBulges` på ritade sidor); all räkning mot marken görs
på linjen med bågarna som korta raka bitar, så sträckan längs
referenslinjen (höjderna) går längs bågen; sidorna som följer
referenslinjen är koncentriska med den (samma vinkel, större eller mindre
radie), och utan bågar räknas de precis som förut. Avrunda och Fasa kräver
som förut två raka kanter i hörnet; ett avrundat hörn med höjd ger sin
höjd till den nya punkten närmast. Verktyget Mark fick *Båge* (G) för
linjerna, som takets kontur i 0.10.17, och *Ångra* tar bort senaste
klicket. **Övergångarna** är parabler med en vertikal radie (förval 20 m
under Platsen, *Rampens mjuka övergångar*): i en punkt däremellan ersätter
kurvan brytningen lika långt åt båda håll (längden R·|Δlutning|, kortad
om den inte ryms på de raka delarna intill); i ändarna börjar och slutar
rampen plant med ändens höjd, så den raka delen riktas om och blir
brantare (h = g·S − R·g²/2; ryms radien inte kortas den). Lutningen i
planen, panelen och varningarna gäller den raka delen; fältet *Lutning*
sätter den raka delens lutning. En punkt utan höjd kan inte ha en
övergång (den styr bara läget). **Dockningen** med Foga ihop: ändar inom
den bredaste rampens bredd räknas som samma; den andra rampen hängs på
(vänd om det behövs: *reversedRamp* byter början och slut, sidor,
tvärfall och referenslinjens sida), skarven blir en punkt med den förstas
sluthöjd, den förstas inställningar gäller, och sidorna blir ritade om
någon var det eller bredderna skiljer. Provat med Playwright mot `dist/`:
en ramp med båge ur verktyget, Avrunda på referenslinjen, Böj på en sida,
övergångarna i panelen och Modifiera, dockning, 3D. Klickjämförelsen mot
0.10.18.1: samma `doc` och ritning i alla 457 steg; panelen, Platsen och
smartmenyn skiljer där det nya syns. Inte gjort: markytans kontur har
inga bågar (den ändras med takets konturverktyg); stödmurens sidor i 3D
följer bågen som bitar på 0,5 m som förut.*

### 0.10.20 Situationsplanens beteckningar ✓

Carl Augusts bilder 27 oktober; som landskapsarkitekter redovisar.

- Murens ledare *M01* och *MK +22.20*; markhöjder (befintlig
  understruken, utgående inom parentes, ny utan) med ett litet kors;
  minsta sidolutning i procent; låglinje för dagvatten som pilar;
  littera med två siffror som förval (inställning)
- Kontur runt släntmarkeringarna (Inkorgen 27 oktober)
- Släntmarkeringar ritade ur den befintliga marken där den är brantare än
  ett gränsvärde (inställning, 1:3 som förval). Annan grafik ur
  topografin (lågpunkter, avrinning, punkthöjder, lutningsfärger) efter
  piloten

*Byggd 28 oktober (morgon), samma format (20), tillsammans med rättningen
av markeringen (ramen för objekt med många linjer, 0.10.19.1 blev en del
av den här). Carl August bad att den byggdes utan frågor först. Testerna:
590 → 610 på ca 14 s. Claudes val: **markhöjden** är en egen sort
(`level`) under *Beteckning* i Mark: ett kors och texten till höger;
höjderna läses ur marken (den färdiga i förslaget) och marken räknas som
oförändrad när de skiljer mindre än 5 cm; en egen ny höjd i egenskaperna
går före. Befintlig understruken, ny utan, utgående inom parentes utan
understrykning (Stockholms ritningsmanual). **Låglinjen** (`drain`) ritas
i flödets riktning med pilar var 10 mm på papperet och minst en.
**Murens ledare** går vinkelrätt ut åt höger (i linjens riktning) från
murens mitt, 7 mm, med ett vågrätt streck 11 mm och texten på det:
litterat över och *MK* med krönets höjd under; varierar krönet står
lägsta–högsta. Litterat numreras i ritordningen bland vyns stödmurar
(*M01*); fältet *Littera* i egenskaperna ger ett eget. *ÖK* heter *MK*
överallt (ändarna, höjdpunkterna, fälten). Ledaren släcks under Visa,
Littera, *Stödmurar*. **Decimalerna** i markobjektens höjder är en
inställning under Platsen, två som förval (nivåmarkörerna har kvar tre);
**antalet siffror** i littera likaså. **Minsta sidolutning** är ett fält
i procent på markytan och rampen, utskrivet understruket (under höjden
respektive över namnet) bara när det är ifyllt; det är en anteckning,
inget som räknas. **Konturen runt slänterna** följer strecken ytterändar
(medianen av tre grannar), tunn 0,13, bruten där ingen slänt börjar;
strecken bryts nu där den färdiga marken lämnar släntens egen lutning,
vilket också kortar strecken som förut gick in över ett grannobjekts
slänt. **De branta slänterna** är en vyinställning under Visa, Platsen,
släckt från början, med gränsen under Platsen (1:3): gränsen mellan brant
och flackt räknas som en höjdkurva i lutningens fält, och strecken följer
fallinjen från krönet, grå, inte där markobjekten ändrat marken. Provat
med en ritning av `groundProject` till SVG (planen, markhöjderna,
låglinjen, ledaren och de branta slänterna med gränsen 1:8) och i
Playwright mot `dist/`. Inte gjort: markhöjden har ingen egen
textvridning eller förskjutning; låglinjens pilar går inte att glesa;
ledarens läge går inte att dra.*

### 0.10.21 Lutande väggar ✓

Carl August 27 oktober, i svaret om snittet i planen; 28 oktober bad han
att den byggdes före piloten ("kör nästa version").

- En vägg kan luta: en vinkel (eller ett mått i toppen) åt ena sidan, och
  väggen ritas som en lutande kropp i 3D, fasader och sektioner
- I planen följer den snittet: snittytan där väggen skär snitthöjden,
  foten som vy och det som lutar ut över snittet streckprickat
- Öppningarna följer lutningen; skarvarna mot andra väggar och tak prövas

*Byggd 28 oktober (förmiddag), samma format (20). Testerna: 610 → 616 på
ca 14 s. Claudes val: **lutningen** sparas som en vinkel i grader
(`lean`), positiv åt vänster som bågen, samma i båda ändarna (Carl August
hoppade över frågan om olika i ändarna; en vriden vägg får vänta); fältet
*Toppen i sidled* i mm räknas om till vinkeln ur höjden, så att vinkeln
håller när höjden ändras (en vägg upp till taket). Foten ligger kvar på
referenslinjen. Bågväggar lutar inte. **3D-formatet** fick `shear` i
stället för en egen kropp: ytorna är plana också lutade, så fasadernas
dolda linjer och kanter behövde inget nytt, och sektionen är exakt (en
affin avbildning av konturen, också under sneda tak). **Tak och bjälklag**
räknas i väggens oförskjutna koordinater; takets yta i plan flyttas
tillbaka så långt som väggen lutar ut vid sin höjd, en förenkling som
syns bara där takets kant går diagonalt över en lutande vägg. **Skarvarna**
mot andra väggar räknas vid foten i 3D (en lutande vägg som möter en
lodrät får en glipa eller går in i den högre upp; det prövas inte) och
vid snitthöjden i planen (dörrar, fönster, hål och skarvar hamnar där
snittet skär väggen). **Foten och toppen** i planen är väggens egen
rektangel utan skarvar, med fotens kontur bruten av dörrarna och toppens
av hål som når toppen. Rummen, bjälklag ur väggarna, väggsidorna,
automåtten, greppen och snäppningen utgår från foten; ett klick på
snittytan markerar väggen, men greppen ligger på referenslinjen vid
foten, en bit ifrån. Inte gjort: olika lutning i ändarna; lutande
bågväggar; ytterväggarnas insida som dold linje i fasaden ritas lodrät;
ingen lutning i väggverktyget (sätts i panelen efteråt).*

### Granskning efter 0.10.21 ✓ (0.10.21.1)

Utan nya funktioner. Klickjämförelsen får steg för 0.10.19–0.10.21,
`groundRamp.ts` delas, testerna gås igenom. Småfelen ur Inkorgen 28
oktober (Carl August godkände Claudes förslag A–H samma morgon):

- Slänternas fyllning fungerar inte (inget händer oavsett inställning)
- Släntstrecken dubbelt så glest (5 mm på papperet), som en inställning
  under Platsen
- 3D-perspektivet återställs när man växlar mellan Båda och 3D; det ska
  ligga kvar

*Gjord 28 oktober (förmiddag), samma format (20). Det syns något, så den
heter 0.10.21.1. Testerna: 616 → 617, ca 16 s. **Slänternas fyllning**:
felet låg i rampen och vägen (`linePlan`), som aldrig ritade
`slopeFill` fast panelen hade fältet; markytan ritade den. Nu ritas den
för båda, bakom objektets egen fyllning. Säg till om det inte händer
något på en markyta heller. **Släntstrecken**: *Släntstreckens avstånd*
under Platsen, mm på papperet, 5 som förval (förut fast 2,5); gäller
markobjektens slänter och de branta slänterna i den befintliga marken.
Konturen runt slänterna och slänternas yta känns av var 1,25 mm som
förut, oberoende av inställningen, så de blir inte grövre. **3D-kameran**
ligger kvar när man växlar mellan Båda och 3D; hela modellen visas bara
första gången 3D-vyn öppnas. **Filerna**: `groundRamp.ts` 618 → 257
rader: höjdprofilen i `rampProfile.ts` (`rampLevels`, `rampRuns`,
`easeRadiusAt`, `heightAtS`, `rampProfile`) och ändringarna i
referenslinjen i `rampEdits.ts` (`remapLevels`, `remapEases`,
`tidyLevels`, `tidyEases`, `extendRamp`, `reversedRamp`, `fusedRamp`).
`commandLine.ts` (623) och `planView.ts` (591) lämnas som förut.
**Testerna**: inga dubbletter bland 0.10.19–0.10.21; två nya (rampens
släntfyllning, strecken följer Platsen); referensen `mark-plan.txt`
omskriven för det glesare avståndet. **Klickjämförelsen** har 496 steg
(39 nya för 0.10.19–0.10.21: Böj på referenslinjen, mjuka övergångar och
en skarp punkt, en ramp till med Båge i verktyget och Foga ihop,
markhöjd, låglinje, murens littera, minsta sidolutning, decimalerna och
siffrorna under Platsen, branta slänter under Visa, en lutande vägg i
planen och 3D): mot 0.10.21 samma `doc` i alla steg; ritningen skiljer från det att platsen läggs in (släntstrecken glesare; med avståndet ställt på 2,5 mm är ritningen densamma i alla steg), 3D-bilderna där kameran nu står kvar, och Platsens dialog med det nya fältet.*

### 0.10.20.1 Litteran ✓

Inkorgen 28 oktober; utvidgad samma dag i samtalet. Carl August: alla
littera med ledare ska gå att flytta (också rumslitteran utanför rummet),
inte bara murens; ledaren går först vinkelrätt ut från texten (uppåt, åt
höger, nedåt eller åt vänster) och viker sedan av mot punkten, med Shift i
steg om 15°, och olika ändar. Flera ledare från samma littera delar stammen
och viker av från den (hans skiss: parallella sneda delar från en vågrät
stam). Ett generellt littera med fritext och smarttext ur det man pekar på
och flera ledare blev en egen version, **0.10.20.2**. Han godtog Claudes
val O–S ("allt blir bra, kör").

- **Den gemensamma ledaren** (`src/elements/leader.ts`): textens ruta,
  stammen ut från en sida och knäcken, de sneda delarna och ändarna. Med en
  gemensam vinkel räknas knäckarna ut så att flera ledare blir parallella
  och stammen så lång som behövs (till 0.10.20.2; prövat men inte använt
  än). En punkt rakt ut från texten nås av stammen själv
- **Sidan** väljs automatiskt: åt höger eller vänster efter vilken sida av
  textens mittlinje punkten ligger, uppåt eller nedåt när den ligger rakt
  över eller under textens mittersta halva; går att låsa
- **Ändarna**: ingen, pil, fylld pil, prick, snedstreck, ring och
  *Automatiskt* (pil mot en kant, prick inne i en yta)
- **Rummet, väggarna, dörrarna, fönstren och stödmuren** använder den. Rummet
  får en ledare när stämpeln står utanför rummet (som förut), väggar alltid
  (rakt in till väggens mitt, som förut), dörrar och fönster när litteran
  flyttats. Stödmurens text har strecket mellan raderna, och stammen
  fortsätter det in till knäcken rakt ut från muren
- **Grepp** i Markera för det markerade: texten dras i sig själv,
  punkten (rund) och knäcken (fyrkant, stammens längd). Shift: den sneda
  delen i steg om 15°. Punkten snäpper mot det ritade
- **Littera** i egenskaperna: stammens sida, änden, stammens längd och
  *Litteran tillbaka*; förvalen per sort i stilmallen (*Ledarna* under
  *Texter och littera*)
- Valfria parametrar, samma format (20)

*Claudes val:* förskjutningarna sparas på objektet i mm i modellen (inte
på papperet, som Claude först föreslog), eftersom rumsstämpeln redan
sparades så (`labelAt`) och punkten sitter på objektet; i olika skalor
står litteran därför lika långt från objektet i verkligheten. För littera
längs en vägg står de i textens egna axlar och följer väggen när den
vrids; rummets och stödmurens i planens axlar, och de vrids och speglas med
objektet. Förvalen ritar som förut: väggens och murens streck utan ände,
rummets öppna pil, dörrarnas och fönstrens *Automatiskt* (prick i
öppningens mitt). Stammen 3 mm på papperet. Textens grepp ritas inte (det
skulle dölja texten); man drar i texten. *Stämpeln i mitten* blev
*Litteran tillbaka*.

*Gjordes inte:* flera ledare och det generella littrat (0.10.20.2),
markhöjdens och de andra markbeteckningarnas text (de har ingen ledare),
nivåmarkörernas text, ett grepp för ramens storlek, en egen penna per
littera (stilmallens *Litterans streck* och *Rumsstämpelns pil* gäller).
Klickjämförelsen kördes inte; nya steg i nästa granskning.

### 0.10.20.2 Generell littera ✓

Carl August 28 oktober, i samtalet om litteran, och hans svar på frågorna
om 0.10.20.1 samma dag (13.33): A *testa pappersstorlek* (förskjutningen
på papperet), B och C som de var, D *bara det finns som en visuell
kontrollpunkt om man markerar litterat, kan vara på ledarens ansats*, E
*testa att ha strecket under litterat som helhet; borde vara en generell
inställning om litterats ledare ska ansluta till sidan eller
understryka litterat*. Format 21.

- **Littera-verktyget** (K, `littera`): klick på det litteran pekar på,
  Shift+klick för fler, sedan där texten står. *Lägg till ledare* i
  egenskaperna använder samma verktyg
- **Objekttypen `Label`** (`src/elements/label.ts`): fritext och
  smarttext ur objekten (`{typ}`, `{id}`, `{namn}`, `{nummer}`, `{area}`,
  `{bredd}`, `{höjd}`, `{längd}`, litteramallarnas fält och egna
  egenskaper); *varierar* eller en lista
- **Flera ledare på stammen**, parallella med en gemensam vinkel (45° som
  förval, 0 = fria)
- **Punkterna sitter fast i objekten** (objektets axlar,
  `src/elements/anchor.ts`) och följer dem; röd ledare när objektet tagits
  bort; en punkt som dras fastnar i objektet den släpps på
- **Sort och löpnummer** i ritordning, eget nummer går före; Visa per sort
- **Ram**: ingen, understrykning, rektangel, cirkel, sexhörning
- **Rikta och fördela**: Justera och Fördela flyttar litteran utan punkterna
- **Understruken ledare** (E) för alla littera: *Mot texten* per sort i
  stilmallen och per littera under Littera; stödmuren understruken som
  förval
- **Förskjutningen på papperet** (A): `tag.at` i mm på papperet
- **Grepp på ansatsen** (D): en romb där ledaren lämnar texten

*Claudes val:* löpnumren räknas över hela projektet per sort (inte per
våning), i den ordning litterorna skapats; sorten jämförs utan skiftläge.
Vinkeln gäller bara när ledarna är flera, så att en ensam ledare beter sig
som de andra litterornas (stammens längd). En punkt som ligger bakom
stammens början får knäcken vid stammens minsta längd och blir inte
parallell. Rummets stämpel står kvar i modellen (`labelAt`); det är bara
de förskjutna litterorna (väggar, dörrar, fönster, stödmurar) som står på
papperet. Det generella littrat står i modellen (`pos`), som en text.
Texten vrids inte med Vrid (den står kvar upprätt). Littera i Skiss visas
(det generella littrat är en anteckning, som text). En ensam radbrytning
går inte att skriva i verktygsraden, bara i egenskaperna. Formatet höjdes
eftersom `tag.at` bytte betydelse.

*Gjordes inte:* löpnummer efter läget (bara ritordning), litteran i
fasader och sektioner (verktyget ritar i planen), dubbelklick för att
skriva i texten, spegling som håller punkten exakt på en vägg (den hamnar
lika långt från väggens nya början), ledare till punkter i 3D,
förteckningen (0.12 Export). Klickjämförelsen kördes inte; nya steg i
nästa granskning.

### 0.10.22 Snäpp och smartspöt ✓

Inkorgen 28 oktober (*Snäpp i marken*), utvidgad av Carl August samma dag
(14.15): snäppet och liknande funktioner ska fungera för allt som är
rimligt, inte bara de fall han listat; trollstaven ska heta något med
smart, vara anpassad efter verktyget man står i (i Markera utan verktyg)
och vara lätt att bygga ut. Claudes förslag E, F, J och N i den här
versionen, G, H, I, K, L och M i 0.10.23; *kör*. Hans svar om 0.10.20.2:
A, B, C och E bra som de är; D en inställning för vridningen. Samma format
(21).

- **Snäpp mot allt som ritas**: markobjekt, bjälklag, tak, rum, grannhus,
  fastighetsgränser och vägar från Höjdkurvor, träd, markörer, mått och
  allt nytt, ur primitiverna; höjdkurvorna som kurvor (på linjen, inga
  ändar)
- **Smartspöt** (Q, eller knappen i statusraden), med register och en fil
  per funktion; förhandsvisning vid hovring, Tab växlar, Shift samlar
- **E Vägg**: väggar runt en kontur eller längs en kant (bjälklag,
  markobjekt, 2D-form, underlag, fastighetsgräns …)
- **F Mark**: stödmur, brytlinje, låglinje eller väg längs en sida eller
  runt en kontur (rampens sida, markytans kant, höjdkurva …)
- **J 2D**: en sluten 2D-form runt en snittyta, ett objekts kontur eller
  den minsta slutna ytan mellan linjer
- **N Markera**: allt som hänger ihop med objektet, Tab för allt av samma
  sort i vyn
- **D Litterans vridning**: Horisontell, Vertikal och egna grader i
  verktyget och egenskaperna; förvalet i stilmallen (*Vridning* för
  Littera under Ledarna)

*Claudes val:* spöet slås av när man byter verktyg och med Esc eller Q
(det ligger inte kvar mellan verktygen). Väggar runt en kontur ritas med
verktygets referenslinje och medurs, så att *Ute* lägger väggarna
innanför konturen och *Inne* utanför. Hela konturen kommer först för
väggar, sidan först för markens linjer. En sida slutar där kedjan viker
mer än 35°. Stödmuren läggs utanför objektet när insidan är känd, annars
med linjen i mitten. Väggarnas liv följs inte i väggverktyget. En båge
följs som korta raka bitar (bågar i väggar och markobjekt blir många
korta delar). Spöet fungerar inte i 3D eller på ritningsbladen.
`setLabelAngle` sparar också 0, så att en vågrät littera inte vrids när
förvalet ändras.

*Gjordes inte:* bågar ur kedjor (de följs som raka bitar), spöet på
ritningsbladen och i 3D, ett skrivet avstånd från kanten (förskjutning),
hål i 2D-formen runt en yta med hål. Klickjämförelsen kördes inte; nya
steg i granskningen.

### Granskning efter 0.10.22 ✓ (0.10.22.1)

Utan nya funktioner: Carl Augusts svar C om 0.10.22 (inget snäpp mot
höjdkurvorna i planen, men mot marken i sektion och fasad), klicksteg
för 0.10.20.1, 0.10.20.2 och 0.10.22, mätning av snäppet och spöet på en
stor plats, och `commandLine.ts` och `planView.ts` delade.

*Gjord 28 oktober (eftermiddag), samma format (21). Det syns, så den
heter 0.10.22.1. Testerna: 648 → 650, ca 17 s. **Höjdkurvorna** ligger
kvar i snäppets lista men bara för smartspöt (`wandOnly`), så en stödmur
längs en höjdkurva går som förut; i sektionen och fasaden snäpper man mot
marklinjen (*På marken*, på linjen utan ändpunkter i rutnätets steg).
**Klickjämförelsen** fick 43 steg: punkten, texten och knäcken dragna på
väggens littera, delen Littera, det generella littrat med två ledare,
ram, understruken, löpnummer, lodrät, lista och en borttagen ledare,
vridningen i stilmallen, och spöet i Vägg (hovra, Tab, Tab, klick),
Markera (klick, Tab, klick), Mark (stödmur längs sidan) och 2D (form runt
bjälklaget). Den visade två småsaker som rättades: **Tab direkt efter
ett klick** gjorde inget (förslagen töms efter klicket och räknades om
först vid nästa musrörelse); och när **litterans grepp** ligger på
varandra (en rak ledare har knäcken i punkten) tog knäcken greppet, nu
punkten. Ett steg från förra granskningen (*stäng Visa* med Esc) stängde
inte menyn, så den låg över ritningen i stegen efter; rättat i skriptet.
Med snäppet oförändrat är 528 steg lika mot 0.10.22 och de 11 som skiljer
är de två rättelserna; med svar C skiljer stegen från gropens andra hörn,
som förut drogs till en höjdkurva. **Mätt**: 1,2 miljoner noder ger
105 000 kurvbitar i snäppets lista (10–40 ms att bygga, 40 ms för
rutnätet första gången); spöets `faceAround` tog 81 ms per hovring med
1040 höjdkurvebitar, nu 17 ms med en `BoxIndex` för skärningarna.
**Filerna**: `commandLine.ts` 623 → 542 (`shellList.ts`, `shellMenus.ts`),
`planView.ts` 591 → 403 (`planInput.ts`, `zoomHistory.ts`).*

*Claudes val:* höjdkurvorna hålls kvar i listan med en flagga i stället
för att tas bort, så att spöet kan följa dem; Justera och markörerna
hoppar också över dem. Marklinjen snäpps som en kurva (inga ändpunkter
och mittpunkter i varje steg, som höjdkurvorna i 0.10.22). Punkten går
före knäcken bara när de ligger inom samma tolerans.

### 0.10.23 Smartspöt del 2 ✓

Claudes förslag 28 oktober, godkända med *kör* för 0.10.22, och svar E om
0.10.22 (riktiga bågar). Byggd 28 oktober (eftermiddag) på *Kör*, samma
format (21).

- **E Bågar ur kedjor** (`fitArcs`): minst tre korta bitar som viker
  lika åt samma håll och ligger på en cirkel blir en båge; i väggar,
  markobjektens linjer, 2D-former, takfall och håltagningar
- **G Bjälklag**: innanför väggarna (klick i rummet), ur takets, en
  2D-forms eller en sluten ytas kontur, innanför ytterväggarna; med
  *Håltagning* ett hål ur konturen
- **H Tak**: takfall över väggarna (husets kontur) eller bjälklaget, med
  takfoten utanför; snabbvalen över den omslutande rektangeln
- **I Markyta och ramp**: runt huset, ur en 2D-form eller ett objekt,
  mellan linjer (inom fastighetsgränsen); ramp och väg längs en sida fanns
  redan (0.10.22) och får nu bågar
- **K 2D-linje**: längs en kant eller kedja (öppen; runt en kontur sluten)
- **L Littera**: klick på ett objekt ger en littera med verktygets text
- **M Mått**: en måttkedja över väggen, öppningarna och de anslutande
  väggarnas liv

*Claudes val:* en båge kräver minst tre bitar, högst 25° per bit, bitar
högst tre gånger så långa som den kortaste och 1 mm (plus 0,1 promille av
radien) från cirkeln; en sluten kedja utan hörn på en cirkel blir två
halvcirklar. Bjälklagets och markytans konturer har inga bågar, så där
blir bågen korta raka bitar. Takfallet har takfoten vid kanten närmast
markören och stiger inåt; takfotens kontur är husets kontur förskjuten
med takfotssprånget (gering i hörnen). Snabbvalen läggs över den
omslutande rektangeln också när konturen inte är en rektangel. Litteran
hamnar 8 mm (papper) snett upp till höger, med verktygets text, sort och
vridning; Shift samlar flera objekt som får var sin littera (inte en
littera med flera ledare). Måttkedjan ligger 8 mm (papper) utanför livet
och tar med båda liven på varje anslutande vägg (också i hörnen, där det
blir väggtjockleken); mått som hamnar inne i en anslutande vägg (insidan
i ett hörn) tas bort i ändarna. En öppning måttsätts med sin vägg.
Höjdkurvorna stänger inga ytor för spöet (de korsar allt på
situationsplanen). I 2D kommer kanten före ytan när båda finns.

*Gjordes inte:* bågväggar måttsätts inte, och väggar runt en bågvägg
följer den som förut; en båge av två bitar räknas som ett hörn; bågar i
bjälklagets och markytans kontur; spöet på ritningsbladen och i 3D; ett
skrivet avstånd från kanten. Klickjämförelsen kördes inte; nya steg i
granskningen.

### 0.10.24 Bågar i bjälklagets och markytans kontur ✓

Carl August 28 oktober (kväll): han provade spöet mot en bågformad
yttervägg och konturen följde den; skillnaden mot en riktig båge syns
först när konturen ändras. "Gör det som är bäst för framtiden, kör."
Byggd samma kväll, samma format (21): `bulges` är frivilligt på
bjälklaget och markytan, som på håltagningen och markobjektens linjer.

- **Formatet**: `bulges` (pilhöjd per kant, 2D-formens regel) på
  `SlabParams` och på `GroundParams` för markytan (samma fält som linjens
  bågar; en markyta har ingen linje). En kontur av två punkter med bågar
  är en cirkel, som håltagningen
- **Ytorna**: konturen går via `shapePoints` där den blir en yta (planen,
  3D, klick i ytan, urgrävningen under bjälklaget, litterans area)
- **Verktygen**: *Båge* i bjälklagets polygon också för konturen;
  markytan som *Polygon* med *Båge* och *Klar med konturen* (Enter,
  dubbelklick, första hörnet)
- **Spöet**: `fitArcs` på konturen i Bjälklag och Markyta (moturs med
  bågarna vända när ytan går medurs); *Ur väggarna* urbockat ger bågar
- **Modifiera**: bjälklagets och markytans kontur går genom 2D-formens
  väg (`shapeOf`, `shapePatch`), så Böj, Räta ut, Avrunda, Fasa, Förskjut
  med flera kanter och dragbara punkter följer med; den gamla raka vägen
  (`hasEditableOutline`, valen `roof*`, `roofId`) är borttagen

*Claudes val:* ingen ny formatversion (frivilligt fält, som 0.10.19).
Äldre bjälklag och markytor behåller sina korta raka bitar; det finns
ingen knapp som gör om dem till bågar (rita om med spöet, eller Räta ut
och Böj). Spegling vänder pilhöjderna som för hålen. Markytans polygon
sluts på tool-byte som linjerna avslutas (skapas om den går att sluta).

*Gjordes inte:* bågar i rummets sparade kontur (`Space.outline`, ur
väggarna som förut) och i `insideWalls` (bjälklag ur väggarna följer
väggarna och ritas som väggarna ger dem). Klickjämförelsen kördes inte;
nya steg i granskningen (bjälklag med båge i verktyget, Böj på konturen,
markyta som polygon).

### 0.10.25 Platsen som modellflik ✓ · *nytt format (22)*

Beslutat 28 oktober i materialutredningen (planeringssession), i den här
ordningen före materialen så att illustrationsplanen finns när de får sin
färg. Byggd 28 oktober (kväll) på *Kör*, format 22.

- **Platsen** som modellflik bredvid våningarna, för situationsplan,
  markplaneringsritning och illustrationsplan; allt ses ovanifrån, utan
  snitthöjd. Platsens meny tar över dialogen Platsen (*Inställningar…*)
- **Markobjekten** och det som kommer ur Höjdkurvor hör till Platsen, inte
  till våningen närmast ±0; i våningsplanerna visas marken som kalkering
  (*Visa → Kalkera → Platsen*)
- **Vyer** av Platsen med tre förinställningar: *Situationsplan*,
  *Markplaneringsritning* och *Illustrationsplan*, och vykategorin på
  vyn (materialen i 0.10.26 ritas efter den)
- **Husets kontur** på situationsplanen (parkerat 26 oktober) och taken
  från alla våningar

*Claudes val:* Platsen ligger i våningslistan (`site: true`, id
`platsen`, sist, golvet vid ±0), så att vyer, verktyg, urklipp, blad och
markering fungerar som på en våning; `buildingStoreys` och `storeysUp`
räknar bara husets våningar (nya våningar, nivåmarkörer, rumsnummer, Page
Up och Page Down, tak på andra våningar). Snitthöjden är oändlig, så taken
ritas som sedda ovanifrån och väggar på Platsen som vy, men
**stödmurarna ritas snittade** (fyllda) hela vägen, som på en
markplaneringsritning (rör frågan om 0.10.16). Husets kontur är
ytterväggarnas utsida på alla våningar, 0,35 heldragen utanför taken och
0,18 streckad under dem (inte en penna i stilmallen än); släcks med *Husets
kontur (på Platsen)* under Visa. Marken i våningsplanerna är en
kalkering, inte ett eget val: den tonas, går inte att klicka på och
ersätter annan kalkering medan den visas. Verktyget Mark öppnar Platsen
och lägger alltid markobjekten där; urgrävningen tar bjälklaget på den
lägsta våningen som har ett där man klickar, och marken runt huset
utgår från våningen närmast ±0 (`groundStorey`). Markobjekten och
platsens objekt (`onSite` på typen) går inte att flytta till en våning;
annat går att flytta och kopiera till Platsen. Platsen har inget namn,
golv eller höjd att ändra och går inte att ta bort. Förinställningarna:
Situationsplan 1:400 utan markörer och stödmurarnas littera,
Markplaneringsritning 1:200 med de branta slänterna, Illustrationsplan
1:200 utan höjdkurvor, mått, generell littera, stödmurarnas littera och
markörer; alla i förslaget som visas från början, utan jämförelse. En
vy som sparas om behåller sin kategori. Efter *Lägg in platsfil* öppnas
Platsen.

*Gjordes inte:* koordinaterna i SWEREF på situationsplanen och i
exporten (hör till *Koordinater, SWEREF och sol*); kategorin ändrar inget
i ritningen än (materialen i 0.10.26); en egen penna för husets kontur;
*Bara den här våningen* i 3D heter så också på Platsen och visar då bara
platsens objekt. Klickjämförelsen kördes inte (skriptet öppnar dialogen
Platsen med `bacchus.site`, och efter *släpp platsen* öppnas Platsen, så
stegen därefter skiljer mot äldre byggen); nya steg i granskningen.

### Utredning: material i stället för fyllningar ✓

Gjord 28 oktober (planeringssession). Beslutet står i
`cad-apa-synpunkter.md` och i de fyra versionerna 0.10.25–0.10.28: ett
material bor i stilmallen med en representation per vykategori, objektet
pekar på ett material eller har *Eget*, och teckenförklaringen läser
materialen ur bladets vyer.

### Granskning efter 0.10.25 ✓ (0.10.25.1)

Utan nya funktioner: det Platsen glömde på några ställen, dubbletter,
grannkoll där allt prövades mot allt, och klicksteg för 0.10.23–0.10.25.

*Påbörjad 28 oktober (sent) och gjord 29 oktober, samma format (22).
Det syns, så den heter 0.10.25.1. Testerna: 676, ca 12–16 s.
**Platsen räknas inte som våning** i Filtrera och markera (*Alla
våningar* bara med flera husvåningar), 3D (*Bara den här våningen* göms
med en våning) och låsta rums- och dörrnummer; `storeysUp` borttagen
(`storeysUpFrom`). **Verktyget Rum** räknade hålen per dokument och
tillstånd men inte per våning, så ett byte av våning utan ändring gav
förra våningens rum: cachen tar våningen med. **`parse`** känner igen
Platsen på id:t också. **Dubbletter**: skosnöresformeln fanns på ett
tiotal ställen, nu `signedArea`; `nearestEdge`, `ccw` och `offsetEdge`
samlade i `geometry/` (`core/roofEdit.ts` borta). **Grannkoll**: husets
kontur på Platsen prövas bara mot taken vars ruta rör den, och måttkedjan
med spöet bara mot väggarna som når fram. **Zooma till allt** och
fasadmarkörens *Följ byggnaden* räknar med bågarnas buktning.
**Klickjämförelsen** fick 43 steg för 0.10.23–0.10.25 (spöet i Takfall,
Mått och Littera, bjälklag med båge och Böj, markyta som polygon med
båge på Platsen, 3D, kalkeringen, Platsens meny med en situationsplan och
Egenskaper) och anpassades till Platsen (markobjekten markeras där, samma
utsnitt efter varje byte, dokumenten jämförs utan Platsen mot äldre
byggen). Den visade inget fel i koden; tre saker i skriptet rättades
(*Båge* i Mark ligger kvar från rampen, så den sätts i stället för
växlas; zoomen efter bytet från 3D; klicket på det vridna hålet låg
utanför hålet och snäppte till bjälklagets kant, så *Spegla* vände hela
bjälklaget kring kanten — rätt beteende, fel klick; och stegen för
0.10.23 ritade takfallet på Platsen, dit stödmuren fört vyn — husets
verktyg spärras inte där, en fråga till Carl August). Mot 0.10.25 skiljer bara de
avsiktliga stegen (dialogen Filtrera, fasadmarkören runt bågen); mot
0.10.22.1 skiljer bilderna från *släpp platsen*, eftersom markobjekten
inte längre ritas på Plan 1, men dokumenten är lika.*

*Claudes val:* `reversedChain` behåller första hörnet när en kontur vänds
moturs (testet för 0.10.17 låste den gamla ordningen utan skäl).
`dimWall.nearWall` använder samma räckvidd som kedjans eget test, så
resultatet är detsamma.

### 0.10.26 Rampen och stödmuren ✓

Inkorgen 29 oktober, före materialen på Carl Augusts begäran ("Ta rampen
och stödmuren först, sen 3D-kontroller och sen material"). Byggd samma
dag, samma format (22): de nya fälten är frivilliga.

- **Slänt per sida** på rampen (`leftSlope`, `rightSlope`); tomt följer
  rampens `slope`, som också gäller ändarna
- **Marken längs en stödmurskant** följer rampens kontur skarpt och går
  rakt ned till befintlig mark (den var vågig: rutnätets trianglar tonade
  över kanten)
- **Stödmurens skarvar**: kantlinjerna i 3D bara i ändarna och i riktiga
  hörn

*Claudes val:* de skarpa kanterna gäller alla ramper och markytor (inte
runt huset och under bjälklag), också slänternas kanter, där slänten nu
börjar vid kanten i stället för en ruta in. De räknas inte in i den
färdiga marken (rutnätet) utan läggs på där den ritas: 3D-nätet skärs
längs konturen, marklinjen i sektionerna och linjerna på marken i 3D
läser höjden med kanterna. Utanför en stödmurskant ligger marken som den
var utan objektet (de andra objektens ändringar kvar). Planens
höjdkurvor, slänternas markeringar och volymerna räknas som förut på
rutnätet. Ett hörn på stödmuren får en kantlinje när muren viker mer än
20°. En stödmur kunde redan ha riktiga bågar (*Båge* i verktyget Mark och
Böj i Modifiera, sedan 0.10.19); det som syntes var kantlinjerna i varje
utplattad punkt.

*Gjordes inte:* höjdkurvorna i planen vid en stödmurskant (de följer
rutnätet och kan ligga en ruta fel; i 3D tas de bort där), och
lodytan har ingen egen kulör (markens). Ingen knapp som gör om en
stödmur ritad med många punkter till bågar (frågan om 0.10.24 gäller
också den). Klickjämförelsen kördes inte.

### 0.10.27 Styrningen i 3D ✓

Inkorgen 29 oktober. Byggd samma dag, samma format (22). Som i ArchiCAD:

- **Mittenknappen panorerar**, Shift + mittenknappen snurrar (orbit)
- **Vänsterklick markerar**, och ett vänsterdrag är en markeringsruta som
  i planen: från vänster till höger det som ryms helt, från höger till
  vänster allt som nuddas
- **Högerklick öppnar menyn** (högerdrag panorerade förut)
- **Utan mittenknapp**: Mellanslag + dra panorerar och Mellanslag +
  Shift + dra snurrar (Carl August sa "kör" på Claudes förslag)

*Claudes val:* rutan jämför objektets omslutande rektangel på skärmen
(hörnen räknade till skärmen), som planen gör med sina rektanglar; ett
objekt som delvis ligger bakom kameran ryms aldrig helt, och det en
sektion klipper bort räknas inte. Markobjekten tas med sina konturer på
marken, rummens golv inte (som med ett klick). Shift eller Ctrl lägger
till, som i planen. Ett drag som börjar på något markerat flyttar det som
förut, och greppen dras som förut. Dubbelklick med mittenknappen visar
hela modellen, som i planen. Ctrl + mittenknappen snurrar också
(kamerastyrningen gör så). Med fingret snurrar vyn som förut (telefonen
är inget mål). En tipsrad om styrningen visas när 3D-vyn öppnas första
gången i en session.

*Gjordes inte:* ingen förhandsvisning av vad rutan tar medan den dras
(planen har ingen heller). Ingen inställning för knapparna.

### 0.10.28 Material, mark först ✓ · *nytt format*

Beslutat 28 oktober (svaren A–E). Byggd 29 oktober på "kör nästa
version", delad som överlämningen föreslog: marken nu, bjälklag och tak i
0.10.28.2 (förut 0.10.28.1). Format 23 (projekt från 0.10.27 öppnas inte).

- Ett material i stilmallen: namn, kategori (mark först) och representation
  per vykategori: planen (fyllningen, med opaciteten), illustrationsplanen
  (färg, opacitet) och 3D (kulör)
- Objektet pekar på ett material eller har *Eget*; *Fyllning* heter
  *Material* för markobjekten; opaciteten och vridningen går att överstyra
  per objekt. Mönstrets utgångspunkt (första hörnet) och status är objektets
- Fyllningspanelen är redigeraren för planrepresentationen; förslagen Gräs,
  Grus, Hårdgjort och Vatten och de sparade fyllningarna blev material
- Markyta, slänter, ramp och stödmur. Väggar med lager i 0.11.1

*Claudes val:* objektet behåller en kopia av planens fyllning (som de
sparade fyllningarna), så att ett borttaget material lämnar det som
syntes. Det man ändrar i panelen för ett objekt med material ändrar
materialet (alla objekt med det); vill man ändra bara ett objekt väljer
man *Eget*. Ett nytt projekt har åtta markmaterial: Gräs, Grus, Asfalt
(förut Hårdgjort), Plattor 300, Tegel, Vatten, Betong och Mark, med
färger för illustrationsplanen och 3D. Tegel, Betong, Plattor 300 och
Mark finns kvar som förslag för egen fyllning (för detaljer i 2D).
Materialen visas för alla objekt med fyllning (2D-former och rum ser
alla), men markobjekten ser bara markens. Stödmuren ritas snittad med
materialets fyllning och konturen 0,35, och svart utan material. I 3D
färgas marknätets trianglar efter sin mitt, markytor och ramper ovanpå
sina slänter. Illustrationsplanens förinställning döljer marken (sedan
0.10.25), så 3D visar ingen mark i den vyn.

*Gjordes inte:* brytlinjen har ingen yta och fick inget material. Snittet
och vyn i sektion och fasad (fälten i materialet kommer med bjälklag och
tak i 0.10.28.2; marken i sektionerna är jorden, som förut). Ingen lista
över materialen i stilmallens dialog (frågan om 0.10.14). Slänternas
yttre kant i 3D följer rutnätet. Klickjämförelsen kördes inte.

### 0.10.28.1 Materiallistan ✓ · *nytt format (24)*

Svaren 29 oktober på frågorna om 0.10.28 (planeringssessionen på
eftermiddagen, som också satte ordningen nedan). Byggd 29 oktober. Format 24
(projekt från 0.10.28 öppnas inte): kategorin blev två kryssrutor.

- En gemensam materiallista i stilmallens dialog: byta namn, ta bort, ordna
  och lägga till; kryssrutorna *Mark* och *Byggnad*, och listan i panelen
  visar de material som passar objektet
- Fler material i ett nytt projekt: Jord, Stenmur, Singel, Täckbark, Trall,
  Planteringsyta, Stenmjöl, Gatsten och Aluminium. Betong, Tegel och Trall
  båda; Aluminium byggnad
- Panelen som i 0.10.28: en ändring ändrar materialet för alla, om man inte
  väljer *Eget*
- Stödmurarna ritas ovanifrån utan snitt i Platsens vyer, med materialets
  ytfyllning
- Marken i 3D i alla Platsens vyer, också illustrationsplanen
- Orbit med Shift och mittenknappen i valfri ordning

*Claudes val:* listan står först i stilmallens tredje kolumn (Material,
linjetyper och fyllningstyper), en rad per material med namnet, pilarna
och *Ta bort* överst och kryssrutorna och tre färger under: planens
färg (fyllningens, eller mönstrets linjer), illustrationsplanens och
kulören i 3D. Mönstret i planen ändras i objektets panel, som i 0.10.28;
listan har ingen egen redigerare för det. Ett nytt material är grått,
helt och för marken; ett material som sparas ur en 2D-form får inga
kryssrutor (bara 2D-former och rum ser det tills man kryssar). Fyra nya
inbyggda fyllningstyper för de nya materialen: Gatsten 100 (i förband),
Stenmur (stora block), Trall (brädor 145) och Singel (prickar på
papper). Stödmuren utan material på Platsen är bara konturen (förut
svart). På Platsen tänds marken i 3D fast *Höjdkurvor* är släckt under
Visa; kurvorna i 3D släcks då. Shift mitt i ett drag byter mellan
panorera och snurra från där pekaren står, åt båda hållen (släpps Shift
panoreras vyn igen).

*Gjordes inte:* ingen redigerare för planens mönster i listan.
Klickjämförelsen kördes inte (inget i husets verktyg ändrades).

### 0.10.28.2 Material på bjälklag och tak ✓ · *samma format (24)*

Delad ur 0.10.28 (29 oktober). Mellanstor. Byggd 29 oktober.

- Materialet på bjälklagen och taken (kulören i 3D, fyllningen i planen),
  ur byggnadsmaterialen i listan
- Snittet i sektion (snittfyllning) och vyn i fasad (ytfyllning, kan vara
  tom) i materialet
- Materialets konturpenna i planen

*Claudes val:* inget nytt format: snittet, ytan och pennan är valfria fält
i materialet, och fyllningen och `material` ligger i bjälklagets och
takets parametrar som i rummen. Panelen *Material* för bjälklag och tak
visar byggnadens material; under materialet *Sektion, fasad och kontur*
med tre listor (snittet: *Som stilmallen*, hel färg, skraffering, kors
eller en fyllningstyp; ytan likadant men *Ingen* som förval; konturen:
*Stilmallens* eller en tjocklek) och färgerna. Samma fält i
materiallistan för material med *Byggnad*. Bjälklaget fylls i planen
under snittet (golvet sett uppifrån; det kan bli mycket mönster, men så
gör ArchiCAD), taket där det ligger helt under snittet och hela taket på
Platsen; fyllningen går inte att klicka på, så att ett klick i ett rum
inte markerar bjälklaget. Snittet ersätter stilmallens fyllning för det
som är kvar och nytt, med papperet under och konturen 0,35, men inte för
det som rivs. Ytan gäller fasader, inte sektionernas vy bortom snittet,
och räknas exakt mot det som ligger framför (trianglarna klipps mot ytans
plan, som de dolda linjerna). Mönstret utgår från en punkt per objekt,
så att bitarna av en yta ser likadana ut. Pennan gäller konturen under
snittet; över snittet streckprickat som förut. Nya material: Takpannor
(linjer var 350 mm) och Plåt (falsar var 600 mm), med ytan i fasaden; Betong och
Tegel har sina mönster som snitt, Aluminium grått.

*Gjordes inte:* ytan i sektionernas vy bortom snittet. Materialets penna
för markobjekten. Mönstrets mått (vinkel, avstånd, skala) för snittet och
ytan går inte att ändra; förvalen gäller. Klickjämförelsen kördes inte (husets verktyg ändrades inte).

### Granskning efter 0.10.28.2 ✓ (0.10.28.3)

Mellanstor. Inga nya funktioner utöver dessa:

- Rampens start- och sluthöjd läser den färdiga marken under klicket
- Stödmurens krön ligger jämnt med rampens kant
- Markmodellen förtätas där markobjekt ritas (foten i tänder)
- Markobjekten flyttar inte när en våningshöjd ändras

*Gjord 29 oktober, samma format (24). Det syns, så den heter 0.10.28.3.
Testerna: 707, ca 13 s. **Rampens höjder**: verktyget Mark läser den
färdiga marken (`finishedTerrain` i tillståndet som ritas i) för ramper,
gångvägar, brytlinjer och markytornas förslag; utan markobjekt den
befintliga som förut. **Krönet**: `wallProfile` (nu i
`elements/wallProfile.ts`, för att inte dra en cirkel mellan
`groundGeometry` och `crispGround`) läser marken genom `crispHeight`, de
skarpa kanterna från 0.10.26, så att en punkt 0,7 m in på rampen får
rampens exakta höjd i stället för rutnätets tolkning mellan en nod på
rampen och en utanför; det var det som gjorde avståndet till kanten
ojämnt. Utjämningens fönster (±1 m) krymper symmetriskt nära ändarna, så
att krönet inte ligger 50 mm fel i början och slutet av en mur på 1:10.
**Tänderna**: i stället för att förtäta rutnätet (det hade gett mindre
tänder, inte inga) skärs marknätet längs stödmurens båda kanter som längs
rampernas (`crispShapes` får en form per stödmur, utan lodytor), och
höjden på kanten tolkas ur noderna på samma sida om muren
(`groundBeside`: alla fyra noder som vanligt, tre som ett plan, annars
viktat efter avståndet). Marken utanför muren blir då en jämn yta fram
till muren, och marklinjen i sektionen får ett steg vid muren. Provat i
Playwright mot `dist/` i 3D: foten och krönet raka längs en ramp med
stödmur. **Våningshöjden**: markobjekten på Platsen har sina höjder från
±0 och Platsen flyttas inte (`storeyPatch` sedan 0.10.25); ett test låser
det. Platån runt huset följer golvet som den ska. Om Carl August sett
något flytta behövs en skärmbild. **Städat**: kamerastyrningen i 3D
(mellanslag, Shift mitt i draget, dubbelklick med mittenknappen) ligger i
`view3d/navigation.ts` (`view3d.ts` 621 → 564 rader). Referensbilderna
för markprojektet uppdaterade (stödmurens krön och fot).*

*Gjordes inte:* klickjämförelsen (inget husverktyg ändrat). Höjdkurvorna i
planen räknas som förut på rutnätet.

### 0.10.29 Ritandet ✓

Liten till mellanstor. Shift låser vinkeln man står i; Förskjut med
skrivet värde och avståndet grafiskt vid objektet; verklig och lokal höjd
i våningslistan; Kanter i Förskjut som skrivet antal (fråga 0.10.17,
Carl August 29 oktober: ja).

*Gjord 29 oktober, samma format (24). Testerna: 712, ca 20 s. **Shift**:
`snap()` fångar riktningen när Shift trycks (`held` i `snap.ts`, ur en
snäppning utan Shift) och håller den tills Shift släpps, kedjan får en ny
punkt eller verktyget byts. Claudes val: ett vinkellås (15°-steg,
parallellt eller vinkelrätt mot linjen man känt på) eller en punkt man
snäpper till ger exakt den riktningen, fritt avrundas till hela grader;
markören får gå bakåt längs linjen (riktningen vänds); skärningar och
spårlinjer längs låset snäpps som förut. Gäller alla ritverktyg, Flytta,
greppen och 3D (samma `snap`). **Förskjut**: valen med `atObject` i
`opDefs.ts` (Förskjut, Förskjut kant, Parallell kopia, Förskjut alla
kanter; Claudes val att Parallell kopia och Förskjut alla kanter följer
med) har inget värdefält i smartmenyn. Siffrorna går genom
`Modifier.typeKey` till `ModifyTool.typing` och visas i måttet vid objektet
(`offsetDimension` i `tools/overlay.ts`: en linje med snedstreck från
klicket på kanten till där kanten hamnar, etiketten i accentfärg medan man
skriver). Enter utför åt markörens sida; ett klick med något skrivet
använder värdet åt klickets sida. **Kanter**: ett textfält (`parseEdges`:
heltal, tomt, 0 eller *Alla* = alla); `edgeRun` tar `toward`, och ett
jämnt antal får den extra kanten mot den sida av kantens mitt där
markören är. **Våningslistan**: `storeyLevels` i `navigator.ts`, "Plan 1
– +63,525 / 0,000" med plats, "Plan 2 – 3,000" utan (Carl August: med
tankstreck, så att våningen inte blandas ihop med höjden), på samma rad
som namnet. Provat i Playwright mot `dist/`: Förskjut med 1200 + Enter,
måttet vid väggen, våningslistan.*

*Gjordes inte:* klickjämförelsen (Shift-låset ändrar inget klick utan
Shift). Platsens rad i listan har kvar *markmodell* / *plan mark* utan
tankstreck.

### 0.10.30 Teckenförklaring ✓

Beslutat 28 oktober. Liten till mellanstor. Ett automatobjekt på bladet som
läser materialen hos synliga objekt i bladets vyer och ritar en ruta med
mönstret i vyns skala och namnet; kategorier, ordning, rutans storlek,
egna och bortvalda rader, och *Eget* som "Eget" eller inte alls. Med tre
småfixar från Carl August 29 oktober: kalkera en våning från
projektträdet utan vy, *Ny vy* från en modellflik, och webbläsarens meny
bort där högerklick inte gör något.

*Gjord 29 oktober, samma format (24; en ny elementtyp med egna fält
behöver inget nytt format). Testerna: 716, ca 16 s. **Teckenförklaringen**
är elementtypen `Legend` (`elements/legend.ts`), på bladet som
skalstocken. `buildSheet` räknar `legendSources` ur vyernas ritade
primitiver (objekten bakom dem, så att dolt och bortklippt inte räknas)
och skickar dem i `ViewStates.legend`, bara när bladet har en
teckenförklaring. Claudes val: rutan 10 × 6 mm, text 2,5 och rubriken
TECKENFÖRKLARING 3,5 fet; mönstret i den första vyns skala där materialet
syns, med vykategorin (en illustrationsplan ger materialets färg);
*Alltid* och *Aldrig* per material i stället för fria rader; egna
fyllningar som en rad "Eget" per olika fyllning; ett blad med bara Platsen
får *Markens*. **Kalkera**: `TRACE_STOREY` + våningens id i `trace`
(`tracedStorey`), i våningens och Platsens meny och under Visa (varje
våning, också från Platsen). Fasader och sektioner kalkeras inte (inget
kalkeras i dem). **Ny vy…**: `newViewOf` i `views.ts`, det som visas nu
för våningen eller markören. **Webbläsarens meny**: en lyssnare på
`document` i `menus.ts` som stoppar den utom i textfält, på länkar och på
markerad text. Provat i Playwright mot `dist/`.*

*Gjordes inte:* vykategorier för planer, fasader och sektioner (Mått och
littera, Undertak, Golvplan/ytskikt) med egna och omdöpta kategorier: de
hör till utredningen om stilinställningar per vytyp, eftersom en kategori
är en förinställning; *Undertak* (spegelvänd plan sedd underifrån) kräver
en egen ritning och läggs där som egen punkt.

### 0.10.31 Texturer i 3D och ortofotot på marken ✓

Beslutat 28 oktober (svar E: före piloten). Mellanstor. En bild i
materialets 3D-representation, sparad i filen och upprepad i meter på
markobjekten; kulören där texturen saknas. Ortofotot draperat på marken,
också den ändrade; först undersöks om det inte följer med från Höjdkurvor
eller tappas här. Hör ihop med trädens detaljnivåer.

*Gjord 29 oktober, samma format (24; valfria fält). Testerna: 724.
**Undersökningen:** ortofotot tappades inte här. Höjdkurvor skickar det
aldrig: platspaketet (`Utbyte.platspaket`) har inget fält för det, och
Höjdkurvors överlämning har "ortofotot som underlag i cad-apa" bland
obeslutade idéer. Ortofotot finns i Höjdkurvors zip (`ortofoto/…jpg` med
`_sweref.jgw` och `_lokal.jgw`) och i `senaste.ortofoto` (`bild` som
data-URL, `x0`/`y1` pixelns mitt, `s`, `W`, `H`, `ar`). **Här:**
platspaketets valfria fält `ortofoto` med just de fälten
(`PaketOrtofoto` i `core/siteOrtho.ts`), och för hand bilden med
världsfil i Platsens dialog. `site.ortho` har bildens kanter i zonens
koordinater; `orthoUvMatrix` ger 3D-vyn en affin avbildning från planens
mm till bilden, så att den fungerar med vridning. **Texturen:**
`material.texture` = `{ asset, size }` (mm), en fil i projektet som
underlagen. Marknätets grupper (`colorGroups`) skiljer på kulör och
textur (`lookKey`); kropparna (stödmur, bjälklag, tak) får `texture` och
UV i 3D-vyn (`boxUv`: liggande ytor planens x och y, stående längs ytan
och höjden). Claudes val: ortofotot *Där marken saknar material* som
förval (materialen går före), högst 4096 px för ortofotot och 1024 px för
en textur (nedskalade vid inläsning), bildens sida 1 000 mm som förval
och i mm som andra mått, en världsfil med små tal läses som Höjdkurvors
lokala (meter från nollpunkten, utan vridning) när zonens inte hamnar
över platsen, och en ny bild behåller storleken. Provat i Playwright mot
`dist/` (ortofotot och tegeltexturen på rätt ställe uppifrån, dialogerna,
bildvalet).*

*Gjordes inte:* Höjdkurvors sida (två rader: `ortofoto: s && s.ortofoto`
till `Utbyte.platspaket` i `app.js`, och fältet i `platspaket` i
`utbyte.js` med licensen) hör till Höjdkurvor och görs i en session där;
till dess läggs ortofotot in ur zipen. Ortofotot i 2D (illustrationsplan
på flygfoto) hör till utredningen om underlag i vyn. Texturer på väggar,
rum och andra objekt kommer när materialen utökas till alla objekttyper.
Stilmallen som fil tar inte med texturerna (bilderna bor i projektet).
Trädens detaljnivåer i 0.12.1.

### Utredning: stilinställningar per vytyp och underlag i vyn ✓

Planeringssession 29–30 oktober (ingen kod). Besluten och mockupen står i
synpunkterna (`cad-apa-synpunkter.md`, *Beslut 29–30 oktober*) och i
Claude Design "Stilinställningar – mockup" (tavla 5 är utseendet som
gäller). Uppdelningen i sju versioner, A–G, allt före 0.11; F kan skjutas
in var som helst efter A, och bara A ger nytt format:

- **A. 0.10.32 Tre nivåer med arv** (stor, nytt format)
- **B. 0.10.33 Avvikelser och kategorier i vyn** (mellanstor): ockra
  prick och *Återställ* per rad, *Visa bara avvikelser*, *Återställ till
  kategorin*, *Gör avvikelserna till kategorins förval*, *Spara som ny
  kategori*, punkt efter vynamnet, *Stil för den här vyn…*, *Vyer med den
  här kategorin*, *Ny vy…* som föreslår kategorier
- **C. 0.10.34 Radkontrollerna** (tavla 5; mellanstor; bara utseende) ✓
- **D. 0.10.35 Underlag i vyn** (stor): en våning, Platsen, ortofotot i
  2D, ett arbetsblad, en annan vy, DXF/bild; marken i 2D och 3D per kategori ✓
- **E. 0.10.36 Pennor och ställen** (tavla 3; mellanstor; med penn- och
  linjesystemet) ✓
- **F. 0.10.39 Projektet › Allmänt** (mellanstor; förut 0.10.37) ✓
- **G. 0.10.40 Stilboken ut och in** (mellanstor; förut 0.10.38) ✓

Före F och G (Carl August 30 oktober, svaren på frågorna om 0.10.36):
**0.10.37 Snitt- och konturlinjer i planen** ✓ och **0.10.38 Snitt- och
konturlinjer i fasader och sektioner** ✓, se nedan.

### 0.10.32 Tre nivåer med arv ✓ · *nytt format (25)*

Projektets resurser → vykategori per vytyp → enskild vy, med avvikelser
rad för rad. Stilmallens dialog byggd om till vänsterkantens struktur och
kategoriflikarna. Radkontrollerna är de gamla tills C.

*Gjord 30 oktober. Testerna: 735. Stilboken (`StyleBook`) ersätter
stilmallen i projektet: resurserna och `categories`. Vyn har `category`
och `overrides` i stället för `compare`, detaljnivåerna, `hide`,
`hideDemolished` och `style`; renderarna får en `StyleSheet` som förut
(`sheetFor`). Se UTVECKLING.md, *Stilboken*. Claudes val: pennorna ligger
i kategorierna tills E (de är i praktiken ställen med värden; markörernas
penna i egenskaperna ändras i alla kategorier, som förut i hela
projektet); vyns skala är vyns egen, kategorin har *Skala för nya vyer*;
förinställningarna (Svensk standard, Poché, Färgmarkerad) finns under
*Kopiera från* och ger bara stilen; en fasad, sektion, Platsen eller ett
arbetsblad utan vy får vytypens första kategori och dess visning när man
går dit (förut följde Visa med mellan alla ställen); ändras kategorin
följer visningen med, och det som ändrats under Visa är kvar; en vy som
byter kategori i egenskaperna tar den nya som den är (stilens avvikelser
kvar); en borttagen kategoris vyer får vytypens första; *Importera…* och
*Exportera…* i rubrikraden tar redan hela stilboken (G lägger till
*Mall för nya projekt*), och en äldre stilmall ger sin stil till den valda
kategorin. Ordet *stilmallen* i appen heter *stilboken*. Provat i
Playwright mot `dist/` (dialogen, flikarna och verktygen, Visa,
projektträdets formulär, bladet med Skiss och jämförelsen).*

*Gjordes inte:* allt som hör till B–G (prickarna, *Stil för den här
vyn…*, de nya radkontrollerna, underlagen, ställena, Allmänt med
projektets uppgifter, mallen för nya projekt). *Allmänt* har bara
stilbokens namn. Pennorna visas alla i varje vytyp (filtreras med
ställena i E). Öppningsmarkeringens bredd har fortfarande inget fält.

### 0.10.33 Avvikelser och kategorier i vyn ✓

Ockra prick och *Återställ* per rad, *Visa bara avvikelser*, *Stil för
den här vyn…*, *Återställ till kategorin*, *Gör avvikelserna till
kategorins förval*, *Spara som ny kategori*, punkt efter vynamnet, *Vyer
med den här kategorin*, *Ny vy…* med kategorierna, Poché och Färgmarkerad
som egna kategorier och *Ortofoto* bland markobjektens material.

*Gjord 30 oktober. Testerna: 744. Samma format (25); `ortho3d` på
markobjekten är ett valfritt fält. En vys stil i stilboken är kategorin
som vyn ser ut med (`effectiveCategory`); det man ändrar där räknas om
till avvikelser (`overridesFrom`), så att det som inte längre avviker
försvinner. Se UTVECKLING.md, *Avvikelser och kategorier i vyn*. Claudes
val: en kategori jämförs med sitt förval (förvalskategorin med samma
nyckel, annars vytypens första; samma som *Återställ till förvalet*), en
vy med sin kategori. Pricken sitter på raderna som har ett fält:
visningens fält, kryssen under Innehåll, en åtgärds rad och en penna
(öppningsmarkeringens bredd har inget fält än). *Återställ* syns när
musen är över raden. I en vys stil finns inte kategorins skala, Platsens
sort och *Kopiera från*. *Gör avvikelserna till kategorins förval* frågar
när fler vyer har kategorin. *Spara som ny kategori…* lägger den direkt
efter kategorin. Ändras den öppna vyn i stilboken följer Visa med på de
rader som ändrades; det som ändrats under Visa och inte sparats är kvar på
de andra. *Ny vy* på en våning, fasad eller sektion: *Med det som visas
nu…* (som förut) och vytypens kategorier som de är, med kategorins skala;
namnet föreslås som "Plan 1 – Undertak". Nya kategorier i ett nytt
projekt: för planer *Mått och littera* (utan möbler), *Undertak* (1:50,
utan möbler, öppningssätt, littera och mått) och *Golvplan* (1:50, utan
möbler, öppningssätt och littera); Poché för planer och sektioner,
Färgmarkerad för planer, fasader och sektioner (Färgmarkerad är statusen i
färg: kvar grått, nytt rött, rivs gult streckat). Planens förval är kvar
först. *Ortofoto* visas bland materialen bara på markytor och ramper och
bara när platsen har ett ortofoto; objektet får det som syntes i planen
som egen fyllning, och i 3D ortofotot (markens eget utseende när
ortofotot är *Av*). Provat i Playwright mot `dist/` (prickarna i en vy och
en kategori, *Visa bara avvikelser*, *Återställ* på en rad med Visa som
följer med, *Spara som ny kategori*, listan, punkterna i projektträdet,
*Ny vy → Undertak…*).*

*Gjordes inte:* Undertaket ritas inte spegelvänt (ser uppåt); kategorin
har bara sitt innehåll. *Jämför med*, förhandsvisningen och de nya
radkontrollerna (C) väntar. Prickarna i vytypens rad i vänsterkanten och
på flikarna ("N ändrade" per flik) gjordes inte; antalet står i
verktygsraden och i listan.

### 0.10.34 Radkontrollerna ✓

Tavla 5 i mockupen: tjocklek, linjetyp och färg som runda knappar utan
rullgardinspil, tjockleksraden med eget värde, den sökbara
linjetypslistan med *Lägg till egen…*, färgpanelen med förval, favoriter
i set, färgfält, hex och opacitet, textvalsknapparna, ikonknappar för
återställ och ta bort, sök och *Vanliga/Alla* i panelen. Bara utseende.

*Gjord 30 oktober. Samma format (25); favoritseten är det valfria fältet
`colorSets` i stilbokens resurser. Testerna: 747. Knapparna läggs på de
vanliga fälten efter varje omritning (`ui/style/rowControls.ts`); fälten
finns kvar dolda och får `change`, så dialogens hantering är densamma.
Se UTVECKLING.md, *Radkontrollerna*. Claudes val: knapparna gäller hela
stilboken (pennor, åtgärder, visning, material, fyllningstyper, texter),
inte panelerna för objekt; tjocklekens rad har de vanliga tjocklekarna
(0,13–1,40 och Ingen där den finns) och *Eget* med Enter; färgpanelens
förval är svart, grått, ljusgrått, vitt, rött, ockra och blått; plus
lägger färgen i det valda setet (det första heter *Favoriter* om inget
finns), högerklick tar bort en favorit, och setet byts, döps om och tas
bort i listan i panelen; ett drag i färgfältet sätter färgen när knappen
släpps (en ångring per drag); opacitet finns bara där fältet har en
(åtgärdernas fyllning och bakgrund; pennorna har ingen); *Lägg till
egen…* lägger en linjetyp under Resurser och går dit; sök gäller raderna
i den del som visas; *Vanliga* är förvalet och döljer *Snittet i planen*
och några kryss under Innehåll (husets kontur genom taket, tak på andra
våningar, de streckade dolda linjerna, 3D-vyns linjer och slänter, branta
slänter, beräkningsgrundande fasad, höjdmått, byggnadshöjd, taklutning,
underlag), men aldrig det som är ändrat; resurserna har ingen *Vanliga*.
Pennans egen återställningsknapp (till programmets förval) döljs när
raden har prickens *Återställ*. Provat i Playwright mot `dist/` (alla
tre panelerna på en penna, färgpanelen kvar efter en ändring, favoriter,
draget i färgfältet, textval i åtgärderna, sök, *Lägg till egen…*,
mörkt tema).*

*Gjordes inte:* mockupens ikonknappar för export, import och mall i
rubrikraden (G), förhandsvisningen och *Jämför med* (efter piloten). Visa-
menyn har kvar sina kryssrutor utan symboler (samma nycklar som
knapparna). Panelerna för objekt (egenskaper, smartmenyn) har kvar sina
listor och färgfält.

### 0.10.35 Underlag i vyn ✓

Underlag som del av vyn: en våning, Platsen, ortofotot i 2D, ett
arbetsblad, en annan vy, DXF/bild; under/över, tonad/gråskala/konturer,
procent, *Lägg till underlag…*; följer med till bladet. Dagens Kalkera
blir en genväg som lägger ett underlag. Marken i 2D och 3D per kategori.
Provet: illustrationsplanen på flygfoto.

*Gjord 30 oktober, i en session. Samma format (25); underlagen är det
valfria fältet `underlays` i kategorins visning, och vyns avvikelse
`underlays`. Testerna: 755. Underlagen ritas av `repr/viewUnderlays.ts`
(källans primitiver med underlagets utseende, ursprunget `ViewUnderlay`
utan objektets id); `buildViewPrims` lägger dem under och över vyn, och
`placeView` klipper dem mot ramen. Se UTVECKLING.md, *Underlag i vyn*.
Claudes val: underlagen ligger i **kategorins visning** (en kategori som
Illustrationsplan kan ha ortofotot i alla sina vyer), och en vy avviker
med hela listan som en rad (pricken i stilboken, *Spara i vyn*);
källorna är våningen under och över (relativt där vyn står), varje
våning, Platsen, ortofotot (bara i planer och på Platsen), arbetsbladen
och de andra vyerna; en vy som är underlag ritas **utan sina egna
underlag** (ingen rundgång), och en våning med vyns tillstånd, detaljnivå
och dolda, utan markörer och norrpil (som kalkeringen); **DXF/bild** är
ingen egen källa: *Fil (DXF, PDF, bild)…* i menyn lägger in filen där
man är, som förut (filunderlagen syns i stället och på bladet redan); fyra
sätt: *Tonad* (förval), *Gråskala*, *Bara konturer* och *I en färg*
(kalkeringens egna färg, rött som förval); täckningen 40 % som förval
(kalkeringen hade 30 %) i steg om 5; över ritningen tas vita fyllningar
bort; bilder (ortofotot) blir grå i alla sätt utom *Tonad*; listan ritas
nedifrån och upp i den ordning underlagen lades till (ingen flyttknapp);
krysset *Underlag* under Visa gäller fortfarande bara filunderlagen;
**kalkeringen** i äldre vyer (`trace`) läses som ett underlag (inget nytt
format), och kalkeringens utseende i användarinställningarna är borta;
*Kalkera* i projektträdet lägger och tar bort källan där man är; på ett
blad och ett mallblad finns inga underlag under Visa (bladets vyer har
sina); underlagen hör till Visa, så att ett byte av vytyp utan sparad vy ger
kategorins underlag (förut låg kalkeringen kvar överallt). **Marken i 3D-vyn** är ett eget kryss (`terrain3d`, Platsens grupp);
*Marken* (`Terrain`) släcker höjdkurvorna och marklinjerna, och i en
våningsplan också marken i 3D, som förut. Snäpp mot underlagen är
kalkeringens inställning, med det nya namnet. Provat i Playwright mot
`dist/` (Visa med *Lägg till underlag…*, sättet, över och procent,
*Spara i vyn*, stilboken med ortofotot i Illustrationsplan, ortofotot på
Platsen i 2D) och klickjämförelsen mot 0.10.34.*

*Gjordes inte:* en flyttknapp för underlagens ordning, DXF/bild som egen
källa (en fil som bara hör till vyn), undertaket spegelvänt (efter
piloten). Illustrationsplanen har inget ortofoto som förval i nya
projekt; det läggs till i stilboken.

### 0.10.36 Pennor och ställen ✓

Tavla 3 i mockupen: pennlistan med nummer, prov och antal ställen,
sortering per rubrik (alla tabeller), ställena med sök och automatiska
taggar för vytyp och objekt, byt penna per ställe, *Gå dit*, *Flytta till
pennan…*, ta bort penna utan ställen; samma lista över ställen för
linjetyper, fyllningstyper och material.

*Gjord 30 oktober. Samma format (25); pennlistan är det valfria fältet
`penList` i stilbokens resurser. Testerna: 768. Se UTVECKLING.md,
*Pennor och ställen*. Claudes val: **en penna är en tjocklek och en
färg** med ett nummer; linjetypen hör till stället (den har en egen lista
under Linjetyper). **Ställena behåller sina värden** (kategoriernas och
vyernas penntabell och åtgärdernas kontur, som förut), och ett ställe hör
till pennan med samma tjocklek och färg; så ritas allt som förut, och
inget nytt format behövs. Pennor som ställena har men listan saknar
numreras efter de sparade, efter färg och tjocklek, och listan **låses**
vid varje ändring i stilboken, så att numren inte flyttar. En penna som
ändras tar med alla sina ställen; en ändring till en tjocklek och färg som
en annan penna redan har nekas (med ett meddelande om att flytta ställena
dit). En flytt ändrar inte pennorna (0,25: 59 → 57, 0,18: 169 → 171 i
provet). En penna utan ställen tas bort med papperskorgen, eller alla med
*Ta bort pennor utan ställen*. **Ställena** är kategoriernas pennrader
(de grupper som visas i vytypen) och snittets kontur per åtgärd
(våningar, fasader och sektioner), och i en vy de rader den verkligen
avviker på. Materialens konturpenna och objektens egna pennor är inte
ställen (de är objektens). **Taggarna**: vytypen (plan, platsen, fasad,
sektion, arbetsblad, och Platsens situationsplan, markplanering och
illustrationsplan; *vy* för en vy) och objektet och delen (vägg, dörr,
fönster, snitt, över snittet, mått, markör …); flera taggar ska alla
stämma. *Gå dit* går till raden i kategorin eller vyn i stilboken, som
blinkar (*Alla* slås på, så att *Snittet i planen* syns); i materialens
lista till objektet i ritningen. **Pennraderna per vytyp**: planens snitt
och rummen bara i våningar, höjdkurvorna i våningar och på Platsen,
dörrar och fönster i våningar, fasader och sektioner, markörerna
överallt. **Fasadernas och sektionernas linjer** (`FACADE_PENS`, förut
`PART_PEN` utan rader i stilboken) är en egen grupp, och deras linjetyp
läses nu (förut lästes bara tjocklek och färg). Pennans nummer står först
på varje pennrad i kategorierna och leder till pennlistan.
**Sorteringen** gäller varje tabell med rubrikrad (pennlistan, ställena,
typerna i panelen, bladets fält) och kommer ihåg sig per tabell under
sessionen, inte i filen; tal sorteras som tal. Provat i Playwright mot
`dist/` (pennlistan, en penna med taggen fasad, flytt av två ställen,
sortering på Ställen, *Gå dit*, linjetypernas ställen, färgen på en penna
som ändrar sektionsmarkören i alla kategorier).*

*Gjordes inte:* penn- och linjesystemet i ArchiCAD:s mening (snittlinje
och konturlinje per objekt, öppningarnas oskurna linjer styrda av
väggen, om *Symbol* följer *Snitt*) är inte ändrat; det är frågor till
Carl August i överlämningen. Pennor har inget eget namn (siffror, som
beslutat). Fyllningstypernas ställen tar inte med former och rum med
egen fyllning (de räknas i listan ovanför). Sorteringen sparas inte.

### 0.10.37 Snitt- och konturlinjer i planen ✓

Carl August 30 oktober (svar A–H på frågorna om 0.10.36). Stor, samma
format. Ställen per objekttyp i stället för dörrarnas och fönstrens
klasser *Snitt*, *Vy* och *Symbol*: snittlinje och konturlinje (det
oskurna) för vägg, dörr, fönster, bjälklag, tak, stödmur, möbel och rum,
och sammansatta objekt med flera (fönstrets karm i snitt och kontur, båge,
glas, bleck; dörrens karm, blad, slagbåge). Snittlinjen ger tjockleken,
åtgärden färg och streckning när jämförelsen är på. Öppningarnas oskurna
linjer (vägghålet) tar väggens penna. Den egna pennans *Symbol* följer
*Snitt* när den inte är satt. Över- och undersnitten är kvar som egna
ställen. Pennlistan får också materialens konturpenna, typernas och
objektens egna pennor som ställen (*Gå dit* till objektet). Linjetypen
hör till stället. Ändrade *Snitt*, *Vy* och *Symbol* faller bort (inga
migreringar). Blir den för lång: väggar, dörrar och fönster först.

*Gjord 30 oktober, i en session. Samma format (25); raderna är nya
nycklar i penntabellen. Testerna: 774. Se UTVECKLING.md, *Snitt- och
konturlinjer i planen*. Claudes val: **raderna finns där linjen finns i
planen**: väggens snittlinje (0,35) och konturlinje (0,13, linjerna
under fönstren), dörrens karm (snitt), blad (med glasningen) och
slagbåge, fönstrets karm (snitt), karm (kontur, under- och överkarmen
sedda uppifrån), båge och glas, bjälklagets, takets och stödmurens
snittlinjer, fast inredning (0,25) och lösa möbler (0,18 grå) som
konturlinjer, och rummens kontur (förut en egen grupp). Dörrens karm
(kontur) och fönstrets bleck ritas inte i planen och har ingen rad (de
kommer med fasaderna i 0.10.38). **Bjälklagens, takens och stödmurarnas
konturlinjer är *under snittet*-raderna** (svar H): det oskurna av dem
är det som ligger under snittet, så de fick ingen rad till. Grupperna:
*Väggar*, *Dörrar*, *Fönster* och *Bjälklag, tak, stödmurar, möbler och
rum*, bara i våningar. **Snittlinjen**: `applyStyle` i planen tar
tjockleken ur objekttypens rad (`cutRowOf`: bjälklag, tak, stödmur,
annars väggens; igensatta hål är väggens); med jämförelsen på färg och
streckning ur åtgärdens kontur, utan jämförelse radens färg (eller
åtgärdens när raden är svart) och linjetyp (åtgärdens streckning går
före). En åtgärd utan kontur ritar ingen snittlinje, som förut.
**Åtgärdens färg går före radernas** när jämförelsen är på och åtgärden
har en färg (Färgmarkerad), också på blad, glas och möbler (förut höll
en färgad rad sin färg). Åtgärdernas kontur har ingen tjocklek i
gränssnittet och är kvar som ställe (den gäller fasaderna och
sektionerna tills 0.10.38). Materialets snitt i planen ritar konturen
som snittets (efter mönstret, åtgärdens färg); i sektionerna som förut.
**Hålets oskurna kanter** (under fönstren) hör till väggen i ritningen
(`origin` = väggen), så att väggens egen penna gäller dem; hålets kanter
över och under snittet (`uncutOpening`) har kvar *Dörrar och fönster
över/under snittet*. **Symbolen** följer den egna pennans övre del fält
för fält. **Fasadernas öppningssätt** läser bara sin rad (förvalet är
detsamma). **Egna pennor som ställen**: materialets konturpenna när den
är satt, och varje del (snitt, symbol, över snittet) av en typs eller ett
objekts egna penna som har en tjocklek (penna) eller linjetyp; en del med
bara en färg är inget ställe. *Gå dit* för en typ markerar typens objekt
på den förstas våning. Provat i Playwright mot `dist/` (grupperna i
Våningar › Plan, väggens snittlinje 0,7 i planen, ett objekts egna penna
i pennlistan och *Gå dit*).*

*Gjordes inte:* fasadernas och sektionernas linjer (0.10.38), dörrens
karm i kontur och fönstrets bleck i planen, taklinjerna i snittzonen
(de har takets penna under snittet som förut).

### 0.10.38 Snitt- och konturlinjer i fasader och sektioner ✓

Mellanstor, samma format. Fasadernas och sektionernas linjer
(`FACADE_PENS`) läggs ihop med objektens snitt- och konturlinjer från
0.10.37. Carl August 30 oktober: planens och fasadens rad för samma del
(t.ex. karmen) är två ställen, så att de ställs in var för sig.

*Gjord 30 oktober, i en session. Samma format (25); raderna är nya
nycklar i penntabellen. Testerna: 777. Se UTVECKLING.md, *Snitt- och
konturlinjer i fasader och sektioner*. Claudes val: **grupperna är
planens** (*Väggar*, *Dörrar*, *Fönster*, *Bjälklag, tak, stödmurar,
möbler och rum*) och visas i våningar, fasader och sektioner, men raderna
per vytyp: planens i våningar, fasadens (`…Elev`, egna förval) i fasader
och sektioner, och snittlinjerna (vägg, bjälklag, tak, stödmur) i
våningar och sektioner. Gruppen *Linjer i fasader och sektioner* är borta.
**Dörrar och fönster har var sina rader** för karm, glas, foder, skarvar
och öppningssätt (förut gemensamma); handtaget är dörrens, båge och bleck
fönstrets. *Skarvar* är karmens och bågarnas hörn och falsen (förvalets
text om skarven mellan befintligt och nytt stämde inte). **Linjer utan
del** (bjälklagens och andra formers kanter, förut 0,18 utan rad) har
*Bjälklag: konturlinje* och *Övrigt: konturlinje*, båda 0,18. Alla förval
är som förut, så ritningarna ändras inte. **Sektionernas snitt**:
`applyStyle` har ingen `plan`-flagga längre (snittlinjen gäller överallt);
snitten slås ihop per åtgärd, material och snittlinje, så väggar, bjälklag
och tak blir en yta så länge deras snittlinjer är lika (förvalen) och
delas när en av dem ändras. Materialets snitt ritar konturen som
snittlinje efter mönstret, som i planen. **Jämförelsen** ger åtgärdens
färg före radernas också i fasader och sektioner (förut bara planen).
**Åtgärdernas kontur** är ingen penna bland ställena längre (bara
linjetypen, under Linjetyper); färgen ändras under Åtgärder. Provat i
Playwright mot `dist/` (Fasader och Sektioner i stilboken).*

*Gjordes inte:* egna gruppnamn per vytyp (fasaden säger *möbler och rum*
fast rummen inte har någon rad där), en rad för taklinjerna i snittzonen.

### 0.10.39 Projektet › Allmänt ✓

Mellanstor, samma format (valfria fält). Carl August 30 oktober: stilboken
är det som återanvänds mellan projekt (kontorets uppgifter, typsnitt och
textstorlek, höjdsystem och decimaler, enheter, litterats siffror,
tjocklekstabellen); projektets uppgifter (namn, nummer, fastighet, skede)
ligger i projektet och visas under *Allmänt* men följer inte med
stilboken. Smarttext-taggarna läser från båda.

*Gjord 30 oktober, i en session. Samma format (25); `office` och
`general` i stilbokens resurser och `logo` på underlagen är valfria.
Testerna: 785. Se UTVECKLING.md, *Projektet › Allmänt*. Claudes val:
**kontorets taggar** heter `{företag}`, `{kontorsadress}`, `{telefon}`,
`{e-post}`, `{webb}` och `{ansvarig}`, plus egna; de är inga fält på
bladen (syns inte i bladets fälttabell), utom när projektet har ett fält
med samma namn, som går före när det är ifyllt (projektets *ansvarig*
finns som tomt förval sedan 0.8.10, så kontorets gäller tills man fyller i
den). **Projektnummer** är det gamla fältet *uppdragsnummer*, med den nya
inbyggda taggen `{projektnummer}`. **Skedet** under Allmänt gäller alla
blad när det är ifyllt (som kryss i *Projekt*); tomt har bladen sina egna,
och de som fanns före är borta (som när ett fält slutar gälla hela
projektet). **Logotypen** är en bild i projektets filer (högst 1 024 px);
*Lägg in logotypen här* i högerklicksmenyn på ett blad, mallblad eller en
stämpel lägger ett underlag med `logo: true`, 40 mm brett, som får den nya
bilden (lika bred) när logotypen byts; tas logotypen bort har de kvar
bilden. **Markhöjdernas decimaler och litterats siffror** flyttade från
Platsens dialog till stilboken; Platsens gamla värden gäller tills
stilboken har egna, och höjdsystemet tar Platsens (ur Höjdkurvor) som
förval. **Nivåmarkörernas decimaler** (tre som förut) är ett eget val.
**Enheter**: måttens enhet (mm 3450, cm 345, m 3,45 med två–tre
decimaler) och areornas decimaler (0–2, en som förut). **Textstorleken**
är textverktygets förval tills man väljer en annan höjd i verktygsraden.
**Typsnittet** är bara osifont (fler kräver inbäddning i PDF:en).
**Tjocklekstabellen** skrivs som tal med mellanslag och gäller listorna i
stilboken, panelerna och verktygen; en tjocklek som redan används syns
ändå där. Provat i Playwright mot `dist/` (fälten, logotypen, skedet, en
text med `{företag} · {skede}` och logotypen på ett blad).*

*Gjordes inte:* logotypens bild följer inte med stilbokens export (bilderna
bor i projektet; hör till 0.10.40, som texturerna), *RH 2000* i appens
egna texter (Platsens dialog, panelerna) följer inte höjdsystemet (bara
`{höjdsystem}` gör det), fler typsnitt, och panelens rubrik säger
*Underlag* också för logotypen.

### 0.10.40 Stilboken ut och in ✓

Mellanstor, samma format. *Exportera…*, *Importera…* och *Mall för nya
projekt* i rubrikraden; hela stilboken (Allmänt, vytyperna med kategorier,
resurserna). Projektets uppgifter följer inte med (Carl August 30
oktober). Svaren på de två frågorna (30 oktober): mallen ligger **i
webbläsaren, och en fil kan väljas vid *Nytt projekt***; mallbladen och
stämplarna **följer med som val** (förut parkerat).

*Gjord 30 oktober, i en session. Samma format (25); filens `assets` och
`paper` är valfria, och en äldre stilbok utan dem läses som förut.
Testerna: 792. Se UTVECKLING.md, *Stilboken ut och in*. Claudes val:
**bilderna** (logotypen, texturerna, bilderna på mallbladen) bäddas in i
filen som projektets filer (base64); vid import används en bild med samma
innehåll igen, andra får nytt id om deras är upptaget. **Kryssen**
(*Mallbladen*, *Stämplarna*) är ikryssade som förval och visas bara när
det finns något att kryssa; mallbladen tar alltid med stämplarna som ligger
på dem. **Import** ersätter stilboken som förut (projektets egna linjetyper
och fyllningstyper som filen saknar är kvar, pennlistan låses) och lägger
mallbladen och stämplarna bredvid de befintliga, med *(importerat)* efter
ett upptaget namn; logotyperna på bladen får filens logotyp, och bilder som
inget längre använder tas bort. **Mallen** ligger i webbläsarens IndexedDB
(samma databas som autosparet, egen nyckel), sparas med samma kryss och
har *Ta bort mallen*. **Nytt projekt** har en grupp *Stilbok*: mallen
(förval när den finns), Svensk standard och *Från fil*; mallens förvalda
mallblad ersätter exemplets (som tas bort), och ett projekt ur Höjdkurvor
får också mallen. Provat i Playwright mot `dist/` (export, mallen, nytt
projekt ur mallen, import med mallblad).*

*Gjordes inte:* mallbladens mappar i projektträdet följer inte med (de
hamnar överst i Ritningar), typerna (väggar, dörrar …) och vy-taggarna
följer inte med mallen, och ingen förhandsvisning av en fil innan den
importeras.

### Granskning efter 0.10.40 ✓ (0.10.40.1)

Liten till mellanstor. Inga nya funktioner; den senaste granskningen var
0.10.28.3, och 0.10.29–0.10.40 lade mycket i stilboken.

*Gjord 30 oktober, samma format (25). Inget syns i ritningarna; den
heter 0.10.40.1 för att versionsnumret syns i appen. Testerna: 792, ca
14 s (inga dubbla namn, inget test över 1,2 s; inget ändrat där).
**Uppdelat**: `ui/styleDialog.ts` 1 083 → 516 rader; kategorifliken,
pennlistan, resurserna och filhanteringen i `ui/style/` (se
UTVECKLING.md). **Snabbare**: materialens objekt räknas i ett svep
(`materialObjectsByMaterial`) i stället för ett per material (M × N vid
varje omritning av fliken Material); en ändring av ett ställe räknar
`stylePlaces` en gång i stället för fyra–fem; `editPlaces` grupperar utan
att kopiera listan per ställe; våningsnamnen slås upp i en Map.
**Dubbletter**: `slugId` i `core/ids.ts` för kategoriers och materials
nycklar; `changedRows` räknar stilens rader med `styleDiff`;
`viewKeys` och bladens jämförelse av vyinställningar använder `sameValue`
(nyckelordning spelar ingen roll) i stället för `JSON.stringify`;
`putPen` i `repr/penRows.ts` för både fältet i stilboken och ställena;
`plainPen` i `penPlaces.ts`; objekttypernas namn ur registret i stället
för en egen tabell; `extraFieldsOf` i `materials.ts`. **Borttaget**:
`placeRowExists`, `penRowShown`, `MATERIAL_USES`, `PRESETS`,
`updateCategory` (testet använder `putCategory`), en död ternär i
`rowControls.ts`; `materialFits` används i materialpanelen i stället för
samma villkor inline; ett tiotal `export` på sådant som bara den egna
filen använder. Provat i Playwright mot `dist/`: avvikelser och
återställ, innehållskryss, pennlistan med *Gå dit*, alla delar i
vänsterkanten, duplicera kategori, sök, exportdialogen; inga fel i
konsolen.*

*Gjordes inte:* `docs/PLAN.md` och `UTVECKLING.md` är över 4 000 rader
var; att flytta avsnitten före 0.10 till arkivfiler är ett förslag till
Carl August (liten). Klickjämförelsen (inget husverktyg ändrat).
Testerna rördes inte.
