import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "FLUXA — AI Company OS", template: "%s · FLUXA" },
  description: "AI社員を構築・管理・連携し、あなたのビジネスを自動で動かす次世代のAI会社OS。Build your AI Company.",
};

export const viewport: Viewport = { themeColor: "#06080c", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("fluxa_theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="ja" data-theme={theme}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
