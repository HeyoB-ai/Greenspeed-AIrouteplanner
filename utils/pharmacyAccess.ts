import { AuthUser, Package, Pharmacy, UserRole } from '../types';

/**
 * Geeft de IDs terug van apotheken die deze gebruiker mag zien.
 * null = geen beperking (superuser ziet alles).
 */
export function getAccessiblePharmacyIds(user: AuthUser): string[] | null {
  // Superuser: ziet altijd alles
  if (user.role === UserRole.SUPERUSER) return null;

  // Supervisor: ziet alle apotheken als geen pharmacyIds ingesteld
  if (user.role === UserRole.SUPERVISOR) {
    if (!user.pharmacyIds || user.pharmacyIds.length === 0) return null;
    return user.pharmacyIds;
  }

  // Admin/overig met pharmacyIds array
  if (user.pharmacyIds && user.pharmacyIds.length > 0) {
    return user.pharmacyIds;
  }

  // Single pharmacyId (backwards compat)
  if (user.pharmacyId) return [user.pharmacyId];

  return [];
}

export function filterPharmacies(
  user: AuthUser,
  allPharmacies: Pharmacy[],
): Pharmacy[] {
  const ids = getAccessiblePharmacyIds(user);
  if (ids === null) return allPharmacies;
  return allPharmacies.filter(p => ids.includes(p.id));
}

export function filterPackagesByAccess(
  user: AuthUser,
  packages: Package[],
): Package[] {
  const ids = getAccessiblePharmacyIds(user);
  if (ids === null) return packages;
  return packages.filter(p => ids.includes(p.pharmacyId));
}
