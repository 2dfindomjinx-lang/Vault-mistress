# Shop incelemesi — 13 Eylül 2026

Önceki işin tamamlanmış, ürün bazlı bir raporu çalışma klasöründe bulunamadı. Bu rapor mevcut katalogdan yeniden çıkarıldı. Veritabanındaki yöneticiye özel eklemeler ve canlı rotasyon durumu bu yerel taramanın dışında.

## Kapsam ve doğrulanan bulgular

280 katalog kaydı: 239 kozmetik ve 41 Money Shop eşyası. Kozmetiklerin içinde arşiv/veda ürünleri ve satın alınamayan özel haklar da var; 280 sayısı aynı anda satışta olan ürün sayısı değil.

| Tür | Kayıt |
|---|---:|
| Speech avatar | 26 |
| Kullanıcı adı rengi / glow | 12 / 13 |
| İsim değiştirme hakkı | 1 |
| Avatar background | 15 |
| Profile border | 107 |
| Alt / üst / yan frame | 17 / 9 / 15 |
| Köşe / overlay / parçacık frame | 8 / 8 / 8 |
| Money Shop eşyası | 41 |

- Yinelenen ürün ID'si: **0**.
- Tam aynı ürün adı: **0**.
- Katalogda referansı olup yerelde bulunamayan görsel: **0**.
- Yeni Royal Stable dahil satılan bütün background fiyatları **5.000 Coin**.
- CSS/SVG ile çizilen frame ve borderlar, dosya eksikliği testinde resim dosyası olarak değerlendirilmedi.

## Aynı görseli paylaşan ürünler

| Ürünler | Değerlendirme |
|---|---|
| Default Principessa / Random speech avatar | Random bir seçim davranışı; ortak simge normal. |
| Cuckold / Lesbian Cuckold | Aynı görsel, farklı sub/femsub metin ve hedef kitle. Teknik duplicate değil. |
| Denial Queen / Denial Goddess | Aynı görsel, farklı persona metinleri ve hedef kitle. |
| Edging Coach / Edging Mistress | Aynı görsel, farklı persona metinleri ve hedef kitle. |

Bu üç persona çiftini silmezdim. Sahiplik ve konuşma davranışı korunmalı. Görsel çeşitlilik isteniyorsa her çiftin birine yeni illüstrasyon yapılabilir; ürün ID'si değiştirilmemeli. Bunlar rapor bulguları; mevcut satın alımlar veya görseller bu çalışma sırasında değiştirilmedi.

## Aşırı benzerlik ve geliştirme öncelikleri

1. **Glowlarda benzerlik en belirgin.** Ice Blue, White, Lavender ve Frostline küçük kullanıcı adı boyutunda birbirine yaklaşır. Renk dışında ışığın yönü, keskin çekirdeği ve yayılımı farklılaştırılabilir. Renk seçimi ile glow seçimi beraber önizlenmeli; beyaz bir isim üzerindeki açık glow tek başına ürünü iyi anlatmıyor.
2. **Frame ailesinde aynı konuma takılan ürünler çok.** 17 alt frame karşısında 9 üst frame var. Yeni eklemelerde alt parçaları çoğaltmak yerine üst/yan parçalarla tamamlanan setlere öncelik verirdim. Renk varyantı ise bunu ürünün adı veya koleksiyon ilişkisi anlatmalı; yeni bir tasarımmış gibi sunulmamalı.
3. **Anime borderlarda farklı animasyon ve siluet korunmalı.** Katalog zaten edge, layout, motion ve palette ayrımı taşıyor. Yeni ürün, aynı animasyonun yalnızca farklı rengiyse koleksiyonun çeşitliliğine daha az katkı sağlar. Mevcut kayıtları bu rapor kapsamında silmedim.
4. **Backgroundlarda tek başına resim önizlemesi yeterli değil.** Standart avatar üstünde ayak hizası, kamera açısı ve uzun etek/ayakkabı kombinleri birlikte incelenmeli. Yeni Stable düz ve boş ön zemine göre üretildi. Diğer backgroundların tüm kıyafet kombinleri bu çalışmada tek tek render edilmedi.
5. **Money Shop full setleri aynı avatar iskeletini kullanıyor.** Görsel benzerlik taraması Frieren / Raiden Shogun çiftini aday olarak işaretledi; bu tek başına duplicate kanıtı değil. Düşük çözünürlüklü şekil karşılaştırması aynı beden ve duruşu da benzer sayar. Kostüm ve renk ayrımı korunarak ortak avatar hizasının bozulmaması daha önemli.

## Eksik gördüğüm özellikler

- Satın almadan önce mevcut kıyafet, background ve frame ile birlikte deneme.
- Birbirini tamamlayan parçaları gösteren koleksiyon bağlantıları.
- Küçük isim boyutunda da çalışan renk/glow karşılaştırması.
- Yeni katalog kaydı için otomatik ID, dosya ve sahiplik kontrolü.

Bunlar öneridir; satın alma akışına yeni ücret veya ürün silme işlemi eklenmedi. Sayısal tarama çıktıları: `outputs/shop-audit/catalog.json` ve `outputs/shop-audit/similarity-candidates.json`. Benzerlik karşılaştırması görsel değerlendirme için aday üretir; tüm hareketli frame'lerin insan gözüyle incelendiği anlamına gelmez.
