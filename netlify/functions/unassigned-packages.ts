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

  // Niet-toegewezen pakketten horen bij geen groep; daarom uitsluitend de superuser
  const { data: me } = await admin.from('user_profiles').select('role').eq('id', auth.userId).single();
  if ((me as any)?.role !== 'superuser') return json(403, { error: 'Alleen de superuser kan niet-toegewezen pakketten beheren' });

  if (event.httpMethod === 'GET') {
    const { data } = await admin
      .from('packages')
      .select('id, pharmacyId, pharmacyName, courierName, createdAt, status, address')
      .order('createdAt', { ascending: false });
    const { data: phData } = await admin.from('pharmacies').select('id');
    const realIds = new Set((phData ?? []).map((p: any) => p.id));
    // Niet-toegewezen = leeg apotheek-id OF een id dat bij geen echte apotheek hoort (spook-apotheek uit een scan)
    const packages = (data ?? []).filter((p: any) => !p.pharmacyId || !realIds.has(p.pharmacyId));
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
