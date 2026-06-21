"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PerfilParticipante } from "../../lib/home/profile.service";

// ── Tipos ───────────────────────────────────────────────────────────────────

type Props =
  | { estado: "sin_hogar" }
  | {
      estado: "con_usuarios";
      nombreHogar: string;
      participantes: PerfilParticipante[];
    };

// ── Componente principal ────────────────────────────────────────────────────

export function ProfileSelector(props: Props) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      {/* Branding sutil arriba */}
      <div className="mb-10 text-center animate-rise">
        <div
          className="mx-auto mb-4 flex size-[56px] items-center justify-center rounded-2xl text-[28px]"
          style={{
            background: "linear-gradient(158deg, #FCEBB6 0%, #F6D582 100%)",
            boxShadow: "0 8px 20px -8px rgba(120,80,20,.3)",
          }}
        >
          🏠
        </div>
        <h1 className="font-display text-[28px] font-extrabold tracking-[-0.03em] text-tinta">
          Deberes de la Casa
        </h1>
        <p className="mt-1 text-[14px] font-medium text-[#9a8c7c]">
          {props.estado === "sin_hogar"
            ? "Configura tu hogar para empezar"
            : "¿Quién eres?"}
        </p>
      </div>

      {props.estado === "sin_hogar" ? (
        <EstadoSinHogar />
      ) : (
        <EstadoConUsuarios
          nombreHogar={props.nombreHogar}
          participantes={props.participantes}
        />
      )}

      {/* Footer sutil */}
      <p className="mt-12 text-center text-[11px] font-medium text-[#c5b090] animate-rise-delay-2">
        El día cierra a las 3:00 AM · Hora de Caracas
      </p>
    </main>
  );
}

// ── ESTADO A: Sin hogar ─────────────────────────────────────────────────────

function EstadoSinHogar() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center animate-rise-delay-1">
      <button
        type="button"
        onClick={() => router.push("/setup")}
        className="group flex flex-col items-center gap-4 outline-none"
        aria-label="Entrar como Admin para configurar el hogar"
      >
        {/* Círculo grande de Admin */}
        <div className="relative">
          <div
            className="flex size-[140px] items-center justify-center rounded-full transition-transform duration-200 ease-out group-hover:scale-[1.06] group-active:scale-[0.97] group-focus-visible:ring-[3px] group-focus-visible:ring-terracota group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-crema"
            style={{
              background:
                "linear-gradient(158deg, #FBE3D0 0%, #F4C8A8 60%, #EDC09A 100%)",
              boxShadow:
                "0 16px 40px -16px rgba(210,140,80,.45), 0 4px 12px -4px rgba(210,140,80,.2)",
            }}
          >
            <PersonIcon size={64} color="#C49060" />
          </div>
          {/* Brillo decorativo */}
          <div
            className="pointer-events-none absolute -right-1 -top-1 size-[28px] rounded-full opacity-60"
            style={{
              background:
                "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="text-center">
          <p className="font-display text-[20px] font-extrabold tracking-[-0.02em] text-tinta">
            Admin
          </p>
          <p className="mt-0.5 text-[13px] font-semibold text-terracota">
            Toca para configurar →
          </p>
        </div>
      </button>
    </div>
  );
}

// ── ESTADO B: Con usuarios ──────────────────────────────────────────────────

function EstadoConUsuarios({
  nombreHogar,
  participantes,
}: {
  nombreHogar: string;
  participantes: PerfilParticipante[];
}) {
  const router = useRouter();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Todos los participantes son usuarios normales.
  // "Admin" es un perfil fijo del sistema, no un participante.

  const [isPending, startTransition] = useTransition();
  const [loadingUser, setLoadingUser] = useState<string | null>(null);

  // Colores para cada círculo de usuario (se asignan en orden)
  const userColors = [
    {
      bg: "linear-gradient(158deg, #FCEBB6 0%, #F6D582 100%)",
      icon: "#A88430",
      shadow: "0 12px 32px -12px rgba(180,130,40,.4)",
    },
    {
      bg: "linear-gradient(158deg, #FBE3D0 0%, #F4C8A8 100%)",
      icon: "#C49060",
      shadow: "0 12px 32px -12px rgba(210,140,80,.4)",
    },
    {
      bg: "linear-gradient(158deg, #E8F1E2 0%, #D6E9CE 100%)",
      icon: "#5C9A6A",
      shadow: "0 12px 32px -12px rgba(92,154,106,.35)",
    },
  ];

  return (
    <div className="flex w-full max-w-[400px] flex-col items-center">
      {/* Usuarios — TODOS los participantes */}
      <div className="flex w-full items-start justify-center gap-6 animate-rise-delay-1">
        {participantes.map((user, i) => {
          const palette = userColors[i % userColors.length];
          const isLoading = loadingUser === user.id;
          const isOtherLoading = loadingUser !== null && !isLoading;
          return (
            <button
              key={user.id}
              onClick={() => {
                setLoadingUser(user.id);
                startTransition(() => {
                  router.push(`/${encodeURIComponent(user.nombre.toLowerCase())}`);
                });
              }}
              className={`group flex flex-col items-center gap-3 outline-none transition-opacity duration-200 ${isOtherLoading ? "opacity-40 pointer-events-none" : ""}`}
              aria-label={`Entrar como ${user.nombre}`}
            >
              <div className="relative">
                <div
                  className="flex size-[100px] items-center justify-center rounded-full transition-transform duration-200 ease-out group-hover:scale-[1.08] group-active:scale-[0.95] group-focus-visible:ring-[3px] group-focus-visible:ring-terracota group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-crema"
                  style={{
                    background: palette.bg,
                    boxShadow: palette.shadow,
                  }}
                >
                  {user.fotoUrl ? (
                    <img
                      src={user.fotoUrl}
                      alt={user.nombre}
                      className="size-full rounded-full object-cover"
                    />
                  ) : (
                    <PersonIcon size={48} color={palette.icon} />
                  )}
                </div>
                {/* Brillo decorativo */}
                <div
                  className="pointer-events-none absolute -right-0.5 -top-0.5 size-[22px] rounded-full opacity-50"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)",
                  }}
                />
              </div>

              <p className="font-display text-[16px] font-bold tracking-[-0.01em] text-tinta">
                {user.nombre}
              </p>

              {/* Spinner de carga */}
              {isLoading && (
                <span
                  className="inline-block size-[22px] animate-spin rounded-full border-[2.5px] border-[#e6d9c4] border-t-terracota"
                  aria-label="Cargando"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Separador visual */}
      <div className="my-8 flex w-full max-w-[200px] items-center gap-3 animate-rise-delay-2">
        <div className="h-px flex-1 bg-[#dccdb4]" />
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#c5b090]">
          Admin
        </span>
        <div className="h-px flex-1 bg-[#dccdb4]" />
      </div>

      {/* Admin — Perfil fijo del sistema, no es un participante */}
      <div className="animate-rise-delay-2">
        <button
          type="button"
          onClick={() => setShowPasswordModal(true)}
          className="group flex flex-col items-center gap-3 outline-none"
          aria-label="Entrar como Admin (requiere contraseña)"
        >
          <div className="relative">
            <div
              className="flex size-[88px] items-center justify-center rounded-full transition-transform duration-200 ease-out group-hover:scale-[1.08] group-active:scale-[0.95] group-focus-visible:ring-[3px] group-focus-visible:ring-terracota group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-crema"
              style={{
                background:
                  "linear-gradient(158deg, #F0E6D5 0%, #E6D9C4 100%)",
                boxShadow: "0 10px 28px -10px rgba(120,90,50,.3)",
              }}
            >
              <AdminIcon size={40} color="#A0907C" />
            </div>
            {/* Candado */}
            <div
              className="absolute -bottom-1 -right-1 flex size-[30px] items-center justify-center rounded-full bg-crema-card text-[14px]"
              style={{
                boxShadow: "0 2px 8px -2px rgba(60,40,15,.2)",
                border: "2px solid #F0E6D5",
              }}
            >
              🔒
            </div>
          </div>

          <div className="text-center">
            <p className="font-display text-[15px] font-bold tracking-[-0.01em] text-[#7a6d60]">
              Admin
            </p>
            <p className="text-[11px] font-semibold text-[#b19a80]">
              Con contraseña
            </p>
          </div>
        </button>
      </div>

      {/* Modal de contraseña */}
      {showPasswordModal && (
        <PasswordModal onClose={() => setShowPasswordModal(false)} />
      )}
    </div>
  );
}

// ── Modal de contraseña ─────────────────────────────────────────────────────

function PasswordModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus al input al abrir
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cerrar con Escape
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
    setLoading(true);
    setError(false);

    // TODO: Validar la contraseña contra la base de datos.
    // Por ahora, aceptamos cualquier contraseña no vacía para avanzar.
    await new Promise((r) => setTimeout(r, 400)); // Simular latencia

    if (password.trim() === "") {
      setError(true);
      setLoading(false);
      return;
    }

    router.push("/admin");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="animate-fade-in absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ingresar contraseña de Admin"
        className="animate-pop-lg relative z-10 w-full max-w-[360px] rounded-[26px] bg-crema-card p-6 outline-none"
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
              background: "linear-gradient(158deg, #F0E6D5 0%, #E6D9C4 100%)",
              boxShadow: "0 6px 14px -6px rgba(120,80,20,.2)",
            }}
          >
            🔐
          </div>
          <p className="font-display text-[20px] font-extrabold tracking-[-0.02em] text-tinta">
            Panel Admin
          </p>
          <p className="mt-0.5 text-[13px] font-medium text-[#9a8c7c]">
            Ingresa la contraseña para continuar
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="admin-password" className="sr-only">
              Contraseña
            </label>
            <input
              ref={inputRef}
              id="admin-password"
              type="password"
              autoComplete="current-password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              className="w-full rounded-[14px] border-[1.5px] border-[#e6d9c4] bg-[#faf5eb] p-[14px] text-[15px] font-medium text-tinta placeholder:text-[#c5b090] transition-colors focus:border-terracota focus:outline-none focus:ring-[2px] focus:ring-terracota/20"
              aria-invalid={error}
              aria-describedby={error ? "pw-error" : undefined}
            />
            {error && (
              <p
                id="pw-error"
                role="alert"
                className="mt-2 text-[13px] font-semibold text-[#c0392b]"
              >
                La contraseña no puede estar vacía
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2.5 rounded-[16px] p-[16px] font-display text-[17px] font-bold tracking-[-0.01em] text-white transition-all hover:brightness-[1.04] active:scale-[0.975] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta"
            style={{
              background: "linear-gradient(180deg, #E2733F, #D2602F)",
              boxShadow: "0 14px 26px -10px rgba(210,96,47,.75)",
            }}
          >
            {loading ? (
              <span className="inline-block size-[20px] animate-spin rounded-full border-[2.5px] border-white/30 border-t-white" />
            ) : (
              "Entrar"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Iconos SVG ──────────────────────────────────────────────────────────────

/** Ícono de persona genérico para perfiles de usuario. */
function PersonIcon({ size = 48, color = "#A0907C" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" fill={color} opacity="0.85" />
      <path
        d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        fill={color}
        fillOpacity="0.15"
      />
    </svg>
  );
}

/** Ícono de escudo/admin para el perfil de administrador. */
function AdminIcon({ size = 40, color = "#A0907C" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      {/* Escudo */}
      <path
        d="M12 2L4 6v5c0 5.25 3.4 10.15 8 11.4C16.6 21.15 20 16.25 20 11V6l-8-4z"
        fill={color}
        fillOpacity="0.15"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Persona dentro del escudo */}
      <circle cx="12" cy="10" r="2.5" fill={color} opacity="0.7" />
      <path
        d="M8 16.5c0-2.21 1.79-3.5 4-3.5s4 1.29 4 3.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill={color}
        fillOpacity="0.1"
      />
    </svg>
  );
}
