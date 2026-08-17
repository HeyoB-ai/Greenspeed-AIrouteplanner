import { Address } from '../types';

/**
 * Splitst een huisnummerveld in nummer en toevoeging. De OCR levert nummer en
 * toevoeging altijd samen aan in één veld ("12", "12A", "12-3", "12 bis"), want
 * Address heeft geen apart toevoeging-veld.
 */
const splitHouseNumber = (raw?: string): { number: string; suffix: string } => {
  const trimmed = (raw ?? '').trim();
  const m = trimmed.match(/^(\d+)\s*(.*)$/);
  if (!m) return { number: trimmed.toLowerCase(), suffix: '' };
  return {
    number: String(parseInt(m[1], 10)),
    // Toevoeging genormaliseerd: alleen letters/cijfers, kleine letters.
    // "12 A", "12-a" en "12a" leveren zo dezelfde sleutel op.
    suffix: m[2].toLowerCase().replace(/[^a-z0-9]/g, ''),
  };
};

/**
 * Stabiele sleutel om te bepalen of twee pakketten op hetzelfde afleveradres
 * horen. Gebruikt door de dubbel-adresmelding bij het scannen en door de
 * tijdsindicatie op de routekaart, zodat beide exact hetzelfde groeperen.
 *
 * Zonder postcode valt de sleutel terug op straatnaam + huisnummer. Dat is
 * zwakker (twee gemeenten kunnen dezelfde straatnaam hebben), maar beter dan
 * elk pakket als een eigen adres tellen.
 */
export function addressKey(address: Pick<Address, 'street' | 'houseNumber' | 'postalCode'>): string {
  const postcode = (address.postalCode ?? '').replace(/\s+/g, '').toUpperCase();
  const { number, suffix } = splitHouseNumber(address.houseNumber);

  if (postcode) return `${postcode}|${number}|${suffix}`;

  const street = (address.street ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `${street}|${number}|${suffix}`;
}
