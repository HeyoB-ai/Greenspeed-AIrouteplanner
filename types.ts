export enum UserRole {
  SUPERUSER = 'SUPERUSER',
  ADMIN = 'ADMIN',
  PHARMACY = 'APOTHEEK',
  COURIER = 'KOERIER',
  SUPERVISOR = 'SUPERVISOR',
  PATIENT = 'PATIENT'
}

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  pharmacyId?: string;   // voor ADMIN en PHARMACY
  courierId?: string;    // voor COURIER
  passwordHash?: string;
}

export interface AuthSession {
  user: AuthUser;
  loggedInAt: string;
}

export enum CourierStatus {
  AVAILABLE = 'BESCHIKBAAR',
  ON_ROUTE = 'ONDERWEG',
  BREAK = 'PAUZE',
  OFFLINE = 'OFFLINE'
}

export enum PackageStatus {
  SCANNING  = 'ANALYSEREN...',
  PENDING   = 'WACHTEN',
  ASSIGNED  = 'TOEGEWEZEN',
  PICKED_UP = 'OPGEHAALD',
  DELIVERED = 'BEZORGD',
  MAILBOX   = 'BRIEVENBUS',
  NEIGHBOUR = 'BIJ BUREN',
  RETURN    = 'RETOUR APOTHEEK',
  BILLED    = 'GEFACTUREERD',
  FAILED    = 'MISLUKT',
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
  deliveryNote?: string;
  notHomeOption?: 'mailbox' | 'neighbour' | 'return';
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

export interface ChatMessage {
  id:        string;
  role:      'user' | 'assistant';
  text:      string;
  timestamp: string;
}

export interface CallbackRequest {
  phoneNumber:   string;
  preferredTime: string;
  requestedAt:   string;
  isHandled:     boolean;
}

export interface ChatConversation {
  id:               string;
  createdAt:        string;
  expiresAt:        string;         // createdAt + 30 dagen
  pharmacyId:       string;
  messages:         ChatMessage[];
  hasRiskSignal:    boolean;
  callbackRequest?: CallbackRequest;
  isRead:           boolean;
}

export interface ArchiveStats {
  period:        string;
  totalPackages: number;
  delivered:     number;
  mailbox:       number;
  neighbour:     number;
  returned:      number;
  failed:        number;
  deliveryRate:  number;   // percentage succesvol bezorgd
  avgPerDay:     number;   // gemiddeld per dag in periode
}

export interface DailyCount {
  date:      string;       // "2026-04-11"
  total:     number;
  delivered: number;
  failed:    number;
}

export interface HeatmapPoint {
  lat:          number;
  lng:          number;
  weight:       number;    // aantal pakketjes op dit adres
  address:      string;
  status:       PackageStatus;
  deliveredAt?: string;    // timestamp van eerste bezorging op dit punt
}
