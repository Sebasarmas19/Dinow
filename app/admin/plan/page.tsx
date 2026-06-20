import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import { listarDeberes } from "@/lib/deberes/deberes.repo";
import { listarParticipantes } from "@/lib/participantes/participantes.repo";
import { listarPlanSemanal } from "@/lib/rotacion/plan_semanal.repo";
import { PlanClient } from "./plan-client";
import Link from "next/link";

export const metadata = {
  title: "Plan Semanal | Admin",
};

export default async function AdminPlanPage() {
  const hogarId = await obtenerHogarActualId();

  // 1. Participantes activos (filas de la tabla)
  const participantes = await listarParticipantes(hogarId);

  // 2. Deberes para el plan (rotativos y personales)
  const todosLosDeberes = await listarDeberes(hogarId);
  const deberesParaPlan = todosLosDeberes.filter(
    (d) => d.tipoAsignacion === "rotativo" || d.esPersonal
  );

  // 3. Plan actual
  const planSemanal = await listarPlanSemanal(hogarId);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 lg:p-8">
      <header className="mb-8">
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
          Plan Semanal
        </h1>
        <p className="mt-2 text-sm text-[#735e47]">
          Organiza qué deber fijo hace cada quién en la semana. Desliza para ver todos los días.
        </p>
      </header>

      <PlanClient 
        participantes={participantes} 
        deberes={deberesParaPlan} 
        planInicial={planSemanal} 
      />
    </div>
  );
}
