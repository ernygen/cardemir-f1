// F1 API provider — Jolpica (Ergast devamı).
// Excel'den veri alınmaz; Excel sadece konsepttir.
// Bu modül takvim + yarış sonuçlarını API'den çeker,
// Cardemir özel şampiyonalarını (PG/PGNN/PGC/PGNS/Ters/QR) kendisi hesaplar.

const BASE = "https://api.jolpi.ca/ergast/f1";
const PAGE = 100;

export const PGC_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const CLASSIFIED = new Set(["Finished", "Lapped"]);

async function fetchJson(path, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json();
  } catch (e) {
    if (e.name === "AbortError") throw new Error(`API zaman aşımı (25sn): ${path}`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// Jolpica sayfalamayı satır bazında yapar (limit max 100), turlar bölünebilir.
// Bu yüzden tüm satırları toplayıp tura göre biz gruplarız.
async function fetchAllRows(path) {
  const rows = [];
  let offset = 0;
  for (let page = 0; page < 50; page++) {
    const json = await fetchJson(`${path}?limit=${PAGE}&offset=${offset}`);
    const table = json.MRData.RaceTable;
    for (const race of table.Races) {
      const key = path.includes("results") ? "Results" : "QualifyingResults";
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
const isClassified = (status) => CLASSIFIED.has(status);

function fullName(d) {
  return `${d.Driver.givenName} ${d.Driver.familyName}`;
}
function code(d) {
  return d.Driver.code || d.Driver.familyName.slice(0, 3).toUpperCase();
}

// Bir tur için özel şampiyona hesapları
function computeRound(roundNo, name, date, rows) {
  const classified = [];
  let maxGrid = 0;
  for (const r of rows) {
    const g = num(r.grid);
    if (g !== null && g > maxGrid) maxGrid = g;
  }
  const plGrid = maxGrid + 1; // grid "0"/PL ile başlayanlar en arkadan sayılır
  let winner = null;
  for (const r of rows) {
    const pos = num(r.position);
    const grid = num(r.grid);
    const ok = isClassified(r.status) && pos !== null;
    const effGrid = grid !== null && grid > 0 ? grid : plGrid;
    if (pos === 1) winner = { id: r.Driver.driverId, code: code(r), name: fullName(r), team: r.Constructor.name };
    classified.push({
      id: r.Driver.driverId, code: code(r), name: fullName(r),
      team: r.Constructor.name, teamId: r.Constructor.constructorId,
      grid: effGrid, gridRaw: String(r.grid), finish: pos, status: r.status,
      realPoints: pts(r.points), classified: ok,
      gain: ok ? effGrid - pos : null,
    });
  }
  const cls = classified.filter((d) => d.classified);
  // PG sırası: kazanç desc, eşitlikte gerçek finiş önde
  const byGain = [...cls].sort((a, b) => b.gain - a.gain || a.finish - b.finish);

  // PGC: splitli — eşit kazançlar slot puanlarını bölüşür
  const pgcSplit = new Map();
  let i = 0;
  while (i < byGain.length && i < PGC_POINTS.length) {
    let j = i;
    while (j < byGain.length && byGain[j].gain === byGain[i].gain) j++;
    const end = Math.min(j, PGC_POINTS.length);
    const pool = PGC_POINTS.slice(i, end).reduce((a, b) => a + b, 0);
    const each = pool / (end - i);
    for (let k = i; k < end; k++) pgcSplit.set(byGain[k].id, each);
    i = j;
  }
  // PGNS: splitsiz — sıra puanını direkt alır
  const pgns = new Map();
  byGain.slice(0, PGC_POINTS.length).forEach((d, k) => pgns.set(d.id, PGC_POINTS[k]));

  // Ters: klasmanı sondan başa puanla (sonuncu 25), DNF'sizler yok
  const byReverse = [...cls].sort((a, b) => b.finish - a.finish);
  const ters = new Map();
  byReverse.slice(0, PGC_POINTS.length).forEach((d, k) => ters.set(d.id, PGC_POINTS[k]));

  return { round: roundNo, name, date, winner, drivers: classified, byGain, pgcSplit, pgns, ters };
}

export async function loadSeason(year) {
  const schedJson = await fetchJson(`/${year}.json`);
  const schedule = (schedJson.MRData.RaceTable.Races || []).map((r) => ({
    round: Number(r.round), name: r.raceName, date: r.date,
    circuit: r.Circuit.circuitName, circuitId: r.Circuit.circuitId,
  }));
  const [resRows] = await Promise.all([fetchAllRows(`/${year}/results.json`)]);
  const byRound = new Map();
  for (const { round, row } of resRows) {
    if (!byRound.has(round)) byRound.set(round, []);
    byRound.get(round).push(row);
  }
  const schedByRound = new Map(schedule.map((s) => [s.round, s]));
  const rounds = [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, rows]) => {
      const s = schedByRound.get(round) || {};
      return computeRound(round, s.name || `Round ${round}`, s.date || "", rows);
    });

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
    source: `f1api:${year}`, season: year, schedule, rounds,
    completed: rounds.length,
    drivers: [...drivers.values()], teams: [...teams.values()],
  };
}

export async function loadSeasonsList() {
  const json = await fetchJson("/seasons.json?limit=100");
  return json.MRData.SeasonTable.Seasons.map((s) => s.season);
}

// Belirli bir tura kadar kümülatif tablo. metric: real|pg|pgnn|pgc|ters
// (pgns = metric pgc + split:false). upto: dahil olan son tur no (Infinity = tümü).
export function computeTable(data, { who = "drivers", metric = "real", upto = Infinity, split = true } = {}) {
  const agg = new Map();
  for (const rd of data.rounds) {
    if (rd.round > upto) continue;
    for (const d of rd.drivers) {
      if (!agg.has(d.id)) {
        agg.set(d.id, { id: d.id, code: d.code, name: d.name, team: d.team, teamId: d.teamId, value: 0, wins: 0 });
      }
      const a = agg.get(d.id);
      a.team = d.team; a.teamId = d.teamId;
      if (metric === "real") { a.value += d.realPoints; if (d.finish === 1) a.wins++; }
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
    // Takımlar: turun atandığı takıma yazılır (sezon içi takım değiştiren pilotun
    // eski puanı eski takımda kalır — örn. Lawson'un Red Bull puanları).
    const t = new Map();
    const add = (teamId, name, v, win) => {
      if (!t.has(teamId)) t.set(teamId, { id: teamId, name, value: 0, wins: 0 });
      const T = t.get(teamId);
      T.name = name; T.value += v; T.wins += win ? 1 : 0;
    };
    for (const rd of data.rounds) {
      if (rd.round > upto) continue;
      for (const d of rd.drivers) {
        if (metric === "real") add(d.teamId, d.team, d.realPoints, d.finish === 1);
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

// Sezon toplamı + bir önceki tura göre sıra farkı (oklar için).
// Dönüş: [{..., rank, prev (sıra no / null=yeni), diff}]
export function tableWithChanges(data, opts) {
  const full = computeTable(data, opts);
  const n = data.rounds.length;
  if (n < 2) return full.map((x, i) => ({ ...x, rank: i + 1, prev: null, diff: null }));
  const prevRound = data.rounds[n - 2].round;
  const before = computeTable(data, { ...opts, upto: prevRound });
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
export const getRound = (d, round) => d.rounds.find((r) => r.round === Number(round));

export function getChampions(data) {
  const dw = computeTable(data, { who: "drivers", metric: "real" })[0];
  const cw = computeTable(data, { who: "teams", metric: "real" })[0];
  const winners = new Set(data.rounds.map((r) => r.winner && r.winner.id).filter(Boolean));
  return { driver: dw, team: cw, rounds: data.rounds.length, differentWinners: winners.size };
}
