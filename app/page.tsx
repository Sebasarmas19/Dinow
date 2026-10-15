import { redirect } from "next/navigation";
import { ProfileSelector } from "./_components/profile-selector";
import { LandingPage } from "./_components/landing-page";
import { getProfilePageData } from "../lib/home/profile.service";
import {
  verificarSesionActual,
  verificarHogarAutorizado,
  garantizarHogarCookie,
} from "@/lib/auth/auth.service";

type Props = {
  searchParams?: Promise<{ cambiar?: string }>;
};

/**
 * Página raíz (/) — flujo de acceso y privacidad (Opción B perfeccionada):
 *
 * 1. Si NO hay hogar configurado en la base de datos → Landing page con setup inicial.
 * 2. Si el usuario YA tiene sesión activa recordada de un participante (y no se solicitó ?cambiar=1) →
 *    Redirige directo a su panel (/[participanteId]) sin pedir PIN ni código de la casa.
 * 3. Si no hay sesión activa de usuario:
 *    - Si este dispositivo/navegador NO tiene la cookie de acceso del hogar (`dinow_hogar_autorizado`) →
 *      Landing page con botón "Entrar a mi hogar 🔑" para ingresar el código familiar (ej. "armas2026").
 *    - Si el dispositivo ya ingresó el código familiar → Muestra el selector de perfiles (Samuel, Silvana, Sebastián).
 */
export default async function Home({ searchParams }: Props) {
  const data = await getProfilePageData();

  if (data.estado === "sin_hogar") {
    return <LandingPage tieneHogar={false} />;
  }

  const sp = searchParams ? await searchParams : {};
  const forzarSelector = sp.cambiar === "1";

  // 1. Si el usuario ya tiene sesión activa recordada: entra DIRECTO a su dashboard.
  if (!forzarSelector) {
    const sesion = await verificarSesionActual();
    if (sesion) {
      if (sesion.rol === "usuario" && sesion.participanteId) {
        const existe = data.participantes.some(
          (p) => p.id === sesion.participanteId
        );
        if (existe) {
          await garantizarHogarCookie();
          redirect(`/${sesion.participanteId}`);
        }
      } else if (sesion.rol === "admin") {
        await garantizarHogarCookie();
        redirect("/admin");
      }
    }
  }

  // 2. Si no hay sesión activa: verificar si el dispositivo está autorizado para ver perfiles familiares.
  const hogarAutorizado = await verificarHogarAutorizado();
  if (!hogarAutorizado) {
    return <LandingPage tieneHogar={true} nombreHogar={data.nombreHogar} />;
  }

  // 3. Dispositivo autorizado: selector de perfiles de la casa.
  return (
    <ProfileSelector
      estado="con_usuarios"
      nombreHogar={data.nombreHogar}
      participantes={data.participantes}
    />
  );
}
