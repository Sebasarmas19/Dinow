"use client";

import { useState } from "react";

type AuditoriaAdminData = {
  entrada: {
    id: string;
    fecha: Date | null;
    accion: string;
    detalle: unknown;
  };
  adminNombre: string;
};

type HistorialUsuarioData = {
  transaccion: {
    id: string;
    fecha: string; // date en postgres viene como string YYYY-MM-DD
    cantidad: string;
    tipo: string;
  };
  participante: { id: string; nombre: string };
  registro: { estado: string; nota: string | null } | null;
  deber: { nombre: string } | null;
  ayudado: { id: string; nombre: string } | null;
};

type AuditoriaClientProps = {
  participantes: { id: string; nombre: string; fotoUrl: string | null }[];
  auditoriaAdmin: AuditoriaAdminData[];
  historialUsuarios: HistorialUsuarioData[];
};

export function AuditoriaClient({
  participantes,
  auditoriaAdmin,
  historialUsuarios,
}: AuditoriaClientProps) {
  // admin | <participanteId>
  const [perfilActivo, setPerfilActivo] = useState<string>("admin");

  return (
    <div className="flex flex-col gap-6">
      {/* Selector de Perfiles (Tabs) */}
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {/* Tab Admin */}
        <button
          onClick={() => setPerfilActivo("admin")}
          className={`flex flex-col items-center gap-2 rounded-2xl p-3 transition-colors min-w-[80px] ${
            perfilActivo === "admin"
              ? "bg-[#3b2a1a] text-white shadow-md"
              : "bg-white text-[#8c7b68] hover:bg-[#fcf8f2]"
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
            👑
          </div>
          <span className="text-xs font-bold uppercase tracking-wider">
            Admin
          </span>
        </button>

        {/* Tabs de Participantes */}
        {participantes.map((p) => {
          const inicial = p.nombre.charAt(0).toUpperCase();
          return (
            <button
              key={p.id}
              onClick={() => setPerfilActivo(p.id)}
              className={`flex flex-col items-center gap-2 rounded-2xl p-3 transition-colors min-w-[80px] ${
                perfilActivo === p.id
                  ? "bg-[#3b2a1a] text-white shadow-md"
                  : "bg-white text-[#8c7b68] hover:bg-[#fcf8f2]"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl font-black shadow-sm overflow-hidden text-[#3b2a1a]">
                {p.fotoUrl ? (
                  <img src={p.fotoUrl} alt={p.nombre} className="h-full w-full object-cover" />
                ) : (
                  inicial
                )}
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">
                {p.nombre.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contenido (Línea de tiempo) */}
      <div className="rounded-3xl bg-white p-5 shadow-sm lg:p-6 border-2 border-[#e8dcc4] min-w-0">
        {perfilActivo === "admin" ? (
          <ListaAdmin auditoriaAdmin={auditoriaAdmin} participantes={participantes} />
        ) : (
          <ListaUsuario
            usuarioId={perfilActivo}
            historialUsuarios={historialUsuarios}
          />
        )}
      </div>
    </div>
  );
}

function ListaAdmin({
  auditoriaAdmin,
  participantes,
}: {
  auditoriaAdmin: AuditoriaAdminData[];
  participantes: { id: string; nombre: string; fotoUrl: string | null }[];
}) {
  if (auditoriaAdmin.length === 0) {
    return (
      <div className="py-8 text-center text-sm font-medium text-[#a39481]">
        No hay registros recientes del admin.
      </div>
    );
  }

  const formatearAccion = (accion: string) => {
    switch (accion) {
      case "editar_configuracion":
        return "Editó la Configuración Global";
      case "ajuste_puntos":
        return "Ajustó puntos manualmente";
      case "editar_plan":
        return "Modificó el Plan Semanal";
      case "editar_deberes":
        return "Editó los deberes de la casa";
      case "editar_participantes":
        return "Editó un participante";
      default:
        return `Acción: ${accion}`;
    }
  };

  const renderDetalles = (accion: string, detalle: any) => {
    if (!detalle) return null;

    if (accion === "editar_configuracion") {
      return (
        <ul className="mt-2 flex flex-col gap-1 rounded-xl bg-[#fcf8f2] p-3 text-sm text-[#8c7b68] border border-[#e8dcc4]">
          {Object.entries(detalle).map(([key, value]) => (
            <li key={key}>
              <span className="font-semibold capitalize text-[#3b2a1a]">
                {key.replace(/([A-Z])/g, " $1")}:
              </span>{" "}
              {String(value)}
            </li>
          ))}
        </ul>
      );
    }

    if (accion === "ajuste_puntos") {
      const p = participantes.find((x) => x.id === detalle.participanteId);
      const nombre = p ? p.nombre : "Alguien";
      return (
        <div className="mt-2 flex flex-col gap-1 rounded-xl bg-[#fcf8f2] p-3 text-sm text-[#8c7b68] border border-[#e8dcc4]">
          <p>
            Afectado: <span className="font-semibold text-[#3b2a1a]">{nombre}</span>
          </p>
          <p>
            <span className="font-semibold text-[#3b2a1a]">Monto:</span>{" "}
            {detalle.cantidad > 0 ? `+${detalle.cantidad}` : detalle.cantidad} pts
          </p>
          <p>
            <span className="font-semibold text-[#3b2a1a]">Motivo:</span>{" "}
            {detalle.motivo}
          </p>
        </div>
      );
    }

    return (
      <pre className="mt-2 rounded-xl bg-[#fcf8f2] p-3 text-[10px] sm:text-xs text-[#8c7b68] whitespace-pre-wrap break-all border border-[#e8dcc4]">
        {JSON.stringify(detalle, null, 2)}
      </pre>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {auditoriaAdmin.map((item) => {
        let fecha = "Fecha desconocida";
        if (item.entrada.fecha) {
          fecha = new Intl.DateTimeFormat("es-ES", {
            dateStyle: "long",
            timeStyle: "short",
          }).format(new Date(item.entrada.fecha));
        }

        return (
          <div key={item.entrada.id} className="flex gap-4 min-w-0">
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f3f0ea] text-[#8c7b68]">
                📝
              </div>
              <div className="mt-2 h-full w-[2px] bg-[#e8dcc4]"></div>
            </div>
            <div className="pb-6 min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-[#a39481]">
                {fecha}
              </p>
              <p className="mt-1 font-semibold text-[#3b2a1a] text-base">
                {formatearAccion(item.entrada.accion)}
              </p>
              <p className="text-xs text-[#a39481] italic">
                Iniciado por {item.adminNombre}
              </p>
              {renderDetalles(item.entrada.accion, item.entrada.detalle)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListaUsuario({
  usuarioId,
  historialUsuarios,
}: {
  usuarioId: string;
  historialUsuarios: HistorialUsuarioData[];
}) {
  const eventos = historialUsuarios.filter(
    (h) => h.participante.id === usuarioId
  );

  if (eventos.length === 0) {
    return (
      <div className="py-8 text-center text-sm font-medium text-[#a39481]">
        No hay actividad reciente para este participante.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {eventos.map((item) => {
        // Postgres date viene como YYYY-MM-DD
        const fechaFormateada = new Intl.DateTimeFormat("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date(item.transaccion.fecha + "T12:00:00"));

        const puntos = parseFloat(item.transaccion.cantidad);
        const esPositivo = puntos > 0;
        const colorIcono = esPositivo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";
        const icono = esPositivo ? "✨" : "⚠️";

        // Armar el mensaje bonito
        let mensaje = "";
        let detalleAdicional = item.registro?.nota || null;

        switch (item.transaccion.tipo) {
          case "cumplimiento":
            mensaje = `Cumplió su deber: ${item.deber?.nombre}`;
            break;
          case "bono_ayuda":
            mensaje = item.ayudado
              ? `Ayudó a ${item.ayudado.nombre} con: ${item.deber?.nombre}`
              : `Bono de ayuda: ${item.deber?.nombre}`;
            break;
          case "reclamable":
            mensaje = `Reclamó la tarea: ${item.deber?.nombre}`;
            break;
          case "penalizacion":
            mensaje = `No cumplió su deber: ${item.deber?.nombre}`;
            break;
          case "penalizacion_colectiva":
            mensaje = `Penalización por tarea inamovible abandonada.`;
            break;
          case "ajuste_admin":
            mensaje = `Ajuste manual del Admin.`;
            break;
          default:
            mensaje = `Registro de puntos.`;
        }

        return (
          <div key={item.transaccion.id} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colorIcono}`}>
                <span className="text-sm font-bold">{puntos > 0 ? `+${puntos}` : puntos}</span>
              </div>
              <div className="mt-2 h-full w-[2px] bg-[#e8dcc4]"></div>
            </div>
            <div className="pb-6 pt-1">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#a39481]">
                {fechaFormateada}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#3b2a1a] sm:text-base">
                {mensaje}
              </p>
              {detalleAdicional && (
                <p className="mt-2 rounded-xl bg-[#fcf8f2] p-3 text-xs italic text-[#8c7b68]">
                  "{detalleAdicional}"
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
