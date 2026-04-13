import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, ChevronDown, ChevronUp, LogIn, Search } from 'lucide-react';
import { AuthUser, UserRole } from '../types';
import { login, saveSession } from '../services/authService';

interface Props {
  onLogin: (user: AuthUser) => void;
  onGuestAccess: () => void;
}

interface DemoAccount {
  name:      string;
  password:  string;
  roleLabel: string;
  desc:      string;
  color:     string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  { name: 'Greenspeed HQ',                  password: 'superuser123', roleLabel: 'Superuser',       desc: 'Ziet alle apotheken',          color: 'bg-purple-100 text-purple-700' },
  { name: 'Regio Beheerder',                password: 'regio123',    roleLabel: 'Regio Beheerder',  desc: 'Admin met meerdere apotheken', color: 'bg-indigo-100 text-indigo-700' },
  { name: 'Beheerder Apotheek de Kroon',    password: 'admin123',    roleLabel: 'Admin',            desc: 'Admin van één apotheek',        color: 'bg-indigo-100 text-indigo-700' },
  { name: 'Assistente Apotheek de Kroon',   password: 'apotheek123', roleLabel: 'Apotheek',         desc: 'Apothekers-assistent',          color: 'bg-blue-100 text-blue-700'     },
  { name: 'Marco Koerier',                  password: 'koerier123',  roleLabel: 'Koerier',          desc: 'Bezorger',                     color: 'bg-emerald-100 text-emerald-700'},
];

const LoginScreen: React.FC<Props> = ({ onLogin, onGuestAccess }) => {
  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState('');
  const [showDemo, setShowDemo]       = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const user = login(username.trim(), password);
    if (user) {
      saveSession(user);
      onLogin(user);
    } else {
      setError('Gebruikersnaam of wachtwoord onjuist.');
    }
  };

  const quickLogin = (name: string, password: string) => {
    const user = login(name, password);
    if (user) { saveSession(user); onLogin(user); }
  };

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

        {/* Login form */}
        <div className="bg-white rounded-4xl p-7 shadow-2xl shadow-black/30">
          <h2 className="text-xl font-black text-slate-900 mb-5">Inloggen</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Gebruikersnaam
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Volledige naam"
                required
                autoComplete="username"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 h-12 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Wachtwoord
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 h-12 pr-12 font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                <p className="text-xs font-bold text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white h-12 rounded-2xl font-black text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
              <LogIn size={18} />
              <span>Inloggen</span>
            </button>
          </form>
        </div>

        {/* Demo accounts */}
        <div className="bg-white/10 backdrop-blur-sm rounded-3xl overflow-hidden border border-white/10">
          <button
            onClick={() => setShowDemo(p => !p)}
            className="w-full flex items-center justify-between px-6 py-4 text-white h-14"
          >
            <span className="text-sm font-black uppercase tracking-widest text-blue-200">Demo accounts</span>
            {showDemo
              ? <ChevronUp size={18} className="text-blue-300" />
              : <ChevronDown size={18} className="text-blue-300" />}
          </button>

          {showDemo && (
            <div className="px-4 pb-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
              {DEMO_ACCOUNTS.map(acc => (
                <button
                  key={acc.name}
                  onClick={() => quickLogin(acc.name, acc.password)}
                  className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 rounded-2xl px-4 py-3 transition-all text-left"
                >
                  <div>
                    <p className="text-white font-black text-sm leading-none">{acc.name}</p>
                    <p className="text-white/50 text-[10px] mt-1">{acc.desc}</p>
                  </div>
                  <span className={`shrink-0 ml-3 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${acc.color}`}>
                    {acc.roleLabel}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Gast / Patiënt */}
        <button
          onClick={onGuestAccess}
          className="w-full flex items-center justify-center space-x-2 text-blue-300 hover:text-white py-4 text-sm font-bold transition-colors"
        >
          <Search size={16} />
          <span>Pakket traceren zonder inloggen</span>
        </button>
      </div>
    </div>
  );
};

export default LoginScreen;
