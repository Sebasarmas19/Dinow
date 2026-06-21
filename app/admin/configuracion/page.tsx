import { obtenerHogarActual } from "@/lib/hogar/hogar.service";
import { listarParticipantes } from "@/lib/participantes/participantes.service";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ConfiguracionClient } from "./configuracion-client";

export const metadata = {
  title: "Configuración | Admin",
};

export default async function ConfiguracionPage() {
  const hogar = await obtenerHogarActual();
  if (!hogar) {
    redirect("/setup");
  }

  // Obtenemos los participantes para buscar al adminId (autor de las auditorías)
  const participantes = await listarParticipantes();
  const admin = participantes.find((p) => p.esAdmin);
  const adminId = admin ? admin.id : participantes[0]?.id;

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6 lg:p-8 animate-in fade-in">
      <header className="mb-6">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#8c7b68] transition-colors hover:text-[#3b2a1a]"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Volver al panel
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#3b2a1a] sm:text-3xl">
          Configuración del Hogar
        </h1>
        <p className="mt-2 text-sm text-[#8c7b68]">
          Modifica las reglas globales, el sistema de puntuación y los datos principales.
        </p>
      </header>

      <ConfiguracionClient hogar={hogar} adminId={adminId} />
    </div>
  );
}
