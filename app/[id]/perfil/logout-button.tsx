"use client";

import { useState } from "react";
import { cerrarSesionClienteAction } from "@/lib/auth/auth.actions";

export function LogoutButton() {
  const [saliendo, setSaliendo] = useState(false);

  const handleLogout = async () => {
    setSaliendo(true);
    try {
      await cerrarSesionClienteAction();
      window.location.replace("/");
    } catch {
      window.location.replace("/");
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={saliendo}
      className="text-[13px] font-bold text-terracota bg-[#fbe3d0] hover:bg-[#f4c8a8] px-3 py-1.5 rounded-xl transition-colors active:scale-95 disabled:opacity-50"
    >
      {saliendo ? "Saliendo..." : "Cerrar Sesión"}
    </button>
  );
}
