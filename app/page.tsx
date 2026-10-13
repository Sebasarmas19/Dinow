import { redirect } from "next/navigation";
import { ProfileSelector } from "./_components/profile-selector";
import { LandingPage } from "./_components/landing-page";
import { getProfilePageData } from "../lib/home/profile.service";
import { verificarSesionActual } from "@/lib/auth/auth.service";

type Props = {
  searchParams?: Promise<{ cambiar?: string }>;
};

/**
 * Página raíz — decide qué mostrar según el estado de la app:
 *
 * - Si NO hay hogar configurado → Landing page informativa con botón "Comenzar".
 * - Si YA hay sesión activa recordada (cookie válida por 30 días) y no se pidió cambiar perfil →
 *   Redirige directamente al panel del usuario sin pedir PIN cada vez.
 * - Si no hay sesión o se pidió cambiar → Selector de perfiles (elegir quién eres).
 */
export default async function Home({ searchParams }: Props) {
  const data = await getProfilePageData();

  if (data.estado === "sin_hogar") {
    return <LandingPage />;
  }

  const sp = searchParams ? await searchParams : {};
  const forzarSelector = sp.cambiar === "1";

  if (!forzarSelector) {
    const sesion = await verificarSesionActual();
    if (sesion) {
      if (sesion.rol === "usuario" && sesion.participanteId) {
        const existe = data.participantes.some((p) => p.id === sesion.participanteId);
        if (existe) {
          redirect(`/${sesion.participanteId}`);
        }
      } else if (sesion.rol === "admin") {
        redirect("/admin");
      }
    }
  }

  return (
    <ProfileSelector
      estado="con_usuarios"
      nombreHogar={data.nombreHogar}
      participantes={data.participantes}
    />
  );
}
