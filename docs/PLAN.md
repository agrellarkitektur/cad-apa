# Plan

Den här filen är den enda planen för vad som byggs och i vilken ordning.
Varje del av planen är en version: "0.8" betyder samma sak här, i appen och i
README. Det finns inga separata steg.

Målet är ett kapabelt, lättdrivet och exakt ritprogram i webbläsaren för
arkitekter: Archicads funktioner, men mer strömlinjeformat och automatiserat,
med parametriska familjer som i Revit och komponenter som i SketchUp.
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

## Framåt

### 0.7 Fasader och sektioner (proof of concept) · *nytt format*

Fasader och sektioner med dolda linjer är den största tekniska tröskeln. De
tas tidigt för att se att vägen håller, innan mycket annat byggs på den.

- Sektionslinje och fasadmarkering i planen; varje blir en vy i projektträdet
- Vyn räknas fram ur 3D-modellen och uppdateras när modellen ändras
- Snittytor fylls enligt stilmallen; det som syns bortom snittet ritas som linjer, dolda linjer tas bort
- Befintligt, rivs och nytt syns som i planen
- Dörrar, fönster och möbler i vyn, som enkla former till att börja med
- En enkel takdel (sadel- eller pulpettak) för att testa sneda former
- Nivåkoter i sektion, om det hinns med
- Samma ritningsprimitiver som planen, så att vyerna sedan kan läggas på blad

Godkänt när exempelvillan ger rätt fasader och sektion utan glipor eller
synliga triangelkanter, omräkningen tar under en tiondels sekund, och taket
skär rätt mot väggarna. Annars prövas ett bibliotek för kantprojektion i
three.js, med resten oförändrat.

### 0.8 Ritningar, underlag och utskrift · *nytt format*

- Underlag: PDF (som bild), bilder och DXF. Skalan kalibreras genom att klicka två punkter och skriva avståndet. Underlaget kan flyttas, låsas och tonas, och visas i modellvyn och på arbetsblad. Snäpp mot linjerna i DXF-underlag
- Arbetsblad: fria 2D-ritningar som inte hör till ett våningsplan
- Ritningsblad A4–A0 med ritningshuvud enligt BH90 eller BEAst, egen logga och autotext
- Flera vyer per blad, var och en i sin skala och med vyrubrik
- Annoteringsskala per vy, så att texthöjder på papper stämmer i alla skalor
- PDF-export av ett blad eller hela serien, med filnamn efter ritningsnummer
- Enkel DXF-export av en vy

### 0.9 Text och ritningsredovisning

- Typsnitt och textformatering
- Littera som går att flytta
- Handlingsförteckning ur bladen och ritningsnumrering
- Lagerprofil enligt SB11 i DXF-exporten

### 0.10 Förteckningar och rumsdata

- Rumslista med areor enligt SS 21054
- Dörrförteckning enligt SS 817340 och fönsterförteckning, med förhandsbild
- Ytskikt som styrs av rumsobjektet (innerväggars sidor, ytterväggars insidor, sockel och taklist)
- Rumsbeskrivning
- Export till kalkylblad

### 0.11 Familjer · *nytt format*

- Biblioteksformat för parametriska objekt; reglerna skrivs som uttryck, inte som kod
- Dörrar, fönster och möbler görs om till familjer; möbelverktyget kommer
- Egna familjer kan laddas in i projektet
- Familjebyggaren: en egen liten app med samma motor

### 0.12 Komponenter · *nytt format*

- Komponenter som i SketchUp: ändrar man en instans ändras alla. För hotellrum och möbleringsgrupper
- Grupper, spegling och "gör unik"

### 0.13 Flera våningsplan, bjälklag, tak och trappor · *nytt format*

Bygger vidare på det som 0.7 visat fungerar.

### 0.14 Situationsplan och export

- Situationsplan med terräng och höjdkurvor från höjdkurvor.se
- IFC-export

### 1.0 Bygglovshandling

En villa från nytt projekt till färdig bygglovshandling.

## Avvaktar

- Flyttbara knappar och verktygsrader ("ommöblering"). Avvaktar tills
  gränssnittet har satt sig, och behövs kanske inte alls: ett nytt program
  lärs lika gärna med den arbetsyta som tagits fram för det.
- Vektorsnäpp mot PDF-underlag (0.8 visar PDF som bild).
