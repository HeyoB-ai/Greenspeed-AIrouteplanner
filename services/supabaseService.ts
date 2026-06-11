
import { createClient } from '@supabase/supabase-js';
import { Package, ChatConversation, Institution, PharmacyFinancials, CourierDayStats, CourierProfile } from '../types';

/**
 * Veilige helper om omgevingsvariabelen op te halen.
 * Voorkomt 'undefined' crashes in verschillende JS runtimes.
 */
const getEnvVar = (key: string): string | undefined => {
  try {
    // Probeer Vite's import.meta.env
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return (import.meta as any).env[key];
    }
  } catch (e) {
    // Fallback/negeer fouten bij toegang tot import.meta
  }
  
  try {
    // Fallback voor omgevingen die process.env gebruiken
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key];
    }
  } catch (e) {
    // Fallback/negeer fouten bij toegang tot process.env
  }

  return undefined;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

// Initialiseer Supabase alleen als beide variabelen aanwezig zijn
export const supabase = (typeof supabaseUrl === 'string' && supabaseUrl.length > 0 && typeof supabaseAnonKey === 'string')
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Bouwt de Authorization-header met het Supabase access-token van de
 * ingelogde gebruiker. Wordt meegestuurd naar de afgeschermde Netlify-
 * endpoints (gemini, maps). Leeg object als er geen sessie is.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) return {};
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

const LOCAL_STORAGE_KEY    = 'medroute_backup_packages';
const PHARMACIES_KEY       = 'medroute_pharmacies';
const CONVERSATIONS_PREFIX = 'medroute_conversations_'; // + pharmacyId

export const db = {
  async fetchPackages(): Promise<Package[]> {
    try {
      // Probeer eerst Supabase (cloud), val terug op localStorage
      if (supabase) {
        const { data, error } = await supabase.from('packages').select('*').order('createdAt', { ascending: false });
        if (!error && data && data.length > 0) {
          const mapped = data.map((row: any) => ({
            ...row,
            address: {
              ...row.address,
              ...(row.addressLat != null ? { lat: row.addressLat } : {}),
              ...(row.addressLng != null ? { lng: row.addressLng } : {}),
            },
          }));
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mapped));
          return mapped;
        }
      }
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
      return localData ? JSON.parse(localData) : [];
    } catch (err) {
      console.error('Fout bij ophalen pakketten:', err);
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
      return localData ? JSON.parse(localData) : [];
    }
  },

  async fetchPharmacies(): Promise<any[]> {
    try {
      // Probeer eerst de pharmacies tabel (cloud)
      if (supabase) {
        const { data, error } = await supabase
          .from('pharmacies')
          .select('*')
          .order('name', { ascending: true });
        if (!error && data && data.length > 0) {
          localStorage.setItem(PHARMACIES_KEY, JSON.stringify(data));
          return data;
        }
      }

      // Fallback: localStorage
      const localData = localStorage.getItem(PHARMACIES_KEY);
      if (localData) return JSON.parse(localData);

      // Laatste redmiddel: afleiden uit packages tabel
      if (supabase) {
        const { data, error } = await supabase
          .from('packages')
          .select('pharmacyId, pharmacyName');
        if (!error && data && data.length > 0) {
          const seen = new Set<string>();
          const unique = data
            .filter((p: any) => {
              if (!p.pharmacyId || seen.has(p.pharmacyId)) return false;
              seen.add(p.pharmacyId);
              return true;
            })
            .map((p: any) => ({ id: p.pharmacyId, name: p.pharmacyName }));
          if (unique.length > 0) {
            localStorage.setItem(PHARMACIES_KEY, JSON.stringify(unique));
            return unique;
          }
        }
      }

      return [
        { id: 'ph-1', name: 'Apotheek de Kroon' },
        {
          id: 'ph-1779784742417',
          name: 'Lamberts Apotheek',
          address: 'Rembrandtlaan 31a 1213 BE Hilversum',
          courierCode: 'SE-9578',
        },
      ];
    } catch (err) {
      const localData = localStorage.getItem(PHARMACIES_KEY);
      return localData ? JSON.parse(localData) : [{ id: 'ph-1', name: 'Apotheek de Kroon' }];
    }
  },

  async savePharmacy(pharmacy: any) {
    // 1. localStorage (synchroon)
    const localData = localStorage.getItem(PHARMACIES_KEY);
    const localPharmacies = localData ? JSON.parse(localData) : [];
    const exists = localPharmacies.findIndex((p: any) => p.id === pharmacy.id);
    let updated;
    if (exists !== -1) {
      updated = [...localPharmacies];
      updated[exists] = { ...localPharmacies[exists], ...pharmacy };
    } else {
      updated = [...localPharmacies, pharmacy];
    }
    localStorage.setItem(PHARMACIES_KEY, JSON.stringify(updated));

    // 2. Supabase: probeer eerst update, val terug op insert als record niet bestaat
    if (supabase) {
      try {
        const composedAddress = [
          [pharmacy.street, pharmacy.houseNumber].filter(Boolean).join(' '),
          [pharmacy.postalCode, pharmacy.city].filter(Boolean).join(' '),
        ].filter(Boolean).join(', ') || (pharmacy.address ?? null);

        const payload = {
          name:        pharmacy.name,
          address:     composedAddress,
          street:      pharmacy.street ?? null,
          houseNumber: pharmacy.houseNumber ?? null,
          postalCode:  pharmacy.postalCode ?? null,
          city:        pharmacy.city ?? null,
          groupId:     pharmacy.groupId ?? null,
          courierCode: pharmacy.courierCode ?? pharmacy.code ?? null,
          hourlyRate:  pharmacy.hourlyRate ?? 0,
        };

        const { data: updateData, error: updateError } = await supabase
          .from('pharmacies')
          .update(payload)
          .eq('id', pharmacy.id)
          .select();

        if (updateError || !updateData || updateData.length === 0) {
          // Geen bestaande row gevonden of update faalde — doe insert
          const { error: insertError } = await supabase
            .from('pharmacies')
            .insert({ id: pharmacy.id, ...payload });
          if (insertError) throw insertError;
        }
      } catch (err: any) {
        console.error('Pharmacy cloud sync mislukt:', err);
        throw new Error(err?.message || err?.error_description || err?.hint || 'Onbekende fout bij opslaan in cloud');
      }
    }
  },

  async fetchGroups(): Promise<{ id: string; name: string }[]> {
    if (!supabase) return [];
    const { data } = await supabase.from('groups').select('id, name').order('name');
    return data ?? [];
  },

  async deletePharmacy(id: string): Promise<void> {
    // 1. localStorage (synchroon)
    const localData = localStorage.getItem(PHARMACIES_KEY);
    const localPharmacies = localData ? JSON.parse(localData) : [];
    const filtered = localPharmacies.filter((p: any) => p.id !== id);
    localStorage.setItem(PHARMACIES_KEY, JSON.stringify(filtered));

    // 2. Supabase delete
    if (supabase) {
      const { error } = await supabase
        .from('pharmacies')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },

  /**
   * Slaat een pakket op. De localStorage acties zijn synchroon (blocking)
   * om race-conditions tussen snelle opeenvolgende scans te voorkomen.
   */
  async syncPackage(pkg: Package): Promise<{ synced: boolean; error?: string }> {
    // 1. Lees huidige stand (Synchroon)
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    const localPackages: Package[] = localData ? JSON.parse(localData) : [];
    
    // 2. Update of voeg toe
    const exists = localPackages.findIndex(p => p.id === pkg.id);
    let updated;
    if (exists !== -1) {
      updated = [...localPackages];
      updated[exists] = pkg;
    } else {
      updated = [pkg, ...localPackages];
    }
    
    // 3. Schrijf direct terug (Synchroon)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));

    // 4. Update cloud op de achtergrond (Asynchroon)
    if (supabase) {
      try {
        const row = {
          ...pkg,
          addressLat: pkg.address.lat ?? null,
          addressLng: pkg.address.lng ?? null,
        };
        const { error } = await supabase.from('packages').upsert(row);
        if (error) {
          console.error('[syncPackage] Cloud-opslag geweigerd:', error.message);
          return { synced: false, error: error.message };
        }
      } catch (err: any) {
        console.error('[syncPackage] Cloud-opslag mislukt:', err);
        return { synced: false, error: err?.message ?? 'Onbekende fout' };
      }
    }
    return { synced: true };
  },

  async syncMultiplePackages(packages: Package[]): Promise<{ synced: boolean; error?: string }> {
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    let localPackages: Package[] = localData ? JSON.parse(localData) : [];
    
    const pkgMap = new Map(localPackages.map(p => [p.id, p]));
    packages.forEach(p => pkgMap.set(p.id, p));
    
    const finalData = Array.from(pkgMap.values());
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(finalData));

    if (supabase) {
      try {
        const { error } = await supabase.from('packages').upsert(packages);
        if (error) {
          console.error('[syncMultiplePackages] Cloud bulk-opslag geweigerd:', error.message);
          return { synced: false, error: error.message };
        }
      } catch (err: any) {
        console.error('[syncMultiplePackages] Cloud bulk-opslag mislukt:', err);
        return { synced: false, error: err?.message ?? 'Onbekende fout' };
      }
    }
    return { synced: true };
  },

  async saveConversation(conv: ChatConversation) {
    // 1. Altijd opslaan in localStorage (ook zonder cloud)
    const key = CONVERSATIONS_PREFIX + conv.pharmacyId;
    const existing: ChatConversation[] = JSON.parse(localStorage.getItem(key) ?? '[]');
    const idx = existing.findIndex(c => c.id === conv.id);
    if (idx !== -1) existing[idx] = conv;
    else existing.unshift(conv);
    localStorage.setItem(key, JSON.stringify(existing));

    // 2. Ook naar Supabase als die beschikbaar is
    if (!supabase) return;
    try {
      await supabase.from('chat_conversations').upsert({
        id:               conv.id,
        createdAt:        conv.createdAt,
        expiresAt:        conv.expiresAt,
        pharmacyId:       conv.pharmacyId,
        messages:         conv.messages,
        hasRiskSignal:    conv.hasRiskSignal,
        callbackRequest:  conv.callbackRequest ?? null,
        isRead:           conv.isRead,
      });
    } catch (err) {
      console.warn('Chat cloud sync mislukt:', err);
    }
  },

  async fetchConversations(pharmacyId: string): Promise<ChatConversation[]> {
    const now = new Date().toISOString();

    // Probeer Supabase eerst
    if (supabase) {
      try {
        const { data } = await supabase
          .from('chat_conversations')
          .select('*')
          .eq('pharmacyId', pharmacyId)
          .gt('expiresAt', now)
          .order('createdAt', { ascending: false });
        if (data && data.length > 0) {
          // Sync resultaten terug naar localStorage
          localStorage.setItem(CONVERSATIONS_PREFIX + pharmacyId, JSON.stringify(data));
          return data as ChatConversation[];
        }
      } catch {}
    }

    // Fallback: localStorage
    const local: ChatConversation[] = JSON.parse(
      localStorage.getItem(CONVERSATIONS_PREFIX + pharmacyId) ?? '[]'
    );
    return local.filter(c => c.expiresAt > now);
  },

  async markConversationRead(id: string) {
    // Update localStorage: doorzoek alle gespreksbuckets op dit ID
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(CONVERSATIONS_PREFIX)) continue;
      const convs: ChatConversation[] = JSON.parse(localStorage.getItem(key) ?? '[]');
      const idx = convs.findIndex(c => c.id === id);
      if (idx !== -1) {
        convs[idx] = { ...convs[idx], isRead: true };
        localStorage.setItem(key, JSON.stringify(convs));
        break;
      }
    }
    // Ook Supabase bijwerken
    if (!supabase) return;
    try {
      await supabase.from('chat_conversations').update({ isRead: true }).eq('id', id);
    } catch (err) {
      console.warn('markConversationRead mislukt:', err);
    }
  },


  // ── Vaste instellingen ─────────────────────────────────────────────
  async fetchInstitutions(pharmacyId?: string): Promise<Institution[]> {
    if (!supabase) return [];
    let query = supabase
      .from('institutions')
      .select('*')
      .order('name');
    if (pharmacyId) {
      query = query.eq('pharmacyId', pharmacyId);
    }
    const { data } = await query;
    return (data ?? []) as Institution[];
  },

  async saveInstitution(inst: Institution): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('institutions')
      .upsert(inst, { onConflict: 'id' });
    if (error) throw error;
  },

  async deleteInstitution(id: string): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('institutions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ── Monitor / dashboard statistieken ────────────────────────────────
  async fetchMonitorStats() {
    if (!supabase) return null;

    const today   = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7  * 86400000).toISOString().split('T')[0];
    const monAgo  = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [todayRes, weekRes, monthRes, openRes, deliveredRes, failedRes] =
      await Promise.all([
        supabase.from('packages').select('*', { count: 'exact', head: true }).gte('createdAt', today),
        supabase.from('packages').select('*', { count: 'exact', head: true }).gte('createdAt', weekAgo),
        supabase.from('packages').select('*', { count: 'exact', head: true }).gte('createdAt', monAgo),
        supabase.from('packages').select('*', { count: 'exact', head: true }).in('status', ['ASSIGNED', 'PICKED_UP']),
        supabase.from('packages').select('*', { count: 'exact', head: true }).in('status', ['DELIVERED', 'MAILBOX', 'NEIGHBOUR']),
        supabase.from('packages').select('*', { count: 'exact', head: true }).in('status', ['FAILED', 'RETURN']),
      ]);

    const delivered = deliveredRes.count ?? 0;
    const failed    = failedRes.count ?? 0;
    const total     = delivered + failed;
    const pct       = total > 0 ? Math.round((delivered / total) * 100) : 0;
    const weekCount = weekRes.count ?? 0;

    return {
      scansVandaag:     todayRes.count  ?? 0,
      scansDezWeek:     weekCount,
      scansDezeMaand:   monthRes.count  ?? 0,
      openPakketten:    openRes.count   ?? 0,
      bezorgd:          delivered,
      mislukt:          failed,
      bezorgPercentage: pct,
      // Kostenschatting (Gemini image OCR: ~€0.005 per scan met afbeelding,
      // Maps geocoding: ~€0.005 per scan). Werkelijke kosten in Google billing.
      kostenGeminiWeek: (weekCount * 0.005).toFixed(2),
      kostenMapsWeek:   (weekCount * 0.005).toFixed(2),
    };
  },

  // ── Financiële module ───────────────────────────────────────────────
  async fetchFinancials(
    dateFrom: string,
    dateTo: string,
    pharmacyId?: string,
  ): Promise<PharmacyFinancials[]> {
    if (!supabase) return [];

    // Haal bezorgde pakketten op in periode
    let query = supabase
      .from('packages')
      .select('*')
      .gte('createdAt', dateFrom)
      .lte('createdAt', dateTo + 'T23:59:59')
      .in('status', ['DELIVERED', 'MAILBOX', 'NEIGHBOUR'])
      .not('courierId', 'is', null);

    if (pharmacyId) query = query.eq('pharmacyId', pharmacyId);
    const { data: packages } = await query;
    if (!packages?.length) return [];

    // Haal koerier-uurlonen op
    const courierIds = [...new Set(packages.map((p: any) => p.courierId))];
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, name, hourlyWage')
      .in('id', courierIds);

    // Haal apotheektarieven op
    const pharmacyIds = [...new Set(packages.map((p: any) => p.pharmacyId).filter(Boolean))];
    const { data: pharmacies } = await supabase
      .from('pharmacies')
      .select('id, name, hourlyRate')
      .in('id', pharmacyIds);

    // STAP A: Bereken uren per koerier per dag
    const courierDayMap = new Map<string, CourierDayStats>();

    packages.forEach((pkg: any) => {
      const date = pkg.createdAt.split('T')[0];
      const key  = `${pkg.courierId}_${date}`;
      const profile = profiles?.find((p: any) => p.id === pkg.courierId);

      if (!courierDayMap.has(key)) {
        courierDayMap.set(key, {
          courierId:    pkg.courierId,
          courierName:  profile?.name ?? 'Onbekend',
          hourlyWage:   profile?.hourlyWage ?? 0,
          date,
          firstScan:    pkg.createdAt,
          lastDelivery: pkg.deliveredAt ?? pkg.createdAt,
          startTime:    '',
          endTime:      '',
          totalHours:   0,
          packages:     [],
        });
      }

      const day = courierDayMap.get(key)!;

      // Update eerste scan en laatste bezorging
      if (pkg.createdAt < day.firstScan)
        day.firstScan = pkg.createdAt;
      if ((pkg.deliveredAt ?? pkg.createdAt) > day.lastDelivery)
        day.lastDelivery = pkg.deliveredAt ?? pkg.createdAt;

      // Tel pakketten per apotheek
      const pharmaEntry = day.packages.find(p => p.pharmacyId === pkg.pharmacyId);
      if (pharmaEntry) {
        pharmaEntry.count++;
      } else {
        day.packages.push({ pharmacyId: pkg.pharmacyId, count: 1 });
      }
    });

    // STAP B: Bereken start/einde/uren per koerier-dag
    courierDayMap.forEach(day => {
      const start = new Date(day.firstScan);
      start.setMinutes(start.getMinutes() - 30); // 30 min vóór eerste scan

      const end = new Date(day.lastDelivery);
      end.setMinutes(end.getMinutes() + 15);     // 15 min ná laatste bezorging

      day.startTime  = start.toISOString();
      day.endTime    = end.toISOString();
      day.totalHours = (end.getTime() - start.getTime()) / 3600000;
    });

    // STAP C: Alloceer uren proportioneel per apotheek
    // Per koerier-dag: verdeel uren o.b.v. aantal pakketten per apotheek
    const allocationMap = new Map<string, {
      hours: number;
      cost: number;
      courierName: string;
      packages: number;
    }>(); // key: `${pharmacyId}_${courierId}`

    courierDayMap.forEach(day => {
      const totalPkgs = day.packages.reduce((s, p) => s + p.count, 0);
      if (totalPkgs === 0) return;

      day.packages.forEach(({ pharmacyId, count }) => {
        const fraction   = count / totalPkgs;
        const allocHours = day.totalHours * fraction;
        const allocCost  = allocHours * day.hourlyWage;
        const key        = `${pharmacyId}_${day.courierId}`;

        const existing = allocationMap.get(key) ?? {
          hours:       0,
          cost:        0,
          courierName: day.courierName,
          packages:    0,
        };
        existing.hours    += allocHours;
        existing.cost     += allocCost;
        existing.packages += count;
        allocationMap.set(key, existing);
      });
    });

    // STAP D: Bouw PharmacyFinancials per apotheek
    return (pharmacies ?? []).map((pharmacy: any) => {
      const pharmaPackages = packages.filter((p: any) => p.pharmacyId === pharmacy.id);

      // Verzamel koerier-allocaties voor deze apotheek
      const courierData: PharmacyFinancials['couriers'] = [];
      let totalHours = 0;
      let totalCost  = 0;

      const courierKeys = [...allocationMap.keys()]
        .filter(k => k.startsWith(pharmacy.id + '_'));

      courierKeys.forEach(key => {
        const courierId = key.split('_')[1];
        const alloc     = allocationMap.get(key)!;
        const profile   = profiles?.find((p: any) => p.id === courierId);

        courierData.push({
          name:     alloc.courierName,
          hours:    alloc.hours,
          wage:     profile?.hourlyWage ?? 0,
          cost:     alloc.cost,
          packages: alloc.packages,
        });

        totalHours += alloc.hours;
        totalCost  += alloc.cost;
      });

      const revenue     = totalHours * (pharmacy.hourlyRate ?? 0);
      const grossProfit = revenue - totalCost;
      const delivered   = pharmaPackages.length;

      return {
        pharmacyId:        pharmacy.id,
        pharmacyName:      pharmacy.name,
        hourlyRate:        pharmacy.hourlyRate ?? 0,
        period:            `${dateFrom} t/m ${dateTo}`,
        packagesDelivered: delivered,
        hoursWorked:       Math.round(totalHours * 100) / 100,
        revenue:           Math.round(revenue * 100) / 100,
        laborCost:         Math.round(totalCost * 100) / 100,
        grossProfit:       Math.round(grossProfit * 100) / 100,
        profitMargin:      revenue > 0
          ? Math.round((grossProfit / revenue) * 100) : 0,
        revenuePerPackage: delivered > 0
          ? Math.round((revenue / delivered) * 100) / 100 : 0,
        costPerPackage:    delivered > 0
          ? Math.round((totalCost / delivered) * 100) / 100 : 0,
        profitPerPackage:  delivered > 0
          ? Math.round((grossProfit / delivered) * 100) / 100 : 0,
        couriers: courierData,
      };
    }).filter((p: PharmacyFinancials) => p.packagesDelivered > 0);
  },

  // Lijst van koeriers met hun uurloon (voor het instellen van lonen).
  // Vereist de RLS-policy uit migratie 007 zodat privileged rollen alle
  // profielen mogen lezen.
  async fetchCouriers(): Promise<CourierProfile[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, name, hourlyWage, wageStartDate')
      .eq('role', 'courier')
      .order('name');
    if (error) {
      console.warn('fetchCouriers mislukt (RLS uit migratie 007 nodig?):', error.message);
      return [];
    }
    return (data ?? []).map((c: any) => ({
      id:            c.id,
      name:          c.name,
      hourlyWage:    c.hourlyWage ?? 0,
      wageStartDate: c.wageStartDate ?? undefined,
    }));
  },

  async updateCourierWage(courierId: string, hourlyWage: number): Promise<void> {
    if (!supabase) return;
    const { error } = await supabase
      .from('user_profiles')
      .update({ hourlyWage })
      .eq('id', courierId);
    if (error) throw error;
  },

  async deleteData() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    if (!supabase) return;
    try {
      await supabase.from('packages').delete().neq('id', '0');
    } catch (err) {
      console.error('Delete error:', err);
    }
  }
};
