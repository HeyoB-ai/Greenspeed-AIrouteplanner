
import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, Package, PackageStatus, Address, CourierStatus, DeliveryEvidence } from './types';
import Layout from './components/Layout';
import PharmacyView from './components/PharmacyView';
import CourierView from './components/CourierView';
import SupervisorView from './components/SupervisorView';
import Scanner from './components/Scanner';
import { optimizeRoute, extractAddressFromImage } from './services/geminiService';
import { db, supabase } from './services/supabaseService';
import { Cloud, CloudOff, CloudSync, AlertTriangle } from 'lucide-react';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.PHARMACY);
  const [packages, setPackages] = useState<Package[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [currentPharmacy, setCurrentPharmacy] = useState({ id: 'ph-1', name: 'Apotheek de Kroon' });

  // Controleer of cloud opslag beschikbaar is
  const hasCloudConfig = !!supabase;

  // Initial data load vanuit Supabase of LocalStorage via db service
  useEffect(() => {
    const loadData = async () => {
      setIsSyncing(true);
      const data = await db.fetchPackages();
      setPackages(data);
      setIsSyncing(false);
    };
    loadData();
  }, []);

  const handleNewScan = useCallback(async (base64: string) => {
    const tempId = `pkg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const placeholderPkg: Package = {
      id: tempId,
      pharmacyId: currentPharmacy.id,
      pharmacyName: currentPharmacy.name,
      address: { street: 'Bezig met analyseren...', houseNumber: '', postalCode: '', city: '' },
      status: PackageStatus.SCANNING,
      createdAt: new Date().toISOString(),
      priority: 3
    };
    
    setPackages(prev => [placeholderPkg, ...prev]);

    try {
      const address = await extractAddressFromImage(base64);
      if (address && address.street) {
        const finalPkg: Package = { 
          ...placeholderPkg, 
          address, 
          status: PackageStatus.PENDING 
        };
        
        setPackages(prev => prev.map(p => p.id === tempId ? finalPkg : p));
        await db.syncPackage(finalPkg);
      } else {
        setPackages(prev => prev.filter(p => p.id !== tempId));
      }
    } catch (err) {
      setPackages(prev => prev.filter(p => p.id !== tempId));
    }
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

  const syncIndicator = (
    <div className={`flex items-center space-x-2 px-3 py-1 border rounded-full transition-colors ${hasCloudConfig ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-100'}`}>
      {isSyncing ? (
        <CloudSync size={14} className="text-blue-500 animate-spin" />
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
          <div className="mb-6 bg-amber-50 border border-amber-100 p-4 rounded-3xl flex items-center space-x-4">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-sm font-black text-amber-900 leading-tight">Database niet geconfigureerd</p>
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mt-1">
                Data wordt momenteel uitsluitend op dit apparaat bewaard.
              </p>
            </div>
          </div>
        )}

        {role === UserRole.PHARMACY && (
          <>
            <div className="mb-6 flex justify-between items-center">
              <div className="hidden sm:block">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                   Status: {hasCloudConfig ? 'Cloud Gesynchroniseerd' : 'Lokale Modus'}
                 </p>
              </div>
              <button 
                onClick={() => setCurrentPharmacy(prev => prev.id === 'ph-1' ? { id: 'ph-2', name: 'Apotheek Hilversum Noord' } : { id: 'ph-1', name: 'Apotheek de Kroon' })}
                className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 hover:bg-blue-100 transition-all"
              >
                Wissel Apotheek: {currentPharmacy.name}
              </button>
            </div>
            <PharmacyView 
              packages={packages} 
              onScanStart={() => setShowScanner(true)} 
              onOptimize={handleOptimizeRoute}
              isOptimizing={isOptimizing}
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
      </div>

      {showScanner && (
        <Scanner 
          onCapture={handleNewScan} 
          onClose={() => setShowScanner(false)} 
        />
      )}
    </Layout>
  );
};

export default App;
