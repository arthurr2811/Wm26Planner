<?php
/* ============================================================
   fetch_results.php
   Holt die WM-Ergebnisse von football-data.org, ordnet sie den
   Spielen aus dem HTML zu und schreibt nur ABGESCHLOSSENE
   Gruppenspiele nach results.json.
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

function fail($msg) {
    fwrite(STDERR, "[fetch_results] FEHLER: $msg\n");
    echo "FEHLER: $msg\n";
    exit(1);
}

/* Spielplan-Daten finden. Die MATCHES leben in data.js (Single Source of Truth);
   die alten HTML-Dateien bleiben als Fallback erhalten, falls noch nicht aufgeteilt. */
$HTML_FILE = null;
foreach (['data.js', 'index.html', 'wm-2026-wandplaner.html'] as $cand) {
    if (is_file(__DIR__ . '/' . $cand)) { $HTML_FILE = __DIR__ . '/' . $cand; break; }
}
if ($HTML_FILE === null) fail("Spielplan-Daten nicht gefunden (data.js / index.html / wm-2026-wandplaner.html).");

/* ============================================================
   1) Paarungen aus dem HTML lesen (Single Source of Truth).
   Greift nur die 72 Gruppenspiele:  ["A","Datum","Zeit","HOME","AWAY","Ort"]
   ============================================================ */
$html = @file_get_contents($HTML_FILE);
if ($html === false) fail("HTML nicht lesbar: $HTML_FILE");

preg_match_all(
    '/\[\s*"[A-L]"\s*,\s*"[^"]*"\s*,\s*"[^"]*"\s*,\s*"([A-Z]{3})"\s*,\s*"([A-Z]{3})"\s*,\s*"[^"]*"\s*\]/',
    $html, $mm, PREG_SET_ORDER
);
if (!$mm) fail("Keine Spiele im HTML gefunden – Regex/Format prüfen.");

$pairIndex = [];                 // "HOME|AWAY" => Index
foreach ($mm as $i => $m) {
    $pairIndex[$m[1] . '|' . $m[2]] = $i;
}

/* ============================================================
   2) Namens-Mapping football-data.org -> unsere 3-Buchstaben-Codes
   Schlüssel = normalisierter Name (klein, ohne Akzente/Leerzeichen).
   ============================================================ */
$NAME2CODE = [
    'mexico'=>'MEX','southkorea'=>'KOR','korearepublic'=>'KOR','korea'=>'KOR',
    'czechia'=>'CZE','czechrepublic'=>'CZE','southafrica'=>'RSA',
    'switzerland'=>'SUI','canada'=>'CAN','qatar'=>'QAT',
    'bosniaandherzegovina'=>'BIH','bosniaherzegovina'=>'BIH','bosnia'=>'BIH',
    'brazil'=>'BRA','morocco'=>'MAR','haiti'=>'HAI','scotland'=>'SCO',
    'usa'=>'USA','unitedstates'=>'USA','unitedstatesofamerica'=>'USA',
    'paraguay'=>'PAR','australia'=>'AUS','turkey'=>'TUR','turkiye'=>'TUR',
    'germany'=>'GER','curacao'=>'CUW',
    'ivorycoast'=>'CIV','cotedivoire'=>'CIV','ecuador'=>'ECU',
    'netherlands'=>'NED','holland'=>'NED','japan'=>'JPN','tunisia'=>'TUN','sweden'=>'SWE',
    'belgium'=>'BEL','egypt'=>'EGY',
    'iran'=>'IRN','iranislamicrepublic'=>'IRN','islamicrepublicofiran'=>'IRN',
    'newzealand'=>'NZL','spain'=>'ESP','uruguay'=>'URU',
    'capeverde'=>'CPV','caboverde'=>'CPV','saudiarabia'=>'KSA',
    'france'=>'FRA','senegal'=>'SEN','norway'=>'NOR','iraq'=>'IRQ',
    'argentina'=>'ARG','algeria'=>'ALG','austria'=>'AUT','jordan'=>'JOR',
    'portugal'=>'POR','colombia'=>'COL','uzbekistan'=>'UZB',
    'drcongo'=>'COD','democraticrepublicofthecongo'=>'COD','congodr'=>'COD','congodemocraticrepublic'=>'COD',
    'england'=>'ENG','croatia'=>'CRO','ghana'=>'GHA','panama'=>'PAN',
];

function norm($s) {
    $s = mb_strtolower($s, 'UTF-8');
    $map = ['á'=>'a','à'=>'a','â'=>'a','ä'=>'a','ã'=>'a','å'=>'a','ç'=>'c',
            'é'=>'e','è'=>'e','ê'=>'e','ë'=>'e','í'=>'i','î'=>'i','ï'=>'i',
            'ó'=>'o','ô'=>'o','ö'=>'o','õ'=>'o','ø'=>'o','ú'=>'u','ù'=>'u',
            'û'=>'u','ü'=>'u','ñ'=>'n','ı'=>'i','ş'=>'s','ğ'=>'g','ý'=>'y'];
    $s = strtr($s, $map);
    return preg_replace('/[^a-z0-9]/', '', $s);
}

function teamCode($team, $NAME2CODE) {
    foreach (['name', 'shortName'] as $k) {
        if (!empty($team[$k]) && isset($NAME2CODE[norm($team[$k])])) {
            return $NAME2CODE[norm($team[$k])];
        }
    }
    // Fallback: football-data liefert ein TLA, das zufällig einem unserer Codes gleicht
    if (!empty($team['tla'])) {
        $tla = strtoupper($team['tla']);
        if (in_array($tla, $NAME2CODE, true)) return $tla;
    }
    return null;
}

/* ============================================================
   3) Daten von football-data.org holen (Competition WC)
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

$data = json_decode($resp, true);
if (!isset($data['matches'])) fail("Unerwartete API-Antwort (kein 'matches').");

/* ============================================================
   4) Zuordnen – nur FINISHED Gruppenspiele
   ============================================================ */
$results   = [];
$unmatched = [];

foreach ($data['matches'] as $mt) {
    if (($mt['stage']  ?? '') !== 'GROUP_STAGE') continue;
    if (($mt['status'] ?? '') !== 'FINISHED')    continue;

    $hc = teamCode($mt['homeTeam'] ?? [], $NAME2CODE);
    $ac = teamCode($mt['awayTeam'] ?? [], $NAME2CODE);
    $hs = $mt['score']['fullTime']['home'] ?? null;
    $as = $mt['score']['fullTime']['away'] ?? null;
    if ($hs === null || $as === null) continue;

    if (!$hc || !$ac) {
        $unmatched[] = ($mt['homeTeam']['name'] ?? '?') . ' - ' . ($mt['awayTeam']['name'] ?? '?');
        continue;
    }

    if (isset($pairIndex["$hc|$ac"])) {
        $results[$pairIndex["$hc|$ac"]] = ['h' => (int)$hs, 'a' => (int)$as];
    } elseif (isset($pairIndex["$ac|$hc"])) {
        // gleiche Paarung, im HTML andersrum als Heim/Gast -> Tore drehen
        $results[$pairIndex["$ac|$hc"]] = ['h' => (int)$as, 'a' => (int)$hs];
    } else {
        $unmatched[] = "$hc-$ac (keine passende Paarung im Spielplan)";
    }
}

ksort($results, SORT_NUMERIC);

/* ============================================================
   5) results.json schreiben (atomar via temp + rename)
   ============================================================ */
$payload = array_merge(['_updated' => gmdate('c')], $results);
$json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

$tmp = $OUT_FILE . '.tmp';
if (file_put_contents($tmp, $json) === false) fail("Schreiben fehlgeschlagen: $tmp");
if (!rename($tmp, $OUT_FILE))                  fail("Umbenennen fehlgeschlagen: $OUT_FILE");

echo "OK: " . count($results) . " abgeschlossene Gruppenspiele geschrieben.\n";
if ($unmatched) {
    echo "Nicht zugeordnet (" . count($unmatched) . "):\n  - " . implode("\n  - ", $unmatched) . "\n";
    fwrite(STDERR, "[fetch_results] Nicht zugeordnet: " . implode('; ', $unmatched) . "\n");
}
