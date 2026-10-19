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
fylls i av sig själv), *projektvinklar*, *vy-taggar*, *spårlinjer*,
*måttband*.

### Efter 0.7

Fasader och sektioner räknas exakt ur 3D-formerna. Det som återstår av dem
byggs vidare i takt med resten:

- Brutna sektionslinjer
- Fler nivåkoter, höjdmått och marklinje mot terräng (0.15)
- Fönster- och dörrsymboler i fasad efter typ (med smartobjekten i 0.12)
- Skuggor och djup i fasader

### 0.8 Ritningar, underlag och utskrift · *nytt format*

Underlag och blad:

- Underlag: PDF (som bild), bilder och DXF. Skalan kalibreras genom att klicka två punkter och skriva avståndet. Underlaget kan flyttas, låsas och tonas, och visas i modellvyn och på arbetsblad. Snäpp mot linjerna i DXF-underlag
- Arbetsblad: fria 2D-ritningar som inte hör till ett våningsplan
- Ritningsblad A4–A0 med ritningshuvud enligt BH90 eller BEAst, egen logga och smarttext
- Flera vyer per blad, var och en i sin skala och med vyrubrik
- Annoteringsskala per vy, så att texthöjder på papper stämmer i alla skalor
- PDF-export av ett blad eller hela serien, med filnamn efter ritningsnummer
- Enkel DXF-export av en vy
- En andra 2D-ruta: planen bredvid en öppen sektion eller fasad, där det man markerar i den ena markeras i den andra

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
- Automatiska höjdkoter för nock och takfot
- Grepp i sektioner: dra i nocken för att ändra taklutningen, och i takfoten

Grafik:

- Penntabell i stilmallen: linjetjocklek och färg per sorts linje (hål, karm, båge, foder, sammanfogningar, glas, öppningssätt, marklinje …). I dag gäller fasta värden: 0,13 skraffering, glas och sammanfogningar; 0,18 mått, foder, möbler och detaljer; 0,25 karm, båge, dörrblad och konturer bortom; 0,35 hålens omfattning och fasadkonturer; 0,5 bärande snitt; 0,7 marklinje och sektionslinjens ändar
- Klicka på en glasmarkering för att ge den en egen stil i egenskaperna
- Typsnitt: ett för hela projektet och eget per objekt
- Öppningssätt för fönster: fast, sidohängt (vänster/höger), överkantshängt, underkantshängt, vridfönster. I dag har bara dörrar öppningssätt

Markörer:

- Stilar för fasad-, sektions- och norrpilsmarkörer som smartobjekt med smarttext, t.ex. `{sektion}` och `{ritningsnummer}`
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
- Byggnadshöjd enligt PBF (medelmarknivå och 45°-planet) när terrängen finns i 0.15

### 0.10 Text och ritningsredovisning

- Textformatering
- Littera som går att flytta
- Handlingsförteckning ur bladen och ritningsnumrering
- Lagerprofil enligt SB11 i DXF-exporten

### 0.11 Förteckningar och rumsdata

- Rumslista med areor enligt SS 21054
- Dörrförteckning enligt SS 817340 och fönsterförteckning, med förhandsbild
- Ytskikt som styrs av rumsobjektet (innerväggars sidor, ytterväggars insidor, sockel och taklist)
- Rumsbeskrivning
- Export till kalkylblad

### 0.12 Smartobjekt · *nytt format*

- Biblioteksformat för parametriska objekt; reglerna skrivs som uttryck, inte som kod
- Dörrar, fönster och möbler görs om till smartobjekt; möbelverktyget kommer
- Egna smartobjekt kan laddas in i projektet
- Byggaren för smartobjekt: en egen liten app med samma motor

### 0.13 Komponenter · *nytt format*

- Komponenter: ändrar man en instans ändras alla. För hotellrum och möbleringsgrupper
- Grupper, spegling och "gör unik"

### 0.14 Flera våningsplan, bjälklag och trappor · *nytt format*

- Våningsplan med egna höjder, bjälklag och trappor
- Mått för fri höjd och bjälklag i sektioner

### 0.15 Situationsplan, terräng och export

- Situationsplan med terräng och höjdkurvor från höjdkurvor.se
- Byggnadshöjd och nockhöjd ur markmodellen
- IFC-export

### 1.0 Bygglovshandling

En villa från nytt projekt till färdig bygglovshandling.

## Avvaktar

- Flyttbara knappar och verktygsrader ("ommöblering"). Avvaktar tills
  gränssnittet har satt sig, och behövs kanske inte alls: ett nytt program
  lärs lika gärna med den arbetsyta som tagits fram för det.
- Vektorsnäpp mot PDF-underlag (0.8 visar PDF som bild).
