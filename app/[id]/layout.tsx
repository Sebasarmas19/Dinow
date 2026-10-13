import { redirect } from "next/navigation";
import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import { listarParticipantes } from "@/lib/participantes/participantes.repo";
import { BottomNavBar } from "./bottom-nav-bar";
import { verificarSesionActual } from "@/lib/auth/auth.service";

type Props = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

import { PushManager } from "../_components/push-manager";

export default async function UsuarioLayout({ children, params }: Props) {
  const { id } = await params;

  const hogarId = await obtenerHogarActualId();
  const participantes = await listarParticipantes(hogarId);

  const participanteObj = participantes.find((p) => p.id === id);

  if (!participanteObj) {
    redirect("/");
  }

  const sesion = await verificarSesionActual();
  if (!sesion || sesion.participanteId !== id) {
    redirect("/");
  }

  return (
    <div className="mx-auto min-h-screen max-w-[420px] pb-28 bg-crema">
      {children}
      <BottomNavBar usuario={id} />
      <PushManager participanteId={participanteObj.id} />
    </div>
  );
}
