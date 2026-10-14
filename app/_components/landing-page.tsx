"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { validarCodigoHogarAction } from "@/lib/auth/auth.actions";

interface LandingPageProps {
  tieneHogar?: boolean;
  nombreHogar?: string;
}

/**
 * Landing page — la primera vista pública que ve cualquier usuario o visitante externo.
 *
 * - Si el hogar ya existe: Muestra el botón seguro "Entrar a mi hogar 🔑" que abre
 *   el modal para validar el código de acceso familiar (ej. "armas2026").
 * - Si no existe hogar: Muestra el botón "Crear hogar" que lleva al wizard de setup.
 */
export function LandingPage({ tieneHogar = false, nombreHogar }: LandingPageProps) {
  const router = useRouter();
  const [modalAbierto, setModalAbierto] = useState(false);

  return (
    <main className="flex min-h-dvh flex-col bg-[#FBF7F0]">
      {/* ─── Hero Section ───────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-6 pt-12">
        {/* Logo / Branding */}
        <div className="mb-8 animate-rise">
          <div
            className="mx-auto mb-3 flex size-[52px] items-center justify-center rounded-2xl text-[26px]"
            style={{
              background: "linear-gradient(158deg, #FCEBB6 0%, #F6D582 100%)",
              boxShadow: "0 8px 20px -8px rgba(120,80,20,.3)",
            }}
          >
            🏠
          </div>
          <p className="text-center text-[12px] font-bold uppercase tracking-[0.15em] text-[#b19a80]">
            Sistema de deberes
          </p>
        </div>

        {/* Titular principal */}
        <div className="mb-6 max-w-[360px] text-center animate-rise-delay-1">
          <h1 className="font-display text-[32px] font-extrabold leading-[1.1] tracking-[-0.03em] text-tinta">
            Organiza los deberes{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #E2733F, #D2602F)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              de tu hogar
            </span>
          </h1>
          <p className="mt-3 text-[15px] font-medium leading-[1.5] text-[#7a6d60]">
            Reparte las tareas de la casa de forma justa con rotación automática,
            sistema de puntos, rankings y logros. Todo el hogar organizado.
          </p>
        </div>

        {/* Imagen hero */}
        <div className="mb-8 w-full max-w-[340px] animate-rise-delay-1">
          <div
            className="overflow-hidden rounded-[24px]"
            style={{
              boxShadow: "0 16px 40px -16px rgba(60,40,15,.15)",
            }}
          >
            <img
              src="/landing-hero.png"
              alt="Familia haciendo deberes del hogar juntos"
              className="w-full object-cover"
              loading="eager"
            />
          </div>
        </div>

        {/* Features rápidos */}
        <div className="mb-8 grid w-full max-w-[340px] grid-cols-3 gap-3 animate-rise-delay-2">
          {[
            { icono: "🔄", label: "Rotación justa" },
            { icono: "⭐", label: "Puntos y logros" },
            { icono: "🏆", label: "Rankings" },
          ].map((f) => (
            <div
              key={f.label}
              className="flex flex-col items-center gap-1.5 rounded-[14px] border border-[#f0e6d5] bg-crema-card px-3 py-3 text-center"
              style={{ boxShadow: "0 2px 8px -4px rgba(60,40,15,.08)" }}
            >
              <span className="text-[20px]">{f.icono}</span>
              <span className="text-[11px] font-bold text-[#7a6d60]">
                {f.label}
              </span>
            </div>
          ))}
        </div>

        {/* Botones de acción */}
        <div className="flex w-full max-w-[340px] flex-col items-center gap-3 animate-rise-delay-2">
          {tieneHogar ? (
            <>
              <button
                type="button"
                onClick={() => setModalAbierto(true)}
                className="flex w-full items-center justify-center gap-2.5 rounded-[18px] p-[18px] font-display text-[18px] font-bold tracking-[-0.01em] text-white transition-all hover:brightness-[1.04] active:scale-[0.975] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
                style={{
                  background: "linear-gradient(180deg, #E2733F, #D2602F)",
                  boxShadow:
                    "0 16px 32px -12px rgba(210,96,47,.7), 0 4px 12px -4px rgba(210,96,47,.3)",
                }}
              >
                Entrar a mi hogar 🔑
              </button>
              <button
                type="button"
                onClick={() => router.push("/setup")}
                className="text-center text-[13px] font-semibold text-[#8e7e6e] transition-colors hover:text-terracota"
              >
                ¿Crear otro hogar? Empezar setup →
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/setup")}
              className="flex w-full items-center justify-center gap-2.5 rounded-[18px] p-[18px] font-display text-[18px] font-bold tracking-[-0.01em] text-white transition-all hover:brightness-[1.04] active:scale-[0.975] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
              style={{
                background: "linear-gradient(180deg, #E2733F, #D2602F)",
                boxShadow:
                  "0 16px 32px -12px rgba(210,96,47,.7), 0 4px 12px -4px rgba(210,96,47,.3)",
              }}
            >
              Crear hogar
              <span aria-hidden="true" className="text-[16px]">
                →
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Modal de Acceso al Hogar */}
      {modalAbierto && (
        <ModalCodigoHogar
          nombreHogar={nombreHogar}
          onClose={() => setModalAbierto(false)}
        />
      )}

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer className="px-5 pb-6 pt-4 text-center">
        <p className="text-[11px] font-medium text-[#c5b090]">
          Hecho con ❤️ para el hogar · El día cierra a las 3:00 AM
        </p>
      </footer>
    </main>
  );
}

// ── Modal para ingresar el código del hogar ──────────────────────────────────

function ModalCodigoHogar({
  nombreHogar,
  onClose,
}: {
  nombreHogar?: string;
  onClose: () => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [cargando, setCargando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Bloquear scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo.trim()) {
      setErrorMsg("Por favor escribe el código del hogar");
      return;
    }

    setCargando(true);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("codigo", codigo.trim());

    const res = await validarCodigoHogarAction(formData);

    if (!res.ok) {
      setErrorMsg(res.error || "Código incorrecto");
      setCargando(false);
      return;
    }

    // Autorizado exitosamente en este dispositivo.
    // Recargamos para que el servidor evalúe la cookie y muestre perfiles / redirija al dashboard.
    window.location.reload();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in" />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ingresar código de acceso del hogar"
        className="relative z-10 w-full max-w-[360px] rounded-[26px] bg-crema-card p-6 outline-none animate-pop-lg"
        style={{
          boxShadow: "0 20px 50px -16px rgba(60,40,15,.3)",
        }}
      >
        {/* Cerrar */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-[#f0e6d5] text-[14px] text-[#9a8c7c] transition-colors hover:bg-[#e6d9c4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracota"
        >
          ✕
        </button>

        {/* Icono + Título */}
        <div className="flex flex-col items-center pb-5 pt-2">
          <div
            className="mb-3 flex size-[52px] items-center justify-center rounded-full text-[26px]"
            style={{
              background: "linear-gradient(158deg, #FCEBB6 0%, #F6D582 100%)",
              boxShadow: "0 6px 14px -6px rgba(120,80,20,.2)",
            }}
          >
            🔑
          </div>
          <h2 className="font-display text-[20px] font-extrabold tracking-[-0.02em] text-tinta">
            Acceso al Hogar
          </h2>
          <p className="mt-1 text-center text-[13px] font-medium text-[#9a8c7c]">
            {nombreHogar
              ? `Ingresa el código familiar de ${nombreHogar}`
              : "Ingresa el código de acceso de tu casa"}
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <input
              ref={inputRef}
              type="password"
              placeholder="Código de acceso familiar"
              value={codigo}
              onChange={(e) => {
                setCodigo(e.target.value);
                setErrorMsg("");
              }}
              className="w-full rounded-[14px] border-[1.5px] border-[#e6d9c4] bg-[#faf5eb] p-[14px] text-center text-[16px] font-semibold text-tinta transition-colors placeholder:font-normal placeholder:text-[#b19a80] focus:border-terracota focus:outline-none focus:ring-[2px] focus:ring-terracota/20"
            />
            {errorMsg && (
              <p
                role="alert"
                className="mt-2 text-center text-[13px] font-semibold text-[#c0392b]"
              >
                {errorMsg}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="flex w-full items-center justify-center gap-2.5 rounded-[16px] p-[16px] font-display text-[17px] font-bold tracking-[-0.01em] text-white transition-all hover:brightness-[1.04] active:scale-[0.975] disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "linear-gradient(180deg, #E2733F, #D2602F)",
              boxShadow: "0 14px 26px -10px rgba(210,96,47,.75)",
            }}
          >
            {cargando ? (
              <span className="inline-block size-[20px] animate-spin rounded-full border-[2.5px] border-white/30 border-t-white" />
            ) : (
              "Ingresar"
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] font-medium text-[#b19a80]">
          💡 Solo necesitas ingresarlo una vez por dispositivo o navegador.
        </p>
      </div>
    </div>
  );
}
