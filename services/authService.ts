import { AuthUser, AuthSession, UserRole } from '../types';

const SESSION_KEY = 'greenspeed_session';

const DEMO_USERS: AuthUser[] = [
  {
    id: 'u1',
    name: 'Greenspeed HQ',
    role: UserRole.SUPERUSER,
    passwordHash: 'superuser123',
  },
  {
    id: 'u2',
    name: 'Beheerder Apotheek de Kroon',
    role: UserRole.ADMIN,
    pharmacyId: 'ph-1',
    passwordHash: 'admin123',
  },
  {
    id: 'u3',
    name: 'Assistente Apotheek de Kroon',
    role: UserRole.PHARMACY,
    pharmacyId: 'ph-1',
    passwordHash: 'apotheek123',
  },
  {
    id: 'u4',
    name: 'Marco Koerier',
    role: UserRole.COURIER,
    pharmacyId: 'ph-1',
    courierId: 'k1',
    passwordHash: 'koerier123',
  },
  {
    id: 'u5',
    name: 'Sanne Bezorgd',
    role: UserRole.COURIER,
    pharmacyId: 'ph-1',
    courierId: 'k2',
    passwordHash: 'koerier456',
  },
];

export { DEMO_USERS };

export function login(username: string, password: string): AuthUser | null {
  const user = DEMO_USERS.find(
    u =>
      u.name.toLowerCase() === username.toLowerCase() &&
      u.passwordHash === password
  );
  return user ?? null;
}

export function saveSession(user: AuthUser): void {
  const session: AuthSession = {
    user,
    loggedInAt: new Date().toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}
