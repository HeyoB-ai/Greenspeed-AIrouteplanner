import React, { useState, useEffect } from 'react';
import { UserRole, Package, PackageStatus, Address, CourierStatus, DeliveryEvidence } from './types';
import Layout from './components/Layout';
import PharmacyView from './components/PharmacyView';
import CourierView from './components/CourierView';
import SupervisorView from './components/SupervisorView';
import Scanner from './components/Scanner';
import { optimizeRoute } from './services/geminiService';

const STORAGE_KEY = 'medroute_data_v3';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.PHARMACY);
  const [packages, setPackages] = useState<Package[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

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

  const addPackage = (address: Address) => {
    const newPkg: Package = {
      id: `pkg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      pharmacyId: 'ph-1',
      address,
      status: PackageStatus.PENDING,
      createdAt: new Date().toISOString(),
      priority: 3
    };
    setPackages(prev => [newPkg, ...prev]);
    setShowScanner(false);
  };

  const handleOptimizeRoute = async (selectedIds: string[]) => {
    setIsOptimizing(true);
    const selectedPackages = packages.filter(p => selectedIds.includes(p.id));
    
    try {
      const optimizedIds = await optimizeRoute(selectedPackages.map(p => ({ ...p.address, id: p.id })));
      
      setPackages(prev => {
        const updated = [...prev];
        optimizedIds.forEach((id, index) => {
          const pkgIndex = updated.findIndex(p => p.id === id);
          if (pkgIndex !== -1) {
            updated[pkgIndex] = { 
              ...updated[pkgIndex], 
              status: PackageStatus.ASSIGNED,
              orderIndex: index 
            };
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

  const updatePackageStatus = (id: string, status: PackageStatus, evidence?: DeliveryEvidence) => {
    setPackages(prev => prev.map(p => 
      p.id === id ? { ...p, status, deliveryEvidence: evidence, deliveredAt: evidence?.timestamp } : p
    ));
  };

  return (
    <Layout 
      activeRole={role} 
      userName="Apotheek de Kroon" 
      onLogout={() => { localStorage.clear(); window.location.reload(); }} 
      onSwitchRole={setRole}
      hideMobileNav={showScanner}
    >
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {role === UserRole.PHARMACY && (
          <PharmacyView 
            packages={packages} 
            onScanStart={() => setShowScanner(true)} 
            onOptimize={handleOptimizeRoute}
            isOptimizing={isOptimizing}
          />
        )}
        {role === UserRole.COURIER && (
          <CourierView packages={packages} onUpdate={updatePackageStatus} />
        )}
        {role === UserRole.SUPERVISOR && (
          <SupervisorView 
            packages={packages} 
            couriers={[
              { id: 'k1', name: 'Marco Koerier', role: UserRole.COURIER, status: CourierStatus.AVAILABLE },
              { id: 'k2', name: 'Sanne Bezorgd', role: UserRole.COURIER, status: CourierStatus.ON_ROUTE }
            ]} 
          />
        )}
      </div>

      {showScanner && (
        <Scanner 
          onScanComplete={addPackage} 
          onCancel={() => setShowScanner(false)} 
        />
      )}
    </Layout>
  );
};

export default App;