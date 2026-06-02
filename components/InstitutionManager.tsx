import React, { useState, useEffect, useMemo } from 'react';
import { Institution, DeliveryFrequency } from '../types';
import { db, getAuthHeaders } from '../services/supabaseService';
import {
  Building2, Plus, Pencil, Trash2, Info, X, Loader2, User, Phone,
} from 'lucide-react';

interface Props {
  pharmacyId:   string;
  pharmacyName: string;
  canEdit:      boolean; // true voor apotheker/admin/supervisor/superuser
}

// Bezorgdagen — code (opslag) + label (weergave)
const DAYS: { code: string; label: string }[] = [
  { code: 'ma', label: 'Ma' },
  { code: 'di', label: 'Di' },
  { code: 'wo', label: 'Wo' },
  { code: 'do', label: 'Do' },
  { code: 'vr', label: 'Vr' },
  { code: 'za', label: 'Za' },
];

const FREQ_BADGE: Record<DeliveryFrequency, { cls: string; label: string }> = {
  daily:  { cls: 'bg-[#006b5a]/15 text-[#006b5a]', label: 'DAGELIJKS' },
  weekly: { cls: 'bg-[#253046]/10 text-[#253046]', label: 'WEKELIJKS' },
  both:   { cls: 'bg-[#48c2a9]/15 text-[#006b5a]', label: 'DAGELIJKS + WEKELIJKS' },
};

const dayLabels = (codes: string[]): string =>
  DAYS.filter(d => codes.includes(d.code)).map(d => d.label).join(' ');

// Geocodeer één adres via de bestaande Netlify maps-functie
async function geocodeInstitution(addr: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch('/.netlify/functions/maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
      body: JSON.stringify({ action: 'geocode', addresses: [addr] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.results?.[0] ?? null;
  } catch (err) {
    console.error('[Institutions] Geocode mislukt:', err);
    return null;
  }
}

const InstitutionManager: React.FC<Props> = ({ pharmacyId, pharmacyName, canEdit }) => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [editing, setEditing]           = useState<Institution | null>(null);
  const [expanded, setExpanded]         = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const data = await db.fetchInstitutions(pharmacyId);
      setInstitutions(data);
    } catch (err) {
      console.error('[Institutions] Laden mislukt:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [pharmacyId]);

  const sorted = useMemo(
    () => [...institutions].sort((a, b) => a.name.localeCompare(b.name, 'nl')),
    [institutions],
  );

  const toggleInfo = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleSave = async (inst: Institution) => {
    // Optimistisch bijwerken zodat de lijst direct reageert
    setInstitutions(prev => {
      const idx = prev.findIndex(i => i.id === inst.id);
      if (idx === -1) return [...prev, inst];
      const copy = [...prev];
      copy[idx] = inst;
      return copy;
    });
    setShowModal(false);
    setEditing(null);
    try {
      await db.saveInstitution(inst);
    } catch (err) {
      console.error('[Institutions] Opslaan mislukt:', err);
      alert('Opslaan mislukt. Probeer opnieuw.');
    }
    await load(); // server-state is leidend
  };

  const handleDelete = async (inst: Institution) => {
    if (!confirm(`"${inst.name}" verwijderen?`)) return;
    setInstitutions(prev => prev.filter(i => i.id !== inst.id));
    try {
      await db.deleteInstitution(inst.id);
    } catch (err) {
      console.error('[Institutions] Verwijderen mislukt:', err);
      alert('Verwijderen mislukt. Probeer opnieuw.');
      await load();
    }
  };

  return (
    <div className="space-y-4">
      {/* Kop + toevoegen */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base lg:text-lg font-display font-black text-[#191c1e]">Vaste instellingen</h3>
          <p className="text-[10px] font-display font-black text-[#3d4945]/50 uppercase tracking-widest mt-0.5">
            {pharmacyName} · {institutions.length} instelling{institutions.length !== 1 ? 'en' : ''}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditing(null); setShowModal(true); }}
            className="flex items-center gap-1.5 px-4 h-10 text-white rounded-full font-display font-bold text-xs active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
          >
            <Plus size={14} />
            Instelling toevoegen
          </button>
        )}
      </div>

      {/* Lijst */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-[#3d4945]/50">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
          <div className="w-14 h-14 rounded-full bg-[#48c2a9]/15 flex items-center justify-center mx-auto mb-4">
            <Building2 className="text-[#006b5a]" size={26} />
          </div>
          <p className="text-[#191c1e] font-display font-black">Nog geen instellingen</p>
          <p className="text-[#3d4945]/60 text-sm font-body mt-1">
            Voeg zorginstellingen toe die regelmatig bevoorraad worden.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map(inst => {
            const badge = FREQ_BADGE[inst.frequency];
            const isOpen = expanded.has(inst.id);
            return (
              <div
                key={inst.id}
                className={`bg-white rounded-2xl p-4 transition-opacity ${inst.isActive ? '' : 'opacity-60'}`}
                style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}
              >
                {/* Bovenste rij: naam + frequentie */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#48c2a9]/15 flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-[#006b5a]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-display font-black text-[#191c1e] text-sm truncate">{inst.name}</p>
                      <span className={`text-[10px] font-display font-black px-2 py-0.5 rounded-full ${badge.cls}`}>
                        {badge.label}
                      </span>
                      {!inst.isActive && (
                        <span className="text-[10px] font-display font-black px-2 py-0.5 rounded-full bg-[#f2f4f6] text-[#3d4945]/60">
                          INACTIEF
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#3d4945]/70 font-body font-bold mt-0.5">
                      {inst.address || 'Geen adres'}
                    </p>
                    {inst.deliveryDays.length > 0 && (
                      <p className="text-xs text-[#3d4945]/50 font-body font-bold mt-1">
                        {dayLabels(inst.deliveryDays)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Acties */}
                <div className="flex items-center justify-end gap-1.5 mt-2">
                  <button
                    onClick={() => toggleInfo(inst.id)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 ${
                      isOpen ? 'bg-amber-100 text-amber-700' : 'bg-[#f2f4f6] text-[#3d4945]'
                    }`}
                    title="Bezorginstructies"
                  >
                    <Info size={15} />
                  </button>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => { setEditing(inst); setShowModal(true); }}
                        className="w-9 h-9 rounded-xl bg-[#f2f4f6] text-[#3d4945] flex items-center justify-center active:scale-90 transition-all"
                        title="Bewerken"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(inst)}
                        className="w-9 h-9 rounded-xl bg-[#f2f4f6] text-[#3d4945] flex items-center justify-center active:scale-90 hover:bg-red-50 hover:text-red-600 transition-all"
                        title="Verwijderen"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>

                {/* Instructiekaart */}
                {isOpen && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-2 text-sm">
                    <p className="font-bold text-amber-800 mb-1">📋 Bezorginstructies</p>
                    <p className="text-amber-700 whitespace-pre-wrap">
                      {inst.instructions || 'Geen instructies ingevoerd.'}
                    </p>
                    {inst.contactPerson && (
                      <p className="text-amber-700 mt-2">
                        👤 Contact: {inst.contactPerson}
                        {inst.contactPhone && ` — ${inst.contactPhone}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <InstitutionFormModal
          pharmacyId={pharmacyId}
          institution={editing}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null); }}
        />
      )}
    </div>
  );
};

// ── Toevoegen / bewerken modal ─────────────────────────────────────────
const InstitutionFormModal: React.FC<{
  pharmacyId:  string;
  institution: Institution | null;
  onSave:      (inst: Institution) => Promise<void>;
  onClose:     () => void;
}> = ({ pharmacyId, institution, onSave, onClose }) => {
  const [name, setName]                 = useState(institution?.name ?? '');
  const [street, setStreet]             = useState(institution?.street ?? '');
  const [houseNumber, setHouseNumber]   = useState(institution?.houseNumber ?? '');
  const [postalCode, setPostalCode]     = useState(institution?.postalCode ?? '');
  const [city, setCity]                 = useState(institution?.city ?? '');
  const [frequency, setFrequency]       = useState<DeliveryFrequency>(institution?.frequency ?? 'weekly');
  const [deliveryDays, setDeliveryDays] = useState<string[]>(institution?.deliveryDays ?? []);
  const [instructions, setInstructions] = useState(institution?.instructions ?? '');
  const [contactPerson, setContactPerson] = useState(institution?.contactPerson ?? '');
  const [contactPhone, setContactPhone] = useState(institution?.contactPhone ?? '');
  const [isActive, setIsActive]         = useState(institution?.isActive ?? true);
  const [saving, setSaving]             = useState(false);

  const toggleDay = (code: string) =>
    setDeliveryDays(prev => prev.includes(code) ? prev.filter(d => d !== code) : [...prev, code]);

  const inputStyle = {
    boxShadow: '0 0 0 1px rgba(188,202,196,0.2)',
  } as React.CSSProperties;
  const focusOn  = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    (e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40');
  const focusOff = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    (e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.2)');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);

    const composedAddress = [
      [street.trim(), houseNumber.trim()].filter(Boolean).join(' '),
      [postalCode.trim(), city.trim()].filter(Boolean).join(' '),
    ].filter(Boolean).join(', ');

    // Geocodeer wanneer er een bruikbaar adres is, zodat de routeplanner GPS heeft
    let coords: { lat: number; lng: number } | null = null;
    if (street.trim() && postalCode.trim()) {
      coords = await geocodeInstitution(
        `${street.trim()} ${houseNumber.trim()}, ${postalCode.trim()} ${city.trim()}, Netherlands`,
      );
    }

    const inst: Institution = {
      id:           institution?.id ?? `inst-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pharmacyId,
      name:         name.trim(),
      address:      composedAddress || name.trim(),
      street:       street.trim() || undefined,
      houseNumber:  houseNumber.trim() || undefined,
      postalCode:   postalCode.trim() || undefined,
      city:         city.trim() || undefined,
      addressLat:   coords?.lat ?? institution?.addressLat,
      addressLng:   coords?.lng ?? institution?.addressLng,
      frequency,
      deliveryDays,
      instructions: instructions.trim() || undefined,
      contactPerson: contactPerson.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      isActive,
      createdAt:    institution?.createdAt ?? new Date().toISOString(),
    };

    try {
      await onSave(inst);
    } finally {
      setSaving(false);
    }
  };

  const fieldLabel = (label: string, required = false) => (
    <label className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/60 ml-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200"
      style={{ background: 'rgba(25,28,30,0.60)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div
        className="bg-white rounded-t-4xl sm:rounded-4xl w-full sm:max-w-lg max-h-[92vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300"
        style={{ boxShadow: '0 24px 64px rgba(25,28,30,0.20)' }}
      >
        <div className="flex items-center justify-between px-7 pt-7 pb-4 shrink-0">
          <h2 className="text-xl font-display font-black text-[#191c1e]">
            {institution ? 'Instelling bewerken' : 'Instelling toevoegen'}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-[#f2f4f6] flex items-center justify-center text-[#3d4945] active:scale-90 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-7 pb-7 space-y-4 overflow-y-auto">
          {/* Naam */}
          <div className="space-y-1.5">
            {fieldLabel('Naam instelling', true)}
            <input
              type="text" value={name} onChange={e => setName(e.target.value)} required
              placeholder="bijv. Verpleeghuis De Lindenhof"
              className="w-full bg-white rounded-xl px-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none transition-all"
              style={inputStyle} onFocus={focusOn} onBlur={focusOff}
            />
          </div>

          {/* Straat + huisnummer */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              {fieldLabel('Straat')}
              <input
                type="text" value={street} onChange={e => setStreet(e.target.value)}
                placeholder="Dorpsstraat"
                className="w-full bg-white rounded-xl px-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none transition-all"
                style={inputStyle} onFocus={focusOn} onBlur={focusOff}
              />
            </div>
            <div className="w-28 space-y-1.5">
              {fieldLabel('Huisnr.')}
              <input
                type="text" value={houseNumber} onChange={e => setHouseNumber(e.target.value)}
                placeholder="12"
                className="w-full bg-white rounded-xl px-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none transition-all"
                style={inputStyle} onFocus={focusOn} onBlur={focusOff}
              />
            </div>
          </div>

          {/* Postcode + stad */}
          <div className="flex gap-3">
            <div className="w-32 space-y-1.5">
              {fieldLabel('Postcode')}
              <input
                type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)}
                placeholder="1234AB"
                className="w-full bg-white rounded-xl px-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none transition-all"
                style={inputStyle} onFocus={focusOn} onBlur={focusOff}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              {fieldLabel('Stad')}
              <input
                type="text" value={city} onChange={e => setCity(e.target.value)}
                placeholder="Amsterdam"
                className="w-full bg-white rounded-xl px-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none transition-all"
                style={inputStyle} onFocus={focusOn} onBlur={focusOff}
              />
            </div>
          </div>

          {/* Frequentie */}
          <div className="space-y-1.5">
            {fieldLabel('Frequentie')}
            <div className="flex gap-2">
              {([
                { val: 'daily',  label: 'Dagelijks' },
                { val: 'weekly', label: 'Wekelijks' },
                { val: 'both',   label: 'Beide' },
              ] as { val: DeliveryFrequency; label: string }[]).map(opt => (
                <button
                  key={opt.val} type="button" onClick={() => setFrequency(opt.val)}
                  className={`flex-1 h-11 rounded-xl font-display font-bold text-xs transition-all active:scale-95 border-2 ${
                    frequency === opt.val
                      ? 'bg-[#48c2a9]/10 border-[#006b5a] text-[#006b5a]'
                      : 'bg-[#f2f4f6] border-transparent text-[#3d4945]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bezorgdagen */}
          <div className="space-y-1.5">
            {fieldLabel('Bezorgdagen')}
            <div className="flex gap-2">
              {DAYS.map(d => {
                const on = deliveryDays.includes(d.code);
                return (
                  <button
                    key={d.code} type="button" onClick={() => toggleDay(d.code)}
                    className={`flex-1 h-11 rounded-xl font-display font-bold text-xs transition-all active:scale-95 border-2 ${
                      on
                        ? 'bg-[#48c2a9]/10 border-[#006b5a] text-[#006b5a]'
                        : 'bg-[#f2f4f6] border-transparent text-[#3d4945]'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bezorginstructies */}
          <div className="space-y-1.5">
            {fieldLabel('Bezorginstructies')}
            <textarea
              value={instructions} onChange={e => setInstructions(e.target.value)}
              rows={4}
              placeholder="bijv. Bel aan bij hoofdingang, vraag naar zuster Karin, medicijnen afgeven bij balie 2"
              className="w-full bg-white rounded-xl px-5 py-3 font-body font-bold text-[#191c1e] text-sm outline-none transition-all resize-none"
              style={inputStyle} onFocus={focusOn} onBlur={focusOff}
            />
          </div>

          {/* Contact */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              {fieldLabel('Contactpersoon')}
              <div className="relative">
                <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3d4945]/40" />
                <input
                  type="text" value={contactPerson} onChange={e => setContactPerson(e.target.value)}
                  placeholder="Zuster Karin"
                  className="w-full bg-white rounded-xl pl-10 pr-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none transition-all"
                  style={inputStyle} onFocus={focusOn} onBlur={focusOff}
                />
              </div>
            </div>
            <div className="flex-1 space-y-1.5">
              {fieldLabel('Telefoonnummer')}
              <div className="relative">
                <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#3d4945]/40" />
                <input
                  type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                  placeholder="06 12345678"
                  className="w-full bg-white rounded-xl pl-10 pr-5 h-12 font-body font-bold text-[#191c1e] text-sm outline-none transition-all"
                  style={inputStyle} onFocus={focusOn} onBlur={focusOff}
                />
              </div>
            </div>
          </div>

          {/* Actief toggle */}
          <button
            type="button" onClick={() => setIsActive(v => !v)}
            className="w-full flex items-center justify-between bg-[#f2f4f6] rounded-xl px-5 h-12 active:scale-[0.99] transition-all"
          >
            <span className="font-display font-bold text-sm text-[#191c1e]">Actief</span>
            <span className={`relative w-11 h-6 rounded-full transition-colors ${isActive ? 'bg-[#006b5a]' : 'bg-[#bccac4]'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${isActive ? 'left-[22px]' : 'left-0.5'}`} />
            </span>
          </button>

          {/* Acties */}
          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 h-12 rounded-full font-display font-semibold text-sm text-[#101c30] bg-[#d7e2fe] active:scale-95 transition-all"
            >
              Annuleren
            </button>
            <button
              type="submit" disabled={saving || !name.trim()}
              className="flex-1 h-12 rounded-full text-white font-display font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Opslaan…' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InstitutionManager;
