import React, { useState } from 'react';
import { Package as PackageType, PackageStatus, Pharmacy, UserRole } from '../types';
import { ChevronLeft, Building2, Users, Activity, Euro } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PharmacyOverview from './PharmacyOverview';
import SinglePharmacyDashboard from './SinglePharmacyDashboard';
import ExportModal from './ExportModal';
import UserManagementPanel from './UserManagementPanel';
import MonitoringDashboard from './MonitoringDashboard';
import FinancialDashboard from './FinancialDashboard';
import CourierWagePanel from './CourierWagePanel';
import UsersOverviewPanel from './UsersOverviewPanel';
import GroupManagementPanel from './GroupManagementPanel';
import UnassignedPackagesPanel from './UnassignedPackagesPanel';

interface Props {
  packages:        PackageType[];
  pharmacies:      Pharmacy[];
  userRole?:       UserRole;
  onUpdateStatus:  (ids: string[], status: PackageStatus) => void;
  canAddPharmacy?: boolean;
  onAddPharmacy?:  (pharmacy: Pharmacy) => Promise<void>;
  onEditPharmacy?: (pharmacy: Pharmacy) => void;
  onOptimize?:     (ids: string[]) => Promise<void>;
  isOptimizing?:   boolean;
  onPharmacyCodeChange?: (pharmacyId: string, code: string) => void;
}

type Tab = 'apotheken' | 'gebruikers' | 'financieel' | 'monitor';

const SuperuserView: React.FC<Props> = ({
  packages, pharmacies, userRole, onUpdateStatus,
  canAddPharmacy, onAddPharmacy, onEditPharmacy, onOptimize, isOptimizing,
  onPharmacyCodeChange,
}) => {
  const [selected, setSelected]     = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [activeTab, setActiveTab]   = useState<Tab>('apotheken');

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
          onPharmacyCodeChange={onPharmacyCodeChange}
        />
      </>
    );
  }

  // ── Layer 1: overzicht ─────────────────────────────────────────
  const effectiveRole = userRole ?? UserRole.SUPERUSER;

  const tabButton = (tab: Tab, label: string, Icon: LucideIcon) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`px-4 h-9 rounded-full text-sm font-display font-bold transition-all flex items-center gap-1.5 ${
        activeTab === tab
          ? 'bg-[#253046] text-white'
          : 'bg-[#f2f4f6] text-[#3d4945] hover:bg-[#e8eaec]'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-300 pb-24 lg:pb-8 space-y-6">

      {/* Tab navigatie */}
      <div className="flex flex-wrap gap-2">
        {tabButton('apotheken',  'Apotheken',  Building2)}
        {tabButton('gebruikers', 'Gebruikers', Users)}
        {tabButton('financieel', 'Financieel', Euro)}
        {tabButton('monitor',    'Monitor',    Activity)}
      </div>

      {activeTab === 'apotheken' && (
        <div>
          {effectiveRole === UserRole.SUPERUSER && <UnassignedPackagesPanel pharmacies={pharmacies} />}
          <PharmacyOverview
            packages={packages}
            pharmacies={pharmacies}
            onSelectPharmacy={setSelected}
            onExport={() => setShowExport(true)}
            canAddPharmacy={canAddPharmacy}
            onAddPharmacy={onAddPharmacy}
            onEditPharmacy={onEditPharmacy}
          />
        </div>
      )}

      {activeTab === 'gebruikers' && pharmacies.length > 0 && (
        <div className="space-y-6">
          <UserManagementPanel
            pharmacies={pharmacies}
            userRole={effectiveRole}
          />
          <UsersOverviewPanel />
          <CourierWagePanel />
          {effectiveRole === UserRole.SUPERUSER && <GroupManagementPanel />}
        </div>
      )}

      {activeTab === 'financieel' && <FinancialDashboard />}

      {activeTab === 'monitor' && <MonitoringDashboard />}

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
