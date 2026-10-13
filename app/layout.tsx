import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "./globals.css";

// Tipografias del diseno: Bricolage Grotesque para titulos (con caracter) y
// Hanken Grotesk para el resto de la interfaz. Se exponen como variables CSS
// para usarlas con Tailwind (font-display / font-sans).
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dinow",
  description: "Organiza, recuerda y registra los deberes del hogar.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dinow",
  }
};

// El color de la barra del navegador/PWA coincide con el fondo crema.
export const viewport: Viewport = {
  themeColor: "#F3EAD9",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${bricolage.variable} ${hanken.variable} antialiased`}
    >
      <body className="min-h-screen bg-crema text-tinta">
        {children}
        <Toaster 
          position="top-center" 
          toastOptions={{
            duration: 3500,
            style: {
              background: '#fcf8f2',
              color: '#3c280f',
              border: '1.5px solid #e6d9c4',
              borderRadius: '16px',
              fontWeight: 600,
              boxShadow: '0 10px 30px -10px rgba(60,40,15,0.15)',
            },
          }} 
        />
      </body>
    </html>
  );
}
