require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

app.use(express.json({ limit: '10mb' }));

const foodSchema = {
  type: 'object',
  properties: {
    isFood: {
      type: 'boolean',
      description: 'Fotoğrafta yenilebilir bir yemek veya yiyecek açıkça görülüyorsa true.'
    },
    name: {
      type: 'string',
      description: 'Yemeğin Türkçe adı. Yiyecek yoksa boş metin.'
    },
    portionGrams: {
      type: 'integer',
      minimum: 0,
      description: 'Fotoğrafta görülen toplam yenilebilir porsiyonun tahmini gramı.'
    },
    calories: {
      type: 'number',
      minimum: 0,
      description: 'Fotoğrafta görülen porsiyonun tahmini toplam kcal değeri.'
    },
    protein: {
      type: 'number',
      minimum: 0,
      description: 'Fotoğrafta görülen porsiyonun tahmini protein miktarı, gram.'
    },
    carbs: {
      type: 'number',
      minimum: 0,
      description: 'Fotoğrafta görülen porsiyonun tahmini karbonhidrat miktarı, gram.'
    },
    fat: {
      type: 'number',
      minimum: 0,
      description: 'Fotoğrafta görülen porsiyonun tahmini yağ miktarı, gram.'
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'Görsel tanıma ve porsiyon tahmini için 0 ile 1 arasında güven puanı.'
    },
    note: {
      type: 'string',
      description: 'Türkçe, kısa belirsizlik veya porsiyon varsayımı notu.'
    }
  },
  required: [
    'isFood', 'name', 'portionGrams', 'calories', 'protein',
    'carbs', 'fat', 'confidence', 'note'
  ]
};

function getTextFromOutput(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text;

  const textParts = [];
  const visit = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object') {
      if (typeof value.text === 'string') textParts.push(value.text);
      else Object.values(value).forEach(visit);
    }
  };

  visit(payload?.outputs ?? payload?.output);
  if (textParts.length) return textParts.join('\n');
  return '';
}

function isFiniteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, model: GEMINI_MODEL });
});

app.post('/api/analyze-food', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Sunucuda GEMINI_API_KEY tanımlı değil. .env dosyasını kontrol edin.'
      });
    }

    const { imageBase64, mimeType } = req.body || {};
    const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

    if (typeof imageBase64 !== 'string' || imageBase64.length < 100) {
      return res.status(400).json({ error: 'Fotoğraf verisi eksik veya geçersiz.' });
    }
    if (!allowedMimeTypes.has(mimeType)) {
      return res.status(400).json({ error: 'Desteklenmeyen fotoğraf biçimi.' });
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
      return res.status(400).json({ error: 'Fotoğraf Base64 verisi geçersiz.' });
    }

    const imageBuffer = Buffer.from(imageBase64, 'base64');
    if (!imageBuffer.length || imageBuffer.length > 7 * 1024 * 1024) {
      return res.status(413).json({ error: 'Fotoğraf çok büyük. Daha küçük bir görsel deneyin.' });
    }

    const prompt = [
      'Sen bir yemek görseli ve besin değeri tahmin asistanısın.',
      'SADECE gönderilen fotoğrafı incele; fotoğrafı gerçekten analiz et.',
      'Fotoğrafta görünen yiyeceği Türkçe adlandır.',
      'Fotoğrafta görülen tüm yenilebilir yiyeceklerin toplam porsiyonunu gram olarak tahmin et.',
      'Kalori, protein, karbonhidrat ve yağ değerlerini bu fotoğraftaki porsiyonun TAMAMI için tahmin et; 100 gram başına değer verme.',
      'Görünmeyen malzemeleri kesinmiş gibi yazma. Yağ, sos, iç harç veya pişirme yöntemi görünmüyorsa belirsizliği note alanında belirt.',
      'Tabak, çatal veya el gibi nesneleri porsiyon ölçüsü olarak kesin kabul etme; gramaj tahmini yaklaşık olabilir.',
      'Fotoğrafta yemek/yiyecek yoksa veya görüntüden tanımlanamıyorsa isFood=false, name boş, portionGrams=0 ve besin değerleri 0 döndür.',
      'Gerçekçi tahmin yap; rastgele veya genel varsayılan sayılar kullanma.',
      'confidence alanı 0 ile 1 arasında olsun. note alanına kısa Türkçe açıklama yaz.'
    ].join(' ');

    const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        store: false,
        input: [
          { type: 'text', text: prompt },
          { type: 'image', data: imageBase64, mime_type: mimeType }
        ],
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: foodSchema
        }
      }),
      signal: AbortSignal.timeout(60000)
    });

    const geminiData = await geminiResponse.json().catch(() => ({}));
    if (!geminiResponse.ok) {
      const message = geminiData?.error?.message || `Gemini API HTTP ${geminiResponse.status}`;
      console.error('Gemini API error:', message);
      return res.status(502).json({ error: `Gemini analizi başarısız: ${message}` });
    }

    const rawText = getTextFromOutput(geminiData);
    if (!rawText) {
      console.error('Gemini response did not contain text output.');
      return res.status(502).json({ error: 'Gemini boş yanıt verdi. Lütfen tekrar deneyin.' });
    }

    let meal;
    try {
      meal = JSON.parse(rawText.trim());
    } catch (_parseError) {
      console.error('Gemini returned non-JSON output.');
      return res.status(502).json({ error: 'Gemini yanıtı okunamadı. Lütfen tekrar deneyin.' });
    }

    if (typeof meal.isFood !== 'boolean' || typeof meal.name !== 'string') {
      return res.status(502).json({ error: 'Gemini geçersiz bir analiz sonucu döndürdü.' });
    }

    const numericFields = ['portionGrams', 'calories', 'protein', 'carbs', 'fat', 'confidence'];
    if (numericFields.some((field) => !isFiniteNonNegative(meal[field]))) {
      return res.status(502).json({ error: 'Gemini geçerli besin değerleri döndürmedi.' });
    }
    if (meal.confidence > 1 || (meal.isFood && (!meal.name.trim() || meal.portionGrams <= 0))) {
      return res.status(502).json({ error: 'Gemini eksik veya geçersiz yemek bilgisi döndürdü.' });
    }

    return res.json({ meal });
  } catch (error) {
    console.error('Food analysis request failed:', error?.message || error);
    const message = error?.name === 'TimeoutError'
      ? 'Yapay zekâ analizi zaman aşımına uğradı. Lütfen tekrar deneyin.'
      : 'Sunucu analiz sırasında hata verdi. Sunucu kayıtlarını kontrol edin.';
    return res.status(500).json({ error: message });
  }
});

// Vite build alındıysa aynı sunucu arayüzü de sunabilir.
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(path.join(distPath, 'index.html'))) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`FitTrack API hazır: http://localhost:${PORT}`);
  console.log(`Gemini modeli: ${GEMINI_MODEL}`);
});
