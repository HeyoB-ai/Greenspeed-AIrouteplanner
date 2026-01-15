export enum UserRole {
  PHARMACY = 'APOTHEEK',
  COURIER = 'KOERIER',
  SUPERVISOR = 'SUPERVISOR'
}

export enum CourierStatus {
  AVAILABLE = 'BESCHIKBAAR',
  ON_ROUTE = 'ONDERWEG',
  BREAK = 'PAUZE',
  OFFLINE = 'OFFLINE'
}

export enum PackageStatus {
  SCANNING = 'ANALYSEREN...',
  PENDING = 'WACHTEN',
  ASSIGNED = 'TOEGEWEZEN',
  PICKED_UP = 'OPGEHAALD',
  DELIVERED = 'BEZORGD',
  FAILED = 'MISLUKT'
}

export interface Address {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
}

export interface DeliveryEvidence {
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface Package {
  id: string;
  pharmacyId: string;
  address: Address;
  status: PackageStatus;
  courierId?: string;
  createdAt: string;
  deliveredAt?: string;
  deliveryEvidence?: DeliveryEvidence;
  priority: number;
  orderIndex?: number;
  displayIndex?: number; // Nieuw: permanent stopnummer voor op de doos
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  status?: CourierStatus;
}