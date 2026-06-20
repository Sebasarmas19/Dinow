"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import React from "react";
import type { AdminDashboardData } from "../../lib/home/admin.service";

/**
 * Dashboard del Admin — vista principal después del login.
 *
 * Secciones:
 * 1. Header con ícono de casa + nombre del hogar
 * 2. Accesos rápidos (grid 3×2 de tarjetas con íconos)
 * 3. Plan de la semana (tabla compacta con scroll horizontal)
 */

// ── Definición de los accesos rápidos ───────────────────────────────────────

type AccesoRapido = {
  clave: string;
  icono: string;
  label: string;
  ruta: string;
  /** Gradiente de fondo del ícono. */
  bg: string;
  /** Color del ícono SVG. */
  color: string;
};

const ACCESOS_RAPIDOS: AccesoRapido[] = [
  {
    clave: "participantes",
    icono: "👥",
    label: "Participantes",
    ruta: "/admin/participantes",
    bg: "linear-gradient(158deg, #FCEBB6 0%, #F6D582 100%)",
    color: "#A88430",
  },
  {
    clave: "deberes",
    icono: "📋",
    label: "Deberes",
    ruta: "/admin/deberes",
    bg: "linear-gradient(158deg, #FBE3D0 0%, #F4C8A8 100%)",
    color: "#C49060",
  },
  {
    clave: "editar-plan",
    icono: "📅",
    label: "Editar Plan",
    ruta: "/admin/plan",
    bg: "linear-gradient(158deg, #E8F1E2 0%, #D6E9CE 100%)",
    color: "#5C9A6A",
  },
  {
    clave: "ajustar-puntos",
    icono: "⚡",
    label: "Ajustar Puntos",
    ruta: "/admin/puntos",
    bg: "linear-gradient(158deg, #FDE8E0 0%, #F8D0C0 100%)",
    color: "#D06040",
  },
  {
    clave: "configuracion",
    icono: "⚙️",
    label: "Configuración",
    ruta: "/admin/configuracion",
    bg: "linear-gradient(158deg, #E8E4F0 0%, #D8D0E8 100%)",
    color: "#7A6A90",
  },
  {
    clave: "auditoria",
    icono: "📜",
    label: "Auditoría",
    ruta: "/admin/auditoria",
    bg: "linear-gradient(158deg, #F0E6D5 0%, #E6D9C4 100%)",
    color: "#A0907C",
  },
];

// ── Componente principal ────────────────────────────────────────────────────

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  const router = useRouter();

  return (
    <main className="mx-auto min-h-dvh max-w-[480px] px-4 pb-10 pt-6">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="mb-8 animate-rise">
        <div className="flex items-center gap-3">
          <div
            className="flex size-[44px] items-center justify-center rounded-[14px] text-[22px]"
            style={{
              background: "linear-gradient(158deg, #FCEBB6 0%, #F6D582 100%)",
              boxShadow: "0 6px 16px -6px rgba(120,80,20,.25)",
            }}
          >
            🏠
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[22px] font-extrabold tracking-[-0.02em] text-tinta">
              {data.nombreHogar}
            </h1>
            <p className="text-[13px] font-semibold text-[#9a8c7c]">
              Panel de administración
            </p>
          </div>
          {/* Botón salir */}
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label="Volver al selector de perfiles"
            className="flex size-[38px] items-center justify-center rounded-full bg-[#b19a80] text-[16px] font-bold text-white shadow-sm transition-colors hover:bg-[#9a8c7c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota"
          >
            ←
          </button>
        </div>
      </header>

      {/* ─── Accesos Rápidos ────────────────────────────────────────────── */}
      <section aria-label="Accesos rápidos" className="mb-8 animate-rise-delay-1">
        <h2 className="mb-4 text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#b19a80]">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {ACCESOS_RAPIDOS.map((acceso) => {
            const [isPending, startTransition] = React.useTransition();

            return (
              <button
                key={acceso.clave}
                type="button"
                onClick={() => {
                  startTransition(() => {
                    router.push(acceso.ruta);
                  });
                }}
                disabled={isPending}
                className="group relative flex flex-col items-center gap-2.5 rounded-[18px] border border-[#f0e6d5] bg-crema-card p-4 transition-all hover:border-[#e6d9c4] hover:shadow-md active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota disabled:opacity-80"
                style={{
                  boxShadow: "0 4px 12px -6px rgba(60,40,15,.08)",
                }}
              >
                <div
                  className="flex size-[48px] items-center justify-center rounded-[14px] text-[24px] transition-transform duration-200 group-hover:scale-[1.1]"
                  style={{
                    background: acceso.bg,
                    boxShadow: "0 6px 14px -6px rgba(120,80,20,.2)",
                  }}
                >
                  {isPending ? (
                    <div className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    acceso.icono
                  )}
                </div>
                <span className="text-center text-[12.5px] font-bold leading-tight text-[#5a4d40]">
                  {acceso.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── Plan de la Semana ──────────────────────────────────────────── */}
      <section aria-label="Plan de la semana" className="animate-rise-delay-2">
        <h2 className="mb-4 text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#b19a80]">
          Plan de la semana
        </h2>
        <div
          className="overflow-hidden rounded-[18px] border border-[#f0e6d5] bg-crema-card"
          style={{ boxShadow: "0 4px 12px -6px rgba(60,40,15,.08)" }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] border-collapse text-[13px]">
              <thead>
                <tr>
                  {/* Celda vacía del encabezado (columna de nombres) */}
                  <th
                    scope="col"
                    className="sticky left-0 z-10 bg-[#f8f1e5] px-3 py-3 text-left text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#b19a80]"
                  >
                    <span className="sr-only">Participante</span>
                  </th>
                  {data.diasLabels.map((dia) => (
                    <th
                      key={dia.clave}
                      scope="col"
                      className="bg-[#f8f1e5] px-2 py-3 text-center text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#b19a80]"
                    >
                      {dia.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.planSemanal.map((fila, i) => (
                  <tr
                    key={fila.participanteNombre}
                    className={
                      i < data.planSemanal.length - 1
                        ? "border-b border-[#f4ecdd]"
                        : ""
                    }
                  >
                    {/* Nombre del participante — sticky a la izquierda */}
                    <th
                      scope="row"
                      className="sticky left-0 z-10 whitespace-nowrap bg-crema-card px-3 py-3 text-left font-display text-[13px] font-bold text-tinta"
                    >
                      {fila.participanteNombre}
                    </th>
                    {data.diasLabels.map((dia) => {
                      const deberesDelDia = fila.dias[dia.clave];
                      return (
                        <td
                          key={dia.clave}
                          className="px-2 py-3 text-center align-top"
                        >
                          {deberesDelDia && deberesDelDia.length > 0 ? (
                            <div className="flex flex-col gap-1 items-center">
                              {deberesDelDia.map((deber, idx) => (
                                <span key={idx} className="inline-block rounded-[8px] bg-[#faf5eb] px-2 py-1 text-[11.5px] font-semibold text-[#5a4d40]">
                                  {abreviarDeber(deber)}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#d4c5ad]">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Indicación de scroll si es necesario */}
        <p className="mt-2 text-center text-[11px] font-medium text-[#c5b090]">
          ← Desliza para ver todos los días →
        </p>
      </section>
    </main>
  );
}

// ── Utilidad ────────────────────────────────────────────────────────────────

/**
 * Acorta nombres de deberes largos para que quepan en la tabla.
 * "Lavar los platos" → "Platos", "Atender a Sofi" → "Sofi", etc.
 */
function abreviarDeber(nombre: string): string {
  const abreviaturas: Record<string, string> = {
    "Cocinar": "🍳 Cocinar",
    "Lavar los platos": "🍽️ Platos",
    "Atender a Sofi": "🐾 Sofi",
  };
  return abreviaturas[nombre] ?? nombre;
}
