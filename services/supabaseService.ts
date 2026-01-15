
import { createClient } from '@supabase/supabase-js';
import { Package } from '../types';

// Gebruik process.env direct. In dit platform worden variabelen hierin geïnjecteerd.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Maak de client alleen aan als de configuratie compleet is om crashes te voorkomen.
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

const LOCAL_STORAGE_KEY = 'medroute_backup_packages';

export const db = {
  async fetchPackages(): Promise<Package[]> {
    // Haal altijd eerst de lokale data op als basis/fallback
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    const localPackages: Package[] = localData ? JSON.parse(localData) : [];

    if (!supabase) {
      console.warn('Supabase niet geconfigureerd. Gebruik alleen lokale opslag.');
      return localPackages;
    }

    try {
      const { data, error } = await supabase
        .from('packages')
        .select('*')
        .order('createdAt', { ascending: false });
      
      if (error) {
        console.error('Fout bij ophalen uit database:', error);
        return localPackages;
      }
      
      // Update lokale backup met de meest recente cloud data
      if (data) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
      }
      
      return (data || []) as Package[];
    } catch (err) {
      console.error('Database verbindingsfout:', err);
      return localPackages;
    }
  },

  async syncPackage(pkg: Package) {
    // Werk altijd de lokale backup bij
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    let localPackages: Package[] = localData ? JSON.parse(localData) : [];
    localPackages = [pkg, ...localPackages.filter(p => p.id !== pkg.id)];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localPackages));

    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('packages')
        .upsert(pkg);
      if (error) console.error('Database sync fout:', error);
    } catch (err) {
      console.error('Fout bij cloud opslag:', err);
    }
  },

  async syncMultiplePackages(packages: Package[]) {
    // Werk altijd de lokale backup bij
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    let localPackages: Package[] = localData ? JSON.parse(localData) : [];
    const pkgMap = new Map(localPackages.map(p => [p.id, p]));
    packages.forEach(p => pkgMap.set(p.id, p));
    localPackages = Array.from(pkgMap.values());
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(localPackages));

    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('packages')
        .upsert(packages);
      if (error) console.error('Database bulk sync fout:', error);
    } catch (err) {
      console.error('Fout bij cloud bulk opslag:', err);
    }
  },

  async deleteData() {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('packages')
        .delete()
        .neq('id', '0');
      if (error) console.error('Database wis fout:', error);
    } catch (err) {
      console.error('Fout bij wissen cloud data:', err);
    }
  }
};
