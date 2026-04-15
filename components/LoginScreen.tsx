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

const DEMO_PHARMACY_NAMES: Record<string, string> = {
  'ph-1': 'Apotheek de Kroon',
  'ph-2': 'Lamberts Apotheek',
};

const LoginScreen: React.FC<Props> = ({ onLogin, onGuestAccess }) => {
  const [tab, setTab]   = useState<'login' | 'register'>('login');
  const [fase, setFase] = useState<Fase>('login');

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [regName, setRegName]         = useState('');
  const [regEmail, setRegEmail]       = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm]   = useState('');
  const [showRegPw, setShowRegPw]     = useState(false);
  const [regError, setRegError]       = useState('');
  const [regSuccess, setRegSuccess]   = useState(false);

  const [loggedInUser, setLoggedInUser]         = useState<AuthUser | null>(null);
  const [courierPharmacies, setCourierPharmacies] = useState<PharmacyOption[]>([]);
  const [selectedId, setSelectedId]             = useState('');
  const [showCodeInput, setShowCodeInput]       = useState(false);
  const [codeValue, setCodeValue]               = useState('');
  const [codeError, setCodeError]               = useState('');
  const [isLinking, setIsLinking]               = useState(false);

  const [showDemo, setShowDemo] = useState(false);

  const inputCls = 'w-full bg-white rounded-xl px-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none transition-all';
  const inputShadow = { boxShadow: '0 0 0 1px rgba(188,202,196,0.25)' };
  const inputFocusShadow = { boxShadow: '0 0 0 2px #006b5a40' };

  async function fetchPharmacyNames(ids: string[]): Promise<PharmacyOption[]> {
    if (ids.length === 0) return [];
    if (supabase) {
      const { data } = await supabase.from('pharmacies').select('id, name').in('id', ids);
      if (data && data.length > 0) return data as PharmacyOption[];
    }
    return ids.map(id => ({ id, name: DEMO_PHARMACY_NAMES[id] ?? id }));
  }

  async function enterCourierPharmacyStep(user: AuthUser) {
    setLoggedInUser(user);
    const ids = await getCourierPharmacies().catch(() => [] as string[]);
    const allIds = Array.from(new Set([
      ...ids,
      ...(user.pharmacyIds ?? []),
      ...(user.pharmacyId ? [user.pharmacyId] : []),
    ]));
    const options = await fetchPharmacyNames(allIds);
    setCourierPharmacies(options);
    if (options.length > 0) setSelectedId(options[0].id);
    if (options.length === 0) setShowCodeInput(true);
    setFase('choose-pharmacy');
  }

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

  const handleLinkCode = async () => {
    if (!codeValue.trim() || !loggedInUser) return;
    setCodeError('');
    setIsLinking(true);
    try {
      const result = await linkPharmacyCode(codeValue.trim().toUpperCase());
      if (!result) { setCodeError('Code ongeldig of verlopen.'); return; }
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

  const handleChoosePharmacy = () => {
    if (!loggedInUser) return;
    onLogin(loggedInUser, selectedId || undefined);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-5 lg:p-8"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #006b5a 50%, #0a1628 100%)' }}>
      <div className="w-full max-w-md space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Logo */}
        <div className="text-center mb-6">
          <img src="/greenspeed-logo.svg" alt="Greenspeed" className="h-16 w-auto mx-auto mb-8" />
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl overflow-hidden" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.30)' }}>

          {/* ══ FASE 2: APOTHEEK KIEZEN ══ */}
          {fase === 'choose-pharmacy' && (
            <div className="p-7 space-y-5">
              <div>
                <p className="text-[10px] font-display font-black uppercase tracking-widest text-[#006b5a] mb-1">Koerier</p>
                <h2 className="text-xl font-display font-black text-[#191c1e]">Voor welke apotheek werk je vandaag?</h2>
              </div>

              {courierPharmacies.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">Apotheek</label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3d4945]/40 pointer-events-none" />
                    <select
                      value={selectedId}
                      onChange={e => setSelectedId(e.target.value)}
                      className="w-full bg-white rounded-xl pl-10 pr-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none cursor-pointer appearance-none transition-all"
                      style={inputShadow}
                    >
                      {courierPharmacies.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {courierPharmacies.length > 0 && !showCodeInput && (
                <button
                  onClick={() => setShowCodeInput(true)}
                  className="flex items-center gap-1.5 text-xs font-display font-black text-[#006b5a] hover:opacity-80 transition-opacity"
                >
                  <Plus size={13} />
                  Nieuwe apotheek toevoegen
                </button>
              )}

              {(showCodeInput || courierPharmacies.length === 0) && (
                <div className="space-y-2 bg-[#f2f4f6] rounded-2xl p-4">
                  <p className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60">
                    {courierPharmacies.length > 0 ? 'Nieuwe apotheek koppelen' : 'Apotheekcode invoeren'}
                  </p>
                  <p className="text-xs font-body text-[#3d4945]/60">
                    Vraag de code op bij de apotheek (bijv. KR-4821).
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={codeValue}
                      onChange={e => { setCodeValue(e.target.value.toUpperCase()); setCodeError(''); }}
                      placeholder="KR-4821"
                      maxLength={7}
                      className="flex-1 bg-white rounded-xl px-4 h-11 font-display font-black text-[#191c1e] text-sm tracking-widest text-center outline-none transition-all"
                      style={inputShadow}
                      onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
                      onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.25)'}
                      autoCapitalize="characters"
                    />
                    <button
                      onClick={handleLinkCode}
                      disabled={isLinking || codeValue.replace(/[^A-Z0-9]/g, '').length < 6}
                      className="px-4 h-11 text-white rounded-full font-display font-bold text-xs disabled:opacity-40 active:scale-95 transition-all flex items-center gap-1.5"
                      style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
                    >
                      {isLinking ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
                      Koppelen
                    </button>
                  </div>
                  {codeError && <p className="text-xs font-body font-bold text-red-500">{codeError}</p>}
                </div>
              )}

              <button
                onClick={handleChoosePharmacy}
                disabled={courierPharmacies.length === 0 && !selectedId}
                className="w-full text-white h-12 rounded-full font-display font-bold text-sm active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
              >
                Aan de slag
                <ArrowRight size={18} />
              </button>

              <button
                onClick={() => { setFase('login'); setLoggedInUser(null); }}
                className="w-full text-center text-xs font-body text-[#3d4945]/60 hover:text-[#3d4945] transition-colors pt-1"
              >
                ← Terug naar inloggen
              </button>
            </div>
          )}

          {/* ══ FASE 1: LOGIN / REGISTER ══ */}
          {fase !== 'choose-pharmacy' && (
            <>
              {/* Tabs */}
              <div className="flex" style={{ borderBottom: '1px solid #f2f4f6' }}>
                <button
                  onClick={() => setTab('login')}
                  className={`flex-1 py-4 text-sm font-display font-black transition-colors ${
                    tab === 'login' ? 'text-[#006b5a]' : 'text-[#3d4945]/60 hover:text-[#3d4945]'
                  }`}
                  style={tab === 'login' ? { borderBottom: '2px solid #006b5a' } : {}}
                >
                  <LogIn size={14} className="inline mr-1.5" />
                  Inloggen
                </button>
                <button
                  onClick={() => setTab('register')}
                  className={`flex-1 py-4 text-sm font-display font-black transition-colors ${
                    tab === 'register' ? 'text-[#006b5a]' : 'text-[#3d4945]/60 hover:text-[#3d4945]'
                  }`}
                  style={tab === 'register' ? { borderBottom: '2px solid #006b5a' } : {}}
                >
                  <UserPlus size={14} className="inline mr-1.5" />
                  Koerier registreren
                </button>
              </div>

              <div className="p-7">
                {/* LOGIN */}
                {tab === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">E-mailadres</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="naam@apotheek.nl" required autoComplete="email"
                        className={inputCls} style={inputShadow}
                        onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
                        onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.25)'} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">Wachtwoord</label>
                      <div className="relative">
                        <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                          placeholder="••••••••" required autoComplete="current-password"
                          className={`${inputCls} pr-12`} style={inputShadow}
                          onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
                          onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.25)'} />
                        <button type="button" onClick={() => setShowPw(p => !p)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#3d4945]/40 hover:text-[#3d4945] transition-colors">
                          {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    {loginError && (
                      <div className="bg-red-50 rounded-xl px-4 py-3">
                        <p className="text-xs font-body font-bold text-red-600">{loginError}</p>
                      </div>
                    )}
                    <button type="submit" disabled={isLoading}
                      className="w-full text-white h-12 rounded-full font-display font-bold text-sm active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center space-x-2"
                      style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}>
                      <LogIn size={18} />
                      <span>{isLoading ? 'Inloggen...' : 'Inloggen'}</span>
                    </button>
                  </form>
                )}

                {/* REGISTREER */}
                {tab === 'register' && !regSuccess && (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">Volledige naam</label>
                      <input type="text" value={regName} onChange={e => setRegName(e.target.value)}
                        placeholder="Jan Jansen" required autoComplete="name"
                        className={inputCls} style={inputShadow}
                        onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
                        onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.25)'} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">E-mailadres</label>
                      <input type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                        placeholder="jan@email.nl" required autoComplete="email"
                        className={inputCls} style={inputShadow}
                        onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
                        onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.25)'} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">
                        Wachtwoord <span className="normal-case font-body font-bold text-[#3d4945]/40">(min. 8 tekens)</span>
                      </label>
                      <div className="relative">
                        <input type={showRegPw ? 'text' : 'password'} value={regPassword}
                          onChange={e => setRegPassword(e.target.value)} placeholder="••••••••"
                          required minLength={8} autoComplete="new-password"
                          className={`${inputCls} pr-12`} style={inputShadow}
                          onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
                          onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.25)'} />
                        <button type="button" onClick={() => setShowRegPw(p => !p)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-[#3d4945]/40 hover:text-[#3d4945] transition-colors">
                          {showRegPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">Wachtwoord bevestigen</label>
                      <input type="password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
                        placeholder="••••••••" required autoComplete="new-password"
                        className={inputCls} style={inputShadow}
                        onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
                        onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.25)'} />
                    </div>
                    {regError && (
                      <div className="bg-red-50 rounded-xl px-4 py-3">
                        <p className="text-xs font-body font-bold text-red-600">{regError}</p>
                      </div>
                    )}
                    <button type="submit" disabled={isLoading}
                      className="w-full text-white h-12 rounded-full font-display font-bold text-sm active:scale-95 disabled:opacity-60 transition-all flex items-center justify-center space-x-2"
                      style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}>
                      <UserPlus size={18} />
                      <span>{isLoading ? 'Account aanmaken...' : 'Account aanmaken'}</span>
                    </button>
                    <p className="text-center text-xs font-body text-[#3d4945]/60 leading-relaxed pt-1">
                      Werk je voor een apotheek? Je koppelt een apotheek na het inloggen met een apotheekcode.
                    </p>
                  </form>
                )}

                {/* REGISTRATIE SUCCESVOL */}
                {tab === 'register' && regSuccess && (
                  <div className="text-center py-4 space-y-3">
                    <div className="w-14 h-14 bg-[#48c2a9]/15 rounded-2xl flex items-center justify-center mx-auto">
                      <ShieldCheck className="text-[#006b5a] w-7 h-7" />
                    </div>
                    <p className="font-display font-black text-[#191c1e]">Account aangemaakt!</p>
                    <p className="text-sm font-body text-[#3d4945]/60 leading-relaxed">
                      Controleer je e-mail om je account te bevestigen. Daarna kun je inloggen.
                    </p>
                    <button onClick={() => { setTab('login'); setRegSuccess(false); }}
                      className="font-display font-black text-sm text-[#006b5a]">
                      Naar inloggen
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Demo accounts */}
        {fase !== 'choose-pharmacy' && (
          <div className="rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}>
            <button onClick={() => setShowDemo(p => !p)}
              className="w-full flex items-center justify-between px-6 py-4 text-white h-14">
              <span className="text-sm font-display font-black uppercase tracking-widest text-[#81f7dc]/70">Demo accounts</span>
              {showDemo ? <ChevronUp size={18} className="text-[#81f7dc]/70" /> : <ChevronDown size={18} className="text-[#81f7dc]/70" />}
            </button>
            {showDemo && (
              <div className="px-4 pb-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
                {DEMO_USERS.map(acc => {
                  const colorMap: Record<string, string> = {
                    u1: 'bg-[#d7e2fe] text-[#101c30]',
                    u2: 'bg-[#d7e2fe] text-[#101c30]',
                    u6: 'bg-[#d7e2fe] text-[#101c30]',
                    u3: 'bg-[#48c2a9]/20 text-[#006b5a]',
                    u4: 'bg-[#48c2a9]/20 text-[#006b5a]',
                    u5: 'bg-[#48c2a9]/20 text-[#006b5a]',
                    u7: 'bg-[#f2f4f6] text-[#3d4945]',
                  };
                  return (
                    <button key={acc.id} onClick={() => quickLogin(acc.email, acc.passwordHash)}
                      className="w-full flex items-center justify-between rounded-2xl px-4 py-3 transition-all text-left"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
                      onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                    >
                      <div>
                        <p className="text-white font-display font-black text-sm leading-none">{acc.name}</p>
                        <p className="text-white/50 font-body text-[10px] mt-1">{acc.email}</p>
                      </div>
                      <span className={`shrink-0 ml-3 text-[9px] font-display font-black uppercase tracking-widest px-2 py-1 rounded-lg ${colorMap[acc.id] ?? 'bg-[#f2f4f6] text-[#3d4945]'}`}>
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
            className="w-full flex items-center justify-center space-x-2 text-[#81f7dc]/70 hover:text-white py-4 text-sm font-body font-bold transition-colors">
            <Search size={16} />
            <span>Pakket traceren zonder inloggen</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default LoginScreen;
