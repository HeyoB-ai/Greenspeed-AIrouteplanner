import React, { useState, useMemo } from 'react';
import { Package as PackageType, PackageStatus, ChatConversation } from '../types';
import {
  Package, Truck, CheckCircle2, AlertTriangle, Download, Scan,
  ArrowRight, Map, Loader2, ListChecks, MousePointerClick, UserPlus,
  MapPin, Building2, RefreshCw, MessageCircle, Phone, ArrowLeft, ChevronRight
} from 'lucide-react';
import ChatBot from './ChatBot';

interface Props {
  packages: PackageType[];
  pharmacyName: string;
  onScanStart: () => void;
  onManualAdd?: () => void;
  onOptimize: (selectedIds: string[]) => void;
  isOptimizing: boolean;
  conversations?: ChatConversation[];
  onMarkConversationRead?: (id: string) => void;
  onMarkCallbackHandled?: (id: string) => void;
}

const STATUS_STYLE: Record<string, string> = {
  [PackageStatus.SCANNING]:  'bg-blue-50 text-blue-600',
  [PackageStatus.PENDING]:   'bg-amber-100 text-amber-700',
  [PackageStatus.ASSIGNED]:  'bg-indigo-100 text-indigo-700',
  [PackageStatus.PICKED_UP]: 'bg-indigo-100 text-indigo-700',
  [PackageStatus.DELIVERED]: 'bg-emerald-100 text-emerald-700',
  [PackageStatus.MAILBOX]:   'bg-emerald-100 text-emerald-700',
  [PackageStatus.NEIGHBOUR]: 'bg-blue-100 text-blue-700',
  [PackageStatus.RETURN]:    'bg-amber-100 text-amber-700',
  [PackageStatus.FAILED]:    'bg-red-100 text-red-600',
  [PackageStatus.BILLED]:    'bg-purple-100 text-purple-700',
};

const AdminView: React.FC<Props> = ({
  packages, pharmacyName, onScanStart, onManualAdd, onOptimize, isOptimizing,
  conversations = [], onMarkConversationRead, onMarkCallbackHandled,
}) => {
  const [selectedIds, setSelectedIds]   = useState<string[]>([]);
  const [activeTab, setActiveTab]       = useState<'packages' | 'chats'>('packages');
  const [selectedConv, setSelectedConv] = useState<ChatConversation | null>(null);

  const unreadCount      = conversations.filter(c => !c.isRead).length;
  const pendingCallbacks = conversations.filter(c => c.callbackRequest && !c.callbackRequest.isHandled).length;

  const openConversation = (conv: ChatConversation) => {
    setSelectedConv(conv);
    if (!conv.isRead && onMarkConversationRead) onMarkConversationRead(conv.id);
  };

  const today      = new Date().toDateString();
  const inTransit  = packages.filter(p => p.status === PackageStatus.ASSIGNED || p.status === PackageStatus.PICKED_UP);
  const delivered  = packages.filter(p => p.status === PackageStatus.DELIVERED);
  const failed     = packages.filter(p => p.status === PackageStatus.FAILED);
  const pending    = packages.filter(p => p.status === PackageStatus.PENDING);
  const todayPkgs  = packages.filter(p => new Date(p.createdAt).toDateString() === today);

  const stats = [
    { label: 'Vandaag',    val: todayPkgs.length,   icon: Package,       color: 'text-blue-600',    bg: 'bg-blue-50' },
    { label: 'In transit', val: inTransit.length,   icon: Truck,         color: 'text-indigo-600',  bg: 'bg-indigo-50' },
    { label: 'Afgeleverd', val: delivered.length,   icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Mislukt',    val: failed.length,       icon: AlertTriangle, color: 'text-red-500',     bg: 'bg-red-50' },
  ];

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const selectAll = () =>
    setSelectedIds(selectedIds.length === pending.length ? [] : pending.map(p => p.id));

  const sorted = useMemo(() =>
    [...packages].sort((a, b) => {
      if (a.orderIndex !== undefined && b.orderIndex !== undefined) return a.orderIndex - b.orderIndex;
      if (a.orderIndex !== undefined) return -1;
      if (b.orderIndex !== undefined) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }),
    [packages]
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

  const handleAddCourier = () => {
    const name = prompt('Naam van de nieuwe koerier:');
    if (name) alert(`Koerier "${name}" aangemaakt (demo).`);
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Acties */}
          <div className="lg:col-span-1 space-y-4">

            <div className="bg-blue-600 rounded-4xl p-7 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
              <div className="relative z-10">
                <div className="bg-white/20 w-10 h-10 rounded-xl flex items-center justify-center mb-4">
                  <Scan size={20} />
                </div>
                <h3 className="text-xl font-black mb-1">Nieuw pakket</h3>
                <p className="text-blue-100 text-xs mb-5 font-medium">Scan een label om een pakket toe te voegen.</p>
                <button
                  onClick={onScanStart}
                  className="w-full bg-white text-blue-600 h-12 rounded-2xl font-black text-sm flex items-center justify-center space-x-2 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  <span>Start Scanner</span>
                  <ArrowRight size={16} />
                </button>
                {onManualAdd && (
                  <button
                    onClick={onManualAdd}
                    className="w-full mt-3 text-blue-200 hover:text-white text-xs font-bold transition-colors text-center py-1"
                  >
                    ✏ Handmatig adres invoeren
                  </button>
                )}
              </div>
              <Package className="absolute -bottom-8 -right-8 w-36 h-36 text-white/10 rotate-12" />
            </div>

            {pending.length > 0 && (
              <div className="bg-indigo-900 rounded-4xl p-7 text-white shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <ListChecks size={22} />
                  <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-black">
                    {selectedIds.length} geselecteerd
                  </span>
                </div>
                <h3 className="text-lg font-black mb-1">Route plannen</h3>
                <p className="text-indigo-200 text-xs mb-5 font-medium">Selecteer adressen voor routeoptimalisatie.</p>
                <div className="space-y-2">
                  <button
                    onClick={selectAll}
                    className="w-full bg-indigo-800/50 text-indigo-100 h-11 rounded-xl font-bold text-xs hover:bg-indigo-800 border border-indigo-700 flex items-center justify-center space-x-2 transition-all"
                  >
                    <MousePointerClick size={14} />
                    <span>{selectedIds.length === pending.length ? 'Selectie wissen' : 'Selecteer alles'}</span>
                  </button>
                  <button
                    onClick={() => onOptimize(selectedIds)}
                    disabled={isOptimizing || selectedIds.length === 0}
                    className="w-full bg-indigo-500 text-white h-12 rounded-2xl font-black text-sm flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-400 transition-all"
                  >
                    {isOptimizing ? <Loader2 className="animate-spin" size={18} /> : <Map size={18} />}
                    <span>{isOptimizing ? 'Berekenen…' : 'Optimaliseer Route'}</span>
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-4xl p-5 space-y-2 shadow-sm">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-3">Beheer</h3>
              <button
                onClick={handleAddCourier}
                className="w-full flex items-center space-x-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl px-4 h-12 font-bold text-sm text-slate-700 transition-all active:scale-95"
              >
                <UserPlus size={17} className="text-indigo-500 shrink-0" />
                <span>Koerier toevoegen</span>
              </button>
              <button
                onClick={exportCSV}
                className="w-full flex items-center space-x-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl px-4 h-12 font-bold text-sm text-slate-700 transition-all active:scale-95"
              >
                <Download size={17} className="text-emerald-500 shrink-0" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Pakkettenlijst / Chats */}
          <div className="lg:col-span-2">
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
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <h3 className="text-base lg:text-lg font-black text-slate-900">Zendingen</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      {packages.length} totaal &bull; {pending.length} wachten
                    </p>
                  </div>
                  {pending.length > 0 && (
                    <button onClick={selectAll} className="text-[10px] font-black text-blue-600 uppercase tracking-tighter hover:underline">
                      {selectedIds.length === pending.length ? 'Deselecteer alles' : 'Alles selecteren'}
                    </button>
                  )}
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

              {/* ── Packages tab ── */}
              {activeTab === 'packages' && (
                packages.length === 0 ? (
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
                            <tr
                              key={p.id}
                              onClick={() => p.status === PackageStatus.PENDING && toggleSelect(p.id)}
                              className={`cursor-pointer hover:bg-slate-50 transition-colors ${
                                selectedIds.includes(p.id) ? 'bg-blue-50/60' : ''
                              }`}
                            >
                              <td className="px-4 py-3">
                                {p.displayIndex ? (
                                  <div className="w-7 h-7 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-xs">{p.displayIndex}</div>
                                ) : p.status === PackageStatus.SCANNING ? (
                                  <RefreshCw className="animate-spin text-blue-400" size={16} />
                                ) : p.status === PackageStatus.PENDING ? (
                                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                                    selectedIds.includes(p.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                                  }`}>
                                    {selectedIds.includes(p.id) && <CheckCircle2 size={12} className="text-white" />}
                                  </div>
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
                        <div
                          key={p.id}
                          onClick={() => p.status === PackageStatus.PENDING && toggleSelect(p.id)}
                          className={`px-4 py-4 flex items-center justify-between cursor-pointer transition-colors ${
                            selectedIds.includes(p.id) ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            {p.displayIndex ? (
                              <div className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-sm shrink-0">{p.displayIndex}</div>
                            ) : p.status === PackageStatus.SCANNING ? (
                              <RefreshCw className="animate-spin text-blue-400 shrink-0" size={20} />
                            ) : (
                              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${
                                selectedIds.includes(p.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                              }`}>
                                {selectedIds.includes(p.id) && <CheckCircle2 size={13} />}
                              </div>
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
