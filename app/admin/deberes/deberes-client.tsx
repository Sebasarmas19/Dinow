"use client";

import { useState, useTransition, useOptimistic, useRef } from "react";
import { useRouter } from "next/navigation";
import { type DeberConCriterios } from "@/lib/deberes/deberes.repo";
import {
  crearDeberAction,
  editarDeberAction,
  desactivarDeberAction,
  reactivarDeberAction,
} from "@/lib/deberes/deberes.actions";
import { notificarCambioHogar } from "@/lib/shared/live-sync";
import toast from "react-hot-toast";
import { Modal } from "@/app/_components/ui/modal";
import { type Participante } from "@/lib/participantes/participantes.repo";

type TabValue = "obligatorios" | "extras" | "personales";

type CriterioModalItem = {
  id?: string;
  descripcion: string;
  puntos: string;
};

export function DeberesClient({
  deberesIniciales,
  participantes,
}: {
  deberesIniciales: DeberConCriterios[];
  participantes: Participante[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabValue>("obligatorios");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deberEditando, setDeberEditando] = useState<DeberConCriterios | null>(null);

  // Estado para la lista interactiva de criterios en el modal (con ID, texto y puntos)
  const [criteriosModal, setCriteriosModal] = useState<CriterioModalItem[]>([]);
  const inputCriterioRef = useRef<HTMLInputElement>(null);
  const inputCriterioPuntosRef = useRef<HTMLInputElement>(null);

  // Estado para UI dinámica de asignación
  const [asignadoATipo, setAsignadoATipo] = useState<"todos" | "especifico">("todos");
  const [maxReclamosStr, setMaxReclamosStr] = useState<string>("");
  const [puntosStr, setPuntosStr] = useState<string>("");
  const [isPuntosCustom, setIsPuntosCustom] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [deberesOpt, addDeberOpt] = useOptimistic(
    deberesIniciales,
    (state, updater: (d: DeberConCriterios[]) => DeberConCriterios[]) => updater(state),
  );

  const deberesObligatorios = deberesOpt.filter((d) => d.esObligatorio);
  const deberesExtras = deberesOpt.filter((d) => !d.esObligatorio && !d.esPersonal);
  const deberesPersonales = deberesOpt.filter((d) => !d.esObligatorio && d.esPersonal);

  const listActiva =
    activeTab === "obligatorios"
      ? deberesObligatorios
      : activeTab === "extras"
        ? deberesExtras
        : deberesPersonales;

  const puntosTotalesDeberNum = Number(puntosStr) || 0;
  const sumaPuntosCriterios =
    Math.round(
      criteriosModal.reduce((acc, c) => acc + (Number(c.puntos) || 0), 0) * 100,
    ) / 100;
  const sumaCoincide =
    criteriosModal.length === 0 ||
    Math.abs(sumaPuntosCriterios - puntosTotalesDeberNum) <= 0.05;

  const handleOpenModal = (deber?: DeberConCriterios) => {
    if (deber) {
      setDeberEditando(deber);
      const totalDeber = Number(deber.puntos) || 10;
      const n = deber.criterios.length;
      setCriteriosModal(
        deber.criterios.map((c) => {
          const ptsGuardado = Number(c.puntos ?? 0);
          const ptsDefault =
            ptsGuardado > 0
              ? ptsGuardado
              : n > 0
                ? Math.round((totalDeber / n) * 100) / 100
                : 0;
          return {
            id: c.id,
            descripcion: c.descripcion,
            puntos: String(ptsDefault),
          };
        }),
      );
      setAsignadoATipo(deber.asignadoA ? "especifico" : "todos");
      setMaxReclamosStr(deber.maxReclamos !== null ? String(deber.maxReclamos) : "");
      setPuntosStr(String(deber.puntos));
      setIsPuntosCustom(![2.5, 5, 10, 15, 20].includes(Number(deber.puntos)));
    } else {
      setDeberEditando(null);
      setCriteriosModal([]);
      setAsignadoATipo("todos");
      setMaxReclamosStr("");
      setPuntosStr(activeTab === "obligatorios" ? "10" : "5");
      setIsPuntosCustom(false);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setDeberEditando(null);
    setCriteriosModal([]);
    setAsignadoATipo("todos");
    setMaxReclamosStr("");
    setPuntosStr("5");
    setIsPuntosCustom(false);
  };

  const handleAddCriterio = () => {
    const val = inputCriterioRef.current?.value.trim();
    if (!val) return;
    const ptsInput = inputCriterioPuntosRef.current?.value.trim();
    const restante = Math.max(
      0,
      Math.round((puntosTotalesDeberNum - sumaPuntosCriterios) * 100) / 100,
    );
    const ptsNuevo =
      ptsInput && Number(ptsInput) > 0
        ? ptsInput
        : String(restante > 0 ? restante : 2);

    setCriteriosModal([
      ...criteriosModal,
      { descripcion: val, puntos: ptsNuevo },
    ]);
    if (inputCriterioRef.current) inputCriterioRef.current.value = "";
    if (inputCriterioPuntosRef.current) inputCriterioPuntosRef.current.value = "";
  };

  const handleUpdateCriterioDescripcion = (index: number, nuevaDesc: string) => {
    setCriteriosModal((prev) =>
      prev.map((c, i) => (i === index ? { ...c, descripcion: nuevaDesc } : c)),
    );
  };

  const handleUpdateCriterioPuntos = (index: number, nuevosPts: string) => {
    setCriteriosModal((prev) =>
      prev.map((c, i) => (i === index ? { ...c, puntos: nuevosPts } : c)),
    );
  };

  const handleRemoveCriterio = (index: number) => {
    setCriteriosModal(criteriosModal.filter((_, i) => i !== index));
  };

  const handleRepartirEquitativo = () => {
    if (criteriosModal.length === 0) return;
    const n = criteriosModal.length;
    const base = Math.floor((puntosTotalesDeberNum / n) * 100) / 100;
    let acumulado = 0;
    setCriteriosModal(
      criteriosModal.map((c, idx) => {
        const esUltimo = idx === n - 1;
        const pts = esUltimo
          ? Math.round((puntosTotalesDeberNum - acumulado) * 100) / 100
          : base;
        acumulado += pts;
        return { ...c, puntos: String(pts) };
      }),
    );
  };

  async function handleSubmit(formData: FormData) {
    if (!sumaCoincide) {
      toast.error(
        `La suma de los criterios (${sumaPuntosCriterios} pts) debe ser igual al total del deber (${puntosTotalesDeberNum} pts).`,
      );
      return;
    }

    if (activeTab === "obligatorios") {
      formData.set("esObligatorio", "true");
      formData.set("tipoAsignacion", "rotativo");
      formData.set("esPersonal", "false");
    } else if (activeTab === "extras") {
      formData.set("esObligatorio", "false");
      formData.set("tipoAsignacion", "reclamable");
      formData.set("esPersonal", "false");
    } else if (activeTab === "personales") {
      formData.set("esObligatorio", "false");
      formData.set("tipoAsignacion", "reclamable");
      formData.set("esPersonal", "true");
    }

    formData.set(
      "criteriosJson",
      JSON.stringify(
        criteriosModal
          .filter((c) => c.descripcion.trim() !== "")
          .map((c) => ({
            id: c.id,
            descripcion: c.descripcion.trim(),
            puntos: Number(c.puntos) || 0,
          })),
      ),
    );

    startTransition(async () => {
      let res;
      if (deberEditando) {
        formData.set("id", deberEditando.id);
        res = await editarDeberAction(formData);
      } else {
        res = await crearDeberAction(formData);
      }

      if (!res.ok) {
        toast.error("Error: " + res.error);
        return;
      }

      toast.success(
        deberEditando
          ? "¡Deber y criterios actualizados!"
          : "¡Deber creado con éxito!",
      );
      await notificarCambioHogar("deber_actualizado");
      router.refresh();
      handleCloseModal();
    });
  }

  async function toggleActivo(id: string, activo: boolean) {
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      addDeberOpt((prev) =>
        prev.map((d) => (d.id === id ? { ...d, activo: !activo } : d)),
      );
      const res = activo
        ? await desactivarDeberAction(fd)
        : await reactivarDeberAction(fd);
      if (!res.ok) {
        toast.error("Error: " + res.error);
      } else {
        await notificarCambioHogar("deber_estado");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex w-full rounded-xl bg-white p-1 shadow-sm ring-1 ring-black/5">
        <button
          onClick={() => setActiveTab("obligatorios")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-1 py-2.5 text-center text-[11px] font-semibold leading-tight transition-all sm:px-4 sm:text-sm ${
            activeTab === "obligatorios"
              ? "bg-[#f4ebe1] text-[#3b2a1a] shadow-sm"
              : "text-[#8c7b68] hover:bg-black/5 hover:text-[#3b2a1a]"
          }`}
        >
          <span className="shrink-0">🔒</span>
          <span>Obligatorios</span>
        </button>
        <button
          onClick={() => setActiveTab("extras")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-1 py-2.5 text-center text-[11px] font-semibold leading-tight transition-all sm:px-4 sm:text-sm ${
            activeTab === "extras"
              ? "bg-[#f4ebe1] text-[#3b2a1a] shadow-sm"
              : "text-[#8c7b68] hover:bg-black/5 hover:text-[#3b2a1a]"
          }`}
        >
          <span className="shrink-0">🌟</span>
          <span>Extras</span>
        </button>
        <button
          onClick={() => setActiveTab("personales")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-1 py-2.5 text-center text-[11px] font-semibold leading-tight transition-all sm:px-4 sm:text-sm ${
            activeTab === "personales"
              ? "bg-[#f4ebe1] text-[#3b2a1a] shadow-sm"
              : "text-[#8c7b68] hover:bg-black/5 hover:text-[#3b2a1a]"
          }`}
        >
          <span className="shrink-0">👤</span>
          <span>Extras Personales</span>
        </button>
      </div>

      {/* Header tab */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#3b2a1a]">
            {activeTab === "obligatorios" && "Deberes Obligatorios"}
            {activeTab === "extras" && "Deberes Extras"}
            {activeTab === "personales" && "Extras Personales"}
          </h2>
          <p className="text-sm text-[#735e47]">
            {activeTab === "obligatorios" &&
              "Son rotativos y críticos. Cada criterio tiene su propio peso en puntos."}
            {activeTab === "extras" &&
              "Comunitarios reclamables. Suma puntos extra."}
            {activeTab === "personales" &&
              "Asignados por persona con cupo individual."}
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="rounded-xl bg-[#3b2a1a] px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-[#2c1f13] hover:shadow-lg active:translate-y-0 active:shadow-md"
        >
          + Añadir Deber
        </button>
      </div>

      {/* Grid de tarjetas */}
      {listActiva.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#e8dfd5] bg-[#faf8f5] p-12 text-center">
          <p className="text-sm font-medium text-[#8c7b68]">
            No hay deberes configurados aquí todavía.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listActiva.map((deber) => (
            <div
              key={deber.id}
              className={`group flex flex-col justify-between overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition-all hover:shadow-md ${
                !deber.activo ? "opacity-60 grayscale" : ""
              }`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-[#3b2a1a] line-clamp-2">
                    {deber.nombre}
                  </h3>
                  <div className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[#f4ebe1] px-2.5 py-1 text-[11px] font-extrabold text-[#8c7b68]">
                    ⭐ {deber.puntos} pts
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex items-center text-xs text-[#735e47]">
                    <span className="w-24 font-semibold">Responsable:</span>
                    <span className="font-medium text-[#3b2a1a]">
                      {deber.asignadoA
                        ? (participantes.find((p) => p.id === deber.asignadoA)
                            ?.nombre ?? "Usuario")
                        : activeTab === "obligatorios"
                          ? "Rota entre todos"
                          : "Cualquiera"}
                    </span>
                  </div>
                  {activeTab !== "obligatorios" && (
                    <div className="flex items-center text-xs text-[#735e47]">
                      <span className="w-24 font-semibold">Frecuencia:</span>
                      <span className="capitalize">
                        {deber.cadencia.replace(/_/g, " ")}
                      </span>
                    </div>
                  )}
                  {deber.tipoAsignacion === "reclamable" && (
                    <div className="flex items-center text-xs text-[#735e47]">
                      <span className="w-24 font-semibold">Cupo:</span>
                      <span>
                        {deber.maxReclamos === null
                          ? "Sin límite"
                          : deber.maxReclamos}
                        <span className="ml-1 text-[10px] uppercase text-[#b19a80]">
                          ({deber.limitePorPersona ? "Por persona" : "Hogar"})
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Lista visible de criterios con su puntaje en la tarjeta */}
                <div className="mt-4 border-t border-[#f0e6d5] pt-3">
                  <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#b19a80]">
                    Criterios ({deber.criterios.length})
                  </p>
                  {deber.criterios.length === 0 ? (
                    <p className="text-xs italic text-[#8c7b68]">
                      Sin criterios (se marca con 1 clic)
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {deber.criterios.map((c, idx) => {
                        const ptsNum = Number(c.puntos ?? 0);
                        const ptsMostrar =
                          ptsNum > 0
                            ? ptsNum
                            : Math.round(
                                (Number(deber.puntos) / deber.criterios.length) *
                                  100,
                              ) / 100;
                        return (
                          <li
                            key={c.id}
                            className="flex items-start justify-between gap-2 rounded-lg bg-[#faf8f5] px-2.5 py-1.5 text-xs text-[#3b2a1a]"
                          >
                            <span className="leading-snug">
                              <strong className="mr-1 text-[#8c7b68]">
                                {idx + 1}.
                              </strong>
                              {c.descripcion}
                            </span>
                            <span className="shrink-0 rounded-full bg-[#f4ebe1] px-2 py-0.5 text-[10px] font-extrabold text-[#735e47]">
                              {ptsMostrar} pts
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="flex border-t border-black/5 bg-[#faf8f5]">
                <button
                  onClick={() => handleOpenModal(deber)}
                  className="flex-1 px-4 py-3 text-xs font-bold text-[#735e47] transition-colors hover:bg-black/5 hover:text-[#3b2a1a]"
                >
                  ✏️ Editar criterios / deber
                </button>
                {/* Bloqueamos desactivar los obligatorios para proteger la lógica base */}
                <button
                  onClick={() => toggleActivo(deber.id, deber.activo)}
                  disabled={deber.esObligatorio}
                  className="flex-1 border-l border-black/5 px-4 py-3 text-xs font-bold text-[#735e47] transition-colors hover:bg-black/5 hover:text-[#d94a4a] disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#735e47]"
                >
                  {deber.activo ? "Desactivar" : "Reactivar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={deberEditando ? "Editar Deber y Criterios" : "Añadir Deber"}
      >
        <div className="p-6 pt-0">
          <form action={handleSubmit} className="flex flex-col gap-6">
            {/* Campos Base */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#b19a80]">
                  Nombre de la Tarea
                </label>
                <input
                  name="nombre"
                  type="text"
                  required
                  defaultValue={deberEditando?.nombre}
                  className="w-full rounded-xl border-0 bg-[#f4ebe1]/50 px-4 py-3 text-[#3b2a1a] shadow-inner ring-1 ring-inset ring-[#e8dfd5] transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#c8a984]"
                  placeholder="Ej. Lavar los platos"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#b19a80]">
                  Puntos Totales del Deber
                </label>
                <input type="hidden" name="puntos" value={puntosStr} />

                {activeTab === "obligatorios" ? (
                  <div className="flex items-center justify-between rounded-xl border border-black/5 bg-[#faf8f5] px-4 py-3 text-[#3b2a1a] shadow-inner">
                    <span className="font-bold">⭐ 10 pts (Fijo obligatorio)</span>
                    <span className="text-xs text-[#8c7b68]">
                      La suma de criterios debe dar 10 pts
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      {[2.5, 5, 10, 15, 20].map((pt) => (
                        <button
                          key={pt}
                          type="button"
                          onClick={() => {
                            setPuntosStr(String(pt));
                            setIsPuntosCustom(false);
                          }}
                          className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                            puntosStr === String(pt) && !isPuntosCustom
                              ? "bg-[#3b2a1a] text-white shadow-md"
                              : "bg-[#f4ebe1] text-[#735e47] hover:bg-[#e8dfd5]"
                          }`}
                        >
                          {pt} pts
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setIsPuntosCustom(true)}
                        className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                          isPuntosCustom
                            ? "bg-[#3b2a1a] text-white shadow-md"
                            : "bg-[#f4ebe1] text-[#735e47] hover:bg-[#e8dfd5]"
                        }`}
                      >
                        Personalizado
                      </button>
                    </div>
                    {isPuntosCustom && (
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={puntosStr}
                        onChange={(e) => setPuntosStr(e.target.value)}
                        placeholder="Ej. 12.5"
                        className="w-full rounded-xl border-0 bg-white px-4 py-3 text-[#3b2a1a] shadow-inner ring-1 ring-inset ring-[#c8a984] transition-all focus:outline-none focus:ring-2 focus:ring-[#3b2a1a]"
                      />
                    )}
                  </div>
                )}
              </div>

              {(activeTab === "obligatorios" || maxReclamosStr.trim() === "") && (
                <input type="hidden" name="cadencia" value="semanal" />
              )}

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#b19a80]">
                  ¿Quién puede hacer esto?
                </label>

                <div className="flex gap-6 rounded-xl border-0 bg-[#f4ebe1]/50 px-4 py-3 shadow-inner ring-1 ring-inset ring-[#e8dfd5]">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="tipoAsignacionRadio"
                      value="todos"
                      checked={asignadoATipo === "todos"}
                      onChange={() => setAsignadoATipo("todos")}
                      className="size-4 border-[#c8a984] text-[#3b2a1a] focus:ring-[#3b2a1a]"
                    />
                    <span className="text-sm font-medium text-[#3b2a1a]">
                      {activeTab === "obligatorios"
                        ? "Todos (Rota)"
                        : "Cualquiera"}
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="tipoAsignacionRadio"
                      value="especifico"
                      checked={asignadoATipo === "especifico"}
                      onChange={() => setAsignadoATipo("especifico")}
                      className="size-4 border-[#c8a984] text-[#3b2a1a] focus:ring-[#3b2a1a]"
                    />
                    <span className="text-sm font-medium text-[#3b2a1a]">
                      Alguien Específico
                    </span>
                  </label>
                </div>

                {asignadoATipo === "especifico" && (
                  <div className="mt-3">
                    <select
                      name="asignadoA"
                      defaultValue={deberEditando?.asignadoA ?? ""}
                      required
                      className="w-full rounded-xl border-0 bg-white px-4 py-3 text-[#3b2a1a] shadow-sm ring-1 ring-inset ring-[#c8a984] transition-all focus:outline-none focus:ring-2 focus:ring-[#3b2a1a]"
                    >
                      <option value="" disabled>
                        Selecciona el responsable...
                      </option>
                      {participantes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Configuracion Extra (solo si no es obligatorio) */}
            {activeTab !== "obligatorios" && (
              <div className="rounded-xl border border-black/5 bg-[#faf8f5] p-4">
                <h4 className="mb-4 text-sm font-bold text-[#3b2a1a]">
                  Configuración Extra
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex h-full flex-col">
                    <label className="mb-1.5 block text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#b19a80]">
                      Límite de veces
                    </label>
                    <div className="mt-auto">
                      <input
                        name="maxReclamos"
                        type="text"
                        pattern="[0-9]*"
                        placeholder="Sin límite"
                        value={maxReclamosStr}
                        onChange={(e) =>
                          setMaxReclamosStr(e.target.value.replace(/[^0-9]/g, ""))
                        }
                        className="w-full rounded-xl border-0 bg-white px-4 py-2.5 text-[#3b2a1a] shadow-inner ring-1 ring-inset ring-[#e8dfd5] transition-all focus:outline-none focus:ring-2 focus:ring-[#c8a984]"
                      />
                      <p className="mt-1 text-[11px] text-[#8c7b68]">
                        Intentos permitidos en total.
                      </p>
                    </div>
                  </div>

                  {maxReclamosStr.trim() !== "" && (
                    <div className="flex h-full flex-col">
                      <label className="mb-1.5 block text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#b19a80]">
                        Reinicio de límite:
                      </label>
                      <div className="mt-auto">
                        <select
                          name="cadencia"
                          defaultValue={deberEditando?.cadencia ?? "diaria"}
                          className="w-full rounded-xl border-0 bg-white px-4 py-2.5 text-[#3b2a1a] shadow-inner ring-1 ring-inset ring-[#e8dfd5] transition-all focus:outline-none focus:ring-2 focus:ring-[#c8a984]"
                        >
                          <option value="diaria">Cada Día</option>
                          <option value="semanal">Cada Semana</option>
                          <option value="mensual">Cada Mes</option>
                        </select>
                        <p
                          className="mt-1 select-none text-[11px] text-transparent"
                          aria-hidden="true"
                        >
                          Espaciador
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      name="requiereFoto"
                      id="requiereFoto"
                      defaultChecked={deberEditando?.requiereFoto ?? true}
                      className="size-5 rounded border-[#e8dfd5] text-[#3b2a1a] focus:ring-[#3b2a1a]"
                    />
                    <label
                      htmlFor="requiereFoto"
                      className="text-sm font-medium text-[#3b2a1a]"
                    >
                      Requiere foto de evidencia
                    </label>
                  </div>

                  {asignadoATipo === "todos" && (
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        name="limitePorPersona"
                        id="limitePorPersona"
                        defaultChecked={deberEditando?.limitePorPersona ?? false}
                        className="size-5 rounded border-[#e8dfd5] text-[#3b2a1a] focus:ring-[#3b2a1a]"
                      />
                      <div>
                        <label
                          htmlFor="limitePorPersona"
                          className="text-sm font-medium text-[#3b2a1a]"
                        >
                          Límite individual
                        </label>
                        <p className="text-[11px] text-[#8c7b68]">
                          Cada integrante recibe este número de intentos.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Criterios (Lista Interactiva con Texto Editable y Puntos) */}
            <div className="rounded-xl border border-[#e8dfd5] bg-[#faf8f5] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="block text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#b19a80]">
                    Criterios de Aceptación y Peso en Puntos
                  </label>
                  <p className="text-[11px] text-[#735e47]">
                    Puedes editar el texto y cuántos puntos vale cada criterio.
                  </p>
                </div>

                {criteriosModal.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRepartirEquitativo}
                      className="rounded-lg border border-[#dccdb4] bg-white px-2.5 py-1 text-[11px] font-bold text-[#735e47] hover:bg-[#f4ebe1]"
                    >
                      ⚖️ Repartir igual
                    </button>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${
                        sumaCoincide
                          ? "bg-[#e3efdf] text-[#33502f]"
                          : "bg-[#fde8e8] text-[#b91c1c]"
                      }`}
                    >
                      Suma: {sumaPuntosCriterios} / {puntosTotalesDeberNum} pts
                    </span>
                  </div>
                )}
              </div>

              <div className="mb-3 space-y-2.5">
                {criteriosModal.length === 0 ? (
                  <p className="text-xs italic text-[#8c7b68]">
                    No hay criterios. El deber se marcará con un solo clic.
                  </p>
                ) : (
                  criteriosModal.map((c, idx) => (
                    <div
                      key={c.id ?? `nuevo-${idx}`}
                      className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f4ebe1] text-xs font-extrabold text-[#8c7b68]">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={c.descripcion}
                        onChange={(e) =>
                          handleUpdateCriterioDescripcion(idx, e.target.value)
                        }
                        placeholder="Descripción del criterio..."
                        className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-[#3b2a1a] focus:border-[#c8a984] focus:bg-[#faf8f5] focus:outline-none"
                      />
                      <div className="flex shrink-0 items-center gap-1 rounded-lg bg-[#f4ebe1]/70 px-2 py-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max={puntosTotalesDeberNum || 100}
                          value={c.puntos}
                          onChange={(e) =>
                            handleUpdateCriterioPuntos(idx, e.target.value)
                          }
                          className="w-12 bg-transparent text-right text-sm font-extrabold text-[#3b2a1a] focus:outline-none"
                        />
                        <span className="text-[11px] font-bold text-[#8c7b68]">
                          pts
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCriterio(idx)}
                        className="rounded-lg p-1.5 text-[#d94a4a] hover:bg-[#fdf2f2]"
                        title="Eliminar criterio"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              {!sumaCoincide && (
                <p className="mb-3 rounded-lg bg-[#fde8e8] px-3 py-2 text-xs font-bold text-[#b91c1c]">
                  ⚠️ La suma de los criterios ({sumaPuntosCriterios} pts) debe ser
                  exactamente {puntosTotalesDeberNum} pts (diferencia:{" "}
                  {Math.round(
                    (puntosTotalesDeberNum - sumaPuntosCriterios) * 100,
                  ) / 100}{" "}
                  pts).
                </p>
              )}

              {/* Añadir nuevo criterio */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  ref={inputCriterioRef}
                  type="text"
                  placeholder="Nuevo criterio (ej. Dejar cocina limpia)..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCriterio();
                    }
                  }}
                  className="min-w-0 flex-1 rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm text-[#3b2a1a] shadow-inner ring-1 ring-inset ring-[#e8dfd5] transition-all focus:outline-none focus:ring-2 focus:ring-[#c8a984]"
                />
                <div className="flex gap-2">
                  <input
                    ref={inputCriterioPuntosRef}
                    type="number"
                    step="0.5"
                    min="0.5"
                    placeholder="Pts"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCriterio();
                      }
                    }}
                    className="w-20 rounded-xl border-0 bg-white px-3 py-2.5 text-sm font-bold text-[#3b2a1a] shadow-inner ring-1 ring-inset ring-[#e8dfd5] focus:outline-none focus:ring-2 focus:ring-[#c8a984]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCriterio}
                    className="shrink-0 rounded-xl bg-[#e8dfd5] px-4 py-2.5 text-sm font-bold text-[#3b2a1a] hover:bg-[#dcd1c4]"
                  >
                    + Añadir
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-[#735e47] transition-colors hover:bg-black/5"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || !sumaCoincide}
                className="rounded-xl bg-[#3b2a1a] px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-[#2c1f13] hover:shadow-lg disabled:opacity-50"
              >
                {isPending ? "Guardando..." : "Guardar Deber"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
