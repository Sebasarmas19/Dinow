"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { marcarCumplidoAction, cubrirDeberAction, reclamarExtraAction, confirmarCoberturaAction } from "@/lib/cumplimiento/cumplimiento.actions";
import { supabase } from "@/lib/db/supabase";
import toast from "react-hot-toast";

/**
 * Pantalla principal (HomeScreen) — rediseño.
 *
 * Cambios clave respecto a la versión anterior:
 * 1. Cada deber propio tiene su botón "Marcar como cumplido" DENTRO de la
 *    tarjeta, lo que permite soportar múltiples deberes sin ambigüedad.
 * 2. Los criterios de aceptación se muestran como REFERENCIA (texto), no como
 *    checkboxes interactivos. Marcar como cumplido ya implica que se cumplieron.
 * 3. "Cubrir su deber" abre un modal (bottom sheet) con los detalles del deber,
 *    sus criterios y un botón de confirmación. No pide foto (son obligatorios).
 * 4. "Reclamar" un extra también abre el modal, pero con un paso previo de
 *    "Subir foto" (los extras sí requieren foto). El botón de confirmar se
 *    habilita solo después de subir la foto.
 * 5. La sección de extras se llama "Extras de la semana" (no del fin de semana)
 *    porque el admin decide qué días aparecen.
 */

// ── Tipos exportados ────────────────────────────────────────────────────────

export type HeroVariant = "plain" | "photo";

export type DeberHoy = {
  id: string;
  nombre: string;
  icono: string;
  puntos: number;
  criterios: string[];
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
  nombre: string;
  /** Etiqueta visible del rol, p. ej. "Cocina hoy" o "Tú · Sofi". */
  rol: string;
  emoji?: string;
  fotoUrl: string | null;
  esYo: boolean;
  cumplido: boolean;
  /** Nombre completo del deber para el modal, p. ej. "Cocinar". */
  deberNombre: string;
  /** UUID del deber */
  deberId: string;
  /** Puntos del deber asignado. */
  deberPuntos: number;
  /** Criterios de aceptación del deber (se muestran en el modal). */
  deberCriterios: string[];
  /** Anillo de color alrededor del emoji (estilo del diseño). */
  ringStyle: string;
  /** Estilo de la tarjeta (resalta al "yo"). */
  cardStyle: string;
};

export type ExtraSemana = {
  reclamadoHoy: boolean;
  clave: string;
  icono: string;
  label: string;
  meta: string;
  puntos: number;
  /** Criterios de aceptación (se muestran en el modal al reclamar). */
  /** Criterios de aceptación (se muestran en el modal al reclamar). */
  criterios: string[];
  esPersonal?: boolean;
  requiereFoto?: boolean;
};

export type HomeScreenProps = {
  miId: string;
  variant?: HeroVariant;
  userName: string;
  dateLabel: string;
  /** Deberes obligatorios del día para el usuario. Puede haber más de uno. */
  deberesHoy: DeberHoy[];
  hermanos: HermanoEstado[];
  extras: ExtraSemana[];
  puntosBase: number;
  posicionLabel: string;
  deberManana?: { nombre: string; icono: string; puntos: number } | null;
};

// ── Tipos internos ──────────────────────────────────────────────────────────

type EstadoCobertura = "bonus" | "nobonus";

type ModalData = {
  tipo: "cubrir" | "reclamar" | "personal";
  nombre: string;
  emoji: string;
  puntos: number;
  criterios: string[];
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
}: HomeScreenProps) {
  const [isPending, startTransition] = useTransition();

  // Modal para cubrir deberes o reclamar extras.
  const [modal, setModal] = useState<ModalData | null>(null);

  // ¿Todos mis deberes del día están cumplidos? (necesario para el bono).
  const todosMisDeberesCumplidos =
    deberesHoy.length > 0 && deberesHoy.every((d) => d.cumplido);

  // ── Handlers ────────────────────────────────────────────────────────────

  const marcarCumplido = (idx: number) => {
    const deber = deberesHoy[idx];
    if (deber.cumplido) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("deberId", deber.id);
      fd.append("participanteId", miId);
      await marcarCumplidoAction(fd);
    });
  };

  const deshacerCumplido = (idx: number) => {
    // La BD no permite "deshacer" directamente a los usuarios (solo el admin).
    toast.error("No se puede deshacer un deber. Si te equivocaste, avisa al admin.");
  };

  const marcarExtraPersonalCumplido = (extraClave: string) => {
    const extra = extras.find(e => e.clave === extraClave);
    if (extra?.reclamadoHoy) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.append("deberId", extraClave);
      fd.append("participanteId", miId);
      await marcarCumplidoAction(fd);
    });
  };

  const abrirModalCubrir = (hermanoIdx: number) => {
    const h = hermanos[hermanoIdx];
    setModal({
      tipo: "cubrir",
      nombre: h.deberNombre,
      emoji: h.emoji || "✨",
      puntos: 15, // cubrir siempre vale 15
      criterios: h.deberCriterios,
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

  const confirmarModal = () => {
    if (!modal) return;
    
    startTransition(async () => {
      if (modal.tipo === "cubrir" && modal.hermanoIdx !== undefined) {
        const h = hermanos[modal.hermanoIdx];
        const fd = new FormData();
        fd.append("deberId", h.deberId);
        fd.append("participanteId", miId);
        fd.append("cubiertoA", h.participanteId);
        if (modal.fotoUrl) fd.append("fotoUrl", modal.fotoUrl);
        if (modal.nota) fd.append("nota", modal.nota);
        
        const res = await cubrirDeberAction(fd);
        if (!res.ok) {
          toast.error("Error: " + res.error);
          return;
        }
      } else if (modal.tipo === "reclamar" && modal.extraClave) {
        const fd = new FormData();
        fd.append("deberId", modal.extraClave);
        fd.append("participanteId", miId);
        if (modal.fotoUrl) fd.append("fotoUrl", modal.fotoUrl);
        
        const res = await reclamarExtraAction(fd);
        if (!res.ok) {
          toast.error("Error: " + res.error);
          return;
        }
      } else if (modal.tipo === "personal" && modal.extraClave) {
        const fd = new FormData();
        fd.append("deberId", modal.extraClave);
        fd.append("participanteId", miId);
        if (modal.fotoUrl) fd.append("fotoUrl", modal.fotoUrl);
        if (modal.nota) fd.append("nota", modal.nota);
        
        const res = await marcarCumplidoAction(fd);
        if (!res.ok) {
          toast.error("Error: " + res.error);
          return;
        }
      }
      setModal(null);
    });
  };

  const confirmarCoberturaHero = async (registroId: string) => {
    const fd = new FormData();
    fd.append("registroId", registroId);
    fd.append("participanteId", miId);
    const res = await confirmarCoberturaAction(fd);
    if (!res.ok) {
      toast.error("Error: " + res.error);
    }
  };

  // ── Puntaje derivado del estado ─────────────────────────────────────────

  // El backend ya lo calculó y lo trae listo en puntosBase
  let puntosMes = puntosBase;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <main
        className="mx-auto min-h-dvh w-full max-w-[420px] bg-crema px-[18px] pt-2 font-sans text-tinta"
        style={{ paddingBottom: "max(30px, env(safe-area-inset-bottom))", opacity: isPending ? 0.6 : 1, transition: "opacity 0.2s" }}
        inert={!!modal || isPending}
      >
        {/* Saludo + fecha */}
        <header className="px-0.5 pb-4 pt-2">
          <div className="flex items-center justify-between">
            <p className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#b19a80]">
              {dateLabel}
            </p>
            <Link
              href="/?cambiar=1"
              className="text-[11px] font-semibold text-[#a88c5a] hover:text-terracota bg-[#f8f1e5] px-2.5 py-1 rounded-full transition-colors active:scale-95 border border-[#e6d9c4]"
            >
              Cambiar perfil
            </Link>
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
              onDeshacer={() => deshacerCumplido(idx)}
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
              // Para el "yo", el cumplido depende de si marcó todos sus deberes
              const cumplidoVisible = h.esYo
                ? todosMisDeberesCumplidos
                : h.cumplido;
              const cobertura = h.cobertura;
              const puedeCubrir =
                !h.esYo && !h.cumplido && cobertura === undefined;

              return (
                <li
                  key={h.nombre}
                  className="relative flex-1 rounded-[18px] px-[9px] pb-3 pt-[13px] text-center"
                  style={parseStyle(h.cardStyle)}
                >
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
                  ) : cobertura === undefined ? (
                    <p className="mt-[9px] inline-flex items-center gap-1 rounded-[20px] bg-[#efe7da] px-[9px] py-1 text-[10.5px] font-extrabold text-[#a0917e]">
                      ● Pendiente
                    </p>
                  ) : null}

                  {puedeCubrir && (
                    <button
                      type="button"
                      onClick={() => abrirModalCubrir(i)}
                      className="mt-[9px] w-full rounded-[11px] border-[1.5px] border-[#e6b79c] bg-[#fff4ec] px-1 py-[7px] text-[11px] font-extrabold text-[#c25a2e] transition-colors hover:bg-[#ffe9db] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota"
                    >
                      Cubrir su deber
                    </button>
                  )}
                  {cobertura === "bonus" && (
                    <p className="mt-[9px] rounded-[11px] bg-[#e3efdf] px-[5px] py-1.5 text-[10px] font-bold leading-[1.25] text-[#477a4e]">
                      Cubierto · +15 pts
                    </p>
                  )}
                  {cobertura === "nobonus" && (
                    <p className="mt-[9px] rounded-[11px] bg-[#fbefd6] px-[5px] py-1.5 text-[10px] font-bold leading-[1.25] text-[#9a7a2e]">
                      Cubierto · cumple
                      <br />
                      el tuyo p/ el bono
                    </p>
                  )}
                  {cobertura === "cubierto_por_otro" && (
                    <p className="mt-[9px] rounded-[11px] bg-[#e3efdf] px-[5px] py-1.5 text-[10px] font-bold leading-[1.25] text-[#477a4e]">
                      ¡Te cubrieron!
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Extras de la semana (Plano, sin acordeón) */}
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

      {/* Modal para cubrir un deber o reclamar un extra */}
      {modal && (
        <DetalleDeberModal
          tipo={modal.tipo}
          nombre={modal.nombre}
          emoji={modal.emoji}
          puntos={modal.puntos}
          criterios={modal.criterios}
          requiereFoto={modal.requiereFoto}
          isSubmitting={isPending}
          onClose={() => setModal(null)}
          onConfirmar={(fotoUrl, nota) => {
            // El setModal es async para React, así que usamos un timeout para esperar el render
            startTransition(async () => {
              if (modal.tipo === "cubrir" && modal.hermanoIdx !== undefined) {
                const h = hermanos[modal.hermanoIdx];
                const fd = new FormData();
                fd.append("deberId", h.deberId);
                fd.append("participanteId", miId);
                fd.append("cubiertoA", h.participanteId);
                if (fotoUrl) fd.append("fotoUrl", fotoUrl);
                if (nota) fd.append("nota", nota);
                
                const res = await cubrirDeberAction(fd);
                if (!res.ok) {
                  toast.error("Error: " + res.error);
                  return;
                }
              } else if (modal.tipo === "reclamar" && modal.extraClave) {
                const fd = new FormData();
                fd.append("deberId", modal.extraClave);
                fd.append("participanteId", miId);
                if (fotoUrl) fd.append("fotoUrl", fotoUrl);
                
                const res = await reclamarExtraAction(fd);
                if (!res.ok) {
                  toast.error("Error: " + res.error);
                  return;
                }
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
              }
              setModal(null);
            });
          }}
        />
      )}
    </>
  );
}

// ── Tarjeta del deber propio (con botón de marcar dentro) ───────────────────

function DeberPropioCard({
  variant = "plain",
  deber,
  cumplido,
  isSubmitting,
  onMarcar,
  onDeshacer,
  className = "",
}: {
  variant?: HeroVariant;
  deber: DeberHoy;
  cumplido: boolean;
  isSubmitting?: boolean;
  onMarcar: () => void;
  onDeshacer: () => void;
  className?: string;
}) {
  return (
    <section
      aria-label={`Tu deber: ${deber.nombre}`}
      className={`overflow-hidden rounded-[26px] border border-[#f0e6d5] bg-crema-card ${className}`}
      style={{ boxShadow: "0 22px 46px -24px rgba(90,62,30,.5)" }}
    >
      {deber.cubiertoPor ? (
        /* Estado cubierto por otro: hero + botón confirmar */
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
              style={{ boxShadow: "0 14px 30px -10px rgba(92,154,106,.8)" }}
            >
              ✓
            </span>
            <p className="mt-3 font-display text-[22px] font-extrabold tracking-[-0.02em] text-[#33502f]">
              ¡Te cubrieron!
            </p>
            <p className="mt-1 text-[13px] font-semibold text-[#5e7a56]">
              <strong>{deber.cubiertoPor.nombre}</strong> hizo "{deber.nombre}" por ti.
            </p>
          </div>
        </>
      ) : cumplido ? (
        /* Estado cumplido: reemplaza al hero con celebración + botón deshacer */
        <>
          <div
            role="status"
            aria-live="polite"
            className="relative overflow-hidden p-[28px_24px_20px] text-center"
            style={{
              background:
                "linear-gradient(158deg,#E8F1E2 0%,#D6E9CE 100%)",
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
              <strong>+{deber.puntos} pts</strong> a tu mes.
            </p>
            <span
              aria-hidden="true"
              className="absolute -top-3 right-[-10px] text-[70px] opacity-[0.12]"
            >
              {deber.icono}
            </span>
          </div>
          <div className="px-5 py-3">
            <div className="flex w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-[#d6e9ce] bg-[#f0fdf4] p-[12px] text-[13.5px] font-bold text-[#166534]">
              ✓ Cumplido hoy
            </div>
          </div>
        </>
      ) : (
        /* Estado pendiente: hero + criterios de referencia + botón marcar */
        <>
          {variant === "photo" ? (
            <HeroFoto deber={deber} />
          ) : (
            <HeroColor deber={deber} />
          )}

          {/* Criterios de aceptación — solo como referencia (no checkable) */}
          <div className="px-5 pb-2 pt-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#b19a80]">
              Criterios de aceptación
            </p>
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
          </div>

          {/* Botón DENTRO de la tarjeta — cada deber tiene el suyo */}
          <div className="px-5 pb-5">
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
                  <span aria-hidden="true" className="animate-spin text-[16px]">⏳</span>
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
                  Marcar como cumplido
                </>
              )}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

// ── Sub-componentes del HERO ────────────────────────────────────────────────

/** Variante A: color + tipografía (sin foto). La preferida del usuario. */
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
            {deber.puntos} pts · se marca por confianza
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

/** Variante B: foto motivacional de fondo (placeholder etiquetado). */
function HeroFoto({ deber }: { deber: DeberHoy }) {
  return (
    <div
      className="relative h-[212px]"
      style={{
        background:
          "repeating-linear-gradient(135deg,#EADDC6,#EADDC6 11px,#E2D2B6 11px,#E2D2B6 22px)",
      }}
    >
      {/* Placeholder de la foto */}
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
      {/* Degradado oscuro para legibilidad del título */}
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

// ── Modal (bottom sheet) para detalle de deber ──────────────────────────────

/**
 * Bottom sheet que muestra los detalles de un deber al cubrir o reclamar.
 */
function DetalleDeberModal({
  tipo,
  nombre,
  emoji,
  puntos,
  criterios,
  requiereFoto = false,
  isSubmitting = false,
  onClose,
  onConfirmar,
}: {
  tipo: "cubrir" | "reclamar" | "personal";
  nombre: string;
  emoji: string;
  puntos: number;
  criterios: string[];
  requiereFoto?: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirmar: (fotoUrl?: string, nota?: string) => void;
}) {
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('evidencias')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('evidencias').getPublicUrl(filePath);
      setFotoUrl(data.publicUrl);
    } catch (error: any) {
      toast.error("Error subiendo foto: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Cerrar con Escape.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Bloquear scroll del body mientras el modal está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Foco inicial en el diálogo.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  let puedeConfirmar = false;
  if ((tipo === "reclamar" || tipo === "personal") && requiereFoto) puedeConfirmar = !!fotoUrl;
  if ((tipo === "reclamar" || tipo === "personal") && !requiereFoto) puedeConfirmar = true;
  if (tipo === "cubrir") puedeConfirmar = nota.trim().length > 0;

  let labelBoton = "Confirmar";
  if (tipo === "cubrir") labelBoton = "Confirmar cobertura";
  if (tipo === "reclamar" || tipo === "personal") labelBoton = "Marcar como cumplido";
  
  let subtitulo = "";
  if (tipo === "cubrir") subtitulo = `Obligatorio · +${puntos} pts por cubrir`;
  if (tipo === "reclamar") subtitulo = `Reclamable · +${puntos} pts`;
  if (tipo === "personal") subtitulo = `Personal · Extra · +${puntos} pts`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Fondo oscuro con blur */}
      <div className="animate-fade-in absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Modal centrado */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle: ${nombre}`}
        tabIndex={-1}
        className="animate-pop-lg relative z-10 w-full max-w-[420px] rounded-[26px] bg-crema-card outline-none"
        style={{
          boxShadow: "0 10px 40px -10px rgba(60,40,15,.25)",
        }}
      >

        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-[#f0e6d5] text-[14px] text-[#9a8c7c] transition-colors hover:bg-[#e6d9c4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota"
        >
          ✕
        </button>

        <div className="p-6 pt-6">
          {/* Encabezado del deber */}
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
              <p className="mt-0.5 text-[12.5px] font-semibold text-[#9a8c7c]">
                {subtitulo}
              </p>
            </div>
          </div>

          {/* Criterios de aceptación */}
          {criterios.length > 0 && (
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
          )}

          {/* Subir foto (solo para extras/reclamables) */}
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
                    <span aria-hidden="true" className="text-[16px]">✅</span>
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

          {/* Nota opcional (solo para cubrir) */}
          {tipo === "cubrir" && (
            <div className="mt-5">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#b19a80]">
                Justificación (Obligatoria)
              </p>
              <textarea 
                value={nota}
                onChange={e => setNota(e.target.value)}
                placeholder="Ej. Le estoy haciendo el favor porque está ocupado..."
                className="mt-2 w-full rounded-[14px] border border-[#dccdb4] bg-[#faf5eb] p-3 text-[14px] text-[#4a4039] placeholder-[#c5b090] focus-visible:outline-2 focus-visible:outline-terracota resize-none"
                rows={2}
              />
            </div>
          )}

          {/* Botón de confirmación */}
          <button
            type="button"
            onClick={puedeConfirmar ? () => onConfirmar(fotoUrl || undefined, nota || undefined) : undefined}
            disabled={!puedeConfirmar || isSubmitting}
            aria-disabled={!puedeConfirmar || isSubmitting}
            className={`mt-5 flex w-full items-center justify-center gap-2.5 rounded-[16px] p-[16px] font-display text-[17px] font-bold tracking-[-0.01em] text-white transition-colors disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta ${isSubmitting ? "cursor-wait" : "disabled:cursor-not-allowed"}`}
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
                <span aria-hidden="true" className="animate-spin text-[16px]">⏳</span>
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

/**
 * Convierte un string de estilo CSS ("background:#fff;border:1px ...") en el
 * objeto que React espera. Se usa para los estilos de tarjeta/anillo de cada
 * hermano, que vienen como dato (dependen del rol y de quién es "yo").
 */
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
