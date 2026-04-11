import { Package, PackageStatus, ArchiveStats, DailyCount, HeatmapPoint } from '../types';

export type Period = 'today' | 'yesterday' | 'week' | 'month' | 'year';

export function getDateRange(period: Period): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today':
      return { start: today, end: now };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today };
    }
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: weekAgo, end: now };
    }
    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { start: monthAgo, end: now };
    }
    case 'year': {
      const yearAgo = new Date(today);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      return { start: yearAgo, end: now };
    }
  }
}

export function filterPackagesByPeriod(
  packages: Package[],
  period: Period,
  pharmacyId?: string
): Package[] {
  const { start, end } = getDateRange(period);
  return packages.filter(pkg => {
    const date = new Date(pkg.createdAt);
    const inPeriod = date >= start && date <= end;
    const inPharmacy = !pharmacyId || pkg.pharmacyId === pharmacyId;
    return inPeriod && inPharmacy;
  });
}

export function calculateStats(packages: Package[], period: Period): ArchiveStats {
  const { start, end } = getDateRange(period);
  const days = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  const delivered = packages.filter(p => p.status === PackageStatus.DELIVERED).length;
  const mailbox   = packages.filter(p => p.status === PackageStatus.MAILBOX).length;
  const neighbour = packages.filter(p => p.status === PackageStatus.NEIGHBOUR).length;
  const returned  = packages.filter(p => p.status === PackageStatus.RETURN).length;
  const failed    = packages.filter(p => p.status === PackageStatus.FAILED).length;
  const totalDone = delivered + mailbox + neighbour;

  return {
    period,
    totalPackages: packages.length,
    delivered,
    mailbox,
    neighbour,
    returned,
    failed,
    deliveryRate: packages.length > 0
      ? Math.round((totalDone / packages.length) * 100)
      : 0,
    avgPerDay: Math.round((packages.length / days) * 10) / 10,
  };
}

export function getDailyCounts(packages: Package[]): DailyCount[] {
  const map = new Map<string, DailyCount>();

  packages.forEach(pkg => {
    const date = pkg.createdAt.split('T')[0];
    const existing = map.get(date) ?? { date, total: 0, delivered: 0, failed: 0 };
    const isDelivered = [
      PackageStatus.DELIVERED, PackageStatus.MAILBOX, PackageStatus.NEIGHBOUR,
    ].includes(pkg.status);
    const isFailed = pkg.status === PackageStatus.FAILED;

    map.set(date, {
      date,
      total:     existing.total + 1,
      delivered: existing.delivered + (isDelivered ? 1 : 0),
      failed:    existing.failed + (isFailed ? 1 : 0),
    });
  });

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Module-level geocoding cache — survives tab switches
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

export async function geocodePostcode(
  postcode: string,
  houseNumber: string
): Promise<{ lat: number; lng: number } | null> {
  const key = `${postcode}-${houseNumber}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  try {
    const query = `${postcode} ${houseNumber}, Netherlands`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=nl`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Greenspeed-Pharmacy-App/1.0' },
    });
    const data = await response.json();
    if (data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache.set(key, result);
      return result;
    }
  } catch { /* stil falen */ }

  geocodeCache.set(key, null);
  return null;
}

export async function buildHeatmapPoints(packages: Package[]): Promise<HeatmapPoint[]> {
  // Groepeer op postcode + huisnummer om geocoding-calls te minimaliseren
  const grouped = new Map<string, Package[]>();
  packages.forEach(pkg => {
    const key = `${pkg.address.postalCode}-${pkg.address.houseNumber}`;
    grouped.set(key, [...(grouped.get(key) ?? []), pkg]);
  });

  const points: HeatmapPoint[] = [];
  const entries = Array.from(grouped.entries()).slice(0, 50);

  for (const [, pkgs] of entries) {
    const pkg = pkgs[0];
    const coords = await geocodePostcode(pkg.address.postalCode, pkg.address.houseNumber);
    if (coords) {
      points.push({
        ...coords,
        weight:  pkgs.length,
        address: `${pkg.address.street} ${pkg.address.houseNumber}`,
        status:  pkg.status,
      });
    }
    // Nominatim rate limit: ≥1s tussen requests
    await new Promise(r => setTimeout(r, 1100));
  }

  return points;
}
