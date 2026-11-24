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
