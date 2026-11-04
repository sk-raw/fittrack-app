export const nutrients = ['calories', 'protein', 'carbs', 'fat'];
const numericSchema = { type: 'number', minimum: 0 };
export const foodJsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    isFood: { type: 'boolean' }, confidence: { type: 'number', minimum: 0, maximum: 1 }, note: { type: 'string' },
    items: { type: 'array', maxItems: 12, items: {
      type: 'object', additionalProperties: false,
      properties: { name: { type: 'string' }, portionGrams: numericSchema,
        source: { type: 'string', enum: ['label', 'estimate'] },
        per100g: { type: 'object', additionalProperties: false,
          properties: Object.fromEntries(nutrients.map(key => [key, numericSchema])), required: nutrients }
      }, required: ['name', 'portionGrams', 'source', 'per100g']
    } }
  }, required: ['isFood', 'confidence', 'note', 'items']
};
const validNumber = n => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const round = n => Math.round(n * 10) / 10;
export function sumItems(items) {
  const result = { portionGrams: round(items.reduce((sum, item) => sum + item.portionGrams, 0)) };
  for (const key of nutrients) result[key] = round(items.reduce((sum, item) => sum + item.per100g[key] * item.portionGrams / 100, 0));
  return result;
}
export function normalizeAnalysis(data) {
  if (typeof data?.isFood !== 'boolean' || !validNumber(data.confidence) || data.confidence > 1 || !Array.isArray(data.items)) throw new Error('Analiz eksik veya geçersiz. Yeniden deneyin.');
  if (!data.isFood) return { isFood: false, note: 'Fotoğrafta analiz edilebilecek yiyecek bulunamadı.' };
  if (!data.items.length || data.items.length > 12) throw new Error('Besinler belirlenemedi. Daha net bir fotoğraf deneyin.');
  for (const item of data.items) {
    if (!item.name?.trim() || !validNumber(item.portionGrams) || item.portionGrams <= 0 || item.portionGrams > 10000 || !['label', 'estimate'].includes(item.source) || nutrients.some(key => !validNumber(item.per100g?.[key]))) throw new Error('Besin veya porsiyon değerleri eksik. Yeniden deneyin.');
    const n = item.per100g;
    if (n.calories > 950 || n.protein + n.carbs + n.fat > 105 || n.calories === 0 && n.protein + n.carbs + n.fat > 0) throw new Error('Besin değerleri tutarsız. Yeniden deneyin.');
    const macroEnergy = n.protein * 4 + n.carbs * 4 + n.fat * 9;
    // Etiket yuvarlaması, lif ve polioller nedeniyle küçük farklara izin ver.
    if (Math.abs(n.calories - macroEnergy) > Math.max(40, n.calories * 0.3)) throw new Error('Kalori ve makro değerleri birbiriyle uyuşmuyor. Yeniden deneyin.');
  }
  return { isFood: true, name: data.items.map(item => item.name.trim()).join(', '), items: data.items,
    ...sumItems(data.items), confidence: data.confidence, note: typeof data.note === 'string' ? data.note : '' };
}
