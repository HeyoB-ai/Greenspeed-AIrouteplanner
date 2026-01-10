import React, { useState, useEffect } from 'react';
import { User, UserRole, Package, PackageStatus, Address, CourierStatus } from './types.ts';
import Layout from './components/Layout.tsx';
import PharmacyView from './components/PharmacyView.tsx';
import CourierView from './components/CourierView.tsx';
import SupervisorView from './components/SupervisorView.tsx';

const STORAGE_KEY = 'medroute_packages_v1';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.PHARMACY);
  const [packages, setPackages] = useState<Package[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const [currentUser] = useState<User>({
    id: 'u-1',
    name: 'Apotheek de Kroon',
    role: UserRole.PHARMACY
  });

  const [couriers] = useState<User[]>([
    { id: 'k1', name: 'Marco Koerier', role: UserRole.COURIER, status: CourierStatus.AVAILABLE },
    { id: 'k2', name: 'Sanne Bezorgd', role: UserRole.COURIER, status: CourierStatus.ON_ROUTE }
  ]);

  // Initialisatie logica
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPackages(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Data load error:", e);
    } finally {
      setIsInitialized(true);
      
      // Verwijder de zandloper zodra de App gemount is
      const loader = document.getElementById('loader-fallback');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.remove(), 400);
      }
    }
  }, []);

  // Opslaan bij wijzigingen
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
    }
  }, [packages, isInitialized]);

  const addPackage = (address: Address) => {
    const newPkg: Package = {
      id: `pkg-${Math.random().toString(36).substr(2, 9)}`,
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

  const handleLogout = () => {
    if (confirm("Sessie beëindigen?")) {
      window.location.reload();
    }
  };

  if (!isInitialized) return null;

  return (
    <Layout 
      activeRole={role} 
      userName={currentUser.name} 
      onLogout={handleLogout} 
      onSwitchRole={setRole}
    >
      {role === UserRole.PHARMACY && (
        <PharmacyView packages={packages} onAdd={addPackage} />
      )}
      {role === UserRole.COURIER && (
        <CourierView packages={packages} onUpdate={updatePackage} />
      )}
      {role === UserRole.SUPERVISOR && (
        <SupervisorView packages={packages} couriers={couriers} />
      )}
    </Layout>
  );
};

export default App;