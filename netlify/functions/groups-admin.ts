import type { Handler } from '@netlify/functions';
import { verifyPrivileged } from '../lib/verifyPrivileged';

const json = (statusCode: number, body: any) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler: Handler = async (event) => {
  const auth = await verifyPrivileged(event.headers as Record<string, string | undefined>);
  if (!auth.ok) return { statusCode: auth.statusCode!, headers: { 'Content-Type': 'application/json' }, body: auth.body! };
  const admin = auth.admin!;

  // Groepenbeheer is uitsluitend voor de superuser
  const { data: me } = await admin.from('user_profiles').select('role').eq('id', auth.userId).single();
  if (me?.role !== 'superuser') return json(403, { error: 'Alleen de superuser kan groepen beheren' });

  if (event.httpMethod === 'GET') {
    const { data: groups } = await admin.from('groups').select('id, name').order('name');
    const { data: supervisors } = await admin
      .from('user_profiles')
      .select('id, name, role, group_id')
      .eq('role', 'supervisor')
      .order('name');
    return json(200, { groups: groups ?? [], supervisors: supervisors ?? [] });
  }

  if (event.httpMethod === 'POST') {
    let payload: any = {};
    try { payload = JSON.parse(event.body ?? '{}'); } catch { return json(400, { error: 'Ongeldige body' }); }

    if (payload.action === 'create') {
      const name = String(payload.name ?? '').trim();
      if (!name) return json(400, { error: 'Naam is verplicht' });
      const id = `grp-${Date.now()}`;
      const { error } = await admin.from('groups').insert({ id, name });
      if (error) return json(500, { error: error.message });
      return json(200, { id, name });
    }

    if (payload.action === 'rename') {
      const id = String(payload.id ?? '');
      const name = String(payload.name ?? '').trim();
      if (!id || !name) return json(400, { error: 'id en naam verplicht' });
      const { error } = await admin.from('groups').update({ name }).eq('id', id);
      if (error) return json(500, { error: error.message });
      return json(200, { id, name });
    }

    if (payload.action === 'assign') {
      const userId = String(payload.userId ?? '');
      const groupId = payload.groupId ? String(payload.groupId) : null;
      if (!userId) return json(400, { error: 'userId verplicht' });
      const { error } = await admin.from('user_profiles').update({ group_id: groupId }).eq('id', userId);
      if (error) return json(500, { error: error.message });
      return json(200, { userId, groupId });
    }

    return json(400, { error: 'Onbekende actie' });
  }

  return json(405, { error: 'Method not allowed' });
};
