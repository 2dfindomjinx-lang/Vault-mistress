# Oyun ve kasa sunumu — uygulama notları

9 Eylül tasarım incelemesinden sonra, mevcut React oyunlarına uygulanan görsel değişiklikler. Önceki genel audit değişikliklerinden ayrı bir kapsamdır.

## Kasalar ve Recent Openings

- Dönen kasa katalog kartları yerine statik kartlar: büyük kasa görseli, açıklama, anahtar/ücretsiz açılış durumu, 1–5 adet seçimi, toplam fiyat ve görünür açma düğmesi.
- Kartların açma düğmeleri aynı satırda hizalanır. İçerik ve oranlar Escape ile kapanan ayrı bir pencerede gösterilir.
- Tekli yatay ve çoklu dikey açılışın mevcut 8,2 saniyelik süresi korunur.
- Recent Openings kullanıcının düzeltmesiyle eski yatay, nadirlik renkli ve detay için dönen kart görünümüne döndürüldü. Kasa panelinin üstünde ayrı bir alanda gösterilir. API'deki 24 saat filtresi kaldırıldı; tarih ne kadar eski olursa olsun son altı gerçek kayıt gösterilir. Yeni açılış en eski kaydın yerini alır.
- Yenileme başarısız olursa ekrandaki kayıtlar korunur. İlk yükleme, geçici hata ve gerçekten boş geçmiş ayrı durumlar olarak gösterilir.

## Uygulanan oyun görselleri

| Alan | Değişiklik |
|---|---|
| Court Games | Aynı kadrajda dört karakter ifadesi; olaya bağlı portre ve sonuç mühürleri. Says için eğilme/diz çökme figürü. |
| Crown Match | Ön ve arka yüzü olan 300 ms kart dönüşü, altı saray sembolü ve eşleşme mühürleri. |
| Royal Guard | Taht, koridor, halı, savunma çizgisi, yaklaşan tehdit/hediye nesneleri ve sonuç izleri. |
| Level Drain | Sunucunun bildirdiği gerçek XP miktarından 1,4 saniyelik aktarım sayacı ve aktarım belgesi. |
| Her Reels / Her Dice | Ayırt edilebilir SVG sembolleri, kazanan çizgi, kısmi geri ödeme/net sonuç metni; kumaş masa ve noktalı zarlar. |
| Roulette / Plinko | Dönen top ve duruş; pim temasları ve sonuç kutusunun kısa tepkisi. |
| Jewelry Box | Açılan kapaklar, içeride kalan elmaslar ve tuzak sembolleri. |
| Her Patience | Karakter yakın planı, okunur çarpan ve sonuçta duran ortam hareketi. |
| The Crawl / Double | Dört kulvarda hareketli figürler, bitiş çizgisi; Double bekleme ve sonuç mührü. |
| Yazı görevleri | Yazılan bölümü izleyen altın metin, sıradaki karakter işareti, tekrar ve tamamlanma mühürleri. |
| Pet | Favor kart dönüşleri, Higher or Lower kartları, A/D sırası vurgusu ve tıklama geri bildirimi. |
| Çarklar / diğer görevler | Malzeme yüzeyleri, mandal hareketi, görev kâğıdı sunumu; Number Pick seçimi, Risk parası derinliği ve Jigsaw çerçevesi. |
| Tribute | Aşama görseli geçişi, yerel tıklama tepkisi; Furnace haznesi/ısı geçişi ve Duels sonuç mühürleri. |

Yeni tasarım CSS/SVG ve küçük bir portre atlasıyla çalışır; ek oyun motoru bağımlılığı yok. Court Games ödülleri, doğrulama hamleleri, mevcut bahis matematiği ve sunucu sonuçları değiştirilmedi. Portre animasyonu Her Patience'ın gizli sonucunu önceden işaret etmez.

İncelemedeki her sinematik fikir birebir yapılmadı: tam karakter rig'i, fizik tabanlı zarlar, yeni Drain Session yerleşimi ve Coin parçacıklarının bakiyeye uçması bu sürümde yok. Uygulanan kapsam yukarıdaki tablodur. Evil Debt ve daha önce reddedilen tercih ekranları değiştirilmedi.

## Doğrulama

- `npm run build`: üretim derlemesi ve TypeScript kontrolü.
- `npm run lint`: mevcut uyarılar dışında hata yok.
- `npm test`: ekonomi/SQL, oyun olasılıkları, kozmetikler ve Recent Openings regresyonları.
- `npm run test:ui`: üç Court Game oynanıyor; ürettikleri hamleler sunucu doğrulama kurallarından geçiriliyor.
- `npm run test:visual:browser`: derlenmiş CSS ile gerçek bileşenler; statik kasa hizaları, içerik penceresi, tekli/beşli açılış, eski kayıtlar, hatalı yenilemede kayıt koruma, kart ön yüzü, oyun geçişi, XP aktarımı, yedi Gamble masası, mobil Favor açılışı ve yazı takibi, mobil genişlik ve azaltılmış hareket.

Tarayıcı denemeleri izole Chrome ortamında sahte HTTP yanıtlarıyla çalışır; test Coin/XP değerleri canlı hesap değildir. Masaüstü/mobil PNG'ler ve sonuç JSON'u `tmp/visual-*` altında üretilir. Canlı Supabase hesabında uçtan uca oynanış, gerçek cihaz kare hızı ve ses dengesi doğrulanmadı. Deploy veya canlı veritabanı işlemi yapılmadı.

## Karakter atlası

Yöntem: yerleşik `image_gen` aracı, mevcut `principessa-home-command.webp` referans alınarak yeni 2×2 ifade atlası üretimi. Çıktı doğrudan kopyalandı; programatik görsel düzenleme yapılmadı.

- Dosya: `public/principessa-ui/generated/principessa-reactions-v1.png`
- Boyut: 1254 × 1254 px, yaklaşık 2 MB.
- Sıra: sol üst nötr, sağ üst onaylayan, sol alt kuşkulu, sağ alt hayal kırıklığı.
- Kod: `src/components/court/CourtVisuals.tsx`; arka plan konumu ile kare seçimi.
- Kullanılan tam prompt: [principessa-reactions-v1.prompt.txt](./principessa-reactions-v1.prompt.txt).
