const DEFAULT_MODEL = 'gemini-3.8-flash';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Yalnızca GET isteği kabul edilir.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  const shouldVerify = req.query?.verify === '1';

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      deployment: 'vercel',
      model,
      keyConfigured: false,
      error: 'GEMINI_API_KEY Vercel Environment Variables bölümünde tanımlı değil.'
    });
  }

  if (shouldVerify) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
        { headers: { 'x-goog-api-key': apiKey } }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return res.status(502).json({
          ok: false,
          deployment: 'vercel',
          model,
          keyConfigured: true,
          geminiStatus: response.status,
          error: data?.error?.message || `Gemini model kontrolü HTTP ${response.status} hatası verdi.`
        });
      }
    } catch (error) {
      return res.status(502).json({
        ok: false,
        deployment: 'vercel',
        model,
        keyConfigured: true,
        error: `Gemini API bağlantısı kurulamadı: ${error?.message || 'Bilinmeyen hata'}`
      });
    }
  }

  return res.status(200).json({
    ok: true,
    deployment: 'vercel',
    service: 'FitTrack food analysis API',
    model,
    keyConfigured: true,
    geminiVerified: shouldVerify
  });
}
