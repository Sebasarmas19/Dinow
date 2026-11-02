"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import React, { useEffect } from "react";
import toast from "react-hot-toast";
import type { AdminDashboardData } from "../../lib/home/admin.service";

/**
 * Dashboard del Admin — vista principal después del login.
 *
 * Secciones:
 * 1. Header con ícono de casa + nombre del hogar
 * 2. Banner de alerta de tareas voluntarias pendientes (si las hay)
 * 3. Accesos rápidos (grid de tarjetas con íconos)
 * 4. Plan de la semana (tabla compacta con scroll horizontal)
 */

type AccesoRapido = {
  clave: string;
  icono: string;
  label: string;
  ruta: string;
  bg: string;
  color: string;
  badge?: number;
};

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const accesosRapidos: AccesoRapido[] = [
    {
      clave: "tareas-voluntarias",
      icono: "⭐",
      label: "Tareas Voluntarias",
      ruta: "/admin/tareas-voluntarias",
      bg: "linear-gradient(158deg, #FFE8D6 0%, #F8D0C0 100%)",
      color: "#E2733F",
      badge: data.tareasVoluntariasPendientes,
    },
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

  useEffect(() => {
    if (searchParams.get("onboarding") === "true") {
      setTimeout(() => {
        toast.success("¡Hogar creado! Crea tus primeros deberes aquí.", {
          duration: 6000,
          icon: "🎉",
        });
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }, 500);
    }
  }, [searchParams]);

  return (
    <div className="relative mx-auto max-w-lg px-4 pt-6 pb-16 font-body text-[#3c280f] sm:px-6">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="mb-6 flex items-center justify-between animate-rise">
        <div className="flex items-center gap-3">
          <div
            className="flex size-[42px] items-center justify-center rounded-[14px] text-[20px]"
            style={{
              background: "linear-gradient(158deg, #FCEBB6 0%, #F6D582 100%)",
              boxShadow: "0 6px 14px -6px rgba(120,80,20,.2)",
            }}
          >
            🏠
          </div>
          <div>
            <h1 className="font-display text-[20px] font-extrabold tracking-tight text-[#3c280f]">
              {data.nombreHogar}
            </h1>
            <p className="text-[13px] font-semibold text-[#9a8c7c]">
              Panel de administración
            </p>
          </div>
        </div>

        {/* Botón salir */}
        <button
          type="button"
          onClick={async () => {
            const { logoutAction } = await import("@/lib/auth/auth.actions");
            await logoutAction();
            router.push("/");
          }}
          aria-label="Cerrar sesión de admin"
          className="flex size-[38px] items-center justify-center rounded-full bg-[#b19a80] text-[16px] font-bold text-white shadow-sm transition-colors hover:bg-[#9a8c7c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota"
        >
          ←
        </button>
      </header>

      {/* ─── Banner de alerta de tareas voluntarias pendientes ───────────── */}
      {data.tareasVoluntariasPendientes > 0 && (
        <div className="mb-6 rounded-[22px] bg-gradient-to-r from-[#FFF4EC] to-[#FCEBB6] border border-[#E6B79C] p-4 flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#E2733F] text-white text-lg shadow-sm shrink-0">
              ⭐
            </span>
            <div>
              <span className="block font-display text-sm font-extrabold text-[#3B2A1A]">
                {data.tareasVoluntariasPendientes}{" "}
                {data.tareasVoluntariasPendientes === 1
                  ? "tarea voluntaria pendiente"
                  : "tareas voluntarias pendientes"}
              </span>
              <span className="block text-xs font-medium text-[#8C7B68]">
                Iniciativas enviadas por los hermanos para validar puntos.
              </span>
            </div>
          </div>
          <Link
            href="/admin/tareas-voluntarias"
            className="px-3.5 py-2 rounded-xl bg-[#E2733F] text-white font-display text-xs font-extrabold hover:opacity-95 active:scale-95 transition-all shadow-sm shrink-0"
          >
            Revisar
          </Link>
        </div>
      )}

      {/* ─── Accesos Rápidos ────────────────────────────────────────────── */}
      <section aria-label="Accesos rápidos" className="mb-8 animate-rise-delay-1">
        <h2 className="mb-4 text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#b19a80]">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {accesosRapidos.map((acceso) => {
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
                {/* Badge de pendientes si aplica */}
                {acceso.badge && acceso.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-[#E2733F] text-[10px] font-extrabold text-white shadow-sm">
                    {acceso.badge}
                  </span>
                ) : null}

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

        {data.planSemanal.length === 0 ? (
          <div className="rounded-[20px] bg-white p-6 text-center shadow-sm border border-[#efe1c6]">
            <p className="text-[13.5px] font-medium text-[#b19a80]">
              No hay deberes configurados en la plantilla aún.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[20px] border border-[#f0e6d5] bg-crema-card shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#f0e6d5] bg-[#f9f3ea]">
                  <th className="p-3 text-[12px] font-extrabold text-[#7a6a5a]">
                    Participante
                  </th>
                  {data.diasLabels.map((d) => (
                    <th
                      key={d.clave}
                      className="p-3 text-center text-[12px] font-extrabold text-[#7a6a5a]"
                    >
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.planSemanal.map((fila, i) => (
                  <tr
                    key={fila.participanteNombre}
                    className={`border-b border-[#f0e6d5] last:border-b-0 ${
                      i % 2 === 0 ? "bg-white" : "bg-[#fcf9f5]"
                    }`}
                  >
                    <td className="p-3 text-[13px] font-bold text-[#3c280f]">
                      {fila.participanteNombre}
                    </td>
                    {data.diasLabels.map((d) => {
                      const tareas = fila.dias[d.clave] || [];
                      return (
                        <td
                          key={d.clave}
                          className="p-2 text-center text-[12px] text-[#5a4d40]"
                        >
                          {tareas.length > 0 ? (
                            <span className="inline-block rounded-md bg-[#e8f1e2] px-2 py-1 font-semibold text-[#4e825a]">
                              {tareas.join(", ")}
                            </span>
                          ) : (
                            <span className="text-[#c8b8a8]">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
