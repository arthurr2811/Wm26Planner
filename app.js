/* ===================== SPEICHER (nur Session, im Arbeitsspeicher) ===================== */
/* Eigene Tipps leben nur in dieser Sitzung (im Speicher) – beim Neuladen weg.
   Offizielle Ergebnisse kommen aus der results.json. */
const mem = {};
const store = {
  get(k){ return mem[k] ?? ""; },
  set(k,v){ mem[k]=v; },
  clearAll(){ for(const k in mem) delete mem[k]; }
};

/* ===================== MODUS & OFFIZIELLE ERGEBNISSE ===================== */
/* OFFICIAL = vom Server (results.json) gelieferte, bereits abgeschlossene Spiele.
   Wird NIE im localStorage gespeichert – das bleibt den eigenen Tipps vorbehalten. */
let OFFICIAL = {};
let officialUpdated = "";   // Zeitstempel aus results.json (_updated)
let modeMem = "";
function getMode(){ try{ return localStorage.getItem("wm26mode") || modeMem || ""; }catch(e){ return modeMem; } }
function setMode(m){ modeMem=m; try{ localStorage.setItem("wm26mode", m); }catch(e){} }

/* results.json = rohe API-Antwort von /v4/competitions/WC/matches (alle 104
   Spiele). Die gesamte Zuordnung passiert hier im Client:
   - Gruppenspiele über die Team-Paarung (Codes aus tla, Ausnahme URY→URU),
   - K.o.-Spiele über stage + Anstoßzeit (innerhalb jeder Runde eindeutig).
   Befüllt OFFICIAL mit:
   - wm26:m{i}h/a            Gruppentore (nur FINISHED)
   - wm26:{ko}t1/t2          K.o.-Teams, sobald die API sie kennt (egal welcher Status)
   - wm26:{ko}s1/s2          K.o.-Endstand = regularTime+extraTime, NIE fullTime
                             (fullTime enthält bei i.E. die Elfmeter!)
   - wm26:{ko}w              Sieger "1"|"2" (für die i.E.-Auflösung bei Gleichstand)
   - wm26:{ko}dur / {ko}pen  "nv"|"ie" + Elfmeter-Ergebnis für die Anzeige */
const TLA_FIX = {URY:"URU"};
function apiTeamCode(t){
  const c = t && t.tla ? (TLA_FIX[t.tla] || t.tla) : null;
  return c && TEAMS[c] ? c : null;
}
function koTimeIndex(){
  const idx = {};
  const stageFor = (round, i) =>
    round==="r32" ? "LAST_32" : round==="r16" ? "LAST_16" : round==="qf" ? "QUARTER_FINALS" :
    i<2 ? "SEMI_FINALS" : i===2 ? "THIRD_PLACE" : "FINAL";
  for(const r of KO_ROUNDS){
    r.list.forEach((m,i)=>{
      const stage = stageFor(r.key, i);
      const ms = kickoffFromStrings(m[r.slotAt-3], m[r.slotAt-2]);
      idx[`${stage}|${ms}`] = `${r.key}:${i}`;
      /* Platz 3 + Finale sind pro Stage eindeutig → auch ohne Zeit auffindbar
         (robust gegen kurzfristige Anstoßzeit-Änderungen) */
      if(stage==="THIRD_PLACE" || stage==="FINAL") idx[stage] = `${r.key}:${i}`;
    });
  }
  return idx;
}

async function loadOfficial(){
  OFFICIAL = {};
  officialUpdated = "";
  let data = null;
  try{
    const r = await fetch("results.json", {cache:"no-store"});
    if(r.ok) data = await r.json();
  }catch(e){ data = null; }   // keine Datei / file:// → keine offiziellen Daten
  if(!data || !Array.isArray(data.matches)) return;
  if(typeof data._updated === "string") officialUpdated = data._updated;

  const pairIdx = {};   // "HOME|AWAY" → {i, flip} (beide Richtungen)
  MATCHES.forEach((m,i)=>{
    pairIdx[`${m[3]}|${m[4]}`] = {i, flip:false};
    pairIdx[`${m[4]}|${m[3]}`] = {i, flip:true};
  });
  const koIdx = koTimeIndex();

  for(const mt of data.matches){
    const finished = mt.status === "FINISHED";
    const sc = mt.score || {};
    if(mt.stage === "GROUP_STAGE"){
      if(!finished) continue;
      const hc = apiTeamCode(mt.homeTeam), ac = apiTeamCode(mt.awayTeam);
      const p = hc && ac ? pairIdx[`${hc}|${ac}`] : null;
      const ft = sc.fullTime;
      if(!p || ft?.home==null || ft?.away==null) continue;
      OFFICIAL[`wm26:m${p.i}h`] = String(p.flip ? ft.away : ft.home);
      OFFICIAL[`wm26:m${p.i}a`] = String(p.flip ? ft.home : ft.away);
    }else{
      const id = koIdx[`${mt.stage}|${Date.parse(mt.utcDate)}`] ?? koIdx[mt.stage];
      if(!id) continue;
      const hc = apiTeamCode(mt.homeTeam), ac = apiTeamCode(mt.awayTeam);
      if(hc) OFFICIAL[koKey(id,"t1")] = hc;   // Paarung schon vor Anpfiff sichtbar
      if(ac) OFFICIAL[koKey(id,"t2")] = ac;
      if(!finished || !hc || !ac) continue;
      let h, a;
      if(sc.duration && sc.duration !== "REGULAR"){
        h = (sc.regularTime?.home ?? 0) + (sc.extraTime?.home ?? 0);
        a = (sc.regularTime?.away ?? 0) + (sc.extraTime?.away ?? 0);
      }else{
        h = sc.fullTime?.home; a = sc.fullTime?.away;
      }
      if(h==null || a==null) continue;
      OFFICIAL[koKey(id,"s1")] = String(h);
      OFFICIAL[koKey(id,"s2")] = String(a);
      if(sc.winner==="HOME_TEAM")      OFFICIAL[koKey(id,"w")] = "1";
      else if(sc.winner==="AWAY_TEAM") OFFICIAL[koKey(id,"w")] = "2";
      if(sc.duration==="EXTRA_TIME")   OFFICIAL[koKey(id,"dur")] = "nv";
      else if(sc.duration==="PENALTY_SHOOTOUT"){
        OFFICIAL[koKey(id,"dur")] = "ie";
        if(sc.penalties?.home!=null) OFFICIAL[koKey(id,"pen")] = `${sc.penalties.home}:${sc.penalties.away}`;
      }
    }
  }
}

/* "zuletzt aktualisiert"-Stempel im Footer */
function updateLiveStamp(){
  const el = document.getElementById("liveStamp");
  if(!el) return;
  if(officialUpdated){
    const d = new Date(officialUpdated);
    if(!isNaN(d)){
      const s = d.toLocaleString("de-DE", {day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"});
      el.textContent = "Ergebnisse aktualisiert: " + s + " Uhr";
      return;
    }
  }
  el.textContent = "Anstoßzeiten in MESZ";
}

/* ===================== LIVE-MARKIERUNG ===================== */
/* Wir haben keine echten Live-Ergebnisse – ein Spiel gilt rein zeitbasiert als
   "live", solange jetzt zwischen Anpfiff und Anpfiff + 2h liegt und noch kein
   offizielles Endergebnis vorliegt. Zeiten in den Daten sind MESZ (= UTC+2). */
const LIVE_MS = 180 * 60 * 1000;     // 3 Stunden (Puffer für Verlängerung & Elfmeterschießen)
function kickoffFromStrings(dStr, tStr){
  const dm = /(\d{2})\.(\d{2})\./.exec(dStr);  // "Do 11.06." → 11, 06
  const tm = /(\d{2}):(\d{2})/.exec(tStr);     // "21:00"     → 21, 00
  if(!dm || !tm) return null;
  return Date.UTC(2026, +dm[2]-1, +dm[1], +tm[1]-2, +tm[2]);  // MESZ → UTC
}
function kickoffMs(m){ return kickoffFromStrings(m[1], m[2]); }
function isLive(i, now){
  if(OFFICIAL[`wm26:m${i}h`]!==undefined) return false; // bereits offiziell beendet
  const k = kickoffMs(MATCHES[i]);
  return k!=null && now >= k && now < k + LIVE_MS;
}
function koKickoffMs(id){
  const [round, i] = id.split(":");
  const r = KO_BY_KEY[round], m = r.list[+i];
  return kickoffFromStrings(m[r.slotAt-3], m[r.slotAt-2]);
}
function isLiveKO(id, now){
  if(OFFICIAL[koKey(id,"s1")]!==undefined) return false; // bereits offiziell beendet
  const k = koKickoffMs(id);
  return k!=null && now >= k && now < k + LIVE_MS;
}
function refreshLive(){
  const now = Date.now();
  /* "Von 0"-Modus: leerer Spielplan ohne Bezug zu echten Anstoßzeiten –
     ein Live-Badge ergäbe hier keinen Sinn. */
  const live = getMode()!=="scratch";
  document.querySelectorAll(".match[data-mi]").forEach(row=>{
    row.classList.toggle("live", live && isLive(+row.dataset.mi, now));
  });
  document.querySelectorAll(".ko[data-ko]").forEach(card=>{
    card.classList.toggle("live", live && isLiveKO(card.dataset.ko, now));
  });
  /* gleiche Live-Logik für die Kalender-Zeilen (nur sichtbar, wenn offen) */
  document.querySelectorAll(".cal-row[data-mi]").forEach(row=>{
    row.classList.toggle("live", live && isLive(+row.dataset.mi, now));
  });
  document.querySelectorAll(".cal-row[data-ko]").forEach(row=>{
    row.classList.toggle("live", live && isLiveKO(row.dataset.ko, now));
  });
}
/* Klick aufs LIVE-Badge → Google-Suche zum Spiel im neuen Tab. */
function openLiveSearch(i){
  const m = MATCHES[i];
  const q = encodeURIComponent(`${TEAMS[m[3]][0]} ${TEAMS[m[4]][0]} live`);
  window.open(`https://www.google.com/search?q=${q}`, "_blank", "noopener");
}
function openLiveSearchKO(id){
  const c1 = slotTeam(id,1).code, c2 = slotTeam(id,2).code;
  const q = c1 && c2 ? `${TEAMS[c1][0]} ${TEAMS[c2][0]} live` : "WM 2026 live";
  window.open(`https://www.google.com/search?q=${encodeURIComponent(q)}`, "_blank", "noopener");
}

/* Wert pro Feld je nach Modus (Merge-Regel) */
function effectiveValue(key){
  const mode = getMode();
  if(mode==="info") return OFFICIAL[key] ?? "";
  if(mode==="continue"){
    const u = store.get(key);
    return u!=="" ? u : (OFFICIAL[key] ?? "");
  }
  return store.get(key); // scratch: nur eigene Tipps
}
function isFieldLocked(key){
  const mode = getMode();
  if(mode==="info") return true;                       // alles nur Ansicht
  if(mode==="continue") return OFFICIAL[key]!==undefined; // fertige Spiele gesperrt
  return false;                                        // scratch: alles frei
}

/* ===================== AUFBAU ===================== */
function scoreInput(key){
  return `<input class="score" type="number" min="0" max="99" inputmode="numeric" data-k="${key}">`;
}
function teamHTML(code, home){
  const [name, flag] = TEAMS[code];
  return home
    ? `<span class="team home" title="${name}">${name} <span class="fl">${flag}</span></span>`
    : `<span class="team" title="${name}"><span class="fl">${flag}</span> ${name}</span>`;
}
function buildGroups(){
  const root = document.getElementById("groups");
  root.innerHTML = "";
  for(const g of Object.keys(GROUPS)){
    const card = document.createElement("div");
    card.className = "group";
    const ms = MATCHES.map((m,i)=>({m,i})).filter(x=>x.m[0]===g);
    card.innerHTML = `
      <div class="group-head"><span class="group-letter">${g}</span><span class="group-label">Gruppe ${g}</span></div>
      <div class="matches">${ms.map(({m,i})=>`
        <div class="match" data-mi="${i}">
          <span class="when"><b>${m[1]}</b>${m[2]} · ${m[5]}</span>
          ${teamHTML(m[3], true)}
          ${scoreInput(`wm26:m${i}h`)}
          <span class="colon">:</span>
          ${scoreInput(`wm26:m${i}a`)}
          ${teamHTML(m[4], false)}
          <button class="live-badge" type="button" data-live="${i}" title="Live-Ergebnis googeln">● Live 🔍</button>
        </div>`).join("")}
      </div>
      <table class="standings">
        <thead><tr><th class="t">Team</th><th>Sp</th><th>S</th><th>U</th><th>N</th><th>Tore</th><th>TD</th><th>Pkt</th></tr></thead>
        <tbody id="tbl-${g}"></tbody>
      </table>`;
    root.appendChild(card);
  }
}
/* ===================== K.O.-STRUKTUR ===================== */
/* Stabile Match-IDs: Gruppenspiele m0..m71, K.o. "r32:0".."fin:3".
   slotAt = Index des Heim-Slots im Daten-Array (FINALS hat vorne den Tag-Namen). */
const KO_ROUNDS = [
  {key:"r32", list:R32,    slotAt:3, tag:i=>`SF ${i+1}`},
  {key:"r16", list:R16,    slotAt:3, tag:i=>`AF ${i+1}`},
  {key:"qf",  list:QF,     slotAt:3, tag:i=>`VF ${i+1}`},
  {key:"fin", list:FINALS, slotAt:4, tag:i=>FINALS[i][0]}
];
const KO_BY_KEY = Object.fromEntries(KO_ROUNDS.map(r=>[r.key, r]));
const ROUND_TAG = {r32:"SF", r16:"AF", qf:"VF", fin:"HF"};
function koKey(id, suffix){ return "wm26:" + id.replace(":","") + suffix; }  // "r32:0","s1" → "wm26:r320s1"
function koSlotDef(id, n){            // n = 1|2 → Slot-Objekt aus data.js
  const [round, i] = id.split(":");
  const r = KO_BY_KEY[round];
  return r.list[+i][r.slotAt + n - 1];
}
function slotLabel(s){                // Platzhalter-Text aus dem Slot-Objekt generieren
  if(s.g) return `${s.p}. Gruppe ${s.g}`;
  if(s.t) return `3. ${s.t.join("/")}`;
  const ref = s.w || s.l, [r, i] = ref.split(":");
  return `${s.w ? "Sieger" : "Verlierer"} ${ROUND_TAG[r]} ${+i+1}`;
}

function koCard(tag, d, t, ort, id, final){
  const row = n => `
    <div class="ko-row">
      <div class="ko-team ph" data-slot="${id}:${n}"></div>
      ${scoreInput(koKey(id, `s${n}`))}
    </div>`;
  return `<div class="ko${final ? " final" : ""}" data-ko="${id}">
    <div class="ko-top"><span class="tag">${tag}</span><span class="meta">${d} · ${t} · ${ort}</span>
      <button class="live-badge" type="button" data-live-ko="${id}" title="Live-Ergebnis googeln">● Live 🔍</button>
    </div>
    ${row(1)}${row(2)}
  </div>`;
}
function buildKO(){
  const mount = {r32:"r32", r16:"r16", qf:"qf", fin:"finals"};
  for(const r of KO_ROUNDS){
    document.getElementById(mount[r.key]).innerHTML = r.list.map((m,i)=>
      koCard(r.tag(i), m[r.slotAt-3], m[r.slotAt-2], m[r.slotAt-1], `${r.key}:${i}`, r.key==="fin" && m[0]==="Finale")
    ).join("");
  }
}

/* ===================== TABELLENLOGIK ===================== */
/* Gemeinsame Tabellen-Sortierung nach allen Gruppenspielen: Punkte →
   Tordifferenz → erzielte Tore. Wird für das Dritten-Ranking genutzt und
   als Fallback (Regeln e/f) bei der Gruppensortierung. Den finalen
   Gleichstand-Tiebreaker (Name bzw. Gruppe) hängt der Aufrufer an. */
function comparePoints(x, y){
  return y.pkt-x.pkt || (y.tf-y.ta)-(x.tf-x.ta) || y.tf-x.tf;
}

/* Direkter Vergleich (Regeln a–d): Mini-Tabelle nur aus den Spielen der
   punktgleichen Teams – Punkte, dann Tordifferenz, dann erzielte Tore.
   `teams` sind bereits punktgleich; `played` = alle gespielten Gruppenspiele.
   Bleiben Teams auch im direkten Vergleich gleich, wird der direkte Vergleich
   rekursiv nur noch auf diese erneut angewendet (Regel d). Lässt sich die
   Gruppe so nicht weiter trennen, greifen die Gesamtwerte (Regeln e/f) und
   zuletzt der Name. */
function orderTied(teams, played){
  if(teams.length===1) return teams.slice();
  const set = new Set(teams.map(t=>t.c));
  const mini = {};
  teams.forEach(t=>mini[t.c]={pkt:0, tf:0, ta:0});
  played.forEach(p=>{
    if(!set.has(p.h) || !set.has(p.a)) return;
    const H = mini[p.h], A = mini[p.a];
    H.tf+=p.hg; H.ta+=p.ag; A.tf+=p.ag; A.ta+=p.hg;
    if(p.hg>p.ag) H.pkt+=3;
    else if(p.hg<p.ag) A.pkt+=3;
    else { H.pkt++; A.pkt++; }
  });
  const sorted = teams.slice().sort((x,y)=>comparePoints(mini[x.c], mini[y.c]));
  const eq = (x,y)=>comparePoints(mini[x.c], mini[y.c])===0;
  const out = [];
  for(let i=0; i<sorted.length;){
    let j = i+1;
    while(j<sorted.length && eq(sorted[i], sorted[j])) j++;
    const block = sorted.slice(i, j);
    if(block.length===1) out.push(block[0]);
    else if(block.length===teams.length){
      /* Mini-Tabelle trennt nicht → Gesamtwerte, dann Name (Regeln e/f). */
      block.sort((x,y)=>comparePoints(x,y) || TEAMS[x.c][0].localeCompare(TEAMS[y.c][0]));
      out.push(...block);
    }else out.push(...orderTied(block, played));   // Regel d: erneut, nur diese Teams
    i = j;
  }
  return out;
}

function computeGroup(g){
  const rows = {};
  GROUPS[g].forEach(c=>rows[c]={c, sp:0, s:0, u:0, n:0, tf:0, ta:0, pkt:0});
  const played = [];
  MATCHES.forEach((m,i)=>{
    if(m[0]!==g) return;
    const h = effectiveValue(`wm26:m${i}h`), a = effectiveValue(`wm26:m${i}a`);
    if(h==="" || a==="") return;
    const hg = +h, ag = +a;
    played.push({h:m[3], a:m[4], hg, ag});
    const H = rows[m[3]], A = rows[m[4]];
    H.sp++; A.sp++; H.tf+=hg; H.ta+=ag; A.tf+=ag; A.ta+=hg;
    if(hg>ag){H.s++; A.n++; H.pkt+=3;}
    else if(hg<ag){A.s++; H.n++; A.pkt+=3;}
    else {H.u++; A.u++; H.pkt++; A.pkt++;}
  });
  /* Erst nach Punkten gruppieren, punktgleiche Blöcke dann per direktem
     Vergleich (Regeln a–d) auflösen. */
  const byPoints = Object.values(rows).sort((x,y)=>y.pkt-x.pkt);
  const result = [];
  for(let i=0; i<byPoints.length;){
    let j = i+1;
    while(j<byPoints.length && byPoints[j].pkt===byPoints[i].pkt) j++;
    result.push(...orderTied(byPoints.slice(i, j), played));
    i = j;
  }
  return result;
}
/* ===================== SLOT-AUFLÖSUNG ===================== */
/* SLOTS["r32:0:1"] = {code:"MEX"|null, official:bool} – wird bei jedem render()
   neu berechnet. Gruppe komplett (alle 6 Spiele getippt/gespielt) → Platz 1/2
   landen in den R32-Slots. Sieger-Kette (Phase 3) folgt. */
let SLOTS = {};
function slotTeam(id, n){ return SLOTS[`${id}:${n}`] || {code:null, official:false}; }

/* Dritten-Zuordnung: erst wenn ALLE Gruppen komplett sind. Jeder Dritten-Slot
   hat eine Kandidatenliste aus 5 Gruppen; die Top 8 des Dritten-Rankings werden
   per Backtracking verteilt (Slot für Slot den bestplatzierten noch freien
   Dritten, dessen Gruppe passt) → deterministisch und immer vollständig. */
function assignThirds(thirds){
  const top8 = thirds.slice(0, 8).map(t=>t.g);          // Gruppen, nach Rang sortiert
  const slots = [];                                      // [{id,n,groups}] in R32-Reihenfolge
  R32.forEach((m,i)=>{
    for(const n of [1,2]){
      const s = m[2+n];
      if(s.t) slots.push({id:`r32:${i}`, n, groups:s.t});
    }
  });
  const used = new Set(), pick = [];
  function solve(si){
    if(si===slots.length) return true;
    for(const g of top8){
      if(used.has(g) || !slots[si].groups.includes(g)) continue;
      used.add(g); pick[si] = g;
      if(solve(si+1)) return true;
      used.delete(g);
    }
    return false;
  }
  const byGroup = Object.fromEntries(thirds.map(t=>[t.g, t.c]));
  const out = {};
  if(solve(0)) slots.forEach((s,si)=>{ out[`${s.id}:${s.n}`] = byGroup[pick[si]]; });
  return out;
}

/* Sieger/Verlierer eines K.o.-Spiels aus den Toren bestimmen. Bei Gleichstand
   entscheidet der i.E.-Toggle (wm26:{id}w = "1"|"2", Klick auf die Team-Zeile). */
let KO_OUT = {};   // "r32:0" -> {winner, loser, pen}
function koResult(id, c1, c2){
  const out = {winner:null, loser:null, pen:false};
  if(!c1 || !c2) return out;
  const s1 = effectiveValue(koKey(id,"s1")), s2 = effectiveValue(koKey(id,"s2"));
  if(s1==="" || s2==="") return out;
  if(+s1 > +s2){ out.winner=c1; out.loser=c2; }
  else if(+s2 > +s1){ out.winner=c2; out.loser=c1; }
  else{
    const w = effectiveValue(koKey(id,"w"));
    if(w==="1"){ out.winner=c1; out.loser=c2; out.pen=true; }
    else if(w==="2"){ out.winner=c2; out.loser=c1; out.pen=true; }
  }
  return out;
}

function resolveSlots(tables, thirds){
  SLOTS = {}; KO_OUT = {};
  const mode = getMode();
  const groupDone = {};
  for(const g of Object.keys(GROUPS)){
    groupDone[g] = MATCHES.every((m,i)=> m[0]!==g ||
      (effectiveValue(`wm26:m${i}h`)!=="" && effectiveValue(`wm26:m${i}a`)!==""));
  }
  const allDone = Object.values(groupDone).every(Boolean);
  const thirdSlots = allDone ? assignThirds(thirds) : {};
  /* Runden in Spielplan-Reihenfolge: Sieger-/Verlierer-Refs zeigen immer auf
     bereits aufgelöste Spiele (auch fin:2/fin:3 → fin:0/fin:1). */
  for(const round of KO_ROUNDS){
    round.list.forEach((m,i)=>{
      const id = `${round.key}:${i}`;
      for(const n of [1,2]){
        const s = m[round.slotAt + n - 1];
        let code = null, official = false;
        const oc = mode!=="scratch" ? OFFICIAL[koKey(id, `t${n}`)] : undefined;
        if(oc){ code = oc; official = true; }        // echte Paarung schlägt Ableitung
        else if(mode!=="info"){                      // Info-Modus: nie selbst ableiten
          if(s.g && groupDone[s.g]) code = tables[s.g][s.p-1].c;
          else if(s.t) code = thirdSlots[`${id}:${n}`] ?? null;
          else if(s.w) code = (KO_OUT[s.w] || {}).winner;
          else if(s.l) code = (KO_OUT[s.l] || {}).loser;
        }
        SLOTS[`${id}:${n}`] = {code: code ?? null, official};
      }
      /* Kaskaden-Invalidierung: Paarung geändert (z. B. Gruppentipp angepasst)
         → eigene Tore + i.E.-Toggle dieses Spiels verwerfen, sonst stünde das
         Ergebnis an der falschen Paarung. (wm26:{id}p merkt sich die Paarung.) */
      const c1 = SLOTS[`${id}:1`].code, c2 = SLOTS[`${id}:2`].code;
      const pairKey = koKey(id,"p"), cur = (c1||"")+"|"+(c2||"");
      if(store.get(pairKey)!==cur){
        if(store.get(pairKey)!==""){
          store.set(koKey(id,"s1"),""); store.set(koKey(id,"s2"),""); store.set(koKey(id,"w"),"");
        }
        store.set(pairKey, cur);
      }
      KO_OUT[id] = koResult(id, c1, c2);
    });
  }
}

/* ===================== RENDERING ===================== */
function renderTables(tables, thirds){
  for(const g of Object.keys(GROUPS)){
    document.getElementById(`tbl-${g}`).innerHTML = tables[g].map((r,pos)=>{
      const [name, flag] = TEAMS[r.c];
      const cls = pos<2 ? "q1" : pos===2 ? "q3" : "";
      return `<tr class="${cls}"><td class="t">${flag} ${name}</td><td>${r.sp}</td><td>${r.s}</td><td>${r.u}</td><td>${r.n}</td><td>${r.tf}:${r.ta}</td><td>${r.tf-r.ta>0?"+":""}${r.tf-r.ta}</td><td class="pts">${r.pkt}</td></tr>`;
    }).join("");
  }
  document.getElementById("thirds").innerHTML = thirds.map((t,i)=>{
    const [name, flag] = TEAMS[t.c];
    return `<div class="third-slot${i<8 ? " in" : ""}">
      <span class="rank">${i+1}</span><span>${flag} ${name}</span>
      <span style="margin-left:auto; font-family:var(--narrow); font-weight:700">${t.pkt} Pkt</span>
    </div>`;
  }).join("");
}

/* K.o.-Karten in-place aktualisieren (kein innerHTML-Rebuild → Eingabe-Fokus
   bleibt erhalten, wenn ein Tipp die Auflösung kaskadieren lässt). */
function renderKO(){
  for(const round of KO_ROUNDS){
    round.list.forEach((m,i)=>{
      const id = `${round.key}:${i}`;
      const res = KO_OUT[id] || {winner:null, loser:null, pen:false};
      const teams = [slotTeam(id,1), slotTeam(id,2)];
      const both = !!(teams[0].code && teams[1].code);
      const s1 = both ? effectiveValue(koKey(id,"s1")) : "";
      const s2 = both ? effectiveValue(koKey(id,"s2")) : "";
      const tie = both && s1!=="" && s2!=="" && +s1===+s2;
      /* "n.V."/"i.E. 4:3" kommt bei gefetchten Spielen aus duration/penalties,
         bei eigenen Tipps aus dem i.E.-Toggle (Gleichstand + gewählter Sieger). */
      const dur = getMode()!=="scratch" ? OFFICIAL[koKey(id,"dur")] : undefined;
      const penRes = getMode()!=="scratch" ? OFFICIAL[koKey(id,"pen")] : undefined;
      let chip = "";
      if(res.winner){
        if(dur==="ie")      chip = ` <span class="pen">i.E.${penRes ? " "+penRes : ""}</span>`;
        else if(dur==="nv") chip = ` <span class="pen">n.V.</span>`;
        else if(res.pen)    chip = ` <span class="pen">i.E.</span>`;
      }
      for(const n of [1,2]){
        const code = teams[n-1].code;
        const el = document.querySelector(`.ko-team[data-slot="${id}:${n}"]`);
        if(code){
          const [name, flag] = TEAMS[code];
          el.innerHTML = `<span class="fl">${flag}</span> ${name}${res.winner===code ? chip : ""}`;
          el.classList.remove("ph");
        }else{
          el.textContent = slotLabel(koSlotDef(id, n));
          el.classList.add("ph");
        }
        el.classList.toggle("official", teams[n-1].official);
        el.classList.toggle("win", !!code && res.winner===code);
        el.classList.toggle("togglable", tie && !isFieldLocked(koKey(id,"w")));
        const key = koKey(id, `s${n}`);
        const inp = document.querySelector(`[data-k="${key}"]`);
        inp.disabled = !both || isFieldLocked(key);
        inp.classList.toggle("official", getMode()!=="scratch" && OFFICIAL[key]!==undefined);
        const v = n===1 ? s1 : s2;
        if(document.activeElement!==inp && inp.value!==v) inp.value = v;
      }
    });
  }
  /* Weltmeister-Banner unterm Finale */
  const champ = (KO_OUT["fin:3"] || {}).winner;
  const banner = document.getElementById("champ");
  if(champ){
    const [name, flag] = TEAMS[champ];
    banner.innerHTML = `🏆 Weltmeister 2026: <b>${flag} ${name}</b>`;
    banner.hidden = false;
  }else{
    banner.hidden = true;
  }
}

function render(){
  const tables = {};
  for(const g of Object.keys(GROUPS)) tables[g] = computeGroup(g);
  const thirds = Object.keys(GROUPS).map(g=>({...tables[g][2], g}));
  thirds.sort((x,y)=>comparePoints(x,y) || x.g.localeCompare(y.g));
  resolveSlots(tables, thirds);
  renderTables(tables, thirds);
  renderKO();
}

/* ===================== SPIELPLAN / KALENDER ===================== */
/* Alle 104 Spiele (Gruppen + K.o.) zu einem chronologischen Verlauf zusammen-
   geführt, nach Tagen gruppiert. Datum-Strings ("Do 11.06.") sind schon der
   MESZ-Kalendertag → direkt als Tages-Gruppe nutzbar. Spiegelt den aktuellen
   Stand: K.o.-Paarungen kommen aus SLOTS, Ergebnisse aus effectiveValue. */
function calMatches(){
  const out = [];
  MATCHES.forEach((m,i)=>{
    out.push({ms:kickoffMs(m), live:`mi="${i}"`, liveBadge:`data-live="${i}"`,
      date:m[1], time:m[2], ort:m[5], tag:`Gruppe ${m[0]}`,
      home:{code:m[3]}, away:{code:m[4]},
      sH:effectiveValue(`wm26:m${i}h`), sA:effectiveValue(`wm26:m${i}a`)});
  });
  for(const r of KO_ROUNDS){
    r.list.forEach((m,i)=>{
      const id = `${r.key}:${i}`, t1 = slotTeam(id,1), t2 = slotTeam(id,2);
      const both = !!(t1.code && t2.code);
      out.push({ms:kickoffFromStrings(m[r.slotAt-3], m[r.slotAt-2]),
        live:`ko="${id}"`, liveBadge:`data-live-ko="${id}"`,
        date:m[r.slotAt-3], time:m[r.slotAt-2], ort:m[r.slotAt-1], tag:r.tag(i),
        home:{code:t1.code, label:slotLabel(koSlotDef(id,1))},
        away:{code:t2.code, label:slotLabel(koSlotDef(id,2))},
        sH:both?effectiveValue(koKey(id,"s1")):"", sA:both?effectiveValue(koKey(id,"s2")):""});
    });
  }
  out.sort((a,b)=>(a.ms ?? 0)-(b.ms ?? 0));
  return out;
}
function dateKeyFromStr(dStr){            // "Do 11.06." → 611 (Monat*100+Tag), für Heute/Morgen-Vergleich
  const dm = /(\d{2})\.(\d{2})\./.exec(dStr);
  return dm ? +dm[2]*100 + +dm[1] : 0;
}
function calTeamCell(t, side){
  if(t.code){ const [name, flag] = TEAMS[t.code];
    return side==="home"
      ? `<span class="cal-home">${name} <span class="fl">${flag}</span></span>`
      : `<span class="cal-away"><span class="fl">${flag}</span> ${name}</span>`; }
  return `<span class="cal-${side} ph">${t.label || ""}</span>`;
}
function buildCalendar(){
  const list = calMatches();
  const now = new Date();
  const keyOf = d => (d.getMonth()+1)*100 + d.getDate();
  const todayKey = keyOf(now), tomorrowKey = keyOf(new Date(now.getTime()+864e5));
  /* Scrollziel: heute, sonst der nächste anstehende Spieltag */
  let scrollKey = null;
  for(const m of list){ const k = dateKeyFromStr(m.date);
    if(k>=todayKey){ scrollKey = k; break; } }
  let html = "", curDate = null;
  for(const m of list){
    if(m.date!==curDate){
      curDate = m.date;
      const k = dateKeyFromStr(m.date);
      const n = list.filter(x=>x.date===m.date).length;
      const rel = k===todayKey ? `<span class="cal-rel">Heute</span>`
                : k===tomorrowKey ? `<span class="cal-rel">Morgen</span>` : "";
      const today = k===scrollKey;
      html += `<div class="cal-day${today?" is-today":""}"${today?` id="calToday"`:""}>`
            + `<span>${m.date}</span>${rel}<span class="cal-count">${n} ${n===1?"Spiel":"Spiele"}</span></div>`;
    }
    const both = m.sH!=="" && m.sA!=="";
    const score = both
      ? `<b>${m.sH}</b> : <b>${m.sA}</b>`
      : `<span class="cal-vs">–</span>`;
    html += `<div class="cal-row" data-${m.live}>`
          + `<span class="cal-when"><b>${m.time}</b>${m.tag}</span>`
          + calTeamCell(m.home,"home")
          + `<span class="cal-score"><span class="cal-sc">${score}</span>`
          + `<button class="live-badge" type="button" ${m.liveBadge} title="Live-Ergebnis googeln">● Live 🔍</button></span>`
          + calTeamCell(m.away,"away")
          + `<span class="cal-ort">${m.ort}</span>`
          + `</div>`;
  }
  document.getElementById("calBody").innerHTML = html;
}
function openCalendar(){
  buildCalendar();
  refreshLive();
  const modal = document.getElementById("calModal");
  modal.hidden = false;
  const body = document.getElementById("calBody");
  const target = document.getElementById("calToday");
  body.scrollTop = target ? Math.max(0, target.offsetTop - 4) : 0;
}
function closeCalendar(){ document.getElementById("calModal").hidden = true; }

/* ===================== EVENTS ===================== */
function wire(){
  document.querySelectorAll("[data-k]").forEach(el=>{
    const key = el.dataset.k;
    const v = effectiveValue(key);
    el.value = v!==undefined ? v : "";
    const locked = isFieldLocked(key);
    el.disabled = locked;
    if(el.classList.contains("score"))
      el.classList.toggle("official", getMode()!=="scratch" && OFFICIAL[key]!==undefined);
    if(!locked){
      el.addEventListener("input", ()=>{ store.set(key, el.value); render(); });
    }
  });
}

function rebuild(){
  buildGroups();
  buildKO();
  wire();
  render();
  updateChrome();
  updateLiveStamp();
  refreshLive();
}

function chooseMode(newMode){
  const cur = getMode();
  if(cur!==newMode) store.clearAll();   // Moduswechsel = sauberer Start
  setMode(newMode);
  document.getElementById("modeModal").hidden = true;
  rebuild();
}
function showModeModal(){ document.getElementById("modeModal").hidden = false; }

function resetAll(){
  store.clearAll();
  rebuild();
}

const MODE_INFO = {
  scratch:  ["Von 0 rechnen", "Leerer Spielplan. Du trägst alle Ergebnisse selbst ein. Tabellen, Gruppendritte und der komplette K.o.-Baum berechnen sich automatisch."],
  continue: ["Weiterrechnen", "Bereits gespielte Spiele sind eingetragen. Den Rest trägst du selbst ein und probierst Szenarien durch. Tabellen, Gruppendritte und der komplette K.o.-Baum berechnen sich automatisch."],
  info:     ["Nur Info", "Aktueller Stand der WM. Reine Ansicht, nichts editierbar."]
};
function updateChrome(){
  const mode = getMode();
  const [label, hint] = MODE_INFO[mode] || ["", ""];
  let html = `<span class="mode-tag">Modus: ${label}</span>`;
  html += `<button class="btn secondary" onclick="showModeModal()">Modus wechseln</button>`;
  if(mode!=="info")
    html += `<button class="btn secondary" onclick="resetAll()">Alle Tipps löschen</button>`;
  html += `<button class="btn cal-btn" onclick="openCalendar()">📅 Spielplan</button>`;
  document.getElementById("toolbar").innerHTML = html;
  document.getElementById("hint").textContent = hint;
}

/* ===================== START ===================== */
document.querySelectorAll("#modeModal .mode-btn").forEach(b=>{
  b.addEventListener("click", ()=>chooseMode(b.dataset.mode));
});
/* Modal ohne Moduswechsel schließen: Klick auf den Hintergrund oder Escape */
document.getElementById("modeModal").addEventListener("click", e=>{
  if(e.target === e.currentTarget) e.currentTarget.hidden = true;
});
document.addEventListener("keydown", e=>{
  if(e.key === "Escape"){
    document.getElementById("modeModal").hidden = true;
    closeCalendar();
  }
});
/* Spielplan-Modal: schließen per X / Hintergrund-Klick, Live-Badge → Google-Suche */
document.getElementById("calClose").addEventListener("click", closeCalendar);
document.getElementById("calModal").addEventListener("click", e=>{
  if(e.target === e.currentTarget) closeCalendar();
});
document.getElementById("calBody").addEventListener("click", e=>{
  const b = e.target.closest(".live-badge");
  if(!b) return;
  if(b.dataset.live!==undefined) openLiveSearch(+b.dataset.live);
  else if(b.dataset.liveKo!==undefined) openLiveSearchKO(b.dataset.liveKo);
});
document.getElementById("groups").addEventListener("click", e=>{
  const b = e.target.closest(".live-badge");
  if(b) openLiveSearch(+b.dataset.live);
});
/* K.o.-Bereich: Live-Badge → Google-Suche; i.E.-Toggle: bei Gleichstand Klick
   auf die Team-Zeile = Elfmeter-Sieger markieren, zweiter Klick nimmt's zurück. */
for(const cid of ["r32","r16","qf","finals"]){
  document.getElementById(cid).addEventListener("click", e=>{
    const b = e.target.closest(".live-badge");
    if(b){ openLiveSearchKO(b.dataset.liveKo); return; }
    const el = e.target.closest(".ko-team.togglable");
    if(!el) return;
    const slotId = el.dataset.slot;                // "r32:0:1"
    const n = slotId.slice(-1), id = slotId.slice(0, -2);
    const wKey = koKey(id, "w");
    store.set(wKey, store.get(wKey)===n ? "" : n);
    render();
  });
}

(async function init(){
  await loadOfficial();
  if(!getMode()) setMode("continue");   // Standard: Weiterrechnen, ohne Abfrage
  rebuild();                            // Moduswechsel nur über den Button
  setInterval(refreshLive, 60000);      // LIVE-Status jede Minute nachziehen
})();
