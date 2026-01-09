import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import PharmacyView from './components/PharmacyView';
import CourierView from './components/CourierView';
import SupervisorView from './components/SupervisorView';
import { User, UserRole, CourierStatus, Package, PackageStatus, Address } from './types';
import { optimizeRoute } from './services/geminiService';

const MOCK_COURIERS: User[] = [
  { id: 'c1', name: 'Jan de Vries', role: UserRole.COURIER, status: CourierStatus.AVAILABLE },
  { id: 'c2', name: 'Lisa Bakker', role: UserRole.COURIER, status: CourierStatus.OFFLINE },
];

const INITIAL_PACKAGES: Package[] = [
  {
    id: 'p1',
    pharmacyId: 'ph1',
    address: { street: 'Kinkerstraat', houseNumber: '45', postalCode: '1053 DL', city: 'Amsterdam' },
    status: PackageStatus.ASSIGNED,
    courierId: 'c1',
    createdAt: new Date().toISOString(),
    priority: 1
  },
  {
    id: 'p2',
    pharmacyId: 'ph1',
    address: { street: 'Jan Evertsenstraat', houseNumber: '12', postalCode: '1057 BS', city: 'Amsterdam' },
    status: PackageStatus.PENDING,
    createdAt: new Date().toISOString(),
    priority: 3
  }
];

const App: React.FC = () => {
  const [user, setUser] = useState<User>({ id: 'u1', name: 'Apotheek De Zorg', role: UserRole.PHARMACY });
  const [packages, setPackages] = useState<Package[]>(INITIAL_PACKAGES);
  const [couriers, setCouriers] = useState<User[]>(MOCK_COURIERS);

  // Auto-assign packages logic (Simplified for demo)
  useEffect(() => {
    const unassigned = packages.filter(p => p.status === PackageStatus.PENDING);
    if (unassigned.length > 0) {
      const availableCourier = couriers.find(c => c.status === CourierStatus.AVAILABLE);
      if (availableCourier) {
        setPackages(prev => prev.map(p => 
          p.status === PackageStatus.PENDING 
            ? { ...p, status: PackageStatus.ASSIGNED, courierId: availableCourier.id } 
            : p
        ));
      }
    }
  }, [packages, couriers]);

  const handleAddPackage = (address: Address) => {
    const newPackage: Package = {
      id: `p-${Date.now()}`,
      pharmacyId: user.id,
      address,
      status: PackageStatus.PENDING,
      createdAt: new Date().toISOString(),
      priority: 2
    };
    setPackages(prev => [newPackage, ...prev]);
  };

  const handleUpdatePackageStatus = (id: string, status: PackageStatus) => {
    setPackages(prev => prev.map(p => 
      p.id === id ? { ...p, status, deliveredAt: status === PackageStatus.DELIVERED ? new Date().toISOString() : undefined } : p
    ));
  };

  const handleCourierStatusChange = (status: CourierStatus) => {
    setCouriers(prev => prev.map(c => 
      c.id === user.id ? { ...c, status } : c
    ));
    setUser(prev => ({ ...prev, status }));
  };

  const handleSwitchRole = (role: UserRole) => {
    if (role === UserRole.COURIER) {
      setUser({ ...MOCK_COURIERS[0], role });
    } else if (role === UserRole.SUPERVISOR) {
      setUser({ id: 's1', name: 'Mark Planner', role });
    } else {
      setUser({ id: 'u1', name: 'Apotheek De Zorg', role });
    }
  };

  const handleAIRequestOptimization = async () => {
    const activeRoutePackages = packages
      .filter(p => p.status === PackageStatus.ASSIGNED || p.status === PackageStatus.PICKED_UP)
      .map(p => ({ ...p.address, id: p.id }));

    if (activeRoutePackages.length > 1) {
      try {
        const optimizedIds = await optimizeRoute(activeRoutePackages);
        
        // Check if we actually got a different order
        if (optimizedIds && optimizedIds.length > 0) {
          const sorted = [...packages].sort((a, b) => {
            const idxA = optimizedIds.indexOf(a.id);
            const idxB = optimizedIds.indexOf(b.id);
            if (idxA === -1 || idxB === -1) return 0;
            return idxA - idxB;
          });
          setPackages(sorted);
          alert("Routes zijn succesvol geoptimaliseerd door de AI.");
        }
      } catch (err) {
        console.error("Optimization failed:", err);
        alert("AI optimalisatie is momenteel niet beschikbaar.");
      }
    } else {
      alert("Niet genoeg actieve zendingen om een route te optimaliseren.");
    }
  };

  return (
    <Layout 
      activeRole={user.role} 
      userName={user.name} 
      onLogout={() => window.location.reload()}
      onSwitchRole={handleSwitchRole}
    >
      {user.role === UserRole.PHARMACY && (
        <PharmacyView 
          packages={packages} 
          onAddPackage={handleAddPackage} 
        />
      )}
      
      {user.role === UserRole.COURIER && (
        <CourierView 
          user={user} 
          packages={packages} 
          onStatusChange={handleCourierStatusChange}
          onUpdatePackage={handleUpdatePackageStatus}
        />
      )}
      
      {user.role === UserRole.SUPERVISOR && (
        <SupervisorView 
          packages={packages} 
          couriers={couriers} 
          onOptimizeRoutes={handleAIRequestOptimization}
        />
      )}
    </Layout>
  );
};

export default App;