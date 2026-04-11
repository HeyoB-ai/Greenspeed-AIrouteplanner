import React, { useState, useMemo } from 'react';
import { Package as PackageType, PackageStatus, ChatConversation } from '../types';
import {
  Package, Truck, CheckCircle2, AlertTriangle, Download,
  MapPin, RefreshCw, MessageCircle, Phone, ArrowLeft, ChevronRight, Archive
} from 'lucide-react';
import ChatBot from './ChatBot';
import ArchiveView from './ArchiveView';

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

const STATUS_STYLE: Record<string, string> = {
  [PackageStatus.SCANNING]:        'bg-blue-50 text-blue-600',
  [PackageStatus.PENDING]:         'bg-amber-100 text-amber-700',
  [PackageStatus.ASSIGNED]:        'bg-indigo-100 text-indigo-700',
  [PackageStatus.PICKED_UP]:       'bg-indigo-100 text-indigo-700',
  [PackageStatus.DELIVERED]:       'bg-emerald-100 text-emerald-700',
  [PackageStatus.MAILBOX]:         'bg-emerald-100 text-emerald-700',
  [PackageStatus.NEIGHBOUR]:       'bg-blue-100 text-blue-700',
  [PackageStatus.RETURN]:          'bg-amber-100 text-amber-700',
  [PackageStatus.FAILED]:          'bg-red-100 text-red-600',
  [PackageStatus.BILLED]:          'bg-purple-100 text-purple-700',
  [PackageStatus.MOVED]:           'bg-purple-100 text-purple-700',
  [PackageStatus.OTHER_LOCATION]:  'bg-sky-100 text-sky-700',
};

const AdminView: React.FC<Props> = ({
  packages, pharmacyName,
  conversations = [], onMarkConversationRead, onMarkCallbackHandled,
}) => {
  const [activeTab, setActiveTab]       = useState<'packages' | 'chats' | 'archive'>('packages');
  const [selectedConv, setSelectedConv] = useState<ChatConversation | null>(null);
  const [activeCourier, setActiveCourier] = useState<string>('all');

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
    { label: 'Vandaag',    val: todayPkgs.length,  icon: Package,       color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: 'In transit', val: inTransit.length,  icon: Truck,         color: 'text-indigo-600',  bg: 'bg-indigo-50' },
    { label: 'Afgeleverd', val: delivered.length,  icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Mislukt',    val: failed.length,     icon: AlertTriangle, color: 'text-red-500',     bg: 'bg-red-50' },
  ];

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

  const sorted = useMemo(() =>
    [...filteredPackages].sort((a, b) => {
      if (a.orderIndex !== undefined && b.orderIndex !== undefined) return a.orderIndex - b.orderIndex;
      if (a.orderIndex !== undefined) return -1;
      if (b.orderIndex !== undefined) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
    [filteredPackages]
  );

  const exportCSV = () => {
    const headers = ['ID', 'Adres', 'Huisnummer', 'Postcode', 'Stad', 'Status', 'Aangemaakt', 'Bezorgd'];
    const rows = packages.map(p => [
      p.id, p.address.street, p.address.houseNumber, p.address.postalCode,
      p.address.city, p.status, p.createdAt, p.deliveredAt || '',
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `${pharmacyName}_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-24 lg:pb-8">

        {/* Stats */}
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

        {/* Export knop */}
        <div className="flex justify-end">
          <button
            onClick={exportCSV}
            className="flex items-center space-x-2 bg-white border border-slate-200 rounded-2xl px-4 h-10 font-bold text-sm text-slate-700 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            <Download size={15} className="text-emerald-500 shrink-0" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Pakkettenlijst / Chats */}
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
                  <button
                    onClick={() => setActiveTab('archive')}
                    className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest rounded-t-xl transition-all flex items-center space-x-1.5 ${
                      activeTab === 'archive'
                        ? 'bg-white border border-b-white border-slate-200 text-slate-900 -mb-px z-10'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Archive size={12} />
                    <span>Archief</span>
                  </button>
                </div>
              </div>

              {activeTab === 'packages' && (
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-base lg:text-lg font-black text-slate-900">Zendingen</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    {packages.length} totaal
                  </p>
                </div>
              )}

              {activeTab === 'chats' && (
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-base lg:text-lg font-black text-slate-900">Patiëntgesprekken</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    {conversations.length} gesprekken · {unreadCount} ongelezen
                  </p>
                </div>
              )}

              {activeTab === 'archive' && (
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-base lg:text-lg font-black text-slate-900">Archief &amp; statistieken</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    Historische bezorgdata en trends
                  </p>
                </div>
              )}

              {/* ── Packages tab ── */}
              {activeTab === 'packages' && (activeCouriers.length > 0 || packages.some(p => !p.courierId)) && (
                <div className="px-6 py-3 border-b border-slate-100 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  <button
                    onClick={() => setActiveCourier('all')}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                      activeCourier === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    Alle ({packages.length})
                  </button>
                  {packages.some(p => !p.courierId) && (
                    <button
                      onClick={() => setActiveCourier('unassigned')}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                        activeCourier === 'unassigned'
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      Niet toegewezen ({packages.filter(p => !p.courierId).length})
                    </button>
                  )}
                  {activeCouriers.map(courier => (
                    <button
                      key={courier.id}
                      onClick={() => setActiveCourier(courier.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                        activeCourier === courier.id
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {courier.name} ({packages.filter(p => p.courierId === courier.id).length})
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'packages' && (
                filteredPackages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                    <Package className="text-slate-200 mb-4" size={40} />
                    <p className="text-slate-900 font-black">Geen pakketten</p>
                    <p className="text-slate-400 text-sm mt-1">Scan een label om te beginnen.</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop tabel */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/50">
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-8"></th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Adres</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {sorted.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3">
                                {p.displayIndex ? (
                                  <div className="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-xs">{p.displayIndex}</div>
                                ) : p.status === PackageStatus.SCANNING ? (
                                  <RefreshCw className="animate-spin text-blue-400" size={16} />
                                ) : (
                                  <MapPin size={14} className="text-slate-300" />
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-extrabold text-sm text-slate-900">{p.address.street} {p.address.houseNumber}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{p.address.postalCode} {p.address.city}</p>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${STATUS_STYLE[p.status] || 'bg-slate-100 text-slate-500'}`}>
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobiel: kaarten */}
                    <div className="lg:hidden divide-y divide-slate-100">
                      {sorted.map(p => (
                        <div key={p.id} className="px-4 py-4 flex items-center justify-between">
                          <div className="flex items-center space-x-3 min-w-0">
                            {p.displayIndex ? (
                              <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-sm shrink-0">{p.displayIndex}</div>
                            ) : p.status === PackageStatus.SCANNING ? (
                              <RefreshCw className="animate-spin text-blue-400 shrink-0" size={20} />
                            ) : (
                              <MapPin size={18} className="text-slate-300 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-extrabold text-sm text-slate-900 truncate">{p.address.street} {p.address.houseNumber}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{p.address.postalCode} {p.address.city}</p>
                            </div>
                          </div>
                          <span className={`ml-2 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 ${STATUS_STYLE[p.status] || 'bg-slate-100 text-slate-500'}`}>
                            {p.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              )}

              {/* ── Archive tab ── */}
              {activeTab === 'archive' && (
                <div className="p-6">
                  <ArchiveView packages={packages} pharmacyId={undefined} />
                </div>
              )}

              {/* ── Chats tab ── */}
              {activeTab === 'chats' && (
                conversations.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                    <MessageCircle className="text-slate-200 mb-4" size={40} />
                    <p className="text-slate-900 font-black">Geen gesprekken</p>
                    <p className="text-slate-400 text-sm mt-1">Patiëntgesprekken verschijnen hier.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
                    {conversations.map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => openConversation(conv)}
                        className={`w-full px-4 py-4 flex items-start space-x-3 text-left transition-colors hover:bg-slate-50 border-l-4 ${
                          conv.hasRiskSignal ? 'border-red-400 bg-red-50/40'
                          : !conv.isRead ? 'border-blue-500'
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
                            {!conv.isRead && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />}
                          </div>
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].text : 'Leeg gesprek'}
                          </p>
                          <div className="flex items-center space-x-3 mt-1">
                            <span className="text-[10px] font-bold text-slate-400">{conv.messages.length} berichten</span>
                            {conv.callbackRequest && (
                              <span className={`flex items-center space-x-1 text-[10px] font-black ${conv.callbackRequest.isHandled ? 'text-emerald-600' : 'text-blue-600'}`}>
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
      </div>

      {/* ── Conversation detail overlay ── */}
      {selectedConv && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-right duration-200">
          <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center space-x-3 shrink-0">
            <button onClick={() => setSelectedConv(null)} className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 active:scale-90 transition-all shrink-0">
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
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
            {selectedConv.messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
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
          {selectedConv.callbackRequest && (
            <div className={`px-4 py-4 border-t ${selectedConv.callbackRequest.isHandled ? 'bg-emerald-50 border-emerald-100' : 'bg-blue-50 border-blue-100'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selectedConv.callbackRequest.isHandled ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
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
                      setSelectedConv(prev => prev ? { ...prev, callbackRequest: prev.callbackRequest ? { ...prev.callbackRequest, isHandled: true } : undefined } : null);
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

      <ChatBot packages={packages} pharmacyName={pharmacyName} />
    </>
  );
};

export default AdminView;
