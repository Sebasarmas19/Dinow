"use client";

import { useState, useRef, useTransition } from "react";
import { supabase } from "@/lib/db/supabase";
import { comprimirImagen } from "@/lib/shared/image-compression";
import { notificarCambioHogar } from "@/lib/shared/live-sync";
import { updateFotoPerfilAction } from "@/lib/participantes/participantes.actions";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

type AvatarClientProps = {
  participanteId: string;
  nombre: string;
  fotoUrl: string | null;
  borderColorClass?: string;
};

export function AvatarClient({ participanteId, nombre, fotoUrl, borderColorClass = "border-[#dccdb4]" }: AvatarClientProps) {
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Optimización automática de avatar a WebP ligero (máx 500px)
      const { archivo: archivoOptimizado } = await comprimirImagen(file, {
        maxDimension: 500,
        calidad: 0.82,
      });

      const fileExt = archivoOptimizado.name.split('.').pop() || "webp";
      const fileName = `perfiles/${participanteId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('evidencias')
        .upload(fileName, archivoOptimizado, {
          contentType: archivoOptimizado.type,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from('evidencias').getPublicUrl(fileName);
      
      startTransition(async () => {
        const result = await updateFotoPerfilAction(participanteId, data.publicUrl);
        if (result.ok) {
          await notificarCambioHogar("avatar_actualizado");
          router.refresh();
        } else {
          toast.error("Error guardando la foto en el perfil: " + result.error);
        }
      });
    } catch (error: any) {
      toast.error("Error subiendo foto: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const isBusy = isPending || uploading;

  return (
    <>
      <input
        type="file"
        accept="image/*"
        capture="user"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        type="button"
        disabled={isBusy}
        onClick={() => fileInputRef.current?.click()}
        className={`size-20 rounded-full bg-white flex items-center justify-center text-3xl font-bold border-4 ${borderColorClass} overflow-hidden shadow-sm transition-transform active:scale-95 disabled:opacity-70 disabled:active:scale-100`}
        aria-label="Cambiar foto de perfil"
      >
        {isBusy ? (
          <span aria-hidden="true" className="animate-spin text-xl">⏳</span>
        ) : fotoUrl ? (
          <img
            src={fotoUrl}
            alt={nombre}
            className="size-full object-cover"
          />
        ) : (
          nombre.charAt(0).toUpperCase()
        )}
      </button>
      <div className="absolute -bottom-1 -right-1 bg-white text-[14px] rounded-full size-6 flex items-center justify-center shadow border border-[#faf5eb] pointer-events-none">
        🌟
      </div>
    </>
  );
}
