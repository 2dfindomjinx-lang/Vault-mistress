# Oyunların görsel deneyimi — 9 Eylül 2026

10 Eylül güncellemesi: Bu belge ilk tasarım incelemesidir. Sonradan uygulanan değişiklikler ve test sınırları [uygulama notlarında](./VISUAL-EXPERIENCE-2026-09-10.md) yer alır.

Bu inceleme mevcut kodun render ettiği öğelere, durum geçişlerine, zamanlamalara ve kullandığı görsel/ses yollarına dayanıyor. Chrome/video üzerinden oynanış izlenmedi; akıcılık, gerçek ses dengesi veya mobil kadraj kalitesi ölçülmedi. Öneriler tasarım değerlendirmesidir. Uygulama kodu değiştirilmedi.

## Ana değerlendirme

Projenin güçlü bir karakteri ve geliştirilmeye değer oyunları var. En büyük fırsat, oyuncunun yaptığı hareket ile Principessa'nın tepkisini aynı sahnede birleştirmek. Bugün birçok sistemde büyük karakter görseli başlıkta veya yanda; asıl etkileşim küçük bir sayı, ikon veya çubuk üzerinde oluyor. İyi bir sonraki sürümde oyunun adı, oyun alanında gerçekten karşılık bulmalı.

Örnek: Her Patience için yükselen sayı zaten var; karakterin masaya ritmik parmak vuruşu, ışığın karakter üzerinde değişmesi ve sonuç anında hareketin kesilmesi bu fikri görünür yapar. Level Drain için iki XP çubuğu var; oyuncudan Principessa'ya akan enerji, aktarımın yönünü ve fedakârlığı gösterir.

Mevcut bordo/siyah/altın yönünü sürdürürdüm. Oyunların kendi kimliğini kart malzemesi, sahne düzeni ve hareket karakteriyle kurardım: Crown Match için mühürlü kartlar, Dice için kumaş masa, Royal Guard için taht koridoru. Aynı arayüzün vurgu rengini değiştirmekten daha büyük görsel fark buradan gelir.

## Court Games

| Sistem ve vaadi | Kodda mevcut sunum | Yapacağım geliştirme |
|---|---|---|
| **Principessa Says — dikkat ve komuta uyma** | 8 tur; yazı, Kneel/Bow ve bekleme. Süre çubuğu, yeşil/kırmızı geri bildirim ve 550 ms tur arası. Ortak portrede yalnızca etiket/çerçeve değişiyor. | Komutu karakterin verdiği kısa bir sahne; doğru eylemde küçük oyuncu simgesinin eğilmesi, yanlışta bakış değişmesi. Komut metni süre başlarken bütünüyle okunur olmalı. Sahte komutları önceden ele veren renk/ikon kullanılmamalı. Mevcut yazılı etkileşim korunmalı. |
| **Crown Match — hafıza ve kraliyet koleksiyonu** | 12 kart, 6 çift. Kapalı yüz P, açık yüz sembol; CSS açılışı kısa bir pop ve parıltı. Gerçek ön/arka yüzlü kart dönüşü yok. | Kabartmalı ortak kart arkası, altı özgün saray sembolü, yaklaşık 240–320 ms çift yüzlü dönüş. Eşleşen iki karta bağlanan ince altın çizgi; çiftlerin yerinde mühürlenmesi; altıncı çiftte tamamlanan arma. Kart konumları oyun sırasında korunmalı. |
| **Royal Guard — Principessa'yı koruma** | 18 dalga. Tehdit/hediye ikonları 112 px daireler içinde yatay ilerliyor. Dört farklı sonucun açıklaması var; sonuç arası 460 ms. | En güçlü adaylardan biri. Koridorun sonunda taht, sabit savunma çizgisi, yaklaşan ayrı siluetler. Doğru vuruşta kısa kesik izi ve parçacık; hediye geçince taht yanına yerleşmesi. Kaçan tehditte kalkanın kısa tepkisi. Her dalganın sonucu sahnede okunmalı. |

Kaynak: [CourtGames](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/CourtGames.tsx:247), [kart açılış CSS’i](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/app/globals.css:110), [ortak karakter ve sonuç](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/CourtGames.tsx:617).

Üçünde de aynı görselin 4,8 saniyelik sürekli yüzmesi var. Bunu küçük, olaya bağlı karakter tepkileriyle geliştirirdim. İlk ihtiyaç uzun video veya tam karakter rig'i değil; aynı kadrajda bekleyen, onaylayan, kuşkuyla bakan ve hayal kırıklığı gösteren birkaç tutarlı poz.

## Classic Games ve görevler

| Sistem ve vaadi | Mevcut temel | Öneri |
|---|---|---|
| **Typing Accuracy — hassasiyet** | Hedef cümle, üç hak kalbi, giriş alanı. | Yazılan doğru bölümü satır üzerinde takip eden altın mürekkep; sıradaki karakter için sakin bir imleç. Hata anında ilgili konum ve eksilen hak kısa bir görsel tepki verir. Tamamlanan cümleye mühür basılır. |
| **Login Reward — günlük ziyaret ritüeli** | Claim düğmesi ve görev durumu. | Küçük bir günlük mühür/kapalı zarf; alındığında açılır, ödül bakiyeye taşınır. Bu sık kullanılan işlem yaklaşık yarım saniyelik bir hareketle tamamlanabilir. |
| **Number Pick — tek seçimin açıklanması** | Beş seçenek; düğmelerin renkleri ve sonuç metni değişiyor. | Beş numaralı mühürlü nesne; seçileni hafif öne çıkarma, diğerlerini sakinleştirme, seçilen kapağı açma. Ardından doğru numara mevcut sonuca göre gösterilir. Seçim sayısı veya matematik değişmez. |
| **Case Opening — günlük rastgele ödül** | 5 saniyelik yatay şerit, yavaşlama, gerçek hücre geçişlerine bağlı tick. | Mevcut hareket iyi bir temel. Başlangıçta kısa kapak hareketi, bitişte şeritten ayrışan tek ödül nesnesi ve bakiyeye varan küçük Coin grubu. Büyük envanter kasalarıyla aynı ağırlıkta bir törene gerek yok. |
| **Risk My Freedom — yazı/tura kararı** | İki yüzlü CSS para, dönme ve 900 ms duruş. Free/Timeout yüzleri hazır. | Paraya kalınlık ve yere düşen gölge; havalanma, ağırlıklı iniş ve bir kısa salınım. Sonuca göre açılan mühür veya kapanan kilit. Coin atışının kendisi zaten iyi bir tematik nesne. |
| **IRL Task Wheel — görev atanması** | Numaralı çark; 3,6 saniyelik dönüş; görev daha sonra metin kartında. | Mandalın dilim geçişlerine bağlı hareketi, seçilen dilimin kısa vurgusu, aynı numaralı mühürlü görev kâğıdının açılması. Uzun görevi çarkın dar dilimlerine sıkıştırmam. |
| **Level Drain — kendi gücünü Principessa'ya aktarma** | Karakter görseli, iki XP çubuğu ve sürekli akan gradyan. Metin aktarımın dörtte birini açıkladığı halde aktarımın kendisi bir sahne değil. | En yüksek etki/iş oranlı adayım. Oyuncu XP'si azalırken ışık akışı karaktere gider; Principessa XP'si doğrulanmış miktarla dolar. Son kart iki tarafın önce/sonra değerini ve %25 dönüşümü açıkça gösterir. |
| **Jigsaw — seçilen görsele erişim** | Şu an uygulama içi puzzle yok; ödeme sonrası dış jigsaw bağlantısı geliyor. /puzzle da /tasks'a yönleniyor. | Yerel geliştirme alanı seçim ve teslim sahnesi: parçalardan oluşan kapalı kart, açılan başlık ve belirgin devam düğmesi. Dış sitenin parça sürükleme/snap animasyonları bu koddan geliştirilemez. |

Kaynak: [TaskList](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/TaskList.tsx:697), [Typing ve Number Pick](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/TaskList.tsx:1146), [RiskCoin](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/TaskList.tsx:197), [IRL çarkı](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/TaskList.tsx:1805), [Jigsaw teslim akışı](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/app/page.tsx:11868).

Aktif Classic Games listesi altı task tanımından geliyor. Dosyada kalan eski movement/wait dallarını aktif görev diye değerlendirmedim. Court Games, mevcut ücretli IRL/Jigsaw akışları ve Gamble Hall'un ekonomi kurallarını birbirine karıştırmamak gerekir; bu öneriler ödül/maliyet değişikliği getirmiyor.

## Gamble Hall

| Masa | Mevcut güçlü taraf / geliştirme alanı | Önerdiğim sahne |
|---|---|---|
| **Her Reels** | Üç gerçek şerit, sunucu yanıtını beklerken dönme, 1050/1500/1950 ms sıralı duruş. Semboller emoji. | Özgün Coin/kilit/mücevher/taç çizimleri, makara kenarlarında ışık ve her duruşta küçük mekanik oturma. Ödeme yapan sembolleri bağlayan tek çizgi; sonuç sonrası kısa karakter tepkisi. |
| **Her Dice** | Senin zarların 800 ms, onunkiler 1350 ms sonra duruyor. Şimdiki atış, Unicode yüzlerin hızlı değişmesi. | Aynı masada ayrı iki zar alanı, köşeli hacimli zarlar ve kısa bir sıçrama. Mevcut iki aşamalı açıklamayı koruma. Beraberlikte kuralı taşıyan küçük Principessa mührü. |
| **Court Roulette** | 37 dilim, 3,3 saniyelik dönüş, sabit ok. Görsel davranış çarka yakın. | Ruleti diğer çarklardan ayıran karşı yönde dönen top, dış ray ve hedef yuvaya kısa oturuş. Seçilen bahis ile duran sayının ilişkisini masa üzerinde gösterme. Görsel topun son yeri sunucu sonucuna bağlanmalı. |
| **Royal Plinko** | Top, yay biçimli küçük sekmeler, yol izi, peg tick'leri ve yanan sonuç kutusu var. | Temeli koruma. Çarpılan pimin kısa ışığı, temas anında hafif top sıkışması, son kutuda küçük yaylanma. Her temasın aynı parlaklıkta patlamasına gerek yok. |
| **The Jewelry Box** | 5×5 boş hücre; güvenlide elmas, tehlikede kafatası ve renk değişimi. | Kadife kapaklı 25 küçük bölme. Seçilen kapak açılır, sonuç nesnesi yükselir. Güvenli sonuçlar koleksiyonda kalır; gerçek kayıpta seçilen bölmeden yayılan kısa kapanış. |
| **Her Patience** | Merkezde yükselen çarpan ve cash-out. İsmin karakter vaadi sayıdan daha güçlü. | Karakterin masada beklediği yakın kadraj, parmak/aksesuar gibi hafif ortam hareketi, yanında okunur çarpan. Sonuç geldiğinde hareket durur ve karakter tepkisi gelir. Ortam animasyonu gizli crash noktasını biliyormuş gibi yaklaşan kayıp uyarısı vermemeli. |
| **The Crawl** | Dört kulvar, hareketi değişen ilerleme çubukları, köpek ve taç emojisi; yaklaşık 5,2–5,7 saniyede kazanan bitiriyor. | Derinliği olan dört kısa kulvar, aynı stilde dört hareketli figür, ortak bir bitiş noktası. Mevcut ilerleme değerleriyle figürleri yürütme, bitişte kazanana rozet. Sonucu değiştiren fizik motoru gerekmez. |
| **Double / Keep sonucu** | Double sırasında Flipping metni; ardından tek sonuç satırı. | İki yüzlü kısa mühür dönüşü kullanılabilir. Keep ve Double kararları aynı okunurlukta kalmalı. Kazanma/kısmi geri dönüş/net kayıp farklı görsel ağırlık taşımalı; her pozitif geri ödeme büyük zafer sahnesi olmamalı. |

Kaynak: [makaralar ve zarlar](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/GambleHall.tsx:110), [rulet ve Plinko](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/GambleHall.tsx:393), [Jewelry Box](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/GambleHall.tsx:651), [Her Patience](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/GambleHall.tsx:801), [The Crawl](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/GambleHall.tsx:937).

Büyük karakter banner'ları ve renkli masa sunumları zaten var. Yeni görsel bütçesini önce aktif oyun alanına ayırırdım. Oyuncunun baktığı obje, arka plandaki tanıtım görseliyle aynı özeni taşımalı.

## Kasalar, PM çarkları ve diğer ritüeller

**Envanter kasaları:** Koddaki en gelişmiş açılış düzenlerinden biri. Tekli yatay ve çoklu dikey şerit, 8,2 saniyelik hareket, 280 ms sonuç öncesi bekleme, nadirlik renkleri ve özel legendary sesi var. Bu sürenin daha önce özellikle istendiğini belirten yorum mevcut; ilk değişikliğim süreyi uzatmak veya kısaltmak olmaz. Mevcut duruş sonrasında çıkan eşyayı kısa süre merkezde sunar, koleksiyona eklenme ve varsa kuşanma eylemini ona bağlardım. Common daha sade, rare kısa bir ışık geçişi, epic çevre ışığı, legendary için bir kez çalışan daha büyük bir çerçeve. Kodda yakın kaçırma dekorasyonu zaten var; yeni görsel değeri gerçek çıkan eşyanın sunumunda arardım. Çoklu açılışta tüm nadirlik efektleri aynı anda yarışmamalı.

Kaynak: [CratesPanel animasyonu](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/CratesPanel.tsx:602), [inline eşya sunumu](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/CratesPanel.tsx:1408).

**Broke / Principessa / Luxury / Chastity Wheel:** Ortak 4,2 saniyelik dönüş ve aynı karakter görseli kullanılıyor. Malzeme diliyle ayrışabilirler: Broke için sade koyu metal; Principessa için bordo lake; Luxury için işlenmiş altın; Chastity için mor metal ve kilit motifi. Aynı geometri, farklı yüzey/merkez parçaları maliyeti kontrol eder. Chastity sonucunda dönen çarktan kilit göstergesine kısa geçiş; para sonucunda okunur sonuç belgesi. Bunlar yeni tercih ayarları veya ekonomi değişikliği gerektirmez.

Kaynak: [WheelFace](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/FindomWheels.tsx:62), [dört çarkın tanımları](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/lib/wheels.ts:59).

**Tribute Furnace:** Fuel → alev → ash → crumbling dizisi zaten kendi fikrini anlatıyor. Bu yüzden tematik anlatım bakımından iyi bir referans. İlerleme çubuğundan ziyade yakıt nesnesinin kömürleşmesi ve okunur, kısa kalan bir kül izi geliştirilebilir. Sonuç gerçekten ödül vermediği için zafer konfeti yerine sakin bir kapanış uygun.

**Tribute Duels:** Mevcut sunum isim, süre ve açıklanan sonuç kartları ağırlıklı. İki oyuncu arması, mühürlü karşılaşma kartı ve doğrulanmış sonuç geldikten sonra açılan final sunumu eklenebilir. Gizli tutulan toplamlar varsa görsel ibreyle kimin önde olduğunu uydurmamak gerekir.

**Tribute Click Game:** On aşamalı görsel düzeni, merkez butonu ve ilerleme zaten var. Her tıkta küçük yerel geri bildirim, aşama eşiğinde tek kontrollü geçiş ve okunur önce/sonra durumu eklenebilir. Sürekli tam ekran efekt, çok tekrarlı bir etkileşimi yorabilir.

**Drain Session:** Beş saniyelik görsel floater'lar zaten ekranın farklı noktalarında beliriyor. Daha fazla öğe eklemek yerine bakışın yönünü takip eden az sayıda belirgin yerleşim ve giriş/çıkış ritmi değerlendirilebilir. Etkileşim hedeflerinin üstünü kapatmayan kadraj önemli.

Kaynak: [Furnace](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/TributeFurnace.tsx:120), [Duels](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/TributeDuels.tsx:109), [Click Game](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/TributePanel.tsx:800), [Drain görselleri](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/TributePanel.tsx:513).

## Pet içindeki mevcut etkileşimler

| Sistem | Mevcut durum → görsel geliştirme |
|---|---|
| **Higher or Lower** | Büyük sayı, bahis kontrolleri ve son sonuç kutusu → mevcut sayı için açık kart, gelecek sayı için kapalı kart, seçimden sonra kısa dağıtım/dönüş ve yan yana karşılaştırma. İstatistikler bu iki kartın çevresinde ikincil kalır. |
| **Favor Roulette** | Beş kart, seçilene 900 ms büyüme, FAVOR/EMPTY metni → beş mühürlü kartta ön/arka yüzlü dönüş. Önce seçileni, sonra diğerlerini açıklama. Hiç kazanan kart olmayan mevcut sonuç için sahnede sahte bir kazanan göstermeme. |
| **Obedience Sequence** | A/D sırası, beklenen tuş, ilerleme ve hata sayısı, mevcut sarsılma → sıradaki girdiyi gösteren sabit bir vurgu alanı; doğru basışla ilerleyen zincir/arma; hatada ilgili öğenin kısa tepkisi. Yeni zaman baskısı veya yeni ritim puanlama kuralı eklemek gerekmez. |
| **Evil Wait Obediently** | Geri sayım, iki dakika hareketsizlik ve dikkat dağıtan görsel kutuları → sakin, okunur zaman göstergesi; müdahalesiz bekleme duygusunu taşıyan ortam hareketi. Mevcut oyun komutları ve bekleme süresiyle yarışan uzun giriş sinematiği kullanılmamalı. |
| **Confession Repetition / Ownership Oath / Perfect Pet Writing** | Metin, giriş alanı, tekrar/deneme sayaçları → ortak yazı sahnesi; tamamlanan tekrarın kâğıtta satır veya mühür olarak kalması. Her tekrar ve tüm görevin bitişi farklı ağırlıkta gösterilebilir. |
| **Daily Pet Clicks** | Görsel, aşamalı görünürlük ve çubuk → girdiye kısa yerel tepki, eşikte bir kez çalışan tamamlanma geçişi. Saniyede çok kez çalışan ağır katmanlar gerekmiyor. |
| **Worship Tribute / incelemeye giden görevler** | Görsel/metin girişi ve durum alanları → gönderimin kısa kapanışı, ardından kararlı bir Bekliyor/Onaylandı durumu. Bu ekranları uzun rastgele sonuç animasyonlarıyla doldurmak uygun olmaz. |

Kaynak: [Pet görevleri](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/lib/pet-tasks-content.ts:49), [Pet etkileşimleri](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/PetSection.tsx:1638), [Higher or Lower](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/PetSection.tsx:1840), [Obedience / Favor / Click](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/components/PetSection.tsx:2108).

Evil Debt akışının daha önce reddedilen değişiklikleri bu çalışmanın önerileri arasında değil.

## Ortak hareket dili

Her oyun için aynı üç soru: **Ne yaptım? Sahnede ne oldu? Sonucum ne?**

- **Girdi:** yaklaşık 80–140 ms; basılan nesne tepki verir. Ağ yanıtı bekleniyorsa sonuç yerine bekleme hali gösterilir.
- **Açılma / eşleşme:** yaklaşık 220–350 ms; hangi nesnenin değiştiği anlaşılır.
- **Kısa sonuç:** yaklaşık 400–800 ms; sonuç ve karakter tepkisi tek odakta buluşur.
- **Büyük olay:** kasa gibi mevcut uzun ritüeller dışında, oyuncunun kontrolünü uzun süre kapatmayan sınırlı vurgu.

Bu süreler öneridir; kodda ölçülmüş performans veya kullanıcı tercihi olarak sunulmuyor. Süreli oyunlarda komut geciktirilmez, tıklama alanı efekt için hareket ettirilmez, sunucu süresi/puanı durdurulmaz. Royal Guard dar ekranında da aynı zaman penceresi ve okunur savunma hattı kalmalıdır. Azaltılmış harekette hedefin varışını anlatan sade zaman göstergesi kullanılabilir; görünür geri bildirim tamamen kaybolmamalı.

Mevcut ses dosyaları ve ses seviyesi ayarları korunabilir. Yeni ihtiyaç, mikro olaya uygun kısa geri bildirim ile büyük sonuç sesini ayırmak: her eşleşmede veya Says turunda tüm görev bitmiş gibi aynı ağırlıkta bir sonuç sesi gerekmiyor. Makarada tick, pimin teması, mühür açılması ve son ödül aynı olayı anlatmıyor. Mevcut el yapımı sesler ve ölçülmüş seviye dengesi gelişigüzel yeniden ayarlanmamalı. Kaynak: [ses kayıtları](C:/Users/Mert/Documents/Codex/2026-05-26/create-a-next-js-typescript-tailwindcss/src/lib/sound.ts:1).

Teknik olarak mevcut React + CSS/SVG yaklaşımı bu kapsamın büyük bölümünü taşıyabilir. Kartlar ve zarlar için CSS dönüşleri; ışık yolu, mühür ve darbe için SVG; çok sayıda parçacık gerekecekse yalnızca ilgili sahnede Canvas düşünülebilir. İlk adım yeni bir oyun motoru veya kapsamlı 3D sistem kurmak değil, mevcut render alanlarını daha iyi sahnelemek olmalı.

## Benim uygulama sıram

| Sıra | Paket | Neden | Göreli iş |
|---|---|---|---|
| 1 | **Crown Match + ortak kartlar** | Küçük, açıkça görülen iyileştirme; Number Pick, Favor ve Higher or Lower'da yeniden kullanılabilir. | Düşük–orta |
| 2 | **Level Drain aktarım sahnesi** | Mevcut fikri çok daha iyi anlatır; yeni mekanik gerektirmez. | Orta |
| 3 | **Royal Guard koridoru** | Oyun ile karakteri doğrudan bağlar; vitrindeki farkı yüksek olur. | Orta–yüksek; yeni görsel parçalar gerekir |
| 4 | **Her Patience karakter sahnesi** | En güçlü isim/deneyim eşleşmelerinden biri olabilir. | Orta; tutarlı karakter pozları gerekir |
| 5 | **Her Dice + slot sembolleri** | Gamble bölümünün nesne kalitesini yükseltir. | Orta |
| 6 | **The Crawl figürleri ve pist** | Şu anki soyut ilerlemeyi gerçek kısa yarış sahnesine dönüştürür. | Görece yüksek; hareketli figür ihtiyacı var |
| 7 | **Kasa sonuçları, çark yüzeyleri ve diğer küçük ritüeller** | Var olan güçlü sistemleri ortak kaliteye taşır. | Pakete göre değişir |

Bunlar saat/gün taahhüdü değil, tasarım ve asset yüküne göre sıralamadır. İlk ortak asset seti: tutarlı karakter tepki pozları, bir kart arkası, altı saray sembolü ve basit mühür/ışık parçaları. Yeni büyük arka planlardan önce bu parçalar daha fazla ekranda değer üretir.

Başlangıç için seçimim **Crown Match + Level Drain** olurdu. İkisi birlikte biri etkileşim kalitesini, diğeri karakterin dünyasıyla bağını görünür biçimde yükseltir. Sonraki büyük vitrin oyunu Royal Guard olur.
