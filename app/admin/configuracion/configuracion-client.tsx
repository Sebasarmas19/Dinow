"use client";

import React, { useState, useTransition } from "react";
import { actualizarConfiguracionHogarAction } from "@/lib/hogar/hogar.actions";
import { Hogar } from "@/lib/hogar/hogar.repo";

type ConfiguracionClientProps = {
  hogar: Hogar;
  adminId: string;
};

export function ConfiguracionClient({ hogar, adminId }: ConfiguracionClientProps) {
  const [nombre, setNombre] = useState(hogar.nombre);
  // Postgres time type includes seconds (e.g. "03:00:00"). Safari/iOS type="time" breaks if it receives seconds.
  // We slice it to "HH:mm" (first 5 chars) so native pickers work perfectly and don't overflow.
  const [horaCierreDia, setHoraCierreDia] = useState(hogar.horaCierreDia.substring(0, 5));
  const [claveAdmin, setClaveAdmin] = useState(hogar.claveAdmin);
  
  // Puntos
  const [bonoAyuda, setBonoAyuda] = useState(hogar.bonoAyuda);
  const [penalizacionFallo, setPenalizacionFallo] = useState(hogar.penalizacionFallo);
  const [penalizacionColectiva, setPenalizacionColectiva] = useState(hogar.penalizacionColectiva);

  const [verClave, setVerClave] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ mensaje: string; tipo: "exito" | "error" } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("hogarId", hogar.id);
    formData.append("adminId", adminId);
    formData.append("nombre", nombre);
    formData.append("horaCierreDia", horaCierreDia);
    formData.append("claveAdmin", claveAdmin);
    formData.append("bonoAyuda", bonoAyuda);
    formData.append("penalizacionFallo", penalizacionFallo);
    formData.append("penalizacionColectiva", penalizacionColectiva);

    startTransition(async () => {
      const res = await actualizarConfiguracionHogarAction(formData);
      if (res.ok) {
        setToast({ mensaje: "Configuración guardada con éxito", tipo: "exito" });
      } else {
        setToast({ mensaje: res.error || "Ocurrió un error al guardar", tipo: "error" });
      }
      setTimeout(() => setToast(null), 3000);
    });
  };

  return (
    <div className="relative pb-24">
      {/* TOAST */}
      {toast && (
        <div
          className={`fixed bottom-8 left-1/2 z-50 flex w-[90%] max-w-sm -translate-x-1/2 transform items-center gap-3 rounded-2xl p-4 shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
            toast.tipo === "exito"
              ? "bg-[#2c3e2a] text-white"
              : "bg-[#7d2f2f] text-white"
          }`}
        >
          <div className="flex size-8 items-center justify-center rounded-full bg-white/20 text-lg">
            {toast.tipo === "exito" ? "✨" : "⚠️"}
          </div>
          <span className="text-[14px] font-bold">{toast.mensaje}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        
        {/* SECCIÓN 1: Ajustes Generales */}
        <section className="rounded-3xl border border-[#f4ecdd] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#faf5eb] text-xl">🏠</span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#3b2a1a]">Ajustes Generales</h2>
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <label htmlFor="nombre" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#8c7b68]">
                Nombre del Hogar
              </label>
              <input
                id="nombre"
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-xl border-2 border-[#e8dcc4] bg-white p-3 text-sm font-medium text-[#3b2a1a] focus:border-[#3b2a1a] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="horaCierreDia" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#8c7b68]">
                Hora de Cierre del Día
              </label>
              <input
                id="horaCierreDia"
                type="time"
                required
                value={horaCierreDia}
                onChange={(e) => setHoraCierreDia(e.target.value)}
                className="w-full max-w-full appearance-none rounded-xl border-2 border-[#e8dcc4] bg-white p-3 text-sm font-medium text-[#3b2a1a] focus:border-[#3b2a1a] focus:outline-none"
              />
              <p className="mt-2 text-[11px] font-medium leading-relaxed text-[#a39481]">
                <strong>Nota:</strong> Esta hora determina cuándo se pasa al siguiente día. Es altamente recomendable configurarla de madrugada (ej. 02:00 o 03:00) para que las tareas hechas tarde por la noche cuenten para el día actual.
              </p>
            </div>

            <div>
              <label htmlFor="claveAdmin" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#8c7b68]">
                Contraseña de Admin
              </label>
              <div className="relative">
                <input
                  id="claveAdmin"
                  type={verClave ? "text" : "password"}
                  required
                  value={claveAdmin}
                  onChange={(e) => setClaveAdmin(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#e8dcc4] bg-white p-3 text-sm font-medium text-[#3b2a1a] focus:border-[#3b2a1a] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setVerClave(!verClave)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#8c7b68] hover:text-[#3b2a1a]"
                >
                  {verClave ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 2: Sistema de Puntos */}
        <section className="rounded-3xl border border-[#f4ecdd] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#faf5eb] text-xl">⭐</span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#3b2a1a]">Sistema de Puntuación</h2>
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <label htmlFor="bonoAyuda" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#8c7b68]">
                Bono por Ayuda (Solidaridad)
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[#4a7c59] font-black text-xl">+</span>
                <input
                  id="bonoAyuda"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={bonoAyuda}
                  onChange={(e) => setBonoAyuda(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#e8dcc4] bg-white p-3 text-sm font-bold text-[#4a7c59] focus:border-[#4a7c59] focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-[#a39481]">Puntos extra que se ganan por cubrir a otra persona.</p>
            </div>

            <hr className="border-[#f4ecdd]" />

            <div>
              <label htmlFor="penalizacionFallo" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#8c7b68]">
                Penalización por Fallar (No hacer deber)
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[#b84a4a] font-black text-xl">-</span>
                <input
                  id="penalizacionFallo"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={penalizacionFallo}
                  onChange={(e) => setPenalizacionFallo(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#e8dcc4] bg-white p-3 text-sm font-bold text-[#b84a4a] focus:border-[#b84a4a] focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-[#a39481]">Puntos que se restan por no hacer tu deber (se usa valor absoluto).</p>
            </div>

            <div>
              <label htmlFor="penalizacionColectiva" className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#8c7b68]">
                Penalización Colectiva (Deber Inamovible)
              </label>
              <div className="flex items-center gap-3">
                <span className="text-[#b84a4a] font-black text-xl">-</span>
                <input
                  id="penalizacionColectiva"
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={penalizacionColectiva}
                  onChange={(e) => setPenalizacionColectiva(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#e8dcc4] bg-white p-3 text-sm font-bold text-[#b84a4a] focus:border-[#b84a4a] focus:outline-none"
                />
              </div>
              <p className="mt-1 text-[11px] text-[#a39481]">Se resta a TODOS si un deber obligatorio no lo hace nadie.</p>
            </div>
          </div>
        </section>

        {/* Botón Guardar */}
        <button
          type="submit"
          disabled={isPending}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#3b2a1a] py-4 text-[15px] font-bold text-white shadow-xl transition-all hover:bg-[#2a1d12] disabled:opacity-50"
        >
          {isPending ? (
            <span className="animate-pulse">Guardando Cambios...</span>
          ) : (
            "Guardar Configuración"
          )}
        </button>
      </form>
    </div>
  );
}
