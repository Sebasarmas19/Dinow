import { redirect } from "next/navigation";
import { formatearFechaISO, obtenerFechaDeNegocio } from "@/lib/shared/date";
import { generarWrappedMensual } from "@/lib/wrapped/wrapped.service";
import { DeberesWrapped } from "../ranking/deberes-wrapped";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string }>;
};

export const dynamic = "force-dynamic";

export default async function WrappedPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { mes } = await searchParams;

  const currentBusinessDate = obtenerFechaDeNegocio();
  const currentMonthStr = formatearFechaISO(currentBusinessDate).slice(0, 7);

  const [curY, curM] = currentMonthStr.split("-").map(Number);
  let prevYear = curY;
  let prevMonth = curM - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const prevMesStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

  // REGLA: El Wrapped solo existe para meses que ya han finalizado (cerrados).
  // Si no se especifica mes, o si se pide el mes en curso o futuro (que aún no acaba),
  // mostramos el Wrapped del último mes cerrado.
  const mesActual = (!mes || mes >= currentMonthStr) ? prevMesStr : mes;

  if (!/^\d{4}-\d{2}$/.test(mesActual)) {
    redirect(`/${id}/wrapped?mes=${prevMesStr}`);
  }

  const [yearStr, monthStr] = mesActual.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (month < 1 || month > 12) {
    redirect(`/${id}/wrapped?mes=${prevMesStr}`);
  }

  const wrappedData = await generarWrappedMensual(mesActual, id);

  return (
    <DeberesWrapped
      data={wrappedData}
      closeHref={`/${id}/ranking?mes=${wrappedData.mes}`}
    />
  );
}
