import React, { useState, useRef } from 'react';
import { Camera, LogOut, Shield, Activity, Flame, AlertCircle, Image as ImageIcon, Settings, Dumbbell, Plus } from 'lucide-react';

const GEMINI_API_KEY = "AQ.Ab8RN6KHBximxHIj4PxmkV-047eUORytOYh6qEtMfRGr8v1wog"; // Buraya Gemini API anahtarını gir

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState('login'); 
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);

  // Günlük Veri ve Hedef State'leri
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [meals, setMeals] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [uploadStatus, setUploadStatus] = useState('');
  
  const [targets, setTargets] = useState({ calories: 2500, protein: 150, carbs: 250, fat: 70 });
  const [isEditingTargets, setIsEditingTargets] = useState(false);

  // Antrenman Form State'i
  const [showWorkoutForm, setShowWorkoutForm] = useState(false);
  const [workoutData, setWorkoutData] = useState({ name: '', calories: '' });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const fileInputRef = useRef(null);

  const handleAuth = (e, isLogin) => {
    e.preventDefault();
    setAuthError('');
    if (!email.includes('@')) {
      setAuthError('Geçersiz e-posta adresi.');
      return;
    }
    const mockUser = { uid: '123', email: email };
    setUser(mockUser);
    setIsAdmin(email === 'samet@fittrack.com' || email === 'admin@fittrack.com');
    setView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setIsAdmin(false);
    setView('login');
    setEmail('');
    setPassword('');
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setLoading(true);
    setUploadStatus('Fotoğraflar yükleniyor ve analiz ediliyor...');

    for (const file of files) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        await processAI(reader.result);
      };
    }
    
    setTimeout(() => {
      setLoading(false);
      setUploadStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }, 2000);
  };

  const processAI = async (base64Image) => {
    try {
      if (!GEMINI_API_KEY) {
        const demoMeal = { id: Date.now(), name: 'Izgara Tavuk ve Pilav (Demo AI)', calories: 550, protein: 45, carbs: 50, fat: 15, date: selectedDate, image: base64Image };
        setMeals(prev => [...prev, demoMeal]);
        return;
      }

      const base64Data = base64Image.split(',')[1];
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Bu yemek nedir? Sadece şu JSON formatında cevap ver: {\"name\": \"Yemek Adı\", \"calories\": 100, \"protein\": 10, \"carbs\": 20, \"fat\": 5}" }, { inline_data: { mime_type: "image/jpeg", data: base64Data } }] }]
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      
      const aiResult = JSON.parse(data.candidates[0].content.parts[0].text);
      setMeals(prev => [...prev, { ...aiResult, id: Date.now(), date: selectedDate, image: base64Image }]);
      
    } catch (error) {
      setUploadStatus(`Analiz Hatası: ${error.message}`);
    }
  };

  const handleAddWorkout = (e) => {
    e.preventDefault();
    if (!workoutData.name || !workoutData.calories) return;
    setWorkouts(prev => [...prev, { id: Date.now(), date: selectedDate, name: workoutData.name, calories: parseInt(workoutData.calories) }]);
    setWorkoutData({ name: '', calories: '' });
    setShowWorkoutForm(false);
  };

  // Hesaplamalar
  const todaysMeals = meals.filter(m => m.date === selectedDate);
  const todaysWorkouts = workouts.filter(w => w.date === selectedDate);
  
  const totalCalories = todaysMeals.reduce((acc, meal) => acc + meal.calories, 0);
  const totalProtein = todaysMeals.reduce((acc, meal) => acc + meal.protein, 0);
  const totalCarbs = todaysMeals.reduce((acc, meal) => acc + meal.carbs, 0);
  const totalFat = todaysMeals.reduce((acc, meal) => acc + meal.fat, 0);
  const burnedCalories = todaysWorkouts.reduce((acc, workout) => acc + workout.calories, 0);

  // Net Kalori: Alınan - Yakılan
  const netCalories = Math.max(0, totalCalories - burnedCalories);

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-2xl">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Activity className="w-8 h-8 text-emerald-500" />
            <h1 className="text-3xl font-bold text-white tracking-tight">FitTrack</h1>
          </div>
          <form className="space-y-4" onSubmit={(e) => handleAuth(e, true)}>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">E-Posta</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500" placeholder="ornek@eposta.com" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1">Şifre</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500" placeholder="••••••••" required />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg mt-2">Giriş Yap / Kayıt Ol</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 font-sans pb-32 selection:bg-emerald-500/30">
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-900 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-500" />
            <span className="font-bold text-white text-lg tracking-tight">FitTrack</span>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
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
        {view === 'admin' && isAdmin ? (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><Shield className="w-5 h-5 text-amber-500" /> Yönetici Paneli</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-400">Veritabanı bağlandığında kullanıcı analizleri burada görünecek.</div>
          </div>
        ) : (
          <>
            {/* TAKVİM */}
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

            {/* MAKRO VE HEDEF ÖZETİ */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5 relative">
              <button onClick={() => setIsEditingTargets(!isEditingTargets)} className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-emerald-400 bg-zinc-950 rounded-full border border-zinc-800 transition">
                <Settings className="w-4 h-4" />
              </button>

              {isEditingTargets ? (
                <div className="space-y-3 pt-2">
                  <h3 className="text-white font-bold mb-2">Hedefleri Düzenle</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-zinc-400">Kalori</label><input type="number" value={targets.calories} onChange={e => setTargets({...targets, calories: Number(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-white" /></div>
                    <div><label className="text-xs text-zinc-400">Protein (g)</label><input type="number" value={targets.protein} onChange={e => setTargets({...targets, protein: Number(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-white" /></div>
                    <div><label className="text-xs text-zinc-400">Karb (g)</label><input type="number" value={targets.carbs} onChange={e => setTargets({...targets, carbs: Number(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-white" /></div>
                    <div><label className="text-xs text-zinc-400">Yağ (g)</label><input type="number" value={targets.fat} onChange={e => setTargets({...targets, fat: Number(e.target.value)})} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-sm text-white" /></div>
                  </div>
                  <button onClick={() => setIsEditingTargets(false)} className="w-full bg-emerald-600 text-white rounded p-2 text-sm mt-2">Kaydet</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-3xl font-black text-white">{netCalories} <span className="text-lg text-zinc-500 font-medium">/ {targets.calories} kcal</span></h2>
                      <p className="text-sm text-emerald-500 font-medium mt-1">Net Kalori (Alınan - Yakılan)</p>
                    </div>
                    <div className="w-16 h-16 rounded-full border-4 border-zinc-800 flex items-center justify-center relative">
                      <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                        <circle cx="28" cy="28" r="26" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-emerald-500" strokeDasharray="163" strokeDashoffset={163 - (163 * Math.min(netCalories/targets.calories, 1))} strokeLinecap="round" />
                      </svg>
                      <Flame className="w-6 h-6 text-emerald-500" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1"><span className="text-emerald-400">Protein</span><span className="text-zinc-400">{totalProtein}g / {targets.protein}g</span></div>
                      <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.min((totalProtein/targets.protein)*100, 100)}%` }}></div></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1"><span className="text-amber-400">Karbonhidrat</span><span className="text-zinc-400">{totalCarbs}g / {targets.carbs}g</span></div>
                      <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden"><div className="h-full bg-amber-500" style={{ width: `${Math.min((totalCarbs/targets.carbs)*100, 100)}%` }}></div></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1"><span className="text-red-400">Yağ</span><span className="text-zinc-400">{totalFat}g / {targets.fat}g</span></div>
                      <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{ width: `${Math.min((totalFat/targets.fat)*100, 100)}%` }}></div></div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ÖĞÜNLER */}
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Bugünkü Öğünler</h3>
              <div className="space-y-3">
                {todaysMeals.length === 0 ? (
                  <div className="text-center p-6 bg-zinc-900/50 border border-zinc-800/50 rounded-xl border-dashed"><p className="text-zinc-500 text-sm">Henüz öğün eklenmedi.</p></div>
                ) : (
                  todaysMeals.map(meal => (
                    <div key={meal.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex gap-3 items-center">
                      {meal.image ? <img src={meal.image} alt="Yemek" className="w-14 h-14 object-cover rounded-lg bg-zinc-950" /> : <div className="w-14 h-14 rounded-lg bg-zinc-950 flex items-center justify-center"><Flame className="w-6 h-6 text-zinc-700" /></div>}
                      <div className="flex-1">
                        <h4 className="font-semibold text-white text-sm">{meal.name}</h4>
                        <p className="text-xs text-zinc-400 mt-1">P: {meal.protein}g • K: {meal.carbs}g • Y: {meal.fat}g</p>
                      </div>
                      <div className="text-right"><span className="text-emerald-400 font-bold">{meal.calories}</span><span className="text-xs text-zinc-500 block">kcal</span></div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ANTRENMANLAR */}
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

      {view === 'dashboard' && (
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