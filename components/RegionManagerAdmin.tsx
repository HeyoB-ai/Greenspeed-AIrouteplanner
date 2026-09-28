import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2, Check, ChevronDown, ChevronUp, Loader2, Plus, Search, Trash2, UserCog,
} from 'lucide-react';
import { Pharmacy } from '../types';
import {
  DB_ROLES, ROLE_LABELS,
  getUsersWithRole, findUserByEmail, getPharmacyAccessForUser,
  grantPharmacyAccess, revokePharmacyAccess, setUserRole,
  type PharmacyAccessRow, type ProfileWithEmail,
} from '../services/regionManagerService';

// ── Regiobeheer ───────────────────────────────────────────────────────────
// Twee dingen op één scherm, omdat ze in de praktijk één handeling zijn: je
// maakt iemand regiomanager en koppelt hem meteen aan zijn apotheken. Los van
// elkaar zou de eerste helft een gebruiker achterlaten die nog niets ziet.
//
// De koppelingen worden per manager pas geladen als het blok openklapt: met
// vijftien apotheken en een handvol managers is dat geen optimalisatie maar het
// verschil tussen één query en een query per manager bij elk bezoek.

interface Props {
  pharmacies: Pharmacy[];
}

const RegionManagerAdmin: React.FC<Props> = ({ pharmacies }) => {
  const [managers, setManagers] = useState<ProfileWithEmail[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [openId, setOpenId] = useState<string | null>(null);
  const [access, setAccess] = useState<PharmacyAccessRow[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pickId, setPickId] = useState('');

  // ── Rol toewijzen ───────────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<ProfileWithEmail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [newRole, setNewRole] = useState('region_manager');
  const [roleSaved, setRoleSaved] = useState(false);
  const [roleError, setRoleError] = useState('');

  const loadManagers = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const rows = await getUsersWithRole('region_manager');
      setManagers(rows);
      // Aantallen in één keer: één query per manager, maar alleen bij het laden
      // van de lijst en niet bij elke render.
      const pairs = await Promise.all(
        rows.map(async (m) => [m.id, (await getPharmacyAccessForUser(m.id)).length] as const),
      );
      setCounts(Object.fromEntries(pairs));
    } catch (e: any) {
      setError(e?.message ?? 'Regiomanagers laden mislukt. Log in met een echt account.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadManagers(); }, [loadManagers]);

  const openManager = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id); setPicking(false); setPickId(''); setAccessLoading(true); setError('');
    try {
      setAccess(await getPharmacyAccessForUser(id));
    } catch (e: any) {
      setError(e?.message ?? 'Koppelingen laden mislukt.');
      setAccess([]);
    } finally {
      setAccessLoading(false);
    }
  };

  const reloadAccess = async (id: string) => {
    const rows = await getPharmacyAccessForUser(id);
    setAccess(rows);
    setCounts((c) => ({ ...c, [id]: rows.length }));
  };

  const grant = async (id: string, pharmacyId: string) => {
    if (!pharmacyId) return;
    setBusy(true); setError('');
    try {
      await grantPharmacyAccess(id, pharmacyId);
      await reloadAccess(id);
      setPicking(false); setPickId('');
    } catch (e: any) {
      setError(e?.message ?? 'Koppelen mislukt.');
    } finally { setBusy(false); }
  };

  const revoke = async (id: string, pharmacyId: string) => {
    setBusy(true); setError('');
    try {
      await revokePharmacyAccess(id, pharmacyId);
      await reloadAccess(id);
    } catch (e: any) {
      setError(e?.message ?? 'Ontkoppelen mislukt.');
    } finally { setBusy(false); }
  };

  const search = async () => {
    const addr = email.trim();
    if (!addr) return;
    setSearching(true); setRoleError(''); setRoleSaved(false); setFound(null); setNotFound(false);
    try {
      const user = await findUserByEmail(addr);
      if (!user) { setNotFound(true); return; }
      setFound(user);
      setNewRole(user.role ?? 'region_manager');
    } catch (e: any) {
      setRoleError(e?.message ?? 'Zoeken mislukt.');
    } finally { setSearching(false); }
  };

  const saveRole = async () => {
    if (!found) return;
    setBusy(true); setRoleError(''); setRoleSaved(false);
    try {
      await setUserRole(found.id, newRole);
      setFound({ ...found, role: newRole });
      setRoleSaved(true);
      // De lijst bovenaan verandert mee: iemand komt erbij of valt eruit.
      await loadManagers();
    } catch (e: any) {
      setRoleError(e?.message ?? 'Rol opslaan mislukt.');
    } finally { setBusy(false); }
  };

  // Alleen apotheken die nog niet gekoppeld zijn aan de open manager.
  const linkedIds = new Set(access.map((a) => a.pharmacyId));
  const available = pharmacies
    .filter((p) => !linkedIds.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  return (
    <div className="space-y-8">

      {/* ══ Regiomanagers ══════════════════════════════════════════════ */}
      <div>
        <h3 className="text-sm font-black text-[#191c1e] mb-3 flex items-center gap-2">
          <UserCog size={16} className="text-[#006b5a]" /> Regiomanagers
        </h3>

        {error && <p className="text-sm font-bold text-red-600 mb-3">{error}</p>}
        {loading && <p className="text-sm font-bold text-[#3d4945]/60">Laden…</p>}

        {!loading && managers.length === 0 && (
          <p className="text-sm text-[#3d4945]/60">
            Nog geen regiomanagers. Wijs hieronder een gebruiker de rol toe.
          </p>
        )}

        <div className="space-y-2">
          {managers.map((m) => {
            const open = openId === m.id;
            return (
              <div key={m.id} className="bg-white rounded-xl border border-[#f2f4f6] overflow-hidden">

                {/* Rij */}
                <button
                  onClick={() => openManager(m.id)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-[#f7f9fb] transition-colors"
                >
                  <span className="font-bold text-[#191c1e] min-w-0 flex-1 truncate">
                    {m.name ?? '(naam onbekend)'}
                  </span>
                  <span className="text-sm text-[#3d4945]/70 min-w-0 hidden sm:block truncate max-w-[16rem]">
                    {m.email ?? '—'}
                  </span>
                  <span className="text-xs font-bold text-[#3d4945] bg-[#f2f4f6] rounded-full px-2.5 py-1 shrink-0">
                    {counts[m.id] ?? 0} {(counts[m.id] ?? 0) === 1 ? 'apotheek' : 'apotheken'}
                  </span>
                  {open
                    ? <ChevronUp size={16} className="text-[#3d4945]/60 shrink-0" />
                    : <ChevronDown size={16} className="text-[#3d4945]/60 shrink-0" />}
                </button>

                {/* Uitklap: gekoppelde apotheken */}
                {open && (
                  <div className="border-t border-[#f2f4f6] px-4 py-3 space-y-2">
                    {/* Op mobiel staat het adres niet in de rij; hier wel. */}
                    <p className="text-xs text-[#3d4945]/60 sm:hidden">{m.email ?? 'geen e-mailadres'}</p>

                    {accessLoading && <p className="text-sm text-[#3d4945]/60">Laden…</p>}

                    {!accessLoading && access.length === 0 && (
                      <p className="text-sm text-[#3d4945]/60">Nog geen apotheken gekoppeld.</p>
                    )}

                    {!accessLoading && access.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-3 bg-[#f7f9fb] rounded-lg px-3 py-2">
                        <span className="text-sm font-bold text-[#191c1e] min-w-0 truncate flex items-center gap-2">
                          <Building2 size={14} className="text-[#3d4945]/50 shrink-0" />
                          {a.pharmacyName}
                        </span>
                        <button
                          onClick={() => revoke(m.id, a.pharmacyId)}
                          disabled={busy}
                          className="h-8 px-2.5 rounded-full bg-white border border-[#f2f4f6] text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 flex items-center gap-1 shrink-0"
                        >
                          <Trash2 size={13} /> Ontkoppelen
                        </button>
                      </div>
                    ))}

                    {/* Toevoegen */}
                    {picking ? (
                      <div className="flex gap-2 pt-1">
                        <select
                          value={pickId}
                          onChange={(e) => setPickId(e.target.value)}
                          className="flex-1 h-10 px-3 rounded-xl bg-[#f2f4f6] text-sm font-bold text-[#191c1e] outline-none"
                        >
                          <option value="">— Kies een apotheek —</option>
                          {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button
                          onClick={() => grant(m.id, pickId)}
                          disabled={busy || !pickId}
                          className="h-10 px-4 rounded-xl bg-[#006b5a] text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                        >
                          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Koppelen
                        </button>
                        <button
                          onClick={() => { setPicking(false); setPickId(''); }}
                          className="h-10 px-3 rounded-xl bg-[#f2f4f6] text-sm font-bold text-[#3d4945]"
                        >
                          Annuleren
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPicking(true)}
                        disabled={available.length === 0}
                        className="h-9 px-3 rounded-full bg-[#f2f4f6] text-xs font-bold text-[#3d4945] hover:bg-[#e8eaec] disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Plus size={14} />
                        {available.length === 0 ? 'Alle apotheken al gekoppeld' : 'Apotheek toevoegen'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ Rol toewijzen ══════════════════════════════════════════════ */}
      <div>
        <h3 className="text-sm font-black text-[#191c1e] mb-3 flex items-center gap-2">
          <Search size={16} className="text-[#006b5a]" /> Rol toewijzen
        </h3>

        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFound(null); setNotFound(false); setRoleSaved(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
            placeholder="E-mailadres van de gebruiker"
            className="flex-1 h-10 px-3 rounded-xl bg-[#f2f4f6] text-sm font-bold text-[#191c1e] outline-none"
          />
          <button
            onClick={search}
            disabled={searching || !email.trim()}
            className="h-10 px-4 rounded-xl bg-[#006b5a] text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Zoeken
          </button>
        </div>

        {roleError && <p className="text-sm font-bold text-red-600 mt-3">{roleError}</p>}

        {notFound && (
          <p className="text-sm text-[#3d4945]/70 mt-3">
            Geen account met dat e-mailadres. De gebruiker moet zich eerst registreren of
            uitgenodigd worden.
          </p>
        )}

        {found && (
          <div className="mt-3 bg-white rounded-xl border border-[#f2f4f6] px-4 py-3 space-y-3">
            <div>
              <p className="font-bold text-[#191c1e]">{found.name ?? '(nog geen profiel)'}</p>
              <p className="text-xs text-[#3d4945]/70">{found.email}</p>
              <p className="text-xs text-[#3d4945]/70 mt-1">
                Huidige rol:{' '}
                <span className="font-bold text-[#3d4945]">
                  {found.role ? (ROLE_LABELS[found.role] ?? found.role) : 'geen rol ingesteld'}
                </span>
              </p>
            </div>

            <div className="flex gap-2">
              <select
                value={newRole}
                onChange={(e) => { setNewRole(e.target.value); setRoleSaved(false); }}
                className="flex-1 h-10 px-3 rounded-xl bg-[#f2f4f6] text-sm font-bold text-[#191c1e] outline-none"
              >
                {DB_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                ))}
              </select>
              <button
                onClick={saveRole}
                disabled={busy || newRole === found.role}
                className="h-10 px-4 rounded-xl bg-[#006b5a] text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Opslaan
              </button>
            </div>

            {roleSaved && (
              <p className="text-sm font-bold text-[#006b5a]">
                Rol opgeslagen. {newRole === 'region_manager' && 'Koppel hierboven zijn apotheken.'}
              </p>
            )}

            {found.role === null && (
              <p className="text-xs text-amber-600">
                Deze gebruiker heeft nog geen profielrij. Een rol opslaan werkt pas nadat hij
                één keer is ingelogd.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RegionManagerAdmin;
