
import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, Package, PackageStatus, Address, CourierStatus, DeliveryEvidence, Pharmacy } from './types';
import Layout from './components/Layout';
import PharmacyView from './components/PharmacyView';
import CourierView from './components/CourierView';
import SupervisorView from './components/SupervisorView';
import PatientView from './components/PatientView';
import Scanner from './components/Scanner';
import { optimizeRoute } from './services/geminiService';
import { db, supabase } from './services/supabaseService';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Copy, Check, Info } from 'lucide-react';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.PHARMACY);
  const [packages, setPackages] = useState<Package[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSetupHelp, setShowSetupHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [currentPharmacy, setCurrentPharmacy] = useState<Pharmacy>({ id: 'ph-1', name: 'Apotheek de Kroon' });

  // Controleer of cloud opslag beschikbaar is
  const hasCloudConfig = !!supabase;

  // Initial data load vanuit Supabase of LocalStorage via db service
  useEffect(() => {
    const loadData = async () => {
      setIsSyncing(true);
      const [pkgs, pharms] = await Promise.all([db.fetchPackages(), db.fetchPharmacies()]);
      setPackages(pkgs);
      setPharmacies(pharms);
      if (pharms.length > 0) {
        // Probeer de laatst gebruikte apotheek te onthouden of neem de eerste
        const lastId = localStorage.getItem('last_pharmacy_id');
        const found = pharms.find(p => p.id === lastId);
        setCurrentPharmacy(found || pharms[0]);
      }

      // Check URL for role parameter (e.g. for patient deep links)
      const params = new URLSearchParams(window.location.search);
      const urlRole = params.get('role');
      if (urlRole === 'PATIENT') {
        setRole(UserRole.PATIENT);
      }

      setIsSyncing(false);
    };
    loadData();
  }, []);

  const handleAddPharmacy = async () => {
    const name = prompt("Naam van de nieuwe apotheek:");
    if (name) {
      const newPharm: Pharmacy = {
        id: `ph-${Date.now()}`,
        name
      };
      setPharmacies(prev => [...prev, newPharm]);
      setCurrentPharmacy(newPharm);
      localStorage.setItem('last_pharmacy_id', newPharm.id);
      await db.savePharmacy(newPharm);
    }
  };

  const handleSwitchPharmacy = (id: string) => {
    const found = pharmacies.find(p => p.id === id);
    if (found) {
      setCurrentPharmacy(found);
      localStorage.setItem('last_pharmacy_id', id);
    }
  };

  // Scanner doet de Gemini-analyse zelf en levert een Address op.
  // We gebruiken currentPharmacy voor pharmacyId/Name — geen aparte matchinglogica nodig.
  const handleNewScan = useCallback(async (address: Address) => {
    const pkg: Package = {
      id: `pkg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pharmacyId: currentPharmacy.id,
      pharmacyName: currentPharmacy.name,
      address,
      status: PackageStatus.PENDING,
      createdAt: new Date().toISOString(),
      priority: 3
    };

    setPackages(prev => [pkg, ...prev]);
    setShowScanner(false);
    await db.syncPackage(pkg);
  }, [currentPharmacy]);

  const handleOptimizeRoute = async (selectedIds: string[]) => {
    setIsOptimizing(true);
    const selectedPackages = packages.filter(p => selectedIds.includes(p.id));
    
    const stopsMap = new Map<string, string[]>(); 
    selectedPackages.forEach(p => {
      const key = `${p.address.street} ${p.address.houseNumber} ${p.address.postalCode}`.toLowerCase().trim();
      const existing = stopsMap.get(key) || [];
      stopsMap.set(key, [...existing, p.id]);
    });

    const uniqueStops = Array.from(stopsMap.entries()).map(([key, ids]) => {
      const firstPkg = selectedPackages.find(p => p.id === ids[0])!;
      return {
        id: ids[0],
        ...firstPkg.address,
        packageCount: ids.length
      };
    });
    
    try {
      const optimizedReferenceIds = await optimizeRoute(uniqueStops);
      
      const updatedPackages = [...packages];
      const pkgsToSync: Package[] = [];

      selectedIds.forEach(id => {
        const idx = updatedPackages.findIndex(p => p.id === id);
        if (idx !== -1) {
          updatedPackages[idx] = { ...updatedPackages[idx], orderIndex: undefined, displayIndex: undefined };
        }
      });

      optimizedReferenceIds.forEach((refId, index) => {
        const key = Array.from(stopsMap.entries()).find(([k, ids]) => ids.includes(refId))?.[0];
        if (key) {
          const allIdsForThisStop = stopsMap.get(key) || [];
          allIdsForThisStop.forEach(id => {
            const pkgIndex = updatedPackages.findIndex(p => p.id === id);
            if (pkgIndex !== -1) {
              const updatedPkg = { 
                ...updatedPackages[pkgIndex], 
                status: PackageStatus.ASSIGNED,
                orderIndex: index,
                displayIndex: index + 1
              };
              updatedPackages[pkgIndex] = updatedPkg;
              pkgsToSync.push(updatedPkg);
            }
          });
        }
      });

      setPackages(updatedPackages);
      await db.syncMultiplePackages(pkgsToSync);
    } catch (err) {
      console.error("Route optimalisatie mislukt:", err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const updateMultipleStatus = async (ids: string[], status: PackageStatus, evidence?: DeliveryEvidence) => {
    const pkgsToSync: Package[] = [];
    const newPackages = packages.map(p => {
      if (ids.includes(p.id)) {
        const updated = { 
          ...p, 
          status, 
          deliveryEvidence: evidence, 
          deliveredAt: evidence?.timestamp || p.deliveredAt 
        };
        pkgsToSync.push(updated);
        return updated;
      }
      return p;
    });

    setPackages(newPackages);
    await db.syncMultiplePackages(pkgsToSync);
  };

  const handleLogout = async () => {
    const warning = hasCloudConfig 
      ? "Wil je alle data uit de cloud database EN lokaal wissen? (Demo actie)"
      : "Wil je alle lokale zendingen wissen?";
      
    if (confirm(warning)) {
      await db.deleteData();
      setPackages([]);
      window.location.reload();
    }
  };

  const copySQL = () => {
    const sql = `-- Tabel voor pakketten
CREATE TABLE IF NOT EXISTS packages (
  id TEXT PRIMARY KEY,
  "pharmacyId" TEXT,
  "pharmacyName" TEXT,
  address JSONB,
  status TEXT,
  "courierId" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "deliveredAt" TIMESTAMPTZ,
  "deliveryEvidence" JSONB,
  priority INTEGER,
  "orderIndex" INTEGER,
  "displayIndex" INTEGER
);

-- Schakel RLS in
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

-- Policy
DROP POLICY IF EXISTS "Allow public access" ON packages;
CREATE POLICY "Allow public access" ON packages FOR ALL USING (true);`;
    
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // SQL wordt niet meer gebruikt voor pharmacies (lokaal opgeslagen)

  const syncIndicator = (
    <div className={`flex items-center space-x-2 px-3 py-1 border rounded-full transition-colors ${hasCloudConfig ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-100'}`}>
      {isSyncing ? (
        <RefreshCw size={14} className="text-blue-500 animate-spin" />
      ) : hasCloudConfig ? (
        <Cloud size={14} className="text-emerald-500" />
      ) : (
        <CloudOff size={14} className="text-amber-500" />
      )}
      <span className={`text-[10px] font-black uppercase tracking-tighter ${hasCloudConfig ? 'text-slate-500' : 'text-amber-600'}`}>
        {isSyncing ? 'Synchroniseren...' : hasCloudConfig ? 'Cloud Actief' : 'Lokaal (Geen Cloud)'}
      </span>
    </div>
  );

  return (
    <Layout 
      activeRole={role} 
      userName={currentPharmacy.name} 
      onLogout={handleLogout} 
      onSwitchRole={setRole}
      hideMobileNav={showScanner}
      extraHeaderContent={syncIndicator}
    >
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {!hasCloudConfig && role === UserRole.PHARMACY && (
          <div className="mb-6 bg-amber-50 border border-amber-200 p-6 rounded-4xl shadow-sm">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1">
                <p className="text-lg font-black text-amber-900 leading-tight">Database niet geconfigureerd</p>
                <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mt-1 opacity-80">
                  Data wordt momenteel uitsluitend op dit apparaat bewaard.
                </p>
                
                <button 
                  onClick={() => setShowSetupHelp(!showSetupHelp)}
                  className="mt-4 flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest text-white bg-amber-600 px-4 py-2 rounded-xl hover:bg-amber-700 transition-all shadow-md shadow-amber-200"
                >
                  <span>{showSetupHelp ? 'Verberg Setup Hulp' : 'Nu Configureren'}</span>
                  {showSetupHelp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showSetupHelp && (
                  <div className="mt-6 p-5 bg-white border border-amber-200 rounded-3xl animate-in slide-in-from-top-4 duration-500 shadow-xl shadow-amber-900/5">
                    <div className="flex items-center space-x-2 mb-4 text-blue-600">
                       <Info size={16} />
                       <p className="text-xs font-black uppercase tracking-tighter">Stap-voor-stap Setup</p>
                    </div>

                    <p className="text-xs font-black text-slate-800 mb-3">1. Voer dit uit in Supabase SQL Editor:</p>
                    <div className="relative group">
                      <pre className="text-[10px] font-mono bg-slate-900 text-slate-300 p-4 rounded-2xl overflow-x-auto leading-relaxed border border-slate-800">
                        {`CREATE TABLE packages (...); -- Klik copy voor SQL`}
                      </pre>
                      <button 
                        onClick={copySQL}
                        className="absolute top-2 right-2 p-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-white transition-all flex items-center space-x-2 shadow-lg"
                      >
                        {copied ? <Check size={14} className="text-white" /> : <Copy size={14} />}
                        <span className="text-[8px] font-black uppercase">{copied ? 'Gekopieerd' : 'Copy SQL'}</span>
                      </button>
                    </div>

                    <div className="mt-6 space-y-4">
                      <p className="text-xs font-black text-slate-800">2. Voeg deze KEYS toe in Netlify (Environment Variables):</p>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                           <code className="text-[10px] font-black text-blue-600 uppercase">VITE_SUPABASE_URL</code>
                           <span className="text-[9px] font-bold text-slate-400">Project URL</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                           <code className="text-[10px] font-black text-blue-600 uppercase">VITE_SUPABASE_ANON_KEY</code>
                           <span className="text-[9px] font-bold text-slate-400">Anon Public Key</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                           <code className="text-[10px] font-black text-emerald-600 uppercase">VITE_GEMINI_API_KEY</code>
                           <span className="text-[9px] font-bold text-slate-400">Gemini API Key</span>
                        </div>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                         <p className="text-[9px] font-bold text-blue-700 leading-relaxed uppercase">
                           Let op: Gebruik exact de namen met <span className="underline">VITE_</span> prefix, herstart je deploy in Netlify en ververs je browser.
                         </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {role === UserRole.PHARMACY && (
          <>
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="hidden sm:block">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                   Status: {hasCloudConfig ? 'Cloud Gesynchroniseerd' : 'Lokale Modus'}
                 </p>
              </div>
              <div className="flex items-center space-x-2">
                <select 
                  value={currentPharmacy.id}
                  onChange={(e) => handleSwitchPharmacy(e.target.value)}
                  className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all"
                >
                  {pharmacies.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button 
                  onClick={handleAddPharmacy}
                  className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 hover:bg-emerald-100 transition-all"
                >
                  + Nieuw
                </button>
              </div>
            </div>
            <PharmacyView 
              packages={packages} 
              onScanStart={() => setShowScanner(true)} 
              onOptimize={handleOptimizeRoute}
              isOptimizing={isOptimizing}
              pharmacyName={currentPharmacy.name}
            />
          </>
        )}
        {role === UserRole.COURIER && (
          <CourierView 
            packages={packages} 
            onUpdate={() => {}} 
            onUpdateMany={updateMultipleStatus} 
          />
        )}
        {role === UserRole.SUPERVISOR && (
          <SupervisorView 
            packages={packages} 
            onUpdateStatus={updateMultipleStatus}
            couriers={[
              { id: 'k1', name: 'Marco Koerier', role: UserRole.COURIER, status: CourierStatus.AVAILABLE },
              { id: 'k2', name: 'Sanne Bezorgd', role: UserRole.COURIER, status: CourierStatus.ON_ROUTE }
            ]} 
          />
        )}
        {role === UserRole.PATIENT && (
          <PatientView packages={packages} />
        )}
      </div>

      {showScanner && (
        <Scanner
          onScanComplete={handleNewScan}
          onCancel={() => setShowScanner(false)}
        />
      )}
    </Layout>
  );
};

export default App;
