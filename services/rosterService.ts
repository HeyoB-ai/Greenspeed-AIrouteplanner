import { supabase } from './supabaseService';

/** Eén geplande dienst van de ingelogde koerier, klaar voor weergave. */
export interface RosterShift {
  id: string;
  shiftDate: string;       // 'YYYY-MM-DD'
  startTime: string;       // 'HH:MM'
  endTime: string | null;  // 'HH:MM' of null
  shiftType: 'regular' | 'institution' | 'other_transport' | 'urgent';
  pharmacyNames: string[]; // apotheeknamen opgezocht uit pharmacies-tabel
  description: string | null;
}

// Supabase levert tijden als 'HH:MM:SS'; wij tonen alleen uren en minuten.
function shortTime(t: string): string {
  return t?.slice(0, 5) ?? '';
}

/**
 * Fout met een eigen code, zodat het rooster kan uitleggen *waarom* er niets
 * te zien is in plaats van stilzwijgend "Geen dienst" te tonen.
 */
export class RosterError extends Error {
  constructor(message: string, public code: 'no-cloud' | 'no-auth' | 'query-failed') {
    super(message);
    this.name = 'RosterError';
  }
}

/**
 * Haalt de diensten van de ingelogde koerier op binnen [fromISO, toISO].
 * De RLS op `shifts` filtert automatisch op courier_id = auth.uid(), dus hier
 * is geen extra filter op de koerier nodig.
 *
 * Let op: die RLS is meteen ook de valkuil. Zonder échte Supabase-sessie is
 * auth.uid() NULL, en dan geeft de query gewoon nul rijen terug — géén fout.
 * Daarom controleren we de sessie vooraf en loggen we wat er terugkomt.
 */
export async function getMyShifts(fromISO: string, toISO: string): Promise<RosterShift[]> {
  if (!supabase) {
    console.warn('[rooster] Supabase is niet geconfigureerd (VITE_SUPABASE_URL/ANON_KEY ontbreken).');
    throw new RosterError('Geen verbinding met de database.', 'no-cloud');
  }

  // auth.uid() moet bestaan, anders filtert de RLS alles weg. Een demo-account
  // of een verlopen token heeft wél een lokale sessie maar geen Supabase-sessie.
  const { data: { session: authSession } } = await supabase.auth.getSession();
  const uid = authSession?.user?.id ?? null;
  console.debug('[rooster] auth.uid():', uid, '| bereik:', fromISO, '→', toISO);
  if (!uid) {
    throw new RosterError(
      'Je bent niet met een Supabase-account ingelogd, dus je rooster kan niet worden opgehaald. Log opnieuw in met je e-mailadres en wachtwoord.',
      'no-auth',
    );
  }

  const { data: shifts, error } = await supabase
    .from('shifts')
    .select('id, shift_date, start_time, budgeted_end_time, shift_type, description')
    .gte('shift_date', fromISO)
    .lte('shift_date', toISO)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true });

  console.debug('[rooster] shifts-respons:', { rows: shifts?.length ?? 0, error, data: shifts });
  if (error) {
    throw new RosterError(`Rooster ophalen mislukt: ${error.message}`, 'query-failed');
  }
  const rows = shifts ?? [];
  if (rows.length === 0) {
    console.debug('[rooster] Geen rijen in dit bereik. Als de planner hier wel een dienst toont, ' +
      'staat courier_id van die dienst niet op', uid, 'of laat de RLS-policy op shifts deze rij niet door.');
    return [];
  }

  const ids = rows.map((s: any) => s.id);

  // Apotheek-koppelingen van deze diensten
  const { data: sp, error: spError } = await supabase
    .from('shift_pharmacies')
    .select('shift_id, pharmacy_id')
    .in('shift_id', ids);
  if (spError) console.warn('[rooster] shift_pharmacies ophalen mislukt:', spError.message);

  // Namen bij de gekoppelde apotheken zoeken
  const pharmacyIds = [...new Set((sp ?? []).map((r: any) => r.pharmacy_id))];
  let pharmacies: any[] = [];
  if (pharmacyIds.length > 0) {
    const { data, error: phError } = await supabase
      .from('pharmacies')
      .select('id, name')
      .in('id', pharmacyIds);
    if (phError) console.warn('[rooster] pharmacies ophalen mislukt:', phError.message);
    pharmacies = data ?? [];
  }

  const nameById = new Map<string, string>(pharmacies.map((p: any) => [p.id, p.name]));
  const pharmaciesByShift = new Map<string, string[]>();
  (sp ?? []).forEach((r: any) => {
    const list = pharmaciesByShift.get(r.shift_id) ?? [];
    // Valt terug op het id als de apotheek (nog) niet zichtbaar is voor deze koerier.
    list.push(nameById.get(r.pharmacy_id) ?? r.pharmacy_id);
    pharmaciesByShift.set(r.shift_id, list);
  });

  return rows.map((s: any): RosterShift => ({
    id: s.id,
    shiftDate: s.shift_date,
    startTime: shortTime(s.start_time),
    endTime: s.budgeted_end_time ? shortTime(s.budgeted_end_time) : null,
    shiftType: s.shift_type,
    pharmacyNames: pharmaciesByShift.get(s.id) ?? [],
    description: s.description ?? null,
  }));
}
