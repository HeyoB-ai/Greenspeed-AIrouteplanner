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
 * Haalt de diensten van de ingelogde koerier op binnen [fromISO, toISO].
 * De RLS op `shifts` filtert automatisch op courier_id = auth.uid(), dus hier
 * is geen extra filter op de koerier nodig.
 */
export async function getMyShifts(fromISO: string, toISO: string): Promise<RosterShift[]> {
  if (!supabase) return [];

  const { data: shifts, error } = await supabase
    .from('shifts')
    .select('id, shift_date, start_time, budgeted_end_time, shift_type, description')
    .gte('shift_date', fromISO)
    .lte('shift_date', toISO)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) throw error;
  const rows = shifts ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((s: any) => s.id);

  // Apotheek-koppelingen van deze diensten
  const { data: sp } = await supabase
    .from('shift_pharmacies')
    .select('shift_id, pharmacy_id')
    .in('shift_id', ids);

  // Namen bij de gekoppelde apotheken zoeken
  const pharmacyIds = [...new Set((sp ?? []).map((r: any) => r.pharmacy_id))];
  let pharmacies: any[] = [];
  if (pharmacyIds.length > 0) {
    const { data } = await supabase
      .from('pharmacies')
      .select('id, name')
      .in('id', pharmacyIds);
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
