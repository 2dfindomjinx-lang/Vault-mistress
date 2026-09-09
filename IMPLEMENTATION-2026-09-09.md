# Audit uygulama sonucu — 9 Eylül 2026

Onaylanan kapsam: kamusal feed görünürlüğü / ses / içerik tercihleri ve Evil Debt ürün akışına ilişkin reddedilen öneriler uygulanmadı. Mevcut mekanikler ve tercih değerleri korundu.

## Uygulananlar

- [x] Genel task sync/claim ve profile-progress üzerinden Court Games ödülünü tekrar alma açığı kapatıldı. Görev türleri açık izin listelerine ayrıldı; Affection eşikleri gerçek profilden doğrulanıyor.
- [x] Coin tribute Affection kazanımı sunucuda hesaplanıyor. İstemcinin affectionGain değeri ödülü belirlemiyor. Tribute seçenekleri ortak sabitten geliyor.
- [x] task-claim, profile-progress ve Court Games start/fail/complete; bakiye, görev, Coin kaydı, Devotion ve işlem makbuzunu tek PostgreSQL transaction içinde yazıyor. Satır kilidi ve eski durum karşılaştırması var. Önceki bakiyeyi körlemesine geri yazan rollback kaldırıldı.
- [x] İşlem anahtarı, kayıp ağ yanıtında aynı anahtarla tekrar, kayıtlı Coin tribute / Court Games sonucunu geri alma ve yönetici hata kuyruğu eklendi. Queue yalnızca taşınan komut yollarını kapsar; diğer eski API'lerin tamamı için izleme iddiası yoktur. Başarılı tekrar ilgili hata kaydını kapatır; yönetici işaretlemesi para işlemini tekrar çalıştırmaz.
- [x] Court Games sunucudan bir oyun dizisi alıyor. Says/Match/Guard hamleleri ortak kurallarla yeniden hesaplanıyor. Doğrudan skor beyanı yeterli değil. Bu kontrol botlara karşı kesin oynanış kanıtı değildir.
- [x] 85 galeri dosyası public/gallery yerine private/gallery altında. Eski URL'ler oturum ve sahiplik/ilerleme kontrolünden geçen route'a yönleniyor; özel görseller no-store ve unoptimized sunuluyor. Kilitli kartlar ortak tanıtım görselini kullanıyor. Kullanıcıların önceden indirdiği dosyalar geri alınamaz; önceden dağıtılmış CDN kopyalarının temizliği yayın ortamında ayrıca doğrulanmalıdır.
- [x] İki sürümlü migration, kişisel veri içermeyen eski schema snapshot'ı, bağımsız PostgreSQL testleri ve salt okunur deployment hazırlık kontrolü eklendi. Eski kişiye özel SQL scriptleri Git dışında kaldı.
- [x] Next.js ve eslint-config-next 16.3.4'e güncellendi; uyumlu bağımlılık güvenlik güncellemeleri uygulandı. 16.2.6 için bildirilen kritik açıkların düzeltilmiş sürümleri resmi [Windows advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) ve [AVIF advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4) üzerinden doğrulandı.
- [x] Eksik femsub test dosyası tamamlandı. Güvenlik testleri varsayılan olarak izole çalışıyor. Eski gerçek DB testleri uygulamanın .env.local dosyasını okumuyor; ayrı test kimlik bilgileri ve açık ortam doğrulaması gerekiyor. CI lint, test, üç oyunun tarayıcı testi ve build çalıştırıyor.
- [x] Mobilde dört ana hedef + tüm bölümleri gösteren native dialog menüsü var. Klavye odağı görünür. Sabit sohbet düğmesi mobilde karakter portresinde birleşti.
- [x] Home ve diğer bölüm başlıkları büyük karakter sahneleri kullanıyor. Profil kartı Profile dışında kısaldı; Admin/Analytics, ses, bildirim ve çıkış kontrolleri ayrı ve doğrudan erişilebilir. Bildirimler Recent Tributes üstünde açılıyor. Sanat rehberi docs/ART-DIRECTION.md içinde.
- [x] Preview giriş CTA'sı, doğru kilit mesajları ve özel veriye istek atmayan ekranlar eklendi. Özel oturum verileri yerine tanıtım durumu gösteriliyor. Üç hatalı kıyafet uzantısı canonical resolver üzerinden düzeltildi.
- [x] Profile içindeki son 50 Coin/PM hareketi, sayfa başına 6 kayıtla gösteriliyor. Kullanıcı geri bildirimiyle Your next collectible ve üstteki Your next step kaldırıldı; günlük ödül yönlendirmesi Games kartında kaldı. Coin/PM geçmişi ilgili ledger'a dayanır; dış ödemelerin tüm inceleme durumları bu panelde birleştirilmiş değildir.
- [x] İlk gözlenen ziyaret, ilk Court Game ödülü, ilk donatılan görünüm ve ertesi gün dönüş için ileriye dönük ölçüm var. Yönetici panelinde son 30 günlük gözlenen kohort gösteriliyor. Eski verilerden sahte ilk-kullanım tarihi çıkarılmadı; mevcut oyuncular da kurulumdan sonra bu kohorta girebilir.
- [x] Galeri kataloğu, ekonomi kuralları/komutları, oyun dizisi ve doğrulaması, yerel tercih hook'u ve yeni paneller ayrıldı. Galeri etiketleri mevcut sunucu fiyatı olan 300 Coin ile hizalandı. Ana sayfa hâlâ büyük; bütün uygulama yeniden yazılmadı.
- [x] error/loading/not-found ekranları ve temel yanıt güvenlik başlıkları eklendi.

## Doğrulama

Son kontrol sonuçları aşağıdaki kayıtlarla tutulur:

- npm run build: geçti (Next.js 16.3.4).
- npm run lint: geçti; 0 hata, 93 uyarı. Mevcut kullanılmayan kod / hook bağımlılıkları / ham img uyarıları kaldı.
- npm test: geçti; route + PostgreSQL + mevcut oyun matematiği, avatar slotları, 3000 outfit, linkify ve hitap testleri.
- npm run test:ui: geçti; gerçek CourtGames React bileşeni; Crown Match, Principessa Says ve Royal Guard arayüzden tamamlanıp üretilen hamleler doğrulandı. Saat kontrollü, HTTP sahte; gerçek hesap bakiyesi kullanılmadı.
- Yerel production build üzerinde masaüstü Home/Games/Money Shop/Gallery/Debt/Profile ve 390px mobil menü/sohbet kontrolü. Özel kullanıcı API isteği ve pageerror görülmedi. Yerelde Supabase tanımlı olmadığı için topluluk/genel durum endpoint'leri 500/503 döndü; canlı veri bağlantısının çalıştığı iddia edilmiyor.
- Galeri route testi: kilitli 403, sahip 200 + private/no-store, oturumsuz 401, geçersiz yol 404.
- PostgreSQL testi: tekrar migration, yinelenen anahtar, eski bakiye/görev, ledger hatasında tam geri alma, güvenli tekrar, Devotion, timeout, yetersiz bakiye ve execution grant. PGlite bağlantıları sıralar; gerçek çok bağlantılı lock contention yük testi değildir.

Kanıtlar: tmp/implementation-build.log, tmp/implementation-lint.log, tmp/implementation-tests.log, tmp/implementation-production-browser.json ve tmp/implementation-*.png. Bunlar yerel doğrulama artefaktlarıdır ve Git'e alınmaz.

## Yayına geçiş ve açık sınırlar

Canlı Supabase erişimi bu checkout'ta tanımlı değil. Hiçbir production migration uygulanmadı, deploy yapılmadı. Yayından önce supabase/202609090001_atomic_economy.sql, ardından supabase/202609090002_product_milestones.sql uygulanmalı; ilgili deployment ortamında npm run check:deployment başarılı olmalı. İlk migration mevcut balances üzerinde kurulum güncellemesi yapmaz.

Mevcut üretim şeması/RLS, backup/PITR ve restore denemesi canlıdan doğrulanmadı. schema.sql tam güncel üretim dump'ı veya eksiksiz geçmiş değildir. Diğer eski Coin/PM yazma endpoint'lerinin tamamı bu değişiklikle yeniden transaction tasarımına geçirilmiş sayılmaz.

Son bağımlılık taramasında kritik/yüksek bulgu kalmadı. Firebase → Google Storage → teeny-request → uuid zincirinden 5 orta seviye rapor kaldı. npm'in force önerisi firebase-admin'i uyumsuz eski ana sürüme düşürüyor; uygulanmadı. İncelenen teeny-request çağrısı uuid.v4 kullanıyor; advisory v3/v5/v6 buffer sınırlarıyla ilgili. Bu gözlem tüm bağımlılıkların bağımsız güvenlik incelemesi yerine geçmez.

Yeni ölçümler yeterli kullanım verisi biriktirmeden oyun/ekonomi mekaniği kaldırılmadı. Tema Principessa merkezli koyu bordo/siyah/altın çizgide korundu.

## 10 Eylül: oynanış ve görsel geri bildirim

- Bölüm hero'ları karakter portresi, kemer ve bölüme özel alıntıyla büyütüldü. Home mobil portresi görünür hale geldi; Games yönlendirmesine görsel eklendi, aynı alandaki Wardrobe kaldırıldı.
- Favor kartları hover/klavye odağında yükseliyor ve çerçevesi belirginleşiyor. Confession dahil ortak yazma satırı karakterleri gerçekten karşılaştırıyor; yanlış ve fazla karakterler kırmızı/altı çizili.
- Principessa Says'in tur sırasındaki yönlendirici ipuçları kaldırıldı. Crown Match beşinci yanlışta denemeyi bitiriyor. Üç Court Game başarısızlık/yarıda bırakma sonrasında yeniden başlatılabiliyor; Coin ödülü günde bir kez. Beş hata kuralı hamle doğrulamasında da uygulanıyor.
- Patience başlangıcı, veritabanı işlemi bittikten üç saniye sonraya konuyor. Ağ saati hesabından sunucudaki işlem süresi çıkarılıyor; sorgu dönüşleri animasyonu geri sarmıyor. Başlamadan seçilen otomatik çekme hedefi ağ gecikmesinden bağımsız hesaplanıyor; elle erken çekme ve başarısız isteği yeniden deneme var. Manuel çekme isteğinin zamanında ulaşması yine bağlantıya bağlıdır; geçmişe dönük istemci zamanına güvenilmez. Açılış tekrarı açık turu sürdürüyor, sonuç tekrarı yeniden ödeme yapmıyor.
- Roulette top/çark hareketi sonuç geldikten sonra aynı anda başlıyor. Jewelry Box tur bahsini sabit tutuyor, toplam dönüş/net kazancı ayırıyor; 250x üst sınırı istemci ve SQL'de eşleşiyor. Yedi mayında ilk güvenli seçim 1.13x dönüş (100 Coin için 13 net); bu seviye düşürülmedi. Çok yüksek çarpanlarda eski ödeme sınırına takılma giderildi.
- Drain Session'a hafıza görseli, Coin akışı ve bakiye haznesi; click game'e geniş dokunma alanı, dokunuş izleri ve aşamaya özel ilerleme eklendi. Mevcut harcama oranları ve tıklama paketleme mantığı korundu.
- Higher/Lower, kasa açılışı, Shrine ve diğer görünen açıklamalardaki teknik uygulama ifadeleri temizlendi. Eski kaydedilmiş Higher/Lower sonucunun teknik son cümlesi de ekranda gösterilmiyor.
- SQL dosyaları doğrudan supabase altında. Yeni dosya: 202609100001_court_gameplay.sql; mevcut Gamble Hall kurulumu ve önceki iki dosyadan sonra, uygulama yayınından önce çalıştırılır. gamble-hall.sql içerik değişikliği olmadan izole testler/ilk kurulum için Git kapsamına alındı. Canlı DB'ye uygulanmadı.
- Testler: gameplay-sql-check gerçek SQL'de geç gelen hedef, erken manuel ödeme, çöküş, tekrar, yetki ve Jewelry Box eğrileri/250x ödemeyi; gameplay-browser-check gerçek bileşenlerde mobil/masaüstü hero, sayfalama, tıklama paketleri, Drain stop, Roulette eşzamanlılığı ve Patience tekrar/otomatik sonucu doğrular. Court Games testi beş hata ve yeniden denemeyi de oynar. Header ve mevcut görsel regresyon testleri korunur. HTTP sahte, PostgreSQL izole; üretim gecikmesi ve canlı bakiye testi değildir.

10 Eylül son doğrulama: npm run build, npm run lint (0 hata / 93 mevcut uyarı), npm test, test:ui, test:visual:browser, test:header:browser ve test:gameplay:browser geçti. Güncel yerel kayıtlar tmp/gameplay-build.log, tmp/gameplay-lint.log, tmp/gameplay-tests.log ve tmp/gameplay-*.png dosyalarında.
