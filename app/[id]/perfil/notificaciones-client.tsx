"use client";

import { useState, useEffect } from "react";
import toast from "react-hot-toast";

type Props = {
  participanteId: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function NotificacionesClient({ participanteId }: Props) {
  const [soportado, setSoportado] = useState(false);
  const [permiso, setPermiso] = useState<NotificationPermission>("default");
  const [activando, setActivando] = useState(false);
  const [probando, setProbando] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator) {
      setSoportado(true);
      setPermiso(Notification.permission);
    }
  }, []);

  const suscribir = async () => {
    setActivando(true);
    try {
      // 1. En iOS PWA esto DEBE ser invocado por toque del usuario
      const permissionResult = await Notification.requestPermission();
      setPermiso(permissionResult);

      if (permissionResult !== "granted") {
        toast.error("No se concedió permiso para enviar notificaciones.");
        setActivando(false);
        return;
      }

      // 2. Registrar Service Worker si no está activo
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        toast.error("VAPID public key no configurada.");
        setActivando(false);
        return;
      }

      // 3. Suscribirse
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      // 4. Guardar suscripción en el backend
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participanteId,
          subscription,
        }),
      });

      if (!res.ok) {
        throw new Error("No se pudo registrar la suscripción en el servidor.");
      }

      toast.success("¡Notificaciones activadas en este dispositivo! 🔔");
    } catch (err: any) {
      console.error("Error al activar notificaciones:", err);
      toast.error(err.message || "Error al activar notificaciones");
    } finally {
      setActivando(false);
    }
  };

  const enviarPrueba = async () => {
    setProbando(true);
    try {
      const res = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participanteId }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo enviar la prueba");
      } else {
        toast.success("¡Notificación enviada! Revisa tu pantalla o barra superior 📲");
      }
    } catch {
      toast.error("Error de conexión al enviar prueba");
    } finally {
      setProbando(false);
    }
  };

  if (!soportado) {
    return null;
  }

  const estaActivado = permiso === "granted";

  return (
    <div className="flex flex-col gap-3.5 animate-rise-delay-2">
      <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-[#a0907c] px-1">
        Notificaciones de Deberes
      </h3>

      <div className="bg-crema-card border border-[#f0e6d5] rounded-3xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-[22px]"
            style={{
              background: estaActivado
                ? "linear-gradient(158deg, #E8F1E2 0%, #D6E9CE 100%)"
                : "linear-gradient(158deg, #FCEBB6 0%, #F6D582 100%)",
              boxShadow: "0 4px 12px -3px rgba(180,130,40,.25)",
            }}
          >
            {estaActivado ? "🔔" : "🔕"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-display text-[16px] font-extrabold text-tinta">
                Recordatorios Push
              </h4>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  estaActivado
                    ? "bg-[#d6e9ce] text-[#3d6a42]"
                    : "bg-[#fbe3d0] text-[#a05020]"
                }`}
              >
                {estaActivado ? "Activo" : "Inactivo"}
              </span>
            </div>
            <p className="text-[13px] font-medium text-[#7a6d60] mt-0.5 leading-relaxed">
              Recibe avisos a las 6:00 AM (tu deber del día), 2:00 PM (recordatorio) y 7:00 PM (tareas con puntos extra).
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          {!estaActivado ? (
            <button
              type="button"
              onClick={suscribir}
              disabled={activando}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3 px-4 font-display text-[14px] font-bold text-white transition-all hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
              style={{
                background: "linear-gradient(180deg, #E2733F, #D2602F)",
                boxShadow: "0 6px 16px -6px rgba(210,96,47,.6)",
              }}
            >
              {activando ? (
                <span className="inline-block size-[18px] animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                "🔔 Activar Notificaciones en este iPhone"
              )}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={enviarPrueba}
                disabled={probando}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#dccdb4] bg-[#faf5eb] py-2.5 px-4 font-display text-[13px] font-bold text-tinta transition-all hover:bg-white active:scale-[0.98] disabled:opacity-50"
              >
                {probando ? (
                  <span className="inline-block size-[16px] animate-spin rounded-full border-2 border-tinta/30 border-t-tinta" />
                ) : (
                  "🧪 Enviar Notificación de Prueba Ahora"
                )}
              </button>
              <p className="text-center text-[11px] font-medium text-[#a0907c]">
                ✅ Notificaciones vinculadas. Puedes probar cómo suena y se ve en tu pantalla de bloqueo.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
