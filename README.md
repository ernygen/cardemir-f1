# Cardemir F1 — F126

Excel'den beslenen F1 puan durumu sitesi. F1 API'ye geçişe hazır mimari.

Kaynak Excel: `F126.xlsx` (Drivers / Teams sheet'leri, ilk blok okunur)

## Çalıştırma

```bash
python -m http.server 8000
# http://localhost:8000
```

## Excel güncelleme

```bash
python excel_to_json.py
```

`F126.xlsx` dosyasını okuyup `data.json` üretir. Site sadece bu JSON'u okur.

## F1 API'ye geçiş

- `config.js` içinde `DATA_SOURCE = "f1api"` yap
- `providers/f1ApiProvider.js` içindeki Jolpica örneğini aktif et
- Arayüz kodu (`app.js`, `index.html`) değişmez
