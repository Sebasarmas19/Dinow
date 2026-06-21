import { Metadata } from "next";
import { listarAuditoriaReciente, listarHistorialUsuariosReciente } from "@/lib/auditoria/auditoria.service";
import { listarParticipantes } from "@/lib/participantes/participantes.service";
import { AuditoriaClient } from "./auditoria-client";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Auditoría e Historial | Admin",
};

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  const [participantes, auditoriaAdmin, historialUsuarios] = await Promise.all([
    listarParticipantes(),
    listarAuditoriaReciente(),
    listarHistorialUsuariosReciente(),
  ]);

  // (Sin usar revalidatePath en render)

  return (
    <div className="mx-auto max-w-lg p-4 md:p-6 lg:max-w-2xl lg:p-8">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-[#8c7b68] transition-colors hover:text-[#3b2a1a]"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Volver al panel
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#3b2a1a] lg:text-3xl">
              Bitácora de Eventos
            </h1>
            <p className="mt-1 text-sm font-medium text-[#a39481]">
              Historial de acciones de las últimas 2 semanas.
            </p>
          </div>
        </div>
      </div>

      <AuditoriaClient
        participantes={participantes}
        auditoriaAdmin={auditoriaAdmin}
        historialUsuarios={historialUsuarios}
      />
    </div>
  );
}
