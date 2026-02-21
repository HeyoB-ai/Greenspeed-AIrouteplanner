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
  BILLED = 'GEFACTUREERD',
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
  pharmacyName: string; // Voor financiële rapportage
  address: Address;
  status: PackageStatus;
  courierId?: string;
  createdAt: string;
  deliveredAt?: string;
  deliveryEvidence?: DeliveryEvidence;
  priority: number;
  orderIndex?: number;
  displayIndex?: number; // Permanent stopnummer
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  status?: CourierStatus;
}

export interface Pharmacy {
  id: string;
  name: string;
  address?: string;
}
