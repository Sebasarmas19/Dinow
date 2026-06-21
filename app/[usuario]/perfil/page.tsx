import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenerHogarActualId } from "@/lib/hogar/hogar.service";
import { listarParticipantes } from "@/lib/participantes/participantes.repo";
import { calcularEstadisticas } from "@/lib/logros/logros.service";
import { obtenerPosiciones } from "@/lib/rankings/rankings.service";
import { listarLogrosDe } from "@/lib/logros/logros.repo";
import { db } from "@/lib/db";
import { titulosMes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { CATALOGO_LOGROS } from "@/lib/logros/catalogo";

type Props = {
  params: Promise<{ usuario: string }>;
};

export default async function PerfilPage({ params }: Props) {
  const { usuario } = await params;
  const decodedUsuario = decodeURIComponent(usuario);

  const hogarId = await obtenerHogarActualId();
  const participantes = await listarParticipantes(hogarId);

  const yo = participantes.find(
    (p) => p.nombre.toLowerCase() === decodedUsuario.toLowerCase()
  );

  if (!yo) {
    redirect("/");
  }

  // Obtenemos estadísticas, posiciones, logros y títulos
  const stats = await calcularEstadisticas(yo.id);
  const posiciones = await obtenerPosiciones(yo.id);
  const obtenidos = await listarLogrosDe(yo.id);
  const titulos = await db
    .select()
    .from(titulosMes)
    .where(eq(titulosMes.participanteId, yo.id));

  // Configuración del gradiente del encabezado según el participante
  let cardBg = "linear-gradient(158deg, #F0E6D5 0%, #E6D9C4 100%)";
  let textPrimary = "text-[#38302a]";
  let textSecondary = "text-[#7a6d60]";
  let avatarBorder = "border-[#dccdb4]";

  const nameLower = yo.nombre.toLowerCase();
  if (nameLower.includes("sebastián") || nameLower.includes("sebastian")) {
    cardBg = "linear-gradient(158deg, #FCEBB6 0%, #F6D582 100%)";
    textPrimary = "text-[#7F5F00]";
    textSecondary = "text-[#A88430]";
    avatarBorder = "border-[#F6D582]";
  } else if (nameLower.includes("samuel")) {
    cardBg = "linear-gradient(158deg, #FBE3D0 0%, #F4C8A8 100%)";
    textPrimary = "text-[#A05020]";
    textSecondary = "text-[#C49060]";
    avatarBorder = "border-[#F4C8A8]";
  } else if (nameLower.includes("silvana")) {
    cardBg = "linear-gradient(158deg, #E8F1E2 0%, #D6E9CE 100%)";
    textPrimary = "text-[#3D6A42]";
    textSecondary = "text-[#5C9A6A]";
    avatarBorder = "border-[#D6E9CE]";
  }

  const renderPosicion = (pos: number) => {
    return pos > 0 ? `${pos}º` : "—";
  };

  const haGanado = (clave: string, nivel: "bronce" | "plata" | "oro") => {
    return obtenidos.some((o) => o.logroClave === clave && o.nivel === nivel);
  };

  const formatTituloMes = (mesStr: string) => {
    const [y, m] = mesStr.split("-");
    const monthNames = [
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
    const monthIdx = parseInt(m, 10) - 1;
    return `${monthNames[monthIdx] || m} ${y}`;
  };

  return (
    <main className="p-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-rise">
        <h1 className="font-display text-[26px] font-extrabold text-tinta tracking-tight">
          Mi Perfil
        </h1>
        <Link
          href="/"
          className="text-[13px] font-bold text-terracota bg-[#fbe3d0] hover:bg-[#f4c8a8] px-3 py-1.5 rounded-xl transition-colors active:scale-95"
        >
          Cerrar sesión
        </Link>
      </div>

      {/* Tarjeta de Encabezado de Perfil */}
      <div
        className="rounded-[28px] p-6 shadow-sm flex flex-col items-center gap-4 animate-rise-delay-1 relative overflow-hidden"
        style={{ background: cardBg }}
      >
        {/* Avatar */}
        <div className="relative">
          <div
            className={`size-20 rounded-full bg-white flex items-center justify-center text-3xl font-bold border-4 ${avatarBorder} overflow-hidden shadow-sm`}
          >
            {yo.fotoUrl ? (
              <img
                src={yo.fotoUrl}
                alt={yo.nombre}
                className="size-full object-cover"
              />
            ) : (
              yo.nombre.charAt(0).toUpperCase()
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 bg-white text-[14px] rounded-full size-6 flex items-center justify-center shadow border border-[#faf5eb]">
            🌟
          </div>
        </div>

        {/* Nombre y Rol */}
        <div className="text-center">
          <h2 className={`font-display text-[22px] font-extrabold tracking-tight ${textPrimary}`}>
            {yo.nombre}
          </h2>
          <p className={`text-[13px] font-semibold tracking-wide uppercase ${textSecondary} mt-0.5`}>
            Participante de la Casa
          </p>
        </div>
      </div>

      {/* Cuadrícula 2x2 para Posiciones del Ranking */}
      <div className="flex flex-col gap-3.5 animate-rise-delay-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-[#a0907c] px-1">
          Mis Posiciones en Ranking
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "General", val: posiciones.general, emoji: "🏆" },
            { label: "Confiable", val: posiciones.confiable, emoji: "✅" },
            { label: "Solidario", val: posiciones.solidario, emoji: "🤝" },
            { label: "Responsable", val: posiciones.responsable, emoji: "🌟" },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-crema-card border border-[#f0e6d5] rounded-2xl p-4 shadow-sm flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-1.5 text-[#a0907c] text-[13px] font-bold">
                <span>{item.emoji}</span>
                <span>{item.label}</span>
              </div>
              <span className="font-display text-[24px] font-extrabold text-tinta">
                {renderPosicion(item.val)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Panel de Estadísticas (Racha, Coberturas, Extras) */}
      <div className="bg-crema-card border border-[#f0e6d5] rounded-3xl p-5 shadow-sm grid grid-cols-3 gap-2 text-center animate-rise-delay-2">
        <div className="flex flex-col gap-1">
          <span className="text-[20px]">🔥</span>
          <span className="font-display text-[18px] font-extrabold text-tinta">
            {stats.rachaDias}
          </span>
          <span className="text-[11px] font-bold text-[#a0907c] uppercase tracking-wider">
            Racha Días
          </span>
        </div>
        <div className="flex flex-col gap-1 border-x border-[#faf5eb]">
          <span className="text-[20px]">🤝</span>
          <span className="font-display text-[18px] font-extrabold text-tinta">
            {stats.coberturas}
          </span>
          <span className="text-[11px] font-bold text-[#a0907c] uppercase tracking-wider">
            Coberturas
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[20px]">✨</span>
          <span className="font-display text-[18px] font-extrabold text-tinta">
            {stats.extras}
          </span>
          <span className="text-[11px] font-bold text-[#a0907c] uppercase tracking-wider">
            Extras Hechos
          </span>
        </div>
      </div>

      {/* Logros/Medallas de la Casa */}
      <div className="flex flex-col gap-3.5 animate-rise-delay-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-[#a0907c] px-1">
          Mis Logros y Medallas
        </h3>
        <div className="flex flex-col gap-4">
          {CATALOGO_LOGROS.map((logro) => {
            const currentVal = stats[logro.metrica];
            return (
              <div
                key={logro.clave}
                className="bg-crema-card border border-[#f0e6d5] rounded-3xl p-5 shadow-sm flex flex-col gap-3"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <h4 className="font-display text-[16px] font-extrabold text-tinta">
                      {logro.nombre}
                    </h4>
                    <span className="text-[12px] font-bold text-terracota bg-[#fbe3d0] px-2 py-0.5 rounded-full">
                      Progreso: {currentVal}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#9a8c7c] mt-0.5">
                    {logro.descripcion}
                  </p>
                </div>

                {/* Medallas */}
                <div className="grid grid-cols-3 gap-2">
                  {logro.niveles.map((lvl) => {
                    const earned = haGanado(logro.clave, lvl.nivel);
                    let medalEmoji = "🥉";
                    let medalStyle = "";

                    if (lvl.nivel === "oro") {
                      medalEmoji = "🥇";
                      medalStyle = earned
                        ? "bg-gradient-to-br from-[#FFE082] to-[#FFB300] text-[#7F5F00] border-[#FFB300]"
                        : "";
                    } else if (lvl.nivel === "plata") {
                      medalEmoji = "🥈";
                      medalStyle = earned
                        ? "bg-gradient-to-br from-[#E0E0E0] to-[#9E9E9E] text-[#424242] border-[#9E9E9E]"
                        : "";
                    } else {
                      medalStyle = earned
                        ? "bg-gradient-to-br from-[#D7CCC8] to-[#8D6E63] text-[#4E342E] border-[#8D6E63]"
                        : "";
                    }

                    return (
                      <div
                        key={lvl.nivel}
                        className={`flex flex-col items-center gap-1 py-2 rounded-xl text-center border transition-all ${
                          earned
                            ? `${medalStyle} font-bold text-[12px] shadow-sm`
                            : "bg-[#f0e6d5]/40 border-[#faf5eb] text-[#a0907c] opacity-50 font-semibold text-[11px]"
                        }`}
                      >
                        <span className="text-[18px]">{earned ? medalEmoji : "🔒"}</span>
                        <span className="capitalize">{lvl.nivel}</span>
                        <span className="text-[9px] font-bold opacity-85">
                          {earned ? `Meta: ${lvl.umbral}` : `Mín. ${lvl.umbral}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Historial de Títulos Mensuales (Past Honors) */}
      <div className="flex flex-col gap-3.5 animate-rise-delay-2">
        <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-[#a0907c] px-1">
          Honores Pasados (Títulos)
        </h3>
        {titulos.length > 0 ? (
          <div className="bg-crema-card border border-[#f0e6d5] rounded-3xl p-4 shadow-sm flex flex-col divide-y divide-[#faf5eb]">
            {titulos.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between py-3 px-1.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[16px]">🏅</span>
                  <span className="font-bold text-[14px] text-tinta capitalize">
                    {t.ranking === "general" ? "Campeón General" : `Más ${t.ranking}`}
                  </span>
                </div>
                <span className="font-display text-[12px] font-extrabold text-terracota bg-[#fbe3d0] px-2 py-0.5 rounded-lg">
                  {formatTituloMes(t.mes)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-[13px] text-[#a0907c] font-semibold bg-crema-card border border-[#f0e6d5] rounded-3xl">
            Aún no has ganado títulos mensuales. ¡Sigue esforzándote! ⚡
          </div>
        )}
      </div>
    </main>
  );
}
