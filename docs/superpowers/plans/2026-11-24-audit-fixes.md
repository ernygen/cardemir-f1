# Denetim Düzeltmeleri — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Amaç:** 2026-11-24 denetimindeki 11 bulgunun hepsini düzeltmek, puan matematiğini testlerle sabitlemek.

**Mimari:** Build yok, framework yok: tarayıcıda doğrudan çalışan ES modülleri (GitHub Pages). Testler Node'un yerleşik `node:test` + `node:assert` modülleriyle, bağımlılık eklenmeden. Saf hesaplama fonksiyonları (`computeRound`, `computeTable`, `tableWithChanges`, `applyOfficialStandings`, `powerRankings.js`) test edilir; DOM kodu tarayıcıda elle doğrulanır.

**Teknoloji:** Vanilla JS (ES modules), Jolpica F1 API, Node 20 (`node --test`).

**Spec:** Bu konuşmadaki denetim raporu (bulgular 1–11). Bulgu numaraları aşağıda `[#N]` olarak geçer.

## Global Kısıtlar

- Yeni bağımlılık yok, `package.json` yok. Testler: `node --test tests/`.
- Node 20'de `localStorage` yoktur; `powerRankings.js` içindeki `typeof localStorage === "undefined"` korumaları kalmalı (testler buna dayanır).
- Arayüz metinleri mevcut dilinde kalır (Power editörü Türkçe, geri kalan İngilizce). Dil birliği UI/UX çalışmasına bırakıldı.
- Cache sürümü bu iş bitince `v=9` olur; tüm import'larda aynı yazım kullanılır (Görev 7).
- Her görev kendi commit'iyle biter; commit mesajı `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` ile biter.

## Review Focus

1. **Diskalifiye edilen pilot (1997 Schumacher):** resmi sıralamada `position` alanı olmayabilir → bu pilot listenin sonuna gitmeli, çökme olmamalı. (Görev 2 testi)
2. **1958 öncesi sezon:** `constructorStandings` boş liste döner → History'de takım şampiyonu "—", Constructors sekmesi ham toplamla çalışmaya devam eder. (Görev 2 testi)
3. **Standings isteği başarısız (429/timeout):** sezon yine yüklenmeli, sadece ham toplam kullanılmalı. (Görev 2: `.catch(() => null)`)
4. **50'li yıllarda 30'dan fazla pilot:** standings varsayılan `limit=30` keser → `?limit=100` ile istenmeli. (Görev 2)
5. **Power notu girilmiş yarış sayısı 0 veya 1:** oklar `NEW` gösterir, çökme olmaz. (Görev 4 testi)

---

## Dosya Haritası

| Dosya | Sorumluluk | Görevler |
|---|---|---|
| `tests/core.test.mjs` (yeni) | Tüm saf-fonksiyon testleri | 1–5 |
| `providers/f1ApiProvider.js` | API, puan hesaplama, tablolar | 1, 2, 4, 6 |
| `powerRankings.js` | Power notlarının saklanması/ayrıştırılması | 3, 5, 6 |
| `app.js` | DOM / render | 2, 5, 6, 7 |
| `assets.js` | Görsel URL'leri | 6 |
| `index.html` | Sayfa iskeleti, cache sürümü | 7 |

---

### Task 1: Test altyapısı + `computeRound` testleri [#6]

**Dosyalar:**
- Oluştur: `tests/core.test.mjs`
- Değiştir: `providers/f1ApiProvider.js:75` (`computeRound`'u export et)

**Arayüzler:**
- Üretir: `export function computeRound(roundNo, name, date, rows, sprint = false, qualiRows = [])` — `year` parametresi silinir (kullanılmıyor), çağıran iki yer ([f1ApiProvider.js:176](../../../providers/f1ApiProvider.js), :185) güncellenir.
- Üretir: test yardımcısı `row(id, grid, pos, status = "Finished", points = 0)` → Jolpica `Results` satırı biçiminde nesne (`{ grid, position, status, points, Driver: { driverId: id, code: id.toUpperCase().slice(0,3), givenName: id, familyName: id }, Constructor: { constructorId: "t_"+id, name: "T"+id } }`). Sonraki görevlerin testleri de bunu kullanır.

- [ ] **Adım 1: Başarısız testleri yaz** (`tests/core.test.mjs`, `node:test` + `node:assert/strict`)
  - `PGC split: tied gains share slot points` — 4 pilot: a grid 4→P1 (+3), b grid 3→P2 (+1), c grid 2→P3 (−1), d grid 5→P4 (+1). Beklenen: `pgcSplit.get("a") === 25`, `pgcSplit.get("b") === 16.5`, `pgcSplit.get("d") === 16.5`, `pgcSplit.get("c") === 12`.
  - `PGNS: no split, tie broken by finish` — aynı veri: `pgns.get("b") === 18`, `pgns.get("d") === 15`.
  - `pit lane start counts from the back` — grid `"0"` olan pilot, en büyük grid+1'den başlamış sayılır: grid 0 → P1, diğer en büyük grid 3 ise `gain === 3`.
  - `reverse: last classified gets 25, DNF excluded` — 3 classified + 1 `"Accident"`: son classified `ters.get(...) === 25`, DNF `ters.has(...) === false`.
  - `sprint uses 8-point scale` — `sprint=true` ile en iyi kazanan `pgcSplit === 8`.
  - `+1 Lap counts as classified` — status `"+1 Lap"` → `classified === true`.

- [ ] **Adım 2: Çalıştır, başarısız olduğunu gör**
  Çalıştır: `node --test tests/`
  Beklenen: FAIL — `computeRound` export edilmediği için import hatası.

- [ ] **Adım 3: `computeRound`'u export et, `year` parametresini sil.**

- [ ] **Adım 4: Çalıştır, geçtiğini gör**
  Çalıştır: `node --test tests/` → tüm testler PASS. (Mevcut matematik doğruysa ek kod değişikliği gerekmez; bir test kırılırsa önce testin beklentisini bu dosyadaki kurala göre kontrol et, sonra kodu düzelt.)

- [ ] **Adım 5: Commit** — `test: add node:test suite for computeRound`

---

### Task 2: Resmi şampiyonluk sıralaması [#1]

**Dosyalar:**
- Değiştir: `providers/f1ApiProvider.js` (`loadSeason`, `computeTable`, `getChampions`)
- Test: `tests/core.test.mjs`

**Arayüzler:**
- Tüketir: Görev 1'deki `row()` yardımcısı.
- Üretir: `export function applyOfficialStandings(data, driverJson, teamJson)` — API JSON'larından `data.official = { drivers: Map<driverId, {pos, points, wins}>, teams: Map<constructorId, {pos, points, wins}> }` kurar. JSON `null` ise veya `StandingsLists` boşsa ilgili Map **boş** olur. `position` yoksa `pos = Infinity`.
- Üretir: `computeTable(..., { metric: "real", upto: Infinity })` — `data.official` ilgili Map'i doluysa: her satırın `value`'su resmi `points`, `wins` resmi `wins`; sıralama `pos` artan. Map'te olmayan satırlar ham değerleriyle en sona. `upto` sonlu ise (önceki yarış karşılaştırması) değişiklik yok.
- Üretir: `getChampions(data).team` — `data.official.teams` boşsa `null`.

- [ ] **Adım 1: Başarısız testleri yaz**
  - `official standings override raw sum (1988 case)` — iki pilot, ham toplamda `prost` önde; resmi JSON'da `senna` pos 1 / 90 puan, `prost` pos 2 / 87. Beklenen: `computeTable(d,{metric:"real"})[0].id === "senna"`, `.value === 90`; `getChampions(d).driver.id === "senna"`.
  - `disqualified driver without position goes last` — resmi JSON'da bir pilotun `position` alanı yok (sadece `positionText: "D"`) → sonuncu sırada, hata yok.
  - `no constructors championship before 1958` — takım JSON'u `StandingsLists: []` → `getChampions(d).team === null`; `computeTable(d,{who:"teams",metric:"real"})` ham toplamla dolu liste döner.
  - `finite upto ignores official` — `computeTable(d,{metric:"real",upto: <ilk etkinlik seq>})` ham değer döner.

- [ ] **Adım 2: Çalıştır** → FAIL (`applyOfficialStandings` yok).

- [ ] **Adım 3: Uygula**
  - `applyOfficialStandings` yukarıdaki sözleşmeyle.
  - `loadSeason` içindeki `Promise.all`'a ekle: `fetchJson(`/${year}/driverStandings.json?limit=100`).catch(() => null)` ve `constructorStandings.json?limit=100` aynı şekilde; sonra `applyOfficialStandings(res, dj, tj)`.
  - `computeTable`: `metric === "real" && upto === Infinity` için sıralama dalını yukarıdaki kurala göre ekle (sürücü ve takım yolları).
  - `getChampions`: takım için `data.official?.teams.size ? cw : null`.
  - `app.js` History kartı zaten `c.team` null'ını "—" ile karşılıyor ([app.js:452-455](../../../app.js)); değişiklik gerekmez, tarayıcıda doğrula.

- [ ] **Adım 4: Çalıştır** → PASS.

- [ ] **Adım 5: Tarayıcıda doğrula** — `python -m http.server 8000`, sezon 1988 → History: Senna 90; sezon 1955 → Constructors' Champion "—"; sezon 1997 → Villeneuve şampiyon, sayfa çökmez.

- [ ] **Adım 6: Commit** — `fix: use official standings for champions and final tables`

---

### Task 3: Power Rankings saklama — temizleme + dışa aktarma + veri taşıma [#2, #3]

**Dosyalar:**
- Değiştir: `powerRankings.js:74-84` (`clearRoundPowerRankings`), `powerRankings.js:18-45` (`DEFAULT_POWER_RANKINGS`)
- Değiştir: `app.js` (editöre "Dışa aktar" butonu)
- Test: `tests/core.test.mjs`

**Arayüzler:**
- Üretir: `clearRoundPowerRankings(year, round)` → kaydı silmez, `current[round] = []` yazar (boş liste varsayılanı ezer; `applyPowerRankings` boş listeyi zaten "veri yok" sayar).
- Üretir: `export function exportPowerRankings(year): string` → `JSON.stringify(getPowerRankings(year), null, 2)`.

- [ ] **Adım 1: Başarısız test yaz**
  - `clear hides a default round` — testin başında `globalThis.localStorage`'a basit bir Map-tabanlı sahte nesne ata (`getItem/setItem/removeItem`), sonunda `delete globalThis.localStorage`. `clearRoundPowerRankings("2026", 19)` sonrası `getPowerRankings("2026")[19]` → `[]` (uzunluk 0). `resetAllPowerRankings("2026")` sonrası R19 yine 10 elemanlı.

- [ ] **Adım 2: Çalıştır** → FAIL (R19 hâlâ 10 elemanlı).

- [ ] **Adım 3: `clearRoundPowerRankings`'i düzelt, `exportPowerRankings`'i ekle.**

- [ ] **Adım 4: Çalıştır** → PASS.

- [ ] **Adım 5: Editöre buton ekle** — `powerEditorHtml` içindeki `.powerActions`'a `<button id="prExportBtn" class="powerBtnSec">📋 JSON Kopyala</button>`; `initPowerEditor`'da tıklayınca `navigator.clipboard.writeText(exportPowerRankings(S.season))` ve `prStatusMsg`'a `"✓ Panoya kopyalandı"` (hata olursa `"Kopyalanamadı"`).

- [ ] **Adım 6: Mevcut veriyi taşı** — Kullanıcının Chrome'unda `https://ernygen.github.io/cardemir-f1/` açıkken `localStorage.getItem("cardemir_power_rankings_2026")` oku (Chrome eklentisi ile, sadece okuma). Bu nesneyi `DEFAULT_POWER_RANKINGS[2026]` içine yaz (mevcut R19/R20 ile birleşik). Biçim: `{ code, score }` — kayıttaki `id`/`name` alanları da kalabilir, `applyPowerRankings` hepsini çözüyor.

- [ ] **Adım 7: Tarayıcıda doğrula** — gizli pencerede (boş localStorage) Power sekmesi → tüm girilmiş yarışlar görünür; R19'da "Bu Turu Temizle" → R19 kaybolur; "Tümünü Sıfırla" → geri gelir.

- [ ] **Adım 8: Commit** — `fix: power rankings clear/export, ship saved rankings as defaults`

---

### Task 4: Power okları [#4]

**Dosyalar:**
- Değiştir: `providers/f1ApiProvider.js:426-437` (`tableWithChanges`)
- Test: `tests/core.test.mjs`

**Arayüzler:**
- Üretir: `tableWithChanges(data, opts)` — `opts.metric === "power"` ise karşılaştırma noktası, `powerList.length > 0` olan etkinliklerin sondan ikincisinin `seq`'idir. Böyle 2 etkinlik yoksa tüm satırlar `prev: null, diff: null`. Diğer metrikler değişmez.

- [ ] **Adım 1: Başarısız testler**
  - `power arrows skip events without rankings` — 3 GP: R1 ve R2 power notlu (R2'de sıralama değişiyor), R3 notsuz. Beklenen: en az bir satırda `diff !== 0`.
  - `power arrows with one ranked event` — sadece R1 notlu → tüm `diff === null`.
  (Veriyi `computeRound` + `applyPowerRankings`'e değil, doğrudan `events[i].powerList/power/powerWinner` alanlarını doldurarak kur.)

- [ ] **Adım 2: Çalıştır** → FAIL.
- [ ] **Adım 3: Uygula.**
- [ ] **Adım 4: Çalıştır** → PASS.
- [ ] **Adım 5: Commit** — `fix: power ranking arrows compare against previous ranked event`

---

### Task 5: `parsePowerInput` testleri + pilot eşleştirme sadeleştirmesi [#6, #11]

**Dosyalar:**
- Değiştir: `providers/f1ApiProvider.js:248-258`
- Test: `tests/core.test.mjs`

**Arayüzler:**
- Üretir (modül içi): `const sameDriver = (d, key) => d.code?.toUpperCase() === String(key).toUpperCase() || d.id?.toLowerCase() === String(key).toLowerCase()` — `applyPowerRankings` iki `find` çağrısında bunu kullanır.

- [ ] **Adım 1: Testler** (`parsePowerInput`, ikinci argüman: `[{id:"norris",code:"NOR",name:"Lando Norris"},{id:"hulkenberg",code:"HUL",name:"Nico Hülkenberg"}]`)
  - `"norris 9,8"` → `{id:"norris", score:9.8}`
  - `"1. Lando Norris 9.8"` → `id:"norris"`, `score:9.8`
  - `"HUL 8"` → `id:"hulkenberg"`
  - tekrar eden satır → tek kayıt (ilki kalır)
  - sonuç skora göre azalan sıralı
  - `calculatePowerPoints(3)` → `[25, 13, 1]`; `calculatePowerPoints(1)` → `[25]`
- [ ] **Adım 2: Çalıştır** → PASS beklenir (karakterizasyon testi; kırılırsa davranışı kullanıcıya sor, sessizce değiştirme).
- [ ] **Adım 3: `sameDriver`'ı ekle, iki `find`'ı ona çevir.**
- [ ] **Adım 4: Çalıştır** → tüm testler PASS.
- [ ] **Adım 5: Commit** — `test: pin power input parsing; dedupe driver lookup`

---

### Task 6: Ölü kod, tekrarlar, küçük UI hataları [#7, #8, #9, #10]

**Dosyalar:** `providers/f1ApiProvider.js`, `powerRankings.js`, `assets.js`, `app.js`

**Arayüzler:**
- Üretir (modül içi, `f1ApiProvider.js`): `function powerCmp(sort): (a, b) => number` — `"avg" | "score" | "pts"` için mevcut üç karşılaştırmanın aynısı; sürücü ve takım sıralamasında kullanılır.

- [ ] **Adım 1: Sil** [#7] — `POWER_POINTS` (`powerRankings.js:3`), `loadSeasonsList`, `getPG`, `getPGC`, `getTers`, `getTeamPGC`, `getTeamTers`, `getTeamStandings`, `hasDriver2026`, `driverPhoto2026`. `loadSeason`'daki toplama döngüsünü sadeleştir: `drivers` listesi yalnızca `{id, code, name, team, teamId}` tutar; `teams` Map'i ve `res.teams` tamamen silinir. Silmeden önce her isim için `grep -rn` ile kullanım olmadığını tekrar doğrula.
- [ ] **Adım 2: Birleştir** [#8] — `powerCmp(sort)` ile [f1ApiProvider.js:362-369](../../../providers/f1ApiProvider.js) ve :410-416'yı değiştir. `app.js` `drvResult` içindeki foto kopyasını (`app.js:154-157`) `photoFor(x, "dphoto sm")` çağrısıyla değiştir.
- [ ] **Adım 3: Editör turu** [#9] — `$("season").onchange` içinde `PR_SELECTED_ROUND = null`. `$("roundFilter").onchange` içinde, seçilen etkinlik bir GP ise `PR_SELECTED_ROUND = Number(round)`.
- [ ] **Adım 4: Bingo** [#10] — `app.js:642`, `:650`, `:653` yazma çağrılarını `try { … } catch {}` ile sar (okuma tarafındaki desenle aynı).
- [ ] **Adım 5: Çalıştır** — `node --test tests/` → PASS.
- [ ] **Adım 6: Tarayıcıda duman testi** — her sekme 2026 ve 1988'de açılır, konsolda hata yok; Power sıralama butonları (puan/ortalama/toplam) üç farklı sıra verir; sezon 2026→1950→2026 sonrası editör son yarışı gösterir.
- [ ] **Adım 7: Commit** — `refactor: remove dead code, merge duplicate sorting and photo logic`

---

### Task 7: Cache sürümü [#5]

**Dosyalar:** `index.html`, `app.js:1-4`, `providers/f1ApiProvider.js:6`

- [ ] **Adım 1:** Tüm yerel import'lara `?v=9` ekle: `./config.js?v=9`, `./providers/f1ApiProvider.js?v=9`, `./assets.js?v=9`, `./powerRankings.js?v=9`; provider içinde `../powerRankings.js?v=9`. `index.html`'deki `?v=8`'lerin hepsi `?v=9`.
  Not: `app.js` ve provider aynı `powerRankings.js?v=9` URL'ine çözülmeli; aksi halde modül iki kez yüklenir.
- [ ] **Adım 2:** Testler `?v=9`'lu URL'leri import etmez (Node dosya yolu kullanır) — `node --test tests/` → PASS.
- [ ] **Adım 3:** Tarayıcıda Network sekmesinde her modülün tek sefer `?v=9` ile yüklendiğini doğrula.
- [ ] **Adım 4:** README'ye tek satır: "Deploy ederken tüm `?v=N` değerlerini birlikte artır." ve "Testler: `node --test tests/`".
- [ ] **Adım 5: Commit** — `fix: version all module imports to avoid stale cache after deploy`

---

## Sonrası

Bu plan bitince: UI/UX ve tema çalışması (ayrı brainstorming + ayrı plan). O çalışmaya devredilen konular: arayüz dilinin birleştirilmesi (TR/EN karışık), Power editörünün ziyaretçilere gösterilip gösterilmeyeceği.
