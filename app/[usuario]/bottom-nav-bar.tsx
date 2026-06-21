"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  usuario: string;
};

export function BottomNavBar({ usuario }: Props) {
  const pathname = usePathname();

  // Helper para determinar si el link está activo
  const isActive = (href: string) => {
    // Si es la página de inicio, tiene que coincidir exactamente (con o sin barra al final)
    if (href === `/${usuario}`) {
      return pathname === `/${usuario}` || pathname === `/${usuario}/`;
    }
    // Para las sub-páginas, verificamos si la ruta actual empieza por el href
    return pathname.startsWith(href);
  };

  const navItems = [
    {
      label: "Inicio",
      href: `/${usuario}`,
      icon: (
        <svg
          className="size-6 transition-transform duration-200 group-active:scale-90"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      label: "Ranking",
      href: `/${usuario}/ranking`,
      icon: (
        <svg
          className="size-6 transition-transform duration-200 group-active:scale-90"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
          <path d="M12 2a5 5 0 0 0-5 5v3c0 2.76 2.24 5 5 5s5-2.24 5-5V7a5 5 0 0 0-5-5z" />
        </svg>
      ),
    },
    {
      label: "Plan",
      href: `/${usuario}/plan`,
      icon: (
        <svg
          className="size-6 transition-transform duration-200 group-active:scale-90"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
          <line x1="16" x2="16" y1="2" y2="6" />
          <line x1="8" x2="8" y1="2" y2="6" />
          <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
      ),
    },
    {
      label: "Perfil",
      href: `/${usuario}/perfil`,
      icon: (
        <svg
          className="size-6 transition-transform duration-200 group-active:scale-90"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-[420px] bg-crema-card border-t border-[#f0e6d5] px-6 py-3 shadow-md">
      <div className="flex justify-between items-center">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              aria-current={active ? "page" : undefined}
              className={`group flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all duration-200 hover:bg-[#faf5eb] active:scale-95 ${
                active
                  ? "text-[#D2602F] font-bold"
                  : "text-[#a0907c] hover:text-tinta font-medium"
              }`}
            >
              {item.icon}
              <span className="text-[12px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
