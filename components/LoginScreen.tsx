import React, { useState } from 'react';
import {
  ShieldCheck, Eye, EyeOff, ChevronDown, ChevronUp,
  LogIn, Search, UserPlus, Building2, ArrowRight, Link, Loader2, Plus,
} from 'lucide-react';
import { AuthUser, UserRole } from '../types';
import { login, registerCourier, saveSession, getCourierPharmacies, linkPharmacyCode, DEMO_USERS } from '../services/authService';
import { supabase } from '../services/supabaseService';

interface Props {
  onLogin:       (user: AuthUser, activePharmacyId?: string) => void;
  onGuestAccess: () => void;
}

type Fase = 'login' | 'register' | 'choose-pharmacy';

interface PharmacyOption { id: string; name: string; }

// Demo-fallback namen als Supabase niet beschikbaar is
const DEMO_PHARMACY_NAMES: Record<string, string> = {
  'ph-1': 'Apotheek de Kroon',
  'ph-2': 'Lamberts Apotheek',
};

const LoginScreen: React.FC<Props> = ({ onLogin, onGuestAccess }) => {
  const [tab, setTab]   = useState<'login' | 'register'>('login');
  const [fase, setFase] = useState<Fase>('login');

  // Login-tab
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Registreer-tab
  const [regName, setRegName]         = useState('');
  const [regEmail, setRegEmail]       = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm]   = useState('');
  const [showRegPw, setShowRegPw]     = useState(false);
  const [regError, setRegError]       = useState('');
  const [regSuccess, setRegSuccess]   = useState(false);

  // Fase 2: apotheek kiezen
  const [loggedInUser, setLoggedInUser]         = useState<AuthUser | null>(null);
  const [courierPharmacies, setCourierPharmacies] = useState<PharmacyOption[]>([]);
  const [selectedId, setSelectedId]             = useState('');
  const [showCodeInput, setShowCodeInput]       = useState(false);
  const [codeValue, setCodeValue]               = useState('');
  const [codeError, setCodeError]               = useState('');
  const [isLinking, setIsLinking]               = useState(false);

  // Demo
  const [showDemo, setShowDemo] = useState(false);

  const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 h-12 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all';

  // ── Helpers ──────────────────────────────────────────────────────
  async function fetchPharmacyNames(ids: string[]): Promise<PharmacyOption[]> {
    if (ids.length === 0) return [];
    if (supabase) {
      const { data } = await supabase.from('pharmacies').select('id, name').in('id', ids);
      if (data && data.length > 0) return data as PharmacyOption[];
    }
    // Demo-fallback
    return ids.map(id => ({ id, name: DEMO_PHARMACY_NAMES[id] ?? id }));
  }

  async function enterCourierPharmacyStep(user: AuthUser) {
    setLoggedInUser(user);
    // Haal gekoppelde apotheken op
    const ids = await getCourierPharmacies().catch(() => [] as string[]);
    // Combineer met wat er al op het user-object staat
    const allIds = Array.from(new Set([
      ...ids,
      ...(user.pharmacyIds ?? []),
      ...(user.pharmacyId ? [user.pharmacyId] : []),
    ]));
    const options = await fetchPharmacyNames(allIds);
    setCourierPharmacies(options);
    if (options.length > 0) setSelectedId(options[0].id);
    if (options.length === 0) setShowCodeInput(true); // geen apotheek → direct code invoeren
    setFase('choose-pharmacy');
  }

  // ── Login ─────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoading(true);
    try {
      const user = await login(email.trim(), password);
      if (!user) { setLoginError('E-mailadres of wachtwoord onjuist.'); return; }
      saveSession(user);
      if (user.role === UserRole.COURIER) {
        await enterCourierPharmacyStep(user);
      } else {
        onLogin(user);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = async (demoEmail: string, demoPw: string) => {
    const user = await login(demoEmail, demoPw);
    if (!user) return;
    saveSession(user);
    if (user.role === UserRole.COURIER) {
      await enterCourierPharmacyStep(user);
    } else {
      onLogin(user);
    }
  };

  // ── Registratie koerier ───────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    if (regPassword.length < 8) { setRegError('Wachtwoord moet minimaal 8 tekens zijn.'); return; }
    if (regPassword !== regConfirm) { setRegError('Wachtwoorden komen niet overeen.'); return; }
    setIsLoading(true);
    try {
      const user = await registerCourier(regName.trim(), regEmail.trim(), regPassword);
      if (user) {
        saveSession(user);
        await enterCourierPharmacyStep(user);
      } else {
        setRegSuccess(true);
      }
    } catch {
      setRegError('Registratie mislukt. Probeer een ander e-mailadres.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Fase 2: apotheek koppelen via code ────────────────────────────
  const handleLinkCode = async () => {
    if (!codeValue.trim() || !loggedInUser) return;
    setCodeError('');
    setIsLinking(true);
    try {
      const result = await linkPharmacyCode(codeValue.trim().toUpperCase());
      if (!result) { setCodeError('Code ongeldig of verlopen.'); return; }
      // Voeg nieuwe apotheek toe aan lijst
      const newOptions = await fetchPharmacyNames([result.pharmacyId]);
      const updated = [...courierPharmacies.filter(p => p.id !== result.pharmacyId), ...newOptions];
      setCourierPharmacies(updated);
      setSelectedId(result.pharmacyId);
      setShowCodeInput(false);
      setCodeValue('');
    } finally {
      setIsLinking(false);
    }
  };

  // ── Fase 2: doorgaan ─────────────────────────────────────────────
  const handleChoosePharmacy = () => {
    if (!loggedInUser) return;
    onLogin(loggedInUser, selectedId || undefined);
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col items-center justify-center p-5 lg:p-8">
      <div className="w-full max-w-md space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-2xl shadow-blue-500/30 mb-4">
            <ShieldCheck className="text-white w-9 h-9" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">Greenspeed</h1>
          <p className="text-blue-300 text-sm font-medium mt-1 uppercase tracking-widest">AI Route Planner</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-4xl shadow-2xl shadow-black/30 overflow-hidden">

          {/* ══════════════ FASE 2: APOTHEEK KIEZEN ══════════════ */}
          {fase === 'choose-pharmacy' && (
            <div className="p-7 space-y-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Koerier</p>
                <h2 className="text-xl font-black text-slate-900">Voor welke apotheek werk je vandaag?</h2>
              </div>

              {/* Dropdown als er apotheken zijn */}
              {courierPharmacies.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Apotheek
                  </label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <select
                      value={selectedId}
                      onChange={e => setSelectedId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-5 h-12 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer appearance-none"
                    >
                      {courierPharmacies.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Uitklapbare code-invoer */}
              {courierPharmacies.length > 0 && !showCodeInput && (
                <button
                  onClick={() => setShowCodeInput(true)}
                  className="flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Plus size={13} />
                  Nieuwe apotheek toevoegen
                </button>
              )}

              {(showCodeInput || courierPharmacies.length === 0) && (
                <div className="space-y-2 bg-slate-50 rounded-2xl p-4 border border-slate-200">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {courierPharmacies.length > 0 ? 'Nieuwe apotheek koppelen' : 'Apotheekcode invoeren'}
                  </p>
                  <p className="text-xs text-slate-500 font-bold">
                    Vraag de code op bij de apotheek (bijv. KR-4821).
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={codeValue}
                      onChange={e => { setCodeValue(e.target.value.toUpperCase()); setCodeError(''); }}
                      placeholder="KR-4821"
                      maxLength={7}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-4 h-11 font-black text-slate-900 text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                      autoCapitalize="characters"
                    />
                    <button
                      onClick={handleLinkCode}
                      disabled={isLinking || codeValue.replace(/[^A-Z0-9]/g, '').length < 6}
                      className="px-4 h-11 bg-slate-800 text-white rounded-xl font-black text-xs disabled:opacity-40 active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      {isLinking ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
                      Koppelen
                    </button>
                  </div>
                  {codeError && <p className="text-xs font-bold text-red-500">{codeError}</p>}
                </div>
              )}

              {/* Aan de slag */}
              <button
                onClick={handleChoosePharmacy}
                disabled={courierPharmacies.length === 0 && !selectedId}
                className="w-full bg-blue-600 text-white h-12 rounded-2xl font-black text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                Aan de slag
                <ArrowRight size={18} />
              </button>

              <button
                onClick={() => { setFase('login'); setLoggedInUser(null); }}
                className="w-full text-center text-xs text-slate-400 font-bold hover:text-slate-600 transition-colors pt-1"
              >
                ← Terug naar inloggen
              </button>
            </div>
          )}

          {/* ══════════════ FASE 1: LOGIN / REGISTER ══════════════ */}
          {fase !== 'choose-pharmacy' && (
            <>
              {/* Tabs */}
              <div className="flex border-b border-slate-100">
                <button
                  onClick={() => setTab('login')}
                  className={`flex-1 py-4 text-sm font-black transition-colors ${tab === 'login' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <LogIn size={14} className="inline mr-1.5" />
                  Inloggen
                </button>
                <button
                  onClick={() => setTab('register')}
                  className={`flex-1 py-4 text-sm font-black transition-colors ${tab === 'register' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <UserPlus size={14} className="inline mr-1.5" />
                  Koerier registreren
                </button>
              </div>

              <div className="p-7">
                {/* ── LOGIN ── */}
                {tab === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mailadres</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="naam@apotheek.nl" required autoComplete="email" className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Wachtwoord</label>
                      <div className="relative">
                        <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                          placeholder="••••••••" required autoComplete="current-password" className={`${inputCls} pr-12`} />
                        <button type="button" onClick={() => setShowPw(p => !p)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                          {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    {loginError && (
                      <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                        <p className="text-xs font-bold text-red-600">{loginError}</p>
                      </div>
                    )}
                    <button type="submit" disabled={isLoading}
                      className="w-full bg-blue-600 text-white h-12 rounded-2xl font-black text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center space-x-2">
                      <LogIn size={18} />
                      <span>{isLoading ? 'Inloggen...' : 'Inloggen'}</span>
                    </button>
                  </form>
                )}

                {/* ── REGISTREER ── */}
                {tab === 'register' && !regSuccess && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Volledige naam</label>
                      <input type="text" value={regName} onChange={e => setRegName(e.target.value)}
                        placeholder="Jan Jansen" required autoComplete="name" className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">E-mailadres</label>
                      <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                        placeholder="jan@email.nl" required autoComplete="email" className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                        Wachtwoord <span className="normal-case font-bold text-slate-300">(min. 8 tekens)</span>
                      </label>
                      <div className="relative">
                        <input type={showRegPw ? 'text' : 'password'} value={regPassword}
                          onChange={e => setRegPassword(e.target.value)} placeholder="••••••••"
                          required minLength={8} autoComplete="new-password" className={`${inputCls} pr-12`} />
                        <button type="button" onClick={() => setShowRegPw(p => !p)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                          {showRegPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Wachtwoord bevestigen</label>
                      <input type="password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
                        placeholder="••••••••" required autoComplete="new-password" className={inputCls} />
                    </div>
                    {regError && (
                      <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                        <p className="text-xs font-bold text-red-600">{regError}</p>
                      </div>
                    )}
                    <button type="submit" disabled={isLoading}
                      className="w-full bg-blue-600 text-white h-12 rounded-2xl font-black text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center space-x-2">
                      <UserPlus size={18} />
                      <span>{isLoading ? 'Account aanmaken...' : 'Account aanmaken'}</span>
                    </button>
                    <p className="text-center text-xs text-slate-400 font-bold leading-relaxed pt-1">
                      Werk je voor een apotheek? Je koppelt een apotheek na het inloggen met een apotheekcode.
                    </p>
                  </form>
                )}

                {/* ── REGISTRATIE SUCCESVOL ── */}
                {tab === 'register' && regSuccess && (
                  <div className="text-center py-4 space-y-3">
                    <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
                      <ShieldCheck className="text-emerald-600 w-7 h-7" />
                    </div>
                    <p className="font-black text-slate-900">Account aangemaakt!</p>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Controleer je e-mail om je account te bevestigen. Daarna kun je inloggen.
                    </p>
                    <button onClick={() => { setTab('login'); setRegSuccess(false); }}
                      className="text-blue-600 font-black text-sm">
                      Naar inloggen
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Demo accounts — alleen tonen bij login fase */}
        {fase !== 'choose-pharmacy' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-3xl overflow-hidden border border-white/10">
            <button onClick={() => setShowDemo(p => !p)}
              className="w-full flex items-center justify-between px-6 py-4 text-white h-14">
              <span className="text-sm font-black uppercase tracking-widest text-blue-200">Demo accounts</span>
              {showDemo ? <ChevronUp size={18} className="text-blue-300" /> : <ChevronDown size={18} className="text-blue-300" />}
            </button>
            {showDemo && (
              <div className="px-4 pb-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
                {DEMO_USERS.map(acc => {
                  const colorMap: Record<string, string> = {
                    u1: 'bg-purple-100 text-purple-700',
                    u2: 'bg-indigo-100 text-indigo-700',
                    u6: 'bg-indigo-100 text-indigo-700',
                    u3: 'bg-blue-100 text-blue-700',
                    u4: 'bg-emerald-100 text-emerald-700',
                    u5: 'bg-emerald-100 text-emerald-700',
                    u7: 'bg-violet-100 text-violet-700',
                  };
                  return (
                    <button key={acc.id} onClick={() => quickLogin(acc.email, acc.passwordHash)}
                      className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 rounded-2xl px-4 py-3 transition-all text-left">
                      <div>
                        <p className="text-white font-black text-sm leading-none">{acc.name}</p>
                        <p className="text-white/50 text-[10px] mt-1">{acc.email}</p>
                      </div>
                      <span className={`shrink-0 ml-3 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${colorMap[acc.id] ?? 'bg-slate-100 text-slate-700'}`}>
                        {acc.role.toLowerCase()}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Gast / Patiënt */}
        {fase !== 'choose-pharmacy' && (
          <button onClick={onGuestAccess}
            className="w-full flex items-center justify-center space-x-2 text-blue-300 hover:text-white py-4 text-sm font-bold transition-colors">
            <Search size={16} />
            <span>Pakket traceren zonder inloggen</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
