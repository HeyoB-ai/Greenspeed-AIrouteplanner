
import { createClient } from '@supabase/supabase-js';
import { Package } from '../types';

// Haal variabelen op uit process.env
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

/**
 * Maak de client alleen aan als de configuratie daadwerkelijk aanwezig is.
 * Dit voorkomt de "supabaseUrl is required" fout tijdens runtime.
 */
export const supabase = (typeof supabaseUrl === 'string' && supabaseUrl.length > 0 && typeof supabaseAnonKey === 'string') 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

const LOCAL_STORAGE_KEY = 'medroute_backup_packages';

export const db = {
  async fetchPackages(): Promise<Package[]> {
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    const localPackages: Package[] = localData ? JSON.parse(localData) : [];

    if (!supabase) {
      return localPackages;
    }

    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('createdAt', { ascending: false });
      
      if (error) {
        console.error('Database fetch error:', error);
        return localPackages;
      }
      
      if (data) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      }
      
      return (data || []) as Package[];
    } catch (err) {
      console.error('Connection error:', err);
      return localPackages;
    }
  },

  async syncPackage(pkg: Package) {
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    let localPackages: Package[] = localData ? JSON.parse(localData) : [];
    localPackages = [pkg, ...localPackages.filter(p => p.id !== pkg.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localPackages));

    if (!supabase) return;

    try {
      await supabase.from('packages').upsert(pkg);
    } catch (err) {
      console.error('Cloud sync error:', err);
    }
  },

  async syncMultiplePackages(packages: Package[]) {
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    let localPackages: Package[] = localData ? JSON.parse(localData) : [];
    const pkgMap = new Map(localPackages.map(p => [p.id, p]));
    packages.forEach(p => pkgMap.set(p.id, p));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(pkgMap.values())));

    if (!supabase) return;

    try {
      await supabase.from('packages').upsert(packages);
    } catch (err) {
      console.error('Cloud bulk sync error:', err);
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
