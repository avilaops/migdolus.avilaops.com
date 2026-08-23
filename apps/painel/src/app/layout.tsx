import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://migdolus.avilaops.com"),
  title: { default: "Migdolus Monitor", template: "%s · Migdolus Monitor" },
  description:
    "Monitoramento georreferenciado da broca-gigante da cana (Migdolus fryanus): armadilhas com GPS, alerta de troca de septo, mapa de calor e laudo com fotos auditáveis.",
  openGraph: {
    type: "website",
    siteName: "Migdolus Monitor",
    title: "Migdolus Monitor — inteligência de campo contra o Migdolus",
    description:
      "Do caderno de campo ao mapa de calor, no mesmo dia: armadilhas georreferenciadas, septo sempre no prazo e laudo com fotos auditáveis para a usina.",
    url: "https://migdolus.avilaops.com",
    locale: "pt_BR",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
