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

// Pist kartları (formula1.com/en/racing/2026) — circuitId -> kart slug
const TRACK_CARD = {
  albert_park: "australia", shanghai: "china", suzuka: "japan", miami: "miami",
  villeneuve: "canada", monaco: "monaco", catalunya: "spain", red_bull_ring: "austria",
  silverstone: "great-britain", spa: "belgium", hungaroring: "hungary",
  zandvoort: "netherlands", monza: "italy", madring: "spain", baku: "azerbaijan",
  sepang: "bahrain", marina_bay: "singapore", americas: "united-states",
  rodriguez: "mexico", interlagos: "brazil", vegas: "las-vegas",
  losail: "qatar", yas_marina: "abu-dhabi",
};

export function trackCardPhoto(circuitId) {
  const s = TRACK_CARD[circuitId];
  if (!s) return null;
  return `${IMG}/c_lfill,w_720/q_auto/${VER}/fom-website/static-assets/2026/races/card/${s}.webp`;
}

export function teamColor(constructorId) {
  return (TEAM_META[constructorId] || {}).color || "#e10600";
}

// Eski sezon görselleri: Ergast'ın verdiği Wikipedia linkinden küçük resim.
// (Pilot portresi, pist haritası, takım görseli — ne varsa makalenin ana görseli.)
const wikiCache = new Map(); // title -> Promise<string|null>

export function wikiTitle(url) {
  if (!url) return null;
  const m = String(url).match(/wikipedia\.org\/wiki\/([^#?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function fetchWikiThumb(title) {
  if (wikiCache.has(title)) return wikiCache.get(title);
  const p = (async () => {
    try {
      const api = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&format=json&pithumbsize=400&redirects=1&origin=*&titles=${encodeURIComponent(title)}`;
      const res = await fetch(api);
      if (!res.ok) return null;
      const json = await res.json();
      const pages = (json.query && json.query.pages) || {};
      for (const k of Object.keys(pages)) {
        const th = pages[k].thumbnail;
        if (th && th.source) return th.source;
      }
      return null;
    } catch {
      return null;
    }
  })();
  wikiCache.set(title, p);
  return p;
}

export function wikiImg(url, cls, alt = "") {
  const t = wikiTitle(url);
  if (!t) return "";
  return `<img data-wiki="${encodeURIComponent(t)}" class="${cls} wiload" alt="${String(alt).replace(/"/g, "")}" loading="lazy" />`;
}

// render sonrası çağır: bekleyen img[data-wiki] kutularını doldurur (bulunamazsa gizler)
export async function hydrateWiki(root) {
  const imgs = [...(root || document).querySelectorAll("img[data-wiki]")];
  if (!imgs.length) return;
  const byTitle = new Map();
  for (const im of imgs) {
    const t = decodeURIComponent(im.dataset.wiki);
    if (!byTitle.has(t)) byTitle.set(t, []);
    byTitle.get(t).push(im);
  }
  await Promise.all([...byTitle.entries()].map(async ([t, list]) => {
    const src = await fetchWikiThumb(t);
    for (const im of list) {
      if (!im.isConnected) continue;
      if (src) { im.src = src; im.classList.remove("wiload"); }
      else im.remove();
    }
  }));
}

// <img> hata verirse sessizce gizle (foto yoksa tablo bozulmasın)
export function imgTag(src, alt, cls) {
  if (!src) return "";
  const safe = alt.replace(/"/g, "");
  return `<img class="${cls}" src="${src}" alt="${safe}" loading="lazy" onerror="this.remove()" />`;
}
