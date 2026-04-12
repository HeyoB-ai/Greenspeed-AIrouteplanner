import React, { useState, useMemo } from 'react';
import {
  Package, MapPin,
  RefreshCw, Truck, ShieldCheck, Clock,
  MessageCircle, Phone, AlertTriangle, ArrowLeft, ChevronRight, X
} from 'lucide-react';
import { Package as PackageType, PackageStatus, ChatConversation } from '../types';
import ChatBot from './ChatBot';

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
  [PackageStatus.SCANNING]:        { className: 'bg-blue-50 text-blue-600',       label: 'Analyseren'     },
  [PackageStatus.PENDING]:         { className: 'bg-amber-100 text-amber-700',    label: 'Wachten'        },
  [PackageStatus.ASSIGNED]:        { className: 'bg-indigo-100 text-indigo-700',  label: 'Toegewezen'     },
  [PackageStatus.PICKED_UP]:       { className: 'bg-indigo-100 text-indigo-700',  label: 'Opgehaald'      },
  [PackageStatus.DELIVERED]:       { className: 'bg-emerald-100 text-emerald-700',label: 'Bezorgd'        },
  [PackageStatus.MAILBOX]:         { className: 'bg-emerald-100 text-emerald-700',label: 'Brievenbus'     },
  [PackageStatus.NEIGHBOUR]:       { className: 'bg-blue-100 text-blue-700',      label: 'Bij buren'      },
  [PackageStatus.RETURN]:          { className: 'bg-amber-100 text-amber-700',    label: 'Retour'         },
  [PackageStatus.FAILED]:          { className: 'bg-red-100 text-red-600',        label: 'Mislukt'        },
  [PackageStatus.BILLED]:          { className: 'bg-purple-100 text-purple-700',  label: 'Gefactureerd'   },
  [PackageStatus.MOVED]:           { className: 'bg-purple-100 text-purple-700',  label: 'Verhuisd'       },
  [PackageStatus.OTHER_LOCATION]:  { className: 'bg-sky-100 text-sky-700',        label: 'Andere locatie' },
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

  const unreadCount      = conversations.filter(c => !c.isRead).length;
  const pendingCallbacks = conversations.filter(c => c.callbackRequest && !c.callbackRequest.isHandled).length;

  const openConversation = (conv: ChatConversation) => {
    setSelectedConv(conv);
    if (!conv.isRead && onMarkConversationRead) onMarkConversationRead(conv.id);
  };

  const activeCouriers = useMemo(() => {
    const map = new Map<string, string>();
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
    { label: 'Totaal',     val: packages.length,                                                                                              icon: Package,     color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: 'In transit', val: packages.filter(p => p.status === PackageStatus.ASSIGNED || p.status === PackageStatus.PICKED_UP).length,     icon: Truck,       color: 'text-indigo-600',  bg: 'bg-indigo-50' },
    { label: 'Bezorgd',    val: packages.filter(p => p.status === PackageStatus.DELIVERED).length,                                            icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Wachten',    val: pendingPackages.length,                                                                                       icon: Clock,       color: 'text-amber-600',   bg: 'bg-amber-50' },
  ];

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-6">

      {/* ── Stats rij ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
            <div className={`w-10 h-10 ${s.bg} ${s.color} rounded-xl flex items-center justify-center mb-3`}>
              <s.icon size={20} />
            </div>
            <p className="text-2xl font-black text-slate-900 leading-none">{s.val}</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Scan actief indicator ── */}
      {activeScansCount > 0 && (
        <div className="bg-slate-900 rounded-3xl p-5 text-white border border-blue-500/30 flex items-center space-x-4">
          <RefreshCw className="animate-spin text-blue-400 shrink-0" size={22} />
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
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wide transition-all border ${
                  activeCourier === tab.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 text-[10px] ${activeCourier === tab.id ? 'text-blue-200' : 'text-slate-400'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        );
      })()}

      {/* ── Pakkettenlijst / Chats ── */}
      <div className="w-full">
          <div className="bg-white border border-slate-200 rounded-4xl shadow-sm overflow-hidden flex flex-col h-full">
            {/* Tab headers */}
            <div className="px-6 pt-5 pb-0 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-end space-x-1 mb-0">
                <button
                  onClick={() => setActiveTab('packages')}
                  className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest rounded-t-xl transition-all ${
                    activeTab === 'packages'
                      ? 'bg-white border border-b-white border-slate-200 text-slate-900 -mb-px z-10'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Zendingen
                </button>
                <button
                  onClick={() => setActiveTab('chats')}
                  className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest rounded-t-xl transition-all flex items-center space-x-1.5 ${
                    activeTab === 'chats'
                      ? 'bg-white border border-b-white border-slate-200 text-slate-900 -mb-px z-10'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <MessageCircle size={12} />
                  <span>Chats</span>
                  {(unreadCount > 0 || pendingCallbacks > 0) && (
                    <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none">
                      {unreadCount + pendingCallbacks}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {activeTab === 'packages' && (
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900 lg:text-xl">Zendingen</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {pendingPackages.length} WACHTEN OP PLANNING
                </p>
              </div>
            )}

            {activeTab === 'chats' && (
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900 lg:text-xl">Patiëntgesprekken</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  {conversations.length} gesprekken · {unreadCount} ongelezen
                </p>
              </div>
            )}

            {/* ── Packages tab content ── */}
            {activeTab === 'packages' && (
              sorted.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Package className="text-slate-200" size={32} />
                  </div>
                  <p className="text-slate-900 font-black">Geen pakketten</p>
                  <p className="text-slate-400 text-sm font-medium mt-1">Gebruik de scanner om zendingen toe te voegen.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden m-4">
                  {/* Lijstheader */}
                  <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200">
                    <div className="w-7 shrink-0" />
                    <p className="flex-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Adres</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Status</p>
                  </div>
                  {/* Rijen */}
                  {sorted.map(p => (
                    <div key={p.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 cursor-default">
                      {p.status === PackageStatus.SCANNING ? (
                        <div className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                          <RefreshCw size={12} className="text-blue-400 animate-spin" />
                        </div>
                      ) : p.scanNumber ? (
                        <div className="w-7 h-7 bg-slate-900 text-white rounded-xl flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                          {p.scanNumber}
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin size={12} className="text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-slate-900 text-sm truncate">
                            {p.address.street} {p.address.houseNumber}
                          </p>
                          {p.routeIndex && (
                            <span className="shrink-0 bg-blue-100 text-blue-600 text-[9px] font-black px-1.5 py-0.5 rounded-md" title={`Stop ${p.routeIndex} in de route`}>
                              →{p.routeIndex}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {p.address.postalCode} {p.address.city}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge status={p.status} />
                        <div className="flex items-center gap-2">
                          {p.statusHistory && p.statusHistory.length > 0 && (
                            <span className="text-[11px] text-slate-400 font-bold">
                              {new Date(p.statusHistory[p.statusHistory.length - 1].timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          <button
                            onClick={() => setTimelinePkg(p)}
                            className="text-[11px] text-blue-500 hover:text-blue-700 font-bold flex items-center gap-0.5 transition-colors"
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
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <MessageCircle className="text-slate-200" size={32} />
                  </div>
                  <p className="text-slate-900 font-black">Geen gesprekken</p>
                  <p className="text-slate-400 text-sm font-medium mt-1">Patiëntgesprekken verschijnen hier.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
                  {conversations.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => openConversation(conv)}
                      className={`w-full px-4 py-4 flex items-start space-x-3 text-left transition-colors hover:bg-slate-50 border-l-4 ${
                        conv.hasRiskSignal
                          ? 'border-red-400 bg-red-50/40'
                          : !conv.isRead
                          ? 'border-blue-500'
                          : 'border-transparent'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        conv.hasRiskSignal ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {conv.hasRiskSignal ? <AlertTriangle size={16} /> : <MessageCircle size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {new Date(conv.createdAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                          </span>
                          {!conv.isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {conv.messages.length > 0
                            ? conv.messages[conv.messages.length - 1].text
                            : 'Leeg gesprek'}
                        </p>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className="text-[10px] font-bold text-slate-400">
                            {conv.messages.length} berichten
                          </span>
                          {conv.callbackRequest && (
                            <span className={`flex items-center space-x-1 text-[10px] font-black ${
                              conv.callbackRequest.isHandled ? 'text-emerald-600' : 'text-blue-600'
                            }`}>
                              <Phone size={10} />
                              <span>{conv.callbackRequest.isHandled ? 'Afgehandeld' : conv.callbackRequest.phoneNumber}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300 shrink-0 mt-1" />
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
          <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center space-x-3 shrink-0">
            <button
              onClick={() => setSelectedConv(null)}
              className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 active:scale-90 transition-all shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-900 leading-none">Gesprek</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
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
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
            {selectedConv.messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
                }`}>
                  {msg.text.split('\n').map((line, i) => (
                    <p key={i} className={i > 0 ? 'mt-1' : ''}>{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
                  ))}
                  <p className={`text-[9px] mt-1.5 ${msg.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Callback section */}
          {selectedConv.callbackRequest && (
            <div className={`px-4 py-4 border-t ${selectedConv.callbackRequest.isHandled ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedConv.callbackRequest.isHandled ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    <Phone size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{selectedConv.callbackRequest.phoneNumber}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
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
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black active:scale-95 transition-all"
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
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="font-black text-slate-900">Statushistorie</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {timelinePkg.address.street} {timelinePkg.address.houseNumber}
                </p>
              </div>
              <button onClick={() => setTimelinePkg(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="relative">
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200" />
              <div className="space-y-4">
                {(timelinePkg.statusHistory ?? [{ status: timelinePkg.status, timestamp: timelinePkg.createdAt }]).map((event, i, arr) => (
                  <div key={i} className="flex items-start gap-4 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 text-sm border-2 border-white shadow-sm ${
                      i === arr.length - 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {getStatusIcon(event.status)}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black text-slate-800">{event.status}</span>
                        <span className="text-xs text-slate-400 font-bold whitespace-nowrap">
                          {new Date(event.timestamp).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {event.note && (
                        <p className="text-xs text-slate-500 mt-0.5 bg-slate-50 rounded-xl px-2 py-1">{event.note}</p>
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
    </div>
  );
};

export default PharmacyView;
