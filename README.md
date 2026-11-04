# FitTrack

## Fotoğraf analizi düzeltmesi

- Gemini yapılandırılmış yanıtı her besin için porsiyon gramı ve 100g besin değerleri içerir.
- Kalori, protein, karbonhidrat ve yağ toplamlarını uygulama hesaplar. Gramaj düzenlemesi tüm değerleri yeniler.
- Etiket okunabiliyorsa etiket, aksi halde genel besin tahmini kullanılır. Tahminler doğrulanmış bir besin veritabanı sonucu değildir.
- Kesik/boş JSON, eksik makro, gerçekçi olmayan değer, kota, bağlantı ve süre hataları kontrol edilir.
- İki istek denemesi toplamda Vercel 60 saniye sınırının altında tutulur.
- Yerel sunucu, Vercel API kodunu kullanır. API anahtarı tarayıcıya gönderilmez.

## Çalıştırma

Node.js 22.12+ veya 24 kullanın.

```sh
npm ci
cp .env.example .env
# .env içine kendi GEMINI_API_KEY değerinizi ekleyin.
npm run dev:api
# İkinci terminalde:
npm run dev
```

```sh
npm test
npm run build
```

## Vercel

Bu değişiklikleri bağlı GitHub deposunun üretim dalına aktarın. Vercel'de GEMINI_API_KEY sunucu ortam değişkeni gerekir. GEMINI_MODEL isteğe bağlıdır; varsayılan gemini-2.5-flash. Eski/geçersiz bir model değişkeni varsa kaldırın veya desteklenen modelle değiştirin. Anahtarı VITE_ önekiyle tanımlamayın. Ardından yeniden deploy edin.

## Doğrulama durumu

8 otomatik test ve üretim derlemesi geçti. Testlerde Google yanıtları taklit edilmiştir; gerçek API anahtarıyla fotoğraf doğruluğu/kota/model erişimi henüz doğrulanmamıştır. Fotoğraf gramajı, yağ/sos miktarı ve etiket okunurluğu sonucu etkiler. Kalori/makro kontrolü fotoğraftaki ürünü doğru tanıdığını kanıtlamaz.

## Mevcut erişim sistemi

Mevcut uygulamanın giriş sistemi tarayıcı localStorage verilerine dayanır. Üretimde gerçek hesap ve sağlık verileri için sunucuda kimlik doğrulama ve kullanıcı bazında yetkilendirme ayrıca gerekir. Sabit yönetici girişi kaldırıldı. Yerel şifreler PBKDF2 ile özetlenir; eski hesaplar başarılı girişte taşınır. Bu hâlâ yerel prototip erişimidir, gerçek sunucu yetkilendirmesi değildir.
