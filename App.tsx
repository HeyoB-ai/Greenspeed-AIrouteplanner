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
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentUser] = useState<User>({
    id: 'u-1',
    name: 'Apotheek de Kroon',
    role: UserRole.PHARMACY
  });

  const [couriers] = useState<User[]>([
    { id: 'k1', name: 'Marco Koerier', role: UserRole.COURIER, status: CourierStatus.AVAILABLE },
    { id: 'k2', name: 'Sanne Bezorgd', role: UserRole.COURIER, status: CourierStatus.ON_ROUTE }
  ]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setPackages(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Fout bij laden lokale data", e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(packages));
      } catch (e) {
        console.error("Kon data niet opslaan", e);
      }
    }
  }, [packages, isLoaded]);

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
    if (confirm("Weet je zeker dat je wilt uitloggen? Lokale sessiedata blijft behouden.")) {
      window.location.reload();
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <h1 className="text-2xl font-black text-red-600 mb-4">Er is iets misgegaan</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold">Opnieuw proberen</button>
        </div>
      </div>
    );
  }

  if (!isLoaded) return null;

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