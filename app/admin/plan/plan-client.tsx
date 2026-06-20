"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { guardarPlanSemanalAction } from "@/lib/rotacion/plan_semanal.actions";
import { type Participante } from "@/lib/participantes/participantes.repo";
import { type DeberConCriterios } from "@/lib/deberes/deberes.repo";
import { type PlanSemanalRow } from "@/lib/rotacion/plan_semanal.repo";

const DIAS = [
  { id: 1, nombre: "LUN" },
  { id: 2, nombre: "MAR" },
  { id: 3, nombre: "MIE" },
  { id: 4, nombre: "JUE" },
  { id: 5, nombre: "VIE" },
  { id: 6, nombre: "SAB" },
  { id: 0, nombre: "DOM" },
];

export function PlanClient({
  participantes,
  deberes,
  planInicial,
}: {
  participantes: Participante[];
  deberes: DeberConCriterios[];
  planInicial: PlanSemanalRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{mensaje: string, tipo: 'exito' | 'error'} | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<number>(1); // LUNES por defecto

  const [asignaciones, setAsignaciones] = useState(() => {
    const estado = [];
    for (const dia of DIAS) {
      for (const deber of deberes) {
        const disponible = deber.diasDisponibles.some((d) => {
          const truncado = d.toUpperCase().replace("É","E").replace("Á","A").substring(0, 3);
          return truncado === dia.nombre;
        });
        
        if (!disponible) continue;

        if (deber.esPersonal) {
          // Si es personal, agregamos una copia para TODOS los participantes
          // y no verificamos planInicial porque no se guardan en el plan fijo
          for (const p of participantes) {
            estado.push({
              deberId: deber.id,
              diaSemana: dia.id,
              participanteId: p.id,
              fijo: true,
              personal: true,
            });
          }
        } else {
          const enPlan = planInicial.find(
            (p) => p.diaSemana === dia.id && p.deberId === deber.id
          );

          estado.push({
            deberId: deber.id,
            diaSemana: dia.id,
            participanteId: enPlan ? enPlan.participanteId : "unassigned",
            fijo: !!deber.asignadoA,
            personal: false,
          });
        }
      }
    }
    return estado;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);

    const [_, deberId, dragDia] = activeStr.split("|");
    const [__, partId, dropDia] = overStr.split("|");

    if (dragDia !== dropDia) return;

    setAsignaciones((prev) =>
      prev.map((item) => {
        if (item.deberId === deberId && String(item.diaSemana) === dragDia) {
          const elDeber = deberes.find((d) => d.id === deberId);
          if (elDeber?.asignadoA && elDeber.asignadoA !== partId && partId !== "unassigned") {
            return item;
          }
          return { ...item, participanteId: partId };
        }
        return item;
      })
    );
  };

  const guardar = async () => {
    setIsSaving(true);
    const aGuardar = asignaciones.filter((a) => a.participanteId !== "unassigned" && !a.personal);
    
    startTransition(async () => {
      const res = await guardarPlanSemanalAction(aGuardar);
      setIsSaving(false);
      if (res.ok) {
        setToast({ mensaje: "¡Plan de la semana guardado!", tipo: "exito" });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ mensaje: res.error || "Error al guardar.", tipo: "error" });
        setTimeout(() => setToast(null), 3000);
      }
    });
  };

  const DraggableItem = ({ id, deber, fijo, personal }: any) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: id,
      data: { deberId: deber.id },
      disabled: fijo || personal,
    });

    const style = {
      transform: CSS.Translate.toString(transform),
      opacity: isDragging ? 0.4 : 1,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        className={`relative mb-2 flex items-center justify-between rounded-lg p-3 text-sm font-bold text-white shadow-sm touch-none select-none ${
          personal ? "bg-[#a69c8a]" : fijo ? "bg-[#8c7b68]" : "bg-tinta hover:bg-terracota"
        }`}
      >
        <span>{deber.nombre}</span>
        {personal ? (
          <span className="text-[12px]">✨</span>
        ) : fijo ? (
          <span className="text-[12px]">🔒</span>
        ) : null}
      </div>
    );
  };

  const DroppableZone = ({ id, children }: any) => {
    const { isOver, setNodeRef } = useDroppable({ id });
    return (
      <div
        ref={setNodeRef}
        className={`min-h-[80px] w-full rounded-xl p-3 transition-colors ${
          isOver ? "bg-[#f0e6d5] ring-2 ring-[#c8a984]" : "bg-[#faf8f5]"
        }`}
      >
        {children}
      </div>
    );
  };

  const renderActiveItem = () => {
    if (!activeId) return null;
    const [_, deberId] = activeId.split("|");
    const deber = deberes.find((d) => d.id === deberId);
    if (!deber) return null;
    return (
      <div className="flex items-center justify-between rounded-lg bg-terracota p-3 text-sm font-bold text-white shadow-lg">
        <span>{deber.nombre}</span>
      </div>
    );
  };

  const diaActual = DIAS.find((d) => d.id === activeDay)!;

  return (
    <div className="relative mb-8 min-h-[500px]">
      {/* ─── TOAST (Notificación) ────────────────────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-8 left-1/2 z-50 flex w-[90%] max-w-sm -translate-x-1/2 transform items-center gap-3 rounded-2xl p-4 shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
            toast.tipo === "exito"
              ? "bg-[#2c3e2a] text-white"
              : "bg-[#7d2f2f] text-white"
          }`}
        >
          <div className="flex size-8 items-center justify-center rounded-full bg-white/20">
            {toast.tipo === "exito" ? "✨" : "⚠️"}
          </div>
          <span className="text-[14px] font-bold">{toast.mensaje}</span>
        </div>
      )}

      {/* ─── HEADER Y CONTROLES ────────────────────────────────────────── */}
      <div className="flex justify-end mb-6">
        <button
          onClick={guardar}
          disabled={isSaving}
          className="rounded-xl bg-tinta px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-terracota disabled:opacity-50"
        >
          {isSaving ? "Guardando..." : "Guardar Plan Semanal"}
        </button>
      </div>

      <div className="overflow-hidden rounded-[20px] bg-white p-1 shadow-sm ring-1 ring-black/5">
        {/* Pestañas de Días */}
        <div className="flex overflow-x-auto border-b border-[#f4ede4] p-2">
          <div className="flex w-full gap-2 min-w-max">
            {DIAS.map((dia) => (
              <button
                key={dia.id}
                onClick={() => setActiveDay(dia.id)}
                className={`flex-1 rounded-xl px-4 py-3 font-display text-[13px] font-extrabold uppercase tracking-widest transition-colors ${
                  activeDay === dia.id
                    ? "bg-terracota text-white shadow-sm"
                    : "text-[#b19a80] hover:bg-[#f4ede4]"
                }`}
              >
                {dia.nombre}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex flex-col gap-6">
              {/* Bloque: Sin Asignar */}
              <div className="rounded-xl border-2 border-dashed border-[#e6d9c4] p-4">
                <h3 className="mb-3 font-bold text-[#8c7b68] text-sm flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-[#e6d9c4] text-[10px] text-white">?</span>
                  Por asignar el {diaActual.nombre}
                </h3>
                <DroppableZone id={`drop|unassigned|${diaActual.id}`}>
                  {asignaciones
                    .filter((a) => a.diaSemana === diaActual.id && a.participanteId === "unassigned")
                    .map((a) => (
                      <DraggableItem
                        key={`drag|${a.deberId}|${diaActual.id}`}
                        id={`drag|${a.deberId}|${diaActual.id}`}
                        deber={deberes.find((d) => d.id === a.deberId)}
                        fijo={a.fijo}
                        personal={a.personal}
                      />
                    ))}
                </DroppableZone>
              </div>

              {/* Bloques: Participantes */}
              {participantes.map((p) => (
                <div key={p.id} className="rounded-xl border border-[#f4ede4] p-4 bg-white shadow-sm">
                  <h3 className="mb-3 font-display font-bold text-tinta text-base flex items-center gap-2">
                    {p.fotoUrl ? (
                      <img src={p.fotoUrl} alt="" className="size-6 rounded-full object-cover" />
                    ) : (
                      <div className="flex size-6 items-center justify-center rounded-full bg-tinta text-[10px] text-white">
                        {p.nombre.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {p.nombre}
                  </h3>
                  <DroppableZone id={`drop|${p.id}|${diaActual.id}`}>
                    {asignaciones
                      .filter((a) => a.diaSemana === diaActual.id && a.participanteId === p.id)
                      .map((a) => (
                        <DraggableItem
                          key={`drag|${a.deberId}|${diaActual.id}|${p.id}`}
                          id={`drag|${a.deberId}|${diaActual.id}|${p.id}`}
                          deber={deberes.find((d) => d.id === a.deberId)}
                          fijo={a.fijo}
                          personal={a.personal}
                        />
                      ))}
                  </DroppableZone>
                </div>
              ))}
            </div>

            <DragOverlay>
              {renderActiveItem()}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
