"use client";

import { useState, useEffect } from "react";
import {
  platformAuthenticatorIsAvailable,
  startRegistration,
} from "@simplewebauthn/browser";
import {
  generarOpcionesRegistroAction,
  verificarRegistroAction,
  listarBiometriasAction,
  eliminarBiometriaAction,
} from "@/lib/auth/webauthn.actions";
import toast from "react-hot-toast";

type Props = {
  participanteId: string;
};

type Credencial = {
  id: string;
  dispositivoNombre: string | null;
  creadoEn: Date | null;
};

export function BiometriaClient({ participanteId }: Props) {
  const [soportado, setSoportado] = useState<boolean | null>(null);
  const [credenciales, setCredenciales] = useState<Credencial[]>([]);
  const [cargando, setCargando] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function verificarSoporte() {
      try {
        const disponible = await platformAuthenticatorIsAvailable();
        if (!cancelado) setSoportado(disponible);
      } catch {
        if (!cancelado) setSoportado(false);
      }
    }

    async function cargarCredenciales() {
      setCargando(true);
      const res = await listarBiometriasAction(participanteId);
      if (!cancelado && res.ok) {
        setCredenciales(res.data);
      }
      if (!cancelado) setCargando(false);
    }

    verificarSoporte();
    cargarCredenciales();

    return () => {
      cancelado = true;
    };
  }, [participanteId]);

  const registrarDispositivo = async () => {
    setRegistrando(true);
    try {
      // 1. Obtener opciones del servidor
      const resOpciones = await generarOpcionesRegistroAction(participanteId);
      if (!resOpciones.ok) {
        toast.error(resOpciones.error);
        setRegistrando(false);
        return;
      }

      // Detectar nombre del dispositivo amigable (ej: iPhone, iPad, Mac)
      let nombreDispositivo = "Este dispositivo";
      if (typeof navigator !== "undefined") {
        const ua = navigator.userAgent;
        if (/iPhone/i.test(ua)) nombreDispositivo = "iPhone (Face ID)";
        else if (/iPad/i.test(ua)) nombreDispositivo = "iPad (Face ID / Touch ID)";
        else if (/Macintosh/i.test(ua)) nombreDispositivo = "Mac (Touch ID)";
        else if (/Android/i.test(ua)) nombreDispositivo = "Android (Biometría)";
        else if (/Windows/i.test(ua)) nombreDispositivo = "Windows (Hello)";
      }

      // 2. Ejecutar la autenticación nativa en el navegador/iOS
      const regResponse = await startRegistration({
        optionsJSON: resOpciones.data,
      });

      // 3. Enviar verificación al servidor
      const resVerif = await verificarRegistroAction(
        participanteId,
        regResponse,
        nombreDispositivo
      );

      if (!resVerif.ok) {
        toast.error(resVerif.error);
      } else {
        toast.success("¡Face ID / Huella activada con éxito! 🎉");
        // Refrescar lista
        const resLista = await listarBiometriasAction(participanteId);
        if (resLista.ok) setCredenciales(resLista.data);
      }
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        toast("Operación cancelada", { icon: "ℹ️" });
      } else {
        toast.error(err.message || "No se pudo vincular la biometría");
      }
    } finally {
      setRegistrando(false);
    }
  };

  const eliminarCredencial = async (id: string) => {
    if (!confirm("¿Deseas desvincular este dispositivo biométrico?")) return;
    try {
      const res = await eliminarBiometriaAction(id, participanteId);
      if (res.ok) {
        toast.success("Dispositivo desvinculado");
        setCredenciales((prev) => prev.filter((c) => c.id !== id));
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Error al desvincular");
    }
  };

  // Si aún no detectamos soporte o el dispositivo no lo permite, no mostramos nada invasivo
  if (soportado === false) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3.5 animate-rise-delay-2">
      <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-[#a0907c] px-1">
        Seguridad y Face ID
      </h3>

      <div className="bg-crema-card border border-[#f0e6d5] rounded-3xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-[22px]"
            style={{
              background: "linear-gradient(158deg, #FBE3D0 0%, #F4C8A8 100%)",
              boxShadow: "0 4px 12px -3px rgba(210,140,80,.3)",
            }}
          >
            🪪
          </div>
          <div>
            <h4 className="font-display text-[16px] font-extrabold text-tinta">
              Acceso con Face ID / Biometría
            </h4>
            <p className="text-[13px] font-medium text-[#7a6d60] mt-0.5 leading-relaxed">
              Inicia sesión al instante mirando a la pantalla de tu iPhone o con tu huella, sin teclear tu PIN cada vez.
            </p>
          </div>
        </div>

        {/* Lista de dispositivos vinculados */}
        {credenciales.length > 0 && (
          <div className="flex flex-col divide-y divide-[#faf5eb] bg-[#faf5eb] rounded-2xl px-3 py-1">
            {credenciales.map((cred) => (
              <div
                key={cred.id}
                className="flex items-center justify-between py-2.5 px-1"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[16px]">📱</span>
                  <div>
                    <p className="text-[13px] font-bold text-tinta">
                      {cred.dispositivoNombre || "Dispositivo biométrico"}
                    </p>
                    <p className="text-[11px] font-medium text-[#a0907c]">
                      {cred.creadoEn
                        ? `Vinculado el ${new Date(cred.creadoEn).toLocaleDateString("es-VE")}`
                        : "Vinculado"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => eliminarCredencial(cred.id)}
                  title="Eliminar dispositivo"
                  className="size-8 rounded-full flex items-center justify-center text-[#c0392b] hover:bg-[#fbe3d0] transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Botón de activación */}
        <button
          type="button"
          onClick={registrarDispositivo}
          disabled={registrando}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 px-4 font-display text-[14px] font-bold text-white transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
          style={{
            background: "linear-gradient(180deg, #E2733F, #D2602F)",
            boxShadow: "0 6px 16px -6px rgba(210,96,47,.6)",
          }}
        >
          {registrando ? (
            <span className="inline-block size-[18px] animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 3H5a2 2 0 0 0-2 2v2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M3 17v2a2 2 0 0 0 2 2h2" />
                <path d="M9 10h.01" />
                <path d="M15 10h.01" />
                <path d="M10 14a2 2 0 0 0 4 0" />
              </svg>
              {credenciales.length > 0
                ? "Vincular otro dispositivo con Face ID"
                : "Activar Face ID en este iPhone"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
