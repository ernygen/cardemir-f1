// F1 API provider (HAZIR İSKELET — yarın devreye alınacak).
// Arayüz excelProvider.js ile BİREBİR aynı olmalı: loadData, getDriverStandings, getTeamStandings, getRaceResult.
// Şu an örnek olarak Jolpica F1 API (Ergast devamı) kullanılıyor.
//
// Geçiş adımları:
//  1. config.js içinde DATA_SOURCE = "f1api" yap
//  2. Aşağıdaki loadData içini gerçek API'ye bağla
//  3. Excel kolon isimlerin (AUS, CHN...) ile API pist kodlarını eşleştir (mapping tablosu)

const JOLPICA = "https://api.jolpi.ca/ergast/f1";

// Excel'deki kısa kod -> API'deki round no (2026 sezonu örneği, kendi takvimine göre düzelt)
const RACE_MAP = {
  AUS: 1, CHN: 2, JPN: 3, BAH: 4, MIA: 6, CAN: 9, MON: 10,
  // ... geri kalanını takvimine göre ekle
};

export async function loadData() {
  // ÖRNEK: 2026 pilot klasmanı (Jolpica formatı)
  // const res = await fetch(`${JOLPICA}/2026/driverStandings.json`);
  // const json = await res.json();
  // const rows = json.MRData.StandingsTable.StandingsLists[0].DriverStandings;
  // return {
  //   source: "f1api:jolpica",
  //   generatedAt: new Date().toISOString(),
  //   races: Object.keys(RACE_MAP),
  //   teamRaces: Object.keys(RACE_MAP),
  //   drivers: rows.map(d => ({
  //     number: d.Driver.permanentNumber,
  //     name: `${d.Driver.givenName} ${d.Driver.familyName}`,
  //     results: {},      // istersen round bazında doldur
  //     total: Number(d.points),
  //   })),
  //   teams: [],          // constructorStandings.json ile doldur
  // };
  throw new Error("f1ApiProvider henüz bağlanmadı — config.js içinde DATA_SOURCE='excel' olarak bırak.");
}

export function getDriverStandings(data) {
  return [...data.drivers].sort((a, b) => b.total - a.total);
}

export function getTeamStandings(data) {
  return [...data.teams].sort((a, b) => b.total - a.total);
}

export function getRaceResult(data, race, type = "drivers") {
  const list = type === "drivers" ? data.drivers : data.teams;
  return list.map((x) => ({ name: x.name, number: x.number, value: x.results[race] ?? null, total: x.total }));
}
