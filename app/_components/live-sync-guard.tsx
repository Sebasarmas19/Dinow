"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/db/supabase";
import { CANAL_NOMBRE, registrarCanalGlobal } from "@/lib/shared/live-sync";
import { verificarSesionActivaAction } from "@/lib/auth/auth.actions";

type Props = {
  participanteId?: string;
};

/**
 * Componente invisible que cumple dos misiones críticas:
 *
 * 1. Sincronización en Vivo (Live Sync):
 *    - Escucha señales instantáneas por WebSocket (Supabase Broadcast) cuando
 *      otro hermano marca un deber, cubre una tarea, reclama un extra o cambia
 *      su foto de perfil, ejecutando `router.refresh()` al instante.
 *    - Refresca los datos automáticamente al desbloquear el celular o volver a
 *      la aplicación (`visibilitychange` / `focus`).
 *    - Mantiene un pulso silencioso cada 10 segundos mientras la pantalla está
 *      encendida como respaldo ante microcortes de internet móvil.
 *
 * 2. Guardia contra el "Swipe Back" tras Cerrar Sesión:
 *    - Detecta cuando iOS Safari intenta restaurar la pantalla desde la memoria
 *      caché al deslizar hacia atrás (`pageshow` / `popstate`).
 *    - Verifica en el servidor si la sesión sigue activa; si ya se cerró sesión,
 *      expulsa inmediatamente al selector de perfiles (`window.location.replace("/")`).
 */
export function LiveSyncGuard({ participanteId }: Props) {
  const router = useRouter();
  const ultimoRefreshRef = useRef<number>(Date.now());

  useEffect(() => {
    let montado = true;

    const refrescarPantalla = (forzar: boolean = false) => {
      if (!montado) return;
      const ahora = Date.now();
      // Evitar múltiples refrescos simultáneos en menos de 1.5 segundos
      if (!forzar && ahora - ultimoRefreshRef.current < 1500) return;
      ultimoRefreshRef.current = ahora;
      router.refresh();
    };

    const validarSesionYRefrescar = async (forzarRefresh: boolean = false) => {
      if (!montado) return;
      if (participanteId) {
        try {
          const activa = await verificarSesionActivaAction(participanteId);
          if (!activa) {
            window.location.replace("/");
            return;
          }
        } catch {
          // Si hay corte momentáneo de red, no expulsar
        }
      }
      if (forzarRefresh) {
        refrescarPantalla(true);
      }
    };

    // 1. Verificar sesión al montar
    validarSesionYRefrescar(false);

    // 2. Suscribirse al canal de tiempo real del hogar
    const canal = supabase
      .channel(CANAL_NOMBRE, {
        config: {
          broadcast: { self: false },
        },
      })
      .on("broadcast", { event: "cambio_hogar" }, () => {
        refrescarPantalla(true);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          registrarCanalGlobal(canal);
        }
      });

    // 3. Detectar gesto de volver atrás de iOS Safari (BFCache) y popstate
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        validarSesionYRefrescar(true);
      }
    };

    const handlePopState = () => {
      validarSesionYRefrescar(true);
    };

    // 4. Refrescar al desbloquear el teléfono o volver a la pestaña/app
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        validarSesionYRefrescar(true);
      }
    };

    const handleFocus = () => {
      validarSesionYRefrescar(false);
      refrescarPantalla(false);
    };

    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    // 5. Pulso silencioso cada 10s mientras la pantalla esté encendida y visible
    const intervalo = setInterval(() => {
      if (document.visibilityState === "visible") {
        refrescarPantalla(false);
      }
    }, 10000);

    return () => {
      montado = false;
      registrarCanalGlobal(null);
      supabase.removeChannel(canal);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      clearInterval(intervalo);
    };
  }, [participanteId, router]);

  return null;
}
