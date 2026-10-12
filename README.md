# Cardemir F1 🏁

Canlı F1 verisiyle Cardemir özel şampiyonaları. Site: **https://ernygen.github.io/cardemir-f1/**

Excel (`F126.xlsx`) sadece konsepttir — veri alınmaz.

## Sekmeler

- **Yarış Takvimi** — sezon takvimi + kazananlar
- **Pistler** — F1 tarzı 3'lü pist kartları (karta tıkla, tur detayına git)
- **Pilotlar / Takımlar Şampiyonası** — gerçek puanlar, solda son yarış, sağda full tablo + sıra okları (▲▼)
- **Grid / Yarış** — yarış başlangıç gridi → yarış sonucu
- **Position Gain (PG)** — grid − finiş; **PGNN** negatifleri 0 sayar
- **Position Gaining Championship (PGC)** — tur başına ilk 10'a 25-18-15…; eşitlikte puan bölüşülür
- **Position Gaining No Split (PGNS)** — bölüşmesiz direkt sıra puanı
- **Ters Şampiyona** — klasmanı bitirenler sondan başa puanlanır (sonuncu 25), DNF yok
- **Tarihçe** — 1950–2026 herhangi bir sezonun şampiyonları + kim nerede kazandı tablosu
- **Bingo** — WC olay kartları (tıkla işaretle, tarayıcıda saklanır)

## Veri ve görseller

- Veri: [Jolpica F1 API](https://api.jolpi.ca/ergast/f1/) (canlı takvim + sonuçlar)
- Pilot/araç/pist görselleri ve fontlar: © Formula One (`media.formula1.com`, hotlink)
- Takım renkleri: OpenF1 `team_colour`

## Çalıştırma

```bash
python -m http.server 8000
# http://localhost:8000
```

## Notlar

- PL ile başlayanlar kazanç hesabında en arkadan sayılır.
- Sprint puanları v1'de yok (sadece pazar yarışları).
- Fotoğraflar 2026 kadrosuna aittir, eski sezonlarda gösterilmez.

---

Bu site **OpenCode (Muse Spark)** ile birlikte geliştirildi — Eren'in Excel konseptinden canlı F1 sitesine. 🤖
