<?php
/* ============================================================
   fetch_results.php
   Holt alle WM-Spiele von football-data.org und reicht die rohe
   API-Antwort als results.json durch (Gruppen + K.o., inkl. stage,
   Teams, status, score). Die gesamte Zuordnung passiert im Client.
   Wird vom Cron alle ~20 Minuten aufgerufen.
   ============================================================ */

require __DIR__ . '/config.php';

/* --- Schutz: per Web nur mit Secret, per Cron (PHP-CLI) immer erlaubt --- */
if (php_sapi_name() !== 'cli') {
    if (($_GET['key'] ?? '') !== CRON_SECRET) {
        http_response_code(403);
        exit('Forbidden');
    }
    header('Content-Type: text/plain; charset=utf-8');
}

$OUT_FILE = __DIR__ . '/results.json';

/* Bei jedem Fehler: alte results.json unangetastet lassen, damit eine
   API-Störung nie den letzten guten Stand überschreibt. */
function fail($msg) {
    fwrite(STDERR, "[fetch_results] FEHLER: $msg\n");
    echo "FEHLER: $msg\n";
    exit(1);
}

/* ============================================================
   1) Daten von football-data.org holen (Competition WC)
   ============================================================ */
$ch = curl_init('https://api.football-data.org/v4/competitions/WC/matches');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => ['X-Auth-Token: ' . FOOTBALL_DATA_TOKEN],
    CURLOPT_TIMEOUT        => 20,
]);
$resp = curl_exec($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

if ($resp === false)  fail("cURL: $err");
if ($http !== 200)    fail("API antwortete HTTP $http (Token korrekt? Limit erreicht?)");

/* ============================================================
   2) Validieren – nie eine kaputte Antwort durchreichen
   ============================================================ */
$data = json_decode($resp, true);
if (!is_array($data) || !isset($data['matches']) || !is_array($data['matches'])) {
    fail("Unerwartete API-Antwort (kein 'matches'-Array).");
}
$count = count($data['matches']);
if ($count < 100) fail("Unplausible Spielanzahl: $count (erwartet 104).");

/* ============================================================
   3) Unnötige Felder strippen (~315 KB -> ~30 KB) und schreiben
   ============================================================ */
$matches = [];
foreach ($data['matches'] as $mt) {
    unset($mt['area'], $mt['competition'], $mt['season'], $mt['odds'], $mt['referees']);
    $matches[] = $mt;
}

$payload = ['_updated' => gmdate('c'), 'matches' => $matches];
$json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

$tmp = $OUT_FILE . '.tmp';
if (file_put_contents($tmp, $json) === false) fail("Schreiben fehlgeschlagen: $tmp");
if (!rename($tmp, $OUT_FILE))                  fail("Umbenennen fehlgeschlagen: $OUT_FILE");

echo "OK: $count Spiele durchgereicht.\n";
