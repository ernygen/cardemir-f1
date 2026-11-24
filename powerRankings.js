// Aramco Power Rankings (2026)
// Scale: Linearly distributed from 25 to 1 among all entered drivers

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

// "RUS 9.8,LIN 9.2" -> [{ code, score }]
const pr = (s) => s.split(",").map((p) => { const [code, score] = p.split(" "); return { code, score: Number(score) }; });

// Built-in rankings every visitor sees (browser-saved entries override per round).
// To update: Power tab → "📋 JSON Kopyala", then paste the rounds here.
export const DEFAULT_POWER_RANKINGS = {
  2026: {
    1: pr("RUS 9.8,LIN 9.2,ANT 8.8,LEC 8.6,BEA 8.2,HAM 8,GAS 8,BOR 8,VER 7.8,HAD 7.8"),
    2: pr("BEA 9.4,ANT 9.4,HAM 9,GAS 9,RUS 8.4,COL 8,SAI 8,LAW 7.8,LEC 7.6,VER 6.8,HUL 6.8,BOT 6.8"),
    3: pr("ANT 9.2,PIA 9,GAS 9,LEC 8.4,LAW 7.6,OCO 7.6,RUS 7.2,LIN 7.2,NOR 7,ALO 7,HAM 7"),
    4: pr("ANT 9.4,NOR 9,COL 9,VER 8.6,PER 7.6,SAI 7.4,PIA 7.2,LEC 7.2,ALO 6.8,BEA 6.8"),
    5: pr("HAM 9.2,COL 9.2,VER 8.4,ANT 8.4,RUS 8.2,LIN 8,SAI 8,LAW 8,HAD 7.2,BEA 7.2"),
    6: pr("ANT 10,HAM 9,GAS 9,LAW 9,LIN 8.2,VER 8,HAD 8,PER 8,OCO 7.8,ALB 7.8"),
    7: pr("HAM 10,NOR 8.3,RUS 8.3,ANT 8.3,GAS 8.3,VER 8,LAW 7.8,HUL 7.3,COL 7,HAD 6.8,LIN 6.8"),
    8: pr("RUS 9.2,VER 8.6,LAW 8.4,LIN 8,ANT 7.6,HAM 7.4,PIA 7.2,HAD 7.2,GAS 7.2,BOR 7.2"),
    9: pr("LEC 9,LAW 8.4,ANT 8.2,LIN 8.2,BOR 8,HAM 7.8,NOR 7.4,VER 7.4,HAD 7.2,RUS 7.2,COL 7.2"),
    10: pr("ANT 9.8,LEC 9,BOR 8.8,VER 8.8,LIN 8.6,HAD 8.4,NOR 8.2,COL 8,HAM 7.2,PIA 6.8,GAS 6.8,LAW 6.8,HUL 6.8"),
    11: pr("NOR 9.3,VER 8.8,LAW 8.5,ANT 8.3,HUL 8.3,PIA 7.8,HAM 7.5,LIN 7.5,HAD 7,ALO 7"),
    12: pr("NOR 9.6,ALO 8.6,ANT 8.2,HAM 8,HUL 8,LAW 7.8,TSU 7.8,RUS 7.6,GAS 7.6,LEC 7.2"),
    13: pr("ANT 10,GAS 9.6,VER 8.6,LIN 8.2,RUS 7.8,PIA 7.2,NOR 7,BOR 7,TSU 6.6,SAI 6.6"),
    14: pr("NOR 9.6,ANT 8.8,VER 8.6,COL 8.2,LIN 7.8,HUL 7.8,LEC 7.6,HAM 7.3,OCO 7.2,LAW 7"),
    15: pr("RUS 10,VER 9,HAD 8.8,GAS 8,OCO 8,BEA 7.4,LIN 7.2,LEC 7,LAW 7,SAI 7,PER 7"),
    16: pr("VER 10,ALO 9.4,HAM 9,LAW 9,ANT 8.4,HAD 7.8,LIN 7.8,HUL 7.4,OCO 7.2,SAI 7.2"),
    17: pr("VER 10,LAW 9,LEC 8.8,HUL 8.6,ANT 8.2,BEA 8,HAM 7.2,PIA 7,SAI 7,GAS 6.8"),
    18: pr("ANT 10,LAW 9.2,LEC 8.8,VER 8.8,GAS 7.8,HAM 7.2,HAD 7.2,HUL 7.2,NOR 7,ALO 6.8,LIN 6.8"),
    19: pr("VER 9.6,HAM 8.6,ANT 8.6,LAW 8.2,NOR 7.8,LIN 7.4,HIR 7.4,PER 7.2,BEA 7,BOR 7"),
    20: pr("NOR 9.8,VER 9.6,LAW 9,HAD 8.6,ALO 8.2,HUL 7.8,LIN 7.6,HAM 7.2,RUS 7,ANT 7"),
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
    current[round] = []; // empty list (not delete) so a built-in default round stays cleared
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

// For copying browser-saved rankings into DEFAULT_POWER_RANKINGS (so every visitor sees them)
export function exportPowerRankings(year) {
  return JSON.stringify(getPowerRankings(year), null, 2);
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
