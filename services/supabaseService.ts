
import { createClient } from '@supabase/supabase-js';
import { Package } from '../types';

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

const LOCAL_STORAGE_KEY = 'medroute_backup_packages';
const PHARMACIES_KEY = 'medroute_pharmacies';

export const db = {
  async fetchPackages(): Promise<Package[]> {
    try {
      // Probeer eerst Supabase (cloud), val terug op localStorage
      if (supabase) {
        const { data, error } = await supabase.from('packages').select('*').order('createdAt', { ascending: false });
        if (!error && data && data.length > 0) {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
          return data;
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
    // Haal unieke apotheken op uit de packages tabel (geen aparte pharmacies tabel)
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('packages')
          .select('pharmacyId, pharmacyName');
        if (!error && data && data.length > 0) {
          // Deduplicate op pharmacyId
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
      const localData = localStorage.getItem(PHARMACIES_KEY);
      return localData ? JSON.parse(localData) : [
        { id: 'ph-1', name: 'Apotheek de Kroon' },
        { id: 'ph-2', name: 'Apotheek Hilversum Noord' }
      ];
    } catch (err) {
      const localData = localStorage.getItem(PHARMACIES_KEY);
      return localData ? JSON.parse(localData) : [{ id: 'ph-1', name: 'Apotheek de Kroon' }];
    }
  },

  async savePharmacy(pharmacy: any) {
    // Apotheken worden alleen lokaal opgeslagen (geen aparte Supabase-tabel)
    const localData = localStorage.getItem(PHARMACIES_KEY);
    const localPharmacies = localData ? JSON.parse(localData) : [];
    const exists = localPharmacies.findIndex((p: any) => p.id === pharmacy.id);

    let updated;
    if (exists !== -1) {
      updated = [...localPharmacies];
      updated[exists] = pharmacy;
    } else {
      updated = [...localPharmacies, pharmacy];
    }

    localStorage.setItem(PHARMACIES_KEY, JSON.stringify(updated));
  },

  /**
   * Slaat een pakket op. De localStorage acties zijn synchroon (blocking)
   * om race-conditions tussen snelle opeenvolgende scans te voorkomen.
   */
  async syncPackage(pkg: Package) {
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
        await supabase.from('packages').upsert(pkg);
      } catch (err) {
        console.warn('Cloud sync tijdelijk niet beschikbaar:', err);
      }
    }
  },

  async syncMultiplePackages(packages: Package[]) {
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    let localPackages: Package[] = localData ? JSON.parse(localData) : [];
    
    const pkgMap = new Map(localPackages.map(p => [p.id, p]));
    packages.forEach(p => pkgMap.set(p.id, p));
    
    const finalData = Array.from(pkgMap.values());
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(finalData));

    if (supabase) {
      try {
        await supabase.from('packages').upsert(packages);
      } catch (err) {
        console.warn('Cloud bulk sync mislukt:', err);
      }
    }
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
