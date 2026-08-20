import { PackageStatus } from '../types';

/**
 * De enige definitie van "bezorgd". Stond eerder drie keer verschillend in de
 * code: PharmacyOverview en SinglePharmacyDashboard met BILLED, track-and-trace
 * met OTHER_LOCATION erbij, archiveService zonder BILLED.
 *
 * OTHER_LOCATION en NOT_HOME horen er bewust NIET in. In beide gevallen weet de
 * app niet wat er met het pakket is gebeurd — soms is het alsnog afgegeven, soms
 * gaat het mee terug. Bij medicijnen is niet-weten hetzelfde als
 * niet-zeker-afgeleverd; liever een telefoontje van de apotheek dan een patiënt
 * zonder medicijnen die niemand mist.
 *
 * BILLED zit er wél in: gefactureerd kan alleen na een geslaagde bezorging.
 */
export const DELIVERED_STATUSES: ReadonlySet<PackageStatus> = new Set([
  PackageStatus.DELIVERED,
  PackageStatus.MAILBOX,
  PackageStatus.NEIGHBOUR,
  PackageStatus.BILLED,
]);

export const isDelivered = (status: PackageStatus): boolean =>
  DELIVERED_STATUSES.has(status);

/**
 * Dezelfde verzameling als kale strings, voor de Netlify-functies. Die werken
 * met de ruwe statuswaarde uit de database en kennen de enum niet.
 */
export const DELIVERED_STATUS_VALUES: readonly string[] =
  [...DELIVERED_STATUSES].map(s => s as string);

/**
 * Uitkomsten waarbij het pakket niet bij de patiënt is en de apotheek actie moet
 * ondernemen — bellen, opnieuw inplannen, of het pakket terugverwachten. Of het
 * fysiek terugkomt hangt af van het geval; dat kan de app niet bepalen.
 */
export const NEEDS_FOLLOW_UP_STATUSES: ReadonlySet<PackageStatus> = new Set([
  PackageStatus.RETURN,
  PackageStatus.MOVED,
  PackageStatus.OTHER_LOCATION,
  PackageStatus.NOT_HOME,
]);
