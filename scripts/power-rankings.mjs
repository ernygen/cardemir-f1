// Power Rankings bot: finds formula1.com's "POWER RANKINGS" articles and adds each new Grand Prix's
// top-10 ORDER to powerData.js. Scores live only in an image on F1's page, so they are added by hand.
// Never touches a round that is already in powerData.js. Run: node scripts/power-rankings.mjs
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const F1 = "https://www.formula1.com";
const TAG = `${F1}/en/latest/tags/power-rankings.699Peq5SC9zNGvwCkb1ln6`;
const JOLPICA = "https://api.jolpi.ca/ergast/f1";
const DATA_FILE = fileURLToPath(new URL("../powerData.js", import.meta.url));
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; cardemir-f1-bot)", Accept: "text/html,application/json" };

const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Article HTML → { published: "YYYY-MM-DD", codes: ["NOR", …] } in ranking order.
// Each driver section starts with an image (PR_<CODE>_<RACE>.webp); when the file is named otherwise,
// the first season driver whose surname appears in the section text is taken; failing both, "???".
export function parseArticle(html, roster) {
  const s = html.replace(/\\"/g, '"');
  const published = (s.match(/"datePublished":"(\d{4}-\d{2}-\d{2})/) || [])[1] || null;
  const sections = [];
  const seen = new Set();
  const re = /"src":"[^"]*?Power%20Rankings%20\d{4}\/[^"\/]+\/([^"\/]+)\.webp"|"text":"([^"]*)"/g;
  let cur = null;
  for (let m; (m = re.exec(s));) {
    if (m[1] !== undefined) {
      const file = decodeURIComponent(m[1]);
      cur = null;
      if (/overall|header|hero/i.test(file) || seen.has(file)) continue;
      seen.add(file);
      cur = { file, text: null };
      sections.push(cur);
    } else if (cur && cur.text === null) {
      cur.text = fold(m[2]);
    }
  }
  const firstNamed = (text) => {
    let best = null, at = Infinity;
    for (const d of roster) {
      const i = text ? text.search(new RegExp(`\\b${fold(d.familyName).replace(/[^a-z ]/g, ".")}\\b`)) : -1;
      if (i >= 0 && i < at) { at = i; best = d.code; }
    }
    return best;
  };
  const codes = sections.map(({ file, text }) => (file.match(/^PR_([A-Z]{3})_/i) || [])[1]?.toUpperCase() || firstNamed(text) || "???");
  return { published, codes };
}

// The Grand Prix an article covers: the last round raced on or before its publish date.
export function roundForDate(schedule, date) {
  const past = schedule.filter((r) => r.date <= date);
  return past.length ? past[past.length - 1].round : null;
}

// powerData.js source: one "CODE score,CODE score" line per round, sorted.
export function renderData(data) {
  const years = Object.keys(data).sort();
  const body = years.map((y) => {
    const rounds = Object.keys(data[y]).map(Number).sort((a, b) => a - b);
    return `  ${y}: {\n${rounds.map((r) => `    ${r}: ${JSON.stringify(data[y][r])},`).join("\n")}\n  },`;
  }).join("\n");
  return `// Aramco Power Rankings per Grand Prix: "CODE score,CODE score,…" in ranking order.
// New rounds are added by scripts/power-rankings.mjs (GitHub Actions) with codes only:
// add the judges' scores from the article's leaderboard image by editing the line ("NOR,VER" → "NOR 9.8,VER 9.6").
export default {
${body}
};
`;
}

async function get(url, json = false) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return json ? res.json() : res.text();
}

async function main() {
  const data = (await import(pathToFileURL(DATA_FILE).href + `?t=${Date.now()}`)).default;
  const year = String(new Date().getUTCFullYear());
  const schedule = (await get(`${JOLPICA}/${year}.json`, true)).MRData.RaceTable.Races.map((r) => ({ round: Number(r.round), date: r.date }));
  const roster = (await get(`${JOLPICA}/${year}/drivers.json?limit=100`, true)).MRData.DriverTable.Drivers.map((d) => ({ code: d.code, familyName: d.familyName }));
  const links = [...new Set((await get(TAG)).match(/\/en\/latest\/article\/power-rankings-[a-z0-9-]+\.[A-Za-z0-9]+/g) || [])].slice(0, 6);
  if (!links.length) throw new Error("No Power Rankings articles found on the tag page — page layout changed?");
  data[year] = data[year] || {};
  const added = [];
  for (const link of links) {
    const a = parseArticle(await get(F1 + link), roster);
    if (!a.published || !a.published.startsWith(year)) continue;
    const round = roundForDate(schedule, a.published);
    if (!round || data[year][round]) continue;
    if (a.codes.length < 5) throw new Error(`Only ${a.codes.length} drivers parsed from ${link} — page layout changed?`);
    data[year][round] = a.codes.join(",");
    added.push(`R${round}: ${data[year][round]}`);
  }
  if (!added.length) return console.log("No new Power Rankings.");
  fs.writeFileSync(DATA_FILE, renderData(data));
  console.log("Added:\n" + added.join("\n"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
