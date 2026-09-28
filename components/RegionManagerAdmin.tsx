import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2, Check, ChevronDown, ChevronUp, Loader2, Plus, Trash2, Users,
} from 'lucide-react';
import { Pharmacy } from '../types';
import {
  DB_ROLES, ROLE_LABELS,
  getAllUsers, getPharmacyAccessForUser,
  grantPharmacyAccess, revokePharmacyAccess, setUserRole, setIsPlanner,
  type PharmacyAccessRow, type ProfileWithEmail,
} from '../services/regionManagerService';

// ── Regiobeheer ───────────────────────────────────────────────────────────
// Eén tabel met alle gebruikers: rol en planner-toegang staan per rij naast
// elkaar, want in de praktijk zet je ze in één handeling. Een aparte lijst per
// rol zou dezelfde mensen twee keer tonen.
//
// De apotheek-koppeling hangt onder de rij van een regiomanager en wordt pas
// geladen bij het openklappen — dat is één query in plaats van één per
// gebruiker bij elk bezoek.

interface Props {
  pharmacies: Pharmacy[];
}

/** De niet-opgeslagen keuzes van één rij. */
interface Draft {
  role: string;
  isPlanner: boolean;
}

const RegionManagerAdmin: React.FC<Props> = ({ pharmacies }) => {
  const [users, setUsers] = useState<ProfileWithEmail[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  // Fout per rij: in een tabel van dertig gebruikers staat één melding bovenaan
  // buiten beeld, en dan lijkt Opslaan niets te doen.
  const [rowError, setRowError] = useState<Record<string, string>>({});

  // Apotheek-koppeling van de opengeklapte regiomanager.
  const [openId, setOpenId] = useState<string | null>(null);
  const [access, setAccess] = useState<PharmacyAccessRow[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [picking, setPicking] = useState(false);
  const [pickId, setPickId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const rows = await getAllUsers();
      setUsers(rows);
      // Concepten gelijkzetten met wat er in de database staat: daarna is
      // "gewijzigd" simpelweg het verschil tussen draft en rij.
      setDrafts(Object.fromEntries(
        rows.map((u) => [u.id, { role: u.role ?? '', isPlanner: u.isPlanner }]),
      ));
    } catch (e: any) {
      setError(e?.message ?? 'Gebruikers laden mislukt. Log in met een echt account.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setDraft = (id: string, patch: Partial<Draft>) => {
    setSavedId(null);
    setRowError((m) => ({ ...m, [id]: '' }));
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  };

  // Rollen zijn overal de database-schrijfwijze (kleine letters): de <option>s
  // komen uit DB_ROLES en user_profiles.role slaat ze zo op. Toch aan beide
  // kanten normaliseren, zodat een rij met afwijkende schrijfwijze niet
  // eeuwig als "gewijzigd" blijft gelden.
  const normRole = (r: string | null | undefined) => (r ?? '').toLowerCase();

  // De exacte conditie waarop Opslaan aan gaat. Rol EN vinkje tellen los mee,
  // met || ertussen: alleen het vinkje omzetten maakt de rij dus al gewijzigd.
  const isDirty = (u: ProfileWithEmail) => {
    const d = drafts[u.id];
    if (!d) return false;
    const roleChanged = normRole(d.role) !== normRole(u.role);
    const plannerChanged = d.isPlanner !== u.isPlanner;
    return roleChanged || plannerChanged;
  };

  const save = async (u: ProfileWithEmail) => {
    const d = drafts[u.id];
    if (!d) return;
    setSavingId(u.id); setError(''); setSavedId(null);
    setRowError((m) => ({ ...m, [u.id]: '' }));

    const roleChanged = normRole(d.role) !== normRole(u.role);
    const plannerChanged = d.isPlanner !== u.isPlanner;
    console.log('[regiobeheer] opslaan', {
      user: u.id, naam: u.name,
      rol: roleChanged ? `${u.role ?? '(geen)'} → ${d.role}` : 'ongewijzigd',
      planner: plannerChanged ? `${u.isPlanner} → ${d.isPlanner}` : 'ongewijzigd',
    });

    try {
      // Rol eerst: de trigger uit migratie 016 schrijft is_planner mee zodra de
      // rol naar of van 'planner' gaat. Door de vlag daarna te zetten heeft de
      // expliciete keuze van de beheerder het laatste woord.
      if (roleChanged) await setUserRole(u.id, normRole(d.role));
      if (plannerChanged) await setIsPlanner(u.id, d.isPlanner);
      await load();
      setSavedId(u.id);
    } catch (e: any) {
      const msg = e?.message ?? 'Opslaan mislukt.';
      console.error('[regiobeheer] opslaan mislukt voor', u.id, e);
      setRowError((m) => ({ ...m, [u.id]: msg }));
      setError(msg);
    } finally {
      setSavingId(null);
    }
  };

  // ── Apotheken van één regiomanager ──────────────────────────────────────
  const openPharmacies = async (id: string) => {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id); setPicking(false); setPickId(''); setAccessLoading(true); setError('');
    try {
      const rows = await getPharmacyAccessForUser(id);
      setAccess(rows);
      setCounts((c) => ({ ...c, [id]: rows.length }));
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

  const linkedIds = new Set(access.map((a) => a.pharmacyId));
  const available = pharmacies
    .filter((p) => !linkedIds.has(p.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'));

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-black text-[#191c1e] flex items-center gap-2">
          <Users size={16} className="text-[#006b5a]" /> Gebruikers, rollen en planner-toegang
        </h3>
        <p className="text-xs text-[#3d4945]/70 mt-0.5">
          Planner-toegang staat los van de rol: iemand kan koerier zijn én in de Planner werken.
        </p>
      </div>

      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      {loading && <p className="text-sm font-bold text-[#3d4945]/60">Laden…</p>}

      {!loading && users.length === 0 && !error && (
        <p className="text-sm text-[#3d4945]/60">Geen gebruikers gevonden.</p>
      )}

      {users.length > 0 && (
        <div className="bg-white rounded-xl border border-[#f2f4f6] overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="text-left text-xs font-black text-[#3d4945]/70 uppercase border-b border-[#f2f4f6]">
                <th className="px-4 py-2.5">Naam</th>
                <th className="px-4 py-2.5">E-mail</th>
                <th className="px-4 py-2.5">Rol</th>
                <th className="px-4 py-2.5 text-center">Planner</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const d = drafts[u.id] ?? { role: u.role ?? '', isPlanner: u.isPlanner };
                const dirty = isDirty(u);
                const saving = savingId === u.id;
                const isManager = u.role === 'region_manager';
                const open = openId === u.id;

                return (
                  <React.Fragment key={u.id}>
                    <tr className="border-b border-[#f2f4f6] last:border-0 align-middle">
                      <td className="px-4 py-2.5 font-bold text-[#191c1e]">
                        <div className="flex items-center gap-2">
                          {u.name ?? '(naam onbekend)'}
                          {isManager && (
                            <button
                              onClick={() => openPharmacies(u.id)}
                              className="h-7 px-2 rounded-full bg-[#f2f4f6] text-[11px] font-bold text-[#3d4945] hover:bg-[#e8eaec] flex items-center gap-1 shrink-0"
                              title="Gekoppelde apotheken"
                            >
                              <Building2 size={12} />
                              {counts[u.id] ?? '—'}
                              {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-[#3d4945]/80">{u.email ?? '—'}</td>

                      <td className="px-4 py-2.5">
                        <select
                          value={d.role}
                          disabled={saving}
                          onChange={(e) => setDraft(u.id, { role: e.target.value })}
                          className="h-9 px-2 rounded-lg bg-[#f2f4f6] text-sm font-bold text-[#191c1e] outline-none disabled:opacity-60"
                        >
                          {/* Een account zonder profielrol: laat zien dát er niets staat
                              in plaats van stil de eerste rol voor te stellen. */}
                          {!u.role && <option value="">— geen rol —</option>}
                          {DB_ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={d.isPlanner}
                          disabled={saving}
                          onChange={(e) => setDraft(u.id, { isPlanner: e.target.checked })}
                          className="rounded border-slate-300 text-[#006b5a] focus:ring-[#006b5a] disabled:opacity-60"
                        />
                      </td>

                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {savedId === u.id && !dirty ? (
                          <span className="text-xs font-bold text-[#006b5a] inline-flex items-center gap-1">
                            <Check size={14} /> Opgeslagen
                          </span>
                        ) : (
                          <button
                            onClick={() => save(u)}
                            disabled={!dirty || saving}
                            className="h-9 px-3 rounded-xl bg-[#006b5a] text-white text-sm font-bold inline-flex items-center gap-1.5 disabled:opacity-40"
                          >
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Opslaan
                          </button>
                        )}
                      </td>
                    </tr>

                    {rowError[u.id] && (
                      <tr className="border-b border-[#f2f4f6] bg-red-50">
                        <td colSpan={5} className="px-4 py-2 text-xs font-bold text-red-700">
                          {rowError[u.id]}
                        </td>
                      </tr>
                    )}

                    {/* Apotheken van deze regiomanager */}
                    {open && isManager && (
                      <tr className="border-b border-[#f2f4f6] bg-[#f7f9fb]">
                        <td colSpan={5} className="px-4 py-3">
                          {accessLoading && <p className="text-sm text-[#3d4945]/60">Laden…</p>}

                          {!accessLoading && access.length === 0 && (
                            <p className="text-sm text-[#3d4945]/60 mb-2">Nog geen apotheken gekoppeld.</p>
                          )}

                          <div className="space-y-2">
                            {!accessLoading && access.map((a) => (
                              <div key={a.id} className="flex items-center justify-between gap-3 bg-white rounded-lg px-3 py-2">
                                <span className="text-sm font-bold text-[#191c1e] min-w-0 truncate flex items-center gap-2">
                                  <Building2 size={14} className="text-[#3d4945]/50 shrink-0" />
                                  {a.pharmacyName}
                                </span>
                                <button
                                  onClick={() => revoke(u.id, a.pharmacyId)}
                                  disabled={busy}
                                  className="h-8 px-2.5 rounded-full bg-white border border-[#f2f4f6] text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 flex items-center gap-1 shrink-0"
                                >
                                  <Trash2 size={13} /> Ontkoppelen
                                </button>
                              </div>
                            ))}
                          </div>

                          {picking ? (
                            <div className="flex gap-2 mt-2">
                              <select
                                value={pickId}
                                onChange={(e) => setPickId(e.target.value)}
                                className="flex-1 h-10 px-3 rounded-xl bg-white border border-[#f2f4f6] text-sm font-bold text-[#191c1e] outline-none"
                              >
                                <option value="">— Kies een apotheek —</option>
                                {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                              <button
                                onClick={() => grant(u.id, pickId)}
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
                              className="mt-2 h-9 px-3 rounded-full bg-[#f2f4f6] text-xs font-bold text-[#3d4945] hover:bg-[#e8eaec] disabled:opacity-50 flex items-center gap-1.5"
                            >
                              <Plus size={14} />
                              {available.length === 0 ? 'Alle apotheken al gekoppeld' : 'Apotheek toevoegen'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default RegionManagerAdmin;
