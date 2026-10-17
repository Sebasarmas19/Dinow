import { HomeScreen } from "../_components/home-screen";
import { getHomeScreenData } from "../../lib/home/home.service";
import { redirect } from "next/navigation";

/**
 * Vista principal del usuario — ahora vive en /[usuario].
 *
 * El nombre del usuario se saca directamente del segmento de la URL.
 * Ejemplo: /samuel → muestra los deberes desde la perspectiva de Samuel.
 */

type Props = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export default async function UsuarioHome({ params }: Props) {
  const { id } = await params;

  try {
    const data = await getHomeScreenData(id);

    return (
      <HomeScreen
        miId={data.miId}
        variant="plain"
        userName={data.userName}
        dateLabel={data.dateLabel}
        deberesHoy={data.deberesHoy}
        hermanos={data.hermanos}
        extras={data.extras}
        puntosBase={data.puntosBase}
        posicionLabel={data.posicionLabel}
        deberManana={data.deberManana}
        intercambiosPendientes={data.intercambiosPendientes}
        bonoAyuda={data.bonoAyuda}
      />
    );
  } catch {
    // Si el usuario no existe o no hay hogar, redirigir al selector de perfiles.
    redirect("/");
  }
}
