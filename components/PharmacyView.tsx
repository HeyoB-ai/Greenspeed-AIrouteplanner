import React, { useState, useMemo } from 'react';
import {
  Package, MapPin, Download,
  RefreshCw, Truck, ShieldCheck, Clock,
  MessageCircle, Phone, AlertTriangle, ArrowLeft, ChevronRight, X
} from 'lucide-react';
import { Package as PackageType, PackageStatus, ChatConversation } from '../types';
import ChatBot from './ChatBot';
import ExportModal from './ExportModal';

interface Props {
  packages: PackageType[];
  pharmacyName: string;
  conversations?: ChatConversation[];
  onMarkConversationRead?: (id: string) => void;
  onMarkCallbackHandled?: (id: string) => void;
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
  [PackageStatus.SCANNING]:        { className: 'bg-[#48c2a9]/10 text-[#006b5a]',       label: 'Analyseren'     },
  [PackageStatus.PENDING]:         { className: 'bg-amber-100 text-amber-700',           label: 'Wachten'        },
  [PackageStatus.ASSIGNED]:        { className: 'bg-[#48c2a9]/15 text-[#006b5a]',        label: 'Toegewezen'     },
  [PackageStatus.PICKED_UP]:       { className: 'bg-[#48c2a9]/15 text-[#006b5a]',        label: 'Opgehaald'      },
  [PackageStatus.DELIVERED]:       { className: 'bg-emerald-100 text-emerald-700',        label: 'Bezorgd'        },
  [PackageStatus.MAILBOX]:         { className: 'bg-emerald-100 text-emerald-700',        label: 'Brievenbus'     },
  [PackageStatus.NEIGHBOUR]:       { className: 'bg-[#48c2a9]/15 text-[#006b5a]',        label: 'Bij buren'      },
  [PackageStatus.RETURN]:          { className: 'bg-amber-100 text-amber-700',            label: 'Retour'         },
  [PackageStatus.FAILED]:          { className: 'bg-red-100 text-red-600',               label: 'Mislukt'        },
  [PackageStatus.BILLED]:          { className: 'bg-[#48c2a9]/15 text-[#006b5a]',        label: 'Gefactureerd'   },
  [PackageStatus.MOVED]:           { className: 'bg-[#48c2a9]/15 text-[#006b5a]',        label: 'Verhuisd'       },
  [PackageStatus.OTHER_LOCATION]:  { className: 'bg-[#48c2a9]/10 text-[#006b5a]',        label: 'Andere locatie' },
};

const StatusBadge: React.FC<{ status: PackageStatus }> = ({ status }) => {
  const config = STATUS_CONFIG[status] ?? { label: status, className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${config.className}`}>
      {config.label}
    </span>
  );
};

const PharmacyView: React.FC<Props> = ({
  packages,
  pharmacyName,
  conversations = [],
  onMarkConversationRead,
  onMarkCallbackHandled,
}) => {
  const [activeTab, setActiveTab]         = useState<'packages' | 'chats'>('packages');
  const [selectedConv, setSelectedConv]   = useState<ChatConversation | null>(null);
  const [activeCourier, setActiveCourier] = useState<string>('all');
  const [timelinePkg, setTimelinePkg]     = useState<PackageType | null>(null);
  const [showExport, setShowExport]       = useState(false);

  const pharmacyId = packages[0]?.pharmacyId;

  const unreadCount      = conversations.filter(c => !c.isRead).length;
  const pendingCallbacks = conversations.filter(c => c.callbackRequest && !c.callbackRequest.isHandled).length;

  const openConversation = (conv: ChatConversation) => {
    setSelectedConv(conv);
    if (!conv.isRead && onMarkConversationRead) onMarkConversationRead(conv.id);
  };

  const activeCouriers = useMemo(() => {
    const map = new Map() as Map<string, string>;
    packages.forEach(pkg => {
      if (pkg.courierId) {
        map.set(
          pkg.courierId,
          pkg.courierName ?? COURIER_NAMES[pkg.courierId] ?? pkg.courierId
        );
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [packages]);

  const filteredPackages = useMemo(() => {
    if (activeCourier === 'all')        return packages;
    if (activeCourier === 'unassigned') return packages.filter(p => !p.courierId);
    return packages.filter(p => p.courierId === activeCourier);
  }, [packages, activeCourier]);

  const activeScansCount = packages.filter(p => p.status === PackageStatus.SCANNING).length;
  const pendingPackages  = filteredPackages.filter(p => p.status === PackageStatus.PENDING);

  const sorted = useMemo(() => [...filteredPackages].sort((a, b) => {
    if (a.orderIndex !== undefined && b.orderIndex !== undefined) return a.orderIndex - b.orderIndex;
    if (a.orderIndex !== undefined) return -1;
    if (b.orderIndex !== undefined) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }), [filteredPackages]);

  const stats = [
    { label: 'Totaal',     val: packages.length,                                                                                              icon: Package,     color: 'text-[#006b5a]',    bg: 'bg-[#48c2a9]/10' },
    { label: 'In transit', val: packages.filter(p => p.status === PackageStatus.ASSIGNED || p.status === PackageStatus.PICKED_UP).length,     icon: Truck,       color: 'text-[#006b5a]',    bg: 'bg-[#48c2a9]/10' },
    { label: 'Bezorgd',    val: packages.filter(p => p.status === PackageStatus.DELIVERED).length,                                            icon: ShieldCheck, color: 'text-emerald-600',  bg: 'bg-emerald-50' },
    { label: 'Wachten',    val: pendingPackages.length,                                                                                       icon: Clock,       color: 'text-amber-600',    bg: 'bg-amber-50' },
  ];

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">

      {/* ── Stats rij ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-3xl p-5" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}>
            <div className={`w-10 h-10 ${s.bg} ${s.color} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon size={20} />
            </div>
            <p className="text-2xl font-black text-[#191c1e] leading-none">{s.val}</p>
            <p className="text-[10px] font-black text-[#3d4945]/40 uppercase tracking-widest mt-2">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Export knop ── */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center gap-2 px-4 h-10 bg-white text-[#3d4945] rounded-2xl font-black text-xs hover:text-[#006b5a] transition-all"
          style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* ── Scan actief indicator ── */}
      {activeScansCount > 0 && (
        <div className="bg-slate-900 rounded-3xl p-5 text-white border border-[#48c2a9]/30 flex items-center space-x-4">
          <RefreshCw className="animate-spin text-[#48c2a9] shrink-0" size={22} />
          <div>
            <p className="text-sm font-black">{activeScansCount} scans in verwerking…</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase">AI analyseert op de achtergrond</p>
          </div>
        </div>
      )}

      {/* ── Koerier-filter tabs ── */}
      {(activeCouriers.length > 0 || packages.some(p => !p.courierId)) && (() => {
        const tabs = [
          { id: 'all',        label: 'Alle',             count: packages.length },
          ...(packages.some(p => !p.courierId) ? [{ id: 'unassigned', label: 'Niet toegewezen', count: packages.filter(p => !p.courierId).length }] : []),
          ...activeCouriers.map(c => ({ id: c.id, label: c.name, count: packages.filter(p => p.courierId === c.id).length })),
        ];
        return (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-1" style={{ scrollbarWidth: 'none' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveCourier(tab.id)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wide transition-all ${
                  activeCourier === tab.id
                    ? 'text-white shadow-sm'
                    : 'bg-white text-[#3d4945]/60 hover:text-[#006b5a]'
                }`}
                style={activeCourier === tab.id
                  ? { background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }
                  : { boxShadow: '0 2px 8px rgba(25,28,30,0.06)' }}
              >
                {tab.label}
                <span className={`ml-1.5 text-[10px] ${activeCourier === tab.id ? 'text-white/60' : 'text-[#3d4945]/40'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        );
      })()}

      {/* ── Pakkettenlijst / Chats ── */}
      <div className="w-full">
          <div className="bg-white rounded-4xl overflow-hidden flex flex-col h-full" style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.06)' }}>
            {/* Tab headers */}
            <div className="px-6 pt-5 pb-0 border-b border-[#bccac4]/20">
              <div className="flex items-end space-x-6">
                <button
                  onClick={() => setActiveTab('packages')}
                  className={`pb-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
                    activeTab === 'packages'
                      ? 'border-[#006b5a] text-[#006b5a]'
                      : 'border-transparent text-[#3d4945]/40 hover:text-[#3d4945]/70'
                  }`}
                >
                  Zendingen
                </button>
                <button
                  onClick={() => setActiveTab('chats')}
                  className={`pb-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 flex items-center space-x-1.5 ${
                    activeTab === 'chats'
                      ? 'border-[#006b5a] text-[#006b5a]'
                      : 'border-transparent text-[#3d4945]/40 hover:text-[#3d4945]/70'
                  }`}
                >
                  <MessageCircle size={12} />
                  <span>Chats</span>
                  {(unreadCount > 0 || pendingCallbacks > 0) && (
                    <span className="text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none"
                      style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}>
                      {unreadCount + pendingCallbacks}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {activeTab === 'packages' && (
              <div className="px-6 py-4 border-b border-[#bccac4]/10">
                <h3 className="text-base font-black text-[#191c1e] lg:text-xl">Zendingen</h3>
                <p className="text-[10px] font-bold text-[#3d4945]/40 uppercase tracking-widest mt-0.5">
                  {pendingPackages.length} WACHTEN OP PLANNING
                </p>
              </div>
            )}

            {activeTab === 'chats' && (
              <div className="px-6 py-4 border-b border-[#bccac4]/10">
                <h3 className="text-base font-black text-[#191c1e] lg:text-xl">Patiëntgesprekken</h3>
                <p className="text-[10px] font-bold text-[#3d4945]/40 uppercase tracking-widest mt-0.5">
                  {conversations.length} gesprekken · {unreadCount} ongelezen
                </p>
              </div>
            )}

            {/* ── Packages tab content ── */}
            {activeTab === 'packages' && (
              sorted.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-[#f7f9fb] rounded-full flex items-center justify-center mb-4">
                    <Package className="text-[#bccac4]" size={32} />
                  </div>
                  <p className="text-[#191c1e] font-black">Geen pakketten</p>
                  <p className="text-[#3d4945]/50 text-sm font-medium mt-1">Gebruik de scanner om zendingen toe te voegen.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-[#bccac4]/15 overflow-hidden m-4">
                  {/* Lijstheader */}
                  <div className="flex items-center gap-3 px-4 py-2 bg-[#f7f9fb] border-b border-[#bccac4]/20">
                    <div className="w-7 shrink-0" />
                    <p className="flex-1 text-[10px] font-black text-[#3d4945]/40 uppercase tracking-widest">Adres</p>
                    <p className="text-[10px] font-black text-[#3d4945]/40 uppercase tracking-widest shrink-0">Status</p>
                  </div>
                  {/* Rijen */}
                  {sorted.map(p => (
                    <div key={p.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-[#f7f9fb] transition-colors border-b border-[#bccac4]/10 last:border-0 cursor-default">
                      {p.status === PackageStatus.SCANNING ? (
                        <div className="w-7 h-7 rounded-xl bg-[#48c2a9]/10 flex items-center justify-center shrink-0 mt-0.5">
                          <RefreshCw size={12} className="text-[#48c2a9] animate-spin" />
                        </div>
                      ) : p.scanNumber ? (
                        <div className="w-7 h-7 text-white rounded-xl flex items-center justify-center text-xs font-black shrink-0 mt-0.5"
                          style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}>
                          {p.scanNumber}
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-xl bg-[#f2f4f6] flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin size={12} className="text-[#3d4945]/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-[#191c1e] text-sm truncate">
                            {p.address.street} {p.address.houseNumber}
                          </p>
                        </div>
                        <p className="text-xs text-[#3d4945]/50 mt-0.5">
                          {p.address.postalCode} {p.address.city}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={p.status} />
                        <div className="flex items-center gap-2">
                          {p.statusHistory && p.statusHistory.length > 0 && (
                            <span className="text-[11px] text-[#3d4945]/40 font-bold">
                              {new Date(p.statusHistory[p.statusHistory.length - 1].timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          <button
                            onClick={() => setTimelinePkg(p)}
                            className="text-[11px] text-[#006b5a] hover:text-[#006b5a]/70 font-bold flex items-center gap-0.5 transition-colors"
                          >
                            Historie
                            <ChevronRight size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* ── Chats tab content ── */}
            {activeTab === 'chats' && (
              conversations.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-[#f7f9fb] rounded-full flex items-center justify-center mb-4">
                    <MessageCircle className="text-[#bccac4]" size={32} />
                  </div>
                  <p className="text-[#191c1e] font-black">Geen gesprekken</p>
                  <p className="text-[#3d4945]/50 text-sm font-medium mt-1">Patiëntgesprekken verschijnen hier.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#bccac4]/15 overflow-y-auto flex-1">
                  {conversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => openConversation(conv)}
                      className={`w-full px-4 py-4 flex items-start space-x-3 text-left transition-colors hover:bg-[#f7f9fb] border-l-4 ${
                        conv.hasRiskSignal
                          ? 'border-red-400 bg-red-50/40'
                          : !conv.isRead
                          ? 'border-[#006b5a]'
                          : 'border-transparent'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        conv.hasRiskSignal ? 'bg-red-100 text-red-600' : 'bg-[#f2f4f6] text-[#3d4945]/50'
                      }`}>
                        {conv.hasRiskSignal ? <AlertTriangle size={16} /> : <MessageCircle size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#3d4945]/40">
                            {new Date(conv.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                          </span>
                          {!conv.isRead && (
                            <span className="w-2 h-2 rounded-full bg-[#006b5a] shrink-0" />
                          )}
                        </div>
                        <p className="text-sm font-bold text-[#191c1e] truncate">
                          {conv.messages.length > 0
                            ? conv.messages[conv.messages.length - 1].text
                            : 'Leeg gesprek'}
                        </p>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className="text-[10px] font-bold text-[#3d4945]/40">
                            {conv.messages.length} berichten
                          </span>
                          {conv.callbackRequest && (
                            <span className={`flex items-center space-x-1 text-[10px] font-black ${
                              conv.callbackRequest.isHandled ? 'text-emerald-600' : 'text-[#006b5a]'
                            }`}>
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

      {/* ── Conversation detail overlay ── */}
      {selectedConv && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="bg-white border-b border-[#bccac4]/20 px-4 py-3 flex items-center space-x-3 shrink-0">
            <button
              onClick={() => setSelectedConv(null)}
              className="w-9 h-9 bg-[#f2f4f6] rounded-xl flex items-center justify-center text-[#3d4945] active:scale-90 transition-all shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-[#191c1e] leading-none">Gesprek</p>
              <p className="text-[10px] font-bold text-[#3d4945]/40 uppercase tracking-widest mt-0.5">
                {new Date(selectedConv.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            {selectedConv.hasRiskSignal && (
              <div className="flex items-center space-x-1 px-3 py-1 bg-red-100 rounded-full">
                <AlertTriangle size={12} className="text-red-600" />
                <span className="text-[10px] font-black text-red-700 uppercase">Risico</span>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#f7f9fb]">
            {selectedConv.messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'text-white rounded-tr-sm'
                    : 'bg-white border border-[#bccac4]/20 text-[#191c1e] rounded-tl-sm shadow-sm'
                }`}
                  style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #006b5a, #48c2a9)' } : {}}>
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

          {/* Callback section */}
          {selectedConv.callbackRequest && (
            <div className={`px-4 py-4 border-t ${selectedConv.callbackRequest.isHandled ? 'bg-emerald-50 border-emerald-100' : 'bg-[#48c2a9]/10 border-[#48c2a9]/30'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedConv.callbackRequest.isHandled ? 'bg-emerald-100 text-emerald-600' : 'bg-[#48c2a9]/15 text-[#006b5a]'
                  }`}>
                    <Phone size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#191c1e]">{selectedConv.callbackRequest.phoneNumber}</p>
                    <p className="text-[10px] font-bold text-[#3d4945]/50 uppercase tracking-widest">
                      {selectedConv.callbackRequest.preferredTime} · {selectedConv.callbackRequest.isHandled ? 'Afgehandeld' : 'Wacht op terugbel'}
                    </p>
                  </div>
                </div>
                {!selectedConv.callbackRequest.isHandled && onMarkCallbackHandled && (
                  <button
                    onClick={() => {
                      onMarkCallbackHandled(selectedConv.id);
                      setSelectedConv(prev => prev ? {
                        ...prev,
                        callbackRequest: prev.callbackRequest ? { ...prev.callbackRequest, isHandled: true } : undefined
                      } : null);
                    }}
                    className="px-4 py-2 text-white rounded-full text-xs font-black active:scale-95 transition-all"
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

      {/* ── Tijdlijn modal ── */}
      {timelinePkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(25,28,30,0.60)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="font-black text-[#191c1e]">Statushistorie</h3>
                <p className="text-sm text-[#3d4945]/50 mt-0.5">
                  {timelinePkg.address.street} {timelinePkg.address.houseNumber}
                </p>
              </div>
              <button onClick={() => setTimelinePkg(null)} className="text-[#3d4945]/40 hover:text-[#3d4945] p-1">
                <X size={20} />
              </button>
            </div>
            <div className="relative">
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-[#bccac4]/30" />
              <div className="space-y-4">
                {(timelinePkg.statusHistory ?? [{ status: timelinePkg.status, timestamp: timelinePkg.createdAt }]).map((event, i, arr) => (
                  <div key={i} className="flex items-start gap-4 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 text-sm border-2 border-white shadow-sm ${
                      i === arr.length - 1 ? 'text-white' : 'bg-[#f2f4f6] text-[#3d4945]/50'
                    }`}
                      style={i === arr.length - 1 ? { background: 'linear-gradient(135deg, #006b5a, #48c2a9)' } : {}}>
                      {getStatusIcon(event.status)}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-[#191c1e]">{event.status}</span>
                        <span className="text-xs text-[#3d4945]/40 font-bold whitespace-nowrap">
                          {new Date(event.timestamp).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {event.note && (
                        <p className="text-xs text-[#3d4945]/50 mt-0.5 bg-[#f7f9fb] rounded-xl px-2 py-1">{event.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ChatBot */}
      <ChatBot
        packages={packages.filter(p => p.pharmacyName === pharmacyName)}
        pharmacyName={pharmacyName}
      />

      {showExport && (
        <ExportModal
          packages={packages}
          pharmacies={[{ id: pharmacyId ?? '', name: pharmacyName }]}
          pharmacyId={pharmacyId}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
};

export default PharmacyView;
