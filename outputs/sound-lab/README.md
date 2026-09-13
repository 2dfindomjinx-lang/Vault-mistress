# Principessa Sound Atelier

`index.html` dosyasını Chrome veya Edge ile aç. Sunucu, uygulama kurulumu ve internet gerekmez; 13 mevcut kayıt ve 26 alternatif HTML'nin içindedir. HTML'yi başka bir klasöre taşıyabilirsin.

13 Eylül güncellemesi: ortak süpürme / hava katmanı tüm üretilmiş alternatiflerden çıkarıldı. Gürültüyle başlayan tel sesleri temiz armoniklerle; kâğıt, kumaş ve ateş dokuları kısa temaslarla yeniden üretildi. Dosya adları, tercihler ve mevcut site kayıtları korundu. Önceki önizlemenin yedeği `backups/before-dry-20260913/` içinde.

- **A / Velvet Court:** Sıcak metal, tel, ipek ve mühür dokuları.
- **B / Obsidian:** Cam, mekanik vuruşlar ve daha modern bir ses karakteri.
- Tek tek dinle, aynı olayı karşılaştır veya akış menüsünden kasa/oyun/shop sırasını dinle. Akışta uzun orijinal kayıtların kuyrukları kısaltılır; tekli oynatma tam kaydı çalar.
- Yeni bir sese basmak öncekini durdurur. `Esc` bütün sesleri durdurur.
- Her olay için bir tercih seçilebilir. Tercihler bu önizlemeye ait ayrı bir tarayıcı kaydında tutulur; JSON olarak indirilebilir.
- WAV dosyaları ayrıca `audio/velvet/` ve `audio/obsidian/` klasörlerinde bulunur.

Mevcut siteye hiçbir entegrasyon yapılmadı. `src/lib/sound.ts` ve `public/sounds` dosyaları yalnızca okundu. Oluşturma öncesi ve sonrasında SHA-256 karşılaştırması yapıldı; kayıtlar `manifest.json` içinde.

## Üretim

Yeni efektler bu paket için programatik olarak sentezlendi. Dışarıdan alınmış ses örneği, konuşma veya hazır müzik kaydı kullanılmadı. 48 kHz, 16-bit stereo PCM WAV. Yumuşatılmış başlangıç/bitişler, frekans süzme, deterministik dither ve tepe sınırı uygulanır. Olayın önemine göre ses seviyeleri dengelenir; tıklamalar daha sakin, efsanevi ödül daha belirgindir.

Önizleme, mevcut ve yeni kayıtların en yüksek 300 ms K-ağırlıklı enerjisini dengeler. Bu yalnızca dinleme sayfasındaki oynatma seviyesidir; mevcut dosyalar yeniden kodlanmaz. Siteye ileride uygulanması değerlendirilirse yeni kayıtlar için `proposedSiteVolume` değerleri manifestte bulunur. Beğeni ve son ses ayarı için insan dinlemesi gerekir.

Yeniden üretmek için proje kökünde:

```powershell
node outputs/sound-lab/generate.mjs
```

Üretici yalnızca kendi `outputs/sound-lab/` klasörüne yazar. `player-template.html` kaynaktır; dinlemek için üretilen `index.html` dosyasını aç.
