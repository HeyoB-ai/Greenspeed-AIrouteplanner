import React, { useState, useEffect } from 'react';
import { Link, Copy, Check, Loader2, RefreshCw, CloudOff } from 'lucide-react';
import { Pharmacy } from '../types';
import { setPharmacyCourierCode } from '../services/authService';
import { supabase } from '../services/supabaseService';

interface Props {
  pharmacy:      Pharmacy;
  canManage:     boolean; // superuser/supervisor/admin/pharmacy
  onCodeChange?: (pharmacyId: string, code: string) => void;
}

const PharmacyCourierCode: React.FC<Props> = ({ pharmacy, canManage, onCodeChange }) => {
  const [code, setCode]           = useState<string | null>(pharmacy.courierCode ?? null);
  const [copied, setCopied]       = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError]         = useState('');

  // Houd de code in sync wanneer er van apotheek gewisseld wordt
  useEffect(() => {
    setCode(pharmacy.courierCode ?? null);
    setError('');
  }, [pharmacy.id, pharmacy.courierCode]);

  const handleCopy = () => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const newCode = await setPharmacyCourierCode(pharmacy.id);
      if (newCode) {
        setCode(newCode);
        onCodeChange?.(pharmacy.id, newCode);
      } else {
        setError('Code aanmaken mislukt. Controleer de databaseverbinding.');
      }
    } finally {
      setGenerating(false);
    }
  };

  // Zonder cloud werkt koppelen via codes niet
  if (!supabase) {
    return (
      <div className="bg-[#f2f4f6] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <CloudOff size={16} className="text-amber-600" />
          <span className="font-display font-black text-sm text-[#191c1e]">Koppelcode voor koeriers</span>
        </div>
        <p className="text-xs text-[#3d4945]">
          Koppelcodes vereisen een gekoppelde database (cloud). Configureer Supabase om codes te gebruiken.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#f2f4f6] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Link size={16} className="text-[#006b5a]" />
          <span className="font-display font-black text-sm text-[#191c1e]">
            Koppelcode voor koeriers
          </span>
        </div>
        {code && (
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 h-8 bg-white rounded-full text-xs font-bold text-[#3d4945] border border-[#48c2a9]/30 active:scale-95 transition-all"
          >
            {copied
              ? <><Check size={12} className="text-[#006b5a]" /> Gekopieerd</>
              : <><Copy size={12} /> Kopieer</>}
          </button>
        )}
      </div>

      {code ? (
        <>
          <div className="bg-white rounded-xl px-4 py-3 flex items-center justify-between border border-[#48c2a9]/20">
            <span className="font-display font-black text-2xl text-[#006b5a] tracking-widest">
              {code}
            </span>
            <span className="text-xs text-[#3d4945] font-bold">permanent</span>
          </div>
          <div className="flex items-center justify-between mt-2 gap-2">
            <p className="text-xs text-[#3d4945]">
              Deel deze code met koeriers zodat zij zich kunnen koppelen aan {pharmacy.name}.
            </p>
            {canManage && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="shrink-0 flex items-center gap-1 text-xs text-[#006b5a] font-bold underline disabled:opacity-50"
              >
                {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                Nieuwe code
              </button>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-[#3d4945] mb-3">
            Er is nog geen koppelcode. {canManage
              ? 'Genereer er één om met koeriers te delen.'
              : 'Vraag een beheerder om er één aan te maken.'}
          </p>
          {canManage && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 px-4 h-10 text-white rounded-full font-display font-bold text-xs disabled:opacity-50 active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Link size={14} />}
              {generating ? 'Aanmaken…' : 'Genereer koppelcode'}
            </button>
          )}
        </>
      )}

      {error && <p className="text-xs font-bold text-red-500 mt-2">{error}</p>}
    </div>
  );
};

export default PharmacyCourierCode;
