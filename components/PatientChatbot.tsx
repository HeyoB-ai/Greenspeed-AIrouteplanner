import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck, X, Send, Phone, AlertTriangle, Check, Loader2, MessageCircle
} from 'lucide-react';
import { ChatConversation, ChatMessage, CallbackRequest } from '../types';
import { answerPatientQuestion } from '../services/geminiService';
import { db } from '../services/supabaseService';

interface Props {
  pharmacyId:   string;
  pharmacyName: string;
  onClose:      () => void;
}

const TIMES = ['Zo snel mogelijk', 'Vanochtend', 'Vanmiddag', 'Morgenochtend'];

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const makeConversation = (pharmacyId: string): ChatConversation => {
  const now = new Date();
  const exp = new Date(now);
  exp.setDate(exp.getDate() + 30);
  return {
    id:            makeId(),
    createdAt:     now.toISOString(),
    expiresAt:     exp.toISOString(),
    pharmacyId,
    messages:      [],
    hasRiskSignal: false,
    isRead:        false,
  };
};

const PatientChatbot: React.FC<Props> = ({ pharmacyId, pharmacyName, onClose }) => {
  const [consentChecked, setConsentChecked] = useState(false);
  const [isConsented, setIsConsented]       = useState(false);

  const [conversation, setConversation] = useState<ChatConversation>(() => makeConversation(pharmacyId));
  const [input, setInput]               = useState('');
  const [isLoading, setIsLoading]       = useState(false);

  const [showCallbackForm, setShowCallbackForm] = useState(false);
  const [phoneNumber, setPhoneNumber]           = useState('');
  const [preferredTime, setPreferredTime]       = useState('');
  const [callbackDone, setCallbackDone]         = useState(false);
  const [callbackConfirm, setCallbackConfirm]   = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  useEffect(() => {
    if (isConsented) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isConsented]);

  const saveConv = useCallback((conv: ChatConversation) => {
    db.saveConversation(conv).catch(() => {});
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');

    const userMsg: ChatMessage = {
      id:        makeId(),
      role:      'user',
      text,
      timestamp: new Date().toISOString(),
    };

    const next = { ...conversation, messages: [...conversation.messages, userMsg] };
    setConversation(next);
    setIsLoading(true);

    try {
      const { text: reply, hasRisk } = await answerPatientQuestion(text, conversation.messages, pharmacyName);

      const assistantMsg: ChatMessage = {
        id:        makeId(),
        role:      'assistant',
        text:      reply,
        timestamp: new Date().toISOString(),
      };

      const final = {
        ...next,
        messages:      [...next.messages, assistantMsg],
        hasRiskSignal: next.hasRiskSignal || hasRisk,
        isRead:        false,
      };
      setConversation(final);
      saveConv(final);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCallbackSubmit = () => {
    if (!phoneNumber.trim() || !preferredTime) return;
    const cb: CallbackRequest = {
      phoneNumber:   phoneNumber.trim(),
      preferredTime,
      requestedAt:   new Date().toISOString(),
      isHandled:     false,
    };
    const updated = { ...conversation, callbackRequest: cb, isRead: false };
    setConversation(updated);
    saveConv(updated);
    setCallbackDone(true);
    setCallbackConfirm(true);
    setShowCallbackForm(false);
    setTimeout(() => setCallbackConfirm(false), 4000);
  };

  // ── Toestemmingsscherm ──────────────────────────────────────────────
  if (!isConsented) {
    return (
      <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center p-4"
        style={{ background: 'rgba(25,28,30,0.60)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div className="w-full max-w-md bg-white rounded-3xl p-6 animate-in slide-in-from-bottom duration-300"
          style={{ boxShadow: '0 24px 64px rgba(25,28,30,0.20)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-[#48c2a9]/15 rounded-full flex items-center justify-center text-[#006b5a]">
              <ShieldCheck size={24} />
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-[#f2f4f6] rounded-xl flex items-center justify-center text-[#3d4945] transition-colors">
              <X size={16} />
            </button>
          </div>

          <h2 className="text-lg font-display font-black text-[#191c1e] mb-2">Voordat u begint</h2>

          <div className="space-y-3 text-sm font-body text-[#3d4945] leading-relaxed mb-6">
            <p>
              Deze assistent geeft <strong>alleen algemene informatie</strong> over medicijnen,
              vergelijkbaar met een bijsluiter. Hij vervangt nooit uw apotheker of huisarts.
            </p>
            <p>
              Uw gesprek wordt bewaard zodat uw apotheker het kan inzien als u hulp nodig heeft.
              Gesprekken worden na 30 dagen automatisch verwijderd.
            </p>
            <p className="font-display font-black text-[#191c1e]">Bij een noodgeval: bel 112.</p>
          </div>

          <label className="flex items-start gap-3 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={e => setConsentChecked(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded shrink-0"
              style={{ accentColor: '#006b5a' }}
            />
            <span className="text-sm font-body text-[#3d4945]">
              Ik begrijp dat dit geen medisch advies is en ga akkoord met het bewaren van dit gesprek.
            </span>
          </label>

          <button
            onClick={() => setIsConsented(true)}
            disabled={!consentChecked}
            className="w-full h-12 text-white rounded-full font-display font-black text-sm disabled:opacity-40 transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
          >
            Starten
          </button>
        </div>
      </div>
    );
  }

  // ── Chat UI ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[9998] flex flex-col bg-[#f7f9fb] animate-in fade-in duration-200">

      {/* Header */}
      <div className="bg-white border-b border-[#bccac4]/20 px-4 py-3 flex items-center space-x-3 shrink-0">
        <div className="w-9 h-9 bg-[#48c2a9]/15 rounded-xl flex items-center justify-center text-[#006b5a] shrink-0">
          <MessageCircle size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-display font-black text-[#191c1e] leading-none truncate">Apotheek Assistent</p>
          <p className="text-[10px] font-body font-bold text-[#3d4945]/50 uppercase tracking-widest mt-0.5 truncate">{pharmacyName}</p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 bg-[#f2f4f6] rounded-xl flex items-center justify-center text-[#3d4945] active:scale-90 transition-all shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* Berichten */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {conversation.messages.length === 0 && (
          <div className="max-w-xs bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
            <p className="text-sm font-body text-[#3d4945] leading-relaxed">
              Hallo! Ik ben de assistent van {pharmacyName}. Ik beantwoord graag uw vragen over medicijnen.
              Waarmee kan ik u helpen?
            </p>
          </div>
        )}

        {conversation.messages.map(msg => (
          <div key={msg.id} className={`flex w-full overflow-hidden ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] overflow-hidden px-4 py-3 rounded-2xl text-sm font-body leading-relaxed ${
              msg.role === 'user'
                ? 'text-white rounded-tr-sm'
                : 'bg-white text-[#191c1e] rounded-tl-sm shadow-sm'
            }`}
              style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #006b5a, #48c2a9)' } : {}}
            >
              {msg.text.split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? 'mt-1' : ''}>
                  {line.replace(/\*\*(.*?)\*\*/g, '$1')}
                </p>
              ))}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <Loader2 size={16} className="text-[#3d4945]/40 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Risico-banner */}
      {conversation.hasRiskSignal && (
        <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-2xl flex items-start space-x-2">
          <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
          <p className="text-xs font-body font-bold text-red-700 leading-relaxed">
            Bij een noodgeval: bel <strong>112</strong>. Voor de Zelfmoordpreventielijn: bel <strong>113</strong>.
          </p>
        </div>
      )}

      {/* Terugbel-bevestiging */}
      {callbackConfirm && (
        <div className="mx-4 mb-2 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 animate-in slide-in-from-bottom duration-200">
          <Check size={16} className="text-emerald-600 shrink-0" />
          <p className="text-xs font-body font-bold text-emerald-700">
            Verzoek ontvangen — wij bellen u zo snel mogelijk op <strong>{phoneNumber}</strong>.
          </p>
        </div>
      )}

      {/* Terugbel-banner */}
      {!callbackDone && conversation.messages.length > 0 && (
        <div className="mx-4 mb-2 p-3 bg-[#48c2a9]/10 border border-[#48c2a9]/20 rounded-2xl">
          <p className="text-xs font-body font-bold text-[#006b5a] mb-2">
            Liever een apotheker spreken?
          </p>
          <button
            onClick={() => setShowCallbackForm(true)}
            className="w-full h-10 text-white rounded-full font-display font-bold text-sm active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #253046, #3a4a6b)' }}
          >
            Bel mij terug
          </button>
        </div>
      )}

      {/* Input */}
      <div
        className="bg-white border-t border-[#bccac4]/20 px-4 pt-3 pb-4 flex gap-3 shrink-0"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Stel uw vraag..."
          disabled={isLoading}
          className="flex-1 min-w-0 bg-[#f7f9fb] rounded-2xl px-4 h-12 text-sm font-body font-bold text-[#191c1e] focus:outline-none transition-all disabled:opacity-50"
          style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.3)' }}
          onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
          onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.3)'}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          className="w-12 h-12 text-white rounded-full flex items-center justify-center active:scale-90 disabled:opacity-40 transition-all shrink-0"
          style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
        >
          <Send size={18} />
        </button>
      </div>

      {/* Terugbelformulier */}
      {showCallbackForm && (
        <div className="absolute inset-0 bg-white rounded-3xl z-10 p-6 flex flex-col animate-in fade-in duration-200">
          <button
            onClick={() => setShowCallbackForm(false)}
            className="self-end w-8 h-8 bg-[#f2f4f6] rounded-xl flex items-center justify-center text-[#3d4945] mb-4"
          >
            <X size={16} />
          </button>

          <div className="flex items-center space-x-3 mb-5">
            <div className="w-10 h-10 bg-[#48c2a9]/15 rounded-full flex items-center justify-center text-[#006b5a] shrink-0">
              <Phone size={18} />
            </div>
            <div>
              <h3 className="text-lg font-display font-black text-[#191c1e] leading-none">Terugbelverzoek</h3>
              <p className="text-xs font-body text-[#3d4945]/50 mt-0.5">Een apotheker belt u zo snel mogelijk terug</p>
            </div>
          </div>

          <div className="space-y-4 flex-1">
            <div>
              <label className="text-xs font-display font-black uppercase tracking-widest text-[#3d4945]/60 mb-1.5 block">
                Uw telefoonnummer
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="06 12 34 56 78"
                className="w-full h-12 px-4 rounded-2xl text-sm font-body font-bold text-[#191c1e] focus:outline-none transition-all"
                style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.3)' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
                onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.3)'}
              />
            </div>

            <div>
              <label className="text-xs font-display font-black uppercase tracking-widest text-[#3d4945]/60 mb-2 block">
                Wanneer schikt het?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TIMES.map(time => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setPreferredTime(time)}
                    className={`h-11 rounded-2xl text-sm font-display font-black transition-all active:scale-95 ${
                      preferredTime === time
                        ? 'text-white'
                        : 'bg-[#f2f4f6] text-[#3d4945]/60 hover:bg-[#e8eceb]'
                    }`}
                    style={preferredTime === time ? { background: 'linear-gradient(135deg, #006b5a, #48c2a9)' } : {}}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={handleCallbackSubmit}
            disabled={!phoneNumber.trim() || !preferredTime}
            className="w-full h-12 text-white rounded-full font-display font-black text-sm mt-6 disabled:opacity-40 active:scale-95 transition-all"
            style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
          >
            Verzoek versturen
          </button>
        </div>
      )}
    </div>
  );
};

export default PatientChatbot;
