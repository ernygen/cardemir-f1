// Excel provider: data.json dosyasını okur.
// data.json, excel_to_json.py ile F126.xlsx dosyasından üretilir.
export async function loadData() {
  const res = await fetch("./data.json");
  if (!res.ok) throw new Error("data.json yüklenemedi");
  return res.json();
}

export function getDriverStandings(data) {
  return [...data.drivers].sort((a, b) => b.total - a.total);
}

export function getTeamStandings(data) {
  return [...data.teams].sort((a, b) => b.total - a.total);
}

export function getRaceResult(data, race, type = "drivers") {
  const list = type === "drivers" ? data.drivers : data.teams;
  return list
    .map((x) => ({ name: x.name, number: x.number, value: x.results[race] ?? null, total: x.total }))
    .sort((a, b) => (typeof b.value === "number" ? b.value : -1) - (typeof a.value === "number" ? a.value : -1));
}
