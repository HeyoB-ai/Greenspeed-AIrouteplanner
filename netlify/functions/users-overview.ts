import type { Handler } from '@netlify/functions';
import { verifyPrivileged } from '../lib/verifyPrivileged';

const EMPLOYER_MARKUP_PCT = 40; // loondienst werkgeverslasten (zelfde constante als elders)

// zzp = uurtarief ex btw (rauw); loondienst = bruto + werkgeverslasten
const trueHourlyCost = (wage: number, employmentType?: string | null) =>
  employmentType === 'zzp' ? wage : wage * (1 + EMPLOYER_MARKUP_PCT / 100);

export const handler: Handler = async (event) => {
  const auth = await verifyPrivileged(event.headers as Record<string, string | undefined>);
  if (!auth.ok) {
    return { statusCode: auth.statusCode!, headers: { 'Content-Type': 'application/json' }, body: auth.body! };
  }
  const admin = auth.admin!;

  // Periode: maand (1-12) + jaar uit query; default huidige maand
  const qp = event.queryStringParameters ?? {};
  const now = new Date();
  const year  = parseInt(qp.year  ?? String(now.getFullYear()), 10);
  const month = parseInt(qp.month ?? String(now.getMonth() + 1), 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateFrom = `${year}-${pad(month)}-01`;
  const lastDay  = new Date(year, month, 0).getDate();
  const dateTo   = `${year}-${pad(month)}-${pad(lastDay)}`;

  const { data: profiles, error: profErr } = await admin
    .from('user_profiles')
    .select('id, name, role, hourlyWage, employmentType, pharmacy_ids, wageStartDate')
    .order('name');
  if (profErr) {
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: profErr.message }) };
  }

  const { data: packages } = await admin
    .from('packages')
    .select('courierId, pharmacyId, status, createdAt, deliveredAt')
    .gte('createdAt', dateFrom)
    .lte('createdAt', dateTo + 'T23:59:59')
    .in('status', ['DELIVERED', 'MAILBOX', 'NEIGHBOUR'])
    .not('courierId', 'is', null);

  const { data: pharmacies } = await admin
    .from('pharmacies')
    .select('id, name, hourlyRate');
  const pharmaById = new Map<string, any>((pharmacies ?? []).map((p: any) => [p.id, p]));

  // Uren per koerier-dag (identiek aan fetchFinancials)
  type Day = { courierId: string; firstScan: string; lastDelivery: string; totalHours: number; packages: { pharmacyId: string; count: number }[] };
  const dayMap = new Map<string, Day>();
  (packages ?? []).forEach((pkg: any) => {
    const date = String(pkg.createdAt).split('T')[0];
    const key  = `${pkg.courierId}_${date}`;
    if (!dayMap.has(key)) {
      dayMap.set(key, { courierId: pkg.courierId, firstScan: pkg.createdAt, lastDelivery: pkg.deliveredAt ?? pkg.createdAt, totalHours: 0, packages: [] });
    }
    const day = dayMap.get(key)!;
    if (pkg.createdAt < day.firstScan) day.firstScan = pkg.createdAt;
    if ((pkg.deliveredAt ?? pkg.createdAt) > day.lastDelivery) day.lastDelivery = pkg.deliveredAt ?? pkg.createdAt;
    const entry = day.packages.find(p => p.pharmacyId === pkg.pharmacyId);
    if (entry) entry.count++; else day.packages.push({ pharmacyId: pkg.pharmacyId, count: 1 });
  });
  dayMap.forEach(day => {
    const start = new Date(day.firstScan); start.setMinutes(start.getMinutes() - 30);
    const end   = new Date(day.lastDelivery); end.setMinutes(end.getMinutes() + 15);
    day.totalHours = (end.getTime() - start.getTime()) / 3600000;
  });

  // Alloceer uren proportioneel per apotheek -> per (courier, pharmacy)
  type Alloc = { hours: number; packages: number };
  const allocMap = new Map<string, Alloc>();
  dayMap.forEach(day => {
    const totalPkgs = day.packages.reduce((s, p) => s + p.count, 0);
    if (totalPkgs === 0) return;
    day.packages.forEach(({ pharmacyId, count }) => {
      const allocHours = day.totalHours * (count / totalPkgs);
      const key = `${day.courierId}_${pharmacyId}`;
      const ex = allocMap.get(key) ?? { hours: 0, packages: 0 };
      ex.hours += allocHours; ex.packages += count;
      allocMap.set(key, ex);
    });
  });

  const users = (profiles ?? []).map((prof: any) => {
    const base = { id: prof.id, name: prof.name, role: prof.role };
    if (prof.role !== 'courier') return { ...base, pnl: null };

    const wage = prof.hourlyWage ?? 0;
    const empl = prof.employmentType ?? 'loondienst';
    const cph  = trueHourlyCost(wage, empl); // kost per uur, per dit dienstverband

    const perPharmacy = [...allocMap.entries()]
      .filter(([k]) => k.startsWith(prof.id + '_'))
      .map(([k, a]) => {
        const pid  = k.slice(prof.id.length + 1);
        const ph   = pharmaById.get(pid);
        const rate = ph?.hourlyRate ?? 0;
        const revenue = a.hours * rate;
        const cost    = a.hours * cph;
        return {
          pharmacyId: pid,
          pharmacyName: ph?.name ?? 'Onbekend',
          hours: Math.round(a.hours * 100) / 100,
          packages: a.packages,
          revenue: Math.round(revenue * 100) / 100,
          cost: Math.round(cost * 100) / 100,
          margin: Math.round((revenue - cost) * 100) / 100,
        };
      });

    const totalHours    = perPharmacy.reduce((s, p) => s + p.hours, 0);
    const totalPackages = perPharmacy.reduce((s, p) => s + p.packages, 0);
    const revenue       = perPharmacy.reduce((s, p) => s + p.revenue, 0);
    const cost          = perPharmacy.reduce((s, p) => s + p.cost, 0);
    const margin        = revenue - cost;

    const currentIds    = Array.isArray(prof.pharmacy_ids) ? prof.pharmacy_ids : [];
    const pharmacyIds   = [...new Set([...currentIds, ...perPharmacy.map(p => p.pharmacyId)])];
    const pharmacyNames = pharmacyIds.map(id => pharmaById.get(id)?.name ?? id);

    return {
      ...base,
      pnl: {
        employmentType: empl,
        hourlyWage: wage,
        trueHourlyCost: Math.round(cph * 100) / 100,
        pharmacies: pharmacyNames,
        hours: Math.round(totalHours * 100) / 100,
        packages: totalPackages,
        revenue: Math.round(revenue * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        margin: Math.round(margin * 100) / 100,
        marginPct: revenue > 0 ? Math.round((margin / revenue) * 100) : 0,
        perPharmacy,
      },
    };
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month, year, users }),
  };
};
