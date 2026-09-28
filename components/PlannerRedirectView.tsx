import React from 'react';
import { ArrowUpRight, CalendarDays } from 'lucide-react';

// ── De planner hoort hier niet ────────────────────────────────────────────
// De planning is een eigen app op planner.go-bob.nl, op dezelfde database. Wie
// met een planner-account op go-bob.nl inlogt komt hier terecht in plaats van in
// een leeg bezorgoverzicht.
//
// Bewust géén automatische doorverwijzing: een redirect die meteen afvuurt maakt
// het onmogelijk om te zien wáár je terechtkwam, en wie zich per ongeluk hier
// aanmeldde weet dan nog steeds niet waarom. Eén knop, één klik.

const PLANNER_URL = 'https://planner.go-bob.nl';

const PlannerRedirectView: React.FC = () => (
  <div className="max-w-md mx-auto animate-in fade-in duration-300 pb-24 lg:pb-8">
    <div
      className="bg-white rounded-2xl border border-[#f2f4f6] p-6 text-center"
      style={{ boxShadow: '0 4px 24px rgba(25,28,30,0.04)' }}
    >
      <span className="w-12 h-12 rounded-2xl bg-[#006b5a]/10 flex items-center justify-center mx-auto">
        <CalendarDays size={22} className="text-[#006b5a]" />
      </span>

      <h2 className="mt-4 text-lg font-display font-black text-[#191c1e]">
        Jouw omgeving is de GoBob Planner.
      </h2>
      <p className="mt-2 text-sm text-[#3d4945]/80">
        Roosters, diensten en facturatie beheer je daar. Deze app is voor het bezorgen zelf.
      </p>

      <a
        href={PLANNER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 w-full h-12 rounded-xl bg-[#006b5a] hover:bg-[#00594b] transition-colors text-white font-display font-bold flex items-center justify-center gap-2"
      >
        Naar de Planner
        <ArrowUpRight size={17} />
      </a>

      <p className="mt-3 text-xs text-[#3d4945]/60 break-all">{PLANNER_URL}</p>
    </div>
  </div>
);

export default PlannerRedirectView;
