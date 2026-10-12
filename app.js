import { DEFAULT_SEASON, MIN_SEASON, MAX_SEASON, BINGO_EVENTS } from "./config.js";
import * as api from "./providers/f1ApiProvider.js";
import { driverPhoto, teamCarPhoto, teamLogo, teamColor, imgTag } from "./assets.js";

// Fotoğraflar sadece 2026 sezonu için (formula1.com 2026 kadrosu)
const PHOTOS = () => S.season === "2026";

const $ = (id) => document.getElementById(id);
const TABS = [
  ["cal", "Yarış Takvimi"], ["drivers", "Pilotlar Şampiyonası"], ["teams", "Takımlar Şampiyonası"],
  ["qr", "Grid / Yarış"], ["pg", "Position Gain"], ["pgnn", "Position Gain No Negative"],
  ["pgc", "Position Gaining Championship"], ["pgns", "Position Gaining No Split"], ["ters", "Ters Şampiyona"],
  ["history", "Tarihçe"], ["bingo", "Bingo"],
];
const ROUND_TABS = new Set(["qr", "pg", "pgnn", "pgc", "pgns", "ters"]);
const cache = new Map();
let S = { season: DEFAULT_SEASON, tab: "drivers", round: "", q: "", data: null, loading: false };

const fmtPts = (v) => Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function matchQ(...parts) {
  return parts.join(" ").toLocaleLowerCase("tr").includes(S.q);
}

async function loadSeason(season) {
  if (cache.has(season)) return cache.get(season);
  const data = await api.loadSeason(season);
  cache.set(season, data);
  return data;
}

async function boot() {
  // sezon listesi
  const years = [];
  for (let y = Number(MAX_SEASON); y >= Number(MIN_SEASON); y--) years.push(String(y));
  $("season").innerHTML = years.map((y) => `<option ${y === S.season ? "selected" : ""}>${y}</option>`).join("");
  $("tabs").innerHTML = TABS.map(([k, l]) => `<button data-t="${k}" class="${k === S.tab ? "active" : ""}">${l}</button>`).join("");
  $("tabs").onclick = (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    S.tab = b.dataset.t;
    [...$("tabs").children].forEach((x) => x.classList.toggle("active", x === b));
    render();
  };
  $("season").onchange = async () => { S.season = $("season").value; S.round = ""; await refresh(); };
  $("search").oninput = () => { S.q = $("search").value.toLocaleLowerCase("tr"); render(); };
  $("roundFilter").onchange = () => { S.round = $("roundFilter").value; render(); };
  await refresh();
}

async function refresh() {
  S.loading = true;
  $("statLine").textContent = `${S.season} yükleniyor...`;
  $("content").innerHTML = "";
  try {
    S.data = await loadSeason(S.season);
    fillRounds();
    render();
  } catch (e) {
    $("statLine").textContent = "Hata: " + e.message;
    $("content").innerHTML = `<div class="card"><div class="cb">Yüklenemedi</div><div class="cm">İnternet/API sorunu olabilir. Sayfayı yenilemeyi dene.</div><div class="bingoBar"><button id="retry">Tekrar dene</button></div></div>`;
    const b = $("retry");
    if (b) b.onclick = () => { cache.delete(S.season); refresh(); };
  } finally { S.loading = false; }
}

function fillRounds() {
  const sel = $("roundFilter");
  const show = ROUND_TABS.has(S.tab);
  sel.style.display = show ? "" : "none";
  if (!show) return;
  const ds = S.data.rounds;
  sel.innerHTML = `<option value="">Sezon toplamı (${ds.length} tur)</option>` +
    ds.map((r) => `<option value="${r.round}" ${String(r.round) === S.round ? "selected" : ""}>R${r.round} — ${esc(r.name)}</option>`).join("");
  if (S.tab === "qr" && !S.round && ds.length) { S.round = String(ds[ds.length - 1].round); sel.value = S.round; }
}

function table(head, rows) {
  return `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${head.length}">Sonuç yok</td></tr>`}</tbody></table>`;
}

// Sıra değişim oku: diff = önceki sıra - yeni sıra
function deltaCell(x) {
  if (x.diff === null || x.diff === undefined) return `<span class="newtag">YENİ</span>`;
  if (x.diff > 0) return `<span class="up">▲${x.diff}</span>`;
  if (x.diff < 0) return `<span class="down">▼${-x.diff}</span>`;
  return `<span class="mut">–</span>`;
}

function splitView(last, leftTable, rightTable) {
  return `<div class="split"><div class="card lastrace"><div class="ct">Son yarış — R${last.round} ${esc(last.name)}</div>${leftTable}</div><div class="fullwrap">${rightTable}</div></div>`;
}

// Son turun takım puanları (sol panel için)
function lastRoundTeams(last) {
  const tm = new Map();
  for (const x of last.drivers) {
    if (!tm.has(x.teamId)) tm.set(x.teamId, { id: x.teamId, name: x.team, v: 0, w: 0 });
    const t = tm.get(x.teamId);
    t.v += x.realPoints;
    if (x.finish === 1) t.w++;
  }
  return [...tm.values()].sort((a, b) => b.v - a.v);
}

function render() {
  fillRounds();
  const d = S.data;
  if (!d) return;
  $("updated").textContent = `Kaynak: ${d.source} • ${d.completed} tur`;
  const R = S.round ? api.getRound(d, S.round) : null;
  let html = "", stat = "";

  if (S.tab === "cal") {
    const done = new Set(d.rounds.map((r) => r.round));
    html = table(["#", "Yarış", "Tarih", "Pist", "Kazanan"],
      d.schedule.map((s) => {
        const rd = d.rounds.find((r) => r.round === s.round);
        return `<tr><td class="pos">R${s.round}</td><td>${esc(s.name)}</td><td>${esc(s.date)}</td><td>${esc(s.circuit)}</td><td>${rd && rd.winner ? `<b>${esc(rd.winner.code)}</b> <span class="mut">${esc(rd.winner.team)}</span>` : "<span class='mut'>—</span>"}</td></tr>`;
      }));
    stat = `${d.schedule.length} yarış • ${done.size} tamamlandı`;
  } else if (S.tab === "drivers" || S.tab === "teams") {
    const isD = S.tab === "drivers";
    const opts = { who: isD ? "drivers" : "teams", metric: "real" };
    if (d.rounds.length >= 2) {
      const rows = api.tableWithChanges(d, opts).filter((x) => matchQ(x.name, x.code || ""));
      const last = d.rounds[d.rounds.length - 1];
      let left;
      if (isD) {
        const top = [...last.drivers].filter((x) => x.classified).sort((a, b) => a.finish - b.finish).slice(0, 10);
        left = table(["Finiş", "Pilot", "Puan"], top.map((x) =>
          `<tr><td class="pos">P${x.finish}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td class="pts">${fmtPts(x.realPoints)}</td></tr>`));
      } else {
        left = table(["Takım", "Puan"], lastRoundTeams(last).map((t) =>
          `<tr><td><span class="who">${PHOTOS() ? imgTag(teamLogo(t.id), t.name, "logo") : ""}${esc(t.name)}</span></td><td class="pts">${fmtPts(t.v)}</td></tr>`));
      }
      const right = table(isD ? ["#", "Δ", "Pilot", "Takım", "G", "Puan"] : ["#", "Δ", "Takım", "G", "Puan"],
        rows.map((x) => {
          const bar = `<span class="tbar" style="background:${teamColor(isD ? x.teamId : x.id)}"></span>`;
          if (isD) {
            const ph = PHOTOS() ? imgTag(driverPhoto(x.code), x.name, "dphoto") : "";
            return `<tr><td class="pos">${x.rank}</td><td>${deltaCell(x)}</td><td><span class="who">${ph}<span>${bar}<b>${esc(x.code)}</b> ${esc(x.name)}</span></span></td><td>${esc(x.team)}</td><td>${x.wins}</td><td class="pts">${fmtPts(x.value)}</td></tr>`;
          }
          const logo = PHOTOS() ? imgTag(teamLogo(x.id), x.name, "logo") : "";
          const car = PHOTOS() ? imgTag(teamCarPhoto(x.id), x.name, "carphoto") : "";
          return `<tr><td class="pos">${x.rank}</td><td>${deltaCell(x)}</td><td><span class="who">${logo}${car}<span>${bar}${esc(x.name)}</span></span></td><td>${x.wins}</td><td class="pts">${fmtPts(x.value)}</td></tr>`;
        }));
      html = splitView(last, left, right);
      stat = `${rows.length} ${isD ? "pilot" : "takım"} • oklar bir önceki tura göre`;
    } else {
      const rows = api.computeTable(d, opts).filter((x) => matchQ(x.name, x.code || ""));
      html = table(isD ? ["#", "Pilot", "Takım", "Galibiyet", "Puan"] : ["#", "Takım", "Galibiyet", "Puan"],
        rows.map((x, i) => {
          const bar = `<span class="tbar" style="background:${teamColor(isD ? x.teamId : x.id)}"></span>`;
          if (isD) {
            const ph = PHOTOS() ? imgTag(driverPhoto(x.code), x.name, "dphoto") : "";
            return `<tr><td class="pos">${i + 1}</td><td><span class="who">${ph}<span>${bar}<b>${esc(x.code)}</b> ${esc(x.name)}</span></span></td><td>${esc(x.team)}</td><td>${x.wins}</td><td class="pts">${fmtPts(x.value)}</td></tr>`;
          }
          const logo = PHOTOS() ? imgTag(teamLogo(x.id), x.name, "logo") : "";
          return `<tr><td class="pos">${i + 1}</td><td><span class="who">${logo}<span>${bar}${esc(x.name)}</span></span></td><td>${x.wins}</td><td class="pts">${fmtPts(x.value)}</td></tr>`;
        }));
      stat = `${rows.length} ${isD ? "pilot" : "takım"}`;
    }
  } else if (S.tab === "qr") {
    const list = R ? R.drivers.filter((x) => matchQ(x.name, x.code, x.team)) : [];
    html = table(["Grid", "Pilot", "Finiş", "Kazanç", "Durum"],
      [...list].sort((a, b) => (a.grid - b.grid)).map((x) =>
        `<tr><td class="pos">${x.grid}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>${x.finish ?? "–"}</td><td class="pts">${x.gain === null ? "–" : (x.gain > 0 ? "+" : "") + x.gain}</td><td class="mut">${esc(x.status)}</td></tr>`));
    stat = R ? `${R.name} • ${list.length} pilot` : "Tur seç";
  } else if (S.tab === "pg" || S.tab === "pgnn") {
    const nn = S.tab === "pgnn";
    const metric = nn ? "pgnn" : "pg";
    const label = nn ? "PGNN" : "PG";
    if (R) {
      const list = R.byGain.filter((x) => matchQ(x.name, x.code)).map((x) => ({ ...x, v: nn ? Math.max(0, x.gain) : x.gain }));
      html = table(["#", "Pilot", "Grid → Finiş", label],
        list.map((x, i) => `<tr><td class="pos">${i + 1}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>${x.grid} → ${x.finish}</td><td class="pts">${x.v > 0 ? "+" : ""}${x.v}</td></tr>`));
      stat = `${R.name}`;
    } else if (d.rounds.length >= 2) {
      const rows = api.tableWithChanges(d, { who: "drivers", metric }).filter((x) => matchQ(x.name, x.code));
      const last = d.rounds[d.rounds.length - 1];
      const left = table(["#", "Pilot", label], last.byGain.slice(0, 10).map((x, i) => {
        const v = nn ? Math.max(0, x.gain) : x.gain;
        return `<tr><td class="pos">${i + 1}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td class="pts">${v > 0 ? "+" : ""}${v}</td></tr>`;
      }));
      const right = table(["#", "Δ", "Pilot", "Takım", label],
        rows.map((x) => `<tr><td class="pos">${x.rank}</td><td>${deltaCell(x)}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>${esc(x.team)}</td><td class="pts">${x.value > 0 ? "+" : ""}${x.value}</td></tr>`));
      html = splitView(last, left, right);
      stat = `${rows.length} pilot • oklar bir önceki tura göre`;
    } else {
      const rows = api.computeTable(d, { who: "drivers", metric }).filter((x) => matchQ(x.name, x.code));
      html = table(["#", "Pilot", "Takım", label],
        rows.map((x, i) => `<tr><td class="pos">${i + 1}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>${esc(x.team)}</td><td class="pts">${x.value > 0 ? "+" : ""}${x.value}</td></tr>`));
      stat = `${rows.length} pilot • sezon toplamı`;
    }
  } else if (S.tab === "pgc" || S.tab === "pgns") {
    const split = S.tab === "pgc";
    if (R) {
      const map = split ? R.pgcSplit : R.pgns;
      const list = R.byGain.filter((x) => map.has(x.id) && matchQ(x.name, x.code));
      html = table(["#", "Pilot", "Kazanç", "Puan"],
        list.map((x, i) => `<tr><td class="pos">${i + 1}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>+${x.gain}</td><td class="pts">${fmtPts(map.get(x.id))}</td></tr>`));
      stat = `${R.name} • ${split ? "bölüşmeli" : "bölüşmesiz"}`;
    } else if (d.rounds.length >= 2) {
      const rows = api.tableWithChanges(d, { who: "drivers", metric: "pgc", split }).filter((x) => matchQ(x.name, x.code));
      const last = d.rounds[d.rounds.length - 1];
      const map = split ? last.pgcSplit : last.pgns;
      const left = table(["#", "Pilot", "Puan"], last.byGain.filter((x) => map.has(x.id)).slice(0, 10).map((x, i) =>
        `<tr><td class="pos">${i + 1}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td class="pts">${fmtPts(map.get(x.id))}</td></tr>`));
      const right = table(["#", "Δ", "Pilot", "Takım", "Puan"],
        rows.map((x) => `<tr><td class="pos">${x.rank}</td><td>${deltaCell(x)}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>${esc(x.team)}</td><td class="pts">${fmtPts(x.value)}</td></tr>`));
      html = splitView(last, left, right);
      stat = `${rows.length} pilot • oklar bir önceki tura göre`;
    } else {
      const rows = api.computeTable(d, { who: "drivers", metric: "pgc", split }).filter((x) => matchQ(x.name, x.code));
      html = table(["#", "Pilot", "Takım", "Puan"],
        rows.map((x, i) => `<tr><td class="pos">${i + 1}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>${esc(x.team)}</td><td class="pts">${fmtPts(x.value)}</td></tr>`));
      stat = `${rows.length} pilot • sezon toplamı`;
    }
  } else if (S.tab === "ters") {
    if (R) {
      const cls = [...R.drivers].filter((x) => x.classified).sort((a, b) => b.finish - a.finish);
      const list = cls.filter((x) => R.ters.has(x.id) && matchQ(x.name, x.code));
      html = table(["Ters #", "Pilot", "Finiş", "Puan"],
        list.map((x, i) => `<tr><td class="pos">${i + 1}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>P${x.finish}</td><td class="pts">${fmtPts(R.ters.get(x.id))}</td></tr>`));
      stat = `${R.name} • sondan başa`;
    } else if (d.rounds.length >= 2) {
      const rows = api.tableWithChanges(d, { who: "drivers", metric: "ters" }).filter((x) => matchQ(x.name, x.code));
      const last = d.rounds[d.rounds.length - 1];
      const cls = [...last.drivers].filter((x) => x.classified).sort((a, b) => b.finish - a.finish);
      const left = table(["Ters #", "Pilot", "Puan"], cls.filter((x) => last.ters.has(x.id)).map((x, i) =>
        `<tr><td class="pos">${i + 1}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td class="pts">${fmtPts(last.ters.get(x.id))}</td></tr>`));
      const right = table(["#", "Δ", "Pilot", "Takım", "Puan"],
        rows.map((x) => `<tr><td class="pos">${x.rank}</td><td>${deltaCell(x)}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>${esc(x.team)}</td><td class="pts">${fmtPts(x.value)}</td></tr>`));
      html = splitView(last, left, right);
      stat = `${rows.length} pilot • oklar bir önceki tura göre`;
    } else {
      const rows = api.computeTable(d, { who: "drivers", metric: "ters" }).filter((x) => matchQ(x.name, x.code));
      html = table(["#", "Pilot", "Takım", "Puan"],
        rows.map((x, i) => `<tr><td class="pos">${i + 1}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>${esc(x.team)}</td><td class="pts">${fmtPts(x.value)}</td></tr>`));
      stat = `${rows.length} pilot • sezon toplamı`;
    }
  } else if (S.tab === "history") {
    const c = api.getChampions(d);
    const dph = PHOTOS() && c.driver ? imgTag(driverPhoto(c.driver.code), c.driver.name, "cardphoto") : "";
    const dcol = c.driver ? teamColor(c.driver.teamId) : "#e10600";
    const tcol = c.team ? teamColor(c.team.id) : "#e10600";
    const tlogo = PHOTOS() && c.team ? imgTag(teamLogo(c.team.id), c.team.name, "cardlogo") : "";
    html = `<div class="cards">
      <div class="card" style="border-top-color:${dcol}"><div class="ct">Pilot Şampiyonu</div><div class="cb">${dph}<span><b>${c.driver ? esc(c.driver.code) : "—"}</b> ${c.driver ? esc(c.driver.name) : ""}</span></div><div class="cm">${c.driver ? fmtPts(c.driver.value) + " puan • " + c.driver.wins + " galibiyet" : ""}</div></div>
      <div class="card" style="border-top-color:${tcol}"><div class="ct">Takım Şampiyonu</div><div class="cb">${tlogo}<b>${c.team ? esc(c.team.name) : "—"}</b></div><div class="cm">${c.team ? fmtPts(c.team.value) + " puan • " + c.team.wins + " galibiyet" : ""}</div></div>
      <div class="card"><div class="ct">Sezon</div><div class="cb"><b>${esc(S.season)}</b></div><div class="cm">${c.rounds} tur • ${c.differentWinners} farklı kazanan</div></div>
    </div>`;
    stat = `${S.season} sezonu özeti`;
  } else if (S.tab === "bingo") {
    html = `<div id="bingoGrid" class="bingo"></div><div class="bingoBar"><span id="bingoCount"></span><button id="bingoAdd">+ Olay ekle</button><button id="bingoReset">Sıfırla</button></div>`;
    stat = "WC olayları — tıkla işaretle";
  }
  $("content").innerHTML = html;
  $("statLine").textContent = stat;
  if (S.tab === "bingo") initBingo();
}

// --- Bingo ---
const BKEY = "cardemir-bingo-v1";
function bingoState() {
  try { return JSON.parse(localStorage.getItem(BKEY)) || {}; } catch { return {}; }
}
function initBingo() {
  const st = bingoState();
  const custom = st._custom || [];
  const events = [...BINGO_EVENTS, ...custom];
  const grid = $("bingoGrid");
  const paint = () => {
    grid.innerHTML = events.map((e, i) =>
      `<div class="tile ${st[i] ? "on" : ""}" data-i="${i}">${esc(e)}</div>`).join("");
    const n = events.filter((_, i) => st[i]).length;
    $("bingoCount").textContent = `${n}/${events.length} tamamlandı`;
  };
  grid.onclick = (e) => {
    const t = e.target.closest(".tile");
    if (!t) return;
    const i = t.dataset.i;
    const s = bingoState();
    s[i] = !s[i];
    localStorage.setItem(BKEY, JSON.stringify(s));
    initBingo();
  };
  $("bingoAdd").onclick = () => {
    const v = prompt("Yeni olay:");
    if (!v || !v.trim()) return;
    const s = bingoState();
    s._custom = [...(s._custom || []), v.trim()];
    localStorage.setItem(BKEY, JSON.stringify(s));
    initBingo();
  };
  $("bingoReset").onclick = () => { localStorage.removeItem(BKEY); initBingo(); };
  paint();
}

boot();

// Beklenmedik JS hatası olursa ekranda göster (sessiz "yükleniyor" takılmasını önler)
window.addEventListener("error", (e) => {
  const el = document.getElementById("statLine");
  if (el && /yükleniyor/.test(el.textContent)) el.textContent = "Hata: " + (e.message || "bilinmeyen");
});
