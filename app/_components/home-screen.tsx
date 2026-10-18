"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  marcarCumplidoAction,
  cubrirDeberAction,
  reclamarExtraAction,
} from "@/lib/cumplimiento/cumplimiento.actions";
import {
  solicitarIntercambioAction,
  responderIntercambioAction,
  cancelarIntercambioAction,
} from "@/lib/intercambio/intercambio.actions";
import { cerrarSesionClienteAction } from "@/lib/auth/auth.actions";
import { supabase } from "@/lib/db/supabase";
import { comprimirImagen } from "@/lib/shared/image-compression";
import { notificarCambioHogar } from "@/lib/shared/live-sync";
import toast from "react-hot-toast";

// ── Tipos exportados ────────────────────────────────────────────────────────

export type HeroVariant = "plain" | "photo";

export type CriterioEstado = {
  id: string;
  descripcion: string;
  puntos?: number;
  completado: boolean;
  completadoPorNombre?: string;
  esPropio?: boolean;
  esIntercambiado?: boolean;
  intercambiadoConNombre?: string;
};

export type DeberHoy = {
  id: string;
  nombre: string;
  icono: string;
  puntos: number;
  puntosGanadosHoy?: number;
  criterios: string[];
  criteriosDetalle?: CriterioEstado[];
  cumplido: boolean;
  cubiertoPor?: {
    registroId: string;
    nombreId: string;
    nombre: string;
  };
};

export type HermanoEstado = {
  participanteId: string;
  cobertura?: "bonus" | "nobonus" | "cubierto_por_otro";
  coberturaPuntosGanados?: number;
  nombre: string;
  rol: string;
  emoji?: string;
  fotoUrl: string | null;
  esYo: boolean;
  cumplido: boolean;
  deberNombre: string;
  deberId: string;
  deberPuntos: number;
  deberCriterios: string[];
  deberCriteriosDetalle?: CriterioEstado[];
  criteriosCompletados?: number;
  criteriosTotales?: number;
  puedeIntercambiar?: boolean;
  puedeIntercambiarTodoElDeber?: boolean;
  ringStyle: string;
  cardStyle: string;
};

export type ExtraSemana = {
  reclamadoHoy: boolean;
  clave: string;
  icono: string;
  label: string;
  meta: string;
  puntos: number;
  criterios: string[];
  esPersonal?: boolean;
  requiereFoto?: boolean;
};

export type SolicitudIntercambioUI = {
  id: string;
  solicitanteId: string;
  solicitanteNombre: string;
  destinatarioId: string;
  destinatarioNombre: string;
  deberSolicitanteNombre: string;
  deberSolicitanteIcono: string;
  deberDestinatarioNombre: string;
  deberDestinatarioIcono: string;
  criteriosSolicitanteLabels?: string[];
  criteriosDestinatarioLabels?: string[];
  esRecibida: boolean;
};

export type HomeScreenProps = {
  miId: string;
  variant?: HeroVariant;
  userName: string;
  dateLabel: string;
  deberesHoy: DeberHoy[];
  hermanos: HermanoEstado[];
  extras: ExtraSemana[];
  puntosBase: number;
  posicionLabel: string;
  deberManana?: { nombre: string; icono: string; puntos: number } | null;
  intercambiosPendientes?: SolicitudIntercambioUI[];
  bonoAyuda?: number;
};

// ── Tipos internos ──────────────────────────────────────────────────────────

type ModalData = {
  tipo: "cubrir" | "reclamar" | "personal";
  nombre: string;
  emoji: string;
  puntos: number;
  bonoAyuda?: number;
  criterios: string[];
  criteriosDetalle?: CriterioEstado[];
  hermanoIdx?: number;
  extraClave?: string;
  fotoUrl?: string;
  nota?: string;
  requiereFoto?: boolean;
};

// ── Componente principal ────────────────────────────────────────────────────

export function HomeScreen({
  variant = "plain",
  userName,
  dateLabel,
  deberesHoy,
  hermanos,
  extras,
  puntosBase,
  posicionLabel,
  miId,
  deberManana,
  intercambiosPendientes = [],
  bonoAyuda = 5,
}: HomeScreenProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaliendo, setIsSaliendo] = useState(false);

  const [modal, setModal] = useState<ModalData | null>(null);
  const [modalIntercambioHermanoIdx, setModalIntercambioHermanoIdx] = useState<
    number | null
  >(null);

  const todosMisDeberesCumplidos =
    deberesHoy.length > 0 && deberesHoy.every((d) => d.cumplido);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleCambiarPerfil = async () => {
    setIsSaliendo(true);
    try {
      await cerrarSesionClienteAction();
      window.location.replace("/");
    } catch {
      window.location.replace("/?cambiar=1");
    }
  };

  /** Marca todos los criterios restantes del deber de una sola vez */
  const marcarCumplido = (idx: number) => {
    const deber = deberesHoy[idx];
    if (deber.cumplido) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("deberId", deber.id);
      fd.append("participanteId", miId);
      const res = await marcarCumplidoAction(fd);
      if (res.ok) {
        toast.success("¡Deber completado!");
        await notificarCambioHogar("deber_cumplido");
        router.refresh();
      } else {
        toast.error("Error: " + res.error);
      }
    });
  };

  /** Marca un criterio individual de tu propio deber en tiempo real */
  const marcarCriterioPropio = (idx: number, criterioId: string) => {
    const deber = deberesHoy[idx];
    if (deber.cumplido) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("deberId", deber.id);
      fd.append("participanteId", miId);
      fd.append("criteriosIds", criterioId);
      const res = await marcarCumplidoAction(fd);
      if (res.ok) {
        toast.success("✓ Criterio guardado");
        await notificarCambioHogar("criterio_cumplido");
        router.refresh();
      } else {
        toast.error("Error: " + res.error);
      }
    });
  };

  const abrirModalCubrir = (hermanoIdx: number) => {
    const h = hermanos[hermanoIdx];
    setModal({
      tipo: "cubrir",
      nombre: h.deberNombre,
      emoji: h.emoji || "✨",
      puntos: h.deberPuntos || 10,
      bonoAyuda,
      criterios: h.deberCriterios,
      criteriosDetalle: h.deberCriteriosDetalle,
      hermanoIdx,
    });
  };

  const abrirModalReclamar = (clave: string, esPersonal: boolean = false) => {
    const e = extras.find((x) => x.clave === clave);
    if (!e) return;
    setModal({
      tipo: esPersonal ? "personal" : "reclamar",
      nombre: e.label,
      emoji: e.icono,
      puntos: e.puntos,
      criterios: e.criterios,
      extraClave: clave,
      requiereFoto: e.requiereFoto,
    });
  };

  const handleResponderIntercambio = (solicitudId: string, aceptar: boolean) => {
    startTransition(async () => {
      const res = await responderIntercambioAction(solicitudId, miId, aceptar);
      if (res.ok) {
        toast.success(
          aceptar
            ? "🔄 ¡Intercambio aceptado! Se actualizaron los deberes de hoy."
            : "Solicitud de intercambio rechazada.",
        );
        await notificarCambioHogar("intercambio_respondido");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleCancelarIntercambio = (solicitudId: string) => {
    startTransition(async () => {
      const res = await cancelarIntercambioAction(solicitudId, miId);
      if (res.ok) {
        toast.success("Petición cancelada.");
        await notificarCambioHogar("intercambio_cancelado");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const puntosMes = puntosBase;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <main
        className="mx-auto min-h-dvh w-full max-w-[420px] bg-crema px-[18px] pt-2 font-sans text-tinta"
        style={{
          paddingBottom: "max(30px, env(safe-area-inset-bottom))",
          opacity: isPending ? 0.6 : 1,
          transition: "opacity 0.2s",
        }}
        inert={!!modal || modalIntercambioHermanoIdx !== null || isPending}
      >
        {/* Saludo + fecha */}
        <header className="px-0.5 pb-4 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#b19a80]">
              {dateLabel}
            </p>
            <button
              type="button"
              onClick={handleCambiarPerfil}
              disabled={isSaliendo}
              className="text-[11px] font-semibold text-[#a88c5a] hover:text-terracota bg-[#f8f1e5] px-2.5 py-1 rounded-full transition-colors active:scale-95 border border-[#e6d9c4] disabled:opacity-50"
            >
              {isSaliendo ? "Saliendo..." : "Cambiar perfil"}
            </button>
          </div>
          <h1 className="mt-[5px] text-balance font-display text-[26px] font-extrabold leading-[1.05] tracking-[-0.02em]">
            Buenas, {userName}{" "}
            <span aria-hidden="true" className="font-sans">
              👋
            </span>
          </h1>
          <p className="mt-[3px] text-[13.5px] font-medium text-[#9a8c7c]">
            Esto es lo tuyo hoy. Sin vueltas.
          </p>
        </header>

        {/* Banners de solicitudes de intercambio pendientes */}
        {intercambiosPendientes.length > 0 && (
          <section aria-label="Peticiones de intercambio" className="mb-4 space-y-2.5">
            {intercambiosPendientes.map((sol) => {
              const esParcial =
                sol.criteriosSolicitanteLabels &&
                sol.criteriosSolicitanteLabels.length > 0 &&
                sol.criteriosDestinatarioLabels &&
                sol.criteriosDestinatarioLabels.length > 0;

              return sol.esRecibida ? (
                <div
                  key={sol.id}
                  className="rounded-[22px] border-2 border-[#e2733f] bg-[#fff4ec] p-4 shadow-sm"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#fbd9c4] text-[18px]">
                      🔄
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[14.5px] font-extrabold text-tinta leading-snug">
                        {sol.solicitanteNombre} te pide intercambiar{" "}
                        {esParcial ? "criterios hoy" : "su deber por hoy"}
                      </p>
                      {esParcial ? (
                        <div className="mt-1.5 space-y-1 text-[12px] font-medium text-[#6e5d4f] leading-snug">
                          <p>
                            • <strong>Tú harías ({sol.deberSolicitanteNombre}):</strong>{" "}
                            {sol.criteriosSolicitanteLabels!.join(", ")}
                          </p>
                          <p>
                            • <strong>{sol.solicitanteNombre} haría ({sol.deberDestinatarioNombre}):</strong>{" "}
                            {sol.criteriosDestinatarioLabels!.join(", ")}
                          </p>
                          <p className="text-[11px] font-bold text-[#c25a2e]">
                            Ambos ganan sus +10 pts normales al cumplir su lista.
                          </p>
                        </div>
                      ) : (
                        <p className="mt-1 text-[12.5px] font-medium text-[#6e5d4f] leading-snug">
                          Tú harías{" "}
                          <strong>
                            {sol.deberSolicitanteIcono} {sol.deberSolicitanteNombre}
                          </strong>{" "}
                          y {sol.solicitanteNombre} haría{" "}
                          <strong>
                            {sol.deberDestinatarioIcono} {sol.deberDestinatarioNombre}
                          </strong>{" "}
                          (ambos por sus +10 pts normales).
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleResponderIntercambio(sol.id, true)}
                      disabled={isPending}
                      className="flex-1 rounded-xl bg-terracota py-2 text-[12.5px] font-extrabold text-white shadow-sm transition-transform active:scale-95 disabled:opacity-50"
                    >
                      ✓ Aceptar cambio
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResponderIntercambio(sol.id, false)}
                      disabled={isPending}
                      className="rounded-xl border border-[#dccdb4] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[#7c6b58] transition-transform active:scale-95 disabled:opacity-50"
                    >
                      ✕ Rechazar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={sol.id}
                  className="flex items-center justify-between gap-2 rounded-[18px] border border-[#e6d9c4] bg-[#faf5eb] px-3.5 py-2.5"
                >
                  <p className="text-[12px] font-semibold text-[#7c6b58]">
                    ⏳ Esperando a <strong>{sol.destinatarioNombre}</strong> para
                    intercambiar{" "}
                    {esParcial
                      ? "criterios seleccionados"
                      : `por ${sol.deberDestinatarioIcono} ${sol.deberDestinatarioNombre}`}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCancelarIntercambio(sol.id)}
                    disabled={isPending}
                    className="flex-shrink-0 rounded-lg border border-[#dccdb4] bg-white px-2.5 py-1 text-[11px] font-bold text-[#9a8c7c] hover:text-terracota"
                  >
                    Cancelar
                  </button>
                </div>
              );
            })}
          </section>
        )}

        {/* Deberes del día — una tarjeta por cada deber con su propio botón */}
        {deberesHoy.length === 0 ? (
          <section className="rounded-[26px] border border-[#f0e6d5] bg-crema-card p-6 text-center">
            <p className="text-[14px] font-medium text-[#9a8c7c]">
              No tienes deberes asignados hoy.
            </p>
          </section>
        ) : (
          deberesHoy.map((deber, idx) => (
            <DeberPropioCard
              key={deber.id}
              variant={variant}
              deber={deber}
              cumplido={deber.cumplido}
              isSubmitting={isPending}
              onMarcar={() => marcarCumplido(idx)}
              onMarcarCriterio={(criterioId) =>
                marcarCriterioPropio(idx, criterioId)
              }
              className={idx > 0 ? "mt-3.5" : ""}
            />
          ))
        )}

        {/* Qué te toca mañana */}
        {deberManana && (
          <section aria-label="Deber de mañana" className="mt-4">
            <div className="flex items-center justify-between rounded-[22px] border border-[#f0e6d5] bg-crema-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-[42px] items-center justify-center rounded-2xl bg-[#faf5eb] border border-[#f0e6d5] text-[20px]"
                >
                  {deberManana.icono}
                </span>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#b19a80]">
                    Mañana te toca
                  </span>
                  <p className="font-display text-[16px] font-extrabold text-tinta leading-tight">
                    {deberManana.nombre}
                  </p>
                </div>
              </div>
              <span className="rounded-xl bg-[#fbe3d0] px-2.5 py-1 font-display text-[12px] font-extrabold text-terracota">
                +{deberManana.puntos} pts
              </span>
            </div>
          </section>
        )}

        {/* Estado de hoy: los hermanos y sus deberes */}
        <section aria-label="Estado de hoy" className="mt-7">
          <div className="flex items-baseline justify-between px-0.5">
            <h2 className="font-display text-[18px] font-extrabold tracking-[-0.02em]">
              Estado de hoy
            </h2>
            <span className="text-[11.5px] font-semibold text-[#b19a80]">
              Rotación del día
            </span>
          </div>
          <ul className="mt-[13px] flex items-stretch gap-[9px]">
            {hermanos.map((h, i) => {
              const cumplidoVisible = h.esYo
                ? todosMisDeberesCumplidos
                : h.cumplido;
              const cobertura = h.cobertura;
              const totCrit = h.criteriosTotales ?? 0;
              const compCrit = h.criteriosCompletados ?? 0;
              const tieneCriteriosPendientes =
                totCrit > 0 ? compCrit < totCrit : !h.cumplido;
              const puedeCubrir = !h.esYo && tieneCriteriosPendientes;

              const yaHaySolicitudConEl = intercambiosPendientes.some(
                (s) =>
                  s.solicitanteId === h.participanteId ||
                  s.destinatarioId === h.participanteId,
              );

              return (
                <li
                  key={h.nombre}
                  className="relative flex flex-1 flex-col justify-between rounded-[18px] px-[9px] pb-3 pt-[13px] text-center"
                  style={parseStyle(h.cardStyle)}
                >
                  <div>
                    <div className="relative">
                      <div
                        className="mx-auto flex size-[46px] items-center justify-center rounded-full bg-white text-[23px] font-bold text-naranja shadow-sm"
                        style={parseStyle(h.ringStyle)}
                      >
                        {h.fotoUrl ? (
                          <img
                            src={h.fotoUrl}
                            alt={h.nombre}
                            className="size-full rounded-full object-cover"
                          />
                        ) : (
                          h.nombre.charAt(0).toUpperCase()
                        )}
                      </div>
                      {h.esYo && (
                        <span className="absolute right-[9px] top-[9px] rounded-[20px] bg-terracota px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.06em] text-white">
                          TÚ
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[13px] font-extrabold">{h.nombre}</p>
                    <p className="mt-px text-[10.5px] font-semibold text-[#a6927c]">
                      {h.rol}
                    </p>

                    {cumplidoVisible ? (
                      <p className="mt-[9px] inline-flex items-center gap-1 rounded-[20px] bg-[#e3efdf] px-[9px] py-1 text-[10.5px] font-extrabold text-[#477a4e]">
                        ● Cumplido
                      </p>
                    ) : compCrit > 0 && totCrit > 0 ? (
                      <p className="mt-[9px] inline-flex items-center gap-1 rounded-[20px] bg-[#fbefd6] px-[9px] py-1 text-[10.5px] font-extrabold text-[#9a7a2e]">
                        ● {compCrit}/{totCrit} listo
                      </p>
                    ) : cobertura === undefined ? (
                      <p className="mt-[9px] inline-flex items-center gap-1 rounded-[20px] bg-[#efe7da] px-[9px] py-1 text-[10.5px] font-extrabold text-[#a0917e]">
                        ● Pendiente
                      </p>
                    ) : null}

                    {cobertura === "bonus" && (
                      <p className="mt-[7px] rounded-[11px] bg-[#e3efdf] px-[5px] py-1 text-[10px] font-bold leading-[1.25] text-[#477a4e]">
                        Cubriste · +{h.coberturaPuntosGanados ?? 15} pts
                      </p>
                    )}
                    {cobertura === "nobonus" && (
                      <p className="mt-[7px] rounded-[11px] bg-[#fbefd6] px-[5px] py-1 text-[10px] font-bold leading-[1.25] text-[#9a7a2e]">
                        Cubriste (+{h.coberturaPuntosGanados ?? 15})
                        <br />
                        cumple el tuyo p/ bono
                      </p>
                    )}
                    {cobertura === "cubierto_por_otro" && (
                      <p className="mt-[7px] rounded-[11px] bg-[#e3efdf] px-[5px] py-1.5 text-[10px] font-bold leading-[1.25] text-[#477a4e]">
                        ¡Te cubrieron!
                      </p>
                    )}
                  </div>

                  {/* Acciones hacia el hermano: Cubrir criterios y/o Intercambiar */}
                  {!h.esYo &&
                    (puedeCubrir ||
                      (h.puedeIntercambiar && !yaHaySolicitudConEl)) && (
                      <div className="mt-[9px] flex flex-col gap-1.5">
                        {puedeCubrir && (
                          <button
                            type="button"
                            onClick={() => abrirModalCubrir(i)}
                            className="w-full rounded-[11px] border-[1.5px] border-[#e6b79c] bg-[#fff4ec] px-1 py-[6px] text-[10.5px] font-extrabold text-[#c25a2e] transition-colors hover:bg-[#ffe9db] active:scale-[0.97]"
                          >
                            {cobertura ? "+ Cubrir otro" : "Cubrir deber"}
                          </button>
                        )}
                        {h.puedeIntercambiar && !yaHaySolicitudConEl && (
                          <button
                            type="button"
                            onClick={() => setModalIntercambioHermanoIdx(i)}
                            disabled={isPending}
                            className="w-full rounded-[11px] border border-[#dccdb4] bg-[#faf5eb] px-1 py-[5px] text-[10px] font-bold text-[#7c6b58] transition-colors hover:bg-[#f0e6d5] active:scale-[0.97] disabled:opacity-50"
                          >
                            🔄 Intercambiar
                          </button>
                        )}
                      </div>
                    )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Extras de la semana */}
        <section aria-label="Extras de la semana" className="mt-8">
          <div className="flex items-baseline justify-between px-0.5 mb-3">
            <h2 className="font-display text-[18px] font-extrabold tracking-[-0.02em]">
              Extras de la semana
            </h2>
          </div>

          {extras.length === 0 ? (
            <div className="rounded-[20px] bg-white p-5 text-center shadow-[0_4px_16px_rgb(0,0,0,0.03)] border border-[#efe1c6]">
              <p className="text-[13.5px] font-medium text-[#b19a80]">
                No hay extras asignados por hoy.
              </p>
            </div>
          ) : (
            <div className="rounded-[20px] bg-white shadow-[0_4px_16px_rgb(0,0,0,0.03)] overflow-hidden">
              <ul className="flex flex-col">
                {extras.map((e) => {
                  const estado = e.reclamadoHoy ? "done" : "idle";
                  return (
                    <li
                      key={e.clave}
                      className="flex items-center gap-3 border-t border-[#efe1c6] p-[13px_18px] first:border-t-0"
                    >
                      <span
                        aria-hidden="true"
                        className="flex size-[38px] flex-shrink-0 items-center justify-center rounded-xl border border-[#eddfc4] bg-crema-card text-[19px]"
                      >
                        {e.icono}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-bold">
                          {e.label}
                        </span>
                        <span className="block text-[11px] font-semibold text-[#a88c5a]">
                          {e.meta}
                        </span>
                      </span>

                      {estado === "done" ? (
                        <span className="flex-shrink-0 rounded-xl bg-[#e3efdf] px-3 py-2 text-[12px] font-extrabold text-[#477a4e]">
                          ✓ Reclamado
                        </span>
                      ) : e.esPersonal ? (
                        <button
                          type="button"
                          onClick={() => abrirModalReclamar(e.clave, true)}
                          className="flex h-[34px] items-center justify-center rounded-full bg-[#fcf9f5] px-3 text-[12.5px] font-bold text-[#c25a2e] transition-colors hover:bg-terracota hover:text-white border-[1.5px] border-[#e6b79c]"
                        >
                          ✓ Marcar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => abrirModalReclamar(e.clave)}
                          className="flex-shrink-0 rounded-xl border-[1.5px] border-[#e6b79c] bg-[#fff4ec] px-[14px] py-2 text-[12.5px] font-extrabold text-[#c25a2e] transition-colors hover:bg-[#ffe9db] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota"
                        >
                          Reclamar
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>

        {/* Pie: puntaje del mes y posición */}
        <section
          aria-label="Tu resumen del mes"
          className="mt-[26px] flex items-center gap-3 rounded-[18px] border border-[#f0e6d5] bg-crema-card p-[14px_16px]"
        >
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#b19a80]">
              Tu mes
            </p>
            <p className="mt-[3px] font-display text-[23px] font-extrabold leading-none tracking-[-0.02em] tabular-nums">
              <span aria-live="polite">{puntosMes}</span>{" "}
              <span className="text-[13px] font-bold text-[#9a8c7c]">pts</span>
            </p>
          </div>
          <div className="self-stretch border-l border-[#f0e6d5]" />
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#b19a80]">
              Posición
            </p>
            <p className="mt-1 font-display text-[19px] font-extrabold tracking-[-0.02em]">
              {posicionLabel}
            </p>
          </div>
        </section>
        <p className="mt-3.5 text-center text-[10.5px] font-semibold text-[#bba992]">
          El día cierra a las 3:00 AM · Caracas
        </p>
      </main>

      {/* Modal de Intercambio (Deber completo o Criterios específicos) */}
      {modalIntercambioHermanoIdx !== null && deberesHoy[0] && (
        <ModalIntercambio
          miDeber={deberesHoy[0]}
          hermano={hermanos[modalIntercambioHermanoIdx]}
          isSubmitting={isPending}
          onClose={() => setModalIntercambioHermanoIdx(null)}
          onConfirmar={(misCriteriosIds, susCriteriosIds) => {
            const h = hermanos[modalIntercambioHermanoIdx];
            startTransition(async () => {
              const res = await solicitarIntercambioAction(
                miId,
                h.participanteId,
                misCriteriosIds,
                susCriteriosIds,
              );
              if (res.ok) {
                toast.success(
                  `Petición de intercambio enviada a ${h.nombre}`,
                );
                await notificarCambioHogar("intercambio_solicitado");
                router.refresh();
                setModalIntercambioHermanoIdx(null);
              } else {
                toast.error(res.error);
              }
            });
          }}
        />
      )}

      {/* Modal para cubrir un deber o reclamar un extra */}
      {modal && (
        <DetalleDeberModal
          tipo={modal.tipo}
          nombre={modal.nombre}
          emoji={modal.emoji}
          puntos={modal.puntos}
          bonoAyuda={modal.bonoAyuda}
          criterios={modal.criterios}
          criteriosDetalle={modal.criteriosDetalle}
          requiereFoto={modal.requiereFoto}
          isSubmitting={isPending}
          onClose={() => setModal(null)}
          onConfirmar={(fotoUrl, nota, criteriosSeleccionados) => {
            startTransition(async () => {
              if (modal.tipo === "cubrir" && modal.hermanoIdx !== undefined) {
                const h = hermanos[modal.hermanoIdx];
                const fd = new FormData();
                fd.append("deberId", h.deberId);
                fd.append("participanteId", miId);
                fd.append("cubiertoA", h.participanteId);
                if (fotoUrl) fd.append("fotoUrl", fotoUrl);
                if (nota) fd.append("nota", nota);
                if (criteriosSeleccionados && criteriosSeleccionados.length > 0) {
                  for (const cId of criteriosSeleccionados) {
                    fd.append("criteriosIds", cId);
                  }
                }

                const res = await cubrirDeberAction(fd);
                if (!res.ok) {
                  toast.error("Error: " + res.error);
                  return;
                }
                toast.success("¡Cobertura registrada!");
              } else if (modal.tipo === "reclamar" && modal.extraClave) {
                const fd = new FormData();
                fd.append("deberId", modal.extraClave);
                fd.append("participanteId", miId);
                if (fotoUrl) fd.append("fotoUrl", fotoUrl);
                if (nota) fd.append("nota", nota);

                const res = await reclamarExtraAction(fd);
                if (!res.ok) {
                  toast.error("Error: " + res.error);
                  return;
                }
                toast.success("¡Extra reclamado!");
              } else if (modal.tipo === "personal" && modal.extraClave) {
                const fd = new FormData();
                fd.append("deberId", modal.extraClave);
                fd.append("participanteId", miId);
                if (fotoUrl) fd.append("fotoUrl", fotoUrl);
                if (nota) fd.append("nota", nota);

                const res = await marcarCumplidoAction(fd);
                if (!res.ok) {
                  toast.error("Error: " + res.error);
                  return;
                }
                toast.success("¡Deber personal marcado!");
              }
              await notificarCambioHogar("modal_confirmado");
              router.refresh();
              setModal(null);
            });
          }}
        />
      )}
    </>
  );
}

// ── Tarjeta del deber propio (con criterios interactivos y botón de marcar) ──

function DeberPropioCard({
  variant = "plain",
  deber,
  cumplido,
  isSubmitting,
  onMarcar,
  onMarcarCriterio,
  className = "",
}: {
  variant?: HeroVariant;
  deber: DeberHoy;
  cumplido: boolean;
  isSubmitting?: boolean;
  onMarcar: () => void;
  onMarcarCriterio: (criterioId: string) => void;
  className?: string;
}) {
  const detalle = deber.criteriosDetalle ?? [];
  const totalCrit = detalle.length;
  const completadosCrit = detalle.filter((c) => c.completado).length;
  const faltantesCrit = totalCrit - completadosCrit;
  const ptsHoy = deber.puntosGanadosHoy ?? (cumplido ? deber.puntos : 0);

  return (
    <section
      aria-label={`Tu deber: ${deber.nombre}`}
      className={`overflow-hidden rounded-[26px] border border-[#f0e6d5] bg-crema-card ${className}`}
      style={{ boxShadow: "0 22px 46px -24px rgba(90,62,30,.5)" }}
    >
      {deber.cubiertoPor ? (
        /* Cubierto al 100% por un hermano */
        <div
          role="status"
          aria-live="polite"
          className="relative overflow-hidden p-[28px_24px_20px] text-center"
          style={{
            background: "linear-gradient(158deg,#E8F1E2 0%,#D6E9CE 100%)",
          }}
        >
          <span
            aria-hidden="true"
            className="animate-pop-lg mx-auto flex size-[60px] items-center justify-center rounded-full bg-verde text-[30px] text-white"
            style={{ boxShadow: "0 14px 30px -10px rgba(92,154,106,.8)" }}
          >
            ✓
          </span>
          <p className="mt-3 font-display text-[22px] font-extrabold tracking-[-0.02em] text-[#33502f]">
            ¡Te cubrieron!
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[#5e7a56]">
            <strong>{deber.cubiertoPor.nombre}</strong> hizo &ldquo;{deber.nombre}&rdquo; por ti.
          </p>
        </div>
      ) : cumplido ? (
        /* Estado 100% cumplido */
        <>
          <div
            role="status"
            aria-live="polite"
            className="relative overflow-hidden p-[28px_24px_20px] text-center"
            style={{
              background: "linear-gradient(158deg,#E8F1E2 0%,#D6E9CE 100%)",
            }}
          >
            <span
              aria-hidden="true"
              className="animate-pop-lg mx-auto flex size-[60px] items-center justify-center rounded-full bg-verde text-[30px] text-white"
              style={{
                boxShadow: "0 14px 30px -10px rgba(92,154,106,.8)",
              }}
            >
              ✓
            </span>
            <p className="mt-3 font-display text-[22px] font-extrabold tracking-[-0.02em] text-[#33502f]">
              ¡Cumplido! 🎉
            </p>
            <p className="mt-1 text-[13px] font-semibold text-[#5e7a56]">
              {deber.nombre} listo.{" "}
              <strong>+{ptsHoy} pts</strong> a tu mes.
            </p>
            <span
              aria-hidden="true"
              className="absolute -top-3 right-[-10px] text-[70px] opacity-[0.12]"
            >
              {deber.icono}
            </span>
          </div>
          {detalle.some((c) => !c.esPropio || c.esIntercambiado) && (
            <div className="px-5 pt-3">
              <ul className="space-y-1.5">
                {detalle.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between text-[12px] font-semibold text-[#477a4e]"
                  >
                    <span className="truncate pr-2">✓ {c.descripcion}</span>
                    <span className="flex-shrink-0 rounded-full bg-[#e3efdf] px-2 py-0.5 text-[10px] font-extrabold">
                      {c.esIntercambiado
                        ? `🔄 Trueque con ${c.intercambiadoConNombre}`
                        : c.esPropio
                          ? "Tú"
                          : `Cubrió ${c.completadoPorNombre}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="px-5 py-3">
            <div className="flex w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-[#d6e9ce] bg-[#f0fdf4] p-[12px] text-[13.5px] font-bold text-[#166534]">
              ✓ Cumplido hoy ({totalCrit > 0 ? `${totalCrit}/${totalCrit}` : "100%"})
            </div>
          </div>
        </>
      ) : (
        /* Estado pendiente o en progreso por criterios */
        <>
          {variant === "photo" ? (
            <HeroFoto deber={deber} />
          ) : (
            <HeroColor deber={deber} />
          )}

          {/* Lista de criterios de aceptación interactivos */}
          <div className="px-5 pb-2 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#b19a80]">
                Criterios de aceptación{" "}
                {totalCrit > 0 ? `(${completadosCrit}/${totalCrit})` : ""}
              </p>
              {ptsHoy > 0 && (
                <span className="rounded-full bg-[#e3efdf] px-2 py-0.5 text-[10.5px] font-extrabold text-[#477a4e]">
                  +{ptsHoy} pts ganados
                </span>
              )}
            </div>

            {detalle.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {detalle.map((c) => {
                  const ptsPorCriterio =
                    c.puntos !== undefined && c.puntos > 0
                      ? c.puntos
                      : Math.round((deber.puntos / totalCrit) * 100) / 100;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        disabled={c.completado || isSubmitting}
                        onClick={() => onMarcarCriterio(c.id)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-2.5 text-left transition-all ${
                          c.completado
                            ? "border-[#d6e9ce] bg-[#f4fbf1] cursor-default"
                            : "border-[#efe4d2] bg-[#faf5eb]/70 hover:border-[#e2733f] hover:bg-[#fff4ec] active:scale-[0.99]"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex size-[20px] flex-shrink-0 items-center justify-center rounded-md text-[12px] font-bold transition-colors ${
                            c.completado
                              ? "bg-[#477a4e] text-white"
                              : "border-2 border-[#cbb89d] bg-white text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`block text-[13.5px] font-semibold leading-[1.3] ${
                                c.completado
                                  ? "line-through text-[#6c8a68]"
                                  : "text-[#4a4039]"
                              }`}
                            >
                              {c.descripcion}
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                                c.completado
                                  ? "bg-[#e3efdf] text-[#477a4e]"
                                  : "bg-[#f4ecdd] text-[#8c704c]"
                              }`}
                            >
                              {ptsPorCriterio} pts
                            </span>
                          </div>
                          <span className="mt-0.5 block text-[10.5px] font-bold text-[#a88c5a]">
                            {c.completado
                              ? c.esPropio
                                ? "✓ Hecho por ti"
                                : `✓ Cubierto por ${c.completadoPorNombre}`
                              : c.esIntercambiado
                                ? `🔄 Trueque con ${c.intercambiadoConNombre} · Toca al cumplir (+${ptsPorCriterio} pts)`
                                : `Toca para marcar (+${ptsPorCriterio} pts)`}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ul className="mt-1.5">
                {deber.criterios.map((label) => (
                  <li
                    key={label}
                    className="flex items-start gap-3 border-t border-[#f4ecdd] py-2.5"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-[7px] size-[6px] flex-shrink-0 rounded-full bg-[#d4c5ad]"
                    />
                    <span className="text-[14px] font-medium leading-[1.35] text-[#4a4039]">
                      {label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Botón principal DENTRO de la tarjeta */}
          <div className="px-5 pb-5 pt-2">
            <button
              type="button"
              onClick={onMarcar}
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2.5 rounded-[16px] p-[16px] font-display text-[17px] font-bold tracking-[-0.01em] text-white transition-colors disabled:opacity-70 disabled:cursor-wait hover:brightness-[1.04] active:scale-[0.975] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
              style={{
                background: "linear-gradient(180deg,#E2733F,#D2602F)",
                boxShadow: "0 14px 26px -10px rgba(210,96,47,.75)",
              }}
            >
              {isSubmitting ? (
                <>
                  <span aria-hidden="true" className="animate-spin text-[16px]">
                    ⏳
                  </span>
                  Procesando...
                </>
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className="inline-flex size-[20px] items-center justify-center rounded-full bg-white/20 text-[12px]"
                  >
                    ✓
                  </span>
                  {completadosCrit > 0 && faltantesCrit > 0
                    ? `Completar restantes (${faltantesCrit}/${totalCrit})`
                    : "Marcar todo como cumplido"}
                </>
              )}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ── Modal de Intercambio (Deber completo o Criterios específicos) ───────────

function ModalIntercambio({
  miDeber,
  hermano,
  isSubmitting,
  onClose,
  onConfirmar,
}: {
  miDeber: DeberHoy;
  hermano: HermanoEstado;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirmar: (
    misCriteriosIds?: string[] | null,
    susCriteriosIds?: string[] | null,
  ) => void;
}) {
  const puedeTodo = Boolean(hermano.puedeIntercambiarTodoElDeber);
  const [modo, setModo] = useState<"todo" | "criterios">(
    puedeTodo ? "todo" : "criterios",
  );

  const misPendientes = (miDeber.criteriosDetalle ?? []).filter(
    (c) => !c.completado,
  );
  const susPendientes = (hermano.deberCriteriosDetalle ?? []).filter(
    (c) => !c.completado,
  );

  const [misSeleccionados, setMisSeleccionados] = useState<string[]>([]);
  const [susSeleccionados, setSusSeleccionados] = useState<string[]>([]);

  const toggleMio = (id: string) => {
    setMisSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSuyo = (id: string) => {
    setSusSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const puedeEnviar =
    modo === "todo"
      ? puedeTodo
      : misSeleccionados.length > 0 && susSeleccionados.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-fade-in absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      <div
        role="dialog"
        aria-modal="true"
        className="animate-pop-lg relative z-10 max-h-[90dvh] w-full max-w-[420px] overflow-y-auto rounded-[26px] bg-crema-card p-6 outline-none"
        style={{ boxShadow: "0 10px 40px -10px rgba(60,40,15,.25)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-[#f0e6d5] text-[14px] text-[#9a8c7c]"
        >
          ✕
        </button>

        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#fbd9c4] text-[24px]">
            🔄
          </span>
          <div>
            <p className="font-display text-[20px] font-extrabold leading-tight">
              Intercambiar con {hermano.nombre}
            </p>
            <p className="text-[12px] font-semibold text-[#9a8c7c]">
              Ambos ganan sus +10 pts normales al cumplir
            </p>
          </div>
        </div>

        {/* Selector de modo: Todo el deber vs Por criterios */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#f0e6d5] p-1">
          <button
            type="button"
            disabled={!puedeTodo}
            onClick={() => setModo("todo")}
            className={`rounded-xl py-2 text-[12px] font-extrabold transition-all ${
              modo === "todo"
                ? "bg-white text-tinta shadow-sm"
                : "text-[#8e7e6e] disabled:opacity-40"
            }`}
          >
            Todo el deber
          </button>
          <button
            type="button"
            onClick={() => setModo("criterios")}
            className={`rounded-xl py-2 text-[12px] font-extrabold transition-all ${
              modo === "criterios"
                ? "bg-white text-tinta shadow-sm"
                : "text-[#8e7e6e]"
            }`}
          >
            Por criterios
          </button>
        </div>

        {modo === "todo" ? (
          <div className="mt-4 rounded-2xl border border-[#efe1c6] bg-[#faf5eb] p-4 text-[13px] font-medium text-[#5c4e41]">
            <p>
              Le propones a <strong>{hermano.nombre}</strong> cambiar el deber
              completo solo por hoy:
            </p>
            <ul className="mt-2.5 space-y-1.5 font-bold text-tinta">
              <li>
                • Tú harás: {hermano.emoji} {hermano.deberNombre} (+10 pts)
              </li>
              <li>
                • {hermano.nombre} hará: {miDeber.icono} {miDeber.nombre} (+10 pts)
              </li>
            </ul>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#b19a80]">
                1. ¿Qué criterio(s) tuyos ({miDeber.nombre}) hará {hermano.nombre}?
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {misPendientes.map((c) => {
                  const sel = misSeleccionados.includes(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => toggleMio(c.id)}
                        className={`flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left text-[13px] font-semibold transition-all ${
                          sel
                            ? "border-[#e2733f] bg-[#fff4ec] text-tinta"
                            : "border-[#dccdb4] bg-[#faf5eb] text-[#7c6b58] opacity-70"
                        }`}
                      >
                        <span
                          className={`flex size-[18px] flex-shrink-0 items-center justify-center rounded text-[11px] font-bold ${
                            sel
                              ? "bg-terracota text-white"
                              : "border border-[#cbb89d] bg-white text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className="flex-1 leading-snug">{c.descripcion}</span>
                        {c.puntos !== undefined && (
                          <span className="shrink-0 rounded-full bg-[#f4ecdd] px-2 py-0.5 text-[10px] font-extrabold text-[#8c704c]">
                            {c.puntos} pts
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#b19a80]">
                2. ¿Qué criterio(s) de {hermano.nombre} ({hermano.deberNombre}) harás tú?
              </p>
              <ul className="mt-1.5 space-y-1.5">
                {susPendientes.map((c) => {
                  const sel = susSeleccionados.includes(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => toggleSuyo(c.id)}
                        className={`flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left text-[13px] font-semibold transition-all ${
                          sel
                            ? "border-[#e2733f] bg-[#fff4ec] text-tinta"
                            : "border-[#dccdb4] bg-[#faf5eb] text-[#7c6b58] opacity-70"
                        }`}
                      >
                        <span
                          className={`flex size-[18px] flex-shrink-0 items-center justify-center rounded text-[11px] font-bold ${
                            sel
                              ? "bg-terracota text-white"
                              : "border border-[#cbb89d] bg-white text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className="flex-1 leading-snug">{c.descripcion}</span>
                        {c.puntos !== undefined && (
                          <span className="shrink-0 rounded-full bg-[#f4ecdd] px-2 py-0.5 text-[10px] font-extrabold text-[#8c704c]">
                            {c.puntos} pts
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <p className="rounded-xl bg-[#f4ecdd] p-2.5 text-[11.5px] font-semibold text-[#7a6448] leading-snug">
              💡 <strong>Equivalencia justa:</strong> Al aceptar, estos criterios se intercambian en sus listas de hoy. Cuando cada uno complete su lista, ambos ganan sus <strong>+10 pts exactos</strong>.
            </p>
          </div>
        )}

        <button
          type="button"
          disabled={!puedeEnviar || isSubmitting}
          onClick={() =>
            modo === "todo"
              ? onConfirmar(null, null)
              : onConfirmar(misSeleccionados, susSeleccionados)
          }
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-[16px] p-[15px] font-display text-[16px] font-bold text-white transition-all disabled:opacity-50"
          style={{
            background: "linear-gradient(180deg,#E2733F,#D2602F)",
            boxShadow: "0 14px 26px -10px rgba(210,96,47,.75)",
          }}
        >
          {isSubmitting ? "Enviando..." : `Enviar petición a ${hermano.nombre}`}
        </button>
      </div>
    </div>
  );
}

// ── Sub-componentes del HERO ────────────────────────────────────────────────

function HeroColor({ deber }: { deber: DeberHoy }) {
  return (
    <div
      className="relative overflow-hidden p-[20px_22px_22px]"
      style={{
        background:
          "linear-gradient(158deg,#FCEBB6 0%,#F6D582 60%,#EFC25A 100%)",
      }}
    >
      <span className="inline-flex items-center gap-1.5 rounded-[30px] bg-[#5e4016]/15 px-[11px] py-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.1em] text-[#7a5a1e]">
        ⭐ Tu deber de hoy · Obligatorio
      </span>
      <div className="relative z-[2] mt-4 flex items-center gap-3.5">
        <span
          aria-hidden="true"
          className="text-[60px] leading-none"
          style={{ filter: "drop-shadow(0 6px 8px rgba(120,80,20,.28))" }}
        >
          {deber.icono}
        </span>
        <div>
          <p className="font-display text-[33px] font-extrabold leading-[0.98] tracking-[-0.03em] text-[#4a3914]">
            {deber.nombre}
          </p>
          <p className="mt-[5px] text-[13px] font-bold text-[#86631f]">
            {deber.puntos} pts · marca por criterio o todo junto
          </p>
        </div>
      </div>
      <span
        aria-hidden="true"
        className="absolute -bottom-[26px] -right-3.5 z-[1] text-[130px] leading-none opacity-[0.13]"
      >
        {deber.icono}
      </span>
    </div>
  );
}

function HeroFoto({ deber }: { deber: DeberHoy }) {
  return (
    <div
      className="relative h-[212px]"
      style={{
        background:
          "repeating-linear-gradient(135deg,#EADDC6,#EADDC6 11px,#E2D2B6 11px,#E2D2B6 22px)",
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <span aria-hidden="true" className="text-[40px] opacity-50">
          {deber.icono}
        </span>
        <div className="flex w-full flex-col">
          <span className="mx-auto rounded-md bg-crema-card/70 px-[9px] py-1 font-mono text-[11px] tracking-[0.12em] text-[#9c8a6c]">
            FOTO MOTIVACIONAL
          </span>
        </div>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-[70%]"
        style={{
          background:
            "linear-gradient(0deg,rgba(40,28,12,.86) 0%,rgba(40,28,12,.45) 45%,rgba(40,28,12,0) 100%)",
        }}
      />
      <div className="absolute inset-x-5 bottom-4 z-[2]">
        <span className="inline-flex items-center gap-1.5 rounded-[30px] bg-white/20 px-2.5 py-[5px] text-[10px] font-extrabold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
          ⭐ Tu deber de hoy · Obligatorio
        </span>
        <div className="mt-[11px] flex items-end gap-3">
          <span
            aria-hidden="true"
            className="text-[44px] leading-none"
            style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,.4))" }}
          >
            {deber.icono}
          </span>
          <div>
            <p className="font-display text-[31px] font-extrabold leading-[0.96] tracking-[-0.03em] text-white">
              {deber.nombre}
            </p>
            <p className="mt-1 text-[12.5px] font-bold text-white/85">
              {deber.puntos} pts · por confianza
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal para cubrir un deber (por criterios) o reclamar un extra ──────────

function DetalleDeberModal({
  tipo,
  nombre,
  emoji,
  puntos,
  bonoAyuda = 5,
  criterios,
  criteriosDetalle = [],
  requiereFoto = false,
  isSubmitting = false,
  onClose,
  onConfirmar,
}: {
  tipo: "cubrir" | "reclamar" | "personal";
  nombre: string;
  emoji: string;
  puntos: number;
  bonoAyuda?: number;
  criterios: string[];
  criteriosDetalle?: CriterioEstado[];
  requiereFoto?: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirmar: (
    fotoUrl?: string,
    nota?: string,
    criteriosSeleccionados?: string[],
  ) => void;
}) {
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const disponiblesIds = criteriosDetalle
    .filter((c) => !c.completado)
    .map((c) => c.id);

  const [seleccionados, setSeleccionados] = useState<string[]>(disponiblesIds);

  const toggleCriterio = (id: string) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { archivo: archivoOptimizado } = await comprimirImagen(file, {
        maxDimension: 1280,
        calidad: 0.78,
      });

      const fileExt = archivoOptimizado.name.split(".").pop() || "webp";
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("evidencias")
        .upload(filePath, archivoOptimizado, {
          contentType: archivoOptimizado.type,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from("evidencias")
        .getPublicUrl(filePath);
      setFotoUrl(data.publicUrl);
    } catch (error: any) {
      toast.error("Error subiendo foto: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const totalCriterios = criteriosDetalle.length;
  const totalPuntosCobertura = puntos + bonoAyuda;
  const pesoTotalCriterios = criteriosDetalle.reduce(
    (acc, c) => acc + (c.puntos !== undefined && c.puntos > 0 ? c.puntos : 1),
    0,
  );
  const pesoSeleccionados = criteriosDetalle
    .filter((c) => seleccionados.includes(c.id))
    .reduce(
      (acc, c) => acc + (c.puntos !== undefined && c.puntos > 0 ? c.puntos : 1),
      0,
    );

  const puntosCalculadosCubrir =
    totalCriterios > 0
      ? Math.round(
          ((totalPuntosCobertura * pesoSeleccionados) /
            (pesoTotalCriterios || totalCriterios)) *
            100,
        ) / 100
      : totalPuntosCobertura;

  let puedeConfirmar = false;
  if ((tipo === "reclamar" || tipo === "personal") && requiereFoto)
    puedeConfirmar = !!fotoUrl;
  if ((tipo === "reclamar" || tipo === "personal") && !requiereFoto)
    puedeConfirmar = true;
  if (tipo === "cubrir") {
    const tieneCriteriosValidos =
      totalCriterios === 0 || seleccionados.length > 0;
    puedeConfirmar = nota.trim().length > 0 && tieneCriteriosValidos;
  }

  let labelBoton = "Confirmar";
  if (tipo === "cubrir") {
    labelBoton =
      puntosCalculadosCubrir > 0
        ? `Confirmar cobertura (+${puntosCalculadosCubrir} pts)`
        : "Selecciona al menos 1 criterio";
  }
  if (tipo === "reclamar" || tipo === "personal")
    labelBoton = "Marcar como cumplido";

  let subtitulo = "";
  if (tipo === "cubrir") {
    subtitulo =
      totalCriterios > 0
        ? `${seleccionados.length} de ${totalCriterios} criterios · +${puntosCalculadosCubrir} pts por cubrir`
        : `Obligatorio · +${totalPuntosCobertura} pts por cubrir`;
  }
  if (tipo === "reclamar") subtitulo = `Reclamable · +${puntos} pts`;
  if (tipo === "personal") subtitulo = `Personal · Extra · +${puntos} pts`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-fade-in absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle: ${nombre}`}
        tabIndex={-1}
        className="animate-pop-lg relative z-10 max-h-[90dvh] w-full max-w-[420px] overflow-y-auto rounded-[26px] bg-crema-card outline-none"
        style={{
          boxShadow: "0 10px 40px -10px rgba(60,40,15,.25)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-[#f0e6d5] text-[14px] text-[#9a8c7c] transition-colors hover:bg-[#e6d9c4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota"
        >
          ✕
        </button>

        <div className="p-6 pt-6">
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden="true"
              className="flex size-[52px] items-center justify-center rounded-2xl text-[28px]"
              style={{
                background:
                  tipo === "cubrir"
                    ? "linear-gradient(158deg,#FCEBB6 0%,#F6D582 100%)"
                    : "linear-gradient(158deg,#FBE3D0 0%,#F4C8A8 100%)",
                boxShadow: "0 6px 14px -6px rgba(120,80,20,.25)",
              }}
            >
              {emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[22px] font-extrabold leading-[1.05] tracking-[-0.02em]">
                {nombre}
              </p>
              <p className="mt-0.5 text-[12.5px] font-semibold text-[#c25a2e]">
                {subtitulo}
              </p>
            </div>
          </div>

          {tipo === "cubrir" && criteriosDetalle.length > 0 ? (
            <div className="mt-5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#b19a80]">
                ¿Qué criterios le cubriste?
              </p>
              <ul className="mt-2 space-y-2">
                {criteriosDetalle.map((c) => {
                  const estaMarcado = seleccionados.includes(c.id);
                  const pesoCrit =
                    c.puntos !== undefined && c.puntos > 0 ? c.puntos : 1;
                  const ptsUnitario =
                    Math.round(
                      ((totalPuntosCobertura * pesoCrit) /
                        (pesoTotalCriterios || totalCriterios)) *
                        100,
                    ) / 100;

                  if (c.completado) {
                    return (
                      <li
                        key={c.id}
                        className="flex items-start gap-3 rounded-xl border border-[#e3efdf] bg-[#f4fbf1] p-2.5 opacity-75"
                      >
                        <span className="mt-0.5 flex size-[20px] flex-shrink-0 items-center justify-center rounded-md bg-[#477a4e] text-[12px] font-bold text-white">
                          ✓
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-semibold line-through text-[#6c8a68]">
                            {c.descripcion}
                          </span>
                          <span className="block text-[10.5px] font-bold text-[#477a4e]">
                            Ya realizado por {c.completadoPorNombre}
                          </span>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => toggleCriterio(c.id)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-2.5 text-left transition-all ${
                          estaMarcado
                            ? "border-[#e2733f] bg-[#fff4ec]"
                            : "border-[#dccdb4] bg-[#faf5eb] opacity-75"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex size-[20px] flex-shrink-0 items-center justify-center rounded-md text-[12px] font-bold transition-colors ${
                            estaMarcado
                              ? "bg-terracota text-white"
                              : "border-2 border-[#cbb89d] bg-white text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-semibold leading-[1.3] text-[#4a4039]">
                            {c.descripcion}
                          </span>
                          <span className="mt-0.5 block text-[11px] font-bold text-[#c25a2e]">
                            +{ptsUnitario} pts al cubrir este criterio ({c.puntos ?? "?"} pts deber + bono)
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            criterios.length > 0 && (
              <div className="mt-5">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#b19a80]">
                  Criterios de aceptación
                </p>
                <ul className="mt-1.5">
                  {criterios.map((c) => (
                    <li
                      key={c}
                      className="flex items-start gap-3 border-t border-[#f4ecdd] py-2.5"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-[7px] size-[6px] flex-shrink-0 rounded-full bg-[#d4c5ad]"
                      />
                      <span className="text-[14px] font-medium leading-[1.35] text-[#4a4039]">
                        {c}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}

          {requiereFoto && (
            <div className="mt-5">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              {!fotoUrl ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex w-full items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[#dccdb4] bg-[#faf5eb] p-[14px] text-[14px] font-bold text-[#9a8c7c] transition-colors hover:border-[#c5b090] hover:bg-[#f4ecdd] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota disabled:opacity-50"
                >
                  <span aria-hidden="true" className="text-[18px]">
                    {isUploading ? "⏳" : "📷"}
                  </span>
                  {isUploading ? "Subiendo..." : "Tomar foto de prueba"}
                </button>
              ) : (
                <div className="animate-pop flex flex-col items-center gap-3">
                  <div className="flex w-full items-center gap-2 rounded-[14px] bg-[#e3efdf] p-[12px_14px] text-[13px] font-bold text-[#477a4e]">
                    <span aria-hidden="true" className="text-[16px]">
                      ✅
                    </span>
                    Foto subida correctamente
                  </div>
                  <button
                    type="button"
                    onClick={() => setFotoUrl(null)}
                    className="text-[13px] font-bold text-[#D2602F] underline decoration-[#D2602F]/30 underline-offset-2 transition-colors hover:decoration-[#D2602F]"
                  >
                    Borrar y tomar otra
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-5">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#b19a80]">
              {tipo === "cubrir"
                ? "Justificación (Obligatoria)"
                : "Nota o detalle adicional (Opcional)"}
            </p>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder={
                tipo === "cubrir"
                  ? "Ej. Adelanté la comida del mediodía mientras estaba ocupado..."
                  : "Ej. Lavé sábanas y toallas, o dejé todo recogido..."
              }
              className="mt-2 w-full resize-none rounded-[14px] border border-[#dccdb4] bg-[#faf5eb] p-3 text-[14px] text-[#4a4039] placeholder-[#c5b090] focus-visible:outline-2 focus-visible:outline-terracota"
              rows={2}
            />
          </div>

          <button
            type="button"
            onClick={
              puedeConfirmar
                ? () =>
                    onConfirmar(
                      fotoUrl || undefined,
                      nota || undefined,
                      tipo === "cubrir" ? seleccionados : undefined,
                    )
                : undefined
            }
            disabled={!puedeConfirmar || isSubmitting}
            aria-disabled={!puedeConfirmar || isSubmitting}
            className={`mt-5 flex w-full items-center justify-center gap-2.5 rounded-[16px] p-[16px] font-display text-[16px] font-bold tracking-[-0.01em] text-white transition-colors disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta ${isSubmitting ? "cursor-wait" : "disabled:cursor-not-allowed"}`}
            style={{
              background: puedeConfirmar
                ? "linear-gradient(180deg,#E2733F,#D2602F)"
                : "linear-gradient(180deg,#c4a88e,#b89878)",
              boxShadow: puedeConfirmar
                ? "0 14px 26px -10px rgba(210,96,47,.75)"
                : "none",
            }}
          >
            {isSubmitting ? (
              <>
                <span aria-hidden="true" className="animate-spin text-[16px]">
                  ⏳
                </span>
                Procesando...
              </>
            ) : (
              <>
                <span
                  aria-hidden="true"
                  className="inline-flex size-[20px] items-center justify-center rounded-full bg-white/20 text-[12px]"
                >
                  ✓
                </span>
                {labelBoton}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Utilidad ────────────────────────────────────────────────────────────────

function parseStyle(css: string): React.CSSProperties {
  const estilo: Record<string, string> = {};
  for (const regla of css.split(";")) {
    const [prop, ...resto] = regla.split(":");
    if (!prop || resto.length === 0) continue;
    const clave = prop
      .trim()
      .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    estilo[clave] = resto.join(":").trim();
  }
  return estilo as React.CSSProperties;
}
