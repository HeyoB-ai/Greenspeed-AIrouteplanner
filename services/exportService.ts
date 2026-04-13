import { Package, PackageStatus } from '../types';

export interface ExportOptions {
  packages:    Package[];
  startDate:   Date;
  endDate:     Date;
  pharmacyId?: string;   // undefined = alle apotheken
  courierId?:  string;   // undefined = alle koeriers
}

// Formatteer datum als DD-MM-YYYY
const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('nl-NL', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  });
};

// Formatteer tijdstip als HH:MM
const formatTime = (iso: string | undefined): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('nl-NL', {
    hour:   '2-digit',
    minute: '2-digit',
  });
};

// Statuslabel in Nederlands
const statusLabel = (status: PackageStatus): string => {
  const map: Partial<Record<PackageStatus, string>> = {
    [PackageStatus.PENDING]:        'Wachten',
    [PackageStatus.ASSIGNED]:       'Toegewezen',
    [PackageStatus.PICKED_UP]:      'Opgehaald',
    [PackageStatus.DELIVERED]:      'Bezorgd',
    [PackageStatus.MAILBOX]:        'Brievenbus',
    [PackageStatus.NEIGHBOUR]:      'Bij buren',
    [PackageStatus.RETURN]:         'Retour apotheek',
    [PackageStatus.MOVED]:          'Verhuisd',
    [PackageStatus.OTHER_LOCATION]: 'Andere locatie',
    [PackageStatus.FAILED]:         'Mislukt',
  };
  return map[status] ?? status;
};

const DELIVERED_SET = new Set([
  PackageStatus.DELIVERED,
  PackageStatus.MAILBOX,
  PackageStatus.NEIGHBOUR,
]);

// Filter packages op datum, apotheek en koerier
export const filterPackages = (opts: ExportOptions): Package[] => {
  const start = new Date(opts.startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(opts.endDate);
  end.setHours(23, 59, 59, 999);

  return opts.packages.filter(pkg => {
    const date       = new Date(pkg.createdAt);
    const inPeriod   = date >= start && date <= end;
    const inPharmacy = !opts.pharmacyId || pkg.pharmacyId === opts.pharmacyId;
    const inCourier  = !opts.courierId  || pkg.courierId  === opts.courierId;
    return inPeriod && inPharmacy && inCourier;
  });
};

// Genereer CSV voor één koerier (of alle koeriers)
export const generateCourierCSV = (
  packages: Package[],
  courierName: string,
): string => {
  // Sorteer op datum + tijd
  const sorted = [...packages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Groepeer op datum (YYYY-MM-DD)
  const byDate = new Map<string, Package[]>();
  sorted.forEach(pkg => {
    const date = pkg.createdAt.split('T')[0];
    byDate.set(date, [...(byDate.get(date) ?? []), pkg]);
  });

  const rows: string[] = [];

  // Header
  rows.push(
    `Rapport koerier: ${courierName}`,
    `Gegenereerd op: ${new Date().toLocaleString('nl-NL')}`,
    '',
    'Datum;Tijdstip gescand;Tijdstip bezorgd;Pakje #;Stop #;' +
    'Straat;Huisnummer;Postcode;Stad;Status;Reden;' +
    'Apotheek;GPS Lat;GPS Lng',
  );

  byDate.forEach((pkgs, date) => {
    rows.push('');
    rows.push(
      `=== ${formatDate(date + 'T00:00:00')} ` +
      `(${pkgs.length} pakketjes) ===`
    );

    pkgs.forEach(pkg => {
      const ev = pkg.deliveryEvidence;
      rows.push([
        formatDate(pkg.createdAt),
        formatTime(pkg.createdAt),
        formatTime(ev?.timestamp),
        pkg.scanNumber ?? '',
        pkg.routeIndex ?? pkg.displayIndex ?? '',
        pkg.address.street,
        pkg.address.houseNumber,
        pkg.address.postalCode,
        pkg.address.city,
        statusLabel(pkg.status),
        ev?.deliveryNote ?? '',
        pkg.pharmacyName,
        ev?.latitude  !== 0 ? (ev?.latitude  ?? '') : '',
        ev?.longitude !== 0 ? (ev?.longitude ?? '') : '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));
    });

    // Dag-samenvatting
    const del = pkgs.filter(p => DELIVERED_SET.has(p.status)).length;
    const pct = pkgs.length > 0 ? Math.round((del / pkgs.length) * 100) : 0;
    rows.push(
      `;;;;;;;;;;Bezorgd: ${del}/${pkgs.length} (${pct}%)`
    );
  });

  // Totaal samenvatting
  const totalDel = packages.filter(p => DELIVERED_SET.has(p.status)).length;
  const totalPct = packages.length > 0
    ? Math.round((totalDel / packages.length) * 100)
    : 0;
  rows.push('');
  rows.push(
    `TOTAAL;${packages.length} pakketjes;${totalDel} bezorgd;${totalPct}%`
  );

  return rows.join('\n');
};

// Download CSV bestand
export const downloadCSV = (content: string, filename: string) => {
  // BOM voor correcte weergave in Excel (Nederlands)
  const bom  = '\uFEFF';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Exporteer per koerier — één bestand per koerier
export const exportPerCourier = (opts: ExportOptions) => {
  const filtered = filterPackages(opts);

  // Groepeer op koerier
  const byCourier = new Map<string, { name: string; packages: Package[] }>();

  filtered.forEach(pkg => {
    const id   = pkg.courierId   ?? 'onbekend';
    const name = pkg.courierName ?? 'Onbekend';
    const existing = byCourier.get(id);
    if (existing) {
      existing.packages.push(pkg);
    } else {
      byCourier.set(id, { name, packages: [pkg] });
    }
  });

  const startStr = opts.startDate.toISOString().split('T')[0];
  const endStr   = opts.endDate.toISOString().split('T')[0];

  byCourier.forEach(({ name, packages: pkgs }) => {
    const csv      = generateCourierCSV(pkgs, name);
    const safeName = name.replace(/[^a-z0-9]/gi, '_');
    downloadCSV(csv, `greenspeed_${safeName}_${startStr}_${endStr}.csv`);
  });

  // Pakketjes zonder koerier
  const noCourier = filtered.filter(p => !p.courierId);
  if (noCourier.length > 0) {
    const csv = generateCourierCSV(noCourier, 'Niet toegewezen');
    downloadCSV(csv, `greenspeed_niet_toegewezen_${startStr}_${endStr}.csv`);
  }
};

// Exporteer alles in één CSV (gesorteerd op koerier + datum)
export const exportAllInOne = (opts: ExportOptions) => {
  const filtered = filterPackages(opts);

  const sorted = [...filtered].sort((a, b) => {
    const courierA = a.courierName ?? 'ZZZ';
    const courierB = b.courierName ?? 'ZZZ';
    if (courierA !== courierB) return courierA.localeCompare(courierB);
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const startStr = opts.startDate.toISOString().split('T')[0];
  const endStr   = opts.endDate.toISOString().split('T')[0];

  const csv = generateCourierCSV(sorted, 'Alle koeriers');
  downloadCSV(csv, `greenspeed_totaal_${startStr}_${endStr}.csv`);
};
