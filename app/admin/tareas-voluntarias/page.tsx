import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import { listarParticipantes } from "@/lib/participantes/participantes.service";
import { obtenerTareasVoluntariasAdmin } from "@/lib/tareas-voluntarias/tareas-voluntarias.service";
import { TareasVoluntariasAdminClient } from "./tareas-voluntarias-client";

export const metadata = {
  title: "Tareas Voluntarias | Admin",
};

export default async function TareasVoluntariasPage() {
  let hogarId: string;
  try {
    hogarId = await obtenerHogarActualId();
  } catch {
    redirect("/setup");
  }

  const [participantes, tareas] = await Promise.all([
    listarParticipantes(),
    obtenerTareasVoluntariasAdmin(),
  ]);

  const admin = participantes.find((p) => p.esAdmin);
  const adminId = admin ? admin.id : participantes[0]?.id || "";

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6 lg:p-8 animate-in fade-in">
      <header className="mb-6">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#8c7b68] transition-colors hover:text-[#3b2a1a]"
        >
          <svg
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Volver al panel
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-3xl">⭐</span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#3b2a1a] sm:text-3xl font-display">
              Tareas Voluntarias
            </h1>
            <p className="mt-1 text-sm text-[#8c7b68]">
              Revisa las iniciativas extras propuestas por los integrantes del hogar,
              decide cuántos puntos otorgar o descártalas con un motivo.
            </p>
          </div>
        </div>
      </header>

      <TareasVoluntariasAdminClient tareas={tareas} adminId={adminId} />
    </div>
  );
}
