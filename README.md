# Cardemir F1

Canlı F1 verisiyle Cardemir özel şampiyonaları: QR, PG, PGNN, PGC, PGNS, Ters + takvim, tarihçe (1950–2026) ve bingo.

Excel (`F126.xlsx`) sadece konsepttir — veri alınmaz. Veri: Jolpica F1 API (takvim + yarış sonuçları).

## Çalıştırma

```bash
python -m http.server 8000
# http://localhost:8000
```

## Kurallar

- **QR:** yarış başlangıç gridi → yarış sonucu.
- **PG:** grid − finiş. **PGNN:** negatifler 0.
- **PGC:** tur başına en çok kazanan 10 pilota 25-18-15…; eşitlikte slot puanları bölüşülür.
- **PGNS:** aynı, bölüşmesiz direkt sıra puanı.
- **Ters:** klasmanı bitirenler sondan başa puanlanır (sonuncu 25), DNF yok.
- PL ile başlayanlar en arkadan sayılır. Sprintler v1'de yok.
