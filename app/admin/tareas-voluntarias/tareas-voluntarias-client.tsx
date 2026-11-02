"use client";

import React, { useState, useTransition } from "react";
import toast from "react-hot-toast";
import {
  aprobarTareaVoluntariaAction,
  rechazarTareaVoluntariaAction,
} from "@/lib/tareas-voluntarias/tareas-voluntarias.actions";
import type { TareaVoluntariaConParticipante } from "@/lib/tareas-voluntarias/tareas-voluntarias.repo";

type Props = {
  tareas: TareaVoluntariaConParticipante[];
  adminId: string;
};

export function TareasVoluntariasAdminClient({ tareas: tareasIniciales, adminId }: Props) {
  const [tareas, setTareas] = useState(tareasIniciales);
  const [tab, setTab] = useState<"pendientes" | "historial">("pendientes");
  const [isPending, startTransition] = useTransition();

  // Estados de inputs por tarea
  const [puntosMap, setPuntosMap] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const t of tareasIniciales) {
      initial[t.id] = t.puntosSugeridos ? Number(t.puntosSugeridos) : 5;
    }
    return initial;
  });

  const [rechazoMap, setRechazoMap] = useState<Record<string, string>>({});
  const [modalFoto, setModalFoto] = useState<string | null>(null);
  const [abriendoRechazoId, setAbriendoRechazoId] = useState<string | null>(null);

  const pendientes = tareas.filter((t) => t.estado === "pendiente");
  const historial = tareas.filter((t) => t.estado !== "pendiente");

  const handleAprobar = (tarea: TareaVoluntariaConParticipante) => {
    const puntos = puntosMap[tarea.id] ?? (tarea.puntosSugeridos ? Number(tarea.puntosSugeridos) : 5);
    if (!puntos || puntos <= 0) {
      toast.error("Debes indicar una cantidad de puntos válida mayor a 0.");
      return;
    }

    const formData = new FormData();
    formData.append("tareaId", tarea.id);
    formData.append("adminId", adminId);
    formData.append("puntosOtorgados", String(puntos));

    startTransition(async () => {
      const res = await aprobarTareaVoluntariaAction(formData);
      if (res.ok) {
        toast.success(`¡Tarea aprobada! Se sumaron +${puntos} pts a ${tarea.participanteNombre}.`, {
          icon: "⭐",
        });
        setTareas((prev) =>
          prev.map((t) =>
            t.id === tarea.id
              ? {
                  ...t,
                  estado: "aprobada",
                  puntosOtorgados: String(puntos),
                  revisadoEn: new Date(),
                }
              : t,
          ),
        );
      } else {
        toast.error(res.error || "No se pudo aprobar la tarea.");
      }
    });
  };

  const handleRechazar = (tarea: TareaVoluntariaConParticipante) => {
    const motivo = rechazoMap[tarea.id]?.trim() || "";

    const formData = new FormData();
    formData.append("tareaId", tarea.id);
    formData.append("adminId", adminId);
    if (motivo) formData.append("motivoRechazo", motivo);

    startTransition(async () => {
      const res = await rechazarTareaVoluntariaAction(formData);
      if (res.ok) {
        toast("Tarea voluntaria rechazada.", { icon: "ℹ️" });
        setAbriendoRechazoId(null);
        setTareas((prev) =>
          prev.map((t) =>
            t.id === tarea.id
              ? {
                  ...t,
                  estado: "rechazada",
                  motivoRechazo: motivo || null,
                  revisadoEn: new Date(),
                }
              : t,
          ),
        );
      } else {
        toast.error(res.error || "No se pudo rechazar la tarea.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Selector de pestañas */}
      <div className="flex rounded-2xl bg-[#efe7db] p-1.5 shadow-inner">
        <button
          type="button"
          onClick={() => setTab("pendientes")}
          className={`flex-1 py-2.5 rounded-xl font-display text-sm font-extrabold transition-all ${
            tab === "pendientes"
              ? "bg-white text-[#3b2a1a] shadow-sm"
              : "text-[#8c7b68] hover:text-[#3b2a1a]"
          }`}
        >
          Pendientes ({pendientes.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("historial")}
          className={`flex-1 py-2.5 rounded-xl font-display text-sm font-extrabold transition-all ${
            tab === "historial"
              ? "bg-white text-[#3b2a1a] shadow-sm"
              : "text-[#8c7b68] hover:text-[#3b2a1a]"
          }`}
        >
          Historial ({historial.length})
        </button>
      </div>

      {/* Lista de tareas pendientes */}
      {tab === "pendientes" && (
        <div className="flex flex-col gap-4">
          {pendientes.length === 0 ? (
            <div className="rounded-3xl border border-[#efe1c6] bg-white p-8 text-center shadow-sm">
              <span className="text-4xl block mb-2">🎉</span>
              <h3 className="font-display text-lg font-extrabold text-[#3b2a1a]">
                ¡No hay tareas pendientes!
              </h3>
              <p className="mt-1 text-sm text-[#8c7b68]">
                Todas las tareas voluntarias propuestas han sido evaluadas.
              </p>
            </div>
          ) : (
            pendientes.map((tarea) => {
              const currentPuntos =
                puntosMap[tarea.id] ??
                (tarea.puntosSugeridos ? Number(tarea.puntosSugeridos) : 5);
              const estaAbiertoRechazo = abriendoRechazoId === tarea.id;

              return (
                <div
                  key={tarea.id}
                  className="rounded-3xl border border-[#efe1c6] bg-white p-5 shadow-sm flex flex-col gap-4"
                >
                  {/* Encabezado: participante + fecha */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-[#f6d582]/40 text-[#8a6b24] font-display font-extrabold flex items-center justify-center overflow-hidden border border-[#edd7a4]">
                        {tarea.participanteFotoUrl ? (
                          <img
                            src={tarea.participanteFotoUrl}
                            alt={tarea.participanteNombre}
                            className="size-full object-cover"
                          />
                        ) : (
                          tarea.participanteNombre.charAt(0)
                        )}
                      </div>
                      <div>
                        <span className="block font-display text-sm font-extrabold text-[#3b2a1a]">
                          {tarea.participanteNombre}
                        </span>
                        <span className="block text-xs text-[#8c7b68]">
                          {tarea.fecha}
                        </span>
                      </div>
                    </div>

                    <span className="rounded-full bg-[#fff4ec] border border-[#fbd9c4] px-3 py-1 text-xs font-extrabold text-[#c25a2e]">
                      Pendiente
                    </span>
                  </div>

                  {/* Detalle de la tarea */}
                  <div className="rounded-2xl bg-[#fdfbf7] border border-[#f3ebde] p-4 flex flex-col gap-2">
                    <h3 className="font-display text-base font-extrabold text-[#3b2a1a]">
                      {tarea.titulo}
                    </h3>
                    <p className="text-sm text-[#665440] leading-relaxed whitespace-pre-wrap">
                      {tarea.descripcion}
                    </p>

                    {tarea.puntosSugeridos && (
                      <div className="pt-2 flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#8c7b68]">
                          Puntos sugeridos por el participante:
                        </span>
                        <span className="font-display text-xs font-extrabold px-2 py-0.5 rounded bg-[#fcebb6] text-[#8a6b24]">
                          {tarea.puntosSugeridos} pts
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Foto de evidencia si la incluyó */}
                  {tarea.fotoUrl && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setModalFoto(tarea.fotoUrl)}
                        className="group relative size-20 rounded-2xl overflow-hidden border border-[#efe1c6] shadow-inner shrink-0"
                      >
                        <img
                          src={tarea.fotoUrl}
                          alt="Evidencia"
                          className="size-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-bold">
                          Ver
                        </div>
                      </button>
                      <span className="text-xs text-[#8c7b68]">
                        Toca la imagen para ampliar la evidencia fotográfica.
                      </span>
                    </div>
                  )}

                  {/* Formulario de Aprobación / Rechazo */}
                  {!estaAbiertoRechazo ? (
                    <div className="pt-2 border-t border-[#f3ebde] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-[#665440]">
                          Puntos a otorgar:
                        </span>
                        <div className="flex items-center rounded-xl bg-[#f5ede0] p-1 border border-[#e8dccb]">
                          <button
                            type="button"
                            disabled={isPending || currentPuntos <= 1}
                            onClick={() =>
                              setPuntosMap((prev) => ({
                                ...prev,
                                [tarea.id]: Math.max(1, currentPuntos - 1),
                              }))
                            }
                            className="size-7 rounded-lg bg-white hover:bg-gray-50 flex items-center justify-center font-bold text-xs text-[#3b2a1a] shadow-sm disabled:opacity-40"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={currentPuntos}
                            disabled={isPending}
                            onChange={(e) =>
                              setPuntosMap((prev) => ({
                                ...prev,
                                [tarea.id]: Number(e.target.value) || 1,
                              }))
                            }
                            className="w-12 text-center font-display font-extrabold text-sm text-[#3b2a1a] bg-transparent focus:outline-none"
                          />
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              setPuntosMap((prev) => ({
                                ...prev,
                                [tarea.id]: currentPuntos + 1,
                              }))
                            }
                            className="size-7 rounded-lg bg-white hover:bg-gray-50 flex items-center justify-center font-bold text-xs text-[#3b2a1a] shadow-sm disabled:opacity-40"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setAbriendoRechazoId(tarea.id)}
                          className="flex-1 sm:flex-initial py-2.5 px-4 rounded-xl text-xs font-bold text-[#8c7b68] hover:bg-[#efe7db] transition-colors"
                        >
                          Rechazar
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleAprobar(tarea)}
                          style={{ backgroundColor: "#E2733F" }}
                          className="flex-1 sm:flex-initial py-2.5 px-5 rounded-xl font-display text-xs font-extrabold text-white shadow-sm hover:opacity-95 active:scale-95 transition-all disabled:opacity-60"
                        >
                          {isPending ? "Aprobando..." : `Aprobar (+${currentPuntos} pts)`}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Cuadro desplegable para rechazar con motivo */
                    <div className="pt-2 border-t border-[#f3ebde] flex flex-col gap-2.5 animate-in fade-in">
                      <label className="text-xs font-extrabold text-[#8c7b68]">
                        Motivo del rechazo (opcional pero recomendado):
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Es parte de la tarea normal de cocina..."
                        value={rechazoMap[tarea.id] || ""}
                        disabled={isPending}
                        onChange={(e) =>
                          setRechazoMap((prev) => ({
                            ...prev,
                            [tarea.id]: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-[#eddccb] bg-[#fdfbf7] p-2.5 text-xs text-[#3b2a1a] focus:border-[#c25a2e] focus:outline-none"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setAbriendoRechazoId(null)}
                          className="py-2 px-3 rounded-xl text-xs font-bold text-[#8c7b68] hover:bg-[#efe7db]"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleRechazar(tarea)}
                          className="py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 font-display text-xs font-extrabold text-white shadow-sm transition-all disabled:opacity-60"
                        >
                          {isPending ? "Rechazando..." : "Confirmar rechazo"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Historial de tareas aprobadas y rechazadas */}
      {tab === "historial" && (
        <div className="flex flex-col gap-3">
          {historial.length === 0 ? (
            <div className="rounded-3xl border border-[#efe1c6] bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-[#8c7b68]">
                Aún no hay historial de tareas voluntarias evaluadas.
              </p>
            </div>
          ) : (
            historial.map((tarea) => {
              const esAprobada = tarea.estado === "aprobada";
              return (
                <div
                  key={tarea.id}
                  className="rounded-2xl border border-[#efe1c6] bg-white p-4 shadow-sm flex items-start justify-between gap-3"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-extrabold text-[#3b2a1a] truncate">
                        {tarea.titulo}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          esAprobada
                            ? "bg-[#e3efdf] text-[#477a4e]"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {esAprobada ? `Aprobada (+${tarea.puntosOtorgados} pts)` : "Rechazada"}
                      </span>
                    </div>

                    <p className="text-xs text-[#665440] line-clamp-2">
                      {tarea.descripcion}
                    </p>

                    {tarea.motivoRechazo && (
                      <p className="text-xs text-red-600 italic">
                        Motivo: {tarea.motivoRechazo}
                      </p>
                    )}

                    <span className="text-[11px] text-[#8c7b68] mt-1">
                      {tarea.participanteNombre} · {tarea.fecha}
                    </span>
                  </div>

                  {tarea.fotoUrl && (
                    <button
                      type="button"
                      onClick={() => setModalFoto(tarea.fotoUrl)}
                      className="size-14 rounded-xl overflow-hidden border border-[#efe1c6] shrink-0"
                    >
                      <img
                        src={tarea.fotoUrl}
                        alt="Evidencia"
                        className="size-full object-cover"
                      />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal para ver la foto en grande */}
      {modalFoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-in fade-in"
          onClick={() => setModalFoto(null)}
        >
          <div
            className="relative max-w-lg w-full rounded-3xl overflow-hidden bg-black p-2 flex flex-col gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModalFoto(null)}
              className="absolute top-4 right-4 size-8 rounded-full bg-white/20 text-white flex items-center justify-center font-bold text-sm hover:bg-white/30"
            >
              ✕
            </button>
            <img
              src={modalFoto}
              alt="Evidencia ampliada"
              className="w-full max-h-[80vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
