// Fotoğraflar © Formula One (media.formula1.com üzerinden hotlink).
// 2026 sezonu içindir; başka sezonda fotoğraf gösterilmez.
const IMG = "https://media.formula1.com/image/upload";
const VER = "v1740000001";

// constructorId (Jolpica) -> F1 slug + resmi takım rengi (OpenF1 team_colour)
export const TEAM_META = {
  mercedes:     { slug: "mercedes",      color: "#00D7B6" },
  ferrari:      { slug: "ferrari",       color: "#ED1131" },
  mclaren:      { slug: "mclaren",       color: "#F47600" },
  red_bull:     { slug: "redbullracing", color: "#4781D7" },
  rb:           { slug: "racingbulls",   color: "#6C98FF" },
  alpine:       { slug: "alpine",        color: "#00A1E8" },
  haas:         { slug: "haasf1team",    color: "#9C9FA2" },
  audi:         { slug: "audi",          color: "#F50537" },
  williams:     { slug: "williams",      color: "#1868DB" },
  aston_martin: { slug: "astonmartin",   color: "#229971" },
  cadillac:     { slug: "cadillac",      color: "#909090" },
};

// pilot kodu -> [takım slug, pilot slug] (formula1.com/en/drivers 2026)
const DRIVER_SLUG = {
  RUS: ["mercedes", "georus"], ANT: ["mercedes", "andant"],
  LEC: ["ferrari", "chalec"], HAM: ["ferrari", "lewham"],
  NOR: ["mclaren", "lannor"], PIA: ["mclaren", "oscpia"],
  VER: ["redbullracing", "maxver"], HAD: ["redbullracing", "isahad"],
  LAW: ["racingbulls", "lialaw"], LIN: ["racingbulls", "arvlin"],
  GAS: ["alpine", "piegas"], COL: ["alpine", "fracol"],
  OCO: ["haasf1team", "estoco"], BEA: ["haasf1team", "olibea"],
  HUL: ["audi", "nichul"], BOR: ["audi", "gabbor"],
  SAI: ["williams", "carsai"], ALB: ["williams", "alealb"],
  ALO: ["astonmartin", "feralo"], STR: ["astonmartin", "lanstr"],
  PER: ["cadillac", "serper"], BOT: ["cadillac", "valbot"],
};

export function driverPhoto(code) {
  const s = DRIVER_SLUG[code];
  if (!s) return null;
  const [team, drv] = s;
  return `${IMG}/c_lfill,w_440/q_auto/d_common:f1:2026:fallback:driver:2026fallbackdriverright.webp/${VER}/common/f1/2026/${team}/${drv}01/2026${team}${drv}01right.webp`;
}

export function teamCarPhoto(constructorId) {
  const m = TEAM_META[constructorId];
  if (!m) return null;
  return `${IMG}/c_lfill,w_320/q_auto/d_common:f1:2026:fallback:car:2026fallbackcarright.webp/${VER}/common/f1/2026/${m.slug}/2026${m.slug}carright.webp`;
}

export function teamLogo(constructorId) {
  const m = TEAM_META[constructorId];
  if (!m) return null;
  return `${IMG}/c_lfill,w_200/q_auto/${VER}/common/f1/2026/${m.slug}/2026${m.slug}logo.webp`;
}

export function teamColor(constructorId) {
  return (TEAM_META[constructorId] || {}).color || "#e10600";
}

// <img> hata verirse sessizce gizle (foto yoksa tablo bozulmasın)
export function imgTag(src, alt, cls) {
  if (!src) return "";
  const safe = alt.replace(/"/g, "");
  return `<img class="${cls}" src="${src}" alt="${safe}" loading="lazy" onerror="this.remove()" />`;
}
