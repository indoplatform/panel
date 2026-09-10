import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Indoplatform Panel",
  description: "Self-hosted server monitoring & control panel",
  icons: { icon: "/imgs/panel-logo.svg" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
