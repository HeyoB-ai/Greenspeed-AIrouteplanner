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

export function buildHeatmapPoints(packages: Package[]): HeatmapPoint[] {
  // Gebruik alleen pakketjes met werkelijke GPS-coördinaten
  const withGPS = packages.filter(
    p => p.deliveryEvidence?.latitude &&
         p.deliveryEvidence?.longitude &&
         p.deliveryEvidence.latitude  !== 0 &&
         p.deliveryEvidence.longitude !== 0
  );

  // Groepeer op afgeronde coördinaten (±50m nauwkeurigheid)
  const grouped = new Map<string, Package[]>();
  withGPS.forEach(pkg => {
    const lat = Math.round(pkg.deliveryEvidence!.latitude  * 1000) / 1000;
    const lng = Math.round(pkg.deliveryEvidence!.longitude * 1000) / 1000;
    const key = `${lat},${lng}`;
    grouped.set(key, [...(grouped.get(key) ?? []), pkg]);
  });

  return Array.from(grouped.entries()).map(([key, pkgs]) => {
    const [lat, lng] = key.split(',').map(Number);
    const pkg = pkgs[0];
    return {
      lat,
      lng,
      weight:      pkgs.length,
      address:     `${pkg.address.street} ${pkg.address.houseNumber}, ${pkg.address.city}`,
      status:      pkg.status,
      deliveredAt: pkg.deliveryEvidence?.timestamp,
    };
  });
}
