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
villa i programmet.

Versioner som ändrar filformatet (`FORMAT_VERSION`) är stora uppdateringar;
de markeras med *nytt format* nedan. Däremellan kommer små uppdateringar
(0.6.1, 0.6.2 …) med justeringar som inte rör formatet.

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

## Framåt

Det här står kvar att göra, version för version. Allt som diskuterats och
bestämts ska stå här, så att arbetet kan tas upp av någon annan (eller i en
ny session) utan att något faller bort.

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

cad-apa riktar sig till svenska kontor och är på svenska. Allt som räknas
efter svenska regler (areor enligt SS 21054, byggnadshöjd och medelmarknivå
enligt PBF, rums- och dörrnumrering, hålmått) samlas i ett utbytbart
regelverk och inte utspritt i koden. Då kan ett annat land få egna regler
och egna ord längre fram utan att något skrivs om (se *Avvaktar*).

### Efter 0.7

Fasader och sektioner räknas exakt ur 3D-formerna. Det som återstår av dem
byggs vidare i takt med resten:

- Brutna sektionslinjer
- Fler nivåkoter, höjdmått och marklinje mot terräng (0.15)
- Fönster- och dörrsymboler i fasad efter typ (med smartobjekten i 0.12)
- Skuggor och djup i fasader

### 0.8 Ritningar, underlag och utskrift · *nytt format*

0.8 byggs i tre delar och släpps som 0.8.0 när alla är klara. Formatet höjs
en gång, i del 1, till format 5 för allt som 0.8 behöver. Demon visar del för
del.

Från granskningen av 0.7.1:

- 3D-vyn kan snurras under marken, för att se undersidor
- Rikta efter objekt gör både fasader och sektioner parallella med det man klickar på; Shift ger vinkelrätt
- Spara som vy föreslår namnet på det som visas (t.ex. "Fasad mot söder – Nytt")
- Synpunktsformuläret visar serverns felmeddelande i stället för att tyst öppna e-posten; e-post öppnas bara när skriptet saknas (som i demon)
- Projektträdet får en egen ikon: ett stående träd
- Växlaren 2D/3D/Båda svävar nere i mitten av vyn

#### Del 1: format 5, projektträdet, 2D-element och synlighet

- Format 5 med migrering 4 → 5 och test, för allt i 0.8 på en gång
- Mappar med undermappar i projektträdet, i alla flikar. Mapparna används också av Plot/export i del 3
- Det man markerar i projektträdet (vy, fasad, sektion, senare blad) visar sina inställningar i egenskapspanelen, med en Spara-knapp sist; ändringarna slår igenom först när man sparar
- Fasader och sektioner skapas med nya filer utan förklarande text. Fasaderna följer byggnaden tills man själv flyttar dem. *Lås* (med hänglås) är ett eget val som hindrar att en linje flyttas av misstag
- Snittytor i 3D: det som skärs av en öppen sektion får en fylld yta i snittet. *Följ sektionen* i 3D-vyn slår av och på klippningen

2D-element och synlighet:

- Linje, polylinje, båge, cirkel, rektangel, spline, fyllning och skraffering, med linjetyper och pennor
- Varje 2D-element (och text och mått) har *Visas i*:
  - *Alla vyer av våningen* (förval)
  - *Bara den här vyn*
  - *Utvalda vyer*: en lista med kryssrutor, där även andra våningars planvyer går att välja
  - *Vyer med taggar*: "alla" eller "någon av" taggarna, med "Syns nu i N vyer" som uppdateras medan man väljer och en varning om det blir 0
- Vy-taggar är egna; förslag att börja med: golvplan, undertak, möblering, bygglov, bygghandling, 1:50, 1:100. Det ersätter till stor del lager i vanlig 2D-CAD
- "Visa dolda 2D-element" för att hitta det som inte syns i den aktuella vyn

Mått och text i fasader och sektioner:

- Mått- och textverktygen fungerar i fasader och sektioner (i dag visas ett tips om att gå till planen)
- Taklutningen blir ett eget objekt: knuten till takfallet så att värdet stämmer, men fri att flytta, och med egen stil (markörstilarna i del 3)
- Automatiska höjdkoter för nock och takfot
- Grepp i sektioner: dra i nocken för att ändra taklutningen, och i takfoten

#### Del 2: underlag och arbetsblad

- Underlag: PDF (som bild), bilder och DXF. Skalan kalibreras genom att klicka två punkter och skriva avståndet. Underlaget kan flyttas, låsas och tonas, och visas i modellvyn och på arbetsblad. Snäpp mot linjerna i DXF-underlag
- Arbetsblad: fria 2D-ritningar som inte hör till ett våningsplan

#### Del 3: ritningsblad, export och grafik

- Ritningsblad A4–A0 med ritningshuvud enligt BH90 eller BEAst, egen logga och smarttext
- Flera vyer per blad, var och en i sin skala och med vyrubrik
- Annoteringsskala per vy, så att texthöjder på papper stämmer i alla skalor
- En andra 2D-ruta: planen bredvid en öppen sektion eller fasad, där det man markerar i den ena markeras i den andra

Plot/export (ett ställe för all export, i stället för att plotta från Ritningar och exportera från Vyer):

- Nås från cad-apa-menyn och från knappen *Plot/export…* under rubriken Projektträd, ovanför flikarna
- Kryssrutor grupperade efter mapparna i projektträdet: hela mappar eller enstaka vyer, fasader, sektioner och blad, från alla flikar
- Format per sak: PDF och DXF, även för layoutade blad. PDF-filerna får namn efter ritningsnumret
- Allt kommer som en zipfil att spara; exporten visar hur långt den kommit och kan avbrytas

Grafik:

- Penntabell i stilmallen: linjetjocklek och färg per sorts linje (hål, karm, båge, foder, sammanfogningar, glas, öppningssätt, marklinje …). I dag gäller fasta värden: 0,13 skraffering, glas och sammanfogningar; 0,18 mått, foder, möbler och detaljer; 0,25 karm, båge, dörrblad och konturer bortom; 0,35 hålens omfattning och fasadkonturer; 0,5 bärande snitt; 0,7 marklinje och sektionslinjens ändar
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

### 0.9 Tak · *nytt format*

Ett riktigt tak i stället för testtaket:

- Referenslinje som polygon; varje kant är takfot eller gavel
- Lutning per takfall, taksprång vid takfot och gavelsprång vid gavel
- Språngets tjocklek separat från takets
- Takfotens snitt: vinkelrätt mot takytan (förval), lodrätt eller egen vinkel
- Enfallstak som delar som kan sättas ihop
- Snabbval för sadeltak, pulpettak och valmat tak
- Ändra takets form i planen med Modifiera (finns för konturen sedan 0.7.1)
- Medelmarknivå utan terräng: markhöjder anges runt huset och medelmarknivån räknas ut enligt PBF
- Byggnadshöjd enligt PBF (medelmarknivå och 45°-planet); ur terrängen när den finns i 0.15

### 0.10 Text, ritningsredovisning och dumbs · *nytt format*

- Dumbs: snabba fria volymer för skisskedet. Rita en yta, dra upp den till en volym, tryck och dra i sidorna. Dumbs syns i plan, fasad, sektion och 3D som andra former men har inga egenskaper utöver mått och material. Friare formning (följ en bana, böjda ytor) kommer senare
- Textformatering
- Littera som går att flytta
- Handlingsförteckning ur bladen och ritningsnumrering
- Lagerprofil enligt SB11 i DXF-exporten

### 0.11 Förteckningar och rumsdata

- Rumslista med areor enligt SS 21054 (BOA, BRA, BTA m.m.), med standardens mätregler: väggar inom en enhet, smala nischer och ytor under låg takhöjd. Carl August laddar upp standarden när versionen påbörjas, så att reglerna följer texten
- Dörrförteckning enligt SS 817340 och fönsterförteckning, med förhandsbild
- Ytskikt som styrs av rumsobjektet (innerväggars sidor, ytterväggars insidor, sockel och taklist)
- Rumsbeskrivning
- Export till kalkylblad

### 0.12 Smartobjekt · *nytt format*

- Biblioteksformat för parametriska objekt; reglerna skrivs som uttryck, inte som kod
- Dörrar, fönster och möbler görs om till smartobjekt; möbelverktyget kommer
- Egna smartobjekt kan laddas in i projektet
- Byggaren för smartobjekt: en egen liten app med samma motor

### 0.13 Smartgrupper · *nytt format*

- Smartgrupper: ändrar man en instans ändras alla. För hotellrum och möbleringsgrupper
- Grupper, spegling och "gör unik"

### 0.14 Flera våningsplan, bjälklag och trappor · *nytt format*

- Våningsplan med egna höjder, bjälklag och trappor
- Mått för fri höjd och bjälklag i sektioner

### 0.15 Situationsplan, terräng och export

- Situationsplan med terräng och höjdkurvor från höjdkurvor.se
- Medelmarknivå, byggnadshöjd och nockhöjd ur markmodellen
- IFC-export

### 1.0 Bygglovshandling

En villa från nytt projekt till färdig bygglovshandling.

## Avvaktar

- Flyttbara knappar och verktygsrader ("ommöblering"). Avvaktar tills
  gränssnittet har satt sig, och behövs kanske inte alls: ett nytt program
  lärs lika gärna med den arbetsyta som tagits fram för det.
- Vektorsnäpp mot PDF-underlag (0.8 visar PDF som bild).
- Andra språk och andra länders regler. Allt är på svenska och följer svenska
  regler; regelverket hålls utbytbart (se *Regler per land*) så att det går
  att lägga till senare.
