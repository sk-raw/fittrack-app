require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
app.use(express.json({ limit: '4mb' }));
// Yerel geliştirme ve Vercel aynı analiz kodunu çalıştırır.
app.post('/api/analyze-food', async (req, res) => (await import('./api/analyze-food.js')).default(req, res));
app.get('/api/health', async (req, res) => (await import('./api/health.js')).default(req, res));
app.use(express.static(path.join(__dirname, 'dist')));
app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(__dirname, 'dist/index.html')));
app.listen(Number(process.env.PORT) || 3001, () => console.log('FitTrack API hazır'));
