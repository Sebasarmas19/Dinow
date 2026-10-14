import { redirect } from "next/navigation";
import { ProfileSelector } from "./_components/profile-selector";
import { LandingPage } from "./_components/landing-page";
import { getProfilePageData } from "../lib/home/profile.service";
import {
  verificarSesionActual,
  verificarHogarAutorizado,
} from "@/lib/auth/auth.service";

type Props = {
  searchParams?: Promise<{ cambiar?: string }>;
};

/**
 * Página raíz (/) — flujo de acceso y privacidad (Opción B):
 *
 * 1. Si NO hay hogar configurado en la base de datos → Landing page con setup inicial.
 * 2. Si hay hogar pero este dispositivo/navegador NO tiene la cookie de acceso del hogar
 *    (`dinow_hogar_autorizado`) → Landing page con botón "Entrar a mi hogar 🔑"
 *    para ingresar el código familiar (ej. "armas2026"). Esto evita que visitantes externos
 *    vean los nombres, fotos o perfiles de la familia.
 * 3. Si el dispositivo ya está autorizado:
 *    - Si YA hay sesión activa recordada de un participante (y no se solicitó ?cambiar=1) →
 *      Redirige directo a su panel (/[participanteId]) sin pedir PIN cada vez.
 *    - Si no hay sesión o se pidió cambiar → Muestra el selector de perfiles de la casa.
 */
export default async function Home({ searchParams }: Props) {
  const data = await getProfilePageData();

  if (data.estado === "sin_hogar") {
    return <LandingPage tieneHogar={false} />;
  }

  // 1. Barrera de Privacidad del Hogar:
  // Cualquier visitante externo ve la Landing Page informativa en lugar de los perfiles familiares.
  const hogarAutorizado = await verificarHogarAutorizado();
  if (!hogarAutorizado) {
    return <LandingPage tieneHogar={true} nombreHogar={data.nombreHogar} />;
  }

  // 2. Dispositivo autorizado: comprobar si ya hay sesión activa de usuario/admin
  const sp = searchParams ? await searchParams : {};
  const forzarSelector = sp.cambiar === "1";

  if (!forzarSelector) {
    const sesion = await verificarSesionActual();
    if (sesion) {
      if (sesion.rol === "usuario" && sesion.participanteId) {
        const existe = data.participantes.some(
          (p) => p.id === sesion.participanteId
        );
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
