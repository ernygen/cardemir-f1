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
