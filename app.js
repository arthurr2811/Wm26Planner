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

async function loadOfficial(){
  OFFICIAL = {};
  officialUpdated = "";
  let data = null;
  try{
    const r = await fetch("results.json", {cache:"no-store"});
    if(r.ok) data = await r.json();
  }catch(e){ data = null; }   // keine Datei / file:// → keine offiziellen Daten
  if(data){
    if(typeof data._updated === "string") officialUpdated = data._updated;
    for(const idx in data){
      const m = data[idx];
      if(m && m.h!=null && m.a!=null){
        OFFICIAL["wm26:m"+idx+"h"] = String(m.h);
        OFFICIAL["wm26:m"+idx+"a"] = String(m.a);
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
function kickoffMs(m){
  const dm = /(\d{2})\.(\d{2})\./.exec(m[1]);  // "Do 11.06." → 11, 06
  const tm = /(\d{2}):(\d{2})/.exec(m[2]);     // "21:00"     → 21, 00
  if(!dm || !tm) return null;
  return Date.UTC(2026, +dm[2]-1, +dm[1], +tm[1]-2, +tm[2]);  // MESZ → UTC
}
function isLive(i, now){
  if(OFFICIAL[`wm26:m${i}h`]!==undefined) return false; // bereits offiziell beendet
  const k = kickoffMs(MATCHES[i]);
  return k!=null && now >= k && now < k + LIVE_MS;
}
function refreshLive(){
  const now = Date.now();
  document.querySelectorAll(".match[data-mi]").forEach(row=>{
    row.classList.toggle("live", isLive(+row.dataset.mi, now));
  });
}
/* Klick aufs LIVE-Badge → Google-Suche zum Spiel im neuen Tab. */
function openLiveSearch(i){
  const m = MATCHES[i];
  const q = encodeURIComponent(`${TEAMS[m[3]][0]} ${TEAMS[m[4]][0]} live`);
  window.open(`https://www.google.com/search?q=${q}`, "_blank", "noopener");
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
function koCard(tag, d, t, ort, ph1, ph2, idx, prefix, final){
  return `<div class="ko${final ? " final" : ""}">
    <div class="ko-top"><span class="tag">${tag}</span><span class="meta">${d} · ${t} · ${ort}</span></div>
    <div class="ko-row">
      <input class="ko-team" type="text" placeholder="${ph1}" data-k="wm26:${prefix}${idx}t1">
      ${scoreInput(`wm26:${prefix}${idx}s1`)}
    </div>
    <div class="ko-row">
      <input class="ko-team" type="text" placeholder="${ph2}" data-k="wm26:${prefix}${idx}t2">
      ${scoreInput(`wm26:${prefix}${idx}s2`)}
    </div>
  </div>`;
}
function buildKO(){
  document.getElementById("r32").innerHTML = R32.map((m,i)=>koCard(`SF ${i+1}`, ...m.slice(0,3), m[3], m[4], i, "r32", false)).join("");
  document.getElementById("r16").innerHTML = R16.map((m,i)=>koCard(`AF ${i+1}`, ...m.slice(0,3), m[3], m[4], i, "r16", false)).join("");
  document.getElementById("qf").innerHTML  = QF.map((m,i)=>koCard(`VF ${i+1}`, ...m.slice(0,3), m[3], m[4], i, "qf", false)).join("");
  document.getElementById("finals").innerHTML = FINALS.map((m,i)=>koCard(m[0], m[1], m[2], m[3], m[4], m[5], i, "fin", m[0]==="Finale")).join("");
}

/* ===================== TABELLENLOGIK ===================== */
/* Gemeinsame Tabellen-Sortierung: Punkte → Tordifferenz → erzielte Tore.
   Den finalen Gleichstand-Tiebreaker (Name bzw. Gruppe) hängt der Aufrufer an. */
function comparePoints(x, y){
  return y.pkt-x.pkt || (y.tf-y.ta)-(x.tf-x.ta) || y.tf-x.tf;
}
function computeGroup(g){
  const rows = {};
  GROUPS[g].forEach(c=>rows[c]={c, sp:0, s:0, u:0, n:0, tf:0, ta:0, pkt:0});
  MATCHES.forEach((m,i)=>{
    if(m[0]!==g) return;
    const h = effectiveValue(`wm26:m${i}h`), a = effectiveValue(`wm26:m${i}a`);
    if(h==="" || a==="") return;
    const hg = +h, ag = +a;
    const H = rows[m[3]], A = rows[m[4]];
    H.sp++; A.sp++; H.tf+=hg; H.ta+=ag; A.tf+=ag; A.ta+=hg;
    if(hg>ag){H.s++; A.n++; H.pkt+=3;}
    else if(hg<ag){A.s++; H.n++; A.pkt+=3;}
    else {H.u++; A.u++; H.pkt++; A.pkt++;}
  });
  return Object.values(rows).sort((x,y)=>
    comparePoints(x,y) || TEAMS[x.c][0].localeCompare(TEAMS[y.c][0]));
}
function render(){
  const thirds = [];
  for(const g of Object.keys(GROUPS)){
    const sorted = computeGroup(g);
    document.getElementById(`tbl-${g}`).innerHTML = sorted.map((r,pos)=>{
      const [name, flag] = TEAMS[r.c];
      const cls = pos<2 ? "q1" : pos===2 ? "q3" : "";
      return `<tr class="${cls}"><td class="t">${flag} ${name}</td><td>${r.sp}</td><td>${r.s}</td><td>${r.u}</td><td>${r.n}</td><td>${r.tf}:${r.ta}</td><td>${r.tf-r.ta>0?"+":""}${r.tf-r.ta}</td><td class="pts">${r.pkt}</td></tr>`;
    }).join("");
    const t = sorted[2];
    thirds.push({...t, g});
  }
  thirds.sort((x,y)=>comparePoints(x,y) || x.g.localeCompare(y.g));
  document.getElementById("thirds").innerHTML = thirds.map((t,i)=>{
    const [name, flag] = TEAMS[t.c];
    return `<div class="third-slot${i<8 ? " in" : ""}">
      <span class="rank">${i+1}</span><span>${flag} ${name}</span>
      <span style="margin-left:auto; font-family:var(--narrow); font-weight:700">${t.pkt} Pkt</span>
    </div>`;
  }).join("");
}

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
  scratch:  ["Von 0 tippen", "Leerer Spielplan – du tippst alle Ergebnisse selbst. Gruppentabellen und das Ranking der Gruppendritten berechnen sich automatisch (Punkte → Tordifferenz → Tore)."],
  continue: ["Weiterrechnen", "Bereits gespielte Spiele sind eingetragen und gesperrt (grün). Offene Spiele tippst du selbst und probierst Szenarien durch. Gruppentabellen und das Ranking der Gruppendritten berechnen sich automatisch (Punkte → Tordifferenz → Tore)."],
  info:     ["Nur Info", "Aktueller Stand der bereits gespielten Gruppenspiele. Reine Ansicht – nichts editierbar."]
};
function updateChrome(){
  const mode = getMode();
  const [label, hint] = MODE_INFO[mode] || ["", ""];
  let html = `<span class="mode-tag">Modus: ${label}</span>`;
  html += `<button class="btn secondary" onclick="showModeModal()">Modus wechseln</button>`;
  if(mode!=="info")
    html += `<button class="btn secondary" onclick="resetAll()">Alle Tipps löschen</button>`;
  document.getElementById("toolbar").innerHTML = html;
  document.getElementById("hint").textContent = hint;
}

/* ===================== START ===================== */
document.querySelectorAll("#modeModal .mode-btn").forEach(b=>{
  b.addEventListener("click", ()=>chooseMode(b.dataset.mode));
});
document.getElementById("groups").addEventListener("click", e=>{
  const b = e.target.closest(".live-badge");
  if(b) openLiveSearch(+b.dataset.live);
});

(async function init(){
  await loadOfficial();
  if(!getMode()) setMode("continue");   // Standard: Weiterrechnen, ohne Abfrage
  rebuild();                            // Moduswechsel nur über den Button
  setInterval(refreshLive, 60000);      // LIVE-Status jede Minute nachziehen
})();
