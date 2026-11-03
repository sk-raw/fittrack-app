const DEFAULT_MODEL = 'gemini-3.8-flash';
const MAX_BASE64_CHARS = 3_600_000;

const foodJsonSchema = {
  type: 'object',
  properties: {
    isFood: { type: 'boolean' },
    name: { type: 'string' },
    portionGrams: { type: 'integer' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
    confidence: { type: 'number' },
    note: { type: 'string' }
  },
  required: [
    'isFood', 'name', 'portionGrams', 'calories',
    'protein', 'carbs', 'fat', 'confidence', 'note'
  ],
  additionalProperties: false
};

function sendError(res, status, error) {
  return res.status(status).json({ error });
}

function isFiniteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function extractCandidateText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((part) => typeof part?.text === 'string' ? part.text : '').join('\n').trim();
}

function readableGeminiError(status, message) {
  if (status === 400) return `Gemini isteği reddetti: ${message}`;
  if (status === 401 || status === 403) return `Gemini API anahtarı geçersiz veya bu modele erişim yetkisi yok: ${message}`;
  if (status === 404) return `Gemini modeli veya API adresi bulunamadı. Vercel GEMINI_MODEL değişkenini kontrol edin. Ayrıntı: ${message}`;
  if (status === 429) return `Gemini kullanım kotası veya istek sınırı dolmuş. Google AI Studio'daki kota ve faturalandırma ayarlarını kontrol edin. Ayrıntı: ${message}`;
  if (status === 503) return 'Google Gemini şu anda yoğun (HTTP 503). Sistem otomatik olarak tekrar denedi ancak servis yanıt vermedi. 30-60 saniye sonra yeniden deneyin.';
  if (status >= 500) return `Google Gemini geçici bir servis hatası verdi (HTTP ${status}). Sistem otomatik tekrar denedi; biraz sonra yeniden deneyin.`;
  return `Gemini API hatası (HTTP ${status}): ${message}`;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'Bu adres yalnızca POST isteği kabul eder.');
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return sendError(res, 500, 'Vercel ortam değişkenlerinde GEMINI_API_KEY tanımlı değil. Vercel Project Settings > Environment Variables bölümüne ekleyin ve yeniden deploy edin.');
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { imageBase64, mimeType } = body;
    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

    if (typeof imageBase64 !== 'string' || imageBase64.length < 100) {
      return sendError(res, 400, 'Fotoğraf verisi eksik veya geçersiz.');
    }
    if (imageBase64.length > MAX_BASE64_CHARS) {
      return sendError(res, 413, 'Fotoğraf çok büyük. Daha küçük bir fotoğraf yükleyin.');
    }
    if (!allowedMimeTypes.has(mimeType)) {
      return sendError(res, 400, 'Desteklenmeyen görsel biçimi. JPEG, PNG veya WebP kullanın.');
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
      return sendError(res, 400, 'Fotoğraf Base64 verisi geçersiz.');
    }

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    if (!imageBuffer.length || imageBuffer.length > 2.7 * 1024 * 1024) {
      return sendError(res, 413, 'Fotoğraf boyutu çok yüksek. Daha küçük bir görsel deneyin.');
    }

    const model = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
    const prompt = [
      'Sen fotoğraftan yemek tanıyan ve besin değeri tahmini yapan bir asistansın.',
      'Gönderilen görseli gerçekten incele; yalnızca görselde görünen yiyecekleri değerlendir.',
      'Yemeğin adını Türkçe yaz.',
      'Fotoğrafta görülen toplam yenilebilir porsiyonun gramajını tahmin et.',
      'Kalori, protein, karbonhidrat ve yağ değerleri 100 gram için değil fotoğraftaki toplam porsiyonun tamamı için olmalı.',
      'Porsiyon büyüklüğü, görünen malzeme ve pişirme yöntemini dikkate al. Görünmeyen yağ, sos veya malzemeleri kesinmiş gibi varsayma.',
      'Besin değerleri yaklaşık tahminlerdir; kesin laboratuvar ölçümü gibi sunma. Belirsizliği note alanında açıkla.',
      'Fotoğrafta yiyecek yoksa veya yemek ayırt edilemiyorsa isFood=false, name boş metin, portionGrams=0 ve tüm besin değerleri 0 olsun.',
      'Rastgele, sabit veya örnek değerler üretme. Görüntüdeki porsiyona göre tahmin yap.',
      'confidence değerini 0 ile 1 arasında ver. Yanıtı yalnızca istenen JSON alanlarıyla döndür.'
    ].join(' ');

    // Google can temporarily return 503 when the model is overloaded.
    // Retry only transient server errors; do not retry quota/auth/client errors.
    const requestBody = JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: foodJsonSchema,
        maxOutputTokens: 512
      }
    });

    let geminiResponse;
    let lastNetworkError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 17_000);
      try {
        geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey
            },
            body: requestBody,
            signal: controller.signal
          }
        );
        if (![500, 502, 503, 504].includes(geminiResponse.status) || attempt === 2) {
          break;
        }
        console.warn(`Gemini temporary HTTP ${geminiResponse.status}; retry ${attempt + 1}/2`);
      } catch (networkError) {
        lastNetworkError = networkError;
        if (attempt === 2) throw networkError;
        console.warn(`Gemini network attempt ${attempt + 1}/3 failed; retrying`);
      } finally {
        clearTimeout(timeout);
      }
      await new Promise(resolve => setTimeout(resolve, 700 * (2 ** attempt)));
    }
    if (!geminiResponse && lastNetworkError) throw lastNetworkError;

    const geminiData = await geminiResponse.json().catch(() => ({}));
    if (!geminiResponse.ok) {
      const message = geminiData?.error?.message || 'Google API ayrıntılı hata mesajı döndürmedi.';
      console.error('Gemini API request failed:', geminiResponse.status, message);
      return sendError(res, 502, readableGeminiError(geminiResponse.status, message));
    }

    const candidate = geminiData?.candidates?.[0];
    if (!candidate) {
      const blockReason = geminiData?.promptFeedback?.blockReason;
      return sendError(res, 502, blockReason
        ? `Fotoğraf Gemini güvenlik filtresine takıldı (${blockReason}). Başka bir fotoğraf deneyin.`
        : 'Gemini analiz sonucu döndürmedi. Lütfen tekrar deneyin.');
    }

    const rawText = extractCandidateText(geminiData);
    if (!rawText) {
      return sendError(res, 502, 'Gemini boş yanıt verdi. Lütfen tekrar deneyin.');
    }

    let meal;
    try {
      meal = JSON.parse(rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim());
    } catch {
      console.error('Gemini JSON parse failed. finishReason:', candidate.finishReason);
      return sendError(res, 502, 'Gemini yanıtı geçerli JSON biçiminde değildi. Lütfen tekrar deneyin.');
    }

    if (typeof meal.isFood !== 'boolean' || typeof meal.name !== 'string') {
      return sendError(res, 502, 'Gemini geçersiz yemek tanıma sonucu döndürdü.');
    }

    const numericFields = ['portionGrams', 'calories', 'protein', 'carbs', 'fat', 'confidence'];
    if (numericFields.some((field) => !isFiniteNonNegative(meal[field]))) {
      return sendError(res, 502, 'Gemini geçerli besin değerleri döndürmedi.');
    }
    if (meal.confidence > 1) {
      return sendError(res, 502, 'Gemini güven puanı geçersiz.');
    }

    if (meal.isFood && (!meal.name.trim() || meal.portionGrams <= 0)) {
      return sendError(res, 502, 'Gemini yemek adını veya porsiyon gramajını belirleyemedi.');
    }

    return res.status(200).json({ meal: {
      isFood: meal.isFood,
      name: meal.name.trim(),
      portionGrams: Math.round(meal.portionGrams),
      calories: Math.round(meal.calories),
      protein: Math.round(meal.protein * 10) / 10,
      carbs: Math.round(meal.carbs * 10) / 10,
      fat: Math.round(meal.fat * 10) / 10,
      confidence: meal.confidence,
      note: typeof meal.note === 'string' ? meal.note : ''
    } });
  } catch (error) {
    if (error?.name === 'AbortError') {
      return sendError(res, 504, 'Gemini analizi zaman aşımına uğradı. Daha küçük bir fotoğrafla tekrar deneyin.');
    }
    console.error('Vercel food API error:', error?.message || error);
    return sendError(res, 500, 'Vercel analiz fonksiyonu beklenmeyen bir hata verdi. Vercel Runtime Logs kayıtlarını kontrol edin.');
  }
}
