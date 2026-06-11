# Umsetzungsplan: Alle Modi durch die ganze WM

## Ziel

Alle drei Modi (Von 0 tippen / Weiterrechnen / Nur Info) funktionieren über das gesamte
Turnier — nicht nur in der Gruppenphase:

1. Sobald eine Gruppe komplett ist → Platz 1 & 2 automatisch in die passenden
   Sechzehntelfinal-Slots eintragen.
2. Sobald alle 12 Gruppen komplett sind → die 8 besten Gruppendritten in ihre Slots eintragen.
3. Sobald ein K.o.-Spiel entschieden ist → Sieger automatisch in die nächste Runde
   (Verlierer der Halbfinals → Spiel um Platz 3).
4. Das alles sowohl mit händischen Tipps als auch mit gefetchten Ergebnissen.

## Ist-Stand

- `data.js`: Spielplan komplett vorhanden, inkl. Platzhalter-Strings in `R32`/`R16`/`QF`/`FINALS`
  („1. Gruppe C", „3. A/B/C/D/F", „Sieger SF 1", „Verlierer HF 1").
- `app.js`: Gruppentabellen + Drittplatzierten-Ranking werden live berechnet. K.o.-Karten sind
  reine **Freitext-Felder** ohne Logik. `OFFICIAL` kennt nur Gruppenspiel-Keys (`wm26:m{i}h/a`).
- `fetch_results.php`: holt nur `GROUP_STAGE` + `FINISHED`, ordnet über Team-Paarungen zu
  (funktioniert für K.o. nicht, da Paarungen vorab unbekannt).

## Erkenntnisse zur football-data.org API (v4)

Bereits geprüft (docs.football-data.org, Match-Resource):

- `stage` liefert genau die Werte, die wir brauchen:
  `GROUP_STAGE`, `LAST_32`, `LAST_16`, `QUARTER_FINALS`, `SEMI_FINALS`, `THIRD_PLACE`, `FINAL`.
  Mapping auf unsere Arrays: `LAST_32→r32`, `LAST_16→r16`, `QUARTER_FINALS→qf`,
  `SEMI_FINALS→fin0/fin1`, `THIRD_PLACE→fin2`, `FINAL→fin3`.
- `score.winner` (`HOME_TEAM` / `AWAY_TEAM` / `DRAW`) und `score.duration`
  (`REGULAR` / `EXTRA_TIME` / `PENALTY_SHOOTOUT`) → Sieger steht auch bei n.V./i.E. fest.
- Jedes Match hat `utcDate` → **K.o.-Zuordnung über Stage + Anstoßzeit** statt über Paarung
  (Spielplan/Anstoßzeiten stehen fest; innerhalb jeder K.o.-Runde sind alle Anstoßzeiten eindeutig).
- ✅ **Score-Format bei n.V./i.E. verifiziert** (am CL-Finale 2026, PSG–Arsenal i.E.):
  - `fullTime` ist die **Gesamtsumme inkl. Elfmeterschießen** (5:4 bei 1:1 n.V. + 4:3 i.E.)!
    → Für die Anzeige niemals `fullTime` nehmen, sondern `regularTime` + `extraTime`.
  - Bei `duration != REGULAR` kommen zusätzlich: `regularTime` (Stand nach 90 Min),
    `extraTime` (nur die Tore der Verlängerung), `penalties` (nur bei i.E., Elfmeter-Ergebnis).
  - Anzeige-Regel: Endstand = `regularTime + extraTime`, dazu „n.V." bzw. „i.E. 4:3".
- ✅ **Team-Kürzel verifiziert** (an der echten WC-2026-Response): Die API-`tla`-Codes stimmen
  bei 47 von 48 Teams exakt mit unseren `TEAMS`-Codes überein. Einzige Ausnahme:
  Uruguay = `URY` (API) vs. `URU` (bei uns) → Mini-Ausnahme-Map `{URY:"URU"}` im Client.
- WM 2022 als Testdatensatz geht übrigens nicht (Free-Tier: keine historischen Saisons, 403).

---

## Phase 1 — Datenmodell & Slot-Auflösung (Gruppe → Sechzehntelfinale)

**Kernidee:** K.o.-Team-Slots werden nicht mehr getippt, sondern **abgeleitet** (berechnet).
Eine zentrale Funktion `resolveSlots()` läuft bei jedem `render()` und liefert pro Slot:
`{ code: "MEX" | null, source: "1. Gruppe A", official: bool }`.

Aufgaben:

1. **Stabile Match-IDs** einführen: Gruppenspiele bleiben `m0..m71`, K.o. bekommt
   `r32:0..15`, `r16:0..7`, `qf:0..3`, `fin:0..3` (Score-Keys `wm26:r32_0s1` existieren so ähnlich schon).
2. **Platzhalter maschinenlesbar machen:** in `data.js` die Platzhalter-Strings durch strukturierte
   Slots ersetzen bzw. ergänzen, z. B. `{type:"group", pos:1, g:"C"}`, `{type:"third", groups:["A","B","C","D","F"]}`,
   `{type:"winner", m:"r32:0"}`, `{type:"loser", m:"fin:0"}`. Anzeige-Text wird daraus generiert
   (⚠️ Regex in `fetch_results.php` liest nur die `MATCHES`-Zeilen — die bleiben unverändert).
3. **Gruppen-Auflösung:** Gruppe gilt als komplett, wenn alle 6 Spiele Werte haben
   (`effectiveValue` ≠ ""). Dann Platz 1/2 aus `computeGroup(g)` in die R32-Slots schreiben.
4. **K.o.-Karten umbauen:** Freitext-Input ersetzen durch berechnete Team-Anzeige
   (Flagge + Name) bzw. den Platzhalter-Text, solange unaufgelöst.
   → Freitext entfällt komplett; alles ist aus Tipps ableitbar (siehe „Entscheidungen").

## Phase 2 — Die besten Gruppendritten zuordnen

Erst aktiv, wenn **alle 12 Gruppen komplett** sind (vorher bleiben die Dritten-Slots Platzhalter).

1. Ranking der Dritten existiert schon (`render()`), Top 8 = qualifiziert.
2. **Zuordnungsproblem:** 8 R32-Slots haben je eine Kandidatenliste aus 5 Gruppen
   (`3. A/B/C/D/F` …). Zuordnung als deterministisches Matching mit Backtracking:
   Slots in fester Reihenfolge durchgehen, jedem Slot den bestplatzierten noch freien Dritten
   zuweisen, dessen Gruppe in der Kandidatenliste steht; bei Sackgasse zurücksetzen.
   → liefert immer eine gültige, reproduzierbare Zuordnung.
3. ⚠️ Die FIFA hat für die echte Zuordnung eine offizielle Kombinationstabelle (Reglement-Annex).
   Unser Matching kann in Randfällen davon abweichen — für den Planer okay, weil im
   Continue-/Info-Modus die **echten gefetchten Paarungen** das Matching ohnehin überschreiben
   (Phase 4). Optional später: exakte FIFA-Tabelle nachrüsten.

## Phase 3 — K.o.-Kette (Sieger → nächste Runde)

1. **Sieger-Ermittlung manuell:** Tore ungleich → klar. Tore gleich →
   **i.E.-Toggle**: Klick auf eine der beiden Team-Zeilen markiert den Elfmeter-Sieger
   (neuer Store-Key `wm26:{id}w` = `"1"|"2"`, Anzeige „i.E." am Gewinner).
2. **Propagation:** `resolveSlots()` löst rekursiv auf: `winner r32:0` → Slot in `r16`,
   Verlierer `fin:0/fin:1` → `fin:2` (Platz 3), Sieger → `fin:3` (Finale).
3. **Kaskaden-Invalidierung:** Ändert sich das aufgelöste Team eines Slots (z. B. Gruppentipp
   geändert), werden Tore + i.E.-Toggle dieses K.o.-Spiels gelöscht — sonst stehen Ergebnisse
   an der falschen Paarung. Abgeschlossene (offizielle) Spiele sind davon ausgenommen (gesperrt).
4. **Anzeige „n.V." / „i.E.":** Wurde ein K.o.-Spiel erst nach 90 Minuten entschieden, steht
   das am Ergebnis dran — bei gefetchten Spielen aus `dur` (`EXTRA_TIME` → „n.V.",
   `PENALTY_SHOOTOUT` → „i.E." inkl. Elfmeter-Ergebnis „4:3 i.E."), bei manuellen Tipps
   über den i.E.-Toggle (Gleichstand + gewählter Sieger → „i.E.").
   Hinweis: Ein manuell getippter Sieg „nach Verlängerung" ist nicht von einem Sieg nach
   90 Minuten unterscheidbar — das bilden wir bewusst nicht ab (Tipp = Endergebnis).
5. **Politur:** Weltmeister-Anzeige unterm Finale, sobald entschieden.

## Phase 4 — Fetchen: rohe API-Antwort durchreichen

**Neuer Ansatz (Arthurs Idee):** `fetch_results.php` transformiert nichts mehr, sondern
speichert die komplette Antwort von `/v4/competitions/WC/matches` als `results.json`.
Damit liegen **immer alle 104 Spiele** vor (Gruppen + K.o., mit `stage`, Teams, `status`,
`score`) und die gesamte Zuordnung wandert in den Client. Anzeige-Regel:
`status === "FINISHED"` → Ergebnis zeigen, sonst nicht.

### `fetch_results.php` (wird radikal einfacher)

1. Ein cURL-Call wie bisher, Antwort **validieren** (JSON parsbar + `matches`-Array vorhanden
   + plausible Anzahl) — sonst alte `results.json` behalten, damit eine API-Fehlermeldung
   nie den letzten guten Stand überschreibt.
2. `_updated` (Fetch-Zeitpunkt) top-level injizieren, atomar schreiben (tmp + rename) wie gehabt.
3. **Entfällt komplett:** Regex über `data.js`, `$NAME2CODE`-Mapping, `norm()`, Paarungs-Index.
   (Den „Single Source of Truth"-Kommentar in `data.js` dann mit entfernen.)
4. Optional (nur falls Größe stört): pro Match unnötige Felder strippen (`area`, `competition`,
   `season`, `odds`, `referees`) → ~315 KB → ~30 KB. Gzip macht das aber ohnehin fast egal.

### `app.js` Integration — Zuordnung im Client

1. `loadOfficial()` parst das rohe API-Format:
   - Team-Code aus `tla` mit Ausnahme-Map `{URY:"URU"}` (verifiziert, s. oben).
   - **Gruppenspiele:** Zuordnung über Team-Paarung (Index `"HOME|AWAY"` über `MATCHES`,
     beide Richtungen — wie bisher im PHP, nur jetzt in JS).
   - **K.o.-Spiele:** Zuordnung über `stage` + `utcDate` (gegen `kickoffMs()` unserer Slots).
   - Befüllt `OFFICIAL` mit: Toren (nur bei `FINISHED`), K.o.-Teams (sobald in der API
     eingetragen, **unabhängig vom Status** → echte Paarungen schon vor Anpfiff sichtbar),
     Sieger/`duration`/`penalties` für die n.V./i.E.-Anzeige.
   - K.o.-Endstand für die Anzeige: `regularTime + extraTime`, **nicht** `fullTime`
     (fullTime enthält die Elfmeter!).
2. **Vorrang-Regel pro Modus:**
   - *Info:* alles offiziell; K.o.-Slots aus `ko.t1/t2`, sonst Platzhalter.
   - *Continue:* offizielle K.o.-Paarung/Ergebnis = gesperrt (grün). Solange nicht offiziell:
     Ableitung aus dem aktuellen (gemischten) Stand. Konflikte gibt es nicht, weil offizielle
     Gruppenergebnisse gesperrt sind — wenn die echte R32-Paarung feststeht, ist die
     Gruppenphase komplett offiziell und die eigene Ableitung stimmt damit überein.
   - *Scratch:* ignoriert `OFFICIAL` komplett (wie bisher).

## Phase 5 — Live-Badge & Feinschliff

1. `kickoffMs()`/`isLive()`/Live-Badge auf K.o.-Spiele ausweiten (Datums-Format ist identisch;
   Badge inkl. Google-Suche mit den aufgelösten Teamnamen).
2. `MODE_INFO`-Texte aktualisieren („… durch die ganze WM").
3. Legende/Hinweistexte im K.o.-Bereich („Sieger wird automatisch eingetragen, bei
   Gleichstand Sieger anklicken").

---

## Edge Cases (Checkliste)

- [ ] Gleichstand im K.o. ohne gewählten i.E.-Sieger → nächste Runde bleibt Platzhalter.
- [ ] Gruppentipp nachträglich ändern → Gruppe ggf. „unkomplett" → R32-Slot + abhängige
      K.o.-Tipps werden geleert (Kaskade), Dritten-Zuordnung verschwindet wieder.
- [ ] Punkt-/Tor-Gleichstand in Gruppe: aktueller Tiebreaker (Pkt → TD → Tore → Name) bleibt;
      echter FIFA-Tiebreaker (direkter Vergleich, Fair Play) optional später.
- [ ] Formatwechsel `results.json`: altes Format (Zahlen-Keys) → rohes API-Format ist ein
      Breaking Change. `app.js` und `fetch_results.php` zusammen deployen; lokal liegt die
      `results.json` bereits im neuen Roh-Format (von Arthurs Postman-Abruf).
- [ ] K.o.-Spiele vor der Auslosung: API liefert sie vermutlich ohne/mit Platzhalter-Teams
      (`homeTeam: null` o. ä.) → Client muss das tolerieren (Slot bleibt dann Platzhalter).
      Mit echten Daten prüfen, sobald die ersten Gruppen durch sind.
- [ ] API-Limit Free-Tier: weiterhin 1 Request pro Cron-Lauf (ein Call liefert alle 104 Spiele).
- [ ] Zwei R32-Spiele am selben Tag: Anstoßzeiten prüfen — laut `data.js` innerhalb jeder
      K.o.-Runde eindeutig. ✓

## Entscheidungen (mit Empfehlung getroffen — Einspruch jederzeit)

1. **K.o.-Teams nicht mehr frei eintippbar**, sondern nur noch abgeleitet/angezeigt.
   Begründung: Mit Auto-Propagation ist jedes der 104 Spiele aus Tipps ableitbar; Freitext
   erzeugt nur Konflikte (Tippfehler, Widerspruch zur Tabelle). Wer „was wäre wenn" will,
   ändert einfach den Gruppentipp.
2. **Dritten-Zuordnung per deterministischem Matching** statt exakter FIFA-Tabelle (s. Phase 2).
3. **Sieger bei Gleichstand per Klick aufs Team** (i.E.-Toggle) statt separater Elfmeter-Eingabe.

## Offene Punkte / Fragen an dich

1. ~~API-Verifikation~~ ✅ erledigt: Score-Format am CL-Finale 2026 verifiziert,
   Team-Kürzel an der echten WC-2026-Response verifiziert (einzige Ausnahme `URY`→`URU`).
2. Soll im **Scratch-Modus** die Dritten-Zuordnung schon greifen, sobald alle Gruppen getippt
   sind (klar ja?) — und soll es einen „Schnell-Ausfüllen"-Button geben (z. B. alle restlichen
   Gruppenspiele zufällig/0:0), um schneller in die K.o.-Phase zu kommen? (Nice-to-have)

## Reihenfolge & Aufwand

| Phase | Inhalt | Aufwand |
|---|---|---|
| 1 | Slot-Modell + Gruppe→R32 | mittel (größter Umbau in `app.js`/`data.js`) |
| 2 | Dritten-Matching | klein |
| 3 | K.o.-Kette + i.E.-Toggle + Kaskade | mittel |
| 4 | PHP zum Raw-Passthrough vereinfachen + Client-Zuordnung + Modi-Integration | mittel |
| 5 | Live-Badges K.o. + Texte | klein |

Phasen 1–3 sind rein clientseitig testbar (Scratch-Modus), Phase 4 baut darauf auf.
