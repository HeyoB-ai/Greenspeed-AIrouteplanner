import React, { useEffect, useState } from 'react';
import { Building2, Info, MapPin } from 'lucide-react';
import { getMyPharmacies, type MyPharmacy } from '../services/regionManagerService';

// ── Wat een regiomanager ziet ─────────────────────────────────────────────
// Alleen de apotheken die een superuser of supervisor aan hem gekoppeld heeft
// (user_pharmacy_access, migratie 014). Lezen, niets anders: het koppelen zelf
// gebeurt in Regiobeheer, en pakketten of financiën horen hier voorlopig niet —
// die zijn per rol een eigen afweging en niet af te leiden uit de koppeling.

const RegionManagerView: React.FC = () => {
  const [pharmacies, setPharmacies] = useState<MyPharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await getMyPharmacies();
        if (!cancelled) setPharmacies(rows);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Apotheken laden mislukt.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-300 pb-24 lg:pb-8 space-y-4">

      <div>
        <h2 className="text-lg font-display font-black text-[#191c1e] flex items-center gap-2">
          <Building2 size={18} className="text-[#006b5a]" />
          Mijn apotheken
        </h2>
        {!loading && pharmacies.length > 0 && (
          <p className="text-sm text-[#3d4945]/70 mt-0.5">
            {pharmacies.length} {pharmacies.length === 1 ? 'apotheek' : 'apotheken'} aan je toegewezen
          </p>
        )}
      </div>

      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      {loading && <p className="text-sm font-bold text-[#3d4945]/60">Laden…</p>}

      {!loading && !error && pharmacies.length === 0 && (
        <div className="bg-white rounded-xl border border-[#f2f4f6] p-5 flex items-start gap-3">
          <Info size={18} className="text-[#3d4945]/50 shrink-0 mt-0.5" />
          <p className="text-sm text-[#3d4945]">
            Je hebt nog geen apotheken toegewezen gekregen. Neem contact op met de beheerder.
          </p>
        </div>
      )}

      {pharmacies.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pharmacies.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-[#f2f4f6] p-4"
              style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}
            >
              <div className="flex items-start gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[#006b5a]/10 flex items-center justify-center shrink-0">
                  <Building2 size={16} className="text-[#006b5a]" />
                </span>
                <div className="min-w-0">
                  <p className="font-display font-black text-[#191c1e] leading-tight break-words">
                    {p.name}
                  </p>
                  {p.address ? (
                    <p className="text-sm text-[#3d4945]/80 mt-1 flex items-start gap-1.5">
                      <MapPin size={13} className="text-[#3d4945]/50 shrink-0 mt-0.5" />
                      <span className="break-words">{p.address}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-[#3d4945]/50 mt-1">Geen adres bekend</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RegionManagerView;
