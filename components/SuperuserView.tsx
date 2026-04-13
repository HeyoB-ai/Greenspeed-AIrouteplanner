import React, { useState } from 'react';
import { Package as PackageType, PackageStatus, Pharmacy, UserRole } from '../types';
import { ChevronLeft } from 'lucide-react';
import PharmacyOverview from './PharmacyOverview';
import SinglePharmacyDashboard from './SinglePharmacyDashboard';
import ExportModal from './ExportModal';
import UserManagementPanel from './UserManagementPanel';

interface Props {
  packages:        PackageType[];
  pharmacies:      Pharmacy[];
  userRole?:       UserRole;
  onUpdateStatus:  (ids: string[], status: PackageStatus) => void;
  canAddPharmacy?: boolean;
  onAddPharmacy?:  (pharmacy: Pharmacy) => Promise<void>;
  onOptimize?:     (ids: string[]) => Promise<void>;
  isOptimizing?:   boolean;
}

const SuperuserView: React.FC<Props> = ({
  packages, pharmacies, userRole, onUpdateStatus,
  canAddPharmacy, onAddPharmacy, onOptimize, isOptimizing,
}) => {
  const [selected, setSelected]     = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);

  // ── Layer 2: apotheek detail ───────────────────────────────────
  if (selected) {
    const pharmacy  = pharmacies.find(p => p.id === selected) ?? pharmacies[0];
    const phPackages = packages.filter(p => p.pharmacyId === selected);

    return (
      <>
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm font-black text-slate-500 hover:text-slate-800 mb-5 transition-colors"
        >
          <ChevronLeft size={16} />
          Alle apotheken
        </button>

        <SinglePharmacyDashboard
          packages={phPackages}
          pharmacy={pharmacy}
          conversations={[]}
          onOptimize={onOptimize}
          isOptimizing={isOptimizing}
        />
      </>
    );
  }

  // ── Layer 1: overzicht ─────────────────────────────────────────
  const effectiveRole = userRole ?? UserRole.SUPERUSER;

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-300 pb-24 lg:pb-8 space-y-6">
      <PharmacyOverview
        packages={packages}
        pharmacies={pharmacies}
        onSelectPharmacy={setSelected}
        onExport={() => setShowExport(true)}
        canAddPharmacy={canAddPharmacy}
        onAddPharmacy={onAddPharmacy}
      />

      {/* Gebruikersbeheer */}
      {pharmacies.length > 0 && (
        <UserManagementPanel
          pharmacies={pharmacies}
          userRole={effectiveRole}
        />
      )}

      {showExport && (
        <ExportModal
          packages={packages}
          pharmacies={pharmacies}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};

export default SuperuserView;
