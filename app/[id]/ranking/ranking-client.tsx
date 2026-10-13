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
    return tab === "confiable" ? `${p.valor}%` : `${p.valor} pts`;
  };

  const renderTableValue = (p: FilaRanking) => {
    return tab === "confiable" ? `${p.valor}%` : `${p.valor} pts`;
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
                className={`py-2 px-0.5 text-center font-display text-[11px] font-bold rounded-xl transition-all duration-200 capitalize outline-none ${
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
        {tab === "confiable" && "🎯 % de cumplimiento de deberes asignados"}
        {tab === "solidario" && "🤝 Puntos ganados ayudando a otros"}
        {tab === "responsable" && "🌟 Puntos acumulados en extras reclamables"}
      </p>

      {/* Podio Visual */}
      {rankData.length > 0 ? (
        <div className="flex items-end justify-center gap-2 mt-4 px-1 h-44">
          {/* Segundo lugar (Izquierda) */}
          {p2 ? (
            <div className="flex-1 flex flex-col items-center max-w-[120px]">
              <div className="relative mb-1.5">
                <div className="size-[42px] rounded-full bg-white flex items-center justify-center text-lg font-bold border-2 border-[#e6d9c4] overflow-hidden shadow-sm">
                  {p2.fotoUrl ? (
                    <img src={p2.fotoUrl} alt={p2.nombre} className="size-full object-cover" />
                  ) : (
                    p2.nombre.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="absolute -top-2 -right-2 text-xl drop-shadow-sm">🥈</div>
              </div>
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
              <div className="relative mb-1.5">
                <div className="size-[54px] rounded-full bg-white flex items-center justify-center text-xl font-bold border-[3px] border-[#f6d582] overflow-hidden shadow-md">
                  {p1.fotoUrl ? (
                    <img src={p1.fotoUrl} alt={p1.nombre} className="size-full object-cover" />
                  ) : (
                    p1.nombre.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="absolute -top-3 -right-3 text-3xl animate-bounce drop-shadow-sm">👑</div>
              </div>
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
              <div className="relative mb-1.5">
                <div className="size-[42px] rounded-full bg-white flex items-center justify-center text-lg font-bold border-2 border-[#edc09a] overflow-hidden shadow-sm">
                  {p3.fotoUrl ? (
                    <img src={p3.fotoUrl} alt={p3.nombre} className="size-full object-cover" />
                  ) : (
                    p3.nombre.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="absolute -top-2 -right-2 text-xl drop-shadow-sm">🥉</div>
              </div>
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
                  <div className="size-8 rounded-full bg-white flex flex-shrink-0 items-center justify-center text-sm font-bold border border-[#f0e6d5] overflow-hidden shadow-sm">
                    {row.fotoUrl ? (
                      <img src={row.fotoUrl} alt={row.nombre} className="size-full object-cover" />
                    ) : (
                      row.nombre.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className="font-bold text-[15px] text-tinta">
                    {row.nombre}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-display text-[14px] font-extrabold text-terracota">
                    {renderTableValue(row)}
                  </span>
                  {tab === "confiable" && row.detalle && (
                    <span className="text-[10px] text-[#a0907c] font-medium">
                      {row.detalle}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
