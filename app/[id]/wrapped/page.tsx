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
  const mesActual = mes || currentMonthStr;

  if (!/^\d{4}-\d{2}$/.test(mesActual)) {
    redirect(`/${id}/wrapped?mes=${currentMonthStr}`);
  }

  const [yearStr, monthStr] = mesActual.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  if (month < 1 || month > 12) {
    redirect(`/${id}/wrapped?mes=${currentMonthStr}`);
  }

  let wrappedData = await generarWrappedMensual(mesActual, id);
  if (!mes && wrappedData.pulsoHogar.totalCumplimientos === 0) {
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear -= 1;
    }
    const prevMesStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
    const prevWrapped = await generarWrappedMensual(prevMesStr, id);
    if (prevWrapped.pulsoHogar.totalCumplimientos > 0) {
      wrappedData = prevWrapped;
    }
  }

  return (
    <DeberesWrapped
      data={wrappedData}
      closeHref={`/${id}/ranking?mes=${wrappedData.mes}`}
    />
  );
}
