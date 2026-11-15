# AdaptLab: jüri sunumu akışı ve konuşma metni

**Takım:** No Limits Lunar. **Yusuf Kerim Kaymakçı:** motor, veri, web uygulaması. **Yusuf Çırpan:** sunum ve jüri deneyimi.
**Challenge:** Lunar Landing Site Navigator: Ay'a nereye ve ne zaman inmeli? **Site:** adaptlab.us
**Süre:** 4 dakika konuşma, ardından sorular.

Bu belge iki taslağın birleşimidir: 7 slaytlık anlatı yapısı (Fırsat, Problem, Çözüm, Kanıt, Ölçek, Avantaj ve Ekip, Vizyon) ve
bizim canlı uygulama akışımız (önce hakem QR'ı, sonra gerçek uygulama, sonra düellolar). Ayrı bir slayt dosyası yok:
her bölüm, sitedeki **Sunum** modunun bir ekranıdır. Alt+Tab yok.

## Başlamadan

- Bilgisayarda **adaptlab.us/#present=1&lang=tr** adresini açın (ya da üstteki **Sunum** düğmesi). Tam ekran: F11.
- Sağ alttaki çubuk 7 bölümü gösterir. **PageDown** ileri, **PageUp** geri (sunum kumandası da çalışır).
  **Hakemler** düğmesi düello ekranını her an açıp kapatır.
- Hakem odası sunumun başından sonuna kadar açık kalır; telefonlar bağlı kalır.
- Önceden bir kez açıp yükleyin (veri ilk açılışta iner, sonra hızlıdır).

## 7 bölüm bir bakışta

| # | Bölüm | Süre | Ekranda | Konuşan |
|---|---|---|---|---|
| 1 | Fırsat | 0:00–0:30 | Hakem odası: büyük QR ve oda kodu | Yusuf Çırpan |
| 2 | Problem | 0:30–1:00 | Gelişmiş görünüm, saat saat oynayan Güneş ışığı haritası | Yusuf Çırpan |
| 3 | Çözüm | 1:00–1:50 | Basit görünüm: su buzu sonuçları, bir yer sayfası | Yusuf Kerim |
| 4 | Kanıt | 1:50–2:40 | Gerçek inişler paneli, sonra hakem düelloları | Yusuf Kerim, sonra Yusuf Çırpan |
| 5 | Ölçek | 2:40–3:05 | Kimler kullanır ve canlı API çağrısı | Yusuf Kerim |
| 6 | Avantaj ve ekip | 3:05–3:30 | Neyi farklı yapıyoruz ve ekip | Yusuf Çırpan |
| 7 | Vizyon | 3:30–4:00 | Kapanış: slogan, Bugün / Sonra / Ardından, QR | Yusuf Çırpan |

---

## Bölüm 1: Fırsat (0:00–0:30)

**Ekranda:** Hakem odası. Büyük QR, dört harfli oda kodu ve "Kodu tara. Bir iniş planla. AdaptLab'ı yen."
Hakemler telefonla tarar; telefonda üç seçim yaparlar: görev (Güvenli iniş, Su buzu, Artemis III, En çok güneş),
kalış (7, 14, 28 gün) ve krater haritasında bir iniş noktası. En fazla 8 hakem.

**Konuşma (Yusuf Çırpan):**
> "Merhaba, biz No Limits Lunar: ben Yusuf Çırpan, bu Yusuf Kerim Kaymakçı.
> Artemis ve NASA'nın ticari CLPS iniş araçları Ay'ın güney kutbuna gidiyor: su buzu ve Artemis III'ün bütün aday bölgeleri orada.
> Ama orada inişte yer kadar gün de önemli. Bunu size göstermek için önce sizi oyuna alalım:
> ekrandaki kodu telefonunuzla okutun, bir görev ve bir iniş noktası seçin. Biz anlatırken siz planlayın;
> birazdan sizin yerinizi AdaptLab'ın seçimiyle yarıştıracağız."

**Tıklama:** Hakemler okuturken bekleyin (çubukta "Hakemler 3/8" sayısı artar). Sonra **PageDown**.

## Bölüm 2: Problem (0:30–1:00)

**Ekranda:** Gelişmiş görünüm, küre haritası **Güneş ışığı** modunda saat saat oynar: aydınlık ve gölge kutup bölgesinde sürekli yer değiştirir.

**Konuşma (Yusuf Çırpan):**
> "Kutupta Güneş hiç yükselmez; en fazla bir buçuk derece kadar çıkar ve ufku dolaşır.
> Bu açıyla bir kilometrelik bir sırt yaklaşık 40 kilometre gölge atar. Haritada Güneş ışığını saat saat oynatıyoruz: kutupta aydınlık ve gölge sürekli yer değiştiriyor.
> Güneş paneli gölgede kalan araç bataryadan yer; Dünya bir krater duvarının arkasında kalırsa telsiz bağlantısı kesilir.
> Gerçekte de böyle oldu: IM-1 inişte devrildi ve yedi günde karardı; Chandrayaan-3 ilk Ay gecesinden uyanmadı.
> Yani soru sadece 'nereye' değil: 'nereye ve ne zaman'."

**Tıklama:** **PageDown**.

## Bölüm 3: Çözüm (1:00–1:50)

**Ekranda:** Basit görünüm, hedef **Su buzu**, güney kutbu. En iyi iniş yerleri kartları.

**Konuşma (Yusuf Kerim):**
> "AdaptLab'a görevin amacını söylüyorsunuz; burada su buzu, 14 gün kalış.
> Motor güney kutbunda 2 kilometre aralıklı 21.856 noktanın her birini, her iniş gününün her saati için kontrol ediyor:
> Güneş gerçek arazi ufkunun üstünde mi, Dünya görünüyor mu ve NASA'nın Derin Uzay Ağı anteni Ay'ı görüyor mu,
> en uzun karanlık kaç saat, batarya yetiyor mu, zemin yeterince düz mü.
> Bu, tarayıcıda yaklaşık bir saniyede 7,6 milyon saatlik kontrol.
> Veriler NASA'nın: LRO LOLA arazisi, JPL DE421 Güneş ve Dünya konumları, DSN istasyonları.
> Her kart bir iniş yeri: 'UYGUN 4/30', 30 iniş gününün 4'ünde görevin işe yaradığı demek; 'en iyi' o yer için en iyi iniş günü."

**Tıklama:** İlk kartı açın. Yer sayfasında:
> "Bu, o yerin gerçek arazisi, iniş gününün Güneşiyle. UYGUN ya da DEĞİL kararı ve nedeni burada; en büyük risk de."

İsterseniz **Görevi anlat** ile filmi 10–15 saniye gösterin (fırlatma, iniş, gezgin), **Esc** ile çıkın. Sonra **PageDown**.

## Bölüm 4: Kanıt (1:50–2:40)

**Ekranda:** "Modelimiz ve gerçek inişler" paneli: 5 iniş; kırmızı çizgi modelin tahmini, beyaz çizgi gerçek son.

**Konuşma (Yusuf Kerim, 25 sn):**
> "Bir planlama aracı ancak doğruysa işe yarar. Aynı motoru Ay'a inmiş beş gerçek göreve uyguladık.
> Blue Ghost 1: model 15,0 gün, gerçek 14,6. SLIM: 11,9'a karşı 12,0. Chandrayaan-3: 12,3'e karşı 11,6.
> Her örnek tutmuyor ve bunu saklamıyoruz: IM-1 devrildiği için model 4,4 gün derken araç 7 gün çalıştı;
> Chang'e 6 ise örnek toplayıp iki günde planlı olarak ayrıldı.
> Ayrıca Güneş hesabımızı NASA'nın bağımsız aydınlanma haritalarıyla 32 noktada karşılaştırdık: korelasyon 0,96."

**Tıklama:** Çubukta **Hakemler** düğmesi: düello kartları açılır.

**Konuşma (Yusuf Çırpan, 25 sn):**
> "Şimdi sizin planlarınız. Her kartta sizin yeriniz, aynı görev ve aynı kalış için AdaptLab'ın seçimiyle karşı karşıya.
> Önce inebilen yer kazanır; buz ya da Artemis hedefinde hedefe yakınlık, sonra uygun gün sayısı, sonra Güneş ve Dünya bağlantısı.
> Kart nedenini ve size yakın daha iyi bir yeri de söylüyor."

Ekrandaki bir kartı okuyun. Hakem kazandıysa bunu söyleyin. 28 günlük plan varsa:
> "28 günde hiçbir yer 48 saatten uzun bir Ay gecesinden kaçamıyor; bu batarya ile o süre UYGUN değil."

**Tıklama:** **PageDown** (düello ekranı kapanır, Ölçek açılır).

## Bölüm 5: Ölçek (2:40–3:05)

**Ekranda yazanlar:**
- Manşet: **Aynı motor, açık API: görev ekipleri kendi yazılımından sorar.**
- Üç kart: **Görev planlama ekipleri** (CLPS iniş aracı yapan şirketler, erken aşama yer ve tarih elemesi) ·
  **Gezgin ve bilim ekipleri** (buz hedefine yakın, güneş alan yerler) · **Eğitim** (TR/EN arayüz, 3D film, sınıfta canlı oyun).
- Canlı API kutusu: `GET adaptlab.us/api/v1/search?...` ve gelen yanıt: "200 · 5 yer · 1,0 sn".

**Konuşma (Yusuf Kerim):**
> "AdaptLab sadece bir web sayfası değil. Aynı motor açık bir API olarak çalışıyor: bir görev ekibi kendi planlama yazılımından
> 'bu tarihlerde, bu görev için en iyi yerler nerede' diye sorabiliyor. Ekrandaki çağrı şu an canlı yapıldı.
> Kullanıcılarımız: iniş aracı yapan ekipler, buz arayan gezgin ekipleri ve sınıflar. Bunlar hedef kitle; henüz müşteri iddiamız yok."

**Tıklama:** **PageDown**.

## Bölüm 6: Avantaj ve ekip (3:05–3:30)

**Ekranda yazanlar:**
- Manşet: **Harita nereyi gösterir; AdaptLab nereye ve ne zaman inileceğini sıralar.**
- Dört satır: görev hedefinden başlar · her yeri her iniş günü için saat saat tarar · kararın nedenini gösterir ·
  gerçek inişlerle sınanmış ve sınırını söyler.
- Ekip: Yusuf Kerim Kaymakçı (motor, veri, web) · Yusuf Çırpan (sunum ve jüri deneyimi).

**Konuşma (Yusuf Çırpan):**
> "NASA'nın QuickMap ve Moon Trek gibi harika harita araçları var; bir yeri ayrıntılı incelemek için onları kullanıyoruz.
> AdaptLab'ın farkı yönde: görev hedefinden başlıyor, binlerce yeri ve iniş gününü birlikte sıralıyor ve kararın nedenini söylüyor.
> Yusuf Kerim motoru, veriyi ve web uygulamasını geliştirdi; ben sunumu ve bu hakem deneyimini kurdum.
> Projenin bir kısmı etkinlikten önce de vardı; ne zaman ne yaptığımız README'de açıkça yazıyor."

**Tıklama:** **PageDown**.

## Bölüm 7: Vizyon ve kapanış (3:30–4:00)

**Ekranda yazanlar:** "Kararan her aracın daha iyi bir yeri ya da daha iyi bir günü vardı. **AdaptLab onu bulur.**"
Bugün: canlı uygulama ve açık API, tüm Ay, 5 gerçek iniş · Sonra: daha ince Artemis arazisi, her araç için güç ve radyo bütçesi ·
Ardından: her yeni inişi canlı karşılaştırmak (IM-3, Griffin 1, 2026 CLPS araçları). Ekip adları ve adaptlab.us QR'ı.

**Konuşma (Yusuf Çırpan):**
> "Bugün AdaptLab çalışıyor: uygulama, açık API ve gerçek inişlerle karşılaştırma.
> Sırada daha ince Artemis arazisi ve her araca özel güç ve radyo hesabı var; ardından her yeni inişi canlı karşılaştırmak.
> AdaptLab bir planlama aracı; iniş sertifikası vermiyor. Ama şunu biliyoruz:
> kararan her aracın daha iyi bir yeri ya da daha iyi bir günü vardı. AdaptLab onu bulur. Teşekkürler, sorularınızı alalım."

**Tıklama:** Ekran açık kalsın (QR görünür). Sorulara geçin.

---

## Bir şey bozulursa

- **Telefonlar bağlanmıyor:** düello ekranında **Test telefonu** bir plan ekler. "Bu bir test planı" deyin.
- **Site yavaş:** bulunduğunuz ekranda kalın ve anlatmaya devam edin; sonuç gelmeden kazanan ilan etmeyin.
- **Film uzadı:** **Esc**.
- **Bir şey takıldı:** çubuktaki ✕ ile sunumdan çıkın, **Sunum** ile yeniden girin. Hakem odası yeniden kurulur (yeni kod).

## 30 saniyelik anlatım

Ay'ın güney kutbunda Güneş ufku sıyırır; bir sırt hem Güneş'i hem Dünya bağlantısını kesebilir, bu yüzden nereye kadar ne zaman da önemli.
AdaptLab'a görevin amacını söylüyorsunuz; NASA LOLA arazisi, JPL DE421 ve DSN verisiyle 21.856 noktayı her iniş günü için saat saat
tarıyor ve en iyi yerleri ve günleri nedenleriyle sıralıyor. Beş gerçek inişle sınadık; aynı motor açık API olarak da çalışıyor.
Biz No Limits Lunar; adaptlab.us.

---

## NASA (global) teslimi için 7 slayt

Global teslim İngilizcedir. Aşağıda her slaytın İngilizce manşeti ve içeriği var. Resmî biçim kuralı (7 slayt ya da 30 saniyelik video)
son kez NASA formundan kontrol edilmeli.

1. **Fırsat** — *"Every lander heading to the lunar south pole needs the right place and the right day."*
   Su buzu ve 9 Artemis III aday bölgesi güney kutbunda; CLPS iniş araçları oraya gidiyor. Görsel: kutup arazisi, Güneş ufukta.
2. **Problem** — *"At the pole the Sun skims the horizon: a 1 km ridge casts a ~40 km shadow."*
   Panel gölgede kalırsa batarya biter; Dünya krater arkasında kalırsa bağlantı kesilir. IM-1 7 günde karardı, Chandrayaan-3 uyanmadı.
3. **Çözüm** — *"Name the goal. AdaptLab finds where and when to land."*
   21.856 nokta × her iniş günü × her saat; Güneş, Dünya + DSN, en uzun karanlık, batarya, eğim. Görsel: hedef → arama → sonuç kartları.
4. **Kanıt** — *"Replayed 5 real landings with the same engine."*
   Model / gerçek (gün): Blue Ghost 1 15,0 / 14,6 · SLIM 11,9 / 12,0 · Chandrayaan-3 12,3 / 11,6 · IM-1 4,4 / 7,0 (devrildi) ·
   Chang'e 6 10,6 / 2,0 (planlı ayrılış). NASA aydınlanma haritalarıyla r = 0,96 (32 nokta).
5. **Ölçek** — *"Same engine, open API: adaptlab.us/api/v1."* `/search`, `/site`, `/sky`. Görev ekipleri, gezgin ekipleri, eğitim.
6. **Avantaj ve ekip** — *"Maps show where. AdaptLab ranks where and when, and says why."* Ekip ve görev dağılımı.
7. **Vizyon** — *"Every lander that went dark had a better place, or a better day. AdaptLab finds it."*
   Bugün / Sonra / Ardından, adaptlab.us QR, ekip adları.

---

## Önceki 7 slayt taslağından çıkarılanlar (neden)

- **"IM-1 tam öngördüğümüz gibi 7. günde sustu"**: yanlış. Model 4,4 gün dedi, araç 7 gün çalıştı; bu en zayıf örneğimiz. Dürüstçe söylüyoruz.
- **"8 km batıda 11 gün güneş alan sırt" (IM-1 cevabı)**: hiçbir yerde hesaplanmadı, uydurma.
- **"Tek bir sırt 50 km gölge yaratır"**: kaynak yok. 1,5° Güneş ile 1 km'lik sırt yaklaşık 38 km gölge atar; "yaklaşık 40 km" diyoruz.
- **"Düello motorumuzun daima daha iyi olduğunu kanıtlıyor"**: yanlış; hakem kazanabilir.
- **"İniş aracı 100 milyon doların üzerinde", "bir saatte entegre edilir", "planlama aylar sürüyor"**: kaynağımız yok.
- **"QuickMap / Moon Trek statik fotoğraf albümü"**: haksız ve yanlış (QuickMap'te aydınlanma katmanları var). Bir NASA jürisi bunu yakalar.
- **"300 adımlı Monte Carlo"**: 300 simüle görev; "adım" değil.
- **"İlk ekranda QR olmayacak"**: siz QR'ı başa istediniz; hakemler böylece bütün sunum boyunca planlayabiliyor.
- Ekip satırındaki kişisel bilgiler (okul, takım, IAC) bu belgeye alınmadı; doğruysa sözlü ekleyebilirsiniz.
- Eski 7 slayt taslağı yedek olarak: `presentation-kit/arsiv/SUNUM_AKISI_7slayt_taslak.md`.

Ayrıntılı soru-cevap ve kartlardaki sayıların anlamı: **SUNUM_ICERIGI.md**.
