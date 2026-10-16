import { supabase } from "@/lib/db/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

const CANAL_NOMBRE = "dinow-hogar-sync";
let canalGlobal: RealtimeChannel | null = null;

export function registrarCanalGlobal(canal: RealtimeChannel | null) {
  canalGlobal = canal;
}

/**
 * Envía una señal instantánea en tiempo real (WebSocket Broadcast) a todos los
 * dispositivos abiertos del hogar para que refresquen sus pantallas de inmediato
 * cuando alguien marca un deber, cubre a un hermano, reclama un extra o cambia
 * su foto de perfil.
 */
export async function notificarCambioHogar(motivo: string = "actualizacion"): Promise<void> {
  try {
    if (canalGlobal) {
      await canalGlobal.send({
        type: "broadcast",
        event: "cambio_hogar",
        payload: { motivo, ts: Date.now() },
      });
      return;
    }

    const tempChannel = supabase.channel(CANAL_NOMBRE);
    tempChannel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await tempChannel.send({
          type: "broadcast",
          event: "cambio_hogar",
          payload: { motivo, ts: Date.now() },
        });
        setTimeout(() => {
          supabase.removeChannel(tempChannel);
        }, 500);
      }
    });
  } catch {
    // Ignorar errores de red silenciosamente
  }
}

export { CANAL_NOMBRE };
