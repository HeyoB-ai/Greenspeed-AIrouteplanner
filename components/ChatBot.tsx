
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, Loader2 } from 'lucide-react';
import { Package as PackageType } from '../types';

interface Props {
  packages: PackageType[];
  pharmacyName: string;
}

const MODEL = 'gemini-2.5-flash';

async function askPharmacyAssistant(question: string, packages: PackageType[], pharmacyName: string): Promise<string> {
  const context = JSON.stringify(packages.map(p => ({
    id: p.id,
    adres: `${p.address.street} ${p.address.houseNumber}, ${p.address.postalCode} ${p.address.city}`,
    status: p.status,
    aangemaakt: p.createdAt,
    bezorgd: p.deliveredAt ?? null,
  })));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        systemInstruction: {
          parts: [{
            text: `Je bent een behulpzame assistent voor apotheek ${pharmacyName}. Je hebt toegang tot de volgende lijst met zendingen:\n${context}\n\nBeantwoord vragen van de apotheekmedewerker over deze zendingen. Wees kort, zakelijk en behulpzaam. Gebruik alleen de data hierboven. Als een zending niet wordt gevonden, geef dat aan.`,
          }],
        },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let errMsg = `Proxy error ${response.status}`;
      try { const d = await response.json(); errMsg = d?.error?.message || d?.error || errMsg; } catch {}
      throw new Error(errMsg);
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Geen antwoord ontvangen.';
  } finally {
    clearTimeout(timeoutId);
  }
}

const ChatBot: React.FC<Props> = ({ packages, pharmacyName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string }[]>([
    { role: 'bot', text: `Hallo! Ik ben de Apotheek Assistent voor ${pharmacyName}. Stel gerust vragen over zendingen of het archief.` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const reply = await askPharmacyAssistant(userMessage, packages, pharmacyName);
      setMessages(prev => [...prev, { role: 'bot', text: reply }]);
    } catch (error) {
      console.error('Apotheek Assistent fout:', error);
      setMessages(prev => [...prev, { role: 'bot', text: 'Er is een fout opgetreden. Probeer het opnieuw.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 text-white rounded-2xl shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
        style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
      >
        <MessageSquare size={28} />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[500px] bg-white rounded-4xl flex flex-col z-50 animate-in slide-in-from-bottom-4 duration-300"
          style={{ boxShadow: '0 24px 64px rgba(25,28,30,0.16)' }}>
          {/* Header */}
          <div className="p-4 flex items-center justify-between rounded-t-4xl text-white"
            style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}>
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Bot size={20} />
              </div>
              <div>
                <p className="text-xs font-display font-black uppercase tracking-tighter">Apotheek Assistent</p>
                <p className="text-[10px] font-body font-bold opacity-80 uppercase">Stel vragen over zendingen en het archief</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-lg transition-all">
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f7f9fb]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-xs font-body font-medium leading-relaxed ${
                  m.role === 'user'
                    ? 'text-white rounded-tr-none'
                    : 'bg-white text-[#191c1e] rounded-tl-none shadow-sm'
                }`}
                  style={m.role === 'user' ? { background: 'linear-gradient(135deg, #006b5a, #48c2a9)' } : {}}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-tl-none flex items-center space-x-2 shadow-sm">
                  <Loader2 size={14} className="animate-spin text-[#006b5a]" />
                  <span className="text-[10px] font-display font-black text-[#3d4945]/50 uppercase">Aan het typen...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 border-t border-[#bccac4]/20 bg-white rounded-b-4xl">
            <div className="relative">
              <input
                type="text"
                placeholder="Stel een vraag..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full bg-[#f7f9fb] rounded-xl px-4 py-3 pr-12 text-xs font-body font-bold text-[#191c1e] focus:outline-none transition-all"
                style={{ boxShadow: '0 0 0 1px rgba(188,202,196,0.3)' }}
                onFocus={e => e.currentTarget.style.boxShadow = '0 0 0 2px #006b5a40'}
                onBlur={e => e.currentTarget.style.boxShadow = '0 0 0 1px rgba(188,202,196,0.3)'}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 text-white rounded-lg flex items-center justify-center disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #006b5a, #48c2a9)' }}
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatBot;
