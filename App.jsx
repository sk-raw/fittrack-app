import { hashPassword, passwordRecord } from '../lib/local-auth.js';
import { sumItems } from '../lib/nutrition.js';
import React, { useState, useRef, useEffect } from 'react';
import { Camera, LogOut, Shield, Activity, Flame, AlertCircle, Image as ImageIcon, Settings, Dumbbell, Plus, ChevronRight, ArrowLeft, Trash2, Check } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState('login'); // login, register, dashboard, admin, adminUserDetail
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAdminUser, setSelectedAdminUser] = useState(null);

  // Günlük Veri ve Hedef State'leri
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [meals, setMeals] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  
  // Yapay Zeka Onay / Düzenleme Modalı State'leri
  const [pendingMeal, setPendingMeal] = useState(null);
  const [showAIModal, setShowAIModal] = useState(false);

  const [targets, setTargets] = useState({ calories: 2500, protein: 150, carbs: 250, fat: 70 });
  const [isEditingTargets, setIsEditingTargets] = useState(false);

  // Antrenman Form State'i
  const [showWorkoutForm, setShowWorkoutForm] = useState(false);
  const [workoutData, setWorkoutData] = useState({ name: '', calories: '' });

  // Form Input State'leri
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user && !isAdmin) {
      const existingUsers = JSON.parse(localStorage.getItem('fittrack_users') || '[]');
      const currentUserData = existingUsers.find(u => u.email === user.email);
      if (currentUserData) {
        setMeals(currentUserData.meals || []);
        setWorkouts(currentUserData.workouts || []);
      }
    }
  }, [user]);

  const syncUserDatadrawer = (newMeals, newWorkouts) => {
    if (!user || isAdmin) return;
    try {
      const existingUsers = JSON.parse(localStorage.getItem('fittrack_users') || '[]');
      const updatedUsers = existingUsers.map(u => {
        if (u.email === user.email) {
          return { ...u, meals: newMeals, workouts: newWorkouts };
        }
        return u;
      });
      localStorage.setItem('fittrack_users', JSON.stringify(updatedUsers));
    } catch (e) {
      console.error("Senkronizasyon Hatası:", e);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!email.includes('@') || password.length < 6) {
      setAuthError('Geçerli bir e-posta ve en az 6 karakterli şifre girin.');
      return;
    }

    const existingUsers = JSON.parse(localStorage.getItem('fittrack_users') || '[]');
    const userExists = existingUsers.some(u => u.email === email);

    if (userExists) {
      setAuthError('Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapın.');
      return;
    }

    const newUser = { email, ...await passwordRecord(password), meals: [], workouts: [] };
    existingUsers.push(newUser);
    localStorage.setItem('fittrack_users', JSON.stringify(existingUsers));

    setPassword('');
    setUser({ email: newUser.email });
    setMeals([]);
    setWorkouts([]);
    setIsAdmin(false);
    setView('dashboard');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    
    const existingUsers = JSON.parse(localStorage.getItem('fittrack_users') || '[]');
    const foundUser = existingUsers.find(u => u.email === email);
    const matches = foundUser && (foundUser.passwordHash && foundUser.passwordSalt
      ? await hashPassword(password, foundUser.passwordSalt) === foundUser.passwordHash
      : foundUser.password === password);


    if (!matches) {
      setAuthError('E-posta adresi veya şifre hatalı.');
      return;
    }

    // Eski yerel hesaplar başarılı girişte düz metin şifreden taşınır.
    if (!foundUser.passwordHash) Object.assign(foundUser, await passwordRecord(password));
    delete foundUser.password;
    localStorage.setItem('fittrack_users', JSON.stringify(existingUsers));
    setPassword('');
    setUser({ email: foundUser.email });
    setMeals(foundUser.meals || []);
    setWorkouts(foundUser.workouts || []);
    setIsAdmin(false);
    setView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setIsAdmin(false);
    setSelectedAdminUser(null);
    setView('login');
    setEmail('');
    setPassword('');
  };

  // Fotoğrafı JPEG'e dönüştürür ve boyutunu küçültür.
  // Başarısız olursa orijinal görseli yanlış MIME türüyle göndermek yerine hata verir.
  const resizeImage = (file, maxWidth = 1600, maxHeight = 1600, quality = 0.85) => {
    return new Promise((resolve, reject) => {
      if (file?.size > 20 * 1024 * 1024) { reject(new Error('Lütfen 20 MB altında bir fotoğraf seçin.')); return; }
      if (!file || !file.type?.startsWith('image/')) {
        reject(new Error('Lütfen geçerli bir fotoğraf dosyası seçin.'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Fotoğraf okunamadı. Başka bir fotoğraf deneyin.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Fotoğraf açılamadı. JPG veya PNG formatında deneyin.'));
        img.onload = () => {
          try {
            const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
            const width = Math.max(1, Math.round(img.width * scale));
            const height = Math.max(1, Math.round(img.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Fotoğraf dönüştürülemedi.');

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            let dataUrl = canvas.toDataURL('image/jpeg', quality);
            if (dataUrl.length > 3500000) dataUrl = canvas.toDataURL('image/jpeg', 0.65);
            if (dataUrl.length > 3500000) throw new Error('Fotoğraf çok büyük. Daha küçük bir fotoğraf deneyin.');
            if (!dataUrl || !dataUrl.startsWith('data:image/jpeg;base64,')) {
              throw new Error('Fotoğraf JPEG formatına dönüştürülemedi.');
            }
            resolve({ dataUrl, mimeType: 'image/jpeg' });
          } catch (error) {
            reject(error);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAnalysisError('');
    setLoading(true);

    try {
      setUploadStatus('Fotoğraf hazırlanıyor...');
      const optimizedImage = await resizeImage(files[0]);

      setUploadStatus('Fotoğraf Gemini AI tarafından analiz ediliyor...');
      await processAI(optimizedImage);
    } catch (err) {
      console.error('Fotoğraf analiz/yükleme hatası:', err);
      setAnalysisError(err.message || 'Fotoğraf analiz edilemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
      setUploadStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processAI = async ({ dataUrl, mimeType }) => {
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) throw new Error('Fotoğraf verisi okunamadı.');

    // API anahtarı tarayıcıya gönderilmez. İstek kendi sunucu API rotamıza gider.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    let response;
    let result;
    try {
    response = await fetch('/api/analyze-food', {
      signal: controller.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Data, mimeType })
    });

    result = await response.json().catch(() => ({}));
    } catch (error) {
      throw new Error(error.name === 'AbortError' ? 'Analiz zaman aşımına uğradı. Tekrar deneyin.' : 'Analiz servisine ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.');
    } finally { clearTimeout(timeout); }
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Vercel analiz API rotası bulunamadı. Proje ana klasöründe api/analyze-food.js dosyasının bulunduğunu kontrol edip yeniden dağıtın.');
      }
      if (response.status === 413) {
        throw new Error('Fotoğraf Vercel istek sınırını aşıyor. Daha küçük bir fotoğraf deneyin.');
      }
      throw new Error(result.error || `Analiz servisi hata verdi (HTTP ${response.status}).`);
    }

    const aiResult = result.meal;
    if (!aiResult || aiResult.isFood !== true) {
      throw new Error(aiResult?.note || 'Fotoğrafta analiz edilebilecek bir yemek tespit edilemedi.');
    }

    const numericFields = ['calories', 'protein', 'carbs', 'fat', 'portionGrams'];
    for (const field of numericFields) {
      if (typeof aiResult[field] !== 'number' || !Number.isFinite(aiResult[field]) || aiResult[field] < 0) {
        throw new Error(`Yapay zekâ geçerli bir ${field} değeri döndürmedi. Lütfen tekrar deneyin.`);
      }
    }
    if (!aiResult.name || typeof aiResult.name !== 'string' || aiResult.portionGrams <= 0) {
      throw new Error('Yapay zekâ yemek adını veya porsiyon miktarını belirleyemedi.');
    }

    setPendingMeal({
      name: aiResult.name.trim(),
      items: aiResult.items || [],
      calories: aiResult.calories,
      protein: aiResult.protein,
      carbs: aiResult.carbs,
      fat: aiResult.fat,
      portionGrams: aiResult.portionGrams,
      confidence: aiResult.confidence,
      note: aiResult.note || '',
      date: selectedDate,
      image: dataUrl
    });
    setShowAIModal(true);
  };

  const updateItemPortion = (index, value) => {
    const grams = Number(value);
    if (!Number.isFinite(grams) || grams < 0 || grams > 10000) return;
    setPendingMeal(current => {
      const items = current.items.map((item, i) => i === index ? { ...item, portionGrams: grams } : item);
      return { ...current, items, ...sumItems(items) };
    });
  };

  const handleConfirmMeal = () => {
    if (!pendingMeal) return;
    if (!(pendingMeal.portionGrams > 0)) { setAnalysisError('Porsiyon sıfırdan büyük olmalı.'); return; }
    const requiredNumbers = ['calories', 'protein', 'carbs', 'fat'];
    if (!pendingMeal.name?.trim() || requiredNumbers.some(key => !Number.isFinite(Number(pendingMeal[key])) || Number(pendingMeal[key]) < 0)) {
      setAnalysisError('Öğün bilgileri geçerli değil. Lütfen değerleri kontrol edin.');
      return;
    }
    const newMeal = { ...pendingMeal, id: Date.now() + Math.random() };
    const updatedMeals = [...meals, newMeal];
    
    setMeals(updatedMeals);
    syncUserDatadrawer(updatedMeals, workouts);
    setShowAIModal(false);
    setPendingMeal(null);
  };

  const handleDeleteMeal = (mealId) => {
    const updatedMeals = meals.filter(m => m.id !== mealId);
    setMeals(updatedMeals);
    syncUserDatadrawer(updatedMeals, workouts);
  };

  const handleAddWorkout = (e) => {
    e.preventDefault();
    if (!workoutData.name || !workoutData.calories) return;
    const newWorkout = { id: Date.now(), date: selectedDate, name: workoutData.name, calories: parseInt(workoutData.calories) };
    const updatedWorkouts = [...workouts, newWorkout];
    
    setWorkouts(updatedWorkouts);
    syncUserDatadrawer(meals, updatedWorkouts);

    setWorkoutData({ name: '', calories: '' });
    setShowWorkoutForm(false);
  };

  const todaysMeals = meals.filter(m => m.date === selectedDate);
  const todaysWorkouts = workouts.filter(w => w.date === selectedDate);
  
  const totalCalories = todaysMeals.reduce((acc, meal) => acc + meal.calories, 0);
  const totalProtein = todaysMeals.reduce((acc, meal) => acc + meal.protein, 0);
  const totalCarbs = todaysMeals.reduce((acc, meal) => acc + meal.carbs, 0);
  const totalFat = todaysMeals.reduce((acc, meal) => acc + meal.fat, 0);
  const burnedCalories = todaysWorkouts.reduce((acc, workout) => acc + workout.calories, 0);
  const netCalories = Math.max(0, totalCalories - burnedCalories);

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-2xl">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Activity className="w-8 h-8 text-emerald-500" />
            <h1 className="text-3xl font-bold text-white tracking-tight">FitTrack</h1>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-950/50 border border-red-900 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p>{authError}</p>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">E-Posta</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500" placeholder="ornek@eposta.com" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Şifre</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500" placeholder="••••••••" required />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg mt-2 transition-colors">Giriş Yap</button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-zinc-400">Hesabın yok mu? <button onClick={() => { setAuthError(''); setView('register'); }} className="text-emerald-400 font-semibold hover:underline">Kayıt Ol</button></p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'register') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-2xl">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Activity className="w-8 h-8 text-emerald-500" />
            <h1 className="text-3xl font-bold text-white tracking-tight">Kayıt Ol</h1>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-950/50 border border-red-900 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p>{authError}</p>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleRegister}>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">E-Posta</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500" placeholder="ornek@eposta.com" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Şifre (En az 6 karakter)</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500" placeholder="••••••••" required />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg mt-2 transition-colors">Hesap Oluştur</button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-zinc-400">Zaten hesabın var mı? <button onClick={() => { setAuthError(''); setView('login'); }} className="text-emerald-400 font-semibold hover:underline">Giriş Yap</button></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans pb-32 selection:bg-emerald-500/30">
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {view === 'adminUserDetail' ? (
              <button onClick={() => { setView('admin'); setSelectedAdminUser(null); }} className="p-1 text-zinc-400 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <Activity className="w-6 h-6 text-emerald-500" />
            )}
            <span className="font-bold text-white text-lg tracking-tight">
              {view === 'adminUserDetail' ? 'Kullanıcı Detayı' : 'FitTrack'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && view !== 'adminUserDetail' && (
              <button onClick={() => setView(view === 'admin' ? 'dashboard' : 'admin')} className="p-2 text-amber-500 bg-amber-500/10 rounded-full">
                <Shield className="w-5 h-5" />
              </button>
            )}
            <button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-white">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">
        {loading && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-900/50 rounded-xl text-emerald-400 text-sm text-center animate-pulse">
            {uploadStatus}
          </div>
        )}

        {analysisError && (
          <div role="alert" className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-red-300 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{analysisError}</span>
          </div>
        )}

        {showAIModal && pendingMeal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div role="dialog" aria-modal="true" aria-label="Besin analizi" className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl max-h-[90dvh] overflow-y-auto">
              <h3 className="text-lg font-bold text-white text-center">Yapay Zeka Analiz Sonucu</h3>
              <div className="flex justify-center">
                <img src={pendingMeal.image} alt="Yemek" className="w-24 h-24 object-cover rounded-xl border border-zinc-700 shadow-md" />
              </div>
              {pendingMeal.portionGrams > 0 && (
                <p className="text-center text-xs text-zinc-400">
                  Tahmini porsiyon: {pendingMeal.portionGrams} g
                  {Number.isFinite(pendingMeal.confidence) ? ` • Tanıma tahmini: %${Math.round(pendingMeal.confidence * 100)}` : ''}
                </p>
              )}
              <p className="text-xs text-amber-300 text-center">Değerler fotoğraftan tahmindir. Porsiyonu kontrol et; gramajı değiştirdiğinde kalori ve makrolar birlikte güncellenir.</p>
              {pendingMeal.items?.map((item, index) => (
                <div key={index} className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
                  <label className="flex items-center justify-between gap-3 text-sm text-white">
                    <span>{item.name}<span className="block text-xs text-zinc-400">{item.source === 'label' ? 'Okunan etiket değerleri' : 'Genel besin tahmini'}</span></span>
                    <span className="flex items-center gap-1"><input aria-label={`${item.name} gramajı`} type="number" min="0" max="10000" step="1" value={item.portionGrams} onChange={e => updateItemPortion(index, e.target.value)} className="w-20 rounded-lg bg-zinc-800 p-2" />g</span>
                  </label>
                </div>
              ))}
              {pendingMeal.note && <p className="text-xs text-zinc-500 text-center">{pendingMeal.note}</p>}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Yemek Adı</label>
                  <input 
                    type="text" 
                    value={pendingMeal.name} 
                    onChange={e => setPendingMeal({...pendingMeal, name: e.target.value})} 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 outline-none" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Kalori (kcal)</label>
                    <input 
                      type="number" 
                      value={pendingMeal.calories} 
                      onChange={e => setPendingMeal({...pendingMeal, calories: Number(e.target.value)})} 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Protein (g)</label>
                    <input 
                      type="number" 
                      value={pendingMeal.protein} 
                      onChange={e => setPendingMeal({...pendingMeal, protein: Number(e.target.value)})} 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Karb (g)</label>
                    <input 
                      type="number" 
                      value={pendingMeal.carbs} 
                      onChange={e => setPendingMeal({...pendingMeal, carbs: Number(e.target.value)})} 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 block mb-1">Yağ (g)</label>
                    <input 
                      type="number" 
                      value={pendingMeal.fat} 
                      onChange={e => setPendingMeal({...pendingMeal, fat: Number(e.target.value)})} 
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 outline-none" 
                    />
                  </div>
                </div>
              </div>
              {analysisError && <p role="alert" className="text-sm text-red-300">{analysisError}</p>}
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => { setShowAIModal(false); setPendingMeal(null); setAnalysisError(''); }} 
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2.5 rounded-xl text-sm font-semibold transition"
                >
                  İptal
                </button>
                <button 
                  onClick={handleConfirmMeal} 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition shadow-lg shadow-emerald-600/20"
                >
                  <Check className="w-4 h-4" /> Onayla & Ekle
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'admin' && isAdmin ? (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><Shield className="w-5 h-5 text-amber-500" /> Yönetici Paneli</h2>
            
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Kayıtlı Kullanıcılar ve Albümler</h3>
              
              {(() => {
                const regUsers = JSON.parse(localStorage.getItem('fittrack_users') || '[]');
                if (regUsers.length === 0) {
                  return <p className="text-sm text-zinc-500">Henüz kayıtlı normal kullanıcı bulunmuyor.</p>;
                }
                return (
                  <div className="space-y-2">
                    {regUsers.map((u, index) => (
                      <div 
                        key={index} 
                        onClick={() => { setSelectedAdminUser(u); setView('adminUserDetail'); }}
                        className="bg-zinc-950 border border-zinc-800 hover:border-emerald-500/50 cursor-pointer rounded-lg p-3 flex items-center justify-between transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-sm">
                            {u.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-sm text-white font-medium block">{u.email}</span>
                            <span className="text-xs text-zinc-500">{(u.meals || []).length} Öğün • {(u.workouts || []).length} Antrenman</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-zinc-600" />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        ) : view === 'adminUserDetail' && selectedAdminUser ? (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <h3 className="text-sm text-zinc-400 uppercase tracking-wider mb-1">İncelenen Kullanıcı</h3>
              <p className="text-lg font-bold text-white">{selectedAdminUser.email}</p>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-3">Yemek Albümü & Öğünler</h3>
              <div className="space-y-3">
                {(!selectedAdminUser.meals || selectedAdminUser.meals.length === 0) ? (
                  <div className="text-center p-6 bg-zinc-900/50 border border-zinc-800/50 rounded-xl border-dashed">
                    <p className="text-zinc-500 text-sm">Bu kullanıcının kayıtlı öğünü bulunmuyor.</p>
                  </div>
                ) : (
                  selectedAdminUser.meals.map(meal => (
                    <div key={meal.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex gap-3 items-center">
                      {meal.image ? (
                        <img src={meal.image} alt="Yemek" className="w-14 h-14 object-cover rounded-lg bg-zinc-950" />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-zinc-950 flex items-center justify-center"><Flame className="w-6 h-6 text-zinc-700" /></div>
                      )}
                      <div className="flex-1">
                        <h4 className="font-semibold text-white text-sm">{meal.name}</h4>
                        <p className="text-xs text-zinc-400 mt-1">Tarih: {meal.date} • P: {meal.protein}g • K: {meal.carbs}g • Y: {meal.fat}g</p>
                      </div>
                      <div className="text-right">
                        <span className="text-emerald-400 font-bold">{meal.calories}</span>
                        <span className="text-xs text-zinc-500 block">kcal</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-3">Antrenman Geçmişi</h3>
              <div className="space-y-3">
                {(!selectedAdminUser.workouts || selectedAdminUser.workouts.length === 0) ? (
                  <div className="text-center p-6 bg-zinc-900/50 border border-zinc-800/50 rounded-xl border-dashed">
                    <p className="text-zinc-500 text-sm">Bu kullanıcının kayıtlı antrenmanı bulunmuyor.</p>
                  </div>
                ) : (
                  selectedAdminUser.workouts.map(workout => (
                    <div key={workout.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex gap-3 items-center">
                      <div className="w-12 h-12 rounded-lg bg-zinc-950 flex items-center justify-center border border-zinc-800">
                        <Dumbbell className="w-5 h-5 text-amber-500" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-white text-sm">{workout.name}</h4>
                        <p className="text-xs text-zinc-500 mt-0.5">Tarih: {workout.date}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-amber-400 font-bold">-{workout.calories}</span>
                        <span className="text-xs text-zinc-500 block">kcal</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {[...Array(7)].map((_, i) => {
                const d = new Date();
                d.setDate(d.getDate() - 3 + i);
                const dateStr = d.toISOString().split('T')[0];
                return (
                  <button key={i} onClick={() => setSelectedDate(dateStr)} className={`flex-shrink-0 flex flex-col items-center justify-center w-14 h-16 rounded-xl border transition-all ${selectedDate === dateStr ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                    <span className="text-xs font-medium uppercase">{d.toLocaleDateString('tr-TR', { weekday: 'short' })}</span>
                    <span className="text-lg font-bold">{d.getDate()}</span>
                  </button>
                );
              })}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5 relative">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-black text-white">{netCalories} <span className="text-lg text-zinc-500 font-medium">/ {targets.calories} kcal</span></h2>
                  <p className="text-sm text-emerald-500 font-medium mt-1">Net Kalori (Alınan - Yakılan)</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full border-4 border-zinc-800 flex items-center justify-center relative flex-shrink-0">
                    <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                      <circle cx="28" cy="28" r="26" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-emerald-500" strokeDasharray="163" strokeDashoffset={163 - (163 * Math.min(netCalories/targets.calories, 1))} strokeLinecap="round" />
                    </svg>
                    <Flame className="w-6 h-6 text-emerald-500" />
                  </div>
                  <button onClick={() => setIsEditingTargets(!isEditingTargets)} className="p-2.5 text-zinc-400 hover:text-emerald-400 bg-zinc-950 rounded-full border border-zinc-800 transition shadow-md">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isEditingTargets ? (
                <div className="space-y-3 pt-2 border-t border-zinc-800">
                  <h3 className="text-white font-bold mb-2">Hedefleri Düzenle</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-zinc-400">Kalori</label><input type="number" value={targets.calories} onChange={e => setTargets({...targets, calories: Number(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-white" /></div>
                    <div><label className="text-xs text-zinc-400">Protein (g)</label><input type="number" value={targets.protein} onChange={e => setTargets({...targets, protein: Number(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-white" /></div>
                    <div><label className="text-xs text-zinc-400">Karb (g)</label><input type="number" value={targets.carbs} onChange={e => setTargets({...targets, carbs: Number(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-white" /></div>
                    <div><label className="text-xs text-zinc-400">Yağ (g)</label><input type="number" value={targets.fat} onChange={e => setTargets({...targets, fat: Number(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-white" /></div>
                  </div>
                  <button onClick={() => setIsEditingTargets(false)} className="w-full bg-emerald-600 text-white rounded p-2 text-sm mt-2 font-semibold">Kaydet</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1"><span className="text-emerald-400">Protein</span><span className="text-zinc-400">{totalProtein}g / {targets.protein}g</span></div>
                    <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${Math.min((totalProtein/targets.protein)*100, 100)}%` }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1"><span className="text-amber-400">Karbonhidrat</span><span className="text-zinc-400">{totalCarbs}g / {targets.carbs}g</span></div>
                    <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden"><div className="h-full bg-amber-500 transition-all duration-300" style={{ width: `${Math.min((totalCarbs/targets.carbs)*100, 100)}%` }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1"><span className="text-red-400">Yağ</span><span className="text-zinc-400">{totalFat}g / {targets.fat}g</span></div>
                    <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden"><div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${Math.min((totalFat/targets.fat)*100, 100)}%` }}></div></div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-3">Bugünkü Öğünler</h3>
              <div className="space-y-3">
                {todaysMeals.length === 0 ? (
                  <div className="text-center p-6 bg-zinc-900/50 border border-zinc-800/50 rounded-xl border-dashed"><p className="text-zinc-500 text-sm">Henüz öğün eklenmedi.</p></div>
                ) : (
                  todaysMeals.map(meal => (
                    <div key={meal.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex gap-3 items-center group">
                      {meal.image ? <img src={meal.image} alt="Yemek" className="w-14 h-14 object-cover rounded-lg bg-zinc-950 flex-shrink-0" /> : <div className="w-14 h-14 rounded-lg bg-zinc-950 flex items-center justify-center flex-shrink-0"><Flame className="w-6 h-6 text-zinc-700" /></div>}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white text-sm truncate">{meal.name}</h4>
                        <p className="text-xs text-zinc-400 mt-1">P: {meal.protein}g • K: {meal.carbs}g • Y: {meal.fat}g</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-emerald-400 font-bold">{meal.calories}</span>
                          <span className="text-xs text-zinc-500 block">kcal</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteMeal(meal.id)}
                          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition"
                          title="Öğünü Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-white">Bugünkü Antrenmanlar</h3>
                <button onClick={() => setShowWorkoutForm(!showWorkoutForm)} className="text-emerald-500 text-sm font-semibold flex items-center gap-1"><Plus className="w-4 h-4"/> Ekle</button>
              </div>

              {showWorkoutForm && (
                <form onSubmit={handleAddWorkout} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-3 space-y-3">
                  <input type="text" placeholder="Antrenman (örn: Koşu, Ağırlık)" value={workoutData.name} onChange={e => setWorkoutData({...workoutData, name: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 outline-none" required />
                  <div className="flex gap-2">
                    <input type="number" placeholder="Yakılan Kalori" value={workoutData.calories} onChange={e => setWorkoutData({...workoutData, calories: e.target.value})} className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-sm text-white focus:border-emerald-500 outline-none" required />
                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 rounded-lg font-medium">Kaydet</button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {todaysWorkouts.length === 0 ? (
                  <div className="text-center p-6 bg-zinc-900/50 border border-zinc-800/50 rounded-xl border-dashed"><p className="text-zinc-500 text-sm">Henüz antrenman eklenmedi.</p></div>
                ) : (
                  todaysWorkouts.map(workout => (
                    <div key={workout.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex gap-3 items-center">
                      <div className="w-12 h-12 rounded-lg bg-zinc-950 flex items-center justify-center border border-zinc-800"><Dumbbell className="w-5 h-5 text-amber-500" /></div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-white text-sm">{workout.name}</h4>
                      </div>
                      <div className="text-right"><span className="text-amber-400 font-bold">-{workout.calories}</span><span className="text-xs text-zinc-500 block">kcal</span></div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {view === 'dashboard' && !isAdmin && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent pointer-events-none">
          <div className="max-w-md mx-auto flex justify-center gap-4 pointer-events-auto">
            <input type="file" accept="image/*" multiple className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current.click()} className="flex-1 min-h-[56px] bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-2xl flex items-center justify-center gap-2 font-semibold shadow-lg transition-all"><ImageIcon className="w-5 h-5 text-amber-400" /><span>Galeriden Seç</span></button>
            <button onClick={() => { fileInputRef.current.setAttribute('capture', 'environment'); fileInputRef.current.click(); fileInputRef.current.removeAttribute('capture'); }} className="flex-1 min-h-[56px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex items-center justify-center gap-2 font-semibold shadow-emerald-500/20 shadow-lg transition-all"><Camera className="w-5 h-5" /><span>Kamera</span></button>
          </div>
        </div>
      )}
    </div>
  );
}