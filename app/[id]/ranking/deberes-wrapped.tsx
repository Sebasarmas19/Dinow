"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type {
  TituloOficialWrapped,
  WrappedMensualData,
} from "@/lib/wrapped/wrapped.service";
import {
  generarImagenHistoriaWrapped,
  type ShareSceneInfo,
} from "./wrapped-share-image";

gsap.registerPlugin(useGSAP);

type Props = {
  data: WrappedMensualData;
  onClose?: () => void;
  closeHref?: string;
};

type SceneConfig =
  | { id: "intro"; theme: SceneTheme }
  | { id: "pulso"; theme: SceneTheme }
  | { id: "hitos"; theme: SceneTheme }
  | {
      id: "titulo";
      clave: "confiable" | "solidario" | "responsable" | "general";
      numero: string;
      pregunta: string;
      etiquetaCorto: string;
      theme: SceneTheme;
    }
  | { id: "podio"; theme: SceneTheme };

type SceneTheme = {
  bg: string;
  accent: string;
  accentSoft: string;
  textAccent: string;
  orb1: string;
  orb2: string;
};

const SCENES: SceneConfig[] = [
  {
    id: "intro",
    theme: {
      bg: "#120D0A",
      accent: "#E2733F",
      accentSoft: "rgba(226, 115, 63, 0.18)",
      textAccent: "#FCEBB6",
      orb1: "#E2733F",
      orb2: "#F6D582",
    },
  },
  {
    id: "pulso",
    theme: {
      bg: "#0E1310",
      accent: "#5C9A6A",
      accentSoft: "rgba(92, 154, 106, 0.2)",
      textAccent: "#A8E6B4",
      orb1: "#5C9A6A",
      orb2: "#FCEBB6",
    },
  },
  {
    id: "hitos",
    theme: {
      bg: "#161018",
      accent: "#E2733F",
      accentSoft: "rgba(246, 213, 130, 0.16)",
      textAccent: "#F6D582",
      orb1: "#C85A32",
      orb2: "#9B6B9E",
    },
  },
  {
    id: "titulo",
    clave: "confiable",
    numero: "01",
    pregunta: "¿Quién nunca falló a su turno?",
    etiquetaCorto: "MÁS CONFIABLE",
    theme: {
      bg: "#0A1710",
      accent: "#4E9A62",
      accentSoft: "rgba(78, 154, 98, 0.22)",
      textAccent: "#9BF0B0",
      orb1: "#3B8550",
      orb2: "#9BF0B0",
    },
  },
  {
    id: "titulo",
    clave: "solidario",
    numero: "02",
    pregunta: "¿Quién salió al rescate de sus hermanos?",
    etiquetaCorto: "MÁS SOLIDARIO",
    theme: {
      bg: "#1A1008",
      accent: "#E2733F",
      accentSoft: "rgba(226, 115, 63, 0.22)",
      textAccent: "#FBD0B9",
      orb1: "#E2733F",
      orb2: "#F6D582",
    },
  },
  {
    id: "titulo",
    clave: "responsable",
    numero: "03",
    pregunta: "¿Quién dio más en tareas extra?",
    etiquetaCorto: "MÁS RESPONSABLE",
    theme: {
      bg: "#150D1A",
      accent: "#B57EDC",
      accentSoft: "rgba(181, 126, 220, 0.22)",
      textAccent: "#E9D5FF",
      orb1: "#8E4EC6",
      orb2: "#E2733F",
    },
  },
  {
    id: "titulo",
    clave: "general",
    numero: "04",
    pregunta: "La corona absoluta del mes es para...",
    etiquetaCorto: "CAMPEÓN DEL MES",
    theme: {
      bg: "#171106",
      accent: "#F6D582",
      accentSoft: "rgba(246, 213, 130, 0.22)",
      textAccent: "#FCEBB6",
      orb1: "#F4B942",
      orb2: "#E2733F",
    },
  },
  {
    id: "podio",
    theme: {
      bg: "#120D0A",
      accent: "#F6D582",
      accentSoft: "rgba(246, 213, 130, 0.16)",
      textAccent: "#FCEBB6",
      orb1: "#E2733F",
      orb2: "#F6D582",
    },
  },
];

function AvatarCircle({
  nombre,
  fotoUrl,
  size = "lg",
  accentColor = "#F6D582",
}: {
  nombre: string;
  fotoUrl: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  accentColor?: string;
}) {
  const dims =
    size === "xl"
      ? "size-28 text-4xl"
      : size === "lg"
        ? "size-20 text-2xl"
        : size === "md"
          ? "size-14 text-lg"
          : "size-10 text-sm";

  return (
    <div
      style={{ borderColor: accentColor }}
      className={`${dims} rounded-full bg-[#241A14] text-[#FFFDF9] border-[3px] flex items-center justify-center font-display font-extrabold overflow-hidden shadow-2xl shrink-0 select-none`}
    >
      {fotoUrl ? (
        <img
          src={fotoUrl}
          alt={nombre}
          className="size-full object-cover"
          draggable={false}
        />
      ) : (
        nombre.charAt(0).toUpperCase()
      )}
    </div>
  );
}

/**
 * Explosión sutil y elegante de partículas en Canvas al revelar un título o el podio.
 */
function CelebrationCanvas({
  burstKey,
  accentColor,
}: {
  burstKey: number;
  accentColor: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (burstKey <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const palette = [accentColor, "#FCEBB6", "#FFFDF9", "#E2733F"];
    const particles = Array.from({ length: 52 }, (_, i) => {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 6 + Math.random() * 11;
      return {
        x: width * 0.5,
        y: height * 0.42,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 3,
        size: 4 + Math.random() * 6,
        color: palette[i % palette.length],
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.18,
      };
    });

    let frame = 0;
    let rafId = 0;

    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);
      let active = false;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.24;
        p.vx *= 0.985;
        p.rot += p.vRot;

        if (frame < 120 && p.y < height + 20) {
          active = true;
          const alpha = frame > 85 ? Math.max(0, (120 - frame) / 35) : 1;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.5);
          ctx.restore();
        }
      }
      if (active) rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [burstKey, accentColor]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-30 size-full"
      aria-hidden="true"
    />
  );
}

export function DeberesWrapped({ data, onClose, closeHref }: Props) {
  const [mounted, setMounted] = useState(false);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [sharingImage, setSharingImage] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const progressRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pointerDownTimeRef = useRef<number>(0);
  const pointerDownXRef = useRef<number | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoldingRef = useRef(false);

  const safeSceneIdx = Math.min(Math.max(0, sceneIdx), SCENES.length - 1);
  const currentScene = SCENES[safeSceneIdx];

  // Bloqueo total de scroll vertical y rubber-banding en iOS Safari / Android Chrome
  useEffect(() => {
    setMounted(true);
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehavior;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyWidth = body.style.width;

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehavior = prevBodyOverscroll;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.width = prevBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);

  // Prevenir arrastrar/scrollear la pantalla con el dedo en móviles
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const preventTouchScroll = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        e.preventDefault();
      }
    };
    el.addEventListener("touchmove", preventTouchScroll, { passive: false });
    return () => {
      el.removeEventListener("touchmove", preventTouchScroll);
    };
  }, [mounted]);

  // Sincroniza barras completadas y pendientes al cambiar de escena
  useEffect(() => {
    progressRefs.current.forEach((bar, idx) => {
      if (!bar) return;
      const scale = idx < sceneIdx ? 1 : 0;
      bar.style.transform = `scaleX(${scale})`;
    });
  }, [sceneIdx]);

  const goNextScene = useCallback(() => {
    const tl = tlRef.current;
    // Si estamos en una escena con fase "reveal" y aún estamos en el suspenso inicial,
    // el primer toque adelanta la línea de tiempo directo al reveal (como en Spotify Wrapped)
    if (tl && tl.labels.reveal !== undefined) {
      const currentTime = tl.time();
      if (currentTime < tl.labels.reveal - 0.15) {
        tl.play("reveal");
        return;
      }
    }

    if (sceneIdx < SCENES.length - 1) {
      setSceneIdx((s) => Math.min(SCENES.length - 1, s + 1));
      setIsPaused(false);
    }
  }, [sceneIdx]);

  const goPrevScene = useCallback(() => {
    if (sceneIdx > 0) {
      setSceneIdx((s) => Math.max(0, s - 1));
      setIsPaused(false);
    } else {
      tlRef.current?.restart();
    }
  }, [sceneIdx]);

  // Construcción de la composición GSAP (estilo HyperFrames) para cada escena
  useGSAP(
    () => {
      if (!mounted || !stageRef.current) return;

      // Garantizar que las barras anteriores estén en 1, las futuras en 0 y el flash apagado
      progressRefs.current.forEach((bar, idx) => {
        if (!bar) return;
        bar.style.transform = `scaleX(${idx < safeSceneIdx ? 1 : 0})`;
      });
      gsap.set(".reveal-flash", { opacity: 0 });

      const activeBar = progressRefs.current[safeSceneIdx];
      const tl = gsap.timeline({
        paused: isPaused,
        defaults: { ease: "expo.out" },
        onUpdate: () => {
          if (activeBar) {
            activeBar.style.transform = `scaleX(${tl.progress()})`;
          }
        },
        onComplete: () => {
          if (safeSceneIdx < SCENES.length - 1) {
            setSceneIdx((s) =>
              s === safeSceneIdx ? Math.min(SCENES.length - 1, s + 1) : s,
            );
          }
        },
      });

      tlRef.current = tl;

      // Movimiento continuo de las formas geométricas de fondo
      const ring1Tween = gsap.fromTo(
        ".bg-ring-1",
        { rotate: 0, scale: 0.85, opacity: 0 },
        {
          rotate: 90,
          scale: 1.15,
          opacity: 0.22,
          duration: 8,
          ease: "none",
        },
      );
      const ring2Tween = gsap.fromTo(
        ".bg-ring-2",
        { rotate: 45, scale: 1.1, opacity: 0 },
        {
          rotate: -60,
          scale: 0.9,
          opacity: 0.16,
          duration: 8,
          ease: "none",
        },
      );

      if (currentScene.id === "intro") {
        tl.fromTo(
          ".intro-kicker",
          { yPercent: 120, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.7 },
          0.1,
        )
          .fromTo(
            ".intro-word",
            { yPercent: 115, rotate: 3, opacity: 0 },
            {
              yPercent: 0,
              rotate: 0,
              opacity: 1,
              duration: 0.9,
              stagger: 0.12,
            },
            0.25,
          )
          .fromTo(
            ".intro-line",
            { scaleX: 0 },
            { scaleX: 1, duration: 0.8, ease: "power3.inOut" },
            0.7,
          )
          .fromTo(
            ".intro-sub",
            { y: 24, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.7 },
            0.95,
          )
          .fromTo(
            ".intro-avatars > *",
            { scale: 0.6, opacity: 0, y: 20 },
            {
              scale: 1,
              opacity: 1,
              y: 0,
              duration: 0.6,
              stagger: 0.08,
              ease: "back.out(1.6)",
            },
            1.15,
          )
          // Hold para lectura
          .to(".scene-stage", { opacity: 1, duration: 3.2 });
      } else if (currentScene.id === "pulso") {
        gsap.set(".act2-group", { autoAlpha: 0 });
        // ACTO 1: Pregunta inicial que entra y se va
        tl.fromTo(
          ".act1-line",
          { yPercent: 110, opacity: 0 },
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.75,
            stagger: 0.1,
          },
          0.1,
        )
          .to(
            ".act1-group",
            {
              y: -40,
              opacity: 0,
              filter: "blur(6px)",
              duration: 0.45,
              ease: "power3.in",
            },
            1.75,
          )
          // ACTO 2: Explosión del gran número con conteo en vivo
          .addLabel("reveal", 2.15)
          .set(".act2-group", { autoAlpha: 1 }, "reveal")
          .fromTo(
            ".pulso-label",
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6 },
            "reveal",
          )
          .fromTo(
            ".pulso-bignum",
            { scale: 0.75, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.85, ease: "back.out(1.4)" },
            "reveal+=0.08",
          );

        // Counter numérico animado con GSAP
        const counterObj = { val: 0 };
        const numEl = stageRef.current?.querySelector(".pulso-bignum-val");
        if (numEl) {
          tl.to(
            counterObj,
            {
              val: data.pulsoHogar.puntosTotalesGenerados,
              duration: 1.2,
              ease: "power3.out",
              onUpdate: () => {
                numEl.textContent = `${Math.round(counterObj.val)}`;
              },
            },
            "reveal+=0.08",
          );
        }

        tl.fromTo(
          ".pulso-bar-fill",
          { scaleX: 0 },
          { scaleX: 1, duration: 0.9, stagger: 0.1, ease: "expo.out" },
          "reveal+=0.4",
        )
          .fromTo(
            ".pulso-stat",
            { y: 24, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.65, stagger: 0.1 },
            "reveal+=0.55",
          )
          .to(".scene-stage", { opacity: 1, duration: 3.8 });
      } else if (currentScene.id === "hitos") {
        gsap.set(".hito2-group", { autoAlpha: 0 });
        // ACTO 1: El deber más repetido de la casa
        tl.fromTo(
          ".hito1-item",
          { y: 36, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.75, stagger: 0.12 },
          0.1,
        )
          .to(
            ".hito1-group",
            {
              y: -45,
              opacity: 0,
              filter: "blur(6px)",
              duration: 0.45,
              ease: "power3.in",
            },
            2.4,
          )
          // ACTO 2: El especialista / día récord de la casa
          .addLabel("reveal", 2.85)
          .set(".hito2-group", { autoAlpha: 1 }, "reveal")
          .fromTo(
            ".hito2-item",
            { y: 36, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.75, stagger: 0.12 },
            "reveal",
          )
          .to(".scene-stage", { opacity: 1, duration: 3.8 });
      } else if (currentScene.id === "titulo") {
        gsap.set(".suspense-group", {
          autoAlpha: 1,
          scale: 1,
          filter: "blur(0px)",
        });
        gsap.set(".winner-group", { autoAlpha: 0 });
        // ACTO 1: Suspenso cinemático (Tipografía kinética + anillo girando)
        tl.fromTo(
          ".suspense-num",
          { scale: 0.7, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.6 },
          0.05,
        )
          .fromTo(
            ".suspense-title",
            { yPercent: 115, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.75, stagger: 0.1 },
            0.2,
          )
          .fromTo(
            ".suspense-ring",
            { scale: 0.5, rotate: -90, opacity: 0 },
            {
              scale: 1.08,
              rotate: 90,
              opacity: 1,
              duration: 1.5,
              ease: "power2.inOut",
            },
            0.25,
          )
          // Salida rápida del suspenso
          .to(
            ".suspense-group",
            {
              scale: 1.18,
              opacity: 0,
              filter: "blur(8px)",
              duration: 0.35,
              ease: "power3.in",
            },
            1.75,
          )
          // ACTO 2: Flash y Revelación del Campeón + Por qué ganó
          .addLabel("reveal", 2.1)
          .call(() => setBurstKey((k) => k + 1), [], "reveal")
          .fromTo(
            ".reveal-flash",
            { opacity: 0.45 },
            {
              opacity: 0,
              duration: 0.6,
              ease: "power2.out",
              immediateRender: false,
            },
            "reveal",
          )
          .set(".winner-group", { autoAlpha: 1 }, "reveal")
          .fromTo(
            ".winner-kicker",
            { y: 16, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.55 },
            "reveal+=0.05",
          )
          .fromTo(
            ".winner-avatar",
            { scale: 0.6, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.75, ease: "back.out(1.7)" },
            "reveal+=0.1",
          )
          .fromTo(
            ".winner-name",
            { yPercent: 110, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: 0.75 },
            "reveal+=0.18",
          )
          .fromTo(
            ".winner-metric",
            { scale: 0.8, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.7 },
            "reveal+=0.3",
          )
          .fromTo(
            ".winner-reason",
            { y: 24, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.65, stagger: 0.12 },
            "reveal+=0.48",
          )
          .fromTo(
            ".winner-bar-row",
            { x: -24, opacity: 0 },
            { x: 0, opacity: 1, duration: 0.55, stagger: 0.08 },
            "reveal+=0.7",
          )
          .to(".scene-stage", { opacity: 1, duration: 4.5 });
      } else if (currentScene.id === "podio") {
        // Escena final: se queda fija al terminar para que el usuario comparta o repita
        tl.call(() => setBurstKey((k) => k + 1), [], 0.15)
          .fromTo(
            ".podio-header",
            { y: 24, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.7 },
            0.1,
          )
          .fromTo(
            ".podio-col",
            { y: 80, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.85,
              stagger: 0.14,
              ease: "back.out(1.3)",
            },
            0.25,
          )
          .fromTo(
            ".podio-row",
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6, stagger: 0.1 },
            0.65,
          )
          .fromTo(
            ".podio-actions",
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6 },
            0.95,
          );
        // En la última escena no auto-cerramos
        tl.eventCallback("onComplete", null);
      }

      return () => {
        tl.kill();
        ring1Tween.kill();
        ring2Tween.kill();
      };
    },
    { scope: stageRef, dependencies: [safeSceneIdx, mounted] },
  );

  // Sincronizar Play / Pause con GSAP
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (isPaused) {
      tl.pause();
    } else {
      tl.play();
    }
  }, [isPaused]);

  // Teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNextScene();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrevScene();
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPaused((p) => !p);
      } else if (e.key === "Escape" && onClose) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNextScene, goPrevScene, onClose]);

  // Gestos estilo Spotify Wrapped (Hold pausa el frame exacto, Tap izq/der o Swipe navega)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    pointerDownXRef.current = e.clientX;
    pointerDownTimeRef.current = Date.now();
    isHoldingRef.current = false;

    holdTimerRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      setIsPaused(true);
    }, 180);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button, a")) return;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (isHoldingRef.current) {
      isHoldingRef.current = false;
      setIsPaused(false);
      pointerDownXRef.current = null;
      return;
    }

    const startX = pointerDownXRef.current;
    pointerDownXRef.current = null;
    if (startX === null) return;

    const dx = e.clientX - startX;
    const dt = Math.max(1, Date.now() - pointerDownTimeRef.current);

    if (Math.abs(dx) > 40 || (Math.abs(dx) > 20 && Math.abs(dx) / dt > 0.25)) {
      if (dx < 0) goNextScene();
      else goPrevScene();
      return;
    }

    const width = window.innerWidth;
    if (e.clientX < width * 0.3) {
      goPrevScene();
    } else {
      goNextScene();
    }
  };

  const handleShareCurrentStory = async () => {
    if (sharingImage) return;
    setIsPaused(true);
    setSharingImage(true);
    setShareFeedback(null);

    try {
      const shareScene: ShareSceneInfo =
        currentScene.id === "titulo"
          ? {
              id: "titulo",
              clave: currentScene.clave,
              numero: currentScene.numero,
              etiquetaCorto: currentScene.etiquetaCorto,
              bg: currentScene.theme.bg,
              accent: currentScene.theme.accent,
              textAccent: currentScene.theme.textAccent,
              orb1: currentScene.theme.orb1,
              orb2: currentScene.theme.orb2,
            }
          : {
              id: currentScene.id,
              bg: currentScene.theme.bg,
              accent: currentScene.theme.accent,
              textAccent: currentScene.theme.textAccent,
              orb1: currentScene.theme.orb1,
              orb2: currentScene.theme.orb2,
            };

      const file = await generarImagenHistoriaWrapped(data, shareScene);
      if (!file) {
        setSharingImage(false);
        return;
      }

      // 1. Compartir archivo PNG directamente en móvil (iOS Safari / Android Chrome)
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          files: [file],
          title: `Deberes Wrapped · ${data.labelMes}`,
        });
        setSharingImage(false);
        return;
      }

      // 2. Fallback: descargar la imagen PNG de la historia directamente
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      setShareFeedback("Imagen guardada");
      setTimeout(() => setShareFeedback(null), 2600);
    } catch {
      // Si el usuario cancela la hoja nativa de compartir, no mostramos error
    } finally {
      setSharingImage(false);
    }
  };

  if (!mounted) return null;

  const { theme } = currentScene;

  const content = (
    <div
      ref={stageRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      style={{ backgroundColor: theme.bg, touchAction: "none" }}
      className="fixed inset-0 z-[99999] w-screen h-dvh overflow-hidden overscroll-none touch-none select-none text-[#FFFDF9] flex flex-col justify-between transition-colors duration-700"
      role="dialog"
      aria-modal="true"
      aria-label={`Deberes Wrapped ${data.labelMes}`}
    >
      <CelebrationCanvas burstKey={burstKey} accentColor={theme.accent} />

      {/* Flash de luz para el momento exacto del reveal */}
      <div
        className="reveal-flash pointer-events-none fixed inset-0 z-20 opacity-0"
        style={{ backgroundColor: theme.textAccent }}
      />

      {/* ── GEOMETRÍA VECTORIAL ANIMADA DE FONDO (Estilo Spotify Wrapped) ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
        <div
          className="absolute -top-32 -left-24 size-[420px] rounded-full blur-[110px] opacity-30 transition-colors duration-700"
          style={{ backgroundColor: theme.orb1 }}
        />
        <div
          className="absolute -bottom-36 -right-24 size-[420px] rounded-full blur-[120px] opacity-25 transition-colors duration-700"
          style={{ backgroundColor: theme.orb2 }}
        />

        {/* Anillos geométricos cinéticos */}
        <svg
          className="bg-ring-1 absolute -top-24 -right-28 size-[440px] opacity-20"
          viewBox="0 0 400 400"
          fill="none"
        >
          <circle
            cx="200"
            cy="200"
            r="150"
            stroke={theme.accent}
            strokeWidth="2"
            strokeDasharray="18 14"
          />
          <circle
            cx="200"
            cy="200"
            r="110"
            stroke={theme.textAccent}
            strokeWidth="1.5"
          />
        </svg>

        <svg
          className="bg-ring-2 absolute -bottom-32 -left-28 size-[460px] opacity-15"
          viewBox="0 0 400 400"
          fill="none"
        >
          <rect
            x="60"
            y="60"
            width="280"
            height="280"
            rx="64"
            stroke={theme.textAccent}
            strokeWidth="2"
          />
        </svg>
      </div>

      {/* ── BARRA SUPERIOR DE PROGRESO (Sincronizada al frame de GSAP) ───── */}
      <header className="relative z-40 w-full max-w-[560px] mx-auto pt-[max(12px,env(safe-area-inset-top))] px-5 flex flex-col gap-2.5 shrink-0">
        <div className="grid grid-cols-8 gap-1.5">
          {SCENES.map((s, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Escena ${idx + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                setSceneIdx(idx);
                setIsPaused(false);
              }}
              className="h-1 rounded-full bg-white/20 overflow-hidden cursor-pointer"
            >
              <div
                ref={(el) => {
                  progressRefs.current[idx] = el;
                }}
                className="h-full w-full bg-[#FFFDF9] origin-left"
                style={{
                  transform: `scaleX(${idx < sceneIdx ? 1 : 0})`,
                }}
              />
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
              {data.hogarNombre}
            </span>
            <span className="text-white/30">·</span>
            <span
              style={{ color: theme.textAccent }}
              className="text-[11px] font-extrabold uppercase tracking-[0.16em]"
            >
              {data.labelMes}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isPaused && (
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-white/15 text-white/80">
                Pausa
              </span>
            )}
            {onClose ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="size-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-transform flex items-center justify-center text-xs font-bold text-white/90"
                aria-label="Cerrar"
              >
                ✕
              </button>
            ) : closeHref ? (
              <a
                href={closeHref}
                onClick={(e) => e.stopPropagation()}
                className="size-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-transform flex items-center justify-center text-xs font-bold text-white/90"
                aria-label="Cerrar"
              >
                ✕
              </a>
            ) : null}
          </div>
        </div>
      </header>

      {/* ── ESCENARIO CENTRAL CINEMÁTICO (100% Viewport) ─────────────────── */}
      <main className="scene-stage relative z-20 flex-1 min-h-0 w-full max-w-[540px] mx-auto px-5 flex flex-col justify-center overflow-hidden">
        {currentScene.id === "intro" && (
          <SceneIntro data={data} theme={theme} />
        )}

        {currentScene.id === "pulso" && (
          <ScenePulso data={data} theme={theme} />
        )}

        {currentScene.id === "hitos" && (
          <SceneHitos data={data} theme={theme} />
        )}

        {currentScene.id === "titulo" && (
          <SceneTitulo
            key={currentScene.clave}
            titulo={data.titulosOficiales[currentScene.clave]}
            numero={currentScene.numero}
            pregunta={currentScene.pregunta}
            etiquetaCorto={currentScene.etiquetaCorto}
            theme={theme}
          />
        )}

        {currentScene.id === "podio" && (
          <ScenePodio
            data={data}
            theme={theme}
            sharingImage={sharingImage}
            shareFeedback={shareFeedback}
            onShare={handleShareCurrentStory}
            onReplay={() => {
              setSceneIdx(0);
              setIsPaused(false);
            }}
            onClose={onClose}
            closeHref={closeHref}
          />
        )}
      </main>

      {/* ── PIE CON BOTÓN PARA COMPARTIR IMAGEN DE CADA HISTORIA ─────────── */}
      <footer className="relative z-40 w-full max-w-[540px] mx-auto pb-[max(12px,env(safe-area-inset-bottom))] px-5 flex items-center justify-between shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
          {safeSceneIdx + 1} / {SCENES.length}
        </span>

        {currentScene.id !== "podio" && (
          <button
            type="button"
            disabled={sharingImage}
            onClick={(e) => {
              e.stopPropagation();
              handleShareCurrentStory();
            }}
            className="px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/18 border border-white/15 text-[11px] font-bold text-white/90 flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer disabled:opacity-60"
          >
            <svg
              className="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span>
              {sharingImage
                ? "Generando..."
                : shareFeedback || "Compartir historia"}
            </span>
          </button>
        )}
      </footer>
    </div>
  );

  return createPortal(content, document.body);
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCENA 1: PORTADA KINÉTICA
// ─────────────────────────────────────────────────────────────────────────────
function SceneIntro({
  data,
  theme,
}: {
  data: WrappedMensualData;
  theme: SceneTheme;
}) {
  return (
    <div className="flex flex-col items-start gap-6">
      <div className="overflow-hidden">
        <div
          style={{ color: theme.textAccent }}
          className="intro-kicker text-xs font-extrabold uppercase tracking-[0.25em]"
        >
          RESUMEN MENSUAL · {data.anio}
        </div>
      </div>

      <div className="flex flex-col leading-[0.94] tracking-[-0.04em] font-display font-extrabold">
        <div className="overflow-hidden py-1">
          <div className="intro-word text-[clamp(3.1rem,13vw,5.2rem)] text-white uppercase">
            {data.mesNombre}
          </div>
        </div>
        <div className="overflow-hidden py-1">
          <div
            style={{ color: theme.accent }}
            className="intro-word text-[clamp(3.1rem,13vw,5.2rem)] uppercase"
          >
            EN CASA.
          </div>
        </div>
      </div>

      <div
        style={{ backgroundColor: theme.accent }}
        className="intro-line h-1 w-24 origin-left rounded-full"
      />

      <p className="intro-sub text-[18px] text-white/75 font-medium max-w-[320px] leading-snug">
        La historia de quién sostuvo el hogar, quién salió al rescate y quién se
        queda con los 4 títulos.
      </p>

      <div className="intro-avatars flex items-center gap-3 pt-2">
        {data.podioFinal.map((p) => (
          <AvatarCircle
            key={p.participanteId}
            nombre={p.nombre}
            fotoUrl={p.fotoUrl}
            size="md"
            accentColor={theme.textAccent}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCENA 2: EL PULSO (Acto 1: Pregunta → Acto 2: Conteo Gigante)
// ─────────────────────────────────────────────────────────────────────────────
function ScenePulso({
  data,
  theme,
}: {
  data: WrappedMensualData;
  theme: SceneTheme;
}) {
  const { pulsoHogar } = data;
  const total = Math.max(1, pulsoHogar.totalCumplimientos);
  const pPropios = Math.round((pulsoHogar.propiosCumplidos / total) * 100);
  const pAyudas = Math.round((pulsoHogar.coberturasRealizadas / total) * 100);
  const pExtras = Math.max(0, 100 - pPropios - pAyudas);

  return (
    <div className="relative min-h-[min(420px,60dvh)] flex flex-col justify-center">
      {/* ACTO 1: Tipografía cinética que entra y desaparece */}
      <div className="act1-group absolute inset-0 flex flex-col justify-center gap-2">
        <div className="overflow-hidden">
          <p
            style={{ color: theme.textAccent }}
            className="act1-line text-sm font-extrabold uppercase tracking-[0.22em]"
          >
            EL RITMO DEL MES
          </p>
        </div>
        <div className="overflow-hidden">
          <h2 className="act1-line font-display text-[clamp(2.5rem,10vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-white">
            Este mes la casa no se detuvo.
          </h2>
        </div>
      </div>

      {/* ACTO 2: Número gigante animado + proporción limpia */}
      <div className="act2-group invisible flex flex-col gap-7">
        <div>
          <span
            style={{ color: theme.textAccent }}
            className="pulso-label block text-xs font-extrabold uppercase tracking-[0.22em] mb-2"
          >
            PUNTOS GENERADOS EN EQUIPO
          </span>
          <div className="pulso-bignum font-display text-[clamp(4.5rem,18vw,7rem)] font-extrabold leading-none tracking-[-0.05em] text-white">
            +<span className="pulso-bignum-val">0</span>
          </div>
        </div>

        {/* Barra de proporción minimalista */}
        <div className="flex flex-col gap-3">
          <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden flex gap-1">
            <div
              style={{ width: `${pPropios}%`, backgroundColor: "#5C9A6A" }}
              className="pulso-bar-fill h-full origin-left rounded-full"
            />
            <div
              style={{ width: `${pAyudas}%`, backgroundColor: "#F6D582" }}
              className="pulso-bar-fill h-full origin-left rounded-full"
            />
            <div
              style={{ width: `${pExtras}%`, backgroundColor: "#E2733F" }}
              className="pulso-bar-fill h-full origin-left rounded-full"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="pulso-stat flex flex-col">
              <span className="font-display text-3xl font-extrabold text-white">
                {pulsoHogar.propiosCumplidos}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#8FD69E]">
                Deberes propios
              </span>
            </div>
            <div className="pulso-stat flex flex-col">
              <span className="font-display text-3xl font-extrabold text-white">
                {pulsoHogar.coberturasRealizadas}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#F6D582]">
                Rescates
              </span>
            </div>
            <div className="pulso-stat flex flex-col">
              <span className="font-display text-3xl font-extrabold text-white">
                {pulsoHogar.extrasReclamados}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#F4A261]">
                Extras
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCENA 3: HITOS (Acto 1: Tarea estrella → Acto 2: Especialista & Día Récord)
// ─────────────────────────────────────────────────────────────────────────────
function SceneHitos({
  data,
  theme,
}: {
  data: WrappedMensualData;
  theme: SceneTheme;
}) {
  const { pulsoHogar, hitosCuriosos } = data;

  return (
    <div className="relative min-h-[min(420px,60dvh)] flex flex-col justify-center">
      {/* ACTO 1: La tarea que movió la casa */}
      <div className="hito1-group absolute inset-0 flex flex-col justify-center gap-4">
        <span
          style={{ color: theme.textAccent }}
          className="hito1-item text-xs font-extrabold uppercase tracking-[0.22em]"
        >
          LA TAREA MÁS CUMPLIDA
        </span>

        {pulsoHogar.deberEstrella ? (
          <>
            <h2 className="hito1-item font-display text-[clamp(2.8rem,11vw,4.5rem)] font-extrabold leading-[0.98] tracking-[-0.04em] text-white">
              {pulsoHogar.deberEstrella.nombre}
            </h2>
            <div className="hito1-item flex items-baseline gap-3 pt-2">
              <span
                style={{ color: theme.accent }}
                className="font-display text-6xl font-extrabold leading-none"
              >
                {pulsoHogar.deberEstrella.veces}
              </span>
              <span className="text-lg font-bold text-white/70">
                veces completada en {data.mesNombre}
              </span>
            </div>
          </>
        ) : (
          <h2 className="hito1-item font-display text-4xl font-extrabold text-white">
            {pulsoHogar.totalCumplimientos} tareas registradas este mes.
          </h2>
        )}
      </div>

      {/* ACTO 2: Especialista y Día Récord */}
      <div className="hito2-group invisible flex flex-col gap-8">
        {hitosCuriosos.especialistaMes && (
          <div className="hito2-item flex flex-col gap-1.5">
            <span
              style={{ color: theme.textAccent }}
              className="text-xs font-extrabold uppercase tracking-[0.22em]"
            >
              ESPECIALISTA DEL MES
            </span>
            <div className="font-display text-[clamp(2.2rem,9vw,3.5rem)] font-extrabold leading-[1.04] tracking-[-0.03em] text-white">
              {hitosCuriosos.especialistaMes.participanteNombre}
            </div>
            <p className="text-lg text-white/75 font-medium">
              Hizo{" "}
              <strong className="text-white">
                {hitosCuriosos.especialistaMes.deberNombre}
              </strong>{" "}
              {hitosCuriosos.especialistaMes.veces} veces.
            </p>
          </div>
        )}

        {pulsoHogar.diaRecord && (
          <div className="hito2-item pt-5 border-t border-white/15 flex flex-col gap-1.5">
            <span
              style={{ color: theme.accent }}
              className="text-xs font-extrabold uppercase tracking-[0.22em]"
            >
              EL DÍA RÉCORD
            </span>
            <div className="font-display text-3xl font-extrabold text-white">
              {pulsoHogar.diaRecord.fechaLabel}
            </div>
            <p className="text-base text-white/70 font-medium">
              +{pulsoHogar.diaRecord.puntos} puntos sumados en un solo día.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCENAS 4, 5, 6, 7: TÍTULOS OFICIALES (Acto 1: Suspenso → Acto 2: Campeón)
// ─────────────────────────────────────────────────────────────────────────────
function SceneTitulo({
  titulo,
  numero,
  pregunta,
  etiquetaCorto,
  theme,
}: {
  titulo: TituloOficialWrapped;
  numero: string;
  pregunta: string;
  etiquetaCorto: string;
  theme: SceneTheme;
}) {
  const ganador = titulo.ganador;
  const maxValor = Math.max(
    1,
    ...titulo.tablaCompleta.map((f) => Math.max(0, f.valor)),
  );

  return (
    <div className="relative min-h-[min(460px,64dvh)] flex flex-col justify-center">
      {/* ACTO 1: SUSPENSO KINÉTICO */}
      <div className="suspense-group absolute inset-0 flex flex-col justify-center items-start gap-5">
        <div
          style={{ color: theme.accent }}
          className="suspense-num font-display text-6xl font-extrabold leading-none tracking-tighter opacity-90"
        >
          /{numero}
        </div>

        <div className="overflow-hidden">
          <div
            style={{ color: theme.textAccent }}
            className="suspense-title text-xs font-extrabold uppercase tracking-[0.25em]"
          >
            TÍTULO OFICIAL · {etiquetaCorto}
          </div>
        </div>

        <div className="overflow-hidden">
          <h2 className="suspense-title font-display text-[clamp(2.4rem,9.5vw,3.8rem)] font-extrabold leading-[1.03] tracking-[-0.03em] text-white">
            {pregunta}
          </h2>
        </div>

        <div
          style={{ borderColor: theme.accent }}
          className="suspense-ring size-16 rounded-full border-2 border-dashed mt-2"
        />
      </div>

      {/* ACTO 2: REVELACIÓN DEL GANADOR + DATOS CLAVE */}
      <div className="winner-group invisible flex flex-col gap-[clamp(12px,2.4dvh,24px)]">
        <div className="flex items-center justify-between">
          <span
            style={{ color: theme.textAccent }}
            className="winner-kicker text-xs font-extrabold uppercase tracking-[0.24em]"
          >
            {numero} · {etiquetaCorto}
          </span>
          <span
            style={{
              backgroundColor: theme.accentSoft,
              color: theme.textAccent,
            }}
            className="winner-kicker px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider"
          >
            {titulo.diferenciaConSegundo}
          </span>
        </div>

        {ganador ? (
          <>
            {/* Identidad del Ganador + Métrica Gigante */}
            <div className="flex items-center gap-4">
              <div className="winner-avatar flex -space-x-4 shrink-0">
                {(titulo.empatados.length > 1
                  ? titulo.empatados
                  : [ganador]
                ).map((g) => (
                  <AvatarCircle
                    key={g.participanteId}
                    nombre={g.nombre}
                    fotoUrl={g.fotoUrl}
                    size={titulo.empatados.length > 1 ? "md" : "lg"}
                    accentColor={theme.accent}
                  />
                ))}
              </div>

              <div className="flex flex-col min-w-0">
                <div className="overflow-hidden">
                  <h2
                    className={`winner-name font-display font-extrabold tracking-[-0.04em] text-white ${
                      titulo.empatados.length > 1
                        ? "text-[clamp(1.75rem,7vw,2.75rem)] leading-[1.06]"
                        : "text-[clamp(2.4rem,10vw,4rem)] leading-none truncate"
                    }`}
                  >
                    {titulo.empatados.length > 1
                      ? titulo.empatados.map((g) => g.nombre).join(" & ")
                      : ganador.nombre}
                  </h2>
                </div>
                <div
                  style={{ color: theme.accent }}
                  className="winner-metric font-display text-[clamp(2.1rem,8vw,3.1rem)] font-extrabold leading-none mt-1.5"
                >
                  {titulo.valorFormateado}
                </div>
              </div>
            </div>

            {/* 2 razones puntuales y visuales (sin párrafos largos) */}
            <div className="grid grid-cols-2 gap-3">
              {titulo.porQueGano.bullets.slice(0, 2).map((b, i) => (
                <div
                  key={i}
                  style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                  className="winner-reason rounded-2xl p-3 border border-white/10 flex flex-col justify-between gap-1"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
                    {b.etiqueta}
                  </span>
                  <span className="font-display text-[17px] font-extrabold text-white leading-snug">
                    {b.valor}
                  </span>
                </div>
              ))}
            </div>

            {/* Barras comparativas limpias de los 3 hermanos */}
            <div className="flex flex-col gap-2.5 pt-2">
              {titulo.tablaCompleta.slice(0, 3).map((fila) => {
                const widthPct = Math.max(
                  12,
                  Math.round((Math.max(0, fila.valor) / maxValor) * 100),
                );
                const isWinner = fila.posicion === 1 && fila.valor > 0;
                return (
                  <div
                    key={fila.participanteId}
                    className="winner-bar-row flex items-center gap-3"
                  >
                    <span className="w-20 text-xs font-bold text-white/80 truncate">
                      {fila.posicion}. {fila.nombre}
                    </span>
                    <div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: isWinner
                            ? theme.accent
                            : "rgba(255,255,255,0.28)",
                        }}
                        className="h-full rounded-full"
                      />
                    </div>
                    <span className="w-16 text-right font-display text-xs font-extrabold text-white">
                      {titulo.clave === "confiable"
                        ? `${fila.valor}%`
                        : `${Math.round(fila.valor * 10) / 10} pts`}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="py-8">
            <h3 className="font-display text-3xl font-extrabold text-white">
              Sin actividad registrada en esta categoría.
            </h3>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ESCENA 8: PODIO FINAL Y RESUMEN COMPARTIBLE
// ─────────────────────────────────────────────────────────────────────────────
function ScenePodio({
  data,
  theme,
  sharingImage,
  shareFeedback,
  onShare,
  onReplay,
  onClose,
  closeHref,
}: {
  data: WrappedMensualData;
  theme: SceneTheme;
  sharingImage: boolean;
  shareFeedback: string | null;
  onShare: () => void;
  onReplay: () => void;
  onClose?: () => void;
  closeHref?: string;
}) {
  const p1 = data.podioFinal[0];
  const p2 = data.podioFinal[1];
  const p3 = data.podioFinal[2];

  // Altura del pilar según la posición REAL (si hay empate, comparten altura)
  const alturaPorPosicion = (pos: number) =>
    pos === 1 ? "h-[clamp(52px,10dvh,84px)]" : pos === 2 ? "h-[clamp(38px,7dvh,62px)]" : "h-[clamp(26px,5dvh,44px)]";

  const renderPilar = (p: typeof p1 | undefined) => {
    if (!p) return <div className="flex-1" />;
    const pos = p.posicionGeneral;
    const isFirst = pos === 1;
    return (
      <div className="podio-col flex-1 flex flex-col items-center min-w-0">
        <AvatarCircle
          nombre={p.nombre}
          fotoUrl={p.fotoUrl}
          size={isFirst ? "md" : "sm"}
          accentColor={isFirst ? "#F6D582" : "rgba(255,255,255,0.35)"}
        />
        <span className="font-display text-[13px] font-extrabold text-white mt-1.5 truncate w-full text-center leading-tight">
          {p.nombre}
        </span>
        <span
          style={{ color: isFirst ? theme.textAccent : "rgba(255,255,255,0.6)" }}
          className="font-display text-[11px] font-bold mb-1.5"
        >
          {p.puntosTotales} pts
        </span>
        <div
          style={{
            background: isFirst
              ? "linear-gradient(180deg, #F6D582 0%, #D99B26 100%)"
              : "rgba(255,255,255,0.1)",
            color: isFirst ? "#1F1400" : "#FFFDF9",
          }}
          className={`w-full ${alturaPorPosicion(pos)} rounded-t-xl flex items-center justify-center font-display text-xl font-extrabold`}
        >
          {pos}º
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-[clamp(10px,2dvh,18px)]">
      <div className="podio-header">
        <span
          style={{ color: theme.textAccent }}
          className="text-[11px] font-extrabold uppercase tracking-[0.24em]"
        >
          PODIO · {data.labelMes}
        </span>
        <h2 className="font-display text-[clamp(1.5rem,6.5vw,2rem)] font-extrabold text-white tracking-tight leading-tight">
          Cuadro de Honor
        </h2>
      </div>

      {/* Podio de 3 columnas (2º · 1º · 3º) */}
      <div className="flex items-end gap-2.5">
        {renderPilar(p2)}
        {renderPilar(p1)}
        {renderPilar(p3)}
      </div>

      {/* Títulos por participante (filas compactas) */}
      <div className="flex flex-col gap-1.5">
        {data.podioFinal.map((p) => (
          <div
            key={p.participanteId}
            className="podio-row rounded-xl bg-white/6 border border-white/10 px-3.5 py-2 flex items-center justify-between gap-3"
          >
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <span className="font-display text-[13px] font-extrabold text-white">
                {p.nombre}
              </span>
              {p.titulosGanados.length > 0 ? (
                p.titulosGanados.map((t) => (
                  <span
                    key={t.clave}
                    style={{
                      backgroundColor: theme.accentSoft,
                      color: theme.textAccent,
                    }}
                    className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  >
                    {t.nombre}
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-white/55">
                  {p.porcentajeConfiable}% cumplido
                </span>
              )}
            </div>
            <span className="font-display text-sm font-extrabold text-white shrink-0">
              {p.puntosTotales}
            </span>
          </div>
        ))}
      </div>

      {/* Botones de cierre: siempre visibles en pantallas de teléfono */}
      <div className="podio-actions flex flex-col gap-2">
        <button
          type="button"
          disabled={sharingImage}
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          style={{ backgroundColor: "#E2733F" }}
          className="w-full py-3 rounded-xl font-display font-extrabold text-sm text-white tracking-tight active:scale-[0.98] transition-transform cursor-pointer disabled:opacity-70"
        >
          {sharingImage
            ? "Generando imagen..."
            : shareFeedback || "Compartir imagen del podio"}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReplay();
            }}
            className="py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white active:scale-[0.98] transition-transform cursor-pointer"
          >
            Repetir
          </button>

          {onClose ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="py-2.5 rounded-xl bg-white/15 hover:bg-white/20 text-xs font-bold text-[#FCEBB6] active:scale-[0.98] transition-transform cursor-pointer"
            >
              Salir
            </button>
          ) : closeHref ? (
            <a
              href={closeHref}
              onClick={(e) => e.stopPropagation()}
              className="py-2.5 rounded-xl bg-white/15 hover:bg-white/20 text-xs font-bold text-[#FCEBB6] active:scale-[0.98] transition-transform text-center"
            >
              Salir
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
