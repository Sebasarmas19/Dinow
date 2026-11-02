"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { supabase } from "@/lib/db/supabase";
import { comprimirImagen } from "@/lib/shared/image-compression";
import { proponerTareaVoluntariaAction } from "@/lib/tareas-voluntarias/tareas-voluntarias.actions";
import type { TareaVoluntariaUI } from "./home-screen";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  participanteId: string;
  onSuccess: (tarea: TareaVoluntariaUI) => void;
};

export function ModalTareaVoluntaria({
  isOpen,
  onClose,
  participanteId,
  onSuccess,
}: Props) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [puntosSugeridos, setPuntosSugeridos] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bloquea el scroll del fondo mientras el modal esté abierto
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { archivo: archivoOptimizado } = await comprimirImagen(file, {
        maxDimension: 1280,
        calidad: 0.78,
      });

      const fileExt = archivoOptimizado.name.split(".").pop() || "webp";
      const fileName = `voluntaria_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("evidencias")
        .upload(filePath, archivoOptimizado, {
          contentType: archivoOptimizado.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("evidencias")
        .getPublicUrl(filePath);

      setFotoUrl(data.publicUrl);
      toast.success("Foto subida correctamente");
    } catch {
      toast.error("Error al subir la imagen.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error("Indica qué tarea voluntaria realizaste.");
      return;
    }
    if (!descripcion.trim()) {
      toast.error("Incluye una justificación o detalle.");
      return;
    }

    const formData = new FormData();
    formData.append("participanteId", participanteId);
    formData.append("titulo", titulo.trim());
    formData.append("descripcion", descripcion.trim());
    if (fotoUrl) formData.append("fotoUrl", fotoUrl);
    if (puntosSugeridos) formData.append("puntosSugeridos", puntosSugeridos.trim());

    startTransition(async () => {
      const res = await proponerTareaVoluntariaAction(formData);
      if (res.ok) {
        toast.success("¡Tarea voluntaria enviada al admin!", { icon: "⭐" });
        onSuccess({
          id: res.data.id,
          titulo: res.data.titulo,
          descripcion: res.data.descripcion,
          fotoUrl: res.data.fotoUrl,
          estado: "pendiente",
          puntosSugeridos: res.data.puntosSugeridos
            ? Number(res.data.puntosSugeridos)
            : null,
          puntosOtorgados: null,
          motivoRechazo: null,
          fecha: res.data.fecha,
        });
        onClose();
      } else {
        toast.error(res.error || "No se pudo enviar la tarea voluntaria.");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in overscroll-none touch-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Proponer Tarea Voluntaria"
    >
      <div
        className="relative max-w-md w-full max-h-[90dvh] overflow-y-auto overscroll-contain rounded-[28px] border border-[#efe1c6] bg-white p-6 shadow-2xl animate-in zoom-in-95 flex flex-col gap-5 touch-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[#FFF4EC] border border-[#FBD9C4] text-2xl shadow-sm">
              ⭐
            </span>
            <div>
              <h2 className="font-display text-lg font-extrabold text-[#3B2A1A] leading-tight">
                Tarea Voluntaria
              </h2>
              <p className="text-xs text-[#8C7B68] font-medium mt-0.5">
                Iniciativa propia para sumar puntos extra
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full bg-[#F5EDE0] text-[#8C7B68] hover:bg-[#EAE0D0] transition-colors flex items-center justify-center text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-extrabold text-[#5A4D40] mb-1.5 uppercase tracking-wider">
              ¿Qué hiciste? *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Limpieza profunda de la nevera"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-2xl border border-[#EDDCCB] bg-[#FDFBF7] p-3 text-sm text-[#3B2A1A] placeholder:text-[#B19A80] focus:border-[#C25A2E] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#5A4D40] mb-1.5 uppercase tracking-wider">
              Justificación y detalles *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Cuéntale al admin por qué merece puntos extra (tiempo que tomó, qué limpiaste o arreglaste)..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-2xl border border-[#EDDCCB] bg-[#FDFBF7] p-3 text-sm text-[#3B2A1A] placeholder:text-[#B19A80] focus:border-[#C25A2E] focus:outline-none transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-[#5A4D40] mb-1.5 uppercase tracking-wider">
                Puntos sugeridos
              </label>
              <input
                type="number"
                min="1"
                max="50"
                placeholder="Ej: 8"
                value={puntosSugeridos}
                onChange={(e) => setPuntosSugeridos(e.target.value)}
                className="w-full rounded-2xl border border-[#EDDCCB] bg-[#FDFBF7] p-3 text-sm text-[#3B2A1A] placeholder:text-[#B19A80] focus:border-[#C25A2E] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-[#5A4D40] mb-1.5 uppercase tracking-wider">
                Evidencia fotográfica
              </label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {fotoUrl ? (
                <div className="relative size-11 rounded-2xl overflow-hidden border border-[#E6B79C] shadow-sm">
                  <img
                    src={fotoUrl}
                    alt="Preview"
                    className="size-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setFotoUrl(null)}
                    className="absolute inset-0 bg-black/40 text-white flex items-center justify-center text-xs font-bold hover:bg-black/60"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-11 rounded-2xl border border-dashed border-[#EDDCCB] bg-[#FDFBF7] hover:bg-[#F5EDE0] text-xs font-bold text-[#8C7B68] flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-[#C25A2E] border-t-transparent" />
                  ) : (
                    <>
                      <span>📷</span>
                      <span>Subir foto</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              disabled={isPending || isUploading}
              onClick={onClose}
              className="py-3 px-4 rounded-2xl text-xs font-bold text-[#8C7B68] hover:bg-[#EFE7DB] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || isUploading}
              style={{ backgroundColor: "#E2733F" }}
              className="py-3 px-6 rounded-2xl font-display text-xs font-extrabold text-white shadow-md hover:opacity-95 active:scale-95 transition-all disabled:opacity-60"
            >
              {isPending ? "Enviando..." : "Enviar al admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
