# Flytt av cad-apa till cad-apa.danaid.cloud

Underlag till cad-apa-sessionen, sammanställt 18 november 2026 utifrån flytten av
Höjdkurvor (15–17 november), uppdaterat 19 november. Lägg gärna filen i cad-apa-repot som `docs/FLYTT.md`.

## Läget just nu

- **Höjdkurvor** finns på <https://hojdkurvor.danaid.cloud/>. Den publiceras dit med
  rsync (`publicera-vps.yml`) vid varje push. Den publiceras också fortfarande med
  FTP till <https://agrellarkitektur.se/terrang/>, eftersom kopplingen till cad-apa
  bara fungerar från den gamla adressen.
- **Synpunkter med e-post** från VPS:en fungerar och provades 17 november: msmtp
  skickar via Loopia, och breven kommer fram till Gmail.
- **Katalogposten** `apps/cad-apa/app.json` i agrellarkitektur/apps har redan
  `plannedUrl: https://cad-apa.danaid.cloud/`.
- **Väntar på cad-apa:** i Höjdkurvor är det kvar att byta cad-apas adress, att
  göra den gamla adressen till en omdirigering och att stänga av FTP. Det görs i
  ett svep när cad-apa har flyttat.

## Ändringar i cad-apa nu när Höjdkurvor har ny adress

Det här kan göras direkt, redan innan cad-apa flyttar:

1. **`src/ui/app/site.ts`**
   - Lägg till `https://hojdkurvor.danaid.cloud` i `HOJDKURVOR_ORIGINS`. Låt
     `https://agrellarkitektur.se` stå kvar under övergången.
   - Byt `HOJDKURVOR_URL` till `https://hojdkurvor.danaid.cloud/`.
   - Utan den här ändringen fungerar inte *Fortsätt rita* från den nya adressen,
     och skissen kommer inte tillbaka. Det är just nu godkänt att det ligger nere.
2. **Övriga länkar och texter.** Sök efter `terrang`, `agrellarkitektur.se/` och
   `höjdkurvor.se` i koden och dokumentationen. Rätta dem till
   `https://hojdkurvor.danaid.cloud/` och namnet **Höjdkurvor**. Appen heter inte
   längre höjdkurvor.se.
3. **Utbytet.** Specifikationen finns i `docs/UTBYTE-CAD-APA.md` i hojdkurvor. Den
   anger redan de nya adresserna. Protokollet (postMessage) är oförändrat. Det
   enda som har ändrats är ursprunget.
4. **Om cad-apa själv anropar Lantmäteriet:** inget behöver godkännas.
   dl1.lantmateriet.se och api.lantmateriet.se svarar med det ursprung som
   skickas (kontrollerat 17 november).

## Lärdomar från Höjdkurvors flytt

### Adressen
- **Egen underdomän, inte en mapp.** Reglerna står i `APPS.md` i
  agrellarkitektur/apps. Varje underdomän får egen lagring i webbläsaren, egna
  kakor och egen service worker.
- **Relativa länkar mellan apparna slutar fungera.** Höjdkurvor hade
  `cadApaUrl: '../cad-apa/'`, som bara fungerar när båda appar ligger på
  agrellarkitektur.se. Leta efter samma sak i cad-apa, till exempel `../terrang/`.

### Webbläsarens lagring följer inte med (viktigast för cad-apa)
- localStorage och IndexedDB hör till den gamla adressen. På den nya börjar varje
  användare från noll. För cad-apa gäller det de **autosparade projekten**, och
  det väger tyngre än för Höjdkurvor.
- Förslag på ordning:
  1. Publicera först en version på den gamla adressen med en tydlig ruta:
     *cad-apa flyttar – spara dina projekt som fil*. Lägg gärna till en knapp
     som laddar ner alla autosparade projekt på en gång.
  2. Se till att den nya adressen kan öppna de filerna.
  3. Låt den gamla adressen vara kvar en tid, och gör den först därefter till en
     omdirigering.

### Servern (Caddy i stället för Apache)
- **Caddy läser inte `.htaccess`.** Huvudena som `.htaccess` satte (till exempel
  `Cache-Control: no-cache` för html, js, css och json, och UTF-8 för md och txt)
  måste i stället stå i appens sajt i `drift/apps.caddy` i agrellarkitektur/apps.
  Gå igenom cad-apas `.htaccess` rad för rad. (cad-apa har ingen `.htaccess` i
  repot, 18 november. Finns en på webbhotellet ligger den bara där; annars
  räcker `apps-huvuden` och att `sw.js`, `index.html` och
  `manifest.webmanifest` inte cachas länge.)
- **"File not found." på startsidan.** `php_fastcgi` skickar som standard `/` till
  `index.php`. Om appen bara har `index.html` svarar PHP *File not found.* Lösningen
  är `php_fastcgi unix//run/php/php-fpm.sock { index off }`, som i Höjdkurvors
  sajt.
- **Kontrollera `/`, inte bara `index.html`.** Kontrollen efter publiceringen
  hämtade `index.html` direkt och missade därför felet ovan.
- **`data/` och `*-config.php` spärras.** Den gemensamma snutten `apps-huvuden` och
  publiceringsmallen spärrar alla mappar som heter `data/`. Höjdkurvors offentliga
  `data/kommuner.json` behövde därför ett undantag (`handle /data/*.json`) och
  fick följa med i rsync. Har cad-apa en offentlig `data/`-mapp behövs samma
  undantag. Annars kan mappen byta namn.
- **Data som PHP skriver** hör hemma i `/srv/apps/data/cad-apa/`, aldrig i `www/`.
  Den mappen säkerhetskopieras varje natt.
- **Ändringar i Caddy görs med en push** till agrellarkitektur/apps. En vakt på
  servern prövar konfigurationen innan den laddas.

### Publiceringen
- Använd mallen `drift/publicera-app.yml` i agrellarkitektur/apps som
  `.github/workflows/publicera-vps.yml` i cad-apa (`APP_ID: cad-apa`). Kopiera
  också `drift/known_hosts` till `.github/known_hosts`.
- Behåll samma urval av filer som FTP-publiceringen. Serverns egna filer
  (`*-config.php`, `data/`) och `.htaccess` skickas aldrig och tas aldrig bort.
- Publicera till båda ställena parallellt tills allt fungerar. Ta bort
  FTP-arbetsflödet först när den gamla adressen är en omdirigering.

### E-post (synpunkter)
- msmtp på VPS:en är redan inställt för **alla** appar: Loopias
  `mailcluster.loopia.se`, port 465, inloggning med kontakt@agrellarkitektur.se
  och avsändaren `noreply@agrellarkitektur.se`. För cad-apa behövs alltså bara
  `feedback-config.php` i appens mapp:
  ```
  printf "<?php\nreturn ['to' => 'kontakt@agrellarkitektur.se', 'from' => 'noreply@agrellarkitektur.se'];\n" | sudo tee /srv/apps/www/cad-apa/feedback-config.php
  ```
- Prova genom att öppna `https://cad-apa.danaid.cloud/feedback.php` (cad-apas
  skript heter `feedback.php`, inte `synpunkter.php` som i Höjdkurvor). Den ska
  svara `"ok":true`. Skicka sedan en synpunkt från appen.
- Varför ett konto behövs: från webbhotellet gick det att skicka från noreply@
  utan konto, eftersom Loopias egna servrar skickade breven. VPS:en får inte
  skicka för domänen på egen hand. Utan inloggning hos Loopia stoppar Gmail
  breven, särskilt efter vidarebefordran.
- **Öppen fråga:** tidigare fanns önskemålet att cad-apas synpunkter ska hamna i
  danaid-projektets Inkorg i stället för att komma som e-post. Det kräver en
  öppen väg in till danaid med en egen spärr mot skräp. E-postvägen fungerar
  redan nu.
- README i agrellarkitektur/apps (steg 6) säger fortfarande "one.com". Det är fel:
  e-posten går via Loopia.

### E-post: kvällen 18–19 november

Synpunkterna från cad-apa (och nu också Höjdkurvor) kommer fram till
kontakt@ i **Loopias webbmail men inte till Gmail**. Inget går förlorat, men
Gmail får dem inte.

Utrett:
- **Breven är rena.** Skickade med kontakt@:s inloggning hos Loopia, DKIM
  `pass` för agrellarkitektur.se, Loopias spampoäng låg. DMARC för domänen är
  `p=none`, så Gmail stoppar inget av den anledningen.
- **Vidarebefordran hos Loopia är påslagen** (till ca.agrell@gmail.com) och
  fungerar för vanliga brev: ett brev från tengbom-adressen kom fram efter
  8 minuter. Det kom in utifrån genom Loopias mottagning; apparnas brev läggs
  direkt i brevlådan med kontot som avsändare. Brevet från Höjdkurvor den
  17 november tog samma väg och vidarebefordrades ändå (Loopias id-rad slutar
  på `:T3:P1`, kvällens bara på `:P1`). Varför de inte vidarebefordras nu är
  inte klarlagt.
- **Direkt till Gmail** (msmtp till ca.agrell@gmail.com, prov 3) kom inte
  heller fram, och inget spår syns. Kuvertavsändaren `noreply@` finns troligen
  inte som adress, så en studs från Gmail försvinner. Nästa gång: skicka med
  `-f kontakt@agrellarkitektur.se`, eller gör noreply@ till ett alias för
  kontakt@, så att studsen syns. Loggen på servern visar om Loopia tog emot:
  `sudo journalctl -t msmtp -n 20` (eller `grep msmtp /var/log/mail.log`).
- **Gmail hämtar inte längre post med POP** (*Kolla e-post från andra
  konton*): stängt för nya användare sedan våren 2026 och borta helt i januari
  2027. Loopia avråder själva från vidarebefordran till Gmail.
- Ändrat på servern: `domain apps.danaid.cloud` under `defaults` i
  `/etc/msmtprc` (msmtp presenterade sig som *localhost*). Får stå kvar.
- Brevet från cad-apa saknade `MIME-Version: 1.0` (Höjdkurvors har den).
- `feedback-config.php` i båda appmapparna kan ha `to` ändrat till
  ca.agrell@gmail.com (sed-kommandot 19 november). Kontrollera och sätt
  tillbaka till kontakt@agrellarkitektur.se om Gmail-vägen inte används.

Förslag (inte beslutat):
1. **Synpunkterna sparas på servern först**, en rad per synpunkt (JSON) i
   `/srv/apps/data/cad-apa/` respektive `/srv/apps/data/hojdkurvor/`, som
   säkerhetskopieras varje natt. E-posten blir bara en avisering. Ett steg mot
   danaid-Inkorgen (se *Öppen fråga* ovan).
2. **E-posten läses i Fastmail** i stället för Gmail: först en provperiod där
   Fastmail hämtar både Loopia-kontona och Gmail, sedan eventuellt
   agrellarkitektur.se-posten direkt dit (MX-posterna; webbplatsen kan ligga
   kvar hos Loopia, msmtp loggar då in hos Fastmail). Carl August bestämmer.

Också upptäckt: **`/feedback.php` i webbläsaren visar appen**, eftersom
service workern svarar med index.html för alla adresser den navigeras till.
Formuläret (fetch) påverkas inte. Rättning: `navigateFallbackDenylist:
[/\.php$/]` i workbox-inställningarna i `vite.config.ts`. Prova under tiden i
ett inkognitofönster.

## Nästa session (från 19 november)

0.12.5.3, en liten version:
1. `feedback.php` sparar varje synpunkt på servern (förslag 1 ovan) och
   skickar e-post som avisering; `MIME-Version: 1.0` i brevet.
2. `navigateFallbackDenylist` för `.php` i `vite.config.ts`.
3. Rutan *cad-apa flyttar – spara dina projekt som fil* på den gamla adressen
   (steg 7), med knappen som laddar ner alla autosparade projekt. Visas bara
   när appen körs på agrellarkitektur.se.
4. README, version och `docs/OVERLAMNING.md`.

Höjdkurvor behöver samma ändring i `synpunkter.php` (punkt 1), i
Höjdkurvor-sessionen. Fastmail-frågan är Carl Augusts.

### Den gamla adressen
- Webbläsaren skickar inte det som står efter `#` till servern. En omdirigering
  på servern tappar därför projektlänkar. Ersätt i stället `public_html/cad-apa/`
  med bara en `index.html`:
  ```html
  <!doctype html>
  <meta charset="utf-8">
  <title>cad-apa har flyttat</title>
  <script>location.replace('https://cad-apa.danaid.cloud/' + location.pathname.replace(/^.*\/cad-apa\/?/, '') + location.search + location.hash);</script>
  <p>cad-apa har flyttat till <a href="https://cad-apa.danaid.cloud/">cad-apa.danaid.cloud</a>.</p>
  ```
  Gör det först när användarna har haft tid att spara sina projekt (se ovan).
- `feedback-config.php` i `public_html` delas av Höjdkurvor och cad-apa. Ta inte
  bort den förrän båda appar skickar synpunkter från VPS:en.

## Ordning för flytten

| # | Vad | Vem |
|---|---|---|
| 1 | `HOJDKURVOR_ORIGINS` och `HOJDKURVOR_URL` i `site.ts` (klart 18 november, 0.12.5.2) | Claude i cad-apa |
| 2 | DNS-post `cad-apa` hos one.com som pekar på VPS:en (klart: adressen svarar 19 november) | Carl August |
| 3 | Sajt för `cad-apa.danaid.cloud` i `drift/apps.caddy`, med `index off` (klart 19 november; cad-apa har ingen `.htaccess`) | Claude i apps |
| 4 | `sudo apps-drift nyckel cad-apa www/cad-apa` på servern, och utskriften som secret `APPS_SSH_KEY` i cad-apa-repot (klart 18 november; publiceringen till VPS:en går) | Carl August |
| 5 | `publicera-vps.yml` och `known_hosts` i cad-apa, parallellt med FTP (klart 18 november) | Claude i cad-apa |
| 6 | `feedback-config.php` på servern, och provet av `feedback.php` (filen finns; synpunkter når Loopias webbmail men inte Gmail, se *E-post: kvällen 18–19 november*) | Carl August |
| 7 | Rutan *Spara dina projekt som fil* på den gamla adressen | Claude i cad-apa |
| 8 | Prova på den nya adressen: rita, spara, öppna fil, synpunkt, Höjdkurvor → cad-apa → tillbaka (påbörjat: sidan och synpunkten fungerar) | Carl August |
| 9 | I Höjdkurvor: `cadApaUrl` i `config.js` och `js/app.js` blir `https://cad-apa.danaid.cloud/`. Omdirigering av `/terrang/` och borttagning av `publicera.yml` | Claude i hojdkurvor |
| 10 | Omdirigering av `/cad-apa/`, borttagning av FTP i cad-apa, och `url` i `apps/cad-apa/app.json` | Claude, efter en tid |
