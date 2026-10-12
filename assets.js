// Pilot portreleri her yıl Wikipedia'dan.
// Takım logosu/arabası 2026'da F1 CDN, eski yıllarda Wikipedia.
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
// Pilot: portre, pist: yarış/harita fotoğrafı, takım: logo (bulunamazsa makale görseli).
const wikiCache = new Map(); // key -> Promise<string|null>

export function wikiTitle(url) {
  if (!url) return null;
  const m = String(url).match(/wikipedia\.org\/wiki\/([^#?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function wikiApi(params) {
  const q = new URLSearchParams({ action: "query", format: "json", redirects: 1, origin: "*", ...params });
  const res = await fetch(`https://en.wikipedia.org/w/api.php?${q}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json.query || null;
}

function cached(key, fn) {
  if (!wikiCache.has(key)) wikiCache.set(key, fn().catch(() => null));
  return wikiCache.get(key);
}

// Makalenin ana görseli
export function wikiPageThumb(title) {
  return cached("p:" + title, async () => {
    const q = await wikiApi({ prop: "pageimages", pithumbsize: 400, titles: title });
    if (!q) return null;
    for (const k of Object.keys(q.pages)) {
      const th = q.pages[k].thumbnail;
      if (th && th.source) return th.source;
    }
    return null;
  });
}

// Takım logosu: sayfadaki logo dosyası, yoksa ana görsel
export function wikiLogoThumb(articleUrl) {
  const title = wikiTitle(articleUrl);
  if (!title) return Promise.resolve(null);
  return cached("l:" + title, async () => {
    const q = await wikiApi({ prop: "images", imlimit: 100, titles: title });
    if (q) {
      for (const k of Object.keys(q.pages)) {
        const imgs = (q.pages[k].images || [])
          .map((im) => im.title)
          .filter((t) => /logo/i.test(t) && !/commons-logo/i.test(t) && /\.(svg|png|jpg|jpeg|gif)$/i.test(t));
        if (imgs.length) {
          const ii = await wikiApi({ prop: "imageinfo", iiprop: "url", iiurlwidth: 300, titles: imgs[0] });
          if (ii) {
            for (const kk of Object.keys(ii.pages)) {
              const info = (ii.pages[kk].imageinfo || [])[0];
              if (info && info.thumburl) return info.thumburl;
              if (info && info.url) return info.url;
            }
          }
        }
      }
    }
    return wikiPageThumb(title);
  });
}

export function wikiImg(url, cls, alt = "") {
  const t = wikiTitle(url);
  if (!t) return "";
  return `<img data-wiki="${encodeURIComponent(t)}" class="${cls} wiload" alt="${String(alt).replace(/"/g, "")}" loading="lazy" />`;
}

export function wikiLogoImg(articleUrl, cls, alt = "") {
  const t = wikiTitle(articleUrl);
  if (!t) return "";
  return `<img data-wikilogo="${encodeURIComponent(t)}" class="${cls} wiload" alt="${String(alt).replace(/"/g, "")}" loading="lazy" />`;
}

export function wikiGpImg(season, raceName, fallbackUrl, cls, alt = "") {
  const specific = `${season} ${raceName || ""}`.trim().replace(/\s+/g, "_");
  const generic = String(raceName || "").trim().replace(/\s+/g, "_");
  if (!generic) return "";
  const fb = wikiTitle(fallbackUrl);
  const f = fb ? ` data-wikifb="${encodeURIComponent(fb)}"` : "";
  return `<img data-wikigp="${encodeURIComponent(specific)}" data-wikigp2="${encodeURIComponent(generic)}"${f} class="${cls} wiload" alt="${String(alt).replace(/"/g, "")}" loading="lazy" />`;
}

function fill(imgs, src) {
  for (const im of imgs) {
    if (!im.isConnected) continue;
    if (src) { im.src = src; im.classList.remove("wiload"); }
    else im.remove();
  }
}

// render sonrası çağır: bekleyen wiki kutularını doldurur (bulunamazsa gizler)
export async function hydrateWiki(root) {
  const doc = root || document;
  const jobs = [];
  const groups = new Map();
  for (const im of doc.querySelectorAll("img[data-wiki]")) {
    const t = decodeURIComponent(im.dataset.wiki);
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t).push(im);
  }
  for (const [t, list] of groups) jobs.push(wikiPageThumb(t).then((s) => fill(list, s)));
  const logos = new Map();
  for (const im of doc.querySelectorAll("img[data-wikilogo]")) {
    const t = decodeURIComponent(im.dataset.wikilogo);
    if (!logos.has(t)) logos.set(t, []);
    logos.get(t).push(im);
  }
  for (const [t, list] of logos) {
    jobs.push((async () => {
      const art = `https://en.wikipedia.org/wiki/${t}`;
      fill(list, await wikiLogoThumb(art));
    })());
  }
  for (const im of doc.querySelectorAll("img[data-wikigp]")) {
    const t = decodeURIComponent(im.dataset.wikigp);
    const t2 = im.dataset.wikigp2 ? decodeURIComponent(im.dataset.wikigp2) : null;
    const fb = im.dataset.wikifb ? decodeURIComponent(im.dataset.wikifb) : null;
    jobs.push((async () => {
      fill([im], (await wikiPageThumb(t)) || (t2 ? await wikiPageThumb(t2) : null) || (fb ? await wikiPageThumb(fb) : null));
    })());
  }
  if (jobs.length) await Promise.all(jobs);
}

// <img> hata verirse sessizce gizle (foto yoksa tablo bozulmasın)
export function imgTag(src, alt, cls) {
  if (!src) return "";
  const safe = alt.replace(/"/g, "");
  return `<img class="${cls}" src="${src}" alt="${safe}" loading="lazy" onerror="this.remove()" />`;
}
