import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnalysis, sumItems } from '../lib/nutrition.js';
import handler from '../api/analyze-food.js';
const item = { name: 'Tavuk', portionGrams: 150, source: 'estimate', per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 } };
const data = () => ({ isFood: true, confidence: 0.8, note: 'Pişmiş ağırlık tahmini', items: [structuredClone(item)] });
test('Porsiyon ve makrolar 100g değerlerinden hesaplanır', () => {
  const result = normalizeAnalysis(data());
  assert.equal(result.calories, 247.5); assert.equal(result.protein, 46.5); assert.equal(result.fat, 5.4);
});
test('Birden fazla besin toplanır; gramaj düzenlemesi yeniden hesaplanır', () => {
  const items = [structuredClone(item), { ...structuredClone(item), portionGrams: 50 }];
  assert.equal(sumItems(items).calories, 330);
  items[0].portionGrams = 100;
  assert.equal(sumItems(items).protein, 46.5);
});
test('Eksik makro sessizce sıfıra çevrilmez', () => {
  const input = data(); delete input.items[0].per100g.carbs;
  assert.throws(() => normalizeAnalysis(input), /eksik/);
});
test('Tutarsız kalori ve makro reddedilir', () => {
  const input = data(); input.items[0].per100g.calories = 800;
  assert.throws(() => normalizeAnalysis(input), /uyuşmuyor/);
});
test('Negatif, sayısal metin, NaN ve aşırı gramaj reddedilir', () => {
  for (const value of [-1, '100', NaN, 10001]) {
    const input = data(); input.items[0].portionGrams = value;
    assert.throws(() => normalizeAnalysis(input));
  }
});
test('Yiyecek olmayan fotoğraf değer üretmez', () => {
  assert.equal(normalizeAnalysis({ isFood: false, confidence: 0.9, items: [] }).isFood, false);
});
function res() { return { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
const request = { method: 'POST', body: { imageBase64: Buffer.alloc(120, 1).toString('base64'), mimeType: 'image/jpeg' } };
test('API akışı: JSON, düşünce metni, kesik yanıt, boş yanıt ve servis hatası', async t => {
  const oldFetch = globalThis.fetch; const oldKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-only';
  t.after(() => { globalThis.fetch = oldFetch; if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey; });
  let sent;
  globalThis.fetch = async (_url, options) => {
    sent = JSON.parse(options.body);
    return { ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'internal reasoning' }, { text: JSON.stringify(data()) }] } }] }) };
  };
  let response = res(); await handler(request, response);
  assert.equal(response.statusCode, 200); assert.equal(response.body.meal.protein, 46.5);
  assert.equal(sent.generationConfig.maxOutputTokens, 4096);
  for (const payload of [{ candidates: [{ finishReason: 'MAX_TOKENS' }] }, { candidates: [] }, { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{bad json' }] } }] }]) {
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => payload });
    response = res(); await handler(request, response); assert.equal(response.statusCode, 502);
  }
  globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({ error: { message: 'quota' } }) });
  response = res(); await handler(request, response); assert.match(response.body.error, /kota/);
});
test('Geçersiz dosya ve metot Google isteği yapmaz', async () => {
  const response = res(); await handler({ method: 'GET' }, response); assert.equal(response.statusCode, 405);
});
