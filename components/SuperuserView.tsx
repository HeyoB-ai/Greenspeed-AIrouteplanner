import React, { useState } from 'react';
import { Package as PackageType, PackageStatus, Pharmacy } from '../types';
import { ChevronLeft } from 'lucide-react';
import PharmacyOverview from './PharmacyOverview';
import SinglePharmacyDashboard from './SinglePharmacyDashboard';
import ExportModal from './ExportModal';

interface Props {
  packages:        PackageType[];
  pharmacies:      Pharmacy[];
  onUpdateStatus:  (ids: string[], status: PackageStatus) => void;
  canAddPharmacy?: boolean;
  onAddPharmacy?:  (pharmacy: Pharmacy) => Promise<void>;
}

const SuperuserView: React.FC<Props> = ({ packages, pharmacies, onUpdateStatus, canAddPharmacy, onAddPharmacy }) => {
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
        />
      </>
    );
  }

  // ── Layer 1: overzicht ─────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-300 pb-24 lg:pb-8">
      <PharmacyOverview
        packages={packages}
        pharmacies={pharmacies}
        onSelectPharmacy={setSelected}
        onExport={() => setShowExport(true)}
        canAddPharmacy={canAddPharmacy}
        onAddPharmacy={onAddPharmacy}
      />

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
