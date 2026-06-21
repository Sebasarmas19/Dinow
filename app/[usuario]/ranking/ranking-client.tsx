"use client";

import { useState } from "react";
import type { Rankings, FilaRanking } from "@/lib/rankings/rankings.service";

type Props = {
  rankings: Rankings;
};

export function RankingClient({ rankings }: Props) {
  const [tab, setTab] = useState<
    "general" | "confiable" | "solidario" | "responsable"
  >("general");

  const rankData = rankings[tab] || [];

  const renderValue = (p: FilaRanking) => {
    if (tab === "confiable") {
      return `${p.valor}%`;
    }
    return `${p.valor} pts`;
  };

  const renderTableValue = (p: FilaRanking) => {
    if (tab === "confiable") {
      return p.detalle ? `${p.valor}% — ${p.detalle}` : `${p.valor}%`;
    }
    return `${p.valor} pts`;
  };

  // Top 3 participantes para el podio
  const p1 = rankData[0];
  const p2 = rankData[1];
  const p3 = rankData[2];

  return (
    <div className="flex flex-col gap-6 animate-rise-delay-1">
      {/* Pestañas Interactivas */}
      <div
        role="tablist"
        aria-label="Rankings del mes"
        className="grid grid-cols-4 bg-[#f0e6d5] p-1 rounded-2xl gap-1"
      >
        {(["general", "confiable", "solidario", "responsable"] as const).map(
          (t) => {
            const isActive = tab === t;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(t)}
                className={`py-2.5 px-0.5 text-center font-display text-[12px] font-bold rounded-xl transition-all duration-200 capitalize outline-none ${
                  isActive
                    ? "bg-[#fffdf9] text-tinta shadow-sm"
                    : "text-[#a0907c] hover:text-tinta hover:bg-[#faf5eb]/50"
                }`}
              >
                {t}
              </button>
            );
          },
        )}
      </div>

      {/* Explicación rápida de la pestaña seleccionada */}
      <p className="text-[12px] font-medium text-[#9a8c7c] text-center -mt-2">
        {tab === "general" && "🏆 Total de puntos acumulados en el mes"}
        {tab === "confiable" && "✅ % de deberes cumplidos del participante"}
        {tab === "solidario" && "🤝 Puntos ganados ayudando a otros"}
        {tab === "responsable" && "🌟 Puntos acumulados en extras reclamables"}
      </p>

      {/* Podio Visual */}
      {rankData.length > 0 ? (
        <div className="flex items-end justify-center gap-2 mt-4 px-1 h-44">
          {/* Segundo lugar (Izquierda) */}
          {p2 ? (
            <div className="flex-1 flex flex-col items-center max-w-[120px]">
              <span className="text-2xl mb-1">🥈</span>
              <div className="text-center font-bold text-[13px] text-tinta truncate w-full">
                {p2.nombre}
              </div>
              <div className="text-[11px] text-[#a0907c] font-bold mb-1.5">
                {renderValue(p2)}
              </div>
              <div className="w-full bg-[#f6ebdc] rounded-t-2xl h-16 flex items-center justify-center border-t border-x border-[#e6d9c4] shadow-sm">
                <span className="font-display text-[18px] font-extrabold text-[#7a6d60]">
                  2º
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 max-w-[120px]" />
          )}

          {/* Primer lugar (Centro) */}
          {p1 ? (
            <div className="flex-1 flex flex-col items-center max-w-[120px]">
              <span className="text-3xl mb-0.5 animate-bounce">👑</span>
              <div className="text-center font-bold text-[14px] text-tinta truncate w-full">
                {p1.nombre}
              </div>
              <div className="text-[12px] text-terracota font-bold mb-1.5">
                {renderValue(p1)}
              </div>
              <div className="w-full bg-[#fcebb6] rounded-t-2xl h-24 flex items-center justify-center border-t border-x border-[#f6d582] shadow-sm">
                <span className="font-display text-[22px] font-extrabold text-[#a88430]">
                  1º
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 max-w-[120px]" />
          )}

          {/* Tercer lugar (Derecha) */}
          {p3 ? (
            <div className="flex-1 flex flex-col items-center max-w-[120px]">
              <span className="text-2xl mb-1">🥉</span>
              <div className="text-center font-bold text-[13px] text-tinta truncate w-full">
                {p3.nombre}
              </div>
              <div className="text-[11px] text-[#a0907c] font-bold mb-1.5">
                {renderValue(p3)}
              </div>
              <div className="w-full bg-[#fbe3d0] rounded-t-2xl h-12 flex items-center justify-center border-t border-x border-[#edc09a] shadow-sm">
                <span className="font-display text-[16px] font-extrabold text-[#c49060]">
                  3º
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 max-w-[120px]" />
          )}
        </div>
      ) : (
        <div className="text-center py-10 text-[#a0907c] font-medium bg-[#faf5eb] rounded-2xl border border-[#f0e6d5]">
          No hay datos de ranking para este mes.
        </div>
      )}

      {/* Tabla detallada */}
      {rankData.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-[#a0907c] px-1">
            Posiciones Detalladas
          </h3>
          <div className="bg-crema-card border border-[#f0e6d5] rounded-3xl p-1.5 shadow-sm flex flex-col divide-y divide-[#faf5eb]">
            {rankData.map((row) => (
              <div
                key={row.participanteId}
                className="flex items-center justify-between p-3.5 hover:bg-[#faf5eb]/20 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <span className="font-display text-[15px] font-extrabold text-[#7a6d60] w-6">
                    {row.posicion}º
                  </span>
                  <span className="font-bold text-[15px] text-tinta">
                    {row.nombre}
                  </span>
                </div>
                <span className="font-display text-[14px] font-extrabold text-terracota">
                  {renderTableValue(row)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
