import { db } from "@/lib/db";
import { suscripcionesPush, participantes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:test@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { participanteId } = await req.json();

    if (!participanteId) {
      return Response.json({ error: "Falta participanteId" }, { status: 400 });
    }

    const [part] = await db
      .select()
      .from(participantes)
      .where(eq(participantes.id, participanteId));

    const subs = await db
      .select()
      .from(suscripcionesPush)
      .where(eq(suscripcionesPush.participanteId, participanteId));

    if (subs.length === 0) {
      return Response.json(
        { error: "No hay dispositivos suscritos para este usuario." },
        { status: 404 }
      );
    }

    const payload = JSON.stringify({
      title: `¡Prueba de Dinow para ${part?.nombre || "ti"}! 🔔`,
      body: "Las notificaciones en tu iPhone están configuradas y funcionando al 100%.",
      url: `/${participanteId}`,
    });

    const envios = subs.map((sub) =>
      webpush
        .sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        )
        .catch((err) => {
          console.error("Error al enviar prueba:", err.message);
        })
    );

    await Promise.all(envios);

    return Response.json({ success: true, enviados: subs.length });
  } catch (error: any) {
    console.error("Error en endpoint de prueba push:", error);
    return Response.json(
      { error: error.message || "Error interno" },
      { status: 500 }
    );
  }
}
