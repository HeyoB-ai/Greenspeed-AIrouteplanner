import React, { useState, useEffect, useCallback } from 'react';
import { UserRole, Package, PackageStatus, Address, CourierStatus, DeliveryEvidence } from './types';
import Layout from './components/Layout';
import PharmacyView from './components/PharmacyView';
import CourierView from './components/CourierView';
import SupervisorView from './components/SupervisorView';
import Scanner from './components/Scanner';
import { optimizeRoute, extractAddressFromImage } from './services/geminiService';

const STORAGE_KEY = 'medroute_data_v6';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.PHARMACY);
  const [packages, setPackages] = useState<Package[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  // Demo Mock: Wissel tussen apotheken om tracing te laten zien
  const [currentPharmacy, setCurrentPharmacy] = useState({ id: 'ph-1', name: 'Apotheek de Kroon' });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPackages(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Kon lokale opslag niet laden:", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
  }, [packages]);

  const handleNewScan = useCallback(async (base64: string) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
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
        setPackages(prev => prev.map(p => 
          p.id === tempId ? { ...p, address, status: PackageStatus.PENDING, id: `pkg-${Date.now()}-${Math.random().toString(36).substr(2, 2)}` } : p
        ));
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
      
      setPackages(prev => {
        const updated = [...prev];
        
        selectedIds.forEach(id => {
          const idx = updated.findIndex(p => p.id === id);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], orderIndex: undefined, displayIndex: undefined };
          }
        });

        optimizedReferenceIds.forEach((refId, index) => {
          const key = Array.from(stopsMap.entries()).find(([k, ids]) => ids.includes(refId))?.[0];
          if (key) {
            const allIdsForThisStop = stopsMap.get(key) || [];
            allIdsForThisStop.forEach(id => {
              const pkgIndex = updated.findIndex(p => p.id === id);
              if (pkgIndex !== -1) {
                updated[pkgIndex] = { 
                  ...updated[pkgIndex], 
                  status: PackageStatus.ASSIGNED,
                  orderIndex: index,
                  displayIndex: index + 1
                };
              }
            });
          }
        });
        return updated;
      });
    } catch (err) {
      console.error("Route optimalisatie mislukt:", err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const updateMultipleStatus = (ids: string[], status: PackageStatus, evidence?: DeliveryEvidence) => {
    setPackages(prev => prev.map(p => 
      ids.includes(p.id) ? { ...p, status, deliveryEvidence: evidence, deliveredAt: evidence?.timestamp || p.deliveredAt } : p
    ));
  };

  const togglePharmacy = () => {
    setCurrentPharmacy(prev => prev.id === 'ph-1' 
      ? { id: 'ph-2', name: 'Apotheek Hilversum Noord' } 
      : { id: 'ph-1', name: 'Apotheek de Kroon' }
    );
  };

  return (
    <Layout 
      activeRole={role} 
      userName={currentPharmacy.name} 
      onLogout={() => { if(confirm("Data wissen?")) { localStorage.clear(); window.location.reload(); } }} 
      onSwitchRole={setRole}
      hideMobileNav={showScanner}
    >
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {role === UserRole.PHARMACY && (
          <>
            <div className="mb-6 flex justify-end">
              <button 
                onClick={togglePharmacy}
                className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 hover:bg-blue-100 transition-all"
              >
                Wissel van Apotheek (Demo Context: {currentPharmacy.name})
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