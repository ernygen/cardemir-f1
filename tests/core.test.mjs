import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRound } from "../providers/f1ApiProvider.js";

// Jolpica "Results" row shape
export const row = (id, grid, pos, status = "Finished", points = 0) => ({
  grid: String(grid), position: pos === null ? undefined : String(pos), status, points: String(points),
  Driver: { driverId: id, code: id.toUpperCase().slice(0, 3), givenName: id, familyName: id },
  Constructor: { constructorId: "t_" + id, name: "T" + id },
});

// a +3, b +1 (P2), c -1, d +1 (P4)
const race = () => [row("a", 4, 1), row("b", 3, 2), row("c", 2, 3), row("d", 5, 4)];

test("PGC split: tied gains share slot points", () => {
  const r = computeRound(1, "X", "", race());
  assert.equal(r.pgcSplit.get("a"), 25);
  assert.equal(r.pgcSplit.get("b"), 16.5);
  assert.equal(r.pgcSplit.get("d"), 16.5);
  assert.equal(r.pgcSplit.get("c"), 12);
});

test("PGNS: no split, tie broken by finish", () => {
  const r = computeRound(1, "X", "", race());
  assert.equal(r.pgns.get("b"), 18);
  assert.equal(r.pgns.get("d"), 15);
});

test("pit lane start counts from the back", () => {
  const r = computeRound(1, "X", "", [row("p", 0, 1), row("q", 3, 2), row("s", 1, 3)]);
  assert.equal(r.drivers.find((d) => d.id === "p").gain, 3);
});

test("reverse: last classified gets 25, DNF excluded", () => {
  const r = computeRound(1, "X", "", [row("a", 1, 1), row("b", 2, 2), row("c", 3, 3), row("x", 4, 4, "Accident")]);
  assert.equal(r.ters.get("c"), 25);
  assert.equal(r.ters.has("x"), false);
});

test("sprint uses 8-point scale", () => {
  const r = computeRound(1, "X", "", race(), true);
  assert.equal(r.pgcSplit.get("a"), 8);
});

test("+1 Lap counts as classified", () => {
  const r = computeRound(1, "X", "", [row("a", 1, 1), row("b", 2, 2, "+1 Lap")]);
  assert.equal(r.drivers.find((d) => d.id === "b").classified, true);
});

// --- Task 2: official standings ---
import { computeTable, getChampions, applyOfficialStandings } from "../providers/f1ApiProvider.js";

export function mkData(rounds) {
  const events = rounds.map((rows, i) => {
    const ev = computeRound(i + 1, "R" + (i + 1), "", rows);
    ev.key = String(i + 1); ev.sprint = false; ev.seq = (i + 1) * 2;
    return ev;
  });
  return { season: "1988", events, rounds: events, sprints: [], teamWiki: {} };
}
const standings = (list) => ({ MRData: { StandingsTable: { StandingsLists: list.length ? [{ DriverStandings: list }] : [] } } });
const teamStandings = (list) => ({ MRData: { StandingsTable: { StandingsLists: list.length ? [{ ConstructorStandings: list }] : [] } } });
const ds = (id, position, points, wins = 0) => ({ ...(position ? { position: String(position) } : {}), positionText: position ? String(position) : "D", points: String(points), wins: String(wins), Driver: { driverId: id } });

const season1988 = () => mkData([
  [row("prost", 1, 1, "Finished", 9), row("senna", 2, 2, "Finished", 6), row("schu", 3, 3, "Finished", 4)],
  [row("prost", 1, 1, "Finished", 9), row("senna", 2, 2, "Finished", 6), row("schu", 3, 3, "Finished", 4)],
]);

test("official standings override raw sum (1988 case)", () => {
  const d = season1988();
  applyOfficialStandings(d, standings([ds("senna", 1, 90, 8), ds("prost", 2, 87, 7), ds("schu", 3, 8)]), null);
  const t = computeTable(d, { metric: "real" });
  assert.equal(t[0].id, "senna");
  assert.equal(t[0].value, 90);
  assert.equal(getChampions(d).driver.id, "senna");
});

test("disqualified driver without position goes last", () => {
  const d = season1988();
  applyOfficialStandings(d, standings([ds("senna", 1, 90), ds("prost", 2, 87), ds("schu", null, 78)]), null);
  const t = computeTable(d, { metric: "real" });
  assert.equal(t[t.length - 1].id, "schu");
});

test("no constructors championship before 1958", () => {
  const d = season1988();
  applyOfficialStandings(d, standings([ds("senna", 1, 90)]), teamStandings([]));
  assert.equal(getChampions(d).team, null);
  assert.equal(computeTable(d, { who: "teams", metric: "real" }).length, 3);
});

test("finite upto ignores official", () => {
  const d = season1988();
  applyOfficialStandings(d, standings([ds("senna", 1, 90), ds("prost", 2, 87)]), null);
  const t = computeTable(d, { metric: "real", upto: 2 });
  assert.equal(t[0].id, "prost");
  assert.equal(t[0].value, 9);
});

// --- Task 3: power rankings storage ---
import { getPowerRankings, clearRoundPowerRankings, resetAllPowerRankings, exportPowerRankings } from "../powerRankings.js";

function withFakeStorage(fn) {
  const m = new Map();
  globalThis.localStorage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  try { fn(); } finally { delete globalThis.localStorage; }
}

test("clear hides a default round", () => withFakeStorage(() => {
  clearRoundPowerRankings("2026", 19);
  assert.equal(getPowerRankings("2026")[19].length, 0);
  resetAllPowerRankings("2026");
  assert.equal(getPowerRankings("2026")[19].length, 10);
}));

test("export returns saved rankings as JSON", () => withFakeStorage(() => {
  assert.deepEqual(JSON.parse(exportPowerRankings("2026")), JSON.parse(JSON.stringify(getPowerRankings("2026"))));
}));

// --- Task 4: power arrows ---
import { tableWithChanges } from "../providers/f1ApiProvider.js";

function setPower(ev, list) {
  ev.powerList = list.map(([id, p, score = null], i) => ({ id, code: id, name: id, team: "", teamId: "t_" + id, score, rank: i + 1, pts: p }));
  ev.power = new Map(list.map(([id, p]) => [id, p]));
  ev.powerWinner = list.length ? list[0][0] : null;
}
const threeRaces = () => mkData([[row("a", 1, 1)], [row("a", 1, 1)], [row("a", 1, 1)]]);

test("power arrows skip events without rankings", () => {
  const d = threeRaces();
  setPower(d.events[0], [["a", 25], ["b", 13], ["c", 1]]);
  setPower(d.events[1], [["c", 25], ["a", 1]]);
  setPower(d.events[2], []);
  const t = tableWithChanges(d, { who: "drivers", metric: "power" });
  assert.equal(t.find((x) => x.id === "b").diff, -1);
});

test("power arrows with one ranked event", () => {
  const d = threeRaces();
  setPower(d.events[0], [["a", 25], ["b", 1]]);
  setPower(d.events[1], []); setPower(d.events[2], []);
  const t = tableWithChanges(d, { who: "drivers", metric: "power" });
  assert.ok(t.every((x) => x.diff === null));
});

// --- Task 5: power input parsing + driver lookup ---
import { parsePowerInput, calculatePowerPoints } from "../powerRankings.js";
import { applyPowerRankings } from "../providers/f1ApiProvider.js";

const roster = [{ id: "norris", code: "NOR", name: "Lando Norris" }, { id: "hulkenberg", code: "HUL", name: "Nico Hülkenberg" }];

test("parse: 'norris 9,8'", () => {
  const [x] = parsePowerInput("norris 9,8", roster);
  assert.equal(x.id, "norris"); assert.equal(x.score, 9.8);
});
test("parse: rank prefix and full name", () => {
  const [x] = parsePowerInput("1. Lando Norris 9.8", roster);
  assert.equal(x.id, "norris"); assert.equal(x.score, 9.8);
});
test("parse: code", () => assert.equal(parsePowerInput("HUL 8", roster)[0].id, "hulkenberg"));
test("parse: duplicate keeps first", () => {
  const r = parsePowerInput("norris 9\nNOR 5", roster);
  assert.equal(r.length, 1); assert.equal(r[0].score, 9);
});
test("parse: sorted by score desc", () => {
  assert.deepEqual(parsePowerInput("HUL 7\nnorris 9", roster).map((x) => x.id), ["norris", "hulkenberg"]);
});
test("calculatePowerPoints spreads 25..1", () => {
  assert.deepEqual(calculatePowerPoints(3), [25, 13, 1]);
  assert.deepEqual(calculatePowerPoints(1), [25]);
});
test("applyPowerRankings resolves codes to race drivers", () => {
  const d = mkData([[row("norris", 1, 1), row("verstappen", 2, 2)]]);
  d.events[0].round = 20;
  d.drivers = [];
  applyPowerRankings(d, "2026");
  const ids = d.events[0].powerList.map((x) => x.id);
  assert.ok(ids.includes("norris"));
  assert.equal(d.events[0].powerWinner, "norris");
});

// --- Task 6: power sort modes (guards the powerCmp merge) ---
test("power sort modes: pts / avg / score, drivers and teams", () => {
  const d = threeRaces();
  setPower(d.events[0], [["a", 25, 6], ["b", 13, 5], ["c", 1, 9.9]]);
  setPower(d.events[1], [["b", 25, 5]]);
  setPower(d.events[2], []);
  const order = (who, powerSort) => computeTable(d, { who, metric: "power", powerSort }).map((x) => x.id.replace("t_", ""));
  for (const who of ["drivers", "teams"]) {
    assert.deepEqual(order(who, "pts"), ["b", "a", "c"]);
    assert.deepEqual(order(who, "avg"), ["c", "a", "b"]);
    assert.deepEqual(order(who, "score"), ["b", "c", "a"]);
  }
});

// --- Final review fix: storage keeps only user-edited rounds ---
import { saveRoundPowerRankings } from "../powerRankings.js";
test("save/clear store only the edited round, not the defaults", () => withFakeStorage(() => {
  const stored = () => Object.keys(JSON.parse(localStorage.getItem("cardemir_power_rankings_2026")));
  saveRoundPowerRankings("2026", 5, [{ code: "NOR", score: 9 }]);
  assert.deepEqual(stored(), ["5"]);
  clearRoundPowerRankings("2026", 7);
  assert.deepEqual(stored(), ["5", "7"]);
}));

// --- Redesign: points left + reachable finishing range ---
import { pointsLeft, finishRange } from "../providers/f1ApiProvider.js";

test("pointsLeft: remaining GPs and sprints after the last run round", () => {
  const d = { season: "2026", rounds: [{ round: 1 }, { round: 2 }], schedule: [{ round: 1 }, { round: 2 }, { round: 3, sprint: true }, { round: 4 }] };
  assert.equal(pointsLeft(d), 25 + 8 + 25);
});
test("pointsLeft: fastest-lap point in 2019-2024", () => {
  const d = { season: "2024", rounds: [{ round: 1 }], schedule: [{ round: 1 }, { round: 2 }] };
  assert.equal(pointsLeft(d), 26);
});
test("pointsLeft: finished season is 0", () => {
  assert.equal(pointsLeft({ season: "1988", rounds: [{ round: 1 }], schedule: [{ round: 1 }] }), 0);
});
test("finishRange: who can still reach which position", () => {
  const t = [{ id: "ant", value: 402 }, { id: "ver", value: 304 }, { id: "ham", value: 267 }, { id: "lec", value: 250 }];
  const r = finishRange(t, 50);
  assert.deepEqual(r.get("ant"), { best: 1, worst: 1 });
  assert.deepEqual(r.get("ver"), { best: 2, worst: 3 });
  assert.deepEqual(r.get("lec"), { best: 3, worst: 4 });
});
test("finishRange: no points left keeps the real order, ties included", () => {
  const r = finishRange([{ id: "a", value: 10 }, { id: "b", value: 10 }], 0);
  assert.deepEqual(r.get("a"), { best: 1, worst: 1 });
  assert.deepEqual(r.get("b"), { best: 2, worst: 2 });
});
