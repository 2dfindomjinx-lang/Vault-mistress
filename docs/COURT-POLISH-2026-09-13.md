# Court düzeltmeleri — 13 Eylül 2026

## Supabase

Önceki `202609100001_court_gameplay.sql` kuruluysa yalnızca `supabase/202609130001_gamble_cashout_receipt.sql` çalıştırılmalı. Yeni API sürümü bu yeni RPC'yi çağırır; SQL, site deploy edilmeden önce uygulanmalı. Yerelde hazırlandı, canlı Supabase'ye uygulanmadı.

Her Patience nakit çıkışı artık sunucu route'una varış zamanından değerlendirilir. Kimlik kontrolü, veritabanına gidiş ve kilit bekleme süreleri oyuncuya ceza olarak eklenmez. Manuel çıkışta 350 ms sabit taşıma toleransı vardır; durum sorgusu son kaybı kesinleştirmeden 1 saniyelik pencere bırakır. İstemcinin bildirdiği çarpan yalnızca ödenecek miktarı azaltabilir; gecikmiş bir isteği kazanca çeviremez. Zaman damgasını istemci vermez, yalnızca service-role RPC kabul eder. Tekrar istekler ikinci ödeme üretmez.

Bu, sınırsız internet gecikmesini ortadan kaldırmaz. Realtime eklemek de tıklamanın gönderim süresini yok etmez. Çok kötü bağlantıda sunucuda önceden sabitlenen otomatik çıkış en kesin zamanlamayı sağlar. Oyunun yerine yeni bir oyun eklenmedi.

## Görsel ve kullanım

- Bow: başı ve gövdesi aşağı eğilen, ayakta ve iki bacağı aynı kalçaya bağlı siluet.
- Case Opening: koyu ödül kartları; günlük oyunların ana butonlarında ortak pembe / koyu yazı.
- Kasa popup'ı: hareket gerçek kart aralıklarından hesaplanır; popup ölçümü veya yeniden render kazananı kaydırmaz.
- Plinko: animasyon bitene kadar tekrar giriş kilidi, sınırlandırılmış ağ bekleme süresi ve animasyon sonlandırma güvencesi.
- Jewelry Box: kayıptan sonra da tuzak sayısı seçimi görünür.
- Onaylı review task'lar günlük süreleri dolunca tekrar kullanılabilir; bekleyen inceleme silinmez.
- How it works kutuları kaldırıldı.
- Coin/Evil aynı alanı paylaşır; açık sözleşme solda, Recorded Commitment ortada, Throne sağda. Açık Throne özeti de orta alanı kullanır.
- Click Game aşamaları görseli örtmeyen alt panelde; açılmış aşamalar yeniden görüntülenebilir. Eski aşama görüntülenirken tıklama harcaması kapalıdır; güncel aşamaya dönülür.

## Yeni asset

`public/avatar/background/stable.webp` — Royal Stable, 5.000 Coin. Yerleşik imagegen ile üretildi; 768×1152 WebP olarak projeye alındı.

Üretim prompt'u: Portrait 2:3 polished hand-painted anime horse stable interior; warm oak beams, brass lanterns, stalls to the sides, daylight from rear doors; no people, horses or text; level human eye-height camera, horizon near 44%; clear flat floor over bottom 45%, empty center foreground for standing avatar soles at 94%; no foreground props, steps or fences.
