# Cardemir F1 🏁

Custom F1 championships on live data. Site: **https://ernygen.github.io/cardemir-f1/**

The Excel file (`F126.xlsx`) is concept only — no data is taken from it.

## Tabs

- **Tracks** — F1-style 3-column track cards (click a card for round detail)
- **Drivers' / Constructors' Championship** — real points, last race on the left, full table with position arrows (▲▼) on the right
- **Grid / Race** — starting grid → race result matrix with AVG Q / AVG R columns
- **Position Gain (PG)** — grid − finish; **PGNN** counts negatives as 0
- **Position Gaining Championship (PGC)** — top 10 gainers per event score 25-18-15…; ties split slot points
- **Position Gaining No Split (PGNS)** — straight positional points, no split
- **Reverse Championship** — classified finishers scored back-to-front (last gets 25), no DNFs
- **History** — champions of any season 1950–2026 + who-won-where table
- **Bingo** — WC event cards (click to mark, stored in browser)

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

## Notes

- Pit-lane starters count from the back in gain math.
- Sprint events award 8-7-…-1 in PGC/PGNS/Reverse (25-scale for GPs).
- Lapped cars (`+N Laps`) count as classified in old seasons.

---

Built together with **OpenCode (Muse Spark)** — from Eren's Excel concept to a live F1 site. 🤖
