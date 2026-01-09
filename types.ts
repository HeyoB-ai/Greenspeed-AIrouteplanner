
export enum UserRole {
  PHARMACY = 'PHARMACY',
  COURIER = 'COURIER',
  SUPERVISOR = 'SUPERVISOR'
}

export enum CourierStatus {
  AVAILABLE = 'AVAILABLE',
  ON_ROUTE = 'ON_ROUTE',
  BREAK = 'BREAK',
  OFFLINE = 'OFFLINE'
}

export enum PackageStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  PICKED_UP = 'PICKED_UP',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED'
}

export interface Address {
  street: string;
  houseNumber: string;
  postalCode: string;
  city: string;
}

export interface Package {
  id: string;
  pharmacyId: string;
  address: Address;
  status: PackageStatus;
  courierId?: string;
  createdAt: string;
  deliveredAt?: string;
  priority: number; // 1-5
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  location?: {
    lat: number;
    lng: number;
  };
  status?: CourierStatus;
}

export interface Route {
  id: string;
  courierId: string;
  packageIds: string[];
  optimizedOrder: string[];
}
