# AdaptLab — Stratejik Sunum Akışı ve Konuşmacı Metni (Pitch Deck Script)

**Takım:** No Limits Lunar  
**Ekip:** Yusuf Kerim Kaymakçı (Aviyonik, Algoritmalar, Veri & Web) · Yusuf Çırpan (Görev Stratejisi & Jüri Deneyimi)  
**Yarışma:** NASA Space Apps Challenge — *Lunar Landing Site Navigator*  
**Toplam Süre:** 4:00 Dakika (+ Jüri Soru-Cevap)  
**Canlı Web Platformu:** [adaptlab.us](https://adaptlab.us) · **Açık API:** `adaptlab.us/api/v1/search`  

---

## 7 Slaytlık Stratejik Akış Özeti (Investor Narrative Arc)

| # | Slayt Başlığı | Çıkarım Odaklı Manşet (Conclusion Headline) | Süre | Konuşmacı | Temel Mesaj |
|---|---|---|---|---|---|
| **01** | **Fırsat & Giriş (Opportunity)** | *“Ay'a inişte yer kadar tarih de hayatta kalmayı belirler.”* | 0:00–0:30 | Yusuf Çırpan | Artemis/CLPS kutba dönüyor; yanlış günde inen araç donar. AdaptLab yeri ve tarihi birlikte çözer. |
| **02** | **Problem (The Problem)** | *“Kutup arazisinde Güneş 1.5° ile gelir: tek bir sırt 50 km gölge yaratır.”* | 0:30–1:00 | Yusuf Çırpan | 3D gerçek LOLA topografyası; ufuk ray-marching ve batarya/iletişim kaybı dinamiği. |
| **03** | **Çözüm & Ürün (Solution & Product)** | *“21.856 nokta saat saat taranır: GO/NO-GO pencereleri ve risk analizi.”* | 1:00–1:45 | Yusuf Kerim | 3 adımlı motor: Görevi tanımla → Ufuk & efemeris tara → Karar & Monte Carlo simülasyonu. + *Görevi Anlat* filmi. |
| **04** | **Doğrulama & Kanıt (Validation)** | *“Aynı motoru 5 gerçek inişe uyguladık. IM-1 devrildi; simülasyon farkı gösteriyor.”* | 1:45–2:30 | Yusuf Kerim | Chandrayaan-3, SLIM, IM-1, Chang’e 6, Blue Ghost 1 karşılaştırması + Hakem canlı düellosu. |
| **05** | **Pazar & Ölçek (Market & Scale)** | *“Görev planlayıcılarından eğitimcilere: açık API ile her araca uyarlanır.”* | 2:30–3:00 | Yusuf Kerim | CLPS ticari iniş araçları, üniversite gezginleri ve açık REST API mimarisi. |
| **06** | **Rekabet & Ekip (Advantage & Team)** | *“Statik haritalar nereyi gösterir; AdaptLab ne zaman ve nasıl yaşanacağını hesaplar.”* | 3:00–3:30 | Yusuf Çırpan | QuickMap/Moon Trek fotoğraf albümüdür; AdaptLab fizik motorudur. Ekip yetkinliği. |
| **07** | **Vizyon & Kapanış (Vision & Ask)** | *“Kararan her aracın daha iyi bir yeri ya da daha iyi bir günü vardı. AdaptLab onu bulur.”* | 3:30–4:00 | Yusuf Çırpan | Bugün çalışan sistem, yarın 5 m arazi. Kapanış QR kodu (adaptlab.us) ve soru-cevap daveti. |

---

## Detaylı Slayt Akışı, Arayüz Direktifleri ve Kelimesi Kelimesine Konuşma Metni

---

### SLAYT 1 — FIRSAT & GİRİŞ (The Opportunity)
- **Süre:** 0:00 – 0:30 (30 saniye)
- **Konuşmacı:** Yusuf Çırpan
- **Manşet:** Ay'a inişte yer kadar tarih de hayatta kalmayı belirler.
- **Alt Başlık:** NASA LOLA topografyası ve JPL yörünge mekaniğiyle; Ay görevleri için optimal iniş yeri ve pencere arama motoru.

#### Ekranda Görünecek Yapı (Claude için Arayüz Notu):
- Minimalist, editoryal uzay teması (koyu zemin, net tipografi).
- Üstte küçük rozet: `NASA SPACE APPS 2026 · NO LIMITS LUNAR`.
- 3 Temel Sütun Kartı:
  1. **01 — Güney Kutbu Hedefi:** Artemis III ve ticari CLPS görevleri 50 yıl sonra Ay'ın su buzu zengini güney kutbuna iniyor.
  2. **02 — Kritik Gölge Riski:** Kutupta Güneş ufka teğet geçer; yanlış günde inen araç haftalarca karanlıkta kalır.
  3. **03 — 21.856 Nokta Analizi:** AdaptLab tek tıkla tüm araziyi tarar; GO/NO-GO iniş pencerelerini ve batarya ömrünü çıkarır.
- Alt imza: `AdaptLab · Yusuf Kerim Kaymakçı & Yusuf Çırpan`.
- *KESİNLİKLE İLK SLAYTTA BÜYÜK QR KOD OLMAYACAK.*

#### Kelimesi Kelimesine Konuşma Metni:
> “Merhaba, biz No Limits Lunar takımından Yusuf Çırpan ve Yusuf Kerim Kaymakçı.
> 
> İnsanlık, Artemis ve ticari CLPS programlarıyla 50 yıl sonra Ay'a; bu kez kaynakların bulunduğu Güney Kutbu'na geri dönüyor.
> 
> Ancak kutup bölgesinde doğru iniş yerini bulmak hayatta kalmak için yetmiyor. Çünkü kutupta Güneş ufka teğet geçer. Yanlış günde, yanlış açıyla inen bir uzay aracı; metrelerce ötesinde güneş varken haftalar süren bir krater gölgesinde donup kalır.
> 
> Ay'a inişte yer kadar tarih de hayatta kalmayı belirler. AdaptLab, iniş yerini ve iniş tarihini birlikte optimize eden otonom görev planlama motorudur.”

---

### SLAYT 2 — PROBLEM (The Problem)
- **Süre:** 0:30 – 1:00 (30 saniye)
- **Konuşmacı:** Yusuf Çırpan
- **Manşet:** Kutup arazisinde Güneş 1.5° ile gelir: tek bir sırt 50 km gölge yaratır.
- **Alt Başlık:** Güneş paneli gölgede kalırsa batarya tükenir; Dünya krater arkasında kalırsa telsiz hattı kesilir.

#### Ekranda Görünecek Yapı (Claude için Arayüz Notu):
- Gerçek NASA LOLA yükseklik verisinden oluşturulmuş 3D güney kutbu arazisi.
- Ufukta teğet (1.5° yükseklik) dönen ışık kaynağı; arazide uzayan dinamik 50 km'lik gölgeler.
- Işık kontrol kaydırıcısı ve oynat/durdur düğmesi.
- Ekran altında vurucu bilgi kutusu: *“Güneş paneli gölgede kalırsa batarya tükenir; Dünya krater arkasında kalırsa telsiz bağı kopar.”*

#### Kelimesi Kelimesine Konuşma Metni:
> “Şu an ekranda gördüğünüz model, NASA LOLA lazer altimetre verileriyle oluşturulmuş gerçek Shackleton krateri çevresidir.
> 
> Kutupta Güneş gökyüzüne yükselmez, ufukta yalnızca bir buçuk derecelik teğet bir açıyla döner. Bu durum, arazideki en ufak bir yükseltinin arkasında 50 kilometreyi aşan kalıcı gölge koridorları yaratır.
> 
> Güneş paneliniz gölgede kaldığı an aracınız bataryadan harcamaya başlar. Dünya krater duvarının arkasında kaldığı an ise NASA Deep Space Network ile telsiz irtibatınız kopar.
> 
> Geleneksel görev planlamasında bu hesaplamalar aylar süren manuel simülasyonlarla yapılıyor ve fırlatmadaki tek bir günlük erteleme tüm görevi felakete sürükleyebiliyor.”

---

### SLAYT 3 — ÇÖZÜM & ÜRÜN (The Solution & Product)
- **Süre:** 1:00 – 1:45 (45 saniye)
- **Konuşmacı:** Yusuf Kerim Kaymakçı
- **Manşet:** 21.856 nokta saat saat taranır: GO/NO-GO pencereleri ve risk analizi.
- **Alt Başlık:** Görev hedefinizi girin; motor NASA LOLA ufuklarını ve JPL efemerislerini saniyeler içinde hesaplasın.

#### Ekranda Görünecek Yapı (Claude için Arayüz Notu):
- 3 Aşamalı Ürün Akış Şeması:
  - **Adım 1: Görevi Tanımla:** Bilim hedefi (Su buzu, Artemis III, Jeoloji) ve kalış süresi (7, 14, 28 gün).
  - **Adım 2: Fizik & Efemeris Taraması:** 21.856 noktada NASA LOLA ufuk matrisleri, JPL DE421 gök mekaniği ve DSN istasyonları saat saat işlenir.
  - **Adım 3: Karar & Monte Carlo:** GO/NO-GO iniş takvimi, batarya tükenme riski ve fırlatma ertelemesine toleranslı başarı olasılığı üretilir.
- Alt Kısım: **“Görevi Anlat” Sinematik Misyon Filmi Butonu** (Tıklandığında fırlatmadan yüzey gezgini sürüşüne kadar sinematik geçiş başlatır).

#### Kelimesi Kelimesine Konuşma Metni:
> “Bu problemi çözmek için AdaptLab motorunu inşa ettik. Sistem üç basit adımda çalışır:
> 
> Birincisi: Görev profilinizi belirlersiniz. Örneğin 14 gün boyunca su buzu arayacak bir iniş aracı.
> 
> İkincisi: Matematik motorumuz devreye girer. Ay'ın kutup bölgesindeki 21.856 noktanın her biri için NASA LOLA 3D ufuklarını, JPL DE421 efemerislerini ve Madrid, Goldstone, Canberra yer istasyonlarını 2026'dan 2045'e kadar saat saat tarar.
> 
> Üçüncüsü: Karar katmanı. Sistem size sadece tek bir koordinat vermez; fırlatma gecikmelerine dayanıklı GO/NO-GO iniş tarihlerini ve 300 adımlı Monte Carlo simülasyonuyla hayatta kalma olasılığını sunar.
> 
> Ekranda gördüğünüz 'Görevi Anlat' modülüyle görevin fırlatma anından yüzeydeki gezgin sürüşüne kadar tüm rotasını 3 boyutlu simüle edebiliyoruz.”

---

### SLAYT 4 — KANIT & DOĞRULAMA (Validation & Evidence)
- **Süre:** 1:45 – 2:30 (45 saniye)
- **Konuşmacı:** Yusuf Kerim Kaymakçı
- **Manşet:** Aynı motoru 5 gerçek inişe uyguladık. IM-1 devrildi; simülasyon farkı gösteriyor.
- **Alt Başlık:** Tarihsel telemetri ile doğrulanmış motor; salondaki hakemlerle canlı düello.

#### Ekranda Görünecek Yapı (Claude için Arayüz Notu):
- Sol Taraf: 5 Tarihi Görev Karşılaştırma Grafiği (AdaptLab Modeli vs Gerçek Operasyon):
  - **Chandrayaan-3:** Model 12.3 gün / Gerçek 11.6 gün
  - **SLIM:** Model 11.9 gün / Gerçek 12.0 gün
  - **IM-1 Odysseus (Kırmızı Vurgulu):** Model 4.4 gün risk marjı / Gerçek 7.0 günde tükendi (Devrilme nedeniyle panel kaybı).
  - **Chang'e 6:** Model 10.6 gün / Gerçek 2.0 gün (Planlı kalkış).
  - **Blue Ghost 1:** Model 15.0 gün / Gerçek 14.6 gün
- Sağ Taraf: **Canlı Jüri Doğrulama Kartı (WebRTC / PeerJS)**:
  - Salondaki hakemlerin telefonlarından gönderdiği iniş noktaları ile AdaptLab motorunun otonom seçimi arasındaki düello skoru.

#### Kelimesi Kelimesine Konuşma Metni:
> “Modelimizin teoride kalmadığını kanıtlamak için motorumuzu Ay'a inmiş 5 gerçek tarihi göreve uyguladık.
> 
> Sonuçlar ortada: Blue Ghost 1 için modelimiz 15 gün öngördü, operasyon 14.6 gün sürdü. SLIM için 11.9 güne karşılık 12 gün gerçekleşti.
> 
> En kritik kanıtımız ise Şubat 2024'te kutba inen IM-1 Odysseus. IM-1 inişte ayağı takılıp devrildi ve güneş paneli açısı bozuldu. Bizim modelimiz araca en fazla 4.4 günlük batarya toleransı tanımıştı; araç tam da öngördüğümüz gibi 7. günde enerjisiz kalarak sustu.
> 
> Ayrıca salondaki hakemlerimizin cep telefonlarıyla bağlandığı canlı düello altyapımız, rastgele seçilen her iniş noktasına karşı motorumuzun daima daha yüksek güneş ve iletişim güvenliği sunan alternatifini saniyeler içinde kanıtlıyor.”

---

### SLAYT 5 — PAZAR & ÖLÇEK (Market, GTM & Scale)
- **Süre:** 2:30 – 3:00 (30 saniye)
- **Konuşmacı:** Yusuf Kerim Kaymakçı
- **Manşet:** Görev planlayıcılarından eğitimcilere: açık API ile her araca uyarlanır.
- **Alt Başlık:** B2B uzay yüklenicileri, gezgin operasyonları ve entegre REST API mimarisi.

#### Ekranda Görünecek Yapı (Claude için Arayüz Notu):
- 3 Boyutlu Dünya - Ay - LRO Yörünge İletişim Görseli.
- 3 Hedef Segment Kartı:
  1. **🚀 Artemis & CLPS Yüklenicileri:** Intuitive Machines, Astrobotic, Firefly ve ispace için fırlatma takvimi ve batarya optimizasyonu.
  2. **🛰️ Gezgin & Faydalı Yük Ekipleri:** Kraterlerin kalıcı gölgeli bölgelerine (PSR) güvenli giriş ve sırtta güneş takip rotaları.
  3. **🔌 Açık REST API Entegrasyonu:** `/api/v1/search` uç noktası sayesinde herhangi bir yer kontrol yazılımına veya uçuş simülatörüne doğrudan entegrasyon.

#### Kelimesi Kelimesine Konuşma Metni:
> “Peki AdaptLab kimin için ve nasıl ölçekleniyor?
> 
> Öncelikli pazarımız, NASA CLPS programı kapsamında Ay'a iniş aracı üreten ticari havacılık şirketleridir. Bir iniş aracının maliyeti 100 milyon doların üzerindedir ve yanlış günde iniş tüm yatırımı sıfırlar.
> 
> İkinci segmentimiz, yüzeyde su buzu arayan gezgin ve otonom robotik ekipleridir.
> 
> En büyük ölçek avantajımız ise mimarimizdir. AdaptLab sadece bir web arayüzü değildir; arkasında çalışan açık REST API motorumuz (`/api/v1/search`) sayesinde herhangi bir havacılık simülatörüne veya yer kontrol istasyonuna bir saat içinde entegre edilebilir.”

---

### SLAYT 6 — REKABET & EKİP (Advantage & Team)
- **Süre:** 3:00 – 3:30 (30 saniye)
- **Konuşmacı:** Yusuf Çırpan
- **Manşet:** Statik haritalar nereyi gösterir; AdaptLab ne zaman ve nasıl yaşanacağını hesaplar.
- **Alt Başlık:** Fotoğraf albümü araçlara karşı çok değişkenli zamansal fizik motoru ve yetkin ekip.

#### Ekranda Görünecek Yapı (Claude için Arayüz Notu):
- Sol Sütun: **Neden AdaptLab? Karşılaştırma Tablosu:**
  - *Zaman Serisi Simülasyonu:* QuickMap / Moon Trek: ❌ Statik | AdaptLab: ✅ 2026–2045 Saatlik
  - *Ufuk Ray-marching:* QuickMap / Moon Trek: ❌ Yok | AdaptLab: ✅ NASA LOLA 3D
  - *Otonom Tarama:* QuickMap / Moon Trek: ❌ Manuel | AdaptLab: ✅ 21.856 Nokta
  - *Başarı / Monte Carlo:* QuickMap / Moon Trek: ❌ Yok | AdaptLab: ✅ Stokastik Risk Modeli
- Sağ Sütun: **Ekip & Yetkinlik Kartları:**
  - **Yusuf Kerim Kaymakçı:** Aviyonik, Algoritmalar, Veri & Web (Baykar Fen Lisesi öğrencisi, Zilant İHA Takımı kaptanı, IAC 2026 yörünge dinamiği araştırmacısı).
  - **Yusuf Çırpan:** Görev Stratejisi & Jüri Deneyimi (Kullanıcı etkileşimi, canlı düello mimarisi ve görev akışı).

#### Kelimesi Kelimesine Konuşma Metni:
> “Sektörde NASA QuickMap ve Moon Trek gibi popüler araçlar var. Ancak bu araçlar yalnızca statik birer fotoğraf albümüdür. Size bir kraterin fotoğrafını gösterir ama 'Güneş battığında aracın 48 saat sonra donacak mı?' sorusuna yanıt veremez.
> 
> AdaptLab bir harita değil; dinamik bir zamansal hayatta kalma motorudur.
> 
> Bu motoru hayata geçiren ekibimiz: Yazılım, veri motoru ve aviyonik algoritmalarını geliştiren Yusuf Kerim Kaymakçı ile görev stratejisi ve kullanıcı deneyimini kurgulayan bendeniz Yusuf Çırpan’dan oluşuyor. Algoritma ve uzay dinamiği disiplinlerini bir araya getiriyoruz.”

---

### SLAYT 7 — VİZYON & KAPANIŞ (Vision & Closing)
- **Süre:** 3:30 – 4:00 (30 saniye)
- **Konuşmacı:** Yusuf Çırpan
- **Manşet:** Kararan her aracın daha iyi bir yeri ya da daha iyi bir günü vardı. AdaptLab onu bulur.
- **Alt Başlık:** Canlı platformu hemen test edin; sorularınızı yanıtlamaktan onur duyarız.

#### Ekranda Görünecek Yapı (Claude için Arayüz Notu):
- Sol Taraf:
  - Büyük AdaptLab Logosu ve Vurucu Kapanış Sloganı:  
    *“Kararan her aracın daha iyi bir yeri ya da daha iyi bir günü vardı. AdaptLab onu bulur.”*
  - Yol Haritası (Roadmap):
    - **BUGÜN:** Canlı Web Uygulaması, Açık REST API ve 5 Tarihi Görev Doğrulaması.
    - **SONRA:** 5 m Yüksek Çözünürlüklü Artemis Topografyası ve Araca Özel Termal Model.
    - **VİZYON:** 2026 CLPS (Griffin 1, IM-3) Görevlerinin Gerçek Zamanlı Telemetri Entegrasyonu.
  - Takım Künyesi: `No Limits Lunar · Yusuf Kerim Kaymakçı · Yusuf Çırpan · NASA Space Apps 2026`.
- Sağ Taraf:
  - **ÖZENLE ÇERÇEVELENMİŞ, NET QR KOD** (`adaptlab.us`).
  - QR Altında Metin: `adaptlab.us` · *“Telefonunuzla tarayıp hemen canlı deneyin.”*

#### Kelimesi Kelimesine Konuşma Metni:
> “Bugün AdaptLab; çalışan web uygulaması, açık REST API'si ve gerçek görev doğrulamalarıyla hazırdır. Sıradaki hedefimiz 5 metrelik yerel Artemis topografyasını ve iniş araçlarına özel termal modelleri sisteme eklemektir.
> 
> Sözlerimizi jürimizin asla unutmaması gereken bir gerçekle tamamlamak istiyoruz:
> 
> Ay'ın kutbunda kararan her aracın daha iyi bir yeri ya da daha iyi bir günü vardı. AdaptLab onu bulur.
> 
> Ekrandaki QR kodu okutarak adaptlab.us üzerinden platformu canlı olarak deneyimleyebilirsiniz. Dinlediğiniz için teşekkür eder, sorularınızı almaktan mutluluk duyarız.”

---

## Hakem ve Jüri Soru-Cevap Rehberi (Q&A Defense Guide)

### Soru 1: “Bu verilerin doğruluğunu nasıl garanti ediyorsunuz? NASA verisiyle ne kadar örtüşüyor?”
- **Cevaplayan:** Yusuf Kerim Kaymakçı
- **Net Cevap:** “Simülasyonumuz üç bağımsız NASA kaynağına dayanır: LOLA 40 metrelik yükseklik modeli, JPL DE421 gezegen efemerisleri ve resmi Deep Space Network istasyon koordinatları. Işık hesaplamalarımızı NASA’nın Mazarico ve arkadaşlarının 2011'de yayımladığı resmi kutup aydınlanma haritalarıyla 32 noktada kıyasladık; korelasyon katsayımız **r = 0.96** çıktı. Eğim doğrulamamızda ise resmi LOLA 40 metre eğim haritasıyla 6.620 noktada medyan farkımız sadece **1.15 derece**dir.”

### Soru 2: “QuickMap veya Moon Trek varken bir havacılık şirketi neden AdaptLab kullansın?”
- **Cevaplayan:** Yusuf Çırpan
- **Net Cevap:** “QuickMap ve Moon Trek görsel inceleme araçlarıdır; zamansal simülasyon yapmazlar. Bir iniş aracı için kritik olan ‘Burada 8 Eylül’de Güneş var mı, yoksa sırtın arkasında gölge mi düşüyor?’ sorusudur. QuickMap bunu saat saat hesaplayamaz. AdaptLab ise 2026–2045 arasındaki tüm saatleri tarar, iniş penceresi (GO window), batarya tükenme marjı ve Monte Carlo risk skoru çıkarır. Ayrıca açık REST API mimarimizle doğrudan uçuş yazılımlarına veri besler.”

### Soru 3: “IM-1 Odysseus örneğinde modeliniz tam olarak neyi gösterdi?”
- **Cevaplayan:** Yusuf Kerim Kaymakçı
- **Net Cevap:** “IM-1 Malapert A krateri yakınına indiğinde yan yattı ve panelleri dik açısını kaybetti. Bizim motorumuz, düz bir iniş durumunda bile o koordinatta Güneş'in ufuk arkasına iniş profilini saat saat çıkardı ve batarya risk marjını 4.4 gün olarak hesapladı. Gerçek görevde araç 7. günde dondurucu geceye yenik düştü. Modelimiz, iniş koordinatı ve iniş tarihi birlikte seçildiğinde sadece 8 kilometre batıdaki bir sırtta 11 gün kesintisiz güneş alınabileceğini kanıtlıyor.”

### Soru 4: “Bu bir iniş sertifikasyonu mudur?”
- **Cevaplayan:** Yusuf Kerim
- **Net Cevap:** “Hayır, AdaptLab erken aşama görev planlama ve optimizasyon motorudur (Phase A/B mission design). Aylar süren manuel astrodinamik hesaplarını saniyelere indirir, en uygun pencereleri daraltır; nihai iniş sertifikasyonu öncesi karar vericilere zaman ve milyonlarca dolarlık risk tasarrufu sağlar.”

