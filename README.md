# Cardemir F1 🏁

Custom F1 championships on live data. Site: **https://ernygen.github.io/cardemir-f1/**

The Excel file (`F126.xlsx`) is concept only — no data is taken from it.

## Tabs

- **Tracks** — F1-style 3-column track cards (click a card for round detail)
- **Drivers' / Constructors' Championship** — real points, last race on the left, full table with position arrows (▲▼) on the right; while a season runs, the drivers' tab shows the title/P2/P3 battles and hovering a position number highlights who can still finish there
- **Grid / Race** — starting grid → race result matrix with AVG Q / AVG R columns
- **Position Gain (PG)** — grid − finish; **PGNN** counts negatives as 0
- **Position Gaining Championship (PGC)** — top 10 gainers per event score 25-18-15…; ties split slot points
- **Position Gaining No Split (PGNS)** — straight positional points, no split
- **Reverse Championship** — classified finishers scored back-to-front (last gets 25), no DNFs
- **Power Rankings** — 25-1 points awarded based on Aramco Power Rankings order per Grand Prix (see below)
- **History** — champions of any season 1950–2026 + who-won-where table

One **Position Gain** tab hosts PG / PGNN / PGC / PGNS via the championship selector up top.

## Data & images

- Data: [Jolpica F1 API](https://api.jolpi.ca/ergast/f1/) (live calendar + results, incl. sprints)
- Images & fonts: © Formula One (`media.formula1.com`, hotlink, 2026 season)
- Older seasons: Wikipedia article images (driver portraits, race photos, team logos)
- Team colours: OpenF1 `team_colour`

## Run locally

```bash
python -m http.server 8000
# http://localhost:8000
```

Tests (Node 20+, no dependencies): `node --test tests/`

## Power Rankings data

- Data lives in `powerData.js`, one line per Grand Prix: `20: "NOR 9.8,VER 9.6,…"` in ranking order.
- A GitHub Action (`.github/workflows/power-rankings.yml`, Tue/Wed mornings, or "Run workflow" by hand) runs `scripts/power-rankings.mjs`: it finds formula1.com's newest "POWER RANKINGS" articles and adds any new round **with codes only** (`"NOR,VER,…"`). It never changes a round that is already there. A driver it can't identify shows as `???`.
- F1 publishes the scores only as an image, so add them by hand: edit the line on GitHub (`NOR,VER` → `NOR 9.8,VER 9.6`).
- The in-page editor is hidden for visitors; open the site once with `#admin` to show it in your browser (`#noadmin` hides it). It saves to that browser only; "Copy line for powerData.js" gives the line to paste into the repo.

Deploying: bump every `?v=N` together (index.html, imports in app.js and providers/f1ApiProvider.js), or visitors may mix cached old modules with new ones.

## Notes

- Pit-lane starters count from the back in gain math.
- Sprint events award 8-7-…-1 in PGC/PGNS/Reverse (25-scale for GPs).
- Lapped cars (`+N Laps`) count as classified in old seasons.

---

Built together with **OpenCode (Muse Spark)** — from Eren's Excel concept to a live F1 site. 🤖
