"use client";

import type {
  TituloOficialWrapped,
  WrappedMensualData,
} from "@/lib/wrapped/wrapped.service";

export type ShareSceneInfo =
  | { id: "intro"; bg: string; accent: string; textAccent: string; orb1: string; orb2: string }
  | { id: "pulso"; bg: string; accent: string; textAccent: string; orb1: string; orb2: string }
  | { id: "hitos"; bg: string; accent: string; textAccent: string; orb1: string; orb2: string }
  | {
      id: "titulo";
      clave: "confiable" | "solidario" | "responsable" | "general";
      numero: string;
      etiquetaCorto: string;
      bg: string;
      accent: string;
      textAccent: string;
      orb1: string;
      orb2: string;
    }
  | { id: "podio"; bg: string; accent: string; textAccent: string; orb1: string; orb2: string };

const W = 1080;
const H = 1920;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function loadImageSafe(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 2500);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = url;
  });
}

async function drawAvatar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  nombre: string,
  fotoUrl: string | null,
  borderColor: string,
) {
  const img = await loadImageSafe(fotoUrl);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "#241A14";
  ctx.fill();

  if (img) {
    ctx.clip();
    // object-cover
    const scale = Math.max((radius * 2) / img.width, (radius * 2) / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x - dw / 2, y - dh / 2, dw, dh);
  } else {
    ctx.fillStyle = "#FFFDF9";
    ctx.font = `800 ${Math.round(radius * 0.9)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(nombre.charAt(0).toUpperCase(), x, y + 4);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(4, Math.round(radius * 0.08));
  ctx.strokeStyle = borderColor;
  ctx.stroke();
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 4,
): number {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  let linesCount = 0;

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = words[i];
      currentY += lineHeight;
      linesCount++;
      if (linesCount >= maxLines - 1) {
        // Resto en la última línea
        const rest = [line, ...words.slice(i + 1)].join(" ");
        ctx.fillText(rest, x, currentY);
        return currentY + lineHeight;
      }
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

/**
 * Genera un archivo PNG de alta resolución (1080×1920, formato 9:16 Story)
 * correspondiente a la diapositiva actual del Deberes Wrapped.
 */
export async function generarImagenHistoriaWrapped(
  data: WrappedMensualData,
  scene: ShareSceneInfo,
): Promise<File | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 1. Fondo base y orbes de luz
  ctx.fillStyle = scene.bg;
  ctx.fillRect(0, 0, W, H);

  const grad1 = ctx.createRadialGradient(140, 180, 20, 140, 180, 620);
  grad1.addColorStop(0, `${scene.orb1}55`);
  grad1.addColorStop(1, "transparent");
  ctx.fillStyle = grad1;
  ctx.fillRect(0, 0, W, H);

  const grad2 = ctx.createRadialGradient(W - 120, H - 220, 20, W - 120, H - 220, 650);
  grad2.addColorStop(0, `${scene.orb2}44`);
  grad2.addColorStop(1, "transparent");
  ctx.fillStyle = grad2;
  ctx.fillRect(0, 0, W, H);

  // Anillos geométricos decorativos (estilo Spotify Wrapped)
  ctx.save();
  ctx.strokeStyle = `${scene.accent}33`;
  ctx.lineWidth = 3;
  ctx.setLineDash([28, 20]);
  ctx.beginPath();
  ctx.arc(W - 80, 220, 340, 0, Math.PI * 2);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.strokeStyle = `${scene.textAccent}22`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(W - 80, 220, 250, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 2. Header superior de la tarjeta Story
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "700 26px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(data.hogarNombre.toUpperCase(), 88, 110);

  ctx.fillStyle = scene.textAccent;
  ctx.font = "800 26px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`WRAPPED · ${data.labelMes.toUpperCase()}`, W - 88, 110);

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(88, 162);
  ctx.lineTo(W - 88, 162);
  ctx.stroke();

  // 3. Contenido específico de la escena
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  if (scene.id === "intro") {
    ctx.fillStyle = scene.textAccent;
    ctx.font = "800 30px sans-serif";
    ctx.fillText(`RESUMEN MENSUAL · ${data.anio}`, 88, 480);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 132px sans-serif";
    ctx.fillText(data.mesNombre.toUpperCase(), 88, 545);

    ctx.fillStyle = scene.accent;
    ctx.font = "900 132px sans-serif";
    ctx.fillText("EN CASA.", 88, 685);

    roundRect(ctx, 88, 860, 210, 12, 6);
    ctx.fillStyle = scene.accent;
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "600 44px sans-serif";
    wrapText(
      ctx,
      "La historia de quién sostuvo el hogar, quién salió al rescate y quién se queda con los 4 títulos oficiales.",
      88,
      920,
      W - 176,
      62,
      4,
    );

    let ax = 155;
    for (const p of data.podioFinal) {
      await drawAvatar(ctx, ax, 1290, 68, p.nombre, p.fotoUrl, scene.textAccent);
      ax += 165;
    }
  } else if (scene.id === "pulso") {
    const { pulsoHogar } = data;
    const total = Math.max(1, pulsoHogar.totalCumplimientos);
    const wBar = W - 176;
    const wPropios = Math.round((pulsoHogar.propiosCumplidos / total) * wBar);
    const wAyudas = Math.round((pulsoHogar.coberturasRealizadas / total) * wBar);
    const wExtras = Math.max(0, wBar - wPropios - wAyudas);

    ctx.fillStyle = scene.textAccent;
    ctx.font = "800 32px sans-serif";
    ctx.fillText("PUNTOS GENERADOS EN EQUIPO", 88, 470);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 210px sans-serif";
    ctx.fillText(`+${pulsoHogar.puntosTotalesGenerados}`, 88, 530);

    // Barra de proporción
    const barY = 820;
    roundRect(ctx, 88, barY, wBar, 32, 16);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();

    if (wPropios > 0) {
      roundRect(ctx, 88, barY, Math.max(24, wPropios - 6), 32, 16);
      ctx.fillStyle = "#5C9A6A";
      ctx.fill();
    }
    if (wAyudas > 0) {
      roundRect(ctx, 88 + wPropios, barY, Math.max(24, wAyudas - 6), 32, 16);
      ctx.fillStyle = "#F6D582";
      ctx.fill();
    }
    if (wExtras > 0) {
      roundRect(ctx, 88 + wPropios + wAyudas, barY, Math.max(24, wExtras), 32, 16);
      ctx.fillStyle = "#E2733F";
      ctx.fill();
    }

    const stats = [
      { val: `${pulsoHogar.propiosCumplidos}`, label: "DEBERES PROPIOS", color: "#8FD69E" },
      { val: `${pulsoHogar.coberturasRealizadas}`, label: "RESCATES", color: "#F6D582" },
      { val: `${pulsoHogar.extrasReclamados}`, label: "EXTRAS", color: "#F4A261" },
    ];

    stats.forEach((st, i) => {
      const sx = 88 + i * 310;
      roundRect(ctx, sx, 920, 285, 220, 32);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 84px sans-serif";
      ctx.fillText(st.val, sx + 36, 955);

      ctx.fillStyle = st.color;
      ctx.font = "800 24px sans-serif";
      ctx.fillText(st.label, sx + 36, 1068);
    });
  } else if (scene.id === "hitos") {
    const { pulsoHogar, hitosCuriosos } = data;

    ctx.fillStyle = scene.textAccent;
    ctx.font = "800 30px sans-serif";
    ctx.fillText("LA TAREA MÁS CUMPLIDA", 88, 360);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 116px sans-serif";
    ctx.fillText(pulsoHogar.deberEstrella?.nombre || "Hogar Activo", 88, 420);

    ctx.fillStyle = scene.accent;
    ctx.font = "900 92px sans-serif";
    ctx.fillText(`${pulsoHogar.deberEstrella?.veces ?? pulsoHogar.totalCumplimientos}`, 88, 570);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "700 40px sans-serif";
    ctx.fillText(`veces completada en ${data.mesNombre}`, 225, 602);

    if (hitosCuriosos.especialistaMes) {
      roundRect(ctx, 88, 760, W - 176, 300, 36);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();

      ctx.fillStyle = scene.textAccent;
      ctx.font = "800 28px sans-serif";
      ctx.fillText("ESPECIALISTA DEL MES", 136, 815);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 72px sans-serif";
      ctx.fillText(hitosCuriosos.especialistaMes.participanteNombre, 136, 870);

      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "600 38px sans-serif";
      ctx.fillText(
        `Hizo ${hitosCuriosos.especialistaMes.deberNombre} ${hitosCuriosos.especialistaMes.veces} veces este mes.`,
        136,
        970,
      );
    }

    if (pulsoHogar.diaRecord) {
      roundRect(ctx, 88, 1110, W - 176, 280, 36);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fill();

      ctx.fillStyle = scene.accent;
      ctx.font = "800 28px sans-serif";
      ctx.fillText("EL DÍA RÉCORD", 136, 1165);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 64px sans-serif";
      ctx.fillText(pulsoHogar.diaRecord.fechaLabel, 136, 1220);

      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = "600 38px sans-serif";
      ctx.fillText(`+${pulsoHogar.diaRecord.puntos} puntos sumados en un solo día.`, 136, 1310);
    }
  } else if (scene.id === "titulo") {
    const titulo: TituloOficialWrapped = data.titulosOficiales[scene.clave];
    const ganador = titulo.ganador;

    ctx.fillStyle = scene.textAccent;
    ctx.font = "800 30px sans-serif";
    ctx.fillText(`TÍTULO ${scene.numero} · ${scene.etiquetaCorto}`, 88, 300);

    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "700 28px sans-serif";
    ctx.fillText(titulo.diferenciaConSegundo.toUpperCase(), 88, 352);

    if (ganador) {
      const ganadores = titulo.empatados.length > 1 ? titulo.empatados : [ganador];

      if (ganadores.length === 1) {
        await drawAvatar(
          ctx,
          186,
          535,
          98,
          ganador.nombre,
          ganador.fotoUrl,
          scene.accent,
        );

        const textX = 320;
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 88px sans-serif";
        wrapText(ctx, ganador.nombre, textX, 445, W - textX - 88, 92, 2);

        ctx.fillStyle = scene.accent;
        ctx.font = "900 76px sans-serif";
        ctx.fillText(titulo.valorFormateado, textX, 595);
      } else {
        // Empate múltiple (2 o 3 ganadores): avatares arriba y nombres a ancho completo
        let ax = 152;
        for (const g of ganadores) {
          await drawAvatar(
            ctx,
            ax,
            475,
            64,
            g.nombre,
            g.fotoUrl,
            scene.accent,
          );
          ax += 116;
        }

        ctx.fillStyle = scene.accent;
        ctx.font = "900 72px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(titulo.valorFormateado, W - 88, 438);
        ctx.textAlign = "left";

        ctx.fillStyle = "#FFFFFF";
        ctx.font = ganadores.length > 2 ? "900 58px sans-serif" : "900 68px sans-serif";
        wrapText(
          ctx,
          ganadores.map((g) => g.nombre).join(" & "),
          88,
          575,
          W - 176,
          68,
          2,
        );
      }

      // 2 Tarjetas de razones
      const bullets = titulo.porQueGano.bullets.slice(0, 2);
      const cardW = (W - 176 - 32) / 2;
      bullets.forEach((b, idx) => {
        const bx = 88 + idx * (cardW + 32);
        roundRect(ctx, bx, 740, cardW, 280, 32);
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "800 22px sans-serif";
        wrapText(ctx, b.etiqueta.toUpperCase(), bx + 32, 782, cardW - 64, 30, 2);

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "800 38px sans-serif";
        wrapText(ctx, b.valor, bx + 32, 865, cardW - 64, 48, 3);
      });

      // Barras comparativas
      const maxVal = Math.max(1, ...titulo.tablaCompleta.map((f) => Math.max(0, f.valor)));
      titulo.tablaCompleta.slice(0, 3).forEach((fila, i) => {
        const ry = 1120 + i * 95;
        const isWin = fila.posicion === 1 && fila.valor > 0;

        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.font = "700 30px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`${fila.posicion}. ${fila.nombre}`, 88, ry);

        const barX = 330;
        const barMaxW = 470;
        const fillW = Math.max(36, Math.round((Math.max(0, fila.valor) / maxVal) * barMaxW));

        roundRect(ctx, barX, ry + 6, barMaxW, 26, 13);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fill();

        roundRect(ctx, barX, ry + 6, fillW, 26, 13);
        ctx.fillStyle = isWin ? scene.accent : "rgba(255,255,255,0.32)";
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "800 30px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(
          titulo.clave === "confiable"
            ? `${fila.valor}%`
            : `${Math.round(fila.valor * 10) / 10} pts`,
          W - 88,
          ry,
        );
      });
      ctx.textAlign = "left";
    }
  } else if (scene.id === "podio") {
    ctx.fillStyle = scene.textAccent;
    ctx.font = "800 28px sans-serif";
    ctx.fillText(`PODIO OFICIAL · ${data.labelMes.toUpperCase()}`, 88, 230);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 76px sans-serif";
    ctx.fillText("Cuadro de Honor", 88, 275);

    const p1 = data.podioFinal[0];
    const p2 = data.podioFinal[1];
    const p3 = data.podioFinal[2];

    const cols = [
      {
        p: p2,
        rank: p2?.posicionGeneral ?? 2,
        x: 88,
        w: 280,
        h: p2?.posicionGeneral === 1 ? 240 : 190,
        baseY: 830,
      },
      {
        p: p1,
        rank: p1?.posicionGeneral ?? 1,
        x: 400,
        w: 280,
        h: 260,
        baseY: 830,
      },
      {
        p: p3,
        rank: p3?.posicionGeneral ?? 3,
        x: 712,
        w: 280,
        h: p3?.posicionGeneral === 1 ? 240 : p3?.posicionGeneral === 2 ? 190 : 145,
        baseY: 830,
      },
    ];

    for (const col of cols) {
      if (!col.p) continue;
      const isFirst = col.rank === 1;
      const pillarTop = col.baseY - col.h;
      const centerX = col.x + col.w / 2;

      await drawAvatar(
        ctx,
        centerX,
        pillarTop - 130,
        isFirst ? 64 : 52,
        col.p.nombre,
        col.p.fotoUrl,
        isFirst ? "#F6D582" : "rgba(255,255,255,0.4)",
      );

      ctx.textAlign = "center";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "800 32px sans-serif";
      ctx.fillText(col.p.nombre, centerX, pillarTop - 52);

      ctx.fillStyle = isFirst ? scene.textAccent : "rgba(255,255,255,0.65)";
      ctx.font = "700 26px sans-serif";
      ctx.fillText(`${col.p.puntosTotales} pts`, centerX, pillarTop - 14);

      roundRect(ctx, col.x, pillarTop + 24, col.w, col.h, 28);
      ctx.fillStyle = isFirst ? "#E5B84B" : "rgba(255,255,255,0.12)";
      ctx.fill();

      ctx.fillStyle = isFirst ? "#1F1400" : "#FFFFFF";
      ctx.font = "900 54px sans-serif";
      ctx.fillText(`${col.rank}º`, centerX, pillarTop + col.h / 2);
    }

    ctx.textAlign = "left";
    // Tarjetas de resumen por participante
    data.podioFinal.forEach((p, idx) => {
      const ry = 900 + idx * 225;
      roundRect(ctx, 88, ry, W - 176, 195, 32);
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fill();

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "800 38px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(p.nombre, 132, ry + 36);

      ctx.fillStyle = scene.textAccent;
      ctx.font = "900 40px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(`${p.puntosTotales} pts`, W - 132, ry + 36);

      ctx.textAlign = "left";
      const titulosStr =
        p.titulosGanados.length > 0
          ? p.titulosGanados.map((t) => t.nombre.toUpperCase()).join("  ·  ")
          : `${p.porcentajeConfiable}% CUMPLIMIENTO (${p.cumplidosPropios} DEBERES)`;

      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = "700 25px sans-serif";
      wrapText(ctx, titulosStr, 132, ry + 102, W - 264, 34, 2);
    });
  }

  // 4. Footer de marca estilo Spotify Wrapped
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(88, H - 150);
  ctx.lineTo(W - 88, H - 150);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "800 24px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("DINOW · SISTEMA DE DEBERES DE LA CASA", 88, H - 110);

  ctx.fillStyle = scene.textAccent;
  ctx.textAlign = "right";
  ctx.fillText(data.labelMes.toUpperCase(), W - 88, H - 110);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png", 0.95),
  );
  if (!blob) return null;

  const fileName = `deberes-wrapped-${data.mes}-${scene.id}.png`;
  return new File([blob], fileName, { type: "image/png" });
}
