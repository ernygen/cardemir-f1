// F1 API provider — Jolpica (Ergast successor).
// No data from Excel; Excel is only the concept.
// This module fetches calendar + race results from the API
// and computes the Cardemir custom championships (PG/PGNN/PGC/PGNS/Ters/QR) itself.

const BASE = "https://api.jolpi.ca/ergast/f1";
const PAGE = 100;

export const PGC_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const CLASSIFIED = new Set(["Finished", "Lapped"]);
// Lapped cars are "+1 Lap" in old seasons, "Lapped" in new ones
const isClassified = (status) =>
  CLASSIFIED.has(status) || /^\+\d+\s+laps?$/i.test(status || "");

async function fetchJson(path, timeoutMs = 25000, retries = 3) {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(BASE + path, { headers: { Accept: "application/json" }, signal: ctrl.signal });
      if (res.status === 429 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
      return res.json();
    } catch (e) {
      if (e.name === "AbortError") throw new Error(`API timeout (25s): ${path}`);
      throw e;
    } finally {
      clearTimeout(t);
    }
  }
}

// Jolpica paginates by row (limit max 100), rounds may split.
// So we collect all rows and group by round ourselves.
async function fetchAllRows(path) {
  const key = path.includes("sprint") ? "SprintResults" : path.includes("qualifying") ? "QualifyingResults" : "Results";
  const rows = [];
  let offset = 0;
  for (let page = 0; page < 50; page++) {
    const json = await fetchJson(`${path}?limit=${PAGE}&offset=${offset}`);
    const table = json.MRData.RaceTable;
    for (const race of table.Races) {
      for (const row of race[key] || []) rows.push({ round: Number(race.round), row });
    }
    const total = Number(json.MRData.total);
    offset += PAGE;
    if (offset >= total || table.Races.length === 0) break;
  }
  return rows;
}

const num = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
const pts = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

function fullName(d) {
  return `${d.Driver.givenName} ${d.Driver.familyName}`;
}
function code(d) {
  return d.Driver.code || d.Driver.familyName.slice(0, 3).toUpperCase();
}

// Custom championship math for one event (8-point scale for sprints)
function computeRound(roundNo, name, date, rows, sprint = false) {
  const PTS = sprint ? SPRINT_POINTS : PGC_POINTS;
  const classified = [];
  let maxGrid = 0;
  for (const r of rows) {
    const g = num(r.grid);
    if (g !== null && g > maxGrid) maxGrid = g;
  }
  const plGrid = maxGrid + 1; // "0"/PL starters count from the back
  let winner = null;
  for (const r of rows) {
    const pos = num(r.position);
    const grid = num(r.grid);
    const ok = isClassified(r.status) && pos !== null;
    const effGrid = grid !== null && grid > 0 ? grid : plGrid;
    if (pos === 1) winner = { id: r.Driver.driverId, code: code(r), name: fullName(r), team: r.Constructor.name, teamId: r.Constructor.constructorId };
    classified.push({
      id: r.Driver.driverId, code: code(r), name: fullName(r),
      given: r.Driver.givenName, family: r.Driver.familyName,
      team: r.Constructor.name, teamId: r.Constructor.constructorId,
      wiki: r.Driver.url || null,
      grid: effGrid, gridRaw: String(r.grid), finish: pos, status: r.status,
      realPoints: pts(r.points), classified: ok,
      gain: ok ? effGrid - pos : null,
    });
  }
  const cls = classified.filter((d) => d.classified);
  // PG order: gain desc, ties broken by real finish
  const byGain = [...cls].sort((a, b) => b.gain - a.gain || a.finish - b.finish);

  // PGC: split — tied gains share slot points
  const pgcSplit = new Map();
  let i = 0;
  while (i < byGain.length && i < PTS.length) {
    let j = i;
    while (j < byGain.length && byGain[j].gain === byGain[i].gain) j++;
    const end = Math.min(j, PTS.length);
    const pool = PTS.slice(i, end).reduce((a, b) => a + b, 0);
    const each = pool / (end - i);
    for (let k = i; k < end; k++) pgcSplit.set(byGain[k].id, each);
    i = j;
  }
  // PGNS: no split — takes positional points directly
  const pgns = new Map();
  byGain.slice(0, PTS.length).forEach((d, k) => pgns.set(d.id, PTS[k]));

  // Reverse: score classified back-to-front (last gets 25), no DNFs
  const byReverse = [...cls].sort((a, b) => b.finish - a.finish);
  const ters = new Map();
  byReverse.slice(0, PTS.length).forEach((d, k) => ters.set(d.id, PTS[k]));

  return { round: roundNo, name, date, winner, drivers: classified, byGain, pgcSplit, pgns, ters };
}

export async function loadSeason(year) {
  const schedJson = await fetchJson(`/${year}.json`);
  const schedule = (schedJson.MRData.RaceTable.Races || []).map((r) => ({
    round: Number(r.round), name: r.raceName, date: r.date,
    circuit: r.Circuit.circuitName, circuitId: r.Circuit.circuitId, wiki: r.Circuit.url || null,
  }));
  const [resRows, sprintRows] = await Promise.all([
    fetchAllRows(`/${year}/results.json`),
    fetchAllRows(`/${year}/sprint.json`).catch(() => []),
  ]);
  const group = (rows) => {
    const m = new Map();
    for (const { round, row } of rows) {
      if (!m.has(round)) m.set(round, []);
      m.get(round).push(row);
    }
    return m;
  };
  const schedByRound = new Map(schedule.map((s) => [s.round, s]));
  // Team Wikipedia links (for old-season images)
  const teamWiki = {};
  for (const { row } of [...resRows, ...sprintRows]) {
    if (row.Constructor && row.Constructor.url) teamWiki[row.Constructor.constructorId] = row.Constructor.url;
  }
  const sprintSet = new Set();
  const rounds = [...group(resRows).entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, rows]) => {
      const s = schedByRound.get(round) || {};
      const ev = computeRound(round, s.name || `Round ${round}`, s.date || "", rows);
      ev.key = String(round); ev.sprint = false; ev.seq = round * 2;
      return ev;
    });
  const sprints = [...group(sprintRows).entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, rows]) => {
      const s = schedByRound.get(round) || {};
      const base = (s.name || `Round ${round}`).replace(" Grand Prix", "");
      const ev = computeRound(round, `${base} Sprint`, s.date || "", rows, true);
      ev.key = `${round}S`; ev.sprint = true; ev.seq = round * 2 - 1;
      sprintSet.add(round);
      return ev;
    });
  // All events (sprint before its round's GP): totals computed from here
  const events = [...rounds, ...sprints].sort((a, b) => a.seq - b.seq);

  const drivers = new Map();
  const teams = new Map();
  for (const rd of rounds) {
    for (const d of rd.drivers) {
      if (!drivers.has(d.id)) {
        drivers.set(d.id, {
          id: d.id, code: d.code, name: d.name, team: d.team, teamId: d.teamId,
          points: 0, wins: 0, pg: 0, pgnn: 0, pgc: 0, pgns: 0, ters: 0,
        });
      }
      const D = drivers.get(d.id);
      D.team = d.team; D.teamId = d.teamId;
      D.points += d.realPoints;
      if (d.finish === 1) D.wins++;
      if (d.gain !== null) {
        D.pg += d.gain;
        D.pgnn += Math.max(0, d.gain);
      }
      D.pgc += rd.pgcSplit.get(d.id) || 0;
      D.pgns += rd.pgns.get(d.id) || 0;
      D.ters += rd.ters.get(d.id) || 0;

      if (!teams.has(d.teamId)) teams.set(d.teamId, { id: d.teamId, name: d.team, points: 0, wins: 0, pgc: 0, pgns: 0, ters: 0 });
      const T = teams.get(d.teamId);
      T.name = d.team;
      T.points += d.realPoints;
      if (d.finish === 1) T.wins++;
      T.pgc += rd.pgcSplit.get(d.id) || 0;
      T.pgns += rd.pgns.get(d.id) || 0;
      T.ters += rd.ters.get(d.id) || 0;
    }
  }
  return {
    source: `f1api:${year}`, season: year, schedule, rounds, sprints, events, teamWiki,
    sprintRounds: [...sprintSet].sort((a, b) => a - b),
    completed: rounds.length,
    drivers: [...drivers.values()], teams: [...teams.values()],
  };
}

export async function loadSeasonsList() {
  const json = await fetchJson("/seasons.json?limit=100");
  return json.MRData.SeasonTable.Seasons.map((s) => s.season);
}

// Cumulative table up to an event. metric: real|pg|pgnn|pgc|ters
// (pgns = metric pgc + split:false). upto: last included event seq (Infinity = all).
// GPs + sprints computed together (sprint is a separate event).
export function computeTable(data, { who = "drivers", metric = "real", upto = Infinity, split = true } = {}) {
  const agg = new Map();
  for (const rd of data.events) {
    if (rd.seq > upto) continue;
    for (const d of rd.drivers) {
      if (!agg.has(d.id)) {
        agg.set(d.id, { id: d.id, code: d.code, name: d.name, given: d.given, family: d.family, team: d.team, teamId: d.teamId, wiki: d.wiki || null, value: 0, wins: 0, swins: 0 });
      }
      const a = agg.get(d.id);
      a.team = d.team; a.teamId = d.teamId;
      if (!a.wiki && d.wiki) a.wiki = d.wiki;
      if (metric === "real") { a.value += d.realPoints; if (d.finish === 1) { if (rd.sprint) a.swins++; else a.wins++; } }
      else if (metric === "pg") { if (d.gain !== null) a.value += d.gain; }
      else if (metric === "pgnn") { if (d.gain !== null) a.value += Math.max(0, d.gain); }
      else if (metric === "pgc") { a.value += (split ? rd.pgcSplit : rd.pgns).get(d.id) || 0; }
      else if (metric === "ters") { a.value += rd.ters.get(d.id) || 0; }
    }
  }
  let arr = [...agg.values()];
  if (metric === "real") arr.sort((a, b) => b.value - a.value || b.wins - a.wins);
  else arr.sort((a, b) => b.value - a.value);
  if (who === "teams") {
    // Teams: credited to the round's team (a mid-season mover's old points
    // stay with the old team — e.g. Lawson's Red Bull points).
    const t = new Map();
    const add = (teamId, name, v, win) => {
      if (!t.has(teamId)) t.set(teamId, { id: teamId, name, value: 0, wins: 0 });
      const T = t.get(teamId);
      T.name = name; T.value += v; T.wins += win ? 1 : 0;
    };
    for (const rd of data.events) {
      if (rd.seq > upto) continue;
      for (const d of rd.drivers) {
        if (metric === "real") add(d.teamId, d.team, d.realPoints, d.finish === 1 && !rd.sprint);
        else if (metric === "pg" && d.gain !== null) add(d.teamId, d.team, d.gain, false);
        else if (metric === "pgnn" && d.gain !== null) add(d.teamId, d.team, Math.max(0, d.gain), false);
        else if (metric === "pgc") add(d.teamId, d.team, (split ? rd.pgcSplit : rd.pgns).get(d.id) || 0, false);
        else if (metric === "ters") add(d.teamId, d.team, rd.ters.get(d.id) || 0, false);
      }
    }
    arr = [...t.values()].sort((a, b) => b.value - a.value || b.wins - a.wins);
  }
  return arr;
}

// Season total + rank change vs previous event (for arrows).
// Returns: [{..., rank, prev (rank no / null=new), diff}]
export function tableWithChanges(data, opts) {
  const full = computeTable(data, opts);
  const evs = data.events;
  if (evs.length < 2) return full.map((x, i) => ({ ...x, rank: i + 1, prev: null, diff: null }));
  const prevSeq = evs[evs.length - 2].seq;
  const before = computeTable(data, { ...opts, upto: prevSeq });
  const rb = new Map(before.map((x, i) => [x.id, i + 1]));
  return full.map((x, i) => {
    const p = rb.has(x.id) ? rb.get(x.id) : null;
    return { ...x, rank: i + 1, prev: p, diff: p === null ? null : p - (i + 1) };
  });
}

export const getDriverStandings = (d) => computeTable(d, { who: "drivers", metric: "real" });
export const getTeamStandings = (d) => computeTable(d, { who: "teams", metric: "real" });
export const getPG = (d, nn = false) => computeTable(d, { who: "drivers", metric: nn ? "pgnn" : "pg" });
export const getPGC = (d, split = true) => computeTable(d, { who: "drivers", metric: "pgc", split });
export const getTers = (d) => computeTable(d, { who: "drivers", metric: "ters" });
export const getTeamPGC = (d, split = true) => computeTable(d, { who: "teams", metric: "pgc", split });
export const getTeamTers = (d) => computeTable(d, { who: "teams", metric: "ters" });
export const getRound = (d, key) => d.events.find((r) => r.key === String(key));

export function getChampions(data) {
  const dw = computeTable(data, { who: "drivers", metric: "real" })[0];
  const cw = computeTable(data, { who: "teams", metric: "real" })[0];
  const wm = new Map();
  for (const r of data.rounds) {
    if (!r.winner) continue;
    if (!wm.has(r.winner.id)) {
      wm.set(r.winner.id, { id: r.winner.id, code: r.winner.code, name: r.winner.name, team: r.winner.team, wins: 0, races: [] });
    }
    const w = wm.get(r.winner.id);
    w.team = r.winner.team;
    w.wins++;
    w.races.push({ round: r.round, name: r.name });
  }
  const winners = [...wm.values()].sort((a, b) => b.wins - a.wins);
  return { driver: dw, team: cw, rounds: data.rounds.length, differentWinners: winners.length, winners };
}
