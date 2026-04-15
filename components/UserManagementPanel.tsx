import React, { useState } from 'react';
import { Users, UserPlus, Link, X, Loader2, Copy, Check, Mail } from 'lucide-react';
import { Pharmacy, UserRole } from '../types';
import { inviteUser, generatePharmacyCode } from '../services/authService';

interface Props {
  pharmacies:        Pharmacy[];
  userRole:          UserRole;
  defaultPharmacyId?: string;   // vastgezet voor admin
}

type Modal = 'invite' | 'code' | null;

const INVITE_CONFIG: Record<string, { label: string; roleValue: string; btnLabel: string }> = {
  [UserRole.SUPERUSER]:  { label: 'Regiomanager uitnodigen', roleValue: 'supervisor', btnLabel: 'Regiomanager' },
  [UserRole.SUPERVISOR]: { label: 'Apotheker uitnodigen',    roleValue: 'admin',      btnLabel: 'Apotheker'     },
  [UserRole.ADMIN]:      { label: 'Medewerker uitnodigen',   roleValue: 'pharmacy',   btnLabel: 'Medewerker'    },
};

const UserManagementPanel: React.FC<Props> = ({ pharmacies, userRole, defaultPharmacyId }) => {
  const [modal, setModal]             = useState<Modal>(null);
  const [email, setEmail]             = useState('');
  const [pharmacyId, setPharmacyId]   = useState(defaultPharmacyId ?? pharmacies[0]?.id ?? '');
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [codeCopied, setCodeCopied]   = useState(false);

  const cfg = INVITE_CONFIG[userRole];
  const canGenerateCode = userRole === UserRole.SUPERVISOR || userRole === UserRole.ADMIN;

  const reset = () => {
    setEmail('');
    setError('');
    setSuccess('');
    setGeneratedCode('');
    setCodeCopied(false);
    if (!defaultPharmacyId) setPharmacyId(pharmacies[0]?.id ?? '');
  };

  const openModal = (m: Modal) => { reset(); setModal(m); };
  const closeModal = () => { setModal(null); reset(); };

  // ── Uitnodiging versturen ─────────────────────────────────────────
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pharmacyId || !cfg) return;
    setError('');
    setIsLoading(true);
    try {
      await inviteUser(email.trim(), cfg.roleValue, pharmacyId);
      setSuccess(`Uitnodiging verstuurd naar ${email.trim()}`);
      setEmail('');
    } catch {
      setError('Versturen mislukt. Controleer of Supabase geconfigureerd is.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Apotheekcode genereren ────────────────────────────────────────
  const handleGenerateCode = async () => {
    if (!pharmacyId) return;
    setError('');
    setIsLoading(true);
    try {
      const code = await generatePharmacyCode(pharmacyId);
      if (code) {
        setGeneratedCode(code);
      } else {
        setError('Genereren mislukt. Controleer of Supabase geconfigureerd is.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const inputCls = 'w-full bg-[#f7f9fb] rounded-2xl px-4 h-11 font-bold text-[#191c1e] text-sm focus:outline-none transition-all';
  const inputStyle = { boxShadow: '0 0 0 1px rgba(188,202,196,0.3)' };
  const inputFocusStyle = { boxShadow: '0 0 0 2px #006b5a40' };

  return (
    <>
      {/* ── Panel ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
        <h3 className="text-base font-black text-[#191c1e] flex items-center gap-2 mb-4">
          <Users size={18} className="text-[#006b5a]" />
          Gebruikers
        </h3>
        <div className="flex flex-wrap gap-2">
          {cfg && (
            <button
              onClick={() => openModal('invite')}
              className="flex items-center gap-1.5 px-4 h-10 text-white rounded-full font-black text-xs active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
            >
              <UserPlus size={14} />
              {cfg.btnLabel} uitnodigen
            </button>
          )}
          {canGenerateCode && (
            <button
              onClick={() => openModal('code')}
              className="flex items-center gap-1.5 px-4 h-10 bg-slate-800 text-white rounded-full font-black text-xs hover:bg-slate-700 active:scale-95 transition-all"
            >
              <Link size={14} />
              Koerier koppelen via code
            </button>
          )}
        </div>
      </div>

      {/* ── Modal backdrop ─────────────────────────────────────────── */}
      {modal && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ background: 'rgba(25,28,30,0.60)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">

            {/* ── INVITE MODAL ── */}
            {modal === 'invite' && (
              <form onSubmit={handleInvite}>
                <div className="flex items-center justify-between p-6 pb-4">
                  <h2 className="text-lg font-black text-[#191c1e]">{cfg?.label}</h2>
                  <button type="button" onClick={closeModal}
                    className="w-9 h-9 bg-[#f2f4f6] rounded-xl flex items-center justify-center text-[#3d4945] active:scale-90 transition-all">
                    <X size={16} />
                  </button>
                </div>

                <div className="px-6 pb-6 space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#3d4945]/50 ml-1">E-mailadres</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="naam@apotheek.nl"
                      required
                      className={inputCls}
                      style={inputStyle}
                      onFocus={e => e.currentTarget.style.boxShadow = inputFocusStyle.boxShadow}
                      onBlur={e => e.currentTarget.style.boxShadow = inputStyle.boxShadow}
                    />
                  </div>

                  {/* Apotheek kiezen — alleen als niet vast */}
                  {!defaultPharmacyId && pharmacies.length > 1 && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#3d4945]/50 ml-1">Apotheek</label>
                      <select
                        value={pharmacyId}
                        onChange={e => setPharmacyId(e.target.value)}
                        className={inputCls}
                        style={inputStyle}
                        onFocus={e => e.currentTarget.style.boxShadow = inputFocusStyle.boxShadow}
                        onBlur={e => e.currentTarget.style.boxShadow = inputStyle.boxShadow}
                      >
                        {pharmacies.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {error   && <p className="text-xs font-bold text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
                  {success && (
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">
                      <Check size={14} />
                      {success}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || !email}
                    className="w-full h-11 text-white rounded-full font-black text-sm disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                    {isLoading ? 'Versturen...' : 'Uitnodiging versturen'}
                  </button>
                </div>
              </form>
            )}

            {/* ── CODE MODAL ── */}
            {modal === 'code' && (
              <div>
                <div className="flex items-center justify-between p-6 pb-4">
                  <h2 className="text-lg font-black text-[#191c1e]">Koerier koppelen</h2>
                  <button onClick={closeModal}
                    className="w-9 h-9 bg-[#f2f4f6] rounded-xl flex items-center justify-center text-[#3d4945] active:scale-90 transition-all">
                    <X size={16} />
                  </button>
                </div>

                <div className="px-6 pb-6 space-y-4">
                  {/* Apotheek kiezen */}
                  {!defaultPharmacyId && pharmacies.length > 1 && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#3d4945]/50 ml-1">Apotheek</label>
                      <select
                        value={pharmacyId}
                        onChange={e => setPharmacyId(e.target.value)}
                        className={inputCls}
                        style={inputStyle}
                        onFocus={e => e.currentTarget.style.boxShadow = inputFocusStyle.boxShadow}
                        onBlur={e => e.currentTarget.style.boxShadow = inputStyle.boxShadow}
                      >
                        {pharmacies.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Gegenereerde code */}
                  {generatedCode ? (
                    <div className="space-y-3">
                      <div className="bg-slate-900 rounded-2xl p-6 text-center">
                        <p className="text-white/50 text-[10px] font-black uppercase tracking-widest mb-2">Apotheekcode</p>
                        <p className="text-white font-black text-4xl tracking-widest">{generatedCode}</p>
                      </div>
                      <p className="text-xs text-[#3d4945]/50 font-bold text-center">
                        Geldig 24 uur. Deel deze code met de koerier.
                      </p>
                      <button
                        onClick={copyCode}
                        className="w-full h-11 bg-[#f2f4f6] hover:bg-[#e8eceb] text-[#191c1e] rounded-2xl font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        {codeCopied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                        {codeCopied ? 'Gekopieerd!' : 'Kopieer code'}
                      </button>
                    </div>
                  ) : (
                    <>
                      {error && <p className="text-xs font-bold text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
                      <p className="text-sm text-[#3d4945]/50 font-bold leading-relaxed">
                        Genereer een eenmalige code die de koerier kan gebruiken om zijn account te koppelen aan {pharmacies.find(p => p.id === pharmacyId)?.name ?? 'deze apotheek'}.
                      </p>
                      <button
                        onClick={handleGenerateCode}
                        disabled={isLoading || !pharmacyId}
                        className="w-full h-11 bg-slate-800 text-white rounded-full font-black text-sm disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Link size={16} />}
                        {isLoading ? 'Genereren...' : 'Code genereren'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default UserManagementPanel;
