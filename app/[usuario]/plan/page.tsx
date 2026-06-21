import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import { listarParticipantes } from "@/lib/participantes/participantes.repo";
import { listarDeberes } from "@/lib/deberes/deberes.repo";
import { listarPlanSemanal } from "@/lib/rotacion/plan_semanal.repo";

type Props = {
  params: Promise<{ usuario: string }>;
};

export default async function PlanSemanalPage({ params }: Props) {
  const { usuario } = await params;
  const decodedUsuario = decodeURIComponent(usuario);

  const hogarId = await obtenerHogarActualId();
  const participantes = await listarParticipantes(hogarId);

  const yo = participantes.find(
    (p) => p.nombre.toLowerCase() === decodedUsuario.toLowerCase()
  );

  if (!yo) {
    redirect("/");
  }

  // Obtenemos los deberes y el plan semanal
  const chores = await listarDeberes(hogarId);
  const planRows = await listarPlanSemanal(hogarId);

  // Días de la semana ordenados de Lunes a Domingo
  const DAYS_OF_WEEK = [
    { index: 1, name: "Lunes" },
    { index: 2, name: "Martes" },
    { index: 3, name: "Miércoles" },
    { index: 4, name: "Jueves" },
    { index: 5, name: "Viernes" },
    { index: 6, name: "Sábado" },
    { index: 0, name: "Domingo" },
  ];

  function getEmojiForDeber(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes("cocina")) return "🍳";
    if (n.includes("plato") || n.includes("lava")) {
      if (n.includes("ropa")) return "🧺";
      return "🍽️";
    }
    if (n.includes("sofi") || n.includes("perro") || n.includes("mascota"))
      return "🐾";
    if (n.includes("ropa")) return "🧺";
    if (n.includes("limpie") || n.includes("profunda")) return "🧹";
    if (n.includes("basura")) return "🗑️";
    return "📋";
  }

  return (
    <main className="p-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-rise">
        <h1 className="font-display text-[26px] font-extrabold text-tinta tracking-tight">
          Plan Semanal
        </h1>
      </div>

      <p className="text-[14px] font-medium text-[#9a8c7c] -mt-3 animate-rise">
        📅 Distribución fija de deberes obligatorios del hogar para la semana.
      </p>

      {/* Lista de Tarjetas de Días */}
      <div className="flex flex-col gap-4 animate-rise-delay-1">
        {DAYS_OF_WEEK.map((day) => {
          return (
            <div
              key={day.name}
              className="bg-crema-card border border-[#f0e6d5] rounded-3xl p-5 shadow-sm flex flex-col gap-3.5"
            >
              {/* Título del Día */}
              <h2 className="font-display text-[17px] font-extrabold text-terracota border-b border-[#faf5eb] pb-2">
                {day.name}
              </h2>

              {/* Participantes y sus deberes asignados */}
              <div className="flex flex-col gap-3">
                {participantes.map((part) => {
                  const isMe = part.id === yo.id;

                  // Filtrar deberes asignados a este participante para este día
                  const assignedRows = planRows.filter(
                    (row) =>
                      row.diaSemana === day.index &&
                      row.participanteId === part.id
                  );

                  const assignedChores = assignedRows
                    .map((row) => chores.find((c) => c.id === row.deberId))
                    .filter((c): c is NonNullable<typeof c> => !!c);

                  return (
                    <div
                      key={part.id}
                      className="flex items-center justify-between py-1.5"
                    >
                      {/* Avatar e Identificación del Participante */}
                      <div className="flex items-center gap-2">
                        <div
                          className={`size-8 rounded-full flex items-center justify-center text-[12px] font-bold border ${
                            isMe
                              ? "bg-[#fcebb6] border-[#f6d582] text-[#a88430]"
                              : "bg-[#fbf3e4] border-[#dccdb4] text-tinta"
                          }`}
                        >
                          {part.nombre.charAt(0).toUpperCase()}
                        </div>
                        <span
                          className={`text-[15px] ${
                            isMe ? "font-extrabold text-terracota" : "font-bold text-tinta"
                          }`}
                        >
                          {part.nombre} {isMe && "(Tú)"}
                        </span>
                      </div>

                      {/* Lista de deberes en formato tag */}
                      <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
                        {assignedChores.length > 0 ? (
                          assignedChores.map((chore) => (
                            <span
                              key={chore.id}
                              className="text-[12px] font-bold text-[#38302a] bg-[#faf5eb] border border-[#e6d9c4] px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-sm"
                            >
                              <span>{getEmojiForDeber(chore.nombre)}</span>
                              <span>{chore.nombre}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-[12px] font-semibold text-[#a0907c] bg-[#faf5eb]/30 border border-[#faf5eb] px-2.5 py-1 rounded-xl italic flex items-center gap-1 select-none">
                            <span>🌴</span>
                            <span>Día libre</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
