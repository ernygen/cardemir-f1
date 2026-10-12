import { DEFAULT_SEASON, MIN_SEASON, MAX_SEASON, BINGO_EVENTS } from "./config.js";
import * as api from "./providers/f1ApiProvider.js";
import { driverPhoto, teamCarPhoto, teamLogo, trackCardPhoto, teamColor, hasTeam, imgTag, wikiImg, wikiLogoImg, wikiGpImg, hydrateWiki } from "./assets.js";

const $ = (id) => document.getElementById(id);
const TABS = [
  ["tracks", "Tracks"], ["drivers", "Drivers' Championship"], ["teams", "Constructors' Championship"],
  ["qr", "Grid / Race"], ["pg", "Position Gain"], ["ters", "Reverse Championship"],
  ["history", "History"], ["bingo", "Bingo"],
];
const PG_MODES = [
  ["pg", "Position Gain (with negatives)"],
  ["pgnn", "Position Gain No Negative"],
  ["pgc", "PGC (split)"],
  ["pgns", "PGNS (no split)"],
];
const ROUND_TABS = new Set(["qr", "pg", "ters"]);
const cache = new Map();
let S = { season: DEFAULT_SEASON, tab: "drivers", round: "", pgmode: "pg", q: "", data: null, loading: false };

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
  $("search").oninput = () => { S.q = $("search").value.toLocaleLowerCase("en"); render(); };
  $("roundFilter").onchange = () => { S.round = $("roundFilter").value; render(); };
  $("pgMode").innerHTML = PG_MODES.map(([k, l]) => `<option value="${k}">${l}</option>`).join("");
  $("pgMode").onchange = () => { S.pgmode = $("pgMode").value; render(); };
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
    $("content").innerHTML = `<div class="card"><div class="cb">Couldn't load</div><div class="cm">Check your connection/API, then retry.</div><div class="bingoBar"><button id="retry">Retry</button></div></div>`;
    const b = $("retry");
    if (b) b.onclick = () => { cache.delete(S.season); refresh(); };
  } finally { S.loading = false; }
}

function fillRounds() {
  const sel = $("roundFilter");
  const pgm = $("pgMode");
  pgm.style.display = S.tab === "pg" ? "" : "none";
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

// Driver photo: 2026 F1 cutout when mapped, else Wikipedia portrait (every year)
const photoFor = (x, cls) => {
  const f1 = driverPhoto(x.code);
  return f1 ? imgTag(f1, x.name, cls) : wikiImg(x.wiki, cls, x.name);
};
// Team visuals: 2026 F1 CDN when the team is mapped, else Wikipedia (every year)
const teamImgFor = (d, id, name, cls, kind) => {
  if (hasTeam(id)) return imgTag(kind === "car" ? teamCarPhoto(id) : teamLogo(id), name, cls);
  const art = d.teamWiki && d.teamWiki[id];
  return kind === "car" ? wikiImg(art, cls, name) : wikiLogoImg(art, cls, name);
};

// Result rows: mapped team logo, else driver portrait, else 3-letter code (+ name)
function drvResult(x) {
  if (hasTeam(x.teamId)) {
    const logo = imgTag(teamLogo(x.teamId), x.name, "logo sm");
    if (logo) return `<span class="who">${logo}<span>${esc(x.name)}</span></span>`;
  } else {
    const ph = wikiImg(x.wiki, "dphoto sm", x.name);
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
        <div class="timg">${img}<span class="tround">R${s.round}</span>${sp ? `<span class="tsprint">SPRINT</span>` : ""}</div>
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
      const rows = api.tableWithChanges(d, opts).filter((x) => matchQ(x.name, x.code || ""));
      const last = d.events[d.events.length - 1];
      let left;
      if (isD) {
        const top = [...last.drivers].filter((x) => x.classified).sort((a, b) => a.finish - b.finish).slice(0, 10);
        left = table(["Finish", "Driver", "Pts"], top.map((x) =>
          `<tr><td class="pos ${medalClass(x.finish)}">P${x.finish}</td><td>${drvResult(x)}</td><td class="pts">${fmtPts(x.realPoints)}</td></tr>`));
      } else {
        left = table(["Team", "Pts"], lastRoundTeams(last).map((t, i) =>
          `<tr><td class="${medalClass(i + 1)}"><span class="who">${teamImgFor(d, t.id, t.name, "logo", "logo")}${esc(t.name)}</span></td><td class="pts">${fmtPts(t.v)}</td></tr>`));
      }
      const right = table(isD ? ["#", "Δ", "Driver", "Team", "W"].concat(rows.some((x) => x.swins) ? ["SW"] : []).concat(["Pts"]) : ["#", "Δ", "Team", "W", "Pts"],
        rows.map((x) => {
          const bar = `<span class="tbar" style="background:${teamColor(isD ? x.teamId : x.id)}"></span>`;
          if (isD) {
            const ph = photoFor(x, "dphoto");
            return `<tr><td class="pos">${x.rank}</td><td>${deltaCell(x)}</td><td><span class="who">${ph}<span>${bar}<b>${esc(x.code)}</b> ${esc(x.name)}</span></span></td><td>${esc(x.team)}</td><td>${x.wins}</td>${x.swins ? `<td>${x.swins}</td>` : (rows.some((y) => y.swins) ? "<td></td>" : "")}<td class="pts">${fmtPts(x.value)}</td></tr>`;
          }
          const logo = teamImgFor(d, x.id, x.name, "logo", "logo");
          const car = hasTeam(x.id) ? imgTag(teamCarPhoto(x.id), x.name, "carphoto") : "";
          return `<tr><td class="pos">${x.rank}</td><td>${deltaCell(x)}</td><td><span class="who">${logo}${car}<span>${bar}${esc(x.name)}</span></span></td><td>${x.wins}</td><td class="pts">${fmtPts(x.value)}</td></tr>`;
        }));
      html = splitView(last, left, right);
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
  } else if (S.tab === "bingo") {
    html = `<div id="bingoGrid" class="bingo"></div><div class="bingoBar"><span id="bingoCount"></span><button id="bingoAdd">+ Add event</button><button id="bingoReset">Reset</button></div>`;
    stat = "WC events — click to mark";
  }
  $("content").innerHTML = html;
  $("statLine").textContent = stat;
  if (S.tab === "bingo") initBingo();
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
    $("bingoCount").textContent = `${n}/${events.length} done`;
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
    const v = prompt("New event:");
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

// Show unexpected JS errors on screen (prevents silent "loading" hangs)
window.addEventListener("error", (e) => {
  const el = document.getElementById("statLine");
  if (el && /loading/.test(el.textContent)) el.textContent = "Error: " + (e.message || "unknown");
});
