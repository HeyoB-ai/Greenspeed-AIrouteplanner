import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { getMyShifts, RosterShift } from '../services/rosterService';

interface Props {
  /** Niet nodig als tab, wel handig als het rooster ooit als los scherm opent. */
  onClose?: () => void;
}

const DAY_NAMES   = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const MONTH_NAMES = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

const TYPE_LABELS: Record<RosterShift['shiftType'], string> = {
  regular:         'Regulier',
  institution:     'Instelling',
  other_transport: 'Overig transport',
  urgent:          'Spoed',
};

const TYPE_STYLES: Record<RosterShift['shiftType'], string> = {
  regular:         'bg-blue-100 text-blue-800 border-blue-300',
  institution:     'bg-purple-100 text-purple-800 border-purple-300',
  other_transport: 'bg-amber-100 text-amber-800 border-amber-300',
  urgent:          'bg-red-100 text-red-800 border-red-300',
};

// Lokale datum als 'YYYY-MM-DD' — niet via toISOString(), die schuift naar UTC.
const toISODate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Maandag van de week waarin `d` valt (zondag telt als laatste dag).
const mondayOf = (d: Date): Date => {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const weekday = (copy.getDay() + 6) % 7; // ma = 0 … zo = 6
  copy.setDate(copy.getDate() - weekday);
  return copy;
};

const addDays = (d: Date, days: number): Date => {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
};

const shortDate = (d: Date): string =>
  `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]}`;

const CourierRooster: React.FC<Props> = ({ onClose }) => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [shifts, setShifts]   = useState<RosterShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const todayISO = toISODate(new Date());
  const weekStart = addDays(mondayOf(new Date()), weekOffset * 7);
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd   = weekDays[6];

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const rows = await getMyShifts(toISODate(weekStart), toISODate(weekEnd));
        if (!cancelled) setShifts(rows);
      } catch (e: any) {
        if (!cancelled) {
          setShifts([]);
          setError(e?.message ?? 'Rooster kon niet geladen worden.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [weekOffset]);

  const weekLabel =
    weekOffset === 0  ? 'Deze week'
    : weekOffset === -1 ? 'Vorige week'
    : weekOffset === 1  ? 'Volgende week'
    : `Ma ${shortDate(weekStart)} – zo ${shortDate(weekEnd)} ${weekEnd.getFullYear()}`;

  return (
    <div className="p-4 space-y-4">
      {/* Weeknavigatie */}
      <div className="flex items-center justify-between bg-white rounded-lg border border-slate-200 p-2">
        <button
          onClick={() => setWeekOffset(w => w - 1)}
          className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
          aria-label="Vorige week"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-800">{weekLabel}</div>
          <div className="text-xs text-slate-500">
            {shortDate(weekStart)} – {shortDate(weekEnd)} {weekEnd.getFullYear()}
          </div>
        </div>
        <button
          onClick={() => setWeekOffset(w => w + 1)}
          className="p-2 rounded-md text-slate-600 hover:bg-slate-100"
          aria-label="Volgende week"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-500">Laden…</div>
      ) : (
        <div className="space-y-2">
          {weekDays.map(day => {
            const iso       = toISODate(day);
            const isToday   = iso === todayISO;
            const isPast    = iso < todayISO;
            const dayShifts = shifts.filter(s => s.shiftDate === iso);

            return (
              <div
                key={iso}
                className={`rounded-lg border bg-white p-3 ${isPast ? 'opacity-50' : ''} ${
                  isToday ? 'border-[#006b5a]' : 'border-slate-200'
                }`}
              >
                <div className={`mb-2 text-sm font-semibold ${isToday ? 'text-[#006b5a]' : 'text-slate-700'}`}>
                  {DAY_NAMES[(day.getDay() + 6) % 7]} {shortDate(day)}
                  {isToday && <span className="ml-2 text-xs font-medium">Vandaag</span>}
                </div>

                {dayShifts.length === 0 ? (
                  <div className="text-sm text-slate-400">Geen dienst</div>
                ) : (
                  <div className="space-y-2">
                    {dayShifts.map(s => (
                      <div key={s.id} className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-sm font-semibold ${isToday ? 'text-[#006b5a]' : 'text-slate-800'}`}>
                            {s.endTime ? `${s.startTime}–${s.endTime}` : s.startTime}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[s.shiftType]}`}>
                            {TYPE_LABELS[s.shiftType] ?? s.shiftType}
                          </span>
                        </div>
                        {s.pharmacyNames.length > 0 && (
                          <div className="mt-1 text-sm text-slate-700">{s.pharmacyNames.join(', ')}</div>
                        )}
                        {s.description && (
                          <div className="mt-1 text-xs text-slate-500">{s.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {onClose && (
        <button
          onClick={onClose}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <CalendarDays size={16} />
          Terug naar bezorgen
        </button>
      )}
    </div>
  );
};

export default CourierRooster;
