// Aramco Power Rankings (2026)
// Scale: 25, 18, 15, 12, 10, 8, 6, 4, 2, 1
export const POWER_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// Default built-in rankings (fallback when nothing in localStorage)
export const DEFAULT_POWER_RANKINGS = {
  2026: {
    19: [
      { code: "VER", score: 9.6 },
      { code: "ANT", score: 9.4 },
      { code: "HAM", score: 9.0 },
      { code: "LEC", score: 8.8 },
      { code: "NOR", score: 8.4 },
      { code: "RUS", score: 8.2 },
      { code: "COL", score: 8.0 },
      { code: "LAW", score: 7.8 },
      { code: "BOR", score: 7.6 },
      { code: "HAD", score: 7.4 },
    ],
    20: [
      { code: "NOR", score: 9.8 },
      { code: "VER", score: 9.6 },
      { code: "LAW", score: 9.2 },
      { code: "HAD", score: 8.8 },
      { code: "HUL", score: 8.6 },
      { code: "ANT", score: 8.4 },
      { code: "RUS", score: 8.2 },
      { code: "BEA", score: 8.0 },
      { code: "ALO", score: 7.8 },
      { code: "PIA", score: 7.6 },
    ],
  },
};

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

export function saveRoundPowerRankings(year, round, items) {
  if (typeof localStorage === "undefined") return false;
  try {
    const current = getPowerRankings(year);
    current[round] = items;
    localStorage.setItem(storageKey(year), JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
}

export function clearRoundPowerRankings(year, round) {
  if (typeof localStorage === "undefined") return false;
  try {
    const current = getPowerRankings(year);
    delete current[round];
    localStorage.setItem(storageKey(year), JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
}

export function resetAllPowerRankings(year) {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.removeItem(storageKey(year));
    return true;
  } catch {
    return false;
  }
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
  // Sort descending by score if scores are provided
  if (items.some((x) => x.score !== null && x.score !== undefined)) {
    items.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  }
  return items;
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
