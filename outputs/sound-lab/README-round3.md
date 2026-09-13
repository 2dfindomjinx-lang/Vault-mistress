# Sound Atelier 03

`round3.html` dosyasını Chrome veya Edge ile aç. Tek dosya olarak, internetsiz çalışır.

Son indirilen `principessa-ses-tercihlerim-round2.json` dosyasında 13 ana ses ve 42 olay kararı var. Bunlardan 46'sı bir ses seçimi. Drain dışındaki beş olay “Sessiz” olduğu için yeni alternatifler bu beş olayla sınırlandı. Önceki ses seçimleri ve Sessiz kararları, yeni bir seçim yapılana kadar aynen korunur.

- Kart çevirme: 12 farklı malzeme ve kısa oyun sesi.
- Furnace tutuşma: 12 açılış; kibrit, çakmak, kömür, metal, taş ve stilize seçenekler.
- Furnace ateş dokusu: 12 ayrı, 6 saniyelik döngü. Sürekli hava/hışırtı yerine aralıklı temaslar.
- Crawl zemine temas: 12 seçenek; farklı zeminler, avuç/diz vuruşları ve minimal oyun darbeleri.
- Jigsaw açılışı: 12 kısa açılış, kilit, tel ve keşif motifi.

Toplam 60 yeni WAV. Yeni ortak süpürme, beyaz gürültü veya giriş katmanı eklenmedi. Sesler prosedürel olarak sentezlendi; gerçek dünyadan ses kaydı oldukları iddia edilmez.

Her ses ayrı indirilebilir. “12 sesi sırayla dinle” ve ritimde tekrar seçenekleri var. Döngüler sürekli dinlenebilir. Yeni bir ses seçince önceki oynatma kesilir. “Tüm tercihlerimi indir” önceki 13 + 42 kararın tümünü ve yeni seçimleri içerir. “Sessiz kalsın” geçerli bir tercihtir; export sırasında kaybolmaz. Yeni sayfa, önceki iki HTML'nin tarayıcı seçimlerini değiştirmez.

Drain için ses üretilmedi. Kullanıcının `public/sounds/drain_session.mp3` kaydı aynen kullanılır. Önizlemede “Oturumu dene” sesi başlatmaz; ses ayrıca açılır. Her yeni oturum sessizdir. Sitede de `TributePanel` içindeki ses kontrolü yalnızca aktif Drain oturumunda görünür; oturumun kapanması, bakiye bitmesi, sync reddi veya panelin kaldırılması kaydı durdurur. Site ses düzeyi ve sessize alma ayarı uygulanır. Bu entegrasyon yerel koddadır; dağıtım yapılmadı.

Seçilen diğer alternatifler henüz siteye bağlanmadı. Önceki ses dosyaları, önceki iki önizleme ve verilen MP3 değiştirilmedi. `manifest-round3.json` ses metaverilerini ve korunmuş dosyaların hashlerini içerir.

Yeniden üretim: proje kökünde `node outputs/sound-lab/generate-round3.mjs`. Kaynak tercih dosyası `choices-round2.json`; yalnızca bu turun önizlemesi ve `audio/round3/` çıktıları yazılır.
