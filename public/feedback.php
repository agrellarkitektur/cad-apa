<?php
/*
 * Tar emot synpunkter från appen och mejlar dem vidare (cad-apa 0.7.1, 0.8.2).
 *
 * Mottagaren står inte här, eftersom koden är öppen. Lägg en fil
 * feedback-config.php bredvid mappen cad-apa (så att den ligger kvar när
 * mappen byts ut vid en uppdatering), eller i själva mappen. Öppna
 * feedback.php i webbläsaren för att se om den hittas:
 *
 *   <?php
 *   return [
 *     'to'   => 'du@dindomän.se',
 *     'from' => 'noreply@dindomän.se',
 *   ];
 *
 * Skydd mot spam: ett dolt fält som bara robotar fyller i, en spärr mot
 * formulär som skickas på under tre sekunder, högst fem meddelanden i timmen
 * per avsändare och en gräns för längden. Inga personuppgifter sparas;
 * spärren använder en hash av adressen och glöms efter en timme.
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function answer(int $code, array $body): void {
  http_response_code($code);
  echo json_encode($body, JSON_UNESCAPED_UNICODE);
  exit;
}

/*
 * Var konfigurationen kan ligga: i mappen ovanför cad-apa (ligger kvar när
 * mappen byts ut) eller i själva mappen. Många webbhotell har open_basedir,
 * och då får skriptet inte läsa mappen ovanför; lägg den då i cad-apa och
 * ladda inte upp över den vid en uppdatering (0.8.2).
 */
function findConfig(): array {
  $places = ['cad-apa' => __DIR__ . '/feedback-config.php', 'mappen ovanför' => dirname(__DIR__) . '/feedback-config.php'];
  $blocked = [];
  foreach ($places as $name => $file) {
    if (@is_file($file)) return ['file' => $file, 'where' => $name];
    if (!@is_readable(dirname($file))) $blocked[] = $name;
  }
  return ['file' => null, 'blocked' => $blocked];
}

/** Konfigurationen, eller ett felmeddelande som säger vad som är fel. */
function loadConfig(): array {
  $found = findConfig();
  if (!$found['file']) {
    $msg = 'Hittar inte feedback-config.php, varken i mappen cad-apa eller i mappen ovanför.';
    if (ini_get('open_basedir')) $msg .= ' Webbhotellet begränsar vilka mappar skriptet får läsa (open_basedir); lägg filen i mappen cad-apa.';
    return ['error' => $msg];
  }
  $config = @include $found['file'];
  if (!is_array($config)) return ['error' => 'feedback-config.php hittades (' . $found['where'] . ') men ger ingen lista. Den ska sluta med return [ ... ];'];
  foreach (['to', 'from'] as $k) {
    if (!filter_var($config[$k] ?? '', FILTER_VALIDATE_EMAIL)) return ['error' => "feedback-config.php hittades ({$found['where']}) men '$k' är ingen giltig e-postadress."];
  }
  return ['config' => $config, 'where' => $found['where']];
}

// Kontroll: öppna feedback.php i webbläsaren för att se om allt är uppsatt.
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $c = loadConfig();
  if (isset($c['error'])) answer(503, ['ok' => false, 'error' => $c['error']]);
  answer(200, ['ok' => true, 'config' => $c['where'], 'mail' => function_exists('mail') ? 'finns' : 'saknas']);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') answer(405, ['ok' => false, 'error' => 'Fel metod.']);

$loaded = loadConfig();
if (isset($loaded['error'])) answer(503, ['ok' => false, 'error' => $loaded['error']]);
$to = $loaded['config']['to'];
$from = $loaded['config']['from'];

$raw = file_get_contents('php://input', false, null, 0, 20000);
$data = json_decode($raw ?: '', true);
if (!is_array($data)) answer(400, ['ok' => false, 'error' => 'Formuläret kunde inte läsas.']);

// Robotar fyller i det dolda fältet: låtsas att det gick bra.
if (!empty($data['website'])) answer(200, ['ok' => true]);
// För snabbt för en människa.
if ((int)($data['elapsed'] ?? 0) < 3000) answer(400, ['ok' => false, 'error' => 'Vänta några sekunder och försök igen.']);

$message = trim((string)($data['message'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$version = substr(preg_replace('/[^\w .\-]/u', '', (string)($data['version'] ?? '')), 0, 40);
$screen = substr(preg_replace('/[^\d×x]/u', '', (string)($data['screen'] ?? '')), 0, 20);
if ($message === '') answer(400, ['ok' => false, 'error' => 'Skriv något först.']);
if (mb_strlen($message) > 5000) answer(400, ['ok' => false, 'error' => 'Texten är för lång (högst 5000 tecken).']);
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) answer(400, ['ok' => false, 'error' => 'E-postadressen ser inte rätt ut.']);

// Högst fem i timmen per avsändare.
$key = hash('sha256', ($_SERVER['REMOTE_ADDR'] ?? '') . '|cad-apa');
$store = sys_get_temp_dir() . '/cadapa-feedback-' . substr($key, 0, 32);
$now = time();
$times = is_file($store) ? array_filter(array_map('intval', explode(',', (string)file_get_contents($store))), fn($t) => $t > $now - 3600) : [];
if (count($times) >= 5) answer(429, ['ok' => false, 'error' => 'Många synpunkter på kort tid. Försök igen om en stund.']);
$times[] = $now;
@file_put_contents($store, implode(',', $times), LOCK_EX);

$subject = '=?UTF-8?B?' . base64_encode("Synpunkt på cad-apa ($version)") . '?=';
$body = $message . "\n\n—\nVersion: $version\nSkärm: $screen\n" . ($email !== '' ? "Svara till: $email\n" : "Ingen e-post angiven.\n");
$headers = [
  'From: cad-apa <' . $from . '>',
  'Content-Type: text/plain; charset=UTF-8',
  'Content-Transfer-Encoding: 8bit',
];
if ($email !== '') $headers[] = 'Reply-To: ' . $email;

// Kuvertavsändaren (Return-Path) sätts till samma adress som From (0.8.6).
// Annars skickar servern med sin egen adress, och när brevet vidarebefordras
// (t.ex. från webbposten till Gmail) faller SPF/DMARC och brevet slängs.
if (!function_exists('mail') || !@mail($to, $subject, $body, implode("\r\n", $headers), '-f' . $from)) {
  answer(500, ['ok' => false, 'error' => 'Servern kunde inte skicka e-post. Webbhotellet kan kräva att avsändaren (from) är en adress på den egna domänen, eller SMTP.']);
}
answer(200, ['ok' => true]);
