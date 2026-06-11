import React, { useEffect, useState, useCallback } from 'react';
import { Users, Plus, Loader2, Pencil, Check } from 'lucide-react';
import { supabase } from '../services/supabaseService';

interface Group { id: string; name: string; }
interface Supervisor { id: string; name: string; role: string; group_id: string | null; }

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const GroupManagementPanel: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/.netlify/functions/groups-admin', { headers: { ...(await authHeader()) } });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      setGroups(data.groups ?? []);
      setSupervisors(data.supervisors ?? []);
    } catch {
      setError('Kon groepen niet laden. Log in als superuser met een echt account.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const post = async (body: any) => {
    setBusy(true); setError('');
    try {
      const res = await fetch('/.netlify/functions/groups-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `status ${res.status}`); }
      await load();
    } catch (e: any) {
      setError(e?.message || 'Actie mislukt');
    } finally { setBusy(false); }
  };

  const createGroup = async () => {
    if (!newName.trim()) return;
    await post({ action: 'create', name: newName.trim() });
    setNewName('');
  };
  const rename = async (id: string) => {
    if (!editName.trim()) return;
    await post({ action: 'rename', id, name: editName.trim() });
    setEditId(null); setEditName('');
  };
  const assign = async (userId: string, groupId: string) => {
    await post({ action: 'assign', userId, groupId });
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
      {loading && <p className="text-sm font-bold text-[#3d4945]/60">Laden…</p>}

      <div>
        <h3 className="text-sm font-black text-[#191c1e] mb-3">Groepen</h3>
        <div className="space-y-2">
          {groups.map(g => (
            <div key={g.id} className="flex items-center justify-between bg-white rounded-xl border border-[#f2f4f6] px-4 py-2.5">
              {editId === g.id ? (
                <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                  className="flex-1 mr-2 h-9 px-3 rounded-lg bg-[#f2f4f6] text-sm font-bold text-[#191c1e] outline-none" />
              ) : (
                <span className="font-bold text-[#191c1e]">{g.name}</span>
              )}
              {editId === g.id ? (
                <button onClick={() => rename(g.id)} disabled={busy}
                  className="h-9 px-3 rounded-full bg-[#006b5a] text-white text-xs font-bold flex items-center gap-1">
                  <Check size={14} /> Opslaan
                </button>
              ) : (
                <button onClick={() => { setEditId(g.id); setEditName(g.name); }}
                  className="h-9 w-9 rounded-full bg-[#f2f4f6] flex items-center justify-center text-[#3d4945]">
                  <Pencil size={14} />
                </button>
              )}
            </div>
          ))}
          {groups.length === 0 && !loading && <p className="text-sm text-[#3d4945]/60">Nog geen groepen.</p>}
        </div>
        <div className="flex gap-2 mt-3">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nieuwe groep, bijv. Regio Hilversum"
            className="flex-1 h-10 px-3 rounded-xl bg-[#f2f4f6] text-sm font-bold text-[#191c1e] outline-none" />
          <button onClick={createGroup} disabled={busy || !newName.trim()}
            className="h-10 px-4 rounded-xl bg-[#006b5a] text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Toevoegen
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-black text-[#191c1e] mb-3 flex items-center gap-2"><Users size={16} className="text-[#006b5a]" /> Supervisors</h3>
        <div className="space-y-2">
          {supervisors.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-white rounded-xl border border-[#f2f4f6] px-4 py-2.5 gap-3">
              <span className="font-bold text-[#191c1e] min-w-0 truncate">{s.name}</span>
              <select value={s.group_id ?? ''} onChange={e => assign(s.id, e.target.value)} disabled={busy}
                className="h-9 px-3 rounded-lg bg-[#f2f4f6] text-sm font-bold text-[#191c1e] outline-none">
                <option value="">— Geen groep —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          ))}
          {supervisors.length === 0 && !loading && <p className="text-sm text-[#3d4945]/60">Geen supervisors gevonden.</p>}
        </div>
      </div>
    </div>
  );
};

export default GroupManagementPanel;
