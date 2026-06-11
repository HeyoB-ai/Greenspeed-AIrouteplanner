import { AuthUser, Package, Pharmacy, UserRole } from '../types';

/**
 * Geeft de IDs terug van apotheken die deze gebruiker mag zien.
 * null = geen id-gebaseerde beperking (superuser, of supervisor met groep —
 * die filtert op groep, niet op id-lijst).
 */
export function getAccessiblePharmacyIds(user: AuthUser): string[] | null {
  // Superuser: ziet altijd alles
  if (user.role === UserRole.SUPERUSER) return null;

  // Supervisor: groep-gebaseerd. Met groep loopt filtering via groupId
  // (zie filterPharmacies/filterPackagesByAccess), dus geen id-beperking hier.
  if (user.role === UserRole.SUPERVISOR) {
    if (user.groupId) return null;
    // Fallback tijdens transitie: oude handmatige apotheek-lijst
    if (user.pharmacyIds && user.pharmacyIds.length > 0) return user.pharmacyIds;
    return null;
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
  if (user.role === UserRole.SUPERUSER) return allPharmacies;

  // Supervisor met groep: alle apotheken in die groep
  if (user.role === UserRole.SUPERVISOR && user.groupId) {
    return allPharmacies.filter(p => p.groupId === user.groupId);
  }

  const ids = getAccessiblePharmacyIds(user);
  if (ids === null) return allPharmacies;
  return allPharmacies.filter(p => ids.includes(p.id));
}

export function filterPackagesByAccess(
  user: AuthUser,
  packages: Package[],
  pharmacies?: Pharmacy[],
): Package[] {
  // Supervisor met groep: pakketten van apotheken in die groep.
  // Vereist de apothekenlijst om groep -> apotheek-ids af te leiden.
  if (user.role === UserRole.SUPERVISOR && user.groupId && pharmacies) {
    const groupPharmacyIds = new Set(
      pharmacies.filter(p => p.groupId === user.groupId).map(p => p.id),
    );
    return packages.filter(p => groupPharmacyIds.has(p.pharmacyId));
  }

  const ids = getAccessiblePharmacyIds(user);
  if (ids === null) return packages;
  return packages.filter(p => ids.includes(p.pharmacyId));
}
