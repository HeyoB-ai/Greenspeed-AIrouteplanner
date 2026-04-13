import React, { useState } from 'react';
import { Package as PackageType, PackageStatus, ChatConversation, Pharmacy, UserRole } from '../types';
import { ChevronLeft } from 'lucide-react';
import PharmacyOverview from './PharmacyOverview';
import SinglePharmacyDashboard from './SinglePharmacyDashboard';
import UserManagementPanel from './UserManagementPanel';

interface Props {
  packages:                PackageType[];
  pharmacies:              Pharmacy[];
  conversations?:          ChatConversation[];
  onMarkConversationRead?: (id: string) => void;
  onMarkCallbackHandled?:  (id: string) => void;
  onOptimize?:             (ids: string[]) => Promise<void>;
  isOptimizing?:           boolean;
}

const AdminView: React.FC<Props> = ({
  packages,
  pharmacies,
  conversations = [],
  onMarkConversationRead,
  onMarkCallbackHandled,
  onOptimize,
  isOptimizing,
}) => {
  const isMulti = pharmacies.length > 1;
  const [selected, setSelected] = useState<string | null>(null);

  if (pharmacies.length === 0) return null;

  // Multi-pharmacy: toon overzicht totdat een apotheek is gekozen
  if (isMulti && !selected) {
    return (
      <div className="max-w-6xl mx-auto animate-in fade-in duration-300 pb-24 lg:pb-8 space-y-6">
        <PharmacyOverview
          packages={packages}
          pharmacies={pharmacies}
          onSelectPharmacy={setSelected}
        />
        <UserManagementPanel
          pharmacies={pharmacies}
          userRole={UserRole.ADMIN}
        />
      </div>
    );
  }

  // Resolve welke apotheek we tonen
  const pharmacy = isMulti
    ? (pharmacies.find(p => p.id === selected) ?? pharmacies[0])
    : pharmacies[0];

  const phPackages = isMulti
    ? packages.filter(p => p.pharmacyId === pharmacy.id)
    : packages;

  const phConversations = isMulti
    ? conversations.filter(c => c.pharmacyId === pharmacy.id)
    : conversations;

  return (
    <div className="space-y-6 pb-24 lg:pb-8">
      {/* Terugknop (alleen bij multi-apotheek) */}
      {isMulti && (
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1.5 text-sm font-black text-slate-500 hover:text-slate-800 mb-5 transition-colors"
        >
          <ChevronLeft size={16} />
          Alle apotheken
        </button>
      )}

      <SinglePharmacyDashboard
        packages={phPackages}
        pharmacy={pharmacy}
        conversations={phConversations}
        onMarkConversationRead={onMarkConversationRead}
        onMarkCallbackHandled={onMarkCallbackHandled}
        onOptimize={onOptimize}
        isOptimizing={isOptimizing}
      />

      {/* Gebruikersbeheer — altijd zichtbaar voor admin */}
      <UserManagementPanel
        pharmacies={[pharmacy]}
        userRole={UserRole.ADMIN}
        defaultPharmacyId={pharmacy.id}
      />
    </div>
  );
};

export default AdminView;
