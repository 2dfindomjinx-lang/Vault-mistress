# Sound Atelier 02

Chrome veya Edge ile `round2.html` dosyasını aç. Dosya tek başına ve internetsiz çalışır.

13 Eylül güncellemesi: tüm üretilmiş alternatiflerdeki ortak süpürme / hava katmanı çıkarıldı. Kâğıt ve ateş gibi dokular da kesintisiz hışırtı yerine kısa, ayrı temaslardan oluşur. İlk paketteki seçilmiş alternatifler de yenilendi; “Mevcut” tercihlerindeki orijinal kayıtlar aynı kaldı. Aynı dosya adları ve tercih anahtarları kullanılır; açık sayfayı yenile.

- **Butonlar:** 8 aileden 32 yeni kayıt. `×8` ile art arda dinle; Normal/Hızlı ayarı tekrar aralığını değiştirir. İlk paketteki iki buton ve sitedeki orijinal de karşılaştırma için var.
- **Yeni sesler:** 42 olay için 84 alternatif. A tok/dokulu, B daha keskin/kristal. İstemediğin olaya “Sessiz kalsın” diyebilirsin. Kartın altında mevcut durum, öneri ve tetikleme anı yazıyor.
- **Akış içinde dinle:** Crown Match, casino, Furnace, Shrine ve ekonomi sıraları. Furnace önizlemesi 1/10/25 banknotu mevcut animasyonun tüketim aralıklarıyla seslendirir; gerçek ödeme yapılmaz.
- **Seçtiklerin:** İlk indirdiğin dosyadaki 12 tercih korundu. Kontrat ve galeri için orijinalleri; efsanevi kasa ve özel etkinlik için Velvet; diğer sekiz olay için Obsidian seçili.
- **Tüm tercihlerimi indir:** Önceki 12 tercihi, varsa yeni buton tercihini ve yeni olay kararlarını tek JSON dosyasında toplar.

Her dosya ayrı indirilebilir. Yeni WAV'lar `audio/round2/` klasöründe. İnceleme raporu `audit-round2.md`; kaynak ve ses metaverileri `manifest-round2.json` içindedir.

Mevcut siteye entegrasyon yapılmadı. `src/` ve `public/sounds/` değiştirilmedi. Her iki dinleme paketi temiz girişlerle yenilendi. Sesler dış örnek veya seslendirme olmadan, bu önizleme için sentezlendi. WAV: 48 kHz, 16-bit, stereo. Kısa sesler yumuşak giriş/çıkış kullanır; iki Furnace ateş kaydı döngü sınırı için ayrıca üretildi. Önceki dosyalar `backups/before-dry-20260913/` içinde yedeklendi.

Tercihler ana sitenin ses ayarlarından ayrı bir tarayıcı kaydında tutulur. Son dinleme ve beğeni değerlendirmesi kullanıcıya aittir.

Yeniden üretim: proje kökünde `node outputs/sound-lab/generate-round2.mjs`. Üretici yalnızca bu önizlemenin yeni dosyalarını yazar.
