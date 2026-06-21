import { redirect } from "next/navigation";
import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import { listarParticipantes } from "@/lib/participantes/participantes.repo";
import { BottomNavBar } from "./bottom-nav-bar";

type Props = {
  children: React.ReactNode;
  params: Promise<{ usuario: string }>;
};

export default async function UsuarioLayout({ children, params }: Props) {
  const { usuario } = await params;
  const decodedUsuario = decodeURIComponent(usuario);

  const hogarId = await obtenerHogarActualId();
  const participantes = await listarParticipantes(hogarId);

  const existeUsuario = participantes.some(
    (p) => p.nombre.toLowerCase() === decodedUsuario.toLowerCase()
  );

  if (!existeUsuario) {
    redirect("/");
  }

  // Obtenemos el nombre exacto con casing correcto para pasarlo como parámetro
  const participanteObj = participantes.find(
    (p) => p.nombre.toLowerCase() === decodedUsuario.toLowerCase()
  );
  const usuarioParam = encodeURIComponent(
    (participanteObj?.nombre || decodedUsuario).toLowerCase()
  );

  return (
    <div className="mx-auto min-h-dvh max-w-[420px] pb-24 relative bg-crema">
      {children}
      <BottomNavBar usuario={usuarioParam} />
    </div>
  );
}
