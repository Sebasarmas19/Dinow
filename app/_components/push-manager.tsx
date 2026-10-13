"use client";

import { useEffect } from "react";

/**
 * Función para convertir la clave pública VAPID base64 a Uint8Array
 */
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

export function PushManager({ participanteId }: { participanteId: string }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        console.log("Service Worker registrado con éxito");

        // Si ya hay permiso concedido previamente, nos aseguramos de que esté suscrito en background
        if (Notification.permission === "granted") {
          subscribeUser(registration);
        }
      });
    }

    async function subscribeUser(registration: ServiceWorkerRegistration) {
      try {
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          console.error("VAPID public key no configurada");
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        // Enviar la suscripción al backend
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            participanteId,
            subscription,
          }),
        });
      } catch (error) {
        console.error("Fallo al suscribirse al push", error);
      }
    }
  }, [participanteId]);

  return null; // Componente invisible
}
