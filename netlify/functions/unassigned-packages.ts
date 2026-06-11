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

  if (event.httpMethod === 'GET') {
    const { data } = await admin
      .from('packages')
      .select('id, pharmacyId, pharmacyName, courierName, createdAt, status')
      .order('createdAt', { ascending: false });
    const packages = (data ?? []).filter((p: any) => !p.pharmacyId);
    return json(200, { packages });
  }

  if (event.httpMethod === 'POST') {
    let payload: any = {};
    try { payload = JSON.parse(event.body ?? '{}'); } catch { return json(400, { error: 'Ongeldige body' }); }

    if (payload.action === 'assign') {
      const packageIds: string[] = Array.isArray(payload.packageIds) ? payload.packageIds : [];
      const pharmacyId = String(payload.pharmacyId ?? '');
      const pharmacyName = String(payload.pharmacyName ?? '');
      if (!packageIds.length || !pharmacyId) return json(400, { error: 'packageIds en pharmacyId verplicht' });

      // Supervisor mag alleen toewijzen aan een apotheek in de eigen groep
      const { data: me } = await admin.from('user_profiles').select('role, group_id').eq('id', auth.userId).single();
      if ((me as any)?.role === 'supervisor') {
        const { data: ph } = await admin.from('pharmacies').select('groupId').eq('id', pharmacyId).single();
        if (!(me as any).group_id || (ph as any)?.groupId !== (me as any).group_id) {
          return json(403, { error: 'Je kunt alleen toewijzen aan een apotheek in je eigen groep' });
        }
      }

      const { error } = await admin
        .from('packages')
        .update({ pharmacyId, pharmacyName })
        .in('id', packageIds);
      if (error) return json(500, { error: error.message });
      return json(200, { assigned: packageIds.length, pharmacyId });
    }

    return json(400, { error: 'Onbekende actie' });
  }

  return json(405, { error: 'Method not allowed' });
};
