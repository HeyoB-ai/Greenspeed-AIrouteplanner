

import React, { useState } from 'react';
import { Package as PackageType, User, PackageStatus, Pharmacy } from '../types';
import { Users, Package, ChevronRight, TrendingUp, ShieldCheck, CreditCard, Download, Building2, ExternalLink, Archive } from 'lucide-react';
import ArchiveView from './ArchiveView';

const STATUS_STYLE: Record<string, string> = {
  [PackageStatus.SCANNING]:        'bg-[#48c2a9]/10 text-[#006b5a]',
  [PackageStatus.PENDING]:         'bg-slate-100 text-slate-500',
  [PackageStatus.ASSIGNED]:        'bg-[#48c2a9]/15 text-[#006b5a]',
  [PackageStatus.PICKED_UP]:       'bg-[#48c2a9]/15 text-[#006b5a]',
  [PackageStatus.DELIVERED]:       'bg-emerald-100 text-emerald-600',
  [PackageStatus.MAILBOX]:         'bg-emerald-100 text-emerald-600',
  [PackageStatus.NEIGHBOUR]:       'bg-[#48c2a9]/15 text-[#006b5a]',
  [PackageStatus.RETURN]:          'bg-amber-100 text-amber-700',
  [PackageStatus.FAILED]:          'bg-red-100 text-red-600',
  [PackageStatus.BILLED]:          'bg-slate-100 text-slate-400',
  [PackageStatus.MOVED]:           'bg-[#48c2a9]/15 text-[#006b5a]',
  [PackageStatus.OTHER_LOCATION]:  'bg-[#48c2a9]/10 text-[#006b5a]',
};

interface Props {
  packages: PackageType[];
  couriers: User[];
  pharmacies?: Pharmacy[];
  onUpdateStatus: (ids: string[], status: PackageStatus) => void;
}

interface BillingEntry {
  count: number;
  packages: PackageType[];
}

const SupervisorView: React.FC<Props> = ({ packages, couriers, pharmacies, onUpdateStatus }) => {
  const [activeTab, setActiveTab] = useState<'log' | 'billing' | 'archive'>('log');
  const delivered = packages.filter(p =>
    p.status === PackageStatus.DELIVERED ||
    p.status === PackageStatus.MAILBOX ||
    p.status === PackageStatus.NEIGHBOUR
  );
  const billed = packages.filter(p => p.status === PackageStatus.BILLED);

  const billingData = delivered.reduce((acc, pkg) => {
    const name = pkg.pharmacyName || pkg.pharmacyId;
    if (!acc[name]) acc[name] = { count: 0, packages: [] };
    acc[name].count += 1;
    acc[name].packages.push(pkg);
    return acc;
  }, {} as Record<string, BillingEntry>);

  const stats = [
    { label: 'Totaal',        val: packages.length,                              icon: Package,    color: 'text-[#006b5a]',   bg: 'bg-[#48c2a9]/10' },
    { label: 'Bezorgd',       val: delivered.length,                             icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Openstaand',    val: `€${(delivered.length * 4.5).toFixed(2)}`,   icon: CreditCard, color: 'text-amber-600',   bg: 'bg-amber-50' },
    { label: 'Gearchiveerd',  val: billed.length,                                icon: Archive,    color: 'text-slate-600',   bg: 'bg-slate-50' },
  ];

  const exportToCSV = (pharmacyName: string, pkgs: PackageType[]) => {
    const headers = ["ID", "Apotheek", "Adres", "Huisnummer", "Postcode", "Stad", "Bezorgd Op", "Lat", "Lng"];
    const rows = pkgs.map(p => [
      p.id,
      p.pharmacyName,
      p.address.street,
      p.address.houseNumber,
      p.address.postalCode,
      p.address.city,
      p.deliveredAt || '',
      p.deliveryEvidence?.latitude || '',
      p.deliveryEvidence?.longitude || ''
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Facturatie_${pharmacyName}_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBillPharmacy = (pharmacyName: string, pkgs: PackageType[]) => {
    if (confirm(`Weet je zeker dat je ${pkgs.length} zendingen voor ${pharmacyName} wilt markeren als gefactureerd?`)) {
      onUpdateStatus(pkgs.map(p => p.id), PackageStatus.BILLED);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-1000 pb-24 lg:pb-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {stats.map(s => (
          <div key={s.label} className="bg-white p-5 lg:p-8 rounded-4xl transition-transform hover:-translate-y-1" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
            <div className={`w-14 h-14 ${s.bg} ${s.color} rounded-2xl flex items-center justify-center mb-6`}>
              <s.icon size={28} />
            </div>
            <p className="text-3xl font-black text-[#191c1e] leading-none">{s.val}</p>
            <p className="text-[10px] font-black text-[#3d4945]/40 uppercase tracking-[0.2em] mt-3">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-4xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.06)' }}>
            <div className="p-2 flex border-b border-[#bccac4]/20 bg-[#f7f9fb]/50">
              {(['log', 'billing', 'archive'] as const).map((tab, i) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-4 text-xs font-black uppercase tracking-widest transition-all ${
                    activeTab === tab
                      ? 'text-[#006b5a] border-b-2 border-[#006b5a]'
                      : 'text-[#3d4945]/40 hover:text-[#3d4945]/70'
                  }`}
                >
                  {['Totaal Logboek', 'Facturatie', 'Archief'][i]}
                </button>
              ))}
            </div>

            <div className="divide-y divide-[#bccac4]/10 min-h-[500px]">
              {activeTab === 'archive' && (
                <div className="p-6">
                  <ArchiveView packages={packages} pharmacyId={undefined} pharmacies={pharmacies} />
                </div>
              )}
              {activeTab === 'log' && (
                packages.length === 0 ? (
                  <div className="p-20 text-center text-[#3d4945]/40 font-bold">Geen data beschikbaar</div>
                ) : (
                  [...packages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(p => (
                    <div key={p.id} className="p-6 hover:bg-[#f7f9fb] transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${STATUS_STYLE[p.status] || 'bg-[#48c2a9]/10 text-[#006b5a]'}`}>
                            <Package size={18} />
                          </div>
                          <div>
                            <h4 className="font-black text-[#191c1e] text-base leading-tight">{p.address.street} {p.address.houseNumber}</h4>
                            <div className="flex items-center space-x-2 mt-1 text-[10px] font-bold uppercase tracking-widest">
                              <span className="text-[#006b5a]">{p.pharmacyName}</span>
                              <span className="text-[#bccac4]">•</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${STATUS_STYLE[p.status] || 'bg-slate-100 text-slate-400'}`}>{p.status}</span>
                            </div>
                          </div>
                        </div>
                        {p.deliveryEvidence && (
                          <button
                            onClick={() => window.open(`https://www.google.com/maps?q=${p.deliveryEvidence?.latitude},${p.deliveryEvidence?.longitude}`)}
                            className="flex items-center space-x-2 bg-[#f2f4f6] hover:bg-[#e8eceb] px-3 py-2 rounded-xl transition-colors"
                          >
                            <ExternalLink size={14} className="text-[#3d4945]/50" />
                            <span className="text-[10px] font-black text-[#3d4945]">LOCATIE BEWIJS</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}
              {activeTab === 'billing' && (
                Object.keys(billingData).length === 0 ? (
                  <div className="p-20 text-center text-[#3d4945]/40 font-bold">
                    <CreditCard className="mx-auto mb-4 opacity-20" size={48} />
                    <p>Geen openstaande bezorgingen voor facturatie.</p>
                  </div>
                ) : (
                  (Object.entries(billingData) as [string, BillingEntry][]).map(([pharmacy, data]) => (
                    <div key={pharmacy} className="p-8 hover:bg-[#f7f9fb] transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center space-x-5">
                          <div className="w-14 h-14 bg-[#48c2a9]/10 text-[#006b5a] rounded-2xl flex items-center justify-center">
                            <Building2 size={24} />
                          </div>
                          <div>
                            <h4 className="font-black text-[#191c1e] text-xl tracking-tight">{pharmacy}</h4>
                            <p className="text-[10px] font-bold text-[#3d4945]/40 uppercase tracking-widest mt-1">
                              {data.count} bezorgde pakketten
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right px-4 border-r border-[#bccac4]/20">
                            <p className="text-xl font-black text-[#191c1e]">€{(data.count * 4.5).toFixed(2)}</p>
                            <p className="text-[9px] font-black text-[#3d4945]/40 uppercase tracking-tighter">Openstaand</p>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => exportToCSV(pharmacy, data.packages)}
                              title="Download CSV"
                              className="w-12 h-12 bg-[#f2f4f6] text-[#3d4945] rounded-2xl flex items-center justify-center hover:bg-[#e8eceb] transition-all"
                            >
                              <Download size={20} />
                            </button>
                            <button
                              onClick={() => handleBillPharmacy(pharmacy, data.packages)}
                              title="Markeer als gefactureerd"
                              className="w-12 h-12 text-white rounded-2xl flex items-center justify-center transition-all active:scale-95"
                              style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)', boxShadow: '0 4px 12px rgba(0,107,90,0.25)' }}
                            >
                              <Archive size={20} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 rounded-4xl p-8 text-white shadow-xl">
            <h3 className="text-xl font-black mb-6 flex items-center space-x-3">
              <TrendingUp className="text-[#48c2a9]" size={24} />
              <span>Omzet Prognose</span>
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Maand Totaal</span>
                <span className="text-sm font-black text-white">€ {( (delivered.length + billed.length) * 4.5).toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="text-[10px] font-medium text-slate-400 leading-relaxed italic">
                  Tarieven zijn gebaseerd op de afgesproken fietser-vergoeding per stop.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-4xl p-8" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
            <h3 className="text-xl font-black text-[#191c1e] mb-6 flex items-center space-x-3">
              <Users className="text-[#006b5a]" size={24} />
              <span>Team Status</span>
            </h3>
            <div className="space-y-4">
              {couriers.map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 bg-[#f7f9fb] rounded-2xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-xs text-[#3d4945]/40"
                      style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.3)' }}>
                      {c.name[0]}
                    </div>
                    <div>
                      <p className="text-xs font-black text-[#191c1e]">{c.name}</p>
                      <p className={`text-[8px] font-bold uppercase ${c.status === 'BESCHIKBAAR' ? 'text-emerald-500' : 'text-[#006b5a]'}`}>{c.status}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[#bccac4]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupervisorView;
