// Aramco Power Rankings (2026)
// Scale: Linearly distributed from 25 to 1 among all entered drivers
import POWER_DATA from "./powerData.js?v=10";

export function calculatePowerPoints(count) {
  if (!count || count <= 0) return [];
  if (count === 1) return [25];
  const step = 24 / (count - 1);
  const pts = [];
  for (let i = 0; i < count; i++) {
    const val = 25 - i * step;
    pts.push(Math.round(val * 10) / 10);
  }
  return pts;
}

// "NOR 9.8,VER" -> [{ code: "NOR", score: 9.8 }, { code: "VER", score: null }]
export const parsePowerLine = (s) => s.split(",").map((p) => {
  const [code, score] = p.trim().split(/\s+/);
  return { code, score: score === undefined ? null : Number(score) };
});

// Built-in rankings every visitor sees (data in powerData.js; browser-saved entries override per round)
export const DEFAULT_POWER_RANKINGS = Object.fromEntries(Object.entries(POWER_DATA).map(([year, rounds]) =>
  [year, Object.fromEntries(Object.entries(rounds).map(([r, line]) => [r, parsePowerLine(line)]))]));

const storageKey = (year) => `cardemir_power_rankings_${year}`;

export function getPowerRankings(year = "2026") {
  const def = DEFAULT_POWER_RANKINGS[year] || {};
  if (typeof localStorage === "undefined") return { ...def };
  try {
    const raw = localStorage.getItem(storageKey(year));
    if (!raw) return { ...def };
    const saved = JSON.parse(raw);
    return { ...def, ...saved };
  } catch {
    return { ...def };
  }
}

// Stores only the browser's own edits, so later updates to the built-in defaults still reach this visitor
export function saveRoundPowerRankings(year, round, items) {
  if (typeof localStorage === "undefined") return false;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(year)) || "{}");
    saved[round] = items;
    localStorage.setItem(storageKey(year), JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}

// Empty list (not delete) so a built-in default round stays cleared
export const clearRoundPowerRankings = (year, round) => saveRoundPowerRankings(year, round, []);

export function resetAllPowerRankings(year) {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.removeItem(storageKey(year));
    return true;
  } catch {
    return false;
  }
}

// One round as a powerData.js line, to paste into the repo so every visitor sees it
export function exportPowerLine(year, round) {
  const items = getPowerRankings(year)[round] || [];
  return `    ${round}: "${items.map((x) => (x.score == null ? x.code : `${x.code} ${x.score}`)).join(",")}",`;
}

// Smart parser: accepts lines like "norris 9,8", "1. Lando Norris 9.8", "HAM 9,6", "VER"
export function parsePowerInput(text, allDrivers = []) {
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const items = [];
  for (const line of lines) {
    // Find numeric score: accepts comma or dot decimal (e.g. 9,8 or 9.8 or 10 or 8)
    const numMatch = line.match(/(\b\d{1,2}(?:[.,]\d{1,2})?\b)(?!.*\b\d{1,2}(?:[.,]\d{1,2})?\b)/);
    let score = null;
    let driverPart = line;
    if (numMatch) {
      score = parseFloat(numMatch[1].replace(",", "."));
      driverPart = (line.slice(0, numMatch.index) + line.slice(numMatch.index + numMatch[0].length)).trim();
    }
    // Remove leading rank numbers like "1.", "P1", "1 -", etc.
    driverPart = driverPart.replace(/^(?:P?\d+[\s.:)\-–—]+)/i, "").replace(/[:\-–—]+$/, "").trim();
    if (!driverPart && numMatch) continue;

    const dLower = driverPart.toLowerCase();
    const found = allDrivers.find((d) =>
      d.code?.toLowerCase() === dLower ||
      d.id?.toLowerCase() === dLower ||
      d.name?.toLowerCase() === dLower ||
      d.family?.toLowerCase() === dLower ||
      d.name?.toLowerCase().includes(dLower) ||
      (d.family && dLower.includes(d.family.toLowerCase()))
    );

    items.push({
      code: found ? found.code : driverPart.slice(0, 3).toUpperCase(),
      id: found ? found.id : driverPart.toLowerCase().replace(/\s+/g, "_"),
      name: found ? found.name : driverPart,
      score,
    });
  }
  // Deduplicate by id if entered multiple times, keeping the first
  const seen = new Set();
  const uniqueItems = [];
  for (const it of items) {
    if (!seen.has(it.id)) {
      seen.add(it.id);
      uniqueItems.push(it);
    }
  }
  // Sort descending by score if scores are provided
  if (uniqueItems.some((x) => x.score !== null && x.score !== undefined)) {
    uniqueItems.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }
  return uniqueItems;
}

// Format items back to text for the editor (e.g. "norris 9,8")
export function formatPowerItems(items) {
  if (!items || !items.length) return "";
  return items.map((x) => {
    const name = x.name || x.code || x.id;
    if (x.score !== null && x.score !== undefined) {
      return `${name} ${String(x.score).replace(".", ",")}`;
    }
    return `${name}`;
  }).join("\n");
}
