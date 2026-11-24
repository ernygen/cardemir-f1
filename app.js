import { DEFAULT_SEASON, MIN_SEASON, MAX_SEASON } from "./config.js?v=10";
import * as api from "./providers/f1ApiProvider.js?v=10";
import { driverPhoto, teamCarPhoto, teamCarPhotoYear, teamLogo, trackCardPhoto, teamColor, hasTeam, imgTag, wikiImg, wikiLogoImg, wikiGpImg, hydrateWiki, f1Headshot } from "./assets.js?v=10";
import { getPowerRankings, saveRoundPowerRankings, clearRoundPowerRankings, resetAllPowerRankings, parsePowerInput, formatPowerItems, exportPowerRankings } from "./powerRankings.js?v=10";

const $ = (id) => document.getElementById(id);
const TABS = [
  ["tracks", "Tracks"], ["drivers", "Drivers' Championship"], ["teams", "Constructors' Championship"],
  ["qr", "Grid / Race"], ["pg", "Position Gain"], ["ters", "Reverse Championship"],
  ["power", "Power Rankings"],
  ["history", "History"],
];
const PG_MODES = [
  ["pg", "Position Gain (with negatives)"],
  ["pgnn", "Position Gain No Negative"],
  ["pgc", "PGC (split)"],
  ["pgns", "PGNS (no split)"],
];
const ROUND_TABS = new Set(["qr", "pg", "ters", "power"]);
const cache = new Map();
let S = { season: DEFAULT_SEASON, tab: "drivers", round: "", pgmode: "pg", powerSort: "pts", q: "", data: null, loading: false };
let PR_SELECTED_ROUND = null;
let PR_EDITOR_OPEN = true;

const fmtPts = (v) => Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

function matchQ(...parts) {
  return parts.join(" ").toLocaleLowerCase("en").includes(S.q);
}

async function loadSeason(season) {
  if (cache.has(season)) return cache.get(season);
  const data = await api.loadSeason(season);
  cache.set(season, data);
  return data;
}

async function boot() {
  // season list
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
  $("season").onchange = async () => { S.season = $("season").value; S.round = ""; PR_SELECTED_ROUND = null; await refresh(); };
  $("search").oninput = () => { S.q = $("search").value.toLocaleLowerCase("en"); render(); };
  $("roundFilter").onchange = () => {
    S.round = $("roundFilter").value;
    if (/^\d+$/.test(S.round)) PR_SELECTED_ROUND = Number(S.round); // GP picked: editor follows (sprints have no rankings)
    render();
  };
  $("pgMode").innerHTML = PG_MODES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  $("pgMode").onchange = () => { S.pgmode = $("pgMode").value; render(); };
  const POWER_SORTS = [
    ["pts", "Sort: Total points (25-1)"],
    ["avg", "Sort: Average score"],
    ["score", "Sort: Total score"],
  ];
  const pSort = $("powerSort");
  if (pSort) {
    pSort.innerHTML = POWER_SORTS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
    pSort.onchange = () => { S.powerSort = pSort.value; render(); };
  }
  await refresh();
}

async function refresh() {
  S.loading = true;
  $("statLine").textContent = `loading ${S.season}...`;
  $("content").innerHTML = "";
  try {
    S.data = await loadSeason(S.season);
    fillRounds();
    render();
  } catch (e) {
    $("statLine").textContent = "Error: " + e.message;
    $("content").innerHTML = `<div class="card"><div class="cb">Couldn't load</div><div class="cm">Check your connection/API, then retry.</div><div class="actions"><button id="retry">Retry</button></div></div>`;
    const b = $("retry");
    if (b) b.onclick = () => { cache.delete(S.season); refresh(); };
  } finally { S.loading = false; }
}

function fillRounds() {
  const sel = $("roundFilter");
  const pgm = $("pgMode");
  pgm.style.display = S.tab === "pg" ? "" : "none";
  const pSort = $("powerSort");
  if (pSort) {
    pSort.style.display = (S.tab === "power" && !S.round) ? "" : "none";
    pSort.value = S.powerSort || "pts";
  }
  const show = ROUND_TABS.has(S.tab);
  sel.style.display = show ? "" : "none";
  if (!show) return;
  const evs = S.data.events;
  sel.innerHTML = `<option value="">Season total (${evs.length} events)</option>` +
    evs.map((r) => `<option value="${r.key}" ${String(r.key) === S.round ? "selected" : ""}>${r.sprint ? `⚡R${r.round}S` : `R${r.round}`} — ${esc(r.name)}</option>`).join("");
}

function table(head, rows) {
  return `<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${head.length}">No results</td></tr>`}</tbody></table>`;
}

// Race top 3: gold-silver-bronze (by finish)
function medalClass(finish) {
  return finish === 1 ? "m1" : finish === 2 ? "m2" : finish === 3 ? "m3" : "";
}

// Driver season-average grid / finish (for PGC totals)
function avgQF(d, id) {
  let gS = 0, gN = 0, fS = 0, fN = 0;
  for (const ev of d.events) {
    const row = ev.drivers.find((y) => y.id === id);
    if (!row) continue;
    const raw = String(row.gridRaw);
    if (/^\d+$/.test(raw) && Number(raw) > 0) { gS += Number(raw); gN++; }
    if (row.classified) { fS += row.finish; fN++; }
  }
  const a = (s, n) => n ? (Math.round(s / n * 10) / 10) : "–";
  return [a(gS, gN), a(fS, fN)];
}

// Driver photo: 2026 F1 cutout for drivers in the 2026 lineup,
// else universal F1 headshot (~2014+), else Wikipedia portrait.
// Team visuals: F1 CDN when the team is mapped (2026 logos/cars reused every year, 2024-25 cars year-aware),
// else Wikipedia (every year)
const photoFor = (x, cls) => {
  const d26 = driverPhoto(x.code) || driverPhoto(x.id);
  const f1 = d26 || f1Headshot(x.given, x.family, x.id);
  return f1 ? imgTag(f1, x.name, cls) : wikiImg(x.wiki, cls, x.name);
};
const teamImgFor = (d, id, name, cls, kind) => {
  if (hasTeam(id)) {
    if (kind === "car") {
      const yc = teamCarPhotoYear(d.season, id);
      if (yc) return imgTag(yc, name, cls);
      return imgTag(teamCarPhoto(id), name, cls);
    }
    return imgTag(teamLogo(id), name, cls);
  }
  const art = d.teamWiki && d.teamWiki[id];
  return kind === "car" ? wikiImg(art, cls, name) : wikiLogoImg(art, cls, name);
};

// Result rows: mapped team logo, else 2026 photo, else F1 headshot, else Wikipedia portrait, else code (+ name)
function drvResult(x) {
  if (hasTeam(x.teamId)) {
    const logo = imgTag(teamLogo(x.teamId), x.name, "logo sm");
    if (logo) return `<span class="who">${logo}<span>${esc(x.name)}</span></span>`;
  } else {
    const ph = photoFor(x, "dphoto sm");
    if (ph) return `<span class="who">${ph}<span>${esc(x.name)}</span></span>`;
  }
  return `<b>${esc(x.code)}</b> ${esc(x.name)}`;
}
function deltaCell(x) {
  if (x.diff === null || x.diff === undefined) return `<span class="newtag">NEW</span>`;
  if (x.diff > 0) return `<span class="up">▲${x.diff}</span>`;
  if (x.diff < 0) return `<span class="down">▼${-x.diff}</span>`;
  return `<span class="mut">–</span>`;
}

function splitView(last, leftTable, rightTable) {
  return `<div class="split"><div class="card lastrace"><div class="ct">Last race — R${last.key} ${esc(last.name)}</div>${leftTable}</div><div class="fullwrap">${rightTable}</div></div>`;
}

// --- Championship battles (drivers, season still running) ---
const REACH_HINT = "Hover or tap a position number to see who can still finish there.";
const signed = (v) => (v > 0 ? "+" : v < 0 ? "−" : "±") + fmtPts(Math.abs(v));

// Cards for P1–P3: who can still finish there, and by how much they trail/lead the current holder
function battlesHtml(all, reach, ptsLeft) {
  const cards = [1, 2, 3].filter((n) => all[n - 1]).map((n) => {
    const holder = all[n - 1];
    const contenders = all.filter((x) => reach.get(x.id).best <= n && reach.get(x.id).worst >= n);
    const label = n === 1 ? "Title" : `Battle for P${n}`;
    if (contenders.length <= 1) {
      return `<div class="battle decided"><div class="bhead"><span>${label}</span><span class="tag champ">Decided</span></div>
        <div class="bname">${esc(holder.name)}${n === 1 ? " is champion" : ` locked in P${n}`}</div>
        <div class="bmeta">Only ${ptsLeft} pts left to win.</div></div>`;
    }
    const rivals = contenders.filter((x) => x !== holder).map((x) => `${esc(x.name.split(" ").pop())} <span class="num">${signed(x.value - holder.value)}</span>`);
    return `<div class="battle"><div class="bhead"><span>${label}</span><span class="tag fight">Open · ${contenders.length} drivers</span></div>
      <div class="bname">${esc(holder.name)} holds it</div>
      <div class="bmeta">${rivals.join(", ")} · ${ptsLeft} pts left</div></div>`;
  });
  return `<section class="battles" aria-label="Championship battles">${cards.join("")}</section>`;
}

// Hover/focus/tap a rank: highlight drivers whose reachable range includes it
function initReach() {
  const note = $("reachNote");
  const tbl = note && note.parentElement.querySelector("table");
  if (!tbl) return;
  let pinned = null;
  const show = (n) => {
    const hits = [];
    tbl.classList.toggle("reachmode", n !== null);
    for (const tr of tbl.querySelectorAll("tr[data-reach]")) {
      const [b, w] = tr.dataset.reach.split("-").map(Number);
      const hit = n !== null && n >= b && n <= w;
      tr.classList.toggle("reach", hit);
      if (hit) hits.push(tr.dataset.code);
    }
    for (const btn of tbl.querySelectorAll(".rankbtn")) btn.classList.toggle("on", Number(btn.dataset.rank) === n);
    note.innerHTML = n === null ? REACH_HINT : `<b>Can still finish P${n}:</b> ${hits.map(esc).join(", ") || "—"}`;
  };
  for (const btn of tbl.querySelectorAll(".rankbtn")) {
    const n = Number(btn.dataset.rank);
    btn.onmouseenter = btn.onfocus = () => show(n);
    btn.onmouseleave = btn.onblur = () => show(pinned);
    btn.onclick = () => { pinned = pinned === n ? null : n; show(pinned); };
  }
}

// Last event team points (left panel)
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
  $("updated").textContent = `Source: ${d.source} • ${d.completed} rounds`;
  const R = S.round ? api.getRound(d, S.round) : null;
  let html = "", stat = "";

  if (S.tab === "tracks") {
    const cards = d.schedule.filter((s) => matchQ(s.name, s.circuit)).map((s) => {
      const rd = d.rounds.find((r) => r.round === s.round);
      const sp = d.sprints.find((r) => r.round === s.round);
      const scenic = trackCardPhoto(s.circuitId);
      const img = scenic ? imgTag(scenic, s.name, "trackimg") : wikiGpImg(S.season, s.name, s.wiki, "trackimg", s.name);
      const winLogo = (w) => hasTeam(w.teamId) ? imgTag(teamLogo(w.teamId), w.name, "logo sm") : "";
      const win = rd && rd.winner
        ? `<div class="twin">🏆 ${winLogo(rd.winner) || `<b>${esc(rd.winner.code)}</b>`} <span>${esc(rd.winner.name)}</span></div>`
        : `<div class="twin mut">⏳ ${esc(s.date)}</div>`;
      const swin = sp && sp.winner
        ? `<div class="twin">⚡ ${winLogo(sp.winner) || `<b>${esc(sp.winner.code)}</b>`} <span>${esc(sp.winner.name)}</span></div>`
        : "";
      return `<div class="tcard" data-round="${s.round}">
        <div class="timg">${img}<span class="tround">R${s.round}</span>${sp ? `<span class="tsprint">SPR</span>` : ""}</div>
        <div class="tbody"><div class="tname">${esc(s.name)}</div>
        <div class="tmeta">${esc(s.circuit)}</div>${win}${swin}</div>
      </div>`;
    });
    html = `<div class="trackgrid">${cards.join("") || "No results"}</div>`;
    stat = `${d.schedule.length} tracks • click a card for Grid/Race detail`;
  } else if (S.tab === "drivers" || S.tab === "teams") {
    const isD = S.tab === "drivers";
    const opts = { who: isD ? "drivers" : "teams", metric: "real" };
    if (d.events.length >= 2) {
      const all = api.tableWithChanges(d, opts);
      const rows = all.filter((x) => matchQ(x.name, x.code || ""));
      const last = d.events[d.events.length - 1];
      // Drivers: who can still finish where (only while the season is running)
      const ptsLeft = isD ? api.pointsLeft(d) : 0;
      const reach = api.finishRange(all, ptsLeft);
      const gap = new Map(all.map((x, i) => [x.id, !i ? "—" : all[i - 1].value === x.value ? "0" : "−" + fmtPts(all[i - 1].value - x.value)]));
      const p2 = all.filter((x) => reach.get(x.id).best <= 2 && reach.get(x.id).worst >= 2);
      const tagFor = (x) => reach.get(x.id).worst === 1 ? `<span class="tag champ">Champion</span>`
        : ptsLeft > 0 && p2.length > 1 && p2.includes(x) ? `<span class="tag fight">P2 fight</span>` : "";
      const rankCell = (x) => ptsLeft > 0
        ? `<td class="pos"><button type="button" class="rankbtn" data-rank="${x.rank}" aria-label="Who can still finish P${x.rank}">${x.rank}</button></td>`
        : `<td class="pos">${x.rank}</td>`;
      let left;
      if (isD) {
        const top = [...last.drivers].filter((x) => x.classified).sort((a, b) => a.finish - b.finish).slice(0, 10);
        left = table(["Finish", "Driver", "Pts"], top.map((x) =>
          `<tr><td class="pos ${medalClass(x.finish)}">P${x.finish}</td><td>${drvResult(x)}</td><td class="pts">${fmtPts(x.realPoints)}</td></tr>`));
      } else {
        left = table(["Team", "Pts"], lastRoundTeams(last).map((t, i) =>
          `<tr><td class="${medalClass(i + 1)}"><span class="who">${teamImgFor(d, t.id, t.name, "logo", "logo")}${esc(t.name)}</span></td><td class="pts">${fmtPts(t.v)}</td></tr>`));
      }
      const right = (ptsLeft > 0 ? `<div id="reachNote" class="reachnote" aria-live="polite">${REACH_HINT}</div>` : "") +
        table(isD ? ["#", "Δ", "Driver", "Team", "W"].concat(rows.some((x) => x.swins) ? ["SW"] : []).concat(["Gap", "Pts"]) : ["#", "Δ", "Team", "W", "Pts"],
        rows.map((x) => {
          const bar = `<span class="tbar" style="background:${teamColor(isD ? x.teamId : x.id)}"></span>`;
          if (isD) {
            const ph = photoFor(x, "dphoto");
            const r = reach.get(x.id);
            return `<tr data-reach="${r.best}-${r.worst}" data-code="${esc(x.code)}">${rankCell(x)}<td>${deltaCell(x)}</td><td><span class="who">${ph}<span>${bar}<b>${esc(x.code)}</b> ${esc(x.name)} ${tagFor(x)}</span></span></td><td>${esc(x.team)}</td><td>${x.wins}</td>${x.swins ? `<td>${x.swins}</td>` : (rows.some((y) => y.swins) ? "<td></td>" : "")}<td class="mut num">${gap.get(x.id)}</td><td class="pts">${fmtPts(x.value)}</td></tr>`;
          }
          const logo = teamImgFor(d, x.id, x.name, "logo", "logo");
          const car = hasTeam(x.id) ? imgTag(teamCarPhoto(x.id), x.name, "carphoto") : "";
          return `<tr><td class="pos">${x.rank}</td><td>${deltaCell(x)}</td><td><span class="who">${logo}${car}<span>${bar}${esc(x.name)}</span></span></td><td>${x.wins}</td><td class="pts">${fmtPts(x.value)}</td></tr>`;
        }));
      html = (ptsLeft > 0 ? battlesHtml(all, reach, ptsLeft) : "") + splitView(last, left, right);
      stat = `${rows.length} ${isD ? "drivers" : "teams"} • arrows vs previous event`;
    } else {
      const rows = api.computeTable(d, opts).filter((x) => matchQ(x.name, x.code || ""));
      const hasSw2 = rows.some((x) => x.swins);
      html = table(isD ? ["#", "Driver", "Team", "Wins"].concat(hasSw2 ? ["SW"] : []).concat(["Pts"]) : ["#", "Team", "Wins", "Pts"],
        rows.map((x, i) => {
          const bar = `<span class="tbar" style="background:${teamColor(isD ? x.teamId : x.id)}"></span>`;
          if (isD) {
            const ph = photoFor(x, "dphoto");
            return `<tr><td class="pos">${i + 1}</td><td><span class="who">${ph}<span>${bar}<b>${esc(x.code)}</b> ${esc(x.name)}</span></span></td><td>${esc(x.team)}</td><td>${x.wins}</td>${hasSw2 ? `<td>${x.swins || ""}</td>` : ""}<td class="pts">${fmtPts(x.value)}</td></tr>`;
          }
          const logo = teamImgFor(d, x.id, x.name, "logo", "logo");
          return `<tr><td class="pos">${i + 1}</td><td><span class="who">${logo}<span>${bar}${esc(x.name)}</span></span></td><td>${x.wins}</td><td class="pts">${fmtPts(x.value)}</td></tr>`;
        }));
      stat = `${rows.length} ${isD ? "drivers" : "teams"}`;
    }
  } else if (S.tab === "qr") {
    if (!R) {
      // Big matrix like Excel: drivers as rows, Grid/Race columns per event
      // (sprint columns come before the GP on sprint weekends)
      const drvs = api.getDriverStandings(d).filter((x) => matchQ(x.name, x.code, x.team));
      const sprintByRound = new Map(d.sprints.map((s) => [s.round, s]));
      const cols = [];
      for (const rd of d.rounds) {
        const sp = sprintByRound.get(rd.round);
        if (sp) cols.push({ ev: sp, q: `R${rd.round}S-Q`, r: `R${rd.round}S-R` });
        cols.push({ ev: rd, q: `R${rd.round} Q`, r: `R${rd.round} R` });
      }
      const shortStatus = (s) => s === "Did not start" ? "DNS" : s === "Disqualified" ? "DSQ" : "DNF";
      const body = drvs.map((x) => {
        const cells = [`<td class="drv"><b>${esc(x.code)}</b> ${esc(x.name)}</td>`];
        let gS = 0, gN = 0, fS = 0, fN = 0;
        for (const c of cols) {
          const row = c.ev.drivers.find((y) => y.id === x.id);
          if (!row) { cells.push("<td>–</td>", "<td>–</td>"); continue; }
          const raw = String(row.gridRaw);
          const gd = /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
          cells.push(`<td>${gd === null ? "PL" : gd}</td>`);
          if (row.classified) cells.push(`<td class="pts">P${row.finish}</td>`);
          else cells.push(`<td class="mut">${shortStatus(row.status)}</td>`);
          if (gd !== null) { gS += gd; gN++; }
          if (row.classified) { fS += row.finish; fN++; }
        }
        const avg = (s, n) => n ? (Math.round(s / n * 10) / 10) : "–";
        cells.push(`<td class="pts avg">${avg(gS, gN)}</td>`, `<td class="pts avg">${avg(fS, fN)}</td>`);
        return `<tr>${cells.join("")}</tr>`;
      });
      const head = ["Driver", ...cols.flatMap((c) => [c.q, c.r]), "AVG Q", "AVG R"];
      html = `<div class="tablewrap"><table class="matrix"><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body.join("")}</tbody></table></div>`;
      stat = `${cols.length} events × ${drvs.length} drivers • AVG-Q: all events, AVG-R: classified only`;
    } else {
      const list = R.drivers.filter((x) => matchQ(x.name, x.code, x.team));
      html = table(["Grid", "Driver", "Finish", "Gain", "Status"],
        [...list].sort((a, b) => (a.grid - b.grid)).map((x) =>
          `<tr><td class="pos">${x.grid}</td><td>${drvResult(x)}</td><td class="${medalClass(x.finish)}">${x.finish === null || x.finish === undefined ? "–" : "P" + x.finish}</td><td class="pts">${x.gain === null ? "–" : (x.gain > 0 ? "+" : "") + x.gain}</td><td class="mut">${esc(x.status)}</td></tr>`));
      stat = R.name + ` • ${list.length} drivers`;
    }
  } else if (S.tab === "pg") {
    // Single tab, championship picker on top: pg / pgnn / pgc / pgns
    const mode = S.pgmode || "pg";
    const isPts = mode === "pgc" || mode === "pgns";
    const split = mode === "pgc";
    const metric = isPts ? "pgc" : mode;
    const label = (PG_MODES.find(([k]) => k === mode) || [])[1] || mode.toUpperCase();
    const short = isPts ? "Pts" : mode === "pgnn" ? "PGNN" : "PG";
    const lastEv = d.events[d.events.length - 1];
    if (R) {
      const map = isPts ? (split ? R.pgcSplit : R.pgns) : null;
      const list = R.byGain.filter((x) => (!map || map.has(x.id)) && matchQ(x.name, x.code));
      html = table(isPts ? ["#", "Driver", "Grid → Finish", "Gain", "Pts"] : ["#", "Driver", "Grid → Finish", short],
        list.map((x, i) => {
          const v = isPts ? map.get(x.id) : mode === "pgnn" ? Math.max(0, x.gain) : x.gain;
          const vCell = isPts ? fmtPts(v) : (v > 0 ? "+" : "") + v;
          const mid = isPts ? `<td>${x.grid} → ${x.finish}</td><td>+${x.gain}</td>` : `<td>${x.grid} → ${x.finish}</td>`;
          return `<tr><td class="pos">${i + 1}</td><td>${drvResult(x)}</td>${mid}<td class="pts">${vCell}</td></tr>`;
        }));
      stat = `${R.name} • ${label}`;
    } else if (d.events.length >= 2) {
      const rows = api.tableWithChanges(d, { who: "drivers", metric, split }).filter((x) => matchQ(x.name, x.code));
      const map = isPts ? (split ? lastEv.pgcSplit : lastEv.pgns) : null;
      // PG/PGNN left panel: full grid (unclassified at bottom); PGC/PGNS: scorers only
      const fullGrid = [...lastEv.drivers].sort((a, b) => (b.gain ?? -999) - (a.gain ?? -999));
      const leftList = isPts
        ? lastEv.byGain.filter((x) => map.has(x.id))
        : fullGrid;
      const left = table(isPts ? ["#", "Driver", "Grid → Finish", "Pts"] : ["#", "Driver", "Grid → Finish", short], leftList.map((x, i) => {
        const gf = `${x.grid} → ${x.finish ?? (x.status === "Did not start" ? "DNS" : "DNF")}`;
        let vCell;
        if (isPts) vCell = fmtPts(map.get(x.id));
        else if (x.gain === null || x.gain === undefined) vCell = `<span class="mut">–</span>`;
        else { const v = mode === "pgnn" ? Math.max(0, x.gain) : x.gain; vCell = (v > 0 ? "+" : "") + v; }
        return `<tr><td class="pos">${i + 1}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>${gf}</td><td class="pts">${vCell}</td></tr>`;
      }));
      const right = isPts
        ? table(["#", "Δ", "Driver", "Team", "AVG Q", "AVG R", short],
          rows.map((x) => {
            const [oq, of] = avgQF(d, x.id);
            return `<tr><td class="pos">${x.rank}</td><td>${deltaCell(x)}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>${esc(x.team)}</td><td>${oq}</td><td>${of}</td><td class="pts">${fmtPts(x.value)}</td></tr>`;
          }))
        : table(["#", "Δ", "Driver", "Team", short],
          rows.map((x) => {
            const vCell = (x.value > 0 ? "+" : "") + x.value;
            return `<tr><td class="pos">${x.rank}</td><td>${deltaCell(x)}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>${esc(x.team)}</td><td class="pts">${vCell}</td></tr>`;
          }));
      html = splitView(lastEv, left, right);
      stat = `${rows.length} drivers • ${label} • arrows vs previous event`;
    } else {
      const rows = api.computeTable(d, { who: "drivers", metric, split }).filter((x) => matchQ(x.name, x.code));
      html = table(["#", "Driver", "Team", short],
        rows.map((x, i) => {
          const vCell = isPts ? fmtPts(x.value) : (x.value > 0 ? "+" : "") + x.value;
          return `<tr><td class="pos">${i + 1}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>${esc(x.team)}</td><td class="pts">${vCell}</td></tr>`;
        }));
      stat = `${rows.length} drivers • season total`;
    }
  } else if (S.tab === "ters") {
    if (R) {
      const cls = [...R.drivers].filter((x) => x.classified).sort((a, b) => b.finish - a.finish);
      const list = cls.filter((x) => R.ters.has(x.id) && matchQ(x.name, x.code));
      html = table(["Rev #", "Driver", "Finish", "Pts"],
        list.map((x, i) => `<tr><td class="pos">${i + 1}</td><td>${drvResult(x)}</td><td>P${x.finish}</td><td class="pts">${fmtPts(R.ters.get(x.id))}</td></tr>`));
      stat = `${R.name} • back-to-front`;
    } else if (d.events.length >= 2) {
      const rows = api.tableWithChanges(d, { who: "drivers", metric: "ters" }).filter((x) => matchQ(x.name, x.code));
      const last = d.events[d.events.length - 1];
      const cls = [...last.drivers].filter((x) => x.classified).sort((a, b) => b.finish - a.finish);
      const left = table(["Rev #", "Driver", "Pts"], cls.filter((x) => last.ters.has(x.id)).map((x, i) =>
        `<tr><td class="pos">${i + 1}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td class="pts">${fmtPts(last.ters.get(x.id))}</td></tr>`));
      const right = table(["#", "Δ", "Driver", "Team", "Pts"],
        rows.map((x) => `<tr><td class="pos">${x.rank}</td><td>${deltaCell(x)}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>${esc(x.team)}</td><td class="pts">${fmtPts(x.value)}</td></tr>`));
      html = splitView(last, left, right);
      stat = `${rows.length} drivers • arrows vs previous round`;
    } else {
      const rows = api.computeTable(d, { who: "drivers", metric: "ters" }).filter((x) => matchQ(x.name, x.code));
      html = table(["#", "Driver", "Team", "Pts"],
        rows.map((x, i) => `<tr><td class="pos">${i + 1}</td><td><b>${esc(x.code)}</b> ${esc(x.name)}</td><td>${esc(x.team)}</td><td class="pts">${fmtPts(x.value)}</td></tr>`));
      stat = `${rows.length} drivers • season total`;
    }
  } else if (S.tab === "power") {
    const editor = powerEditorHtml(d, R);
    if (R) {
      const list = (R.powerList || []).filter((x) => matchQ(x.name, x.code, x.team));
      if (list.length) {
        html = editor + table(["Rank", "Driver", "Team", "Score", "Pts"],
          list.map((x) => {
            const bar = `<span class="tbar" style="background:${teamColor(x.teamId)}"></span>`;
            const ph = photoFor(x, "dphoto");
            return `<tr><td class="pos ${medalClass(x.rank)}">P${x.rank}</td><td><span class="who">${ph}<span>${bar}<b>${esc(x.code)}</b> ${esc(x.name)}</span></span></td><td>${esc(x.team)}</td><td>${x.score !== null ? x.score : "-"}</td><td class="pts">${fmtPts(x.pts)}</td></tr>`;
          }));
        stat = `${R.name} • Power Rankings (${list.length} drivers)`;
      } else {
        html = editor + `<div class="card"><div class="cb">No Power Rankings for ${esc(R.name)}</div><div class="cm">Enter drivers and scores in the editor above, then save.</div></div>`;
        stat = `${R.name} • No Power Rankings data yet`;
      }
    } else {
      const sort = S.powerSort || "pts";
      const rows = api.tableWithChanges(d, { who: "drivers", metric: "power", powerSort: sort }).filter((x) => matchQ(x.name, x.code, x.team));
      const hasAny = rows.some((x) => x.value > 0 || (x.scoreCount || 0) > 0);

      const sortBar = `
        <div class="powerSortBar">
          <span class="powerSortLabel">Sort by:</span>
          <button class="powerSortBtn ${sort === "pts" ? "active" : ""}" data-sort="pts">Total points (25-1)</button>
          <button class="powerSortBtn ${sort === "avg" ? "active" : ""}" data-sort="avg">Average score</button>
          <button class="powerSortBtn ${sort === "score" ? "active" : ""}" data-sort="score">Total score</button>
        </div>
      `;

      const thSort = (col, label) => {
        const isActive = sort === col;
        return `<span class="${isActive ? "sortActive" : "sortable"}" data-sort="${col}">${label}${isActive ? ` <span class="sortArrow">▼</span>` : ""}</span>`;
      };

      const tableHtml = table([
        "#",
        "Δ",
        "Driver",
        "Team",
        thSort("avg", "Avg"),
        thSort("score", "Score sum"),
        "Wins",
        thSort("pts", "Pts"),
      ], rows.map((x) => {
        const bar = `<span class="tbar" style="background:${teamColor(x.teamId)}"></span>`;
        const ph = photoFor(x, "dphoto");
        const avgStr = x.avgScore !== null && x.avgScore !== undefined ? x.avgScore.toFixed(2) : "-";
        const scoreStr = x.scoreCount > 0 ? (Number.isInteger(x.scoreSum) ? String(x.scoreSum) : x.scoreSum.toFixed(1)) : "-";
        return `<tr><td class="pos">${x.rank}</td><td>${deltaCell(x)}</td><td><span class="who">${ph}<span>${bar}<b>${esc(x.code)}</b> ${esc(x.name)}</span></span></td><td>${esc(x.team)}</td><td ${sort === "avg" ? 'class="colActive"' : ""}><b>${avgStr}</b></td><td ${sort === "score" ? 'class="colActive"' : ""}><b>${scoreStr}</b></td><td>${x.wins}</td><td class="pts ${sort === "pts" ? "colActive" : ""}">${fmtPts(x.value)}</td></tr>`;
      }));

      const right = sortBar + tableHtml;

      const lastWithPower = [...d.rounds].reverse().find((r) => r.powerList && r.powerList.length);
      if (lastWithPower) {
        const list = lastWithPower.powerList.filter((x) => matchQ(x.name, x.code, x.team));
        const left = table(["Rank", "Driver", "Score", "Pts"],
          list.map((x) => {
            const ph = photoFor(x, "dphoto sm");
            return `<tr><td class="pos ${medalClass(x.rank)}">P${x.rank}</td><td><span class="who">${ph}<span><b>${esc(x.code)}</b> ${esc(x.name)}</span></span></td><td>${x.score !== null ? x.score : "-"}</td><td class="pts">${fmtPts(x.pts)}</td></tr>`;
          }));
        html = editor + splitView(lastWithPower, left, right);
        stat = `${lastWithPower.name} Power Rankings (left) • ${S.season} Championship (right)`;
      } else {
        html = editor + (hasAny ? right : `<div class="card"><div class="cb">No Power Rankings entered yet for ${esc(S.season)}</div><div class="cm">Enter drivers and scores in the editor above, then save.</div></div>`);
        stat = `${S.season} Aramco Power Rankings Championship`;
      }
    }
  } else if (S.tab === "history") {
    const c = api.getChampions(d);
    const dph = c.driver ? photoFor(c.driver, "cardphoto") : "";
    const dcol = c.driver ? teamColor(c.driver.teamId) : "#e10600";
    const tcol = c.team ? teamColor(c.team.id) : "#e10600";
    const tlogo = c.team ? teamImgFor(d, c.team.id, c.team.name, "cardlogo", "logo") : "";
    html = `<div class="cards">
      <div class="card" style="border-top-color:${dcol}"><div class="ct">Drivers' Champion</div><div class="cb">${dph}<span><b>${c.driver ? esc(c.driver.code) : "—"}</b> ${c.driver ? esc(c.driver.name) : ""}</span></div><div class="cm">${c.driver ? fmtPts(c.driver.value) + " pts • " + c.driver.wins + " wins" : ""}</div></div>
      <div class="card" style="border-top-color:${tcol}"><div class="ct">Constructors' Champion</div><div class="cb">${tlogo}<b>${c.team ? esc(c.team.name) : "—"}</b></div><div class="cm">${c.team ? fmtPts(c.team.value) + " pts • " + c.team.wins + " wins" : ""}</div></div>
      <div class="card"><div class="ct">Season</div><div class="cb"><b>${esc(S.season)}</b></div><div class="cm">${c.rounds} rounds • ${c.differentWinners} different winners</div></div>
    </div>
    <h3 class="sech">Winners — who won where</h3>` + table(["Driver", "Team", "Wins", "Races won"],
      c.winners.filter((w) => matchQ(w.name, w.code, w.team)).map((w) =>
        `<tr><td><b>${esc(w.code)}</b> ${esc(w.name)}</td><td>${esc(w.team)}</td><td class="pts">${w.wins}</td><td>${w.races.map((r) => `<span class="racechip">R${r.round} ${esc(r.name.replace(" Grand Prix", ""))}</span>`).join("")}</td></tr>`));
    stat = `${S.season} season overview`;
  }
  $("content").innerHTML = html;
  $("statLine").textContent = stat;
  if (S.tab === "drivers") initReach();
  if (S.tab === "power") {
    initPowerEditor(d);
    document.querySelectorAll(".powerSortBtn, [data-sort]").forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        const s = el.dataset.sort;
        if (s && s !== S.powerSort) {
          S.powerSort = s;
          const pSel = $("powerSort");
          if (pSel) pSel.value = s;
          render();
        }
      };
    });
  }
  hydrateWiki($("content"));
  const tg = document.querySelector("#content .trackgrid");
  if (tg) tg.onclick = (e) => {
    const c = e.target.closest(".tcard");
    if (!c) return;
    const r = api.getRound(S.data, c.dataset.round);
    if (!r) return; // no detail for unrun races yet
    S.round = c.dataset.round;
    S.tab = "qr";
    [...$("tabs").children].forEach((x) => x.classList.toggle("active", x.dataset.t === "qr"));
    render();
  };
}

// --- Aramco Power Rankings Editor ---
function powerEditorHtml(d, R) {
  const rounds = d.rounds || [];
  const defaultRound = PR_SELECTED_ROUND || (R ? Number(R.round) : (rounds.length ? rounds[rounds.length - 1].round : 1));
  PR_SELECTED_ROUND = defaultRound;
  const allPR = getPowerRankings(S.season);
  const currentItems = allPR[defaultRound] || [];
  const textVal = formatPowerItems(currentItems);

  const roundOpts = rounds.map((r) =>
    `<option value="${r.round}" ${r.round === defaultRound ? "selected" : ""}>R${r.round} - ${esc(r.name)}</option>`
  ).join("");

  return `
  <div class="powerEditor">
    <div class="powerHeader">
      <div class="powerTitle">Aramco Power Rankings editor</div>
      <div>
        <button id="prToggleEditor" class="powerBtnSec">${PR_EDITOR_OPEN ? "Hide editor" : "Enter / edit scores"}</button>
      </div>
    </div>
    <div id="prEditorBody" style="${PR_EDITOR_OPEN ? "" : "display:none;"}">
      <div class="powerRow">
        <label>Round:
          <select id="prRoundSelect">${roundOpts}</select>
        </label>
        <span id="prStatusMsg" class="powerMsg"></span>
      </div>
      <div class="powerHint">
        One driver and score per line (e.g. <code>norris 9,8</code> or <code>NOR 9.8</code>). Drivers are ranked by score and get points from 25 down to 1 in equal steps.
      </div>
      <textarea id="prInput" class="powerTextarea" placeholder="Example:
norris 9,8
verstappen 9,6
lawson 9,2
hadjar 8,8
hulkenberg 8,6
antonelli 8,4
russell 8,2
bearman 8,0
alonso 7,8
piastri 7,6">${esc(textVal)}</textarea>
      <div class="powerActions">
        <button id="prSaveBtn" class="powerBtnPrimary">Save &amp; update rankings</button>
        <button id="prClearBtn" class="powerBtnSec">Clear this round</button>
        <button id="prExportBtn" class="powerBtnSec">Copy JSON</button>
        <button id="prResetAllBtn" class="powerBtnDanger">Reset all</button>
      </div>
    </div>
  </div>`;
}

function initPowerEditor(d) {
  const roundSel = $("prRoundSelect");
  const input = $("prInput");
  const saveBtn = $("prSaveBtn");
  const clearBtn = $("prClearBtn");
  const resetBtn = $("prResetAllBtn");
  const toggleBtn = $("prToggleEditor");
  const body = $("prEditorBody");
  const msg = $("prStatusMsg");

  if (toggleBtn && body) {
    toggleBtn.onclick = () => {
      PR_EDITOR_OPEN = !PR_EDITOR_OPEN;
      body.style.display = PR_EDITOR_OPEN ? "" : "none";
      toggleBtn.textContent = PR_EDITOR_OPEN ? "Hide editor" : "Enter / edit scores";
    };
  }

  if (roundSel && input) {
    roundSel.onchange = () => {
      PR_SELECTED_ROUND = Number(roundSel.value);
      const allPR = getPowerRankings(S.season);
      input.value = formatPowerItems(allPR[PR_SELECTED_ROUND] || []);
      if (msg) msg.textContent = "";
    };
  }

  if (saveBtn && input && roundSel) {
    saveBtn.onclick = () => {
      const rd = Number(roundSel.value);
      const items = parsePowerInput(input.value, d.drivers || []);
      if (!items.length) {
        if (msg) { msg.className = "powerMsg err"; msg.textContent = "No valid lines entered."; }
        return;
      }
      saveRoundPowerRankings(S.season, rd, items);
      api.applyPowerRankings(d, S.season);
      render();
      const newMsg = $("prStatusMsg");
      if (newMsg) {
        newMsg.className = "powerMsg ok";
        newMsg.textContent = `Saved ${items.length} drivers for R${rd}. Rankings updated.`;
      }
    };
  }

  if (clearBtn && roundSel) {
    clearBtn.onclick = () => {
      const rd = Number(roundSel.value);
      clearRoundPowerRankings(S.season, rd);
      api.applyPowerRankings(d, S.season);
      render();
      const newMsg = $("prStatusMsg");
      if (newMsg) {
        newMsg.className = "powerMsg ok";
        newMsg.textContent = `R${rd} cleared.`;
      }
    };
  }

  const exportBtn = $("prExportBtn");
  if (exportBtn) {
    exportBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(exportPowerRankings(S.season));
        if (msg) { msg.className = "powerMsg ok"; msg.textContent = "Copied to clipboard"; }
      } catch {
        if (msg) { msg.className = "powerMsg err"; msg.textContent = "Could not copy"; }
      }
    };
  }

  if (resetBtn) {
    resetBtn.onclick = () => {
      if (confirm(`Reset all saved Power Rankings for ${S.season}?`)) {
        resetAllPowerRankings(S.season);
        api.applyPowerRankings(d, S.season);
        render();
      }
    };
  }
}

boot();

// Show unexpected JS errors on screen (prevents silent "loading" hangs)
window.addEventListener("error", (e) => {
  const el = document.getElementById("statLine");
  if (el && /loading/.test(el.textContent)) el.textContent = "Error: " + (e.message || "unknown");
});
