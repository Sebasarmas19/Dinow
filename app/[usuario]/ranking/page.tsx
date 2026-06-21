import Link from "next/link";
import { redirect } from "next/navigation";
import { calcularRankings } from "@/lib/rankings/rankings.service";
import { obtenerFechaDeNegocio, formatearFechaISO } from "@/lib/shared/date";
import { RankingClient } from "./ranking-client";

type Props = {
  params: Promise<{ usuario: string }>;
  searchParams: Promise<{ mes?: string }>;
};

export default async function RankingPage({ params, searchParams }: Props) {
  const { usuario } = await params;
  const { mes } = await searchParams;

  const currentBusinessDate = obtenerFechaDeNegocio();
  const currentMonthStr = formatearFechaISO(currentBusinessDate).slice(0, 7);
  const mesActual = mes || currentMonthStr;

  // Validamos el formato YYYY-MM
  if (!/^\d{4}-\d{2}$/.test(mesActual)) {
    redirect(`/${usuario}/ranking?mes=${currentMonthStr}`);
  }

  const [yearStr, monthStr] = mesActual.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);

  if (month < 1 || month > 12) {
    redirect(`/${usuario}/ranking?mes=${currentMonthStr}`);
  }

  // Calculamos los rankings para el mes seleccionado
  const rankings = await calcularRankings(mesActual);

  // Navegación de meses
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const prevMesStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth === 13) {
    nextMonth = 1;
    nextYear += 1;
  }
  const nextMesStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;

  const MESES = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const monthName = MESES[month - 1];
  const labelMes = `${monthName} ${year}`;

  return (
    <main className="p-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 animate-rise">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-[26px] font-extrabold text-tinta tracking-tight">
            Rankings Mensuales
          </h1>
        </div>

        {/* Selector de Mes */}
        <div className="flex items-center justify-between bg-crema-card border border-[#f0e6d5] rounded-2xl p-3 shadow-sm">
          <Link
            href={`/${usuario}/ranking?mes=${prevMesStr}`}
            className="flex size-9 items-center justify-center rounded-xl bg-[#faf5eb] border border-[#f0e6d5] text-[#7a6d60] font-bold transition-all hover:bg-[#f0e6d5] active:scale-95 select-none"
            aria-label="Mes anterior"
          >
            ←
          </Link>
          <span className="font-display text-[15px] font-extrabold text-tinta">
            {labelMes}
          </span>
          <Link
            href={`/${usuario}/ranking?mes=${nextMesStr}`}
            className="flex size-9 items-center justify-center rounded-xl bg-[#faf5eb] border border-[#f0e6d5] text-[#7a6d60] font-bold transition-all hover:bg-[#f0e6d5] active:scale-95 select-none"
            aria-label="Mes siguiente"
          >
            →
          </Link>
        </div>
      </div>

      <RankingClient rankings={rankings} />
    </main>
  );
}
