# AdaptLab — sunum içeriği ve kısa cevaplar

**Takım:** No Limits Lunar. **Yusuf Kerim Kaymakçı:** motor, veri, web uygulaması. **Yusuf Çırpan:** sunum ve jüri deneyimi. **Ürün:** [adaptlab.us](https://adaptlab.us). **Challenge:** Lunar Landing Site Navigator — Ay'a nerede ve ne zaman inmeliyiz?

## 1. Jüri sunumu (yerel)

Aşağıdaki sıra `PITCH_DECK.md` içindeki yedi başlığı izler. Bunlar sunum iskeletidir; resmî puanlama ağırlıkları kaynaklarda yoktur. Canlı gösteri sitedeki **Sunum** modunun 7 bölümünü izler (konuşma metni ve ekranlar: **SUNUM_AKISI.md**). Konuşma yaklaşık 4 dakikadır; soru süresi ayrıdır.

### 1. Fırsat

- Güney kutbunda su buzu hedefleri ve Artemis III aday bölgeleri var. Görevin amacı, yer seçimini değiştiriyor.
- Hedef kullanıcılar: erken planlama yapan görev ekipleri, ticari iniş ekipleri ve sınıflar. Bunlar hedef kullanıcı gruplarıdır; müşteri anlaşması iddiası değildir.
- Açılışta hakemler QR ile odaya katılır. En fazla 8 kişi hedef, 7/14/28 gün ve haritada bir yer seçer. Telefon Türkçe açılır; EN seçeneği vardır.

### 2. Problem

- Kutba yakın Güneş ufka çok yakın hareket eder. Arazi hem Güneş'i hem Dünya'yı kapatabilir. Aynı yere farklı günlerde inmek farklı sonuç verir.
- Güneş, Dünya bağlantısı, batarya, eğim ve hedefe yakınlık birlikte değerlendirilmelidir.
- 2019–2025 ortası kayıt kümesinde 13 robotik iniş girişiminin 8'i yüzeye ulaştı, 5'i çarptı. Bu beş kazanın tamamını yer veya tarih seçimine bağlamayın.

### 3. Çözüm

- Görev hedefini, kalış süresini ve iniş aralığını seç. Motor her aday noktayı, her iniş gününü, saat saat değerlendirir. Güney kutbunda 2 km aralıklı **21.856**, Ay genelinde yaklaşık 30 km aralıklı **41.276** nokta vardır.
- NASA LOLA gerçek arazi ufku ve eğimi; JPL DE421 Güneş ve Dünya konumları; NASA DSN istasyon görünürlüğü; Diviner sıcaklıkları ve kalıcı gölge bölgeleri kullanılır. Buz yakınlığı, soğuk tuzaklara yakınlıktır; kazılarak doğrulanmış buz miktarı değildir.
- Yaklaşık **7,6 milyon saatlik kontrol**, tarayıcıda yaklaşık bir saniye. Bu yaklaşık bir örnektir; süre görev ayarlarına ve cihaza bağlıdır. Sonuçlar sıralı yerler, tarihler, GO/NO-GO ve risk tahminidir.
- Canlıda **Su buzu bul → kartlar → yer sayfası → Görevi anlat → Gerçek inişlerle sına → Gelişmiş/API** göster. 3D görünümlerde 200 m kutup ızgarası, bulunan yerlerde 5 m kaynak LOLA haritaları kullanılır. Bu, tüm aramanın 5 m çözünürlükte olduğu anlamına gelmez.

### 4. Kanıt

- **Operasyon sonu, model / gerçek (gün):** Blue Ghost 1 **15,0 / 14,6**; SLIM **11,9 / 12,0**; Chandrayaan-3 **12,3 / 11,6**; IM-1 **4,4 / 7,0**; Chang'e 6 **10,6 / 2,0**.
- IM-1 devrildi; fark modelin sınırını gösterir. Chang'e 6 iki gün sonra örnek getirmek için ayrıldı; bu bir güç arızası değildir. SLIM'in sayılarının yakın olması, aracın yöneliminin tam modellendiğini kanıtlamaz.
- README'deki ek kontroller: Güneş haritalarıyla karşılaştırmada medyan fark **+1,9 yüzde puanı**, korelasyon **0,96**. LOLA 40 m eğim haritasıyla **6.620 noktada** medyan fark **1,15°**, korelasyon **0,94**. Bunlar doğruluk garantisi değildir.
- Hakem düelloları ürünü denetmenin etkileşimli yoludur. Beş gerçek iniş karşılaştırmasının yerine bilimsel doğrulama sayılmaz.

### 5. Ölçek ve kullanım

- Aynı motor tarayıcıda ve mevcut açık API'de kullanılır: [adaptlab.us/api/v1](https://adaptlab.us/api/v1). API gelecek fikri olarak anlatılmamalı.
- `GET /api/v1/search` güney kutbunda arama yapar. `GET /api/v1/site` bir koordinatın en yakın ızgara noktasını değerlendirir. `GET /api/v1/sky` saatlik Güneş, Dünya ve DSN verisini verir. API'deki aramayı tüm Ay araması diye sunmayın.
- TR/EN arayüz, görev filmi, güney kutbunda araç sürme ve yürüyüş eğitim için kullanılabilir. Uygulama ilk ziyaretten sonra çevrimdışı çalışır; çevrimiçi yardımcı hizmetleri ayrıca düşünün.

### 6. Avantaj ve ekip

- QuickMap, Moon Trek ve JPL Horizons ayrıntılı analiz araçlarıdır. AdaptLab'ın odağı, görev hedefinden başlayıp yerleri ve tarihleri birlikte taramak ve sonucu anlaşılır vermektir. “Başka hiçbir araç yapmıyor” demeyin.
- Yer kartları, gerçek arazi, risk gerekçeleri ve aynı göreve göre hakem düellosu, kararın nedenini gösterir.
- Yusuf Kerim Kaymakçı teknik geliştirmeyi; Yusuf Çırpan sunumu ve jüri deneyimini üstlenir.
- Proje etkinlikten önce de vardı. `pre-hackathon` etiketi, `e616415` sürümü sınırı gösterir. Eski temel ve etkinlikte eklenen işler README'de ayrıdır.

### 7. Vizyon ve kapanış

- **Bugün:** çalışan TR/EN uygulama, kutup ve tüm Ay taraması, gerçek iniş karşılaştırmaları ve açık API.
- **Sonra:** daha yüksek çözünürlüklü araziyi yer sıralamasına taşımak; araçlara özel güç ve bağlantı hesaplarını geliştirmek. 3D'deki ince araziyi, arama çözünürlüğüyle karıştırmayın.
- **Daha sonra:** yeni inişlerle karşılaştırmaları genişletmek. Başka havasız gökcisimlerine uyarlama bir vizyondur; tamamlanmış özellik değildir.
- Oda'da sonuçları gösterip Kapanış'a geçin. Ekip ve QR açık kalsın. “Bu bir planlama aracı; iniş sertifikası vermiyor” cümlesini söyleyin. Ekrandaki kapanış sloganını bilimsel garanti gibi savunmayın.

## 2. Kartlardaki sayılar ne demek?

- **01, 02…:** Seçili sıralamaya göre sıra numarası. Mutlak bir kalite puanı değildir.
- **“Shackleton kraterinin 6,7 km B'si”:** Kratere göre konum; B, batı demektir. Krater merkezine inildiği anlamına gelmez.
- **“UYGUN 4/30”:** İncelenen 30 olası iniş gününün 4'ünde, seçilen kalış süresi boyunca model koşulları sağlanır. Dört gün kalınacağı veya başarı olasılığının 4/30 olduğu anlamına gelmez.
- **“En iyi 12 Eyl 2027”:** Bu yer ve görev için Güneş, Dünya bağlantısı ve batarya rezervi bileşimine göre en iyi iniş günü. Başka görevde değişebilir.
- **“%50 şans”:** Kartta yalnız **En yüksek başarı** sıralamasında görünür. Kart hesabındaki 300 benzetimin yaklaşık yarısı başarılıdır. Fırlatma gecikmesi, ufuk hatası, batarya aşınması, ayak altı eğimi ve iniş geçmişi etkiler. Kesin uçuş olasılığı değildir.
- **GO / NO-GO:** Seçilen koşullara göre model kararıdır. API varsayılanları: en az %70 Güneş, %50 Dünya bağlantısı; en çok 48 saat kesintisiz karanlık; 2.000 Wh batarya; noktada en çok 8° eğim. Kutupta 1.000 m yarıçaplı iniş alanının %95'i en çok 12° eğim koşulunu sağlamalıdır. DSN kontrolü varsayılan olarak açıktır.

**İki pencereyi ayırın:** Uygulama kartındaki 4/30 örneği 30 iniş gününü anlatır. Canlı düello 12 günlük iniş aralığını kullanır. 7, 14 ve 28 gün ise Ay'da kalış süresidir. Örnek kart değerlerini ancak ekranda öyleyse okuyun.

## 3. Jüri soruları ve kısa cevaplar

### 1. Hangi verileri kullanıyorsunuz?

Arazi ve eğimler NASA LRO LOLA'dan, sıcaklık ve buz kararlılığı Diviner'dan geliyor. Güneş ve Dünya konumlarında JPL DE421, haberleşmede NASA DSN istasyon görünürlüğü kullanılıyor. Kalıcı gölge haritaları soğuk tuzakları değerlendirmeye yardım ediyor.

### 2. Ne kadar hassas?

Arama noktaları kutupta 2 km, Ay genelinde yaklaşık 30 km aralıklı. Eğim verisi 40 m haritadan geliyor; küçük kayaları ve kraterleri çözmüyor. 3D'de daha ince harita göstermek aramanın da o çözünürlükte yapıldığı anlamına gelmiyor.

### 3. Başarı yüzdesi neden düşük?

GO ideal planın koşulları sağladığını söyler. Yüzde hesabı gecikme, ufuk hatası, batarya aşınması ve eğim riskini de ekler; karttaki hesap ayrıca 13 girişimden 8'inin yüzeye ulaştığı geçmiş kaydını kullanır. Yüzeye ulaşmak ile görevi tamamlamak aynı şey değildir.

### 4. Yüzde kaç benzetimden geliyor; her seferinde değişiyor mu?

Kart için verilen sayı 300 benzetimdir; olasılık fonksiyonunun varsayılanı 400'dür. Aynı girdilerde sabit rastgelelik tohumu aynı sonucu verir. Bu, belirsizliğin yok olduğu anlamına gelmez.

### 5. Mevcut araçlardan farkınız ne?

QuickMap, Moon Trek ve JPL Horizons ayrıntılı inceleme için değerlidir. Biz görev hedefinden başlayıp çok sayıda yeri ve iniş gününü birlikte sıralıyor, kararı ve sınırını tek akışta gösteriyoruz. Rakiplerin bütün özelliklerini karşılaştırdığımızı iddia etmiyoruz.

### 6. Nasıl doğruladınız?

Beş gerçek inişi aynı motorla yeniden değerlendirdik; operasyon sonlarını gerçek sürelerle karşılaştırdık. Ayrıca NASA haritalarıyla ufuk ve eğim karşılaştırmaları, Python ile tarayıcı motoru arasında testler var. Beş örnek, her görev için doğruluk kanıtı değildir.

### 7. Beş inişin hepsi tutuyor mu?

Hayır; IM-1'de model 4,4, gerçek operasyon 7,0 gündür ve araç devrilmiştir. Chang'e 6'da 10,6 ve 2,0 gün farkı vardır; görev iki gün sonra planlı olarak ayrılmıştır. Bu örnekleri saklamıyoruz.

### 8. Güneş süresiyle operasyon süresi aynı mı?

Hayır. Batarya, aracı gün batımından sonra bir süre taşıyabilir; görev de Güneş bitmeden planlı olarak sona erebilir. Buradaki 15,0/14,6 gibi değerler operasyon sonu karşılaştırmasıdır; eski metinlerdeki 14,5 günlük Güneş hesabıyla karıştırmayın.

### 9. Neden güney kutbu?

Su buzu hedefleri ve Artemis III aday bölgeleri burada. Alçak Güneş nedeniyle arazi ufku, enerji ve Dünya bağlantısında belirleyici oluyor. Buz yakınlığı, o noktada kullanılabilir buzun kesin bulunduğu anlamına gelmez.

### 10. Dünya görünüyorsa neden DSN de gerekiyor?

Aracın Dünya'yı görmesi bağlantının bir tarafıdır. Goldstone, Madrid veya Canberra'daki bir DSN istasyonunun da Ay'ı görmesi kontrol edilir. Bu geometrik kontrol, gerçek anten rezervasyonu veya garanti edilmiş haberleşme kapasitesi değildir.

### 11. API ne işe yarıyor?

Başka yazılımlar aynı motoru kullanarak güney kutbunda yer arayabilir, bir noktayı inceleyebilir ve saatlik gökyüzü verisi alabilir. Canlı adres `adaptlab.us/api/v1`; yollar `/search`, `/site`, `/sky`. Koordinat sorguları en yakın ızgara noktasına gider; sonuç ayrıntılı iniş sertifikası değildir.

### 12. API'nin sınırları var mı?

Uzun aramaların iniş penceresi sunucu süre sınırı için kısaltılabilir; yanıt bunu bildirir. `/sky` en fazla 720 saat döndürür. İniş alanı kontrolü güney kutbuyla sınırlıdır.

### 13. Yapay zekâyı nerede kullandınız?

Geliştirme ve görsel kontrollerde Claude Code, OpenAI Codex ve xAI Grok kullanıldı. Uygulamadaki isteğe bağlı Luna, Gemini ile sonuçları açıklar; seslendirmede ElevenLabs kullanılır. GO/NO-GO ve gösterilen sayılar veriden ve hesap motorundan gelir; üretken modelden gelmez.

### 14. Görsellerde yapay zekâ var mı?

Teslim metni, Grok Imagine ile üretilmiş olabilecek dekoratif görseller için henüz doldurulmamış bir alan içeriyor. Hangi görsellerin son sürümde kaldığı ve araç listesi **[KONTROL ET]**. Kesinleşmeden “hiç yok” demeyin.

### 15. Etkinlikten önce ne vardı?

README'ye göre `pre-hackathon` / `e616415` sınırına kadar yer arama, ufuklar, iniş aracı ve gezgin görünümleri ile Python planlayıcı zaten vardı. Tüm projeyi bu hafta sonu sıfırdan yaptığımızı söylemiyoruz.

### 16. Etkinlik sırasında ne eklendi?

README iniş alanı eğim kontrolünü, buz soğuk tuzağı mesafelerini, bilim–hayatta kalma karşılaştırmasını ve Artemis bölge karşılaştırmasını listeliyor. Senaryolar, uçuş rotası, çevrimdışı Luna rehberi, yenilenen film, zaman çizelgesi, koordinat girişi ve gerçek iniş karşılaştırmaları da etkinlik katkıları arasında.

### 17. Kim kullanır; gelir modeli ne?

Hedefimiz görev ekiplerinin ön elemesi ve eğitim kullanımı. API, ekiplerin kendi araçlarına bağlanma yoludur. Doğrulanmış müşteri, pilot, gelir veya fiyat bilgisi kaynaklarda yok; bunlar **[KONTROL ET]**.

### 18. Bir sonraki adım ne?

Daha ayrıntılı araziyi yer sıralamasında kullanmak ve araçlara özel güç ile bağlantı hesaplarını geliştirmek. Yeni inişlerle karşılaştırmaları artırmak istiyoruz. API zaten mevcut; onu henüz yapılmamış bir özellik diye sunmuyoruz.

### 19. Neden 28 gün hiç GO olmuyor?

Bu canlı düellonun koşullarında hiçbir yer 28 günlük kalışı 48 saatten uzun karanlığa girmeden tamamlayamıyor. Bu yüzden GO çıkmıyor. Bu, farklı enerji kaynakları olan her aracın 28 gün yaşayamayacağı iddiası değildir.

### 20. Düello kazananı nasıl seçiyor?

Önce en az bir uygun iniş günü bulunan yer, hiç bulunmayana üstün gelir. Buz veya Artemis hedefinde ardından hedefe uzaklık değerlendirilir; 15 km içi hedefe yakın sayılır. Sonra 12 günlük aralıktaki uygun iniş günü sayısı, ardından Güneş ve Dünya bağlantısı karşılaştırılır.

### 21. Hakemler genellikle neden kaybediyor?

Haritada rastgele dokunulan noktalar gölgeli kraterlere düşebilir. Düello aynı hedef ve süreyle karşılaştırma yapar; kart kazananı, nedenini ve hakemin seçimine yakın daha iyi bir yeri gösterir. Her hakemin mutlaka kaybedeceğini söylemiyoruz.

### 22. İnişi garanti ediyor musunuz?

Hayır. Bu bir planlama ve ön eleme aracı. Küçük engeller, gerçek aracın ayrıntılı davranışı ve model belirsizliği nedeniyle uçuş için ayrı mühendislik doğrulaması gerekir.

### 23. İnternet kesilirse çalışır mı?

Uygulama ilk ziyaretten sonra çevrimdışı kullanılabilir. Bu bilgi, canlı hakem odasının veya Gemini gibi çevrimiçi hizmetlerin de çevrimdışı çalıştığını göstermez. Telefon bağlantısı bozulursa Test telefonu ile açıkça etiketlenmiş bir test planı gösteririz.

## 4. NASA (global) değerlendirmesi

Yerel canlı konuşma ile global teslim ayrıdır. Bu bölüm yalnız `SUBMISSION.md` ve `00-PRESENTATION-GUIDE.md` içindeki bilgilere dayanır; resmî 2026 formunun güncel kuralları ayrıca **[KONTROL ET]**.

### Teslimde bulunması gerekenler

- **Proje sayfası:** proje adı, yaklaşık 150 kelimelik özet, sorun, çözüm, çalışma biçimi, doğrulama, sınırlar, teknoloji, ekip ve görevler. `SUBMISSION.md` metni başlangıçtır. Form alanları ve son teslim saati **[KONTROL ET]**.
- **Demo:** kaynaklara göre en fazla **30 saniyelik, İngilizce altyazılı video** veya **başlık dahil en fazla 7 İngilizce slayt**. Rehber 7 slayt der; teslim taslağı üst sınır olarak 7 der. En güvenli hazırlık tam 7 slayttır; güncel resmî kural **[KONTROL ET]**. Dört dakikalık yerel konuşma veya 75 saniyelik video global demo yerine kullanılmamalı.
- **Bağlantılar:** uygulama [adaptlab.us](https://adaptlab.us), kod [github.com/yutuf/lmNasa](https://github.com/yutuf/lmNasa). Son 30 saniyelik videonun ve sunumun paylaşılabilir bağlantıları taslakta boş; bağlantılar ve oturum açmadan erişim **[KONTROL ET]**.
- **NASA verisi:** LOLA yükseklik ve 40 m eğim haritaları; Diviner sıcaklık ve buz kararlılığı; kalıcı gölge haritaları; JPL DE421/NAIF SPICE; DSN istasyon geometrisi. Her birinin hangi karara girdiğini açıklayın. DSN'yi gerçek rezervasyon takvimi gibi sunmayın.
- **Diğer NASA kaynakları:** teslim taslağı LROC WAC Ay dokusunu, Blue Marble Dünya dokusunu, Artemis III aday bölgelerini ve CLPS listesini de sayıyor. Doku kullanımını bilimsel hesap doğrulaması gibi anlatmayın.
- **AI açıklaması:** geliştirmede Claude Code, Codex ve Grok; Luna'da Gemini; seslendirmede ElevenLabs. Son sürümde kalan üretilmiş dekoratif görsellerin listesi **[KONTROL ET]**. Motor çıktısı ile üretken içeriği açıkça ayırın.
- **Etkinlik öncesi çalışma:** `pre-hackathon` etiketi / `e616415` ve README'deki önce–sonra ayrımı. “Her şeyi etkinlikte yaptık” yazmayın.

### Global ölçütlere hangi kanıtla cevap verilir?

İzin verilen kaynaklar NASA'nın resmî global ölçütlerini tek tek listelemiyor. **Resmî ölçüt adları, sayısı ve ağırlıkları [KONTROL ET].** Aşağıdakiler resmî ölçüt adı iddiası taşımayan hazırlık başlıklarıdır. Form doğrulanınca her resmî ölçütü ilgili kanıtla eşleştirin; yedi yerel sunum başlığını NASA puanlama listesi diye aktarmayın.

- **Challenge'a yanıt:** “Nerede ve ne zaman?” sorusunu yer ve tarih sıralamasıyla cevaplıyoruz. Kanıt: hedef seçimi, kart, GO günleri ve en iyi tarih.
- **NASA verisinin kullanımı:** LOLA ufku ve eğimi, DE421 gökyüzü, DSN görünürlüğü, Diviner ve gölge haritaları bir karara bağlanıyor. Kanıt: kaynak açıklaması ve tek yerin sonuçları.
- **Bilimsel geçerlilik:** beş gerçek iniş, bağımsız harita karşılaştırmaları ve Python–tarayıcı testleri. IM-1 ve Chang'e 6 farkları, örneklerin sınırı ve planlama uyarısı birlikte verilir.
- **Yenilik ve yaklaşım:** görev hedefiyle çoklu yer/tarih araması; riskin nedenini gösterme; aynı koşullarda canlı düello. Kanıt: uygulama akışı. “Dünyada ilk” iddiası yoktur.
- **Fayda ve büyüme:** görev ekipleri için ön eleme, API ile entegrasyon, sınıflar için TR/EN ve 3D anlatım. Kanıt: çalışan API ve arayüz. Müşteri veya gelir sayısı gösterilmez.
- **Anlaşılabilir sunum:** kısa İngilizce teslim, okunur gerçek ekranlar, açık kaynak bağlantıları, ekip katkıları ve AI açıklaması. Kanıt: son video veya 7 slayt; dosyaların son hâli ve erişimi **[KONTROL ET]**.

### Eski taslaklardan taşınmaması gerekenler

- `PITCH_DECK.md` API'yi fikir olarak anlatıyor; görev ve API kaynakları bunun artık mevcut olduğunu doğruluyor. Güncel yolları kullanın.
- README ve eski sunum metinlerindeki 14,5 / 11,9 günlük Güneş değerleri, buradaki 15,0 / 12,3 günlük operasyon tahminleriyle aynı ölçüm değildir. Operasyon karşılaştırmasında görevdeki güncel beş çifti kullanın.
- 300 kart benzetimi ile fonksiyonun 400 varsayılanı farklıdır. “Her yerde tam 300” demeyin.
- Gelecek CLPS uçuş tarihleri taslakta doğrulama bekliyor. Sunum için gerekli değil; burada tarih iddiası kullanılmadı.

Kaynaklar: [görevdeki doğrulanmış bilgiler](../CODEX_TASK_SUNUM.md), [README](../README.md), [teslim taslağı](SUBMISSION.md), [pitch sırası](PITCH_DECK.md), [rehber](00-PRESENTATION-GUIDE.md), [video akışı](DEMO_VIDEO_SCRIPT.md), [web demosu](../docs/DEMO_WEB.md), [operasyon testleri](../web/src/history.ops.test.ts), [olasılık hesabı](../web/src/probability.ts), [API](../web/api/v1/index.ts).
