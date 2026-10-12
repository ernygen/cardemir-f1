import { DATA_SOURCE } from "./config.js";
import * as excel from "./providers/excelProvider.js";
import * as f1api from "./providers/f1ApiProvider.js";

const provider = DATA_SOURCE === "f1api" ? f1api : excel;

const $ = (id) => document.getElementById(id);
let DATA = null;
let MODE = "drivers"; // drivers | teams

function fmt(v) {
  if (v === null || v === undefined || v === "") return "<span class='pill'>–</span>";
  if (typeof v === "number") return `<span class="pill">${v}</span>`;
  const cls = String(v).toUpperCase();
  return `<span class="pill ${cls.toLowerCase()}">${v}</span>`;
}

function fillRaces() {
  const sel = $("raceFilter");
  sel.innerHTML = `<option value="">Tüm sezon (toplam puan)</option>` +
    DATA.races.map((r) => `<option value="${r}">${r}</option>`).join("");
}

function render() {
  const q = $("search").value.toLocaleLowerCase("tr");
  const race = $("raceFilter").value;
  const isDrivers = MODE === "drivers";
  const rows = (isDrivers ? provider.getDriverStandings(DATA) : provider.getTeamStandings(DATA))
    .filter((x) => x.name.toLocaleLowerCase("tr").includes(q));

  $("headRow").innerHTML = isDrivers
    ? `<th class="pos">#</th><th>Pilot</th><th>No</th><th>${race || "Toplam"}</th><th>Toplam</th>`
    : `<th class="pos">#</th><th>Takım</th><th>${race || "Toplam"}</th><th>Toplam</th>`;

  $("bodyRows").innerHTML = rows.map((x, i) => {
    const val = race ? x.results[race] : x.total;
    return isDrivers
      ? `<tr><td class="pos">${i + 1}</td><td>${x.name}</td><td>${x.number ?? "–"}</td><td>${fmt(val)}</td><td class="pts">${x.total}</td></tr>`
      : `<tr><td class="pos">${i + 1}</td><td>${x.name}</td><td>${fmt(val)}</td><td class="pts">${x.total}</td></tr>`;
  }).join("") || `<tr><td colspan="5">Sonuç yok</td></tr>`;

  $("statLine").textContent = `${rows.length} ${isDrivers ? "pilot" : "takım"} • ${DATA.races.length} yarış`;
  $("updated").textContent = `Kaynak: ${DATA.source} • ${DATA.generatedAt}`;
  $("sourceBadge").textContent = DATA.source.startsWith("excel") ? "EXCEL" : "F1 API";
}

async function boot() {
  try {
    DATA = await provider.loadData();
    fillRaces();
    render();
  } catch (e) {
    $("statLine").textContent = "Hata: " + e.message + " (python -m http.server ile açman gerekir, dosyaya çift tıklayınca fetch çalışmaz)";
  }
}

$("tabDrivers").onclick = () => { MODE = "drivers"; $("tabDrivers").classList.add("active"); $("tabTeams").classList.remove("active"); render(); };
$("tabTeams").onclick = () => { MODE = "teams"; $("tabTeams").classList.add("active"); $("tabDrivers").classList.remove("active"); render(); };
$("search").oninput = render;
$("raceFilter").onchange = render;
$("refresh").onclick = boot;
boot();
