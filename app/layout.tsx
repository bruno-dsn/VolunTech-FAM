import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VolunTech | Gestão do voluntariado",
  description: "Demonstração acadêmica de gestão de voluntários, ações, parceiros e doações hospitalares com dados fictícios.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
