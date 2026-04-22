import React, { useState, useMemo } from 'react';
import { Package as PackageType, PackageStatus, ChatConversation, Pharmacy } from '../types';
import {
  Package, Truck, CheckCircle2, AlertTriangle, Download,
  MapPin, RefreshCw, MessageCircle, Phone, ArrowLeft, ChevronRight, ChevronDown, Archive, X, Map as MapIcon,
} from 'lucide-react';
import ChatBot from './ChatBot';
import ArchiveView from './ArchiveView';
import ExportModal from './ExportModal';

interface Props {
  packages:                PackageType[];
  pharmacy:                Pharmacy;
  conversations?:          ChatConversation[];
  onMarkConversationRead?: (id: string) => void;
  onMarkCallbackHandled?:  (id: string) => void;
  onOptimize?:             (ids: string[]) => Promise<void>;
  isOptimizing?:           boolean;
}

const COURIER_NAMES: Record<string, string> = {
  'k1': 'Marco Koerier',
  'k2': 'Sanne Bezorgd',
};

const getStatusIcon = (status: PackageStatus): string => {
  switch (status) {
    case PackageStatus.PENDING:        return '📦';
    case PackageStatus.ASSIGNED:       return '📋';
    case PackageStatus.PICKED_UP:      return '🚚';
    case PackageStatus.DELIVERED:      return '✅';
    case PackageStatus.MAILBOX:        return '📬';
    case PackageStatus.NEIGHBOUR:      return '🏠';
    case PackageStatus.RETURN:         return '🔙';
    case PackageStatus.MOVED:          return '🚛';
    case PackageStatus.OTHER_LOCATION: return '🏥';
    case PackageStatus.FAILED:         return '❌';
    default:                           return '•';
  }
};

const STATUS_CONFIG: Record<string, { className: string; label: string }> = {
  [PackageStatus.SCANNING]:        { className: 'bg-[#d7e2fe] text-[#101c30]',           label: 'Analyseren'     },
  [PackageStatus.PENDING]:         { className: 'bg-amber-100 text-amber-700',            label: 'Wachten'        },
  [PackageStatus.ASSIGNED]:        { className: 'bg-[#d7e2fe] text-[#101c30]',           label: 'Toegewezen'     },
  [PackageStatus.PICKED_UP]:       { className: 'bg-[#d7e2fe] text-[#101c30]',           label: 'Opgehaald'      },
  [PackageStatus.DELIVERED]:       { className: 'bg-[#48c2a9]/15 text-[#006b5a]',        label: 'Bezorgd'        },
  [PackageStatus.MAILBOX]:         { className: 'bg-[#48c2a9]/15 text-[#006b5a]',        label: 'Brievenbus'     },
  [PackageStatus.NEIGHBOUR]:       { className: 'bg-[#d7e2fe] text-[#101c30]',           label: 'Bij buren'      },
  [PackageStatus.RETURN]:          { className: 'bg-amber-100 text-amber-700',            label: 'Retour'         },
  [PackageStatus.FAILED]:          { className: 'bg-red-50 text-red-600',                 label: 'Mislukt'        },
  [PackageStatus.BILLED]:          { className: 'bg-[#f2f4f6] text-[#3d4945]',           label: 'Gefactureerd'   },
  [PackageStatus.MOVED]:           { className: 'bg-[#f2f4f6] text-[#3d4945]',           label: 'Verhuisd'       },
  [PackageStatus.OTHER_LOCATION]:  { className: 'bg-[#f2f4f6] text-[#3d4945]',           label: 'Andere locatie' },
};

const StatusBadge: React.FC<{ status: PackageStatus }> = ({ status }) => {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-[#f2f4f6] text-[#3d4945]' };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-display font-black uppercase tracking-wide ${config.className}`}>
      {config.label}
    </span>
  );
};

// ── Datumgroepering helpers ────────────────────────────────────────────
function getDateLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday  = new Date(today); yesterday.setDate(today.getDate() - 1);
  const dayBefore  = new Date(today); dayBefore.setDate(today.getDate() - 2);
  const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7);

  const dateOnly = new Date(dateStr);
  dateOnly.setHours(0, 0, 0, 0);

  if (dateOnly.getTime() === today.getTime())     return 'Vandaag';
  if (dateOnly.getTime() === yesterday.getTime()) return 'Gisteren';
  if (dateOnly.getTime() === dayBefore.getTime()) return 'Eergisteren';
  if (dateOnly >= sevenDaysAgo) {
    return new Date(dateStr).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  return 'Ouder';
}

function groupByDate<T extends { createdAt: string }>(
  items: T[]
): Array<{ label: string; date: Date; items: T[] }> {
  const groups = new Map<string, { label: string; date: Date; items: T[] }>();
  items.forEach(item => {
    const label = getDateLabel(item.createdAt);
    if (!groups.has(label)) {
      groups.set(label, { label, date: new Date(item.createdAt), items: [] });
    }
    groups.get(label)!.items.push(item);
  });

  const fixedOrder = ['Vandaag', 'Gisteren', 'Eergisteren'];
  return Array.from(groups.values()).sort((a, b) => {
    const ai = fixedOrder.indexOf(a.label);
    const bi = fixedOrder.indexOf(b.label);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    if (a.label === 'Ouder') return 1;
    if (b.label === 'Ouder') return -1;
    return b.date.getTime() - a.date.getTime(); // nieuwste dag eerst
  });
}

const SinglePharmacyDashboard: React.FC<Props> = ({
  packages,
  pharmacy,
  conversations = [],
  onMarkConversationRead,
  onMarkCallbackHandled,
  onOptimize,
  isOptimizing = false,
}) => {
  const [activeTab, setActiveTab]       = useState<'packages' | 'chats' | 'archive'>('packages');
  const [selectedConv, setSelectedConv] = useState<ChatConversation | null>(null);
  const [activeCourier, setActiveCourier] = useState<string>('all');
  const [timelinePkg, setTimelinePkg]   = useState<PackageType | null>(null);
  const [showExport, setShowExport]     = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set(['Ouder']));

  const toggleGroup = (label: string) =>
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  const unreadCount      = conversations.filter(c => !c.isRead).length;
  const pendingCallbacks = conversations.filter(c => c.callbackRequest && !c.callbackRequest.isHandled).length;

  const openConversation = (conv: ChatConversation) => {
    setSelectedConv(conv);
    if (!conv.isRead && onMarkConversationRead) onMarkConversationRead(conv.id);
  };

  const today     = new Date().toDateString();
  const inTransit = packages.filter(p => p.status === PackageStatus.ASSIGNED || p.status === PackageStatus.PICKED_UP);
  const delivered = packages.filter(p => p.status === PackageStatus.DELIVERED);
  const failed    = packages.filter(p => p.status === PackageStatus.FAILED);
  const todayPkgs = packages.filter(p => new Date(p.createdAt).toDateString() === today);

  const stats = [
    { label: 'Vandaag',    val: todayPkgs.length, icon: Package       },
    { label: 'In transit', val: inTransit.length, icon: Truck         },
    { label: 'Afgeleverd', val: delivered.length, icon: CheckCircle2  },
    { label: 'Mislukt',    val: failed.length,    icon: AlertTriangle },
  ];

  const activeCouriers = useMemo(() => {
    const map = new Map();
    packages.forEach(pkg => {
      if (pkg.courierId) {
        map.set(pkg.courierId, pkg.courierName ?? COURIER_NAMES[pkg.courierId] ?? pkg.courierId);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [packages]);

  const filteredPackages = useMemo(() => {
    if (activeCourier === 'all')        return packages;
    if (activeCourier === 'unassigned') return packages.filter(p => !p.courierId);
    return packages.filter(p => p.courierId === activeCourier);
  }, [packages, activeCourier]);

  const sorted = useMemo(() =>
    [...filteredPackages].sort((a, b) => {
      if (a.orderIndex !== undefined && b.orderIndex !== undefined) return a.orderIndex - b.orderIndex;
      if (a.orderIndex !== undefined) return -1;
      if (b.orderIndex !== undefined) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
    [filteredPackages]
  );

  const groupedPackages = useMemo(() => groupByDate(sorted), [sorted]);

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24 lg:pb-8">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {stats.map(s => (
            <div key={s.label} className="bg-white rounded-3xl p-5" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
              <div className="w-10 h-10 bg-[#5dc0a7]/15 rounded-full flex items-center justify-center mb-3">
                <s.icon size={20} className="text-[#006b5a]" />
              </div>
              <p className="text-2xl font-display font-black text-[#191c1e] leading-none">{s.val}</p>
              <p className="text-[10px] font-display font-black text-[#3d4945]/50 uppercase tracking-widest mt-2">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Export knop */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-2 px-5 h-10 bg-[#d7e2fe] text-[#101c30] rounded-full font-display font-black text-xs active:scale-95 transition-all"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>

        {/* Pakkettenlijst / Chats / Archief */}
        <div className="w-full">
          <div className="bg-white rounded-4xl overflow-hidden flex flex-col h-full" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.06)' }}>

            {/* Tab headers */}
            <div className="px-6 pt-5 pb-0 bg-white border-b border-[#bccac4]/20">
              <div className="flex items-end space-x-1">
                {(['packages', 'chats', 'archive'] as const).map(tab => {
                  const isActive = activeTab === tab;
                  const label = tab === 'packages' ? 'Zendingen' : tab === 'chats' ? 'Chats' : 'Archief';
                  const icon  = tab === 'chats' ? <MessageCircle size={12} /> : tab === 'archive' ? <Archive size={12} /> : null;
                  const badge = tab === 'chats' && (unreadCount + pendingCallbacks) > 0
                    ? <span className="text-white text-[9px] font-display font-black px-1.5 py-0.5 rounded-full leading-none" style={{ background: '#006b5a' }}>{unreadCount + pendingCallbacks}</span>
                    : null;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 pb-3 pt-1 text-xs font-display font-black uppercase tracking-widest flex items-center space-x-1.5 transition-all border-b-2 ${
                        isActive
                          ? 'text-[#006b5a] border-[#006b5a]'
                          : 'text-[#3d4945]/50 border-transparent hover:text-[#3d4945]'
                      }`}
                    >
                      {icon}
                      <span>{label}</span>
                      {badge}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sub-header */}
            {activeTab === 'packages' && (
              <div className="px-6 py-4 border-b border-[#bccac4]/20">
                <h3 className="text-base lg:text-lg font-display font-black text-[#191c1e]">Zendingen</h3>
                <p className="text-[10px] font-display font-black text-[#3d4945]/50 uppercase tracking-widest mt-0.5">
                  {packages.length} totaal
                </p>
              </div>
            )}

            {activeTab === 'chats' && (
              <div className="px-6 py-4 border-b border-[#bccac4]/20">
                <h3 className="text-base lg:text-lg font-display font-black text-[#191c1e]">Patiëntgesprekken</h3>
                <p className="text-[10px] font-display font-black text-[#3d4945]/50 uppercase tracking-widest mt-0.5">
                  {conversations.length} gesprekken · {unreadCount} ongelezen
                </p>
              </div>
            )}

            {activeTab === 'archive' && (
              <div className="px-6 py-4 border-b border-[#bccac4]/20">
                <h3 className="text-base lg:text-lg font-display font-black text-[#191c1e]">Archief &amp; statistieken</h3>
                <p className="text-[10px] font-display font-black text-[#3d4945]/50 uppercase tracking-widest mt-0.5">
                  Historische bezorgdata en trends
                </p>
              </div>
            )}

            {/* Courier filter tabs */}
            {activeTab === 'packages' && (() => {
              const showTabs = activeCouriers.length > 0 || packages.some(p => !p.courierId);
              const tabs = showTabs ? [
                { id: 'all',        label: 'Alle',             count: packages.length },
                ...(packages.some(p => !p.courierId) ? [{ id: 'unassigned', label: 'Niet toegewezen', count: packages.filter(p => !p.courierId).length }] : []),
                ...activeCouriers.map(c => ({ id: c.id, label: c.name, count: packages.filter(p => p.courierId === c.id).length })),
              ] : [];
              if (!showTabs && !onOptimize) return null;
              return (
                <div className="px-6 py-3 border-b border-[#bccac4]/20 flex items-center gap-3">
                  <div className="flex gap-2 overflow-x-auto flex-1" style={{ scrollbarWidth: 'none' }}>
                    {tabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveCourier(tab.id)}
                        className={`shrink-0 px-4 py-2 rounded-full text-xs font-display font-black uppercase tracking-wide transition-all ${
                          activeCourier === tab.id
                            ? 'text-white'
                            : 'bg-[#f2f4f6] text-[#3d4945]/60 hover:bg-[#e8eceb]'
                        }`}
                        style={activeCourier === tab.id ? { background: 'linear-gradient(135deg, #006b5a, #48c2a9)' } : {}}
                      >
                        {tab.label}
                        <span className={`ml-1.5 text-[10px] ${activeCourier === tab.id ? 'text-white/70' : 'text-[#3d4945]/40'}`}>
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Packages list */}
            {activeTab === 'packages' && (
              sorted.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <Package className="text-[#bccac4] mb-4" size={40} />
                  <p className="text-[#191c1e] font-display font-black">Geen pakketten</p>
                  <p className="text-[#3d4945]/60 font-body text-sm mt-1">Scan een label om te beginnen.</p>
                </div>
              ) : (
                <div className="m-4 space-y-2">
                  {groupedPackages.map(group => (
                    <div key={group.label}>
                      {/* Datum groep header */}
                      <button
                        onClick={() => toggleGroup(group.label)}
                        className="flex items-center gap-2 w-full px-1 py-2.5 text-left active:opacity-70 transition-opacity"
                      >
                        <ChevronDown
                          size={14}
                          className={`text-[#3d4945]/50 transition-transform duration-200 ${collapsedGroups.has(group.label) ? '-rotate-90' : ''}`}
                        />
                        <span className="font-display font-black text-sm text-[#191c1e] capitalize">{group.label}</span>
                        <span className="text-[10px] font-display font-black text-[#3d4945]/50 bg-[#f2f4f6] px-2 py-0.5 rounded-full">
                          {group.items.length}
                        </span>
                        <div className="flex-1 h-px bg-[#f2f4f6]" />
                      </button>

                      {/* Pakketten van deze dag */}
                      {!collapsedGroups.has(group.label) && (
                        <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(25,28,30,0.04)' }}>
                          <div className="flex items-center gap-3 px-4 py-2 bg-[#f7f9fb] border-b border-[#bccac4]/20">
                            <div className="w-7 shrink-0" />
                            <p className="flex-1 text-[10px] font-display font-black text-[#3d4945]/50 uppercase tracking-widest">Adres</p>
                            <p className="text-[10px] font-display font-black text-[#3d4945]/50 uppercase tracking-widest shrink-0">Status</p>
                          </div>
                          {group.items.map(p => (
                            <div key={p.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-[#f7f9fb] transition-colors border-b border-[#bccac4]/15 last:border-0 cursor-default">
                              {p.status === PackageStatus.SCANNING ? (
                                <div className="w-7 h-7 rounded-full bg-[#48c2a9]/15 flex items-center justify-center shrink-0 mt-0.5">
                                  <RefreshCw size={12} className="text-[#006b5a] animate-spin" />
                                </div>
                              ) : p.scanNumber ? (
                                <div className="w-7 h-7 text-white rounded-full flex items-center justify-center text-xs font-display font-black shrink-0 mt-0.5"
                                  style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}>
                                  {p.scanNumber}
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-[#f2f4f6] flex items-center justify-center shrink-0 mt-0.5">
                                  <MapPin size={12} className="text-[#3d4945]/50" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className="font-display font-black text-[#191c1e] text-sm truncate">
                                    {p.address.street} {p.address.houseNumber}
                                  </p>
                                  {p.routeIndex && (
                                    <span className="shrink-0 bg-[#d7e2fe] text-[#101c30] text-[9px] font-display font-black px-1.5 py-0.5 rounded-md" title={`Stop ${p.routeIndex} in de route`}>
                                      →{p.routeIndex}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs font-body text-[#3d4945]/60 mt-0.5">
                                  {p.address.postalCode} {p.address.city}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <StatusBadge status={p.status} />
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-[#3d4945]/50 font-body font-bold">
                                    {new Date(p.createdAt).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <button
                                    onClick={() => setTimelinePkg(p)}
                                    className="text-[11px] text-[#006b5a] hover:text-[#48c2a9] font-display font-black flex items-center gap-0.5 transition-colors"
                                  >
                                    Historie
                                    <ChevronRight size={10} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Archive tab */}
            {activeTab === 'archive' && (
              <div className="p-6">
                <ArchiveView packages={packages} pharmacyId={pharmacy.id} />
              </div>
            )}

            {/* Chats tab */}
            {activeTab === 'chats' && (
              conversations.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <MessageCircle className="text-[#bccac4] mb-4" size={40} />
                  <p className="text-[#191c1e] font-display font-black">Geen gesprekken</p>
                  <p className="text-[#3d4945]/60 font-body text-sm mt-1">Patiëntgesprekken verschijnen hier.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#bccac4]/15 overflow-y-auto flex-1">
                  {conversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => openConversation(conv)}
                      className={`w-full px-4 py-4 flex items-start space-x-3 text-left transition-colors hover:bg-[#f7f9fb] border-l-4 ${
                        conv.hasRiskSignal ? 'border-red-400 bg-red-50/40'
                        : !conv.isRead ? 'border-[#006b5a]'
                        : 'border-transparent'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        conv.hasRiskSignal ? 'bg-red-100 text-red-600' : 'bg-[#f2f4f6] text-[#3d4945]/60'
                      }`}>
                        {conv.hasRiskSignal ? <AlertTriangle size={16} /> : <MessageCircle size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-display font-black uppercase tracking-widest text-[#3d4945]/50">
                            {new Date(conv.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                          </span>
                          {!conv.isRead && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#006b5a' }} />}
                        </div>
                        <p className="text-sm font-display font-black text-[#191c1e] truncate">
                          {conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].text : 'Leeg gesprek'}
                        </p>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className="text-[10px] font-body font-bold text-[#3d4945]/50">{conv.messages.length} berichten</span>
                          {conv.callbackRequest && (
                            <span className={`flex items-center space-x-1 text-[10px] font-display font-black ${conv.callbackRequest.isHandled ? 'text-[#006b5a]' : 'text-[#101c30]'}`}>
                              <Phone size={10} />
                              <span>{conv.callbackRequest.isHandled ? 'Afgehandeld' : conv.callbackRequest.phoneNumber}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-[#bccac4] shrink-0 mt-1" />
                    </button>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Conversation detail overlay */}
      {selectedConv && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-right duration-200">
          <div className="bg-white border-b border-[#bccac4]/20 px-4 py-3 flex items-center space-x-3 shrink-0">
            <button
              onClick={() => setSelectedConv(null)}
              className="w-9 h-9 bg-[#f2f4f6] rounded-xl flex items-center justify-center text-[#3d4945] active:scale-90 transition-all shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-black text-[#191c1e] leading-none">Gesprek</p>
              <p className="text-[10px] font-display font-black text-[#3d4945]/50 uppercase tracking-widest mt-0.5">
                {new Date(selectedConv.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            {selectedConv.hasRiskSignal && (
              <div className="flex items-center space-x-1 px-3 py-1 bg-red-100 rounded-full">
                <AlertTriangle size={12} className="text-red-600" />
                <span className="text-[10px] font-display font-black text-red-700 uppercase">Risico</span>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#f7f9fb]">
            {selectedConv.messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed font-body ${
                  msg.role === 'user'
                    ? 'text-white rounded-tr-sm'
                    : 'bg-white text-[#191c1e] rounded-tl-sm'
                }`}
                  style={msg.role === 'user'
                    ? { background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }
                    : { boxShadow: '0 2px 8px rgba(25,28,30,0.06)' }
                  }
                >
                  {msg.text.split('\n').map((line, i) => (
                    <p key={i} className={i > 0 ? 'mt-1' : ''}>{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
                  ))}
                  <p className={`text-[9px] mt-1.5 ${msg.role === 'user' ? 'text-white/60' : 'text-[#3d4945]/40'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {selectedConv.callbackRequest && (
            <div className={`px-4 py-4 border-t ${selectedConv.callbackRequest.isHandled ? 'bg-[#48c2a9]/10 border-[#48c2a9]/20' : 'bg-[#d7e2fe]/30 border-[#d7e2fe]/40'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${selectedConv.callbackRequest.isHandled ? 'bg-[#48c2a9]/15 text-[#006b5a]' : 'bg-[#d7e2fe] text-[#101c30]'}`}>
                    <Phone size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-display font-black text-[#191c1e]">{selectedConv.callbackRequest.phoneNumber}</p>
                    <p className="text-[10px] font-display font-black text-[#3d4945]/50 uppercase tracking-widest">
                      {selectedConv.callbackRequest.preferredTime} · {selectedConv.callbackRequest.isHandled ? 'Afgehandeld' : 'Wacht op terugbel'}
                    </p>
                  </div>
                </div>
                {!selectedConv.callbackRequest.isHandled && onMarkCallbackHandled && (
                  <button
                    onClick={() => {
                      onMarkCallbackHandled(selectedConv.id);
                      setSelectedConv(prev => prev ? { ...prev, callbackRequest: prev.callbackRequest ? { ...prev.callbackRequest, isHandled: true } : undefined } : null);
                    }}
                    className="px-4 py-2 text-white rounded-full text-xs font-display font-black active:scale-95 transition-all"
                    style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
                  >
                    Afgehandeld
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline modal */}
      {timelinePkg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          style={{ background: 'rgba(25,28,30,0.60)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        >
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200"
            style={{ boxShadow: '0 24px 64px rgba(25,28,30,0.20)' }}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="font-display font-black text-[#191c1e]">Statushistorie</h3>
                <p className="text-sm font-body text-[#3d4945]/60 mt-0.5">
                  {timelinePkg.address.street} {timelinePkg.address.houseNumber}
                </p>
              </div>
              <button
                onClick={() => setTimelinePkg(null)}
                className="w-8 h-8 bg-[#f2f4f6] rounded-xl flex items-center justify-center text-[#3d4945] active:scale-90 transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <div className="relative">
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-[#bccac4]/30" />
              <div className="space-y-4">
                {(timelinePkg.statusHistory ?? [{ status: timelinePkg.status, timestamp: timelinePkg.createdAt }]).map((event, i, arr) => (
                  <div key={i} className="flex items-start gap-4 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 text-sm ${
                      i === arr.length - 1 ? 'text-white' : 'bg-[#f2f4f6] text-[#3d4945]'
                    }`}
                      style={i === arr.length - 1 ? { background: 'linear-gradient(135deg, #006b5a, #48c2a9)' } : {}}>
                      {getStatusIcon(event.status)}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-display font-black text-[#191c1e]">{event.status}</span>
                        <span className="text-xs font-body text-[#3d4945]/50 whitespace-nowrap">
                          {new Date(event.timestamp).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {event.note && (
                        <p className="text-xs font-body text-[#3d4945]/60 mt-0.5 bg-[#f7f9fb] rounded-xl px-2 py-1">{event.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <ChatBot packages={packages} pharmacyName={pharmacy.name} />

      {showExport && (
        <ExportModal
          packages={packages}
          pharmacies={[pharmacy]}
          pharmacyId={pharmacy.id}
          onClose={() => setShowExport(false)}
        />
      )}
    </>
  );
};

export default SinglePharmacyDashboard;
