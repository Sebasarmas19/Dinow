/**
 * Utilidad de compresión y optimización de imágenes en el cliente (navegador).
 *
 * Convierte fotos pesadas tomadas desde la cámara del teléfono (3 MB - 10 MB)
 * a formato WebP optimizado (~100 KB - 180 KB) con dimensiones máximas controladas.
 *
 * Beneficios:
 * 1. Ahorra 95% de almacenamiento en Supabase (1 GB rinde para miles de fotos).
 * 2. La subida es prácticamente instantánea incluso con datos móviles.
 * 3. Mantiene nitidez visual perfecta en pantallas de teléfonos y computadoras.
 */

export interface OpcionesCompresion {
  maxDimension?: number; // Ancho o alto máximo en píxeles (default: 1280px)
  calidad?: number; // Calidad de compresión entre 0 y 1 (default: 0.78)
  formatoPreferido?: "image/webp" | "image/jpeg";
}

export interface ResultadoCompresion {
  archivo: File;
  ancho: number;
  alto: number;
  pesoOriginalBytes: number;
  pesoComprimidoBytes: number;
  porcentajeReduccion: number;
}

export async function comprimirImagen(
  archivoOriginal: File,
  opciones: OpcionesCompresion = {}
): Promise<ResultadoCompresion> {
  const {
    maxDimension = 1280,
    calidad = 0.78,
    formatoPreferido = "image/webp",
  } = opciones;

  // Si no es una imagen (ej. svg o archivo no procesable), devolver tal cual
  if (!archivoOriginal.type.startsWith("image/")) {
    return {
      archivo: archivoOriginal,
      ancho: 0,
      alto: 0,
      pesoOriginalBytes: archivoOriginal.size,
      pesoComprimidoBytes: archivoOriginal.size,
      porcentajeReduccion: 0,
    };
  }

  return new Promise((resolve, reject) => {
    const imagen = new Image();
    const objetoUrl = URL.createObjectURL(archivoOriginal);

    imagen.onload = () => {
      URL.revokeObjectURL(objetoUrl);

      let ancho = imagen.naturalWidth || imagen.width;
      let alto = imagen.naturalHeight || imagen.height;

      // Calcular nuevas dimensiones manteniendo la relación de aspecto
      if (ancho > maxDimension || alto > maxDimension) {
        if (ancho > alto) {
          alto = Math.round((alto * maxDimension) / ancho);
          ancho = maxDimension;
        } else {
          ancho = Math.round((ancho * maxDimension) / alto);
          alto = maxDimension;
        }
      }

      // Dibujar en un canvas del tamaño calculado
      const canvas = document.createElement("canvas");
      canvas.width = ancho;
      canvas.height = alto;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback si no hay soporte de canvas 2d
        resolve({
          archivo: archivoOriginal,
          ancho,
          alto,
          pesoOriginalBytes: archivoOriginal.size,
          pesoComprimidoBytes: archivoOriginal.size,
          porcentajeReduccion: 0,
        });
        return;
      }

      // Suavizado de imagen para máxima calidad al reducir
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(imagen, 0, 0, ancho, alto);

      const exportarBlob = (formato: string, cal: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              // Si falla toBlob con webp, intentar con jpeg
              if (formato === "image/webp") {
                exportarBlob("image/jpeg", cal);
                return;
              }
              resolve({
                archivo: archivoOriginal,
                ancho,
                alto,
                pesoOriginalBytes: archivoOriginal.size,
                pesoComprimidoBytes: archivoOriginal.size,
                porcentajeReduccion: 0,
              });
              return;
            }

            const extension = blob.type === "image/webp" ? "webp" : "jpg";
            const nombreSinExtension = archivoOriginal.name.replace(/\.[^/.]+$/, "");
            const nuevoNombre = `${nombreSinExtension}.${extension}`;

            const archivoComprimido = new File([blob], nuevoNombre, {
              type: blob.type,
              lastModified: Date.now(),
            });

            const reduccion = Math.max(
              0,
              Math.round(
                ((archivoOriginal.size - archivoComprimido.size) /
                  archivoOriginal.size) *
                  100
              )
            );

            resolve({
              archivo: archivoComprimido,
              ancho,
              alto,
              pesoOriginalBytes: archivoOriginal.size,
              pesoComprimidoBytes: archivoComprimido.size,
              porcentajeReduccion: reduccion,
            });
          },
          formato,
          cal
        );
      };

      exportarBlob(formatoPreferido, calidad);
    };

    imagen.onerror = (err) => {
      URL.revokeObjectURL(objetoUrl);
      reject(err);
    };

    imagen.src = objetoUrl;
  });
}
