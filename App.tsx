import React, { useState, useEffect } from 'react';
import { UserRole, Package, PackageStatus, Address, CourierStatus } from './types';
import Layout from './components/Layout';
import PharmacyView from './components/PharmacyView';
import CourierView from './components/CourierView';
import SupervisorView from './components/SupervisorView';

const STORAGE_KEY = 'medroute_data_v2';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.PHARMACY);
  const [packages, setPackages] = useState<Package[]>([]);

  // Laad data éénmalig bij opstart
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

  // Sla data op bij wijzigingen
  useEffect(() => {
    if (packages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
    }
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
  };

  const updatePackage = (id: string, status: PackageStatus) => {
    setPackages(prev => prev.map(p => p.id === id ? { ...p, status } : p));
  };

  return (
    <Layout 
      activeRole={role} 
      userName="Apotheek de Kroon" 
      onLogout={() => { localStorage.clear(); window.location.reload(); }} 
      onSwitchRole={setRole}
    >
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        {role === UserRole.PHARMACY && (
          <PharmacyView packages={packages} onAdd={addPackage} />
        )}
        {role === UserRole.COURIER && (
          <CourierView packages={packages} onUpdate={updatePackage} />
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
    </Layout>
  );
};

export default App;